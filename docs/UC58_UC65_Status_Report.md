# Bao cao trang thai UC-58 den UC-65

Ngay kiem tra: 2026-06-10  
Pham vi: Backend + Frontend cho cac UC Host, Scoring, AI Judge, Ranking va Realtime.

## Ket luan nhanh

UC-58 den UC-65 da duoc code va build thanh cong o ca Backend va Frontend.

Ket qua kiem tra:
- Backend `npm run build`: OK
- Frontend `npm run build`: OK
- Backend changed modules import smoke test: OK
- AI service import khi khong co key: OK, khong lam crash server
- Khong tim thay API key that trong source code
- `git diff --check`: OK, khong co conflict marker/whitespace error
- Backend `npm audit --audit-level=high`: OK, 0 vulnerabilities
- Frontend audit: co 2 moderate vulnerabilities tu `react-router`, khong co high/critical

Luu y chung:
- `npm run lint` hien chua sach do project co nhieu warning `any` san co va backend lint dang quet ca thu muc `dist/` sau build.
- File `frontend/tsconfig.node.tsbuildinfo` bi thay doi do chay build. Neu khong muon commit build cache, nen restore file nay truoc khi push.
- Gemini API key khong bi hardcode vao source. Key can dat trong `.env` bang `GEMINI_API_KEY`.

## Trang thai tung UC

| UC | Ten | Trang thai | Ghi chu |
|----|-----|------------|---------|
| UC-58 | Bat/tat chat Viewer | OK | Host/Owner co the bat/tat chat viewer. Socket chan viewer gui chat khi bi tat. |
| UC-59 | Chuyen quyen Host human | OK | Host/Owner co the chuyen host sang participant khac. Co realtime update participant/host. |
| UC-60 | Judge human nop diem 6 tieu chi | OK | Judge duoc assign co the nop diem theo 6 tieu chi. Co validate diem va tinh `overall`. Da ho tro ca room AI+human. |
| UC-61 | AI BGK cham tam sau moi luot | OK | AI cham sau speech/CE khi co transcript. Ho tro Gemini truoc, fallback OpenAI, neu thieu key thi fallback an toan. |
| UC-62 | Tong hop diem nhieu judge + AI | OK | Da aggregate human judge va AI theo weight policy. Co realtime `score:aggregate-updated`. |
| UC-63 | Xac dinh winnerTeam | OK | Da tinh `winnerTeam` bang cach so sanh tong diem Proposition vs Opposition. Co API va realtime event. |
| UC-64 | Cap nhat ELO sau tran Rank | OK | Chi apply cho rank room completed va co winner. Ho tro 1v1/3v3, cap nhat ELO cho toan bo debater. |
| UC-65 | Socket authenticate + join room | OK | Socket auth bang JWT, join room channel, restore phase/timer/chat/score state. Ho tro `join-room` va giu tuong thich `room:join`. |

## Chi tiet da kiem tra

### UC-58 - Bat/tat chat Viewer

Da co:
- Field `viewerChatEnabled` trong `DebateRoom`.
- API `POST /api/v1/rooms/:id/host/viewer-chat`.
- Chi Host/Owner duoc thay doi.
- Socket `chat:send` kiem tra viewer co duoc chat hay khong.
- Frontend co `roomService.setViewerChat(...)` va store state.

Trang thai: OK.

### UC-59 - Chuyen quyen Host human

Da co:
- API `POST /api/v1/rooms/:id/host/transfer`.
- Chi Host hien tai hoac Owner duoc chuyen.
- Target phai la participant trong room.
- Cap nhat `hostType = human`, `hostId`, `roomRole`.
- Emit realtime `room:host-transferred` va `room:participant-update`.
- Frontend co `roomService.transferHost(...)` va socket listener.

Trang thai: OK.

### UC-60 - Judge human nop diem

Da co:
- API `POST /api/v1/rooms/:id/judge/submit-score`.
- Validate user phai la participant co `roomRole = judge`.
- Validate 6 tieu chi:
  - logic: 0-30
  - rebuttal: 0-20
  - evidence: 0-15
  - crossExam: 0-15
  - strategy: 0-10
  - communication: 0-10
- Tu tinh `overall`.
- Neu judge nop lai cung speaker thi update verdict cu, khong tao trung.
- Emit `score:updated` va `score:aggregate-updated`.
- Frontend co type va service `submitJudgeScore`.

Trang thai: OK.

### UC-61 - AI BGK cham tam

Da co:
- Tu cham AI khi ket thuc turn qua:
  - `POST /api/v1/rooms/:id/host/next-turn`
  - `POST /api/v1/rooms/:id/cross-exam/pass-turn`
