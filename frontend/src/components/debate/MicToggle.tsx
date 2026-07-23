import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button as RBButton } from 'react-bootstrap';
const Button = RBButton as any;
import toast from 'react-hot-toast';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';
import { loadWebRtcConfiguration, WEBRTC_CONFIGURATION } from '@/config/webrtc';
import {
  acceptRemoteAnswer,
  acceptRemoteOffer,
  attachLocalTrack,
  createLocalOffer,
  findSenderForKind,
  getPeerNegotiationState,
  isPolitePeer,
  type PeerNegotiationState,
} from '@/utils/webrtcNegotiation';

interface MicToggleProps {
  roomId: string;
  disabled?: boolean;
}

type TranslationStatus = 'idle' | 'connecting' | 'ready' | 'capturing' | 'receiving_audio' | 'captioning' | 'error';

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

function encodePcm16ToBase64(input: Float32Array, inputSampleRate: number) {
  const targetSampleRate = 16_000;
  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceStart = Math.min(Math.floor(index * ratio), input.length - 1);
    const sourceEnd = Math.min(
      Math.max(sourceStart + 1, Math.floor((index + 1) * ratio)),
      input.length,
    );
    let sum = 0;
    for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
      sum += input[sourceIndex] || 0;
    }
    // Averaging the source window acts as a small anti-aliasing filter. The
    // previous nearest-sample conversion discarded most 48 kHz microphone
    // data and noticeably reduced recognition accuracy after downsampling.
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, sourceEnd - sourceStart)));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const bytes = new Uint8Array(output.buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return window.btoa(binary);
}

