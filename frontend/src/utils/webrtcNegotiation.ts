export interface PeerNegotiationState {
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
}

export function createPeerNegotiationState(): PeerNegotiationState {
  return {
    makingOffer: false,
    ignoreOffer: false,
    settingRemoteAnswer: false,
  };
}

export function getPeerNegotiationState(
  states: Map<string, PeerNegotiationState>,
  peerSocketId: string,
) {
  const existing = states.get(peerSocketId);
  if (existing) return existing;

  const state = createPeerNegotiationState();
  states.set(peerSocketId, state);
  return state;
}

export async function createLocalOffer(
  peerConnection: RTCPeerConnection,
  state: PeerNegotiationState,
  options?: RTCOfferOptions,
) {
  if (state.makingOffer || peerConnection.signalingState !== 'stable') {
    return null;
  }

  state.makingOffer = true;
  try {
    const offer = await peerConnection.createOffer(options);
    await peerConnection.setLocalDescription(offer);
    return peerConnection.localDescription;
  } finally {
    state.makingOffer = false;
  }
}

export async function acceptRemoteOffer(
  peerConnection: RTCPeerConnection,
  state: PeerNegotiationState,
  offer: RTCSessionDescriptionInit,
  polite: boolean,
) {
  const readyForOffer = !state.makingOffer
    && (peerConnection.signalingState === 'stable' || state.settingRemoteAnswer);
  const offerCollision = !readyForOffer;

  state.ignoreOffer = !polite && offerCollision;
  if (state.ignoreOffer) return false;

  if (offerCollision && peerConnection.signalingState !== 'stable') {
    await peerConnection.setLocalDescription({ type: 'rollback' });
  }

  await peerConnection.setRemoteDescription(offer);
  state.ignoreOffer = false;
  return true;
}

export async function acceptRemoteAnswer(
  peerConnection: RTCPeerConnection,
  state: PeerNegotiationState,
  answer: RTCSessionDescriptionInit,
) {
  if (peerConnection.signalingState !== 'have-local-offer') {
    return false;
  }

  state.settingRemoteAnswer = true;
  try {
    await peerConnection.setRemoteDescription(answer);
    state.ignoreOffer = false;
    return true;
  } finally {
    state.settingRemoteAnswer = false;
  }
}

export function isPolitePeer(localSocketId: string | undefined, remoteSocketId: string) {
  return Boolean(localSocketId && localSocketId.localeCompare(remoteSocketId) > 0);
}

export function findSenderForKind(
  peerConnection: RTCPeerConnection,
  kind: 'audio' | 'video',
) {
  return findTransceiverForKind(peerConnection, kind)?.sender;
}

export function findTransceiverForKind(
  peerConnection: RTCPeerConnection,
  kind: 'audio' | 'video',
) {
  return peerConnection.getTransceivers().find((transceiver) => (
    transceiver.direction !== 'stopped'
    && (
      transceiver.sender.track?.kind === kind || transceiver.receiver.track.kind === kind
    )
  ));
}

/**
 * replaceTrack() does not promote a remotely-created recvonly transceiver to
 * sendrecv. Do that explicitly so a peer that enables media later can send it
 * back over the already-negotiated m-line.
 */
export async function attachLocalTrack(
  peerConnection: RTCPeerConnection,
  track: MediaStreamTrack,
  stream: MediaStream,
) {
  const kind = track.kind as 'audio' | 'video';
  const transceiver = findTransceiverForKind(peerConnection, kind);

  if (!transceiver) {
    peerConnection.addTrack(track, stream);
    return;
  }

  await transceiver.sender.replaceTrack(track);
  transceiver.sender.setStreams(stream);

  if (transceiver.direction === 'recvonly') {
    transceiver.direction = 'sendrecv';
  } else if (transceiver.direction === 'inactive') {
    transceiver.direction = 'sendonly';
  }
}
