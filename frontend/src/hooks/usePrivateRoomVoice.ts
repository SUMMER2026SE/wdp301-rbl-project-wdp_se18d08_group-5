import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from './useSocket';
import type { PrivateRoomTeam } from './usePrivateRoomSocket';
import { loadWebRtcConfiguration, WEBRTC_CONFIGURATION } from '@/config/webrtc';
import { attachLocalTrack, findSenderForKind } from '@/utils/webrtcNegotiation';

interface UsePrivateRoomVoiceOptions {
  roomId: string;
  team: PrivateRoomTeam;
  enabled: boolean;
}

interface RemotePeer {
  socketId: string;
  userId: string;
  stream: MediaStream | null;
}

function getMicrophoneErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return 'Microphone needs HTTPS or a trusted local origin';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot access microphone on this page';
  }
  const errorName = error instanceof DOMException ? error.name : '';
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return 'Microphone permission was blocked';
  }
  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return 'No microphone device was found';
  }
  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return 'Microphone is being used by another app';
  }
  return 'Could not access microphone';
}

export function usePrivateRoomVoice({ roomId, team, enabled }: UsePrivateRoomVoiceOptions) {
  const [micActive, setMicActive] = useState(false);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const voiceChannel = `private-${team}-voice`;

  const streamRef = useRef<MediaStream | null>(null);
  const rtcConfigurationRef = useRef<RTCConfiguration>(WEBRTC_CONFIGURATION);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const joinedVoiceRef = useRef(false);
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playbackWarningShownRef = useRef(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const attachRemoteStream = useCallback((peerSocketId: string, stream: MediaStream) => {
    let audio = remoteAudioRefs.current.get(peerSocketId);

    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.dataset.privateVoice = '1';
      audio.dataset.voicePeer = peerSocketId;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      remoteAudioRefs.current.set(peerSocketId, audio);
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }

    audio.play().catch(() => {
      if (!playbackWarningShownRef.current) {
        playbackWarningShownRef.current = true;
        toast.error('Click the page once to enable private room audio');
      }

      const retryPlayback = () => {
        audio?.play().catch(() => undefined);
      };

      document.addEventListener('click', retryPlayback, { once: true });
    });
  }, []);

  const removeRemoteAudio = useCallback((peerSocketId: string) => {
    const audio = remoteAudioRefs.current.get(peerSocketId);
    if (!audio) return;

    audio.pause();
    audio.srcObject = null;
    audio.remove();
    remoteAudioRefs.current.delete(peerSocketId);
  }, []);

  const attachLocalTracks = useCallback(async (pc: RTCPeerConnection) => {
    if (!streamRef.current) return;
    const [track] = streamRef.current.getAudioTracks();
    if (!track) return;
    await attachLocalTrack(pc, track, streamRef.current);
  }, []);

  const ensurePeerConnection = useCallback(
    (peerSocketId: string) => {
      const existing = peerConnectionsRef.current.get(peerSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(rtcConfigurationRef.current);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        getSocket()?.emit('voice:ice-candidate', {
          roomId,
          team: voiceChannel,
          targetSocketId: peerSocketId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          attachRemoteStream(peerSocketId, remoteStream);
          setPeers((prev) => {
            const idx = prev.findIndex((p) => p.socketId === peerSocketId);
            if (idx === -1) {
              return [
                ...prev,
                { socketId: peerSocketId, userId: '', stream: remoteStream },
              ];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], stream: remoteStream };
            return next;
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pc.close();
          peerConnectionsRef.current.delete(peerSocketId);
          removeRemoteAudio(peerSocketId);
          setPeers((prev) => prev.filter((p) => p.socketId !== peerSocketId));
        }
      };

      peerConnectionsRef.current.set(peerSocketId, pc);
      return pc;
    },
    [attachRemoteStream, removeRemoteAudio, roomId, voiceChannel],
  );

  const sendOffer = useCallback(
    async (peerSocketId: string) => {
      const socket = getSocket();
      if (!socket) return;
      const pc = ensurePeerConnection(peerSocketId);
      if (pc.signalingState !== 'stable') return;
      await attachLocalTracks(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice:offer', {
        roomId,
        team: voiceChannel,
        targetSocketId: peerSocketId,
        offer: pc.localDescription,
      });
    },
    [attachLocalTracks, ensurePeerConnection, roomId, voiceChannel],
  );

  const closePeer = useCallback((peerSocketId: string) => {
    const pc = peerConnectionsRef.current.get(peerSocketId);
    pc?.close();
    peerConnectionsRef.current.delete(peerSocketId);
    pendingCandidatesRef.current.delete(peerSocketId);
    removeRemoteAudio(peerSocketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== peerSocketId));
  }, [removeRemoteAudio]);

  const stopAudioMeter = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopMic = useCallback(() => {
    stopAudioMeter();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => {
      findSenderForKind(pc, 'audio')?.replaceTrack(null).catch(() => undefined);
    });
    setMicActive(false);
  }, [stopAudioMeter]);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          setAudioLevel(avg / 255);
          animationRef.current = requestAnimationFrame(tick);
        };
        animationRef.current = requestAnimationFrame(tick);
      }

      await Promise.all(Array.from(peerConnectionsRef.current.keys()).map(sendOffer));
      setMicActive(true);
    } catch (error) {
      toast.error(getMicrophoneErrorMessage(error));
      stopMic();
    }
  }, [sendOffer, stopMic]);

  useEffect(() => {
    if (!enabled || !roomId || !team) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    let cancelled = false;

    const joinVoice = () => {
      socket.emit('voice:join', { roomId, team: voiceChannel }, (response?: { peers: Array<{ socketId: string; userId: string }> }) => {
        joinedVoiceRef.current = true;
        const list = response?.peers || [];
        setPeers((prev) => {
          const next = [...prev];
          list.forEach((peer) => {
            ensurePeerConnection(peer.socketId);
            if (!next.find((p) => p.socketId === peer.socketId)) {
              next.push({ socketId: peer.socketId, userId: peer.userId, stream: null });
            }
          });
          return next;
        });
        if (streamRef.current) {
          list.forEach((peer) => sendOffer(peer.socketId).catch(() => undefined));
        }
      });
    };

    const handleUserJoined = (payload: { socketId: string; userId: string; team?: string }) => {
      if (payload.team !== voiceChannel) return;
      ensurePeerConnection(payload.socketId);
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === payload.socketId)) return prev;
        return [...prev, { socketId: payload.socketId, userId: payload.userId, stream: null }];
      });
      if (streamRef.current) {
        sendOffer(payload.socketId).catch(() => undefined);
      }
    };

    const handleUserLeft = (payload: { socketId: string; team?: string }) => {
      if (payload.team !== voiceChannel) return;
      closePeer(payload.socketId);
    };

    const flushPendingCandidates = async (peerSocketId: string, pc: RTCPeerConnection) => {
      const list = pendingCandidatesRef.current.get(peerSocketId) || [];
      pendingCandidatesRef.current.delete(peerSocketId);
      for (const candidate of list) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleOffer = async (payload: {
      roomId: string;
      team?: string;
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== voiceChannel) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        await attachLocalTracks(pc);
        await flushPendingCandidates(payload.fromSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', {
          roomId,
          team: voiceChannel,
          targetSocketId: payload.fromSocketId,
          answer: pc.localDescription,
        });
      } catch (err) {
        console.error('Private room voice offer error:', err);
      }
    };

    const handleAnswer = async (payload: {
      roomId: string;
      team?: string;
      fromSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== voiceChannel) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushPendingCandidates(payload.fromSocketId, pc);
      } catch (err) {
        console.error('Private room voice answer error:', err);
      }
    };

    const handleIce = async (payload: {
      roomId: string;
      team?: string;
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== voiceChannel) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        if (!pc.remoteDescription) {
          const list = pendingCandidatesRef.current.get(payload.fromSocketId) || [];
          list.push(payload.candidate);
          pendingCandidatesRef.current.set(payload.fromSocketId, list);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error('Private room voice ICE error:', err);
      }
    };

    void loadWebRtcConfiguration().then((configuration) => {
      if (cancelled) return;
      rtcConfigurationRef.current = configuration;
      socket.on('connect', joinVoice);
      socket.on('voice:user-joined', handleUserJoined);
      socket.on('voice:user-left', handleUserLeft);
      socket.on('voice:offer', handleOffer);
      socket.on('voice:answer', handleAnswer);
      socket.on('voice:ice-candidate', handleIce);

      if (socket.connected) {
        joinVoice();
      }
    });

    return () => {
      cancelled = true;
      socket.off('connect', joinVoice);
      socket.off('voice:user-joined', handleUserJoined);
      socket.off('voice:user-left', handleUserLeft);
      socket.off('voice:offer', handleOffer);
      socket.off('voice:answer', handleAnswer);
      socket.off('voice:ice-candidate', handleIce);

      if (joinedVoiceRef.current) {
        socket.emit('voice:leave', { roomId, team: voiceChannel });
        joinedVoiceRef.current = false;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      remoteAudioRefs.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });
      remoteAudioRefs.current.clear();
      setPeers([]);
    };
  }, [attachLocalTracks, closePeer, enabled, ensurePeerConnection, roomId, sendOffer, voiceChannel]);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return { micActive, peers, audioLevel, startMic, stopMic };
}