export function MicToggle({ roomId, disabled = false }: MicToggleProps) {
  const { micActive, setMicActive, setIsSpeaking } = useDebateStore();
  const { user } = useAuthStore();
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const translationAudioContextRef = useRef<AudioContext | null>(null);
  const translationProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const translationSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const translationMuteGainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rtcConfigurationRef = useRef<RTCConfiguration>(WEBRTC_CONFIGURATION);
  const animationRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const negotiationStatesRef = useRef<Map<string, PeerNegotiationState>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const joinedVoiceRef = useRef(false);
  const playbackWarningShownRef = useRef(false);
  const hasCapturedTranslationAudioRef = useRef(false);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>('idle');

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

  const addLocalTracks = useCallback(async (pc: RTCPeerConnection, stream: MediaStream) => {
    const [track] = stream.getAudioTracks();
    if (!track) return;
    await attachLocalTrack(pc, track, stream);
  }, []);

  const removeLocalTracks = useCallback((pc: RTCPeerConnection) => {
    findSenderForKind(pc, 'audio')?.replaceTrack(null).catch(() => undefined);
  }, []);

  const ensurePeerConnection = useCallback(
    (peerSocketId: string) => {
      const existing = peerConnectionsRef.current.get(peerSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(rtcConfigurationRef.current);
      getPeerNegotiationState(negotiationStatesRef.current, peerSocketId);

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

      peerConnectionsRef.current.set(peerSocketId, pc);
      return pc;
    },
    [attachRemoteStream, removeRemoteAudio, roomId],
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
      if (streamRef.current) {
        await addLocalTracks(pc, streamRef.current);
      }

      const negotiationState = getPeerNegotiationState(
        negotiationStatesRef.current,
        peerSocketId,
      );
      const offer = await createLocalOffer(pc, negotiationState);
      if (!offer) return;

      socket.emit('voice:offer', {
        roomId,
        targetSocketId: peerSocketId,
        offer,
      });
    },
    [addLocalTracks, ensurePeerConnection, roomId],
  );

  const closePeerConnection = useCallback(
    (peerSocketId: string) => {
      const pc = peerConnectionsRef.current.get(peerSocketId);
      pc?.close();
      peerConnectionsRef.current.delete(peerSocketId);
      negotiationStatesRef.current.delete(peerSocketId);
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

  const stopTranslationAudio = useCallback(() => {
    translationProcessorRef.current?.disconnect();
    translationProcessorRef.current = null;
    translationSourceRef.current?.disconnect();
    translationSourceRef.current = null;
    translationMuteGainRef.current?.disconnect();
    translationMuteGainRef.current = null;

    if (translationAudioContextRef.current) {
      translationAudioContextRef.current.close().catch(() => undefined);
      translationAudioContextRef.current = null;
    }

    getSocket()?.emit('translation:stop', { roomId });
    setTranslationStatus('idle');
  }, [roomId]);

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

  const startTranslationAudio = useCallback((stream: MediaStream) => {
    const socket = getSocket();
    const AudioContextCtor = getAudioContextCtor();
    if (!socket || !AudioContextCtor) {
      toast.error('Live captions are unavailable in this browser');
      return;
    }

    socket.emit('translation:start', { roomId }, (result?: { success?: boolean; message?: string }) => {
      if (result?.success) return;
      toast.error(result?.message || 'Live translation is unavailable. Voice chat is still active.');
      setTranslationStatus('error');
    });
    setTranslationStatus('connecting');
    hasCapturedTranslationAudioRef.current = false;

    const ctx = new AudioContextCtor();
    // getUserMedia may resolve after the original click event, leaving a new
    // AudioContext suspended in some browsers unless it is resumed explicitly.
    void ctx.resume().catch(() => {
      toast.error('Live captions need a browser interaction to start');
    });
    const source = ctx.createMediaStreamSource(stream);
    // 4096 frames is approximately 85 ms at the common 48 kHz microphone
    // rate, close to Gemini Live's recommended 100 ms audio chunks.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const muteGain = ctx.createGain();
    muteGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcmBase64 = encodePcm16ToBase64(input, ctx.sampleRate);
      socket.emit('translation:audio', { roomId, data: pcmBase64 });
      if (!hasCapturedTranslationAudioRef.current) {
        hasCapturedTranslationAudioRef.current = true;
        setTranslationStatus('capturing');
      }
    };

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(ctx.destination);
    translationAudioContextRef.current = ctx;
    translationSourceRef.current = source;
    translationProcessorRef.current = processor;
    translationMuteGainRef.current = muteGain;
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTranslationStatus = (payload: { roomId?: string; state?: TranslationStatus; message?: string }) => {
      if (payload.roomId !== roomId || !payload.state) return;
      setTranslationStatus(payload.state);
      if (payload.state !== 'error') return;
      toast.error(payload.message || 'Live translation stopped. Voice chat is still active.');
      stopTranslationAudio();
      setTranslationStatus('error');
    };

    socket.on('translation:status', handleTranslationStatus);
    return () => {
      socket.off('translation:status', handleTranslationStatus);
    };
  }, [roomId, stopTranslationAudio]);

  const translationStatusLabel: Record<TranslationStatus, string> = {
    idle: '',
    connecting: 'CONNECTING',
    ready: 'GEMINI READY',
    capturing: 'CAPTURING AUDIO',
    receiving_audio: 'AUDIO RECEIVED',
    captioning: 'CAPTIONS LIVE',
    error: 'CAPTION ERROR',
  };

  const translationStatusVariant: Record<TranslationStatus, string> = {
    idle: 'secondary',
    connecting: 'warning',
    ready: 'info',
    capturing: 'primary',
    receiving_audio: 'success',
    captioning: 'success',
    error: 'danger',
  };

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
          channelCount: 1,
          sampleRate: 16_000,
        },
        video: false,
      });

      streamRef.current = stream;
      startAudioMeter(stream);
      startTranslationAudio(stream);

      await Promise.all(Array.from(peerConnectionsRef.current.keys()).map(sendOffer));

      setMicActive(true);
      setIsSpeaking(true);
    } catch (error) {
      console.error('Microphone access error:', error);
      toast.error(getMicrophoneErrorMessage(error));
      stopTranslationAudio();
      stopLocalStream();
    }
  }, [
    disabled,
    micActive,
    sendOffer,
    setIsSpeaking,
    setMicActive,
    startAudioMeter,
    startTranslationAudio,
    stopTranslationAudio,
    stopLocalStream,
  ]);

  const stopMic = useCallback(() => {
    stopTranslationAudio();
    stopLocalStream();
    peerConnectionsRef.current.forEach(removeLocalTracks);

    setMicActive(false);
    setIsSpeaking(false);

    getSocket()?.emit('mic:stopped', { roomId, userId: user?._id });
  }, [
    removeLocalTracks,
    roomId,
    setIsSpeaking,
    setMicActive,
    stopTranslationAudio,
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
    let cancelled = false;

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

      const handleUserJoined = (payload: VoiceUserPayload & { team?: string }) => {
        if (payload.team) return;
        ensurePeerConnection(payload.socketId);
        if (streamRef.current) {
          sendOffer(payload.socketId).catch(() => undefined);
        }
      };

      const handleUserLeft = (payload: VoiceUserPayload & { team?: string }) => {
        if (payload.team) return;
        closePeerConnection(payload.socketId);
      };

      const handleOffer = async (payload: VoiceOfferPayload & { team?: string }) => {
        if (payload.roomId !== roomId || payload.team) return;

        try {
          const pc = ensurePeerConnection(payload.fromSocketId);
          const negotiationState = getPeerNegotiationState(
            negotiationStatesRef.current,
            payload.fromSocketId,
          );
          const accepted = await acceptRemoteOffer(
            pc,
            negotiationState,
            payload.offer,
            isPolitePeer(activeSocket?.id, payload.fromSocketId),
          );
          if (!accepted) return;
          if (streamRef.current) {
            await addLocalTracks(pc, streamRef.current);
          }
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

      const handleAnswer = async (payload: VoiceAnswerPayload & { team?: string }) => {
        if (payload.roomId !== roomId || payload.team) return;

        try {
          const pc = ensurePeerConnection(payload.fromSocketId);
          const negotiationState = getPeerNegotiationState(
            negotiationStatesRef.current,
            payload.fromSocketId,
          );
          const accepted = await acceptRemoteAnswer(pc, negotiationState, payload.answer);
          if (!accepted) return;
          await flushPendingCandidates(payload.fromSocketId, pc);
        } catch (error) {
          console.error('Failed to handle voice answer:', error);
        }
      };

      const handleIceCandidate = async (payload: VoiceIcePayload & { team?: string }) => {
        if (payload.roomId !== roomId || payload.team) return;

        try {
          const pc = ensurePeerConnection(payload.fromSocketId);
          const negotiationState = getPeerNegotiationState(
            negotiationStatesRef.current,
            payload.fromSocketId,
          );
          if (negotiationState.ignoreOffer) return;

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

    void loadWebRtcConfiguration().then((configuration) => {
      if (cancelled) return;
      rtcConfigurationRef.current = configuration;
      setupVoiceSocket();
    });

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }

      cleanupSocket();
      closeAllPeerConnections();
      negotiationStatesRef.current.clear();
      stopTranslationAudio();
      stopLocalStream();
      setMicActive(false);
      setIsSpeaking(false);
    };
  }, [
    closeAllPeerConnections,
    closePeerConnection,
    addLocalTracks,
    ensurePeerConnection,
    flushPendingCandidates,
    roomId,
    sendOffer,
    setIsSpeaking,
    setMicActive,
    stopTranslationAudio,
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
            {translationStatus !== 'idle' && (
              <Badge bg={translationStatusVariant[translationStatus]} pill style={{ fontSize: '0.6rem' }}>
                {translationStatusLabel[translationStatus]}
              </Badge>
            )}
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
