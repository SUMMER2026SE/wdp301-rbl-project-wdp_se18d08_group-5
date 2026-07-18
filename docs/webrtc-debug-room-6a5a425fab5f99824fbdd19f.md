# WebRTC Debug Log — Room `6a5a425fab5f99824fbdd19f`

> **Source:** `chrome://webrtc-internals/` capture từ
> URL: https://ai-debate-platform.vercel.app/debate/6a5a425fab5f99824fbdd19f
>
> **Capture mode:** `{"alwaysNegotiateDataChannels":false}`
>
> **Ngày chụp:** 17/7/2026, 21:59:58 → 22:04:15 (UTC+7)

---

## 1. Summary

| Field | Value |
|---|---|
| Connection URL | `https://ai-debate-platform.vercel.app/debate/6a5a425fab5f99824fbdd19f` |
| Room ID | `6a5a425fab5f99824fbdd19f` |
| Negotiation config | `{"alwaysNegotiateDataChannels":false}` |
| Connection window | 21:59:58 → 22:04:15 (~4 phút 17 giây) |
| Total events | 25 |
| Negotiation rounds | 3 (initial + 2 renegotiation) |
| ICE state (cuối) | `new` (connection vẫn đang trong quá trình thiết lập) |

---

## 2. Initial Connection State

```
ICE connection state:    new
Connection state:       new
Signaling state:        new
                       => "have-remote-offer"
                       => "stable"
                       => "have-local-offer"
                       => "stable"
                       => "have-local-offer"
                       => "stable"
```

**Nhận xét:** Signaling state đã đi qua 4 lần "stable" thay vì 1. Đây là dấu hiệu của **glare** (2 bên đồng thời tạo offer) hoặc **perfect negotiation** loop. ICE state vẫn `new` ở cuối → ICE chưa hoàn thành gathering/connectivity check.

---

## 3. Peer Connection Stats

### 3.1 Selected candidates

| Type | ID | Note |
|---|---|---|
| Peer connection | `P` | Root |
| Certificate | `CFA2:9F:3B:70:3E:49:BA:17:C4:AE:44:F3:DC:BA:A3:27:70:D6:8B:CE:B7:CB:88:9A:57:22:51:F0:FE:52:44:97` | DTLS cert fingerprint |
| Local candidate | host | `I/nY4g5s8` |
| Local candidate | host, **tcpType=active** | `Ivfub6K1T` ← ⚠️ TCP active (low priority) |
| Transport | `T01` | `iceState=new`, `dtlsState=new` |

### 3.2 Outbound RTP streams

| MID | SSRC | RTX SSRC | Codec | Active | Source |
|---|---|---|---|---|---|
| 0 | `1328824042` | `3229077600` | VP8 (96) | ✓ | `SV41` |
| 1 | `3303129127` | `1977095245` | VP8 (96) | ✓ | `SV44` |

**2 video streams** đều đang outbound dùng **VP8 codec**, không có audio track.

### 3.3 Media sources

| Kind | ID | Note |
|---|---|---|
| video | `SV41` | Source của SSRC `1328824042` |
| video | `SV44` | Source của SSRC `3303129127` |

---

## 4. Event Timeline

### 4.1 Phase 1 — Initial negotiation (21:59:58)

```
21:59:58 17/7/2026 — setRemoteDescription (type: "offer", 2 sections)
21:59:58 17/7/2026 — setRemoteDescriptionOnSuccess
21:59:58 17/7/2026 — onsignalingstatechange
21:59:58 17/7/2026 — transceiverAdded(index=0, kind=video)
21:59:58 17/7/2026 — createAnswer
21:59:58 17/7/2026 — createAnswerOnSuccess (type: "answer", 2 sections)
21:59:58 17/7/2026 — setLocalDescription (type: "answer", 2 sections)
21:59:58 17/7/2026 — setLocalDescriptionOnSuccess
21:59:58 17/7/2026 — onsignalingstatechange
21:59:58 17/7/2026 — transceiverModified(index=0, kind=video)
21:59:58 17/7/2026 — onicegatheringstatechange
21:59:58 17/7/2026 — onicecandidate
21:59:58 17/7/2026 — onicecandidate
21:59:58 17/7/2026 — onicegatheringstatechange
```

→ Đây là **answerer side** nhận được offer từ bên kia, tạo answer.

### 4.2 Phase 2 — Renegotiation 1 (22:00:05, sau 7s)

```
22:00:05 17/7/2026 — transceiverAdded(index=0, kind=video)
22:00:05 17/7/2026 — createOffer
22:00:05 17/7/2026 — onnegotiationneeded
22:00:05 17/7/2026 — createOfferOnSuccess (type: "offer", 2 sections)
22:00:05 17/7/2026 — setLocalDescription (type: "offer", 2 sections)
22:00:05 17/7/2026 — setLocalDescriptionOnSuccess
22:00:05 17/7/2026 — onsignalingstatechange
22:00:06 17/7/2026 — setRemoteDescription (type: "answer", 2 sections)
22:00:06 17/7/2026 — setRemoteDescriptionOnSuccess
22:00:06 17/7/2026 — onsignalingstatechange
22:00:06 17/7/2026 — transceiverModified(index=0, kind=video)
```

→ Sau 7 giây (21:59:58 → 22:00:05), bên này **chủ động tạo offer mới** vì
`onnegotiationneeded` triggered. Cùng MID=0 được modify.

### 4.3 Phase 3 — Renegotiation 2, thêm MID=1 (22:04:15, sau 4 phút 10s)

