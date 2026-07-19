import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from './useSocket';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
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

interface RemotePeer {
  socketId: string;
  userId: string;
  stream: MediaStream | null;
}

interface UseDebateVideoOptions {
  roomId: string;
  enabled: boolean;
}

const MAIN_VIDEO_CHANNEL = 'video';

function resolveEntityId(value: unknown) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const entity = value as { _id?: unknown; id?: unknown };
  if (typeof entity._id === 'string') return entity._id;
  if (typeof entity.id === 'string') return entity.id;
  return '';
}

function getCameraErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return 'Camera needs HTTPS or a trusted local origin';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot access camera on this page';
  }
  const errorName = error instanceof DOMException ? error.name : '';
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return 'Camera permission was blocked';
  }
  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return 'No camera device was found';
  }
  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return 'Camera is being used by another app';
  }
  return 'Could not access camera';
}

export function useDebateVideo({ roomId, enabled }: UseDebateVideoOptions) {
  const { user } = useAuthStore();
  const userId = user?._id;
  const setCameraActive = useDebateStore((s) => s.setCameraActive);
  const setCameraLockedByHost = useDebateStore((s) => s.setCameraLockedByHost);
  const participants = useDebateStore((s) => s.participants);
  const me = participants.find((participant) => resolveEntityId(participant.userId) === userId);
  const isCameraMutedByHost = Boolean(me?.cameraMuted);

  const [cameraActive, setLocalCameraActive] = useState(false);
  const [peers, setPeers] = useState<RemotePeer[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const rtcConfigurationRef = useRef<RTCConfiguration>(WEBRTC_CONFIGURATION);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const negotiationStatesRef = useRef<Map<string, PeerNegotiationState>>(new Map());
  const joinedRef = useRef(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localCameraActiveRef = useRef(false);

  const stopLocalCameraTrack = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((track) => {
      track.stop();
    });
  }, []);

  const detachLocalVideoTrack = useCallback((pc: RTCPeerConnection) => {
    findSenderForKind(pc, 'video')?.replaceTrack(null).catch(() => undefined);
  }, []);

  const attachLocalVideoTrack = useCallback(async (pc: RTCPeerConnection) => {
    if (!streamRef.current) return;
    const [track] = streamRef.current.getVideoTracks();
    if (!track) return;
    await attachLocalTrack(pc, track, streamRef.current);
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
          team: MAIN_VIDEO_CHANNEL,
          targetSocketId: peerSocketId,
          candidate: event.candidate.toJSON(),
        });
      };
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          const videoTrack = remoteStream.getVideoTracks()[0];
          if (videoTrack) {
            const handleRemoteTrackEnded = () => {
              setPeers((prev) => {
                const idx = prev.findIndex((p) => p.socketId === peerSocketId);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], stream: null };
                return next;
              });
            };
            if (videoTrack.readyState === 'ended') {
              handleRemoteTrackEnded();
            } else {
              videoTrack.addEventListener('ended', handleRemoteTrackEnded, { once: true });
            }
          }
          setPeers((prev) => {
            const idx = prev.findIndex((p) => p.socketId === peerSocketId);
            if (idx === -1) {
              return [...prev, { socketId: peerSocketId, userId: '', stream: remoteStream }];
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
          setPeers((prev) => prev.filter((p) => p.socketId !== peerSocketId));
        }
      };
      peerConnectionsRef.current.set(peerSocketId, pc);
      return pc;
    },
    [roomId],
  );

  const sendOffer = useCallback(
    async (peerSocketId: string) => {
      const socket = getSocket();
      if (!socket) return;
      const pc = ensurePeerConnection(peerSocketId);
      if (pc.signalingState !== 'stable') return;
      await attachLocalVideoTrack(pc);
      const negotiationState = getPeerNegotiationState(
        negotiationStatesRef.current,
        peerSocketId,
      );
      const offer = await createLocalOffer(pc, negotiationState);
      if (!offer) return;
      socket.emit('voice:offer', {
        roomId,
        team: MAIN_VIDEO_CHANNEL,
        targetSocketId: peerSocketId,
        offer,
      });
    },
    [attachLocalVideoTrack, ensurePeerConnection, roomId],
  );

  const closePeer = useCallback((peerSocketId: string) => {
    const pc = peerConnectionsRef.current.get(peerSocketId);
    pc?.close();
    peerConnectionsRef.current.delete(peerSocketId);
    negotiationStatesRef.current.delete(peerSocketId);
    pendingCandidatesRef.current.delete(peerSocketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== peerSocketId));
  }, []);

  const stopCamera = useCallback(() => {
    if (!streamRef.current && !localCameraActiveRef.current) {
      return;
    }
    peerConnectionsRef.current.forEach(detachLocalVideoTrack);
    stopLocalCameraTrack();
    streamRef.current = null;
    localCameraActiveRef.current = false;
    setLocalCameraActive(false);
    if (userId) setCameraActive(userId, false);
    getSocket()?.emit('video:state', { roomId, team: MAIN_VIDEO_CHANNEL, active: false });
  }, [detachLocalVideoTrack, roomId, setCameraActive, stopLocalCameraTrack, userId]);

  const startCamera = useCallback(async () => {
    if (!userId) return;
    if (isCameraMutedByHost) {
      toast.error('Your camera is disabled by the host');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      await Promise.all(Array.from(peerConnectionsRef.current.keys()).map(sendOffer));
      localCameraActiveRef.current = true;
      setLocalCameraActive(true);
      setCameraActive(userId, true);
      getSocket()?.emit('video:state', { roomId, team: MAIN_VIDEO_CHANNEL, active: true });
    } catch (error) {
      toast.error(getCameraErrorMessage(error));
    }
  }, [isCameraMutedByHost, roomId, sendOffer, setCameraActive, userId]);

  const hostToggleCamera = useCallback(
    (targetUserId: string, active: boolean) => {
      const socket = getSocket();
      if (!socket) return;
      socket.emit(
        'video:host-toggle',
        { roomId, targetUserId, active },
        (response: { success: boolean; message?: string }) => {
          if (!response.success) {
            toast.error(response.message || 'Failed to control camera');
          }
        },
      );
    },
    [roomId],
  );

  useEffect(() => {
    if (!enabled || !roomId) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    let cancelled = false;

    const joinVideo = () => {
      socket.emit(
        'voice:join',
        { roomId, team: MAIN_VIDEO_CHANNEL },
        (response?: {
          peers: Array<{ socketId: string; userId: string }>;
          cameraState?: { activeUsers: string[] };
        }) => {
          joinedRef.current = true;
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
          if (response?.cameraState) {
            response.cameraState.activeUsers.forEach((uid) => setCameraActive(uid, true));
          }
        },
      );
    };

    const handleUserJoined = (payload: { socketId: string; userId: string; team?: string }) => {
      if (payload.team !== MAIN_VIDEO_CHANNEL) return;
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
      if (payload.team !== MAIN_VIDEO_CHANNEL) return;
      closePeer(payload.socketId);
    };

    const handleVideoState = (payload: { userId: string; active: boolean; team?: string }) => {
      if (payload.team !== MAIN_VIDEO_CHANNEL) return;
      setCameraActive(payload.userId, payload.active);
    };

    const handleHostToggle = (payload: { userId: string; active: boolean; byUserId: string }) => {
      if (!payload.active) {
        setCameraActive(payload.userId, false);
      }
      if (userId && payload.userId === userId) {
        if (payload.active) {
          setCameraLockedByHost(false);
          toast.success('The host enabled your camera');
        } else {
          setCameraLockedByHost(true);
          peerConnectionsRef.current.forEach(detachLocalVideoTrack);
          stopLocalCameraTrack();
          streamRef.current = null;
          localCameraActiveRef.current = false;
          setLocalCameraActive(false);
          toast.error('The host turned off your camera');
        }
      }
    };

    const flushPending = async (peerSocketId: string, pc: RTCPeerConnection) => {
      const list = pendingCandidatesRef.current.get(peerSocketId) || [];
      pendingCandidatesRef.current.delete(peerSocketId);
      for (const candidate of list) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleOffer = async (payload: {
      roomId: string;
      fromSocketId: string;
      team?: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== MAIN_VIDEO_CHANNEL) return;
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
          isPolitePeer(socket.id, payload.fromSocketId),
        );
        if (!accepted) return;
        await attachLocalVideoTrack(pc);
        await flushPending(payload.fromSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', {
          roomId,
          team: MAIN_VIDEO_CHANNEL,
          targetSocketId: payload.fromSocketId,
          answer: pc.localDescription,
        });
      } catch (err) {
        console.error('Main room video offer error:', err);
      }
    };

    const handleAnswer = async (payload: {
      roomId: string;
      fromSocketId: string;
      team?: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== MAIN_VIDEO_CHANNEL) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        const negotiationState = getPeerNegotiationState(
          negotiationStatesRef.current,
          payload.fromSocketId,
        );
        const accepted = await acceptRemoteAnswer(pc, negotiationState, payload.answer);
        if (!accepted) return;
        await flushPending(payload.fromSocketId, pc);
      } catch (err) {
        console.error('Main room video answer error:', err);
      }
    };

    const handleIce = async (payload: {
      roomId: string;
      fromSocketId: string;
      team?: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== MAIN_VIDEO_CHANNEL) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        const negotiationState = getPeerNegotiationState(
          negotiationStatesRef.current,
          payload.fromSocketId,
        );
        if (negotiationState.ignoreOffer) return;
        if (!pc.remoteDescription) {
          const list = pendingCandidatesRef.current.get(payload.fromSocketId) || [];
          list.push(payload.candidate);
          pendingCandidatesRef.current.set(payload.fromSocketId, list);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error('Main room video ICE error:', err);
      }
    };

    void loadWebRtcConfiguration().then((configuration) => {
      if (cancelled) return;
      rtcConfigurationRef.current = configuration;
      socket.on('connect', joinVideo);
      socket.on('voice:user-joined', handleUserJoined);
      socket.on('voice:user-left', handleUserLeft);
      socket.on('voice:offer', handleOffer);
      socket.on('voice:answer', handleAnswer);
      socket.on('voice:ice-candidate', handleIce);
      socket.on('video:state', handleVideoState);
      socket.on('video:host-toggle', handleHostToggle);

      if (socket.connected) {
        joinVideo();
      }
    });

    return () => {
      cancelled = true;
      socket.off('connect', joinVideo);
      socket.off('voice:user-joined', handleUserJoined);
      socket.off('voice:user-left', handleUserLeft);
      socket.off('voice:offer', handleOffer);
      socket.off('voice:answer', handleAnswer);
      socket.off('voice:ice-candidate', handleIce);
      socket.off('video:state', handleVideoState);
      socket.off('video:host-toggle', handleHostToggle);

      if (joinedRef.current) {
        socket.emit('voice:leave', { roomId, team: MAIN_VIDEO_CHANNEL });
        joinedRef.current = false;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      negotiationStatesRef.current.clear();
      setPeers([]);
    };
  }, [
    closePeer,
    attachLocalVideoTrack,
    detachLocalVideoTrack,
    enabled,
    ensurePeerConnection,
    roomId,
    sendOffer,
    setCameraActive,
    setCameraLockedByHost,
    stopCamera,
    stopLocalCameraTrack,
    userId,
  ]);

  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach(detachLocalVideoTrack);
      stopLocalCameraTrack();
      streamRef.current = null;
      localCameraActiveRef.current = false;
      if (userId) {
        setCameraActive(userId, false);
      }
      getSocket()?.emit('video:state', { roomId, team: MAIN_VIDEO_CHANNEL, active: false });
    };
  }, [detachLocalVideoTrack, roomId, setCameraActive, stopLocalCameraTrack, userId]);

  return { cameraActive, peers, startCamera, stopCamera, hostToggleCamera, localStream: streamRef.current };
}
