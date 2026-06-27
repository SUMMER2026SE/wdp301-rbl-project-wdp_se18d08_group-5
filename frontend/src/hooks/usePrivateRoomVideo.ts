import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from './useSocket';
import type { PrivateRoomTeam } from './usePrivateRoomSocket';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';

interface RemotePeer {
  socketId: string;
  userId: string;
  stream: MediaStream | null;
}

interface UsePrivateRoomVideoOptions {
  roomId: string;
  team: PrivateRoomTeam;
  enabled: boolean;
}

const peerConnectionConfig: RTCConfiguration = {
  iceServers: [],
};

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

export function usePrivateRoomVideo({ roomId, team, enabled }: UsePrivateRoomVideoOptions) {
  const userId = useAuthStore((s) => s.user?._id);
  const setGlobalCameraActive = useDebateStore((s) => s.setCameraActive);
  const [cameraActive, setLocalCameraActive] = useState(false);
  const [peers, setPeers] = useState<RemotePeer[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const joinedRef = useRef(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const attachLocalVideoTrack = useCallback((pc: RTCPeerConnection) => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((track) => {
      const existing = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (existing) {
        existing.replaceTrack(track).catch(() => undefined);
      } else {
        pc.addTrack(track, streamRef.current!);
      }
    });
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
          team,
          targetSocketId: peerSocketId,
          candidate: event.candidate.toJSON(),
        });
      };
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
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
      attachLocalVideoTrack(pc);
      peerConnectionsRef.current.set(peerSocketId, pc);
      return pc;
    },
    [attachLocalVideoTrack, roomId, team],
  );

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
        team,
        targetSocketId: peerSocketId,
        offer: pc.localDescription,
      });
    },
    [ensurePeerConnection, roomId, team],
  );

  const closePeer = useCallback((peerSocketId: string) => {
    const pc = peerConnectionsRef.current.get(peerSocketId);
    pc?.close();
    peerConnectionsRef.current.delete(peerSocketId);
    pendingCandidatesRef.current.delete(peerSocketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== peerSocketId));
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => t.stop());
    }
    setLocalCameraActive(false);
    if (userId) setGlobalCameraActive(userId, false);
    getSocket()?.emit('video:state', { roomId, team, active: false });
  }, [roomId, team, setGlobalCameraActive, userId]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      peerConnectionsRef.current.forEach(attachLocalVideoTrack);
      await Promise.all(Array.from(peerConnectionsRef.current.keys()).map(sendOffer));
      setLocalCameraActive(true);
      if (userId) setGlobalCameraActive(userId, true);
      getSocket()?.emit('video:state', { roomId, team, active: true });
    } catch (error) {
      toast.error(getCameraErrorMessage(error));
    }
  }, [attachLocalVideoTrack, roomId, sendOffer, team, setGlobalCameraActive, userId]);

  useEffect(() => {
    if (!enabled || !roomId || !team) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const joinVideo = () => {
      socket.emit(
        'voice:join',
        { roomId, team },
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
            response.cameraState.activeUsers.forEach((uid) => setGlobalCameraActive(uid, true));
          }
        },
      );
    };

    const handleUserJoined = (payload: { socketId: string; userId: string }) => {
      ensurePeerConnection(payload.socketId);
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === payload.socketId)) return prev;
        return [...prev, { socketId: payload.socketId, userId: payload.userId, stream: null }];
      });
      if (streamRef.current) {
        sendOffer(payload.socketId).catch(() => undefined);
      }
    };

    const handleUserLeft = (payload: { socketId: string }) => {
      closePeer(payload.socketId);
    };

    const handleVideoState = (payload: { userId: string; active: boolean }) => {
      setGlobalCameraActive(payload.userId, payload.active);
    };

    const handleHostToggle = (payload: { userId: string; active: boolean; byUserId: string }) => {
      setGlobalCameraActive(payload.userId, payload.active);
      if (userId && payload.userId === userId) {
        if (payload.active) {
          toast.success('The host enabled your camera');
          startCamera().catch(() => undefined);
        } else {
          if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach((t) => t.stop());
          }
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
      team: PrivateRoomTeam;
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== team) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        await flushPending(payload.fromSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', {
          roomId,
          team,
          targetSocketId: payload.fromSocketId,
          answer: pc.localDescription,
        });
      } catch (err) {
        console.error('Private room video offer error:', err);
      }
    };

    const handleAnswer = async (payload: {
      roomId: string;
      team: PrivateRoomTeam;
      fromSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== team) return;
      try {
        const pc = ensurePeerConnection(payload.fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushPending(payload.fromSocketId, pc);
      } catch (err) {
        console.error('Private room video answer error:', err);
      }
    };

    const handleIce = async (payload: {
      roomId: string;
      team: PrivateRoomTeam;
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (payload.roomId !== roomId || payload.team !== team) return;
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
        console.error('Private room video ICE error:', err);
      }
    };

    socket.on('connect', joinVideo);
    socket.on('voice:user-joined', handleUserJoined);
    socket.on('voice:user-left', handleUserLeft);
    socket.on('video:state', handleVideoState);
    socket.on('video:host-toggle', handleHostToggle);
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice-candidate', handleIce);

    if (socket.connected) {
      joinVideo();
    }

    return () => {
      socket.off('connect', joinVideo);
      socket.off('voice:user-joined', handleUserJoined);
      socket.off('voice:user-left', handleUserLeft);
      socket.off('video:state', handleVideoState);
      socket.off('video:host-toggle', handleHostToggle);
      socket.off('voice:offer', handleOffer);
      socket.off('voice:answer', handleAnswer);
      socket.off('voice:ice-candidate', handleIce);
      if (joinedRef.current) {
        socket.emit('voice:leave', { roomId, team });
        joinedRef.current = false;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setPeers([]);
    };
  }, [
    closePeer,
    enabled,
    ensurePeerConnection,
    roomId,
    sendOffer,
    team,
    setGlobalCameraActive,
    userId,
    startCamera,
  ]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (userId) setGlobalCameraActive(userId, false);
      getSocket()?.emit('video:state', { roomId, team, active: false });
    };
  }, [roomId, team, setGlobalCameraActive, userId]);

  return { cameraActive, peers, startCamera, stopCamera, localStream: streamRef.current };
}