```
22:04:15 17/7/2026 — transceiverAdded(index=1, kind=video)
22:04:15 17/7/2026 — createOffer
22:04:15 17/7/2026 — onnegotiationneeded
22:04:15 17/7/2026 — createOfferOnSuccess (type: "offer", 3 sections)
22:04:15 17/7/2026 — setLocalDescription (type: "offer", 3 sections)
22:04:15 17/7/2026 — setLocalDescriptionOnSuccess
22:04:15 17/7/2026 — onsignalingstatechange
22:04:15 17/7/2026 — transceiverModified(index=1, kind=video)
22:04:15 17/7/2026 — setRemoteDescription (type: "answer", 3 sections)
22:04:15 17/7/2026 — setRemoteDescriptionOnSuccess
22:04:15 17/7/2026 — onsignalingstatechange
22:04:15 17/7/2026 — transceiverModified(index=1, kind=video)
```

→ **Track thứ 2** (MID=1) được thêm vào 4 phút sau initial connect. Offer có 3 sections
(thay vì 2 như trước) — 1 audio + 2 video hoặc 3 video transceivers.

---

## 5. Phân tích vấn đề

### 5.1 ICE state vẫn `new` ở cuối 22:04:15

Sau **4 phút 17 giây**, ICE connection state vẫn ở `new`. Bình thường ICE state
flow:

```
new → checking → connected → completed → disconnected → failed → closed
```

`new` kéo dài nghĩa là:
- **ICE gathering chưa hoàn thành** (chỉ thấy 2 host candidates — UDP và TCP active),
  không có server-reflexive (srflx) hay relay candidates từ STUN/TURN server
- **Chưa bắt đầu connectivity check** giữa 2 peers
- Hoặc **socket signaling đã chết** trước khi ICE agent gather xong

### 5.2 Local candidates chỉ có host

Chỉ 2 candidates là `host` (1 UDP + 1 TCP active):
- ✗ Không có `srflx` (server-reflexive) → STUN server không trả về reflexive candidate
- ✗ Không có `relay` → TURN server không allocate relay
- ✗ Cả 2 bên nằm sau NAT khác nhau → không thể kết nối ngang hàng

### 5.3 Signaling state bounce

```
new → "have-remote-offer" → "stable" → "have-local-offer" → "stable" → "have-local-offer" → "stable"
```

Có **4 lần vào stable** trong khi thường chỉ 1. Pattern này tương ứng với **glare condition**
hoặc **2 perfect negotiation loops**:

| Phase | Mô tả |
|---|---|
| `new → stable` (offer từ remote) | Bên này nhận offer, tạo answer, đến stable |
| `stable → have-local-offer` | 7s sau (22:00:05), bên này gọi `createOffer()` — `onnegotiationneeded` |
| `have-local-offer → stable` | Remote answer, đến stable lần 2 |
| `stable → have-local-offer` | Track mới (MID=1) → negotiation thứ 3 |
| `have-local-offer → stable` | Remote answer, đến stable lần 4 |

→ Nhìn chung là **multiple renegotiations**, không phải glare thực sự.

### 5.4 No audio track

Cả 2 outbound RTP stream đều là **video/VP8**, không có audio. Dù rule của debate
platform cho phép mic, user này **chưa bật mic** hoặc browser không có mic.

---

## 6. Kết luận

| Vấn đề | Mức độ | Nghi vấn |
|---|---|---|
| ICE state kẹt ở `new` | 🔴 Critical | STUN/TURN config sai hoặc signaling socket drop |
| Chỉ host candidates | 🔴 Critical | Server không gửi được reflexive candidate về client |
| Signaling bounce 4 lần | 🟡 Minor | Có thể do logic addTrack thường xuyên hoặc video toggle |
| No audio track | 🟢 Expected | User chưa enable mic |
| 2 video tracks thêm vào giữa session | 🟢 Expected | User tham gia/kích hoạt camera thứ 2 |

### Root cause nhiều khả năng

1. **STUN/TURN servers trong config RTCPeerConnection không hoạt động** với mạng
   của user (chặn UDP, hoặc server list rỗng, hoặc TURN credentials expired).
2. **Signaling socket bị disconnect** giữa chừng nên ICE agent không nhận được
   remote candidates từ peer khác.
3. **Renegotiation #2 (22:04:15) trigger thêm transceiver nhưng không kết thúc** —
   signaling state đến stable nhưng ICE chưa thử kết nối lại.

### Recommended fix

1. **Verify STUN/TURN config** — kiểm tra `iceServers[]` trong code khởi tạo
   `RTCPeerConnection`. Đảm bảo có ít nhất 1 STUN + 1 TURN server với credentials hợp lệ.
2. **Log ICE candidate events** (onicecandidate + onicecandidateerror) — biết được
   có bao nhiêu candidates được gather, có error gì không.
3. **Add ICE connection state change handler** — log khi state chuyển sang
   `failed` hoặc `disconnected` để biết khi nào mất kết nối.
4. **Throttle renegotiation** — debounce addTrack liên tiếp để tránh multiple
   offers gần nhau trong 7s (21:59:58 → 22:00:05).
5. **Auto-restart ICE khi disconnect** — implement ICE restart trong
   `oniceconnectionstatechange === 'failed'`.

---

## 7. Related files trong codebase

- **Frontend:** `frontend/src/services/webrtc/*.ts` — RTCPeerConnection init
- **Frontend:** `frontend/src/hooks/useDebateSocket.ts` — socket signaling transport
- **Backend:** `backend/src/socket/index.ts` — emit signaling events
- **Docs:** `docs/04_TRD_Technical_Requirements.md` — xem phần media/SFU

---

**Captured by:** Cursor session (chat transcript 17/7/2026)
**Stored:** `docs/webrtc-debug-room-6a5a425fab5f99824fbdd19f.md` (file này)
