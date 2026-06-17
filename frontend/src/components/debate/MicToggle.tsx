import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';

interface MicToggleProps {
  roomId: string;
  disabled?: boolean;
}

type VoicePeer = {
  socketId: string;
  userId: string;
};

type VoiceJoinResponse = {
  peers: VoicePeer[];
};

type VoiceOfferPayload = {
  roomId: string;
  fromSocketId: string;
  fromUserId: string;
  offer: RTCSessionDescriptionInit;
};

type VoiceAnswerPayload = {
  roomId: string;
  fromSocketId: string;
  fromUserId: string;
  answer: RTCSessionDescriptionInit;
};

type VoiceIcePayload = {
  roomId: string;
  fromSocketId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
};

type VoiceUserPayload = {
  socketId: string;
  userId: string;
};

const peerConnectionConfig: RTCConfiguration = {
  iceServers: [],
};

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

function getAudioContextCtor() {
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

export function MicToggle({ roomId, disabled = false }: MicToggleProps) {
  const { micActive, setMicActive, setIsSpeaking } = useDebateStore();
  const { user } = useAuthStore();
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const joinedVoiceRef = useRef(false);
  const playbackWarningShownRef = useRef(false);

  const attachRemoteStream = useCallback((peerSocketId: string, stream: MediaStream) => {
    let audio = remoteAudioRefs.current.get(peerSocketId);

    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
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
        toast.error('Click the page once to enable voice playback');
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

  const addLocalTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    pc.getSenders()
      .filter((sender) => sender.track?.kind === 'audio')
      .forEach((sender) => pc.removeTrack(sender));

    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }, []);

  const removeLocalTracks = useCallback((pc: RTCPeerConnection) => {
    pc.getSenders()
      .filter((sender) => sender.track?.kind === 'audio')
      .forEach((sender) => pc.removeTrack(sender));
  }, []);

  const ensurePeerConnection = useCallback(
    (peerSocketId: string) => {
      const existing = peerConnectionsRef.current.get(peerSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(peerConnectionConfig);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        getSocket()?.emit('voice:ice-candidate', {
          roomId,
          targetSocketId: peerSocketId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          attachRemoteStream(peerSocketId, remoteStream);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState !== 'failed' && pc.connectionState !== 'closed') return;
        pc.close();
        peerConnectionsRef.current.delete(peerSocketId);
        removeRemoteAudio(peerSocketId);
      };

      if (streamRef.current) {
        addLocalTracks(pc, streamRef.current);
      }

      peerConnectionsRef.current.set(peerSocketId, pc);
      return pc;
    },
    [addLocalTracks, attachRemoteStream, removeRemoteAudio, roomId],
  );

  const flushPendingCandidates = useCallback(async (peerSocketId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current.get(peerSocketId) || [];
    pendingCandidatesRef.current.delete(peerSocketId);

    for (const candidate of candidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const sendOffer = useCallback(
    async (peerSocketId: string) => {
      const socket = getSocket();
      if (!socket) return;

      const pc = ensurePeerConnection(peerSocketId);
      if (pc.signalingState !== 'stable') return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('voice:offer', {
        roomId,
        targetSocketId: peerSocketId,
        offer: pc.localDescription,
      });
    },
    [ensurePeerConnection, roomId],
  );

  const closePeerConnection = useCallback(
    (peerSocketId: string) => {
      const pc = peerConnectionsRef.current.get(peerSocketId);
      pc?.close();
      peerConnectionsRef.current.delete(peerSocketId);
      pendingCandidatesRef.current.delete(peerSocketId);
      removeRemoteAudio(peerSocketId);
    },
    [removeRemoteAudio],
  );

  const closeAllPeerConnections = useCallback(() => {
    Array.from(peerConnectionsRef.current.keys()).forEach(closePeerConnection);
  }, [closePeerConnection]);

  const stopAudioMeter = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  const stopLocalStream = useCallback(() => {
    stopAudioMeter();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [stopAudioMeter]);

  const startAudioMeter = useCallback((stream: MediaStream) => {
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) {
      throw new Error('AudioContext is not supported');
    }

    const ctx = new AudioContextCtor();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((total, value) => total + value, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
  }, []);

  const startMic = useCallback(async () => {
    if (disabled || micActive) return;

    const socket = getSocket();
    if (!socket) {
      toast.error('Realtime connection is not ready');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;
      startAudioMeter(stream);

      peerConnectionsRef.current.forEach((pc) => addLocalTracks(pc, stream));
      await Promise.all(Array.from(peerConnectionsRef.current.keys()).map(sendOffer));

      setMicActive(true);
      setIsSpeaking(true);
    } catch (error) {
      console.error('Microphone access error:', error);
      toast.error(getMicrophoneErrorMessage(error));
      stopLocalStream();
    }
  }, [
    addLocalTracks,
    disabled,
    micActive,
    sendOffer,
    setIsSpeaking,
    setMicActive,
    startAudioMeter,
    stopLocalStream,
  ]);

  const stopMic = useCallback(() => {
    stopLocalStream();
    peerConnectionsRef.current.forEach(removeLocalTracks);
    Array.from(peerConnectionsRef.current.keys()).forEach((peerSocketId) => {
      sendOffer(peerSocketId).catch(() => undefined);
    });

    setMicActive(false);
    setIsSpeaking(false);

    getSocket()?.emit('mic:stopped', { roomId, userId: user?._id });
  }, [
    removeLocalTracks,
    roomId,
    sendOffer,
    setIsSpeaking,
    setMicActive,
    stopLocalStream,
    user?._id,
  ]);

  useEffect(() => {
    if (disabled && micActive) {
      stopMic();
    }
  }, [disabled, micActive, stopMic]);

  useEffect(() => {
    let retryTimer: number | null = null;
    let activeSocket = getSocket();
    let cleanupSocket = () => undefined;

    const setupVoiceSocket = () => {
      activeSocket = getSocket();

      if (!activeSocket) {
        retryTimer = window.setTimeout(setupVoiceSocket, 500);
        return;
      }

      const joinVoiceRoom = () => {
        activeSocket?.emit('voice:join', { roomId }, (response?: VoiceJoinResponse) => {
          joinedVoiceRef.current = true;
          const peers = response?.peers || [];

          peers.forEach((peer) => {
            ensurePeerConnection(peer.socketId);
            if (streamRef.current) {
              sendOffer(peer.socketId).catch(() => undefined);
            }
          });
        });
      };

      const handleUserJoined = (payload: VoiceUserPayload) => {
        ensurePeerConnection(payload.socketId);
        if (streamRef.current) {
          sendOffer(payload.socketId).catch(() => undefined);
        }
      };

      const handleUserLeft = (payload: VoiceUserPayload) => {
        closePeerConnection(payload.socketId);
      };

      const handleOffer = async (payload: VoiceOfferPayload) => {
        if (payload.roomId !== roomId) return;

        try {
          const pc = ensurePeerConnection(payload.fromSocketId);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          await flushPendingCandidates(payload.fromSocketId, pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          activeSocket?.emit('voice:answer', {
            roomId,
            targetSocketId: payload.fromSocketId,
            answer: pc.localDescription,
          });
        } catch (error) {
          console.error('Failed to handle voice offer:', error);
        }
      };

      const handleAnswer = async (payload: VoiceAnswerPayload) => {
        if (payload.roomId !== roomId) return;

        try {
          const pc = ensurePeerConnection(payload.fromSocketId);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await flushPendingCandidates(payload.fromSocketId, pc);
        } catch (error) {
          console.error('Failed to handle voice answer:', error);
        }
      };

      const handleIceCandidate = async (payload: VoiceIcePayload) => {
        if (payload.roomId !== roomId) return;

        try {
          const pc = ensurePeerConnection(payload.fromSocketId);

          if (!pc.remoteDescription) {
            const candidates = pendingCandidatesRef.current.get(payload.fromSocketId) || [];
            candidates.push(payload.candidate);
            pendingCandidatesRef.current.set(payload.fromSocketId, candidates);
            return;
          }

          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (error) {
          console.error('Failed to handle voice ICE candidate:', error);
        }
      };

      activeSocket.on('connect', joinVoiceRoom);
      activeSocket.on('voice:user-joined', handleUserJoined);
      activeSocket.on('voice:user-left', handleUserLeft);
      activeSocket.on('voice:offer', handleOffer);
      activeSocket.on('voice:answer', handleAnswer);
      activeSocket.on('voice:ice-candidate', handleIceCandidate);

      if (activeSocket.connected) {
        joinVoiceRoom();
      }

      cleanupSocket = () => {
        activeSocket?.off('connect', joinVoiceRoom);
        activeSocket?.off('voice:user-joined', handleUserJoined);
        activeSocket?.off('voice:user-left', handleUserLeft);
        activeSocket?.off('voice:offer', handleOffer);
        activeSocket?.off('voice:answer', handleAnswer);
        activeSocket?.off('voice:ice-candidate', handleIceCandidate);

        if (joinedVoiceRef.current) {
          activeSocket?.emit('voice:leave', { roomId });
          joinedVoiceRef.current = false;
        }
      };
    };

    setupVoiceSocket();

    return () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }

      cleanupSocket();
      closeAllPeerConnections();
      stopLocalStream();
      setMicActive(false);
      setIsSpeaking(false);
    };
  }, [
    closeAllPeerConnections,
    closePeerConnection,
    ensurePeerConnection,
    flushPendingCandidates,
    roomId,
    sendOffer,
    setIsSpeaking,
    setMicActive,
    stopLocalStream,
  ]);

  return (
    <div className="d-flex align-items-center gap-2">
      {micActive ? (
        <>
          <div
            className="rounded-pill d-flex align-items-center gap-2 px-3 py-2"
            style={{ background: 'rgba(0,200,100,0.15)', border: '1px solid rgba(0,200,100,0.4)' }}
          >
            <i className="bi bi-mic-fill text-success" />
            <div className="d-flex align-items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-1"
                  style={{
                    width: 3,
                    height: Math.max(4, audioLevel * 40 - i * 4),
                    backgroundColor: audioLevel > 0.1 ? '#00c864' : '#444',
                    transition: 'height 0.05s',
                  }}
                />
              ))}
            </div>
            <Badge bg="success" pill style={{ fontSize: '0.6rem' }}>LIVE</Badge>
          </div>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={stopMic}
            disabled={disabled}
            title="Stop microphone"
          >
            <i className="bi bi-mic-mute-fill" />
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline-success"
          onClick={startMic}
          disabled={disabled}
          title={disabled ? 'Voice receive is active' : 'Start microphone'}
        >
          <i className="bi bi-mic-fill me-1" />
          Mic
        </Button>
      )}
    </div>
  );
}