- Chi cham khi co transcript.
- Ket qua AI gom score, verdict, comments, strengths, weaknesses, fallacies, summary.
- Luu vao `turnHistory[].aiAnalysis`.
- Luu tam vao `finalScores.judgeVerdicts` voi `source = ai`.
- Emit `ai:turn-judged` va `score:updated`.
- AI provider:
  - Uu tien Gemini neu co `GEMINI_API_KEY`.
  - Fallback OpenAI neu co `OPENAI_API_KEY`.
  - Neu khong co key hoac AI loi thi fallback an toan, khong crash server.

Trang thai: OK.

Luu y:
- Muon AI cham that thi can set `GEMINI_API_KEY` trong backend `.env`.
- Key da paste trong chat nen rotate lai tren Google AI Studio truoc khi dung lau dai.

### UC-62 - Tong hop diem nhieu judge + AI

Da co:
- Aggregate tu `finalScores.judgeVerdicts`.
- Policy:
  - Human judge weight = 1.0
  - AI judge weight = 0.5
- Tinh trung binh co trong so cho tung team.
- API `POST /api/v1/rooms/:id/scores/aggregate`.
- `GET /api/v1/rooms/:id/scores` tra final scores da aggregate.
- Emit `score:aggregate-updated`.

Trang thai: OK.

### UC-63 - Xac dinh winnerTeam

Da co:
- Field `winnerTeam` trong `finalScores`.
- Winner duoc xac dinh bang tong diem:
  - `teamProposition.total`
  - `teamOpposition.total`
- Neu chenh lech duoi 0.5 thi `draw`.
- API:
  - `GET /api/v1/rooms/:id/winner`
  - `POST /api/v1/rooms/:id/winner`
- Emit `score:winner-determined`.
- Frontend co `WinnerResult`, store va service.

Trang thai: OK.

### UC-64 - Cap nhat ELO sau tran Rank

Da co:
- API dung flow hien tai: `POST /api/v1/rooms/:id/result`.
- Chi apply khi:
  - room la rank
  - room status la `completed`
  - co winner/winnerTeam
  - chua apply ELO truoc do
- Ho tro 1v1 va 3v3.
- ELO opponent trong team match = average ELO cua team doi thu.
- Cap nhat:
  - `ranking.elo`
  - `ranking.tier`
  - `ranking.seasonPoints`
  - `stats.totalDebates`
  - `stats.wins/losses`
- Tra ve `eloDelta`, old/new ELO, team va result cho tung user.

Trang thai: OK.

### UC-65 - Socket authenticate + join room

Da co:
- Socket.IO authenticate bang JWT handshake.
- Event chuan:
  - `join-room`
  - `leave-room`
- Giu tuong thich event cu:
  - `room:join`
  - `room:leave`
- Khi join room, backend check:
  - co `roomId`
  - room ton tai
  - user la participant trong room
- Server tra snapshot:
  - room
  - session
  - participants
  - current phase
  - current turn
  - timer
  - paused state
  - chat history
  - finalScores
  - viewerChatEnabled
- Frontend `useDebateSocket(roomId)` tu join khi mount va leave khi unmount.

Trang thai: OK.

## Van de/lui y truoc khi push

1. Lint chua sach

`npm run lint` dang fail vi:
- Backend lint quet ca `dist/` sau khi build.
- Source co nhieu warning `any` san co.
- Frontend co warning `any` o cac page/component cu.

Muc do: khong chan build, nhung neu CI bat lint strict thi se fail.

2. Build cache bi thay doi

File dang bi thay doi:

```bash
frontend/tsconfig.node.tsbuildinfo
```

Day la build cache. Neu khong muon commit artifact nay, chay:

```bash
git restore frontend/tsconfig.node.tsbuildinfo
```

3. Frontend audit

Frontend co 2 moderate vulnerabilities tu `react-router`.

Muc do: khong phai high/critical. Co the xu ly sau bang:

```bash
cd frontend
npm audit fix
```

Can can nhac vi lenh nay co the thay doi `package-lock.json`.

4. AI key

Khong commit key vao source. Backend chi dung:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
```

Nen rotate lai key da paste trong chat truoc khi dung that.

## Danh sach file chinh da thay doi

Backend:
- `backend/src/models/DebateRoom.ts`
- `backend/src/features/room/room.routes.ts`
- `backend/src/features/ai/ai.service.ts`
- `backend/src/features/ranking/ranking.service.ts`
- `backend/src/socket/chat.socket.ts`
- `backend/src/socket/room.socket.ts`
- `backend/src/config/env.ts`
- `backend/.env.example`

Frontend:
- `frontend/src/types/index.ts`
- `frontend/src/services/roomService.ts`
- `frontend/src/stores/debateStore.ts`
- `frontend/src/hooks/useSocket.ts`
- `frontend/src/hooks/useDebateSocket.ts`

## Ket luan cho leader

UC-58 den UC-65 da san sang de review va push ve mat build/runtime co ban.  
Rui ro con lai chu yeu la lint debt san co va viec can cau hinh dung env cho AI khi deploy.
