import api from '@/services/api';
import type { ApiResponse } from '@/types';

const DEFAULT_STUN_URLS = ['stun:stun.cloudflare.com:3478'];

function parseUrls(value: string | undefined, fallback: string[]) {
  const urls = value
    ?.split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return urls?.length ? urls : fallback;
}

export const WEBRTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    {
      urls: parseUrls(import.meta.env.VITE_STUN_URLS, DEFAULT_STUN_URLS),
    },
  ],
  iceCandidatePoolSize: 10,
};

type IceServerResponse = {
  iceServers: RTCIceServer[];
};

let configurationPromise: Promise<RTCConfiguration> | null = null;

/**
 * Fetch short-lived TURN credentials from our authenticated backend. If TURN
 * is temporarily unavailable, keep the room usable on networks where direct
 * P2P/STUN connectivity is possible.
 */
export function loadWebRtcConfiguration(): Promise<RTCConfiguration> {
  if (!configurationPromise) {
    configurationPromise = api
      .get<ApiResponse<IceServerResponse>>('/webrtc/ice-servers')
      .then(({ data }) => ({
        iceServers: data.data.iceServers,
        iceCandidatePoolSize: 10,
      }))
      .catch((error) => {
        console.warn('TURN credentials unavailable; using STUN fallback', error);
        configurationPromise = null;
        return WEBRTC_CONFIGURATION;
      });
  }

  return configurationPromise;
}
