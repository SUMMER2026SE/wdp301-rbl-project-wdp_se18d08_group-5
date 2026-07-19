# WebRTC Deployment Configuration

The debate audio and video channels use peer-to-peer WebRTC. Socket.IO relays
signaling messages, while Cloudflare Realtime TURN relays encrypted media only
when a direct peer-to-peer path cannot be established.

## Cloudflare TURN credentials

Create a TURN Server app in Cloudflare Realtime. Store its ID and API token on
the backend only:

```env
CLOUDFLARE_TURN_KEY_ID=your-turn-key-id
CLOUDFLARE_TURN_KEY_API_TOKEN=your-turn-key-api-token
CLOUDFLARE_TURN_TTL_SECONDS=7200
```

The authenticated `GET /api/v1/webrtc/ice-servers` endpoint exchanges these
secrets for short-lived ICE server credentials. The frontend fetches that
configuration before joining a media signaling channel. Never put the TURN key
or its API token in a `VITE_*` variable because Vite embeds those values in the
browser bundle.

The frontend may optionally configure its STUN-only fallback at build time:

```env
VITE_STUN_URLS=stun:stun.cloudflare.com:3478
```

Redeploy the backend after setting its secrets. Redeploy the frontend whenever
its source or `VITE_*` fallback configuration changes.

## Verification

Open `chrome://webrtc-internals`, join a debate from devices on different
networks, and enable microphone and camera. A healthy connection has:

- `iceConnectionState` equal to `connected` or `completed`;
- a selected ICE candidate pair;
- `srflx` candidates when a direct STUN-assisted path works;
- `relay` candidates when TURN is required;
- increasing inbound and outbound RTP byte counters.

For a TURN-only deployment check, temporarily add
`iceTransportPolicy: 'relay'` to the returned RTC configuration. Confirm a
selected `relay` pair, then remove the option so production prefers direct P2P
and uses TURN only as a fallback.
