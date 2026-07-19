import { ENV } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

type CloudflareIceServerResponse = {
  iceServers?: IceServer[];
};

function getCredentialTtl() {
  if (!Number.isFinite(ENV.CLOUDFLARE_TURN_TTL_SECONDS)) return 7200;
  return Math.min(Math.max(ENV.CLOUDFLARE_TURN_TTL_SECONDS, 300), 172800);
}

export async function generateIceServers(): Promise<IceServer[]> {
  if (!ENV.CLOUDFLARE_TURN_KEY_ID || !ENV.CLOUDFLARE_TURN_KEY_API_TOKEN) {
    throw new AppError('TURN service is not configured', 503);
  }

  const keyId = encodeURIComponent(ENV.CLOUDFLARE_TURN_KEY_ID);
  let response: Response;
  try {
    response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.CLOUDFLARE_TURN_KEY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: getCredentialTtl() }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new AppError('Could not reach the TURN credential service', 502);
  }

  let payload: CloudflareIceServerResponse = {};
  try {
    payload = (await response.json()) as CloudflareIceServerResponse;
  } catch {
    // Preserve the upstream status below without exposing its response body.
  }

  if (!response.ok || !payload.iceServers?.length) {
    throw new AppError('Could not generate TURN credentials', 502);
  }

  return payload.iceServers;
}
