# 18 - Danh sach tinh nang va chuc nang lien quan

**Project:** AI Debate Platform  
**Muc dich:** Liet ke cac tinh nang trong app theo dang muc luc phan cap, kem cac chuc nang con, man hinh, actor va API/Realtime lien quan.  
**Nguon doi chieu:** `frontend/src/routes`, `frontend/src/pages`, `frontend/src/services`, `backend/src/features`, `backend/src/socket`, `docs/05_Use_Cases.md`, `docs/16_Screens_Flow_Authorization_Functions.md`

---

## 1. Muc luc tinh nang

| Ma | Tinh nang / Chuc nang | Man hinh / Route chinh |
|---:|---|---|
| 1 | Authentication | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/change-password` |
| 1.1 | Registration | `/register` |
| 1.2 | Login | `/login` |
| 1.3 | Login by Google | `/login` |
| 1.4 | Verify email | `/verify-email` |
| 1.5 | Resend verification email | Authenticated action |
| 1.6 | Forgot password | `/forgot-password` |
| 1.7 | Reset password | `/reset-password` |
| 1.8 | Change password | `/change-password` |
| 1.9 | Refresh token | Background API |
| 1.10 | Get current user session | Background API |
| 1.11 | Logout | Navbar / account action |
| 2 | User Profile & Account | `/profile/:userId`, `/profile/:userId/history` |
| 2.1 | View public profile | `/profile/:userId` |
| 2.2 | View own profile | `/profile/:userId` |
| 2.3 | Update profile | `/profile/:userId` |
| 2.4 | Upload avatar | `/profile/:userId` |
| 2.5 | View user statistics | `/profile/:userId` |
| 2.6 | View debate history | `/profile/:userId/history` |
| 3 | Ranking | `/leaderboard` |
| 3.1 | View global leaderboard | `/leaderboard` |
| 3.2 | View user ranking summary | `/profile/:userId`, `/leaderboard` |
| 4 | Match Discovery | `/matches` |
| 4.1 | View live match list | `/matches` |
| 4.2 | Filter matches by format, type, status | `/matches` |
| 4.3 | View room detail | `/matches`, `/rooms/:roomId/lobby`, `/debate/:roomId` |
| 4.4 | Join waiting/ready room | `/matches` |
| 4.5 | Join active room as viewer | `/matches`, `/debate/:roomId` |
| 5 | Room Management | `/rooms/create`, `/rooms/:roomId/lobby` |
| 5.1 | Create custom room | `/rooms/create` |
| 5.2 | Configure room | `/rooms/create`, `/rooms/:roomId/lobby` |
| 5.3 | Update room | `/rooms/:roomId/lobby` |
| 5.4 | Delete/cancel room | `/rooms/:roomId/lobby` |
| 5.5 | Join room | `/matches`, `/rooms/:roomId/lobby` |
| 5.6 | Leave room | `/rooms/:roomId/lobby`, `/debate/:roomId` |
| 5.7 | Select team and speaker position | `/rooms/:roomId/lobby` |
| 5.8 | Assign participant role | `/rooms/:roomId/lobby` |
| 5.9 | Lock positions | `/rooms/:roomId/lobby` |
| 5.10 | Toggle viewer chat | `/rooms/:roomId/lobby`, `/debate/:roomId` |
| 5.11 | Start debate | `/rooms/:roomId/lobby` |
| 5.12 | Kick participant in lobby | `/rooms/:roomId/lobby` |
| 6 | Ranked Matchmaking | `/matchmaking` |
| 6.1 | Join ranked queue | `/matchmaking` |
| 6.2 | Leave ranked queue | `/matchmaking` |
| 6.3 | View queue status | `/matchmaking` |
| 6.4 | Receive match found notification | Socket event |
| 6.5 | Auto-create ranked room | System function |
| 7 | Debate Room | `/debate/:roomId` |
| 7.1 | View debate room state | `/debate/:roomId` |
| 7.2 | Restore room state after reconnect | Socket event |
| 7.3 | Start phase | Host control |
| 7.4 | Move to next turn | Host control |
| 7.5 | Finish current phase | Host control |
| 7.6 | Pause debate | Host control |
| 7.7 | Resume debate | Host control |
| 7.8 | End debate | Host control |
| 7.9 | Grant speaking permission | Host control |
| 7.10 | Revoke speaking permission | Host control |
| 7.11 | Mute/unmute speaker | Host control |
| 7.12 | Mute/unmute chat | Host control |
| 7.13 | Issue yellow card | Host control |
| 7.14 | Kick participant during debate | Host control |
| 7.15 | Debater surrender | Debater action |
| 7.16 | Request draw | Debater action |
| 7.17 | Submit judge score | Judge action |
| 7.18 | Aggregate scores | Host/Judge action |
| 7.19 | Determine winner | Host/Judge/System action |
| 7.20 | Apply result to ranking | System action |
| 8 | Debate Flow Engine | System / Socket |
| 8.1 | Motion announcement | Debate phase |
| 8.2 | Preparation 7 minutes | Debate phase |
| 8.3 | Speech turn | Debate phase |
| 8.4 | Cross examination | Debate phase |
| 8.5 | Judge feedback | Debate phase |
| 8.6 | Preparation 1 minute | Debate phase |
| 8.7 | Closing speech | Debate phase |
| 8.8 | Final judging | Debate phase |
| 8.9 | Completed debate | Debate phase |
| 8.10 | Timer warning and completion | Socket event |
| 9 | Cross Examination | `/debate/:roomId` |
| 9.1 | Ask CE question | Cross-exam panel |
| 9.2 | Submit CE answer | Cross-exam panel |
| 9.3 | Pass CE turn | Cross-exam panel |
| 9.4 | Finish CE phase | Cross-exam panel |
| 9.5 | Broadcast CE state update | Socket event |
| 10 | Chat & Communication | `/debate/:roomId` |
| 10.1 | Main room chat | Debate chat |
| 10.2 | Viewer chat | Viewer chat |
| 10.3 | Toggle viewer chat availability | Host/Owner/Admin action |
| 10.4 | Private team room | Private room panel |
| 10.5 | Private team chat | Private room panel |
| 10.6 | Voice room join/leave | Mic control |
| 10.7 | Voice offer/answer/ICE signaling | Mic control |
| 10.8 | Live translation captions | Mic control / captions |
| 11 | AI Support | System / AI API |
| 11.1 | Analyze speech | AI API |
| 11.2 | Score argument | AI API |
| 11.3 | Judge a turn | AI API |
| 11.4 | Generate final verdict | AI API |
| 11.5 | Generate debate summary | AI API |
| 11.6 | Toxic content check | AI moderation API |
| 11.7 | AI unavailable fallback | System function |
| 12 | Replay & Results | `/replay/:sessionId` |
| 12.1 | View replay | `/replay/:sessionId` |
| 12.2 | View final scores | `/replay/:sessionId` |
| 12.3 | View winner/result | `/replay/:sessionId` |
| 12.4 | View turn timeline/transcript | `/replay/:sessionId` |
| 12.5 | View AI summary | `/replay/:sessionId` |
| 13 | Forum / Community | `/forum`, `/forum/:topicId` |
| 13.1 | View topic list | `/forum` |
| 13.2 | View topic detail | `/forum/:topicId` |
| 13.3 | Create topic | `/forum` |
| 13.4 | Set stance agree/disagree | `/forum/:topicId` |
| 13.5 | Create post | `/forum/:topicId` |
| 13.6 | Like/unlike post | `/forum/:topicId` |
| 13.7 | View comments | `/forum/:topicId` |
| 13.8 | Add comment | `/forum/:topicId` |
| 14 | Report & Moderation Request | Service/API |
| 14.1 | Create report | Report API |
| 14.2 | Report user | Report API |
| 14.3 | Report message | Report API |
| 14.4 | Report room/debate | Report API |
| 15 | Administration | `/admin` |
| 15.1 | View admin overview | `/admin` |
| 15.2 | View user list | `/admin` |
| 15.3 | Search/filter users | `/admin` |
| 15.4 | View user detail/activity | `/admin` |
| 15.5 | Update user role | `/admin` |
| 15.6 | Ban user | `/admin` |
| 15.7 | Unban user | `/admin` |
| 15.8 | View room list | `/admin` |
| 15.9 | Search/filter rooms | `/admin` |
| 15.10 | View room detail | `/admin` |
| 15.11 | Update room status | `/admin` |
| 15.12 | Kick participant by admin | `/admin` |
| 15.13 | Mute/unmute participant by admin | `/admin` |
| 15.14 | Toggle room viewer chat by admin | `/admin` |
| 15.15 | View report list | `/admin` |
| 15.16 | Search/filter reports | `/admin` |
| 15.17 | Resolve/dismiss report | `/admin` |
| 15.18 | Apply moderation action from report | `/admin` |
| 16 | Upload & Media | Profile / common components |
| 16.1 | Upload avatar image | Profile |
| 16.2 | Upload general image | ImageUpload component |
| 16.3 | Delete uploaded image | ImageUpload component |
| 17 | Realtime Infrastructure | Socket.IO |
| 17.1 | Authenticate socket connection | Socket middleware |
| 17.2 | Join room channel | Socket event |
| 17.3 | Leave room channel | Socket event |
| 17.4 | Rejoin room channel | Socket event |
| 17.5 | Broadcast participant updates | Socket event |
| 17.6 | Broadcast debate phase/timer updates | Socket event |
| 17.7 | Broadcast score/winner updates | Socket event |
| 17.8 | Broadcast admin moderation events | Socket event |
| 18 | System & Security | Backend infrastructure |
| 18.1 | API rate limiting | Express middleware |
| 18.2 | Request validation | Express middleware |
| 18.3 | RBAC authorization | Express middleware |
| 18.4 | Standard success/error response | Utility layer |
| 18.5 | Not found handler | Express middleware |
| 18.6 | Health check | `/health` |
| 19 | Public / Navigation | `/`, `/404` |
| 19.1 | Home page | `/` |
| 19.2 | Navbar navigation | MainLayout |
| 19.3 | Protected route guard | ProtectedRoute |
| 19.4 | Loading screen | Suspense fallback |
| 19.5 | Reconnect overlay | Socket connection status |
| 19.6 | Not found page | `/404` |

---

## 2. Chi tiet theo nhom tinh nang

### 2.1 Authentication

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| Registration | Guest | Tao tai khoan moi bang username, email va password. | `POST /api/v1/auth/register` |
| Login | Guest/User/Admin | Dang nhap bang email/username va password. | `POST /api/v1/auth/login` |
| Login by Google | Guest/User/Admin | Dang nhap bang Google credential. | `POST /api/v1/auth/google` |
| Verify email | Guest/User | Xac thuc email bang token. | `POST /api/v1/auth/verify-email` |
| Resend verification email | User/Admin | Gui lai email xac thuc cho tai khoan dang dang nhap. | `POST /api/v1/auth/resend-verification` |
| Forgot password | Guest/User | Gui yeu cau khoi phuc mat khau qua email. | `POST /api/v1/auth/forgot-password` |
| Reset password | Guest/User | Dat lai mat khau bang reset token. | `POST /api/v1/auth/reset-password` |
| Change password | User/Admin | Doi mat khau khi da dang nhap. | `POST /api/v1/auth/change-password` |
| Refresh token | User/Admin | Cap access token moi bang refresh token. | `POST /api/v1/auth/refresh-token` |
| Get current session | User/Admin | Lay thong tin user dang dang nhap. | `GET /api/v1/auth/me` |
| Logout | User/Admin | Ket thuc phien dang nhap. | `POST /api/v1/auth/logout` |

### 2.2 User Profile & Account

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| View public profile | Guest/User/Admin | Xem thong tin cong khai cua user. | `GET /api/v1/users/:id` |
| View user stats | Guest/User/Admin | Xem ELO, tier, so tran, win/loss va thong ke ca nhan. | `GET /api/v1/users/:id/stats` |
| View debate history | Guest/User/Admin | Xem lich su cac tran debate da hoan thanh. | `GET /api/v1/users/:id/history` |
| Update profile | User/Admin | Cap nhat display name, bio, school, club. | `PUT /api/v1/users/:id/profile` |
| Upload avatar | User/Admin | Upload va thay the avatar cua tai khoan. | `POST /api/v1/upload/avatar` |

### 2.3 Ranking

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| View leaderboard | Guest/User/Admin | Xem bang xep hang global theo ELO. | `GET /api/v1/rankings/leaderboard` |
| View user ranking | Guest/User/Admin | Xem ELO, tier va hang cua mot user. | `GET /api/v1/rankings/user/:userId` |
| Update ranking after ranked debate | System | Cap nhat ELO, tier, season points va win/loss sau tran rank. | `POST /api/v1/rooms/:roomId/result` |

### 2.4 Match Discovery

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| View live matches | Guest/User/Admin | Liet ke cac phong waiting, ready, active. | `GET /api/v1/rooms` |
| Filter matches | Guest/User/Admin | Loc theo format `1v1/3v3`, room type `rank/custom`, status. | `GET /api/v1/rooms` |
| View room detail | Guest/User/Admin | Xem thong tin phong va participant. | `GET /api/v1/rooms/:roomId` |
| Join room | User/Admin | Tham gia phong waiting/ready, co the can password. | `POST /api/v1/rooms/:roomId/join` |
| Join as viewer | User/Admin | Vao phong active/paused voi vai tro viewer khi duoc phep. Backend hien dung chung API join room va gan role mac dinh la viewer. | `POST /api/v1/rooms/:roomId/join` |

### 2.5 Room Management

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| Create custom room | User | Tao phong custom va tro thanh room owner. | `POST /api/v1/rooms/create` |
| Update room config | Owner | Cap nhat title, format, host type, judge type/count, privacy. | `PUT /api/v1/rooms/:roomId` |
| Delete/cancel room | Owner | Huy hoac xoa phong truoc khi tranh bien. | `DELETE /api/v1/rooms/:roomId` |
| Leave room | Participant | Roi khoi lobby hoac debate room. | `POST /api/v1/rooms/:roomId/leave` |
| Select position | Debater | Chon team Proposition/Opposition va speaker slot. | `POST /api/v1/rooms/:roomId/position` |
| Assign role | Owner | Gan vai tro host, judge, debater, viewer. | `POST /api/v1/rooms/:roomId/assign-role` |
| Lock positions | Owner | Khoa slot tranh bien truoc khi start. | `POST /api/v1/rooms/:roomId/position/lock` |
| Toggle viewer chat | Owner/Host | Bat/tat viewer chat. | `POST /api/v1/rooms/:roomId/viewer-chat` |
| Start debate | Owner/Host | Kiem tra dieu kien va bat dau debate session. | `POST /api/v1/rooms/:roomId/start` |
| Kick participant | Owner/Host | Loai participant khoi phong. | `POST /api/v1/rooms/:roomId/kick` |

### 2.6 Ranked Matchmaking

| Chuc nang | Actor | Mo ta | API/Socket lien quan |
|---|---|---|---|
| Join ranked queue | User | Vao hang doi rank theo format `1v1` hoac `3v3`. | `POST /api/v1/matchmaking/queue` |
| Leave ranked queue | User | Roi hang doi rank. | `DELETE /api/v1/matchmaking/queue` |
| View queue status | User | Xem trang thai queue, thoi gian cho, ELO range. | `GET /api/v1/matchmaking/status` |
| Match found | System/User | He thong ghep du nguoi, tao room va thong bao client. | `match:found` |

### 2.7 Debate Room & Debate Flow

| Chuc nang | Actor | Mo ta | API/Socket lien quan |
|---|---|---|---|
| View session | Participant/Viewer | Lay debate session hien tai. | `GET /api/v1/debate/:roomId/session` |
| Start phase | Host/Owner | Bat dau phase hien tai. | `POST /api/v1/rooms/:roomId/host/start-phase`, `host:start-phase` |
| Next turn | Host/Owner | Chuyen sang turn/phase tiep theo. | `POST /api/v1/rooms/:roomId/host/next-turn`, `host:next-turn` |
| Finish phase | Host/Owner | Ket thuc phase hien tai va luu transcript. | `POST /api/v1/debate/:roomId/finish-phase` |
| Pause debate | Host | Tam dung debate va timer. | `POST /api/v1/debate/:roomId/host/pause` |
| Resume debate | Host | Tiep tuc debate va timer. | `POST /api/v1/debate/:roomId/host/resume` |
| End debate | Host | Ket thuc debate thu cong. | `POST /api/v1/debate/:roomId/end` |
| Surrender | Debater | Chap nhan thua va ket thuc tran. | `POST /api/v1/debate/:roomId/surrender` |
| Request draw | Debater | Yeu cau hoa tran. | `POST /api/v1/debate/:roomId/draw/request` |
| Issue yellow card | Host | Phat the vang cho participant. | `POST /api/v1/debate/:roomId/host/issue-card` |
| Kick participant | Host | Loai participant khoi debate. | `POST /api/v1/debate/:roomId/host/kick` |
| Submit judge score | Judge | Nop diem va nhan xet. | `POST /api/v1/rooms/:roomId/judge/score`, `POST /api/v1/debate/:roomId/judge/submit-score` |
| Aggregate scores | Host/Judge/System | Tong hop diem human judge va AI judge. | `POST /api/v1/rooms/:roomId/scores/aggregate` |
| Determine winner | Host/Judge/System | Xac dinh doi thang/thua/hoa. | `GET/POST /api/v1/rooms/:roomId/winner` |
| Timer update | System | Dong bo timer server-authoritative. | `debate:timer-update`, `debate:timer-warning`, `debate:timer-complete` |
| Restore state | System | Khoi phuc phase, timer, chat, score khi reconnect. | `room:state-restore` |

### 2.8 Cross Examination

| Chuc nang | Actor | Mo ta | API/Socket lien quan |
|---|---|---|---|
| Ask question | Debater | Gui cau hoi CE theo luot. | `cross-exam:question` |
| Submit answer | Debater | Gui cau tra loi CE theo luot. | `cross-exam:answer` |
| Pass turn | Debater/Host | Bo qua luot hoi/tra loi. | `POST /api/v1/debate/:roomId/ce/pass-turn`, `cross-exam:pass-turn` |
| Finish CE | Debater/Host | Ket thuc cross examination. | `POST /api/v1/debate/:roomId/ce/finish`, `cross-exam:finish` |
| Update CE state | System | Broadcast quota, luot hoi, luot tra loi va transcript. | `cross-exam:update`, `cross-exam:ended` |

### 2.9 Chat, Voice & Translation

| Chuc nang | Actor | Mo ta | Socket lien quan |
|---|---|---|---|
| Main room chat | Participant | Gui va nhan tin nhan trong phong chinh. | `chat:send`, `chat:message`, `chat:history` |
| Viewer chat | Viewer/Host | Chat rieng cho viewer khi duoc bat. | `viewer-chat:send`, `viewer-chat:message`, `viewer-chat:history` |
| Toggle viewer chat | Host | Bat/tat viewer chat realtime. | `chat:toggle-viewer`, `room:viewer-chat-toggled` |
| Join private room | Debater | Vao phong rieng theo team trong prep. | `private-room:join` |
| Leave private room | Debater | Roi phong rieng. | `private-room:leave` |
| Private team chat | Debater | Chat rieng trong team. | `private-chat:send`, `private-chat:message` |
| Voice join/leave | Participant | Vao/roi kenh voice WebRTC. | `voice:join`, `voice:leave` |
| Voice signaling | Participant | Trao doi offer, answer, ICE candidate. | `voice:offer`, `voice:answer`, `voice:ice-candidate` |
| Live translation | Speaker/Viewer | Gui audio va nhan caption dich truc tiep. | `translation:start`, `translation:audio`, `translation:caption`, `translation:stop` |

### 2.10 AI Support

| Chuc nang | Actor | Mo ta | API/Socket lien quan |
|---|---|---|---|
| Analyze speech | System | Phan tich claim, weakness, fallacy trong speech. | `POST /api/v1/ai/analyze-speech` |
| Score argument | System | Cham diem mot argument/speech theo rubric AI. | `POST /api/v1/ai/score-argument` |
| Judge turn | System | Cham diem va nhan xet tung luot. | `POST /api/v1/ai/judge-turn`, `ai:turn-judged` |
| Final verdict | System | Tao verdict cuoi tran. | `POST /api/v1/ai/final-verdict` |
| Generate summary | System | Tao tom tat replay/result. | `POST /api/v1/ai/summarize-debate` |
| Toxic check | System | Kiem tra noi dung doc hai/spam/offensive. | `POST /api/v1/ai/check-toxic` |

### 2.11 Replay & Results

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| View replay | Guest/User/Admin | Xem lai tran da hoan thanh. | `GET /api/v1/debate/:roomId/replay` |
| View final scores | Guest/User/Admin | Xem diem cuoi cung cua doi va judge. | `GET /api/v1/debate/:roomId/scores` |
| View turn timeline | Guest/User/Admin | Xem transcript/timeline cac turn. | `GET /api/v1/debate/:roomId/replay` |
| View AI summary | Guest/User/Admin | Xem tom tat AI neu co. | `GET /api/v1/debate/:roomId/replay` |

### 2.12 Forum / Community

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| View topics | Guest/User/Admin | Xem danh sach topic forum. | `GET /api/v1/forum/topics` |
| View topic detail | Guest/User/Admin | Xem topic, cac post theo stance agree/disagree. | `GET /api/v1/forum/topics/:topicId` |
| Create topic | User/Admin | Tao topic moi. | `POST /api/v1/forum/topics` |
| Set stance | User/Admin | Chon agree/disagree cho topic. | `PUT /api/v1/forum/topics/:topicId/stance` |
| Create post | User/Admin | Dang bai theo topic va stance. | `POST /api/v1/forum/topics/:topicId/posts` |
| Like/unlike post | User/Admin | Like hoac unlike post. | `POST /api/v1/forum/posts/:postId/like` |
| View comments | Guest/User/Admin | Xem comment cua post. | `GET /api/v1/forum/posts/:postId/comments` |
| Add comment | User/Admin | Them comment vao post. | `POST /api/v1/forum/posts/:postId/comments` |

### 2.13 Report & Administration

| Chuc nang | Actor | Mo ta | API lien quan |
|---|---|---|---|
| Create report | User/Admin | Bao cao user, message, room, debate hoac noi dung khac. | `POST /api/v1/reports` |
| View overview | Admin | Xem tong quan user, room, report, moderation metrics. | `GET /api/v1/admin/overview` |
| View users | Admin | Liet ke, tim kiem, loc user. | `GET /api/v1/admin/users` |
| View user detail | Admin | Xem chi tiet va activity cua user. | `GET /api/v1/admin/users/:userId` |
| Update user role | Admin | Doi role `user/admin`. | `PATCH /api/v1/admin/users/:userId/role` |
| Ban user | Admin | Ban user theo duration va reason. | `POST /api/v1/admin/users/:userId/ban` |
| Unban user | Admin | Go ban user. | `POST /api/v1/admin/users/:userId/unban` |
| View rooms | Admin | Liet ke, tim kiem, loc room. | `GET /api/v1/admin/rooms` |
| View room detail | Admin | Xem chi tiet room, participant, toxic messages. | `GET /api/v1/admin/rooms/:roomId` |
| Update room status | Admin | Force update status phong. | `PATCH /api/v1/admin/rooms/:roomId/status` |
| Kick participant | Admin | Kick participant khoi room. | `POST /api/v1/admin/rooms/:roomId/kick` |
| Mute participant | Admin | Mute/unmute participant. | `POST /api/v1/admin/rooms/:roomId/mute` |
| Toggle viewer chat | Admin | Bat/tat viewer chat cua room. | `PATCH /api/v1/admin/rooms/:roomId/viewer-chat` |
| View reports | Admin | Liet ke, tim kiem, loc report. | `GET /api/v1/admin/reports` |
| Resolve report | Admin | Cap nhat status, resolution, note va action. | `PATCH /api/v1/admin/reports/:reportId` |

### 2.14 Upload & System Infrastructure

| Chuc nang | Actor | Mo ta | API/Thanh phan lien quan |
|---|---|---|---|
| Upload avatar | User/Admin | Upload avatar va gan vao current user. | `POST /api/v1/upload/avatar` |
| Upload image | User/Admin | Upload anh dung chung. | `POST /api/v1/upload/image` |
| Delete image | User/Admin | Xoa uploaded image theo public id. | `DELETE /api/v1/upload/image/:publicId` |
| Health check | System/Admin | Kiem tra server dang hoat dong. | `GET /health` |
| API rate limiting | System | Han che request nhay cam. | `apiLimiter`, `authLimiter` |
| Request validation | System | Validate body/query truoc khi xu ly. | `validate`, `validateQuery` |
| Authentication middleware | System | Xac thuc JWT cho route can bao ve. | `authenticate` |
| Authorization middleware | System | Kiem tra role admin va RBAC. | `authorize` |
| Global error handler | System | Chuan hoa loi API. | `globalErrorHandler` |
| Not found handler | System | Xu ly route khong ton tai. | `notFoundHandler` |

---

## 3. Phan quyen tong quan

| Actor | Nhom chuc nang chinh |
|---|---|
| Guest | Xem Home, Register, Login, Verify Email, Forgot/Reset Password, Leaderboard, Public Profile, Debate History, Live Matches, Replay, Forum read-only. |
| User | Tat ca chuc nang Guest; cap nhat profile/avatar; tao/join room; vao ranked queue; tham gia debate; chat; report; tao topic/post/comment forum. |
| Room Owner | Quan ly lobby cua phong minh tao: update room, assign role, lock positions, toggle viewer chat, start debate, kick participant trong lobby. |
| Host | Dieu phoi debate: start phase, next turn, pause/resume, mute/kick, issue card, manage chat, ket thuc tran. |
| Debater | Chon vi tri, tranh bien theo luot, dung private room/team chat, tham gia cross-exam, surrender/draw request. |
| Judge | Theo doi debate, gui reaction, nop diem, nhan xet va tham gia xac dinh ket qua. |
| Viewer | Xem active debate, dung viewer chat neu duoc bat, xem replay/result. |
| Admin | Dashboard quan tri, quan ly user, role, ban/unban, room moderation, report resolution va cac action moderation. |
| System | JWT/RBAC, matchmaking, timer, debate orchestration, AI judging, ELO update, socket broadcast, validation/error handling. |

---

## 4. Ghi chu

- Tai lieu nay uu tien tinh nang dang co trong source code hien tai, khong chi theo danh sach MVP cu.
- Route frontend `/replay/:sessionId` hien thi replay, trong khi service/backend dang lay du lieu replay theo `roomId`; khi viet bao cao co the ghi la replay identifier tuy theo cach truyen tham so.
- Owner, Host, Debater, Judge, Viewer la vai tro theo tung room, khong phai role tai khoan toan cuc.
- Backend co API tao report va admin review report; frontend hien tai co service tao report nhung chua co route rieng cho man hinh submit report.
