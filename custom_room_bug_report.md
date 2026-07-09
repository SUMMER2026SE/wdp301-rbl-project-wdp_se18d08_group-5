# Báo cáo lỗi luồng tạo Custom Room

Ngày audit: 2026-07-07  
Nhánh: `roomDebatev2`  
Phạm vi: luồng tạo phòng custom từ `CreateRoomPage` -> `roomService.create` -> `POST /api/v1/rooms/create` -> `DebateRoom`.

Kết quả build:
- `npm --prefix backend run build`: PASS
- `npm --prefix frontend run build`: PASS, chỉ còn warning chunk-size quen thuộc của Vite.

## BUG-CR-01: Route tạo phòng chưa dùng `createRoomSchema`
* Severity: Critical
* Area: Backend / API Validation
* Location: `backend/src/features/room/room.routes.ts:600`, `backend/src/features/room/room.schema.ts:19`
* Description:
  Backend đã khai báo `createRoomSchema`, nhưng route `POST /api/v1/rooms/create` không gọi `validate(createRoomSchema)`. Handler đang đọc trực tiếp `req.body`, nên các rule về `title`, `format`, `hostType`, `judgeType`, `judgeCount`, private password và AI judge count không được validate thống nhất ở API boundary.
* Reproduction Steps:
  1. Gọi trực tiếp `POST /api/v1/rooms/create`.
  2. Gửi payload sai như title rỗng/toàn khoảng trắng, boolean dạng string, judgeCount sai, hoặc private room không có password.
  3. Quan sát validation phụ thuộc vào logic route hoặc Mongoose, không phải schema Zod đã khai báo.
* Expected:
  Route tạo phòng phải dùng `validate(createRoomSchema)` và trả lỗi 400 rõ ràng khi input sai.
* Actual:
  Route bỏ qua schema.
* Business Impact:
  Client gọi API trực tiếp có thể tạo dữ liệu phòng sai hoặc nhận lỗi không nhất quán. Dev trong team cũng dễ hiểu nhầm là `createRoomSchema` đang có hiệu lực.
* Suggested Fix:
  Import `createRoomSchema` vào `room.routes.ts` và gắn `validate(createRoomSchema)` cho route create. Trước đó cần fix BUG-CR-02 để không làm mất field `motion`.

## BUG-CR-02: `createRoomSchema` thiếu field `motion`
* Severity: Critical
* Area: Backend / Contract Mismatch
* Location: `backend/src/features/room/room.schema.ts:19`, `backend/src/features/room/room.routes.ts:604`, `frontend/src/pages/room/CreateRoomPage.tsx:27`
* Description:
  Frontend gửi `motion`, route backend cũng đọc `motion`, nhưng `createRoomSchema` không khai báo field này. Nếu sau này thêm `validate(createRoomSchema)`, Zod sẽ strip unknown field theo mặc định, làm `motion` bị mất và phòng có thể được tạo không có topic.
* Reproduction Steps:
  1. Thêm `validate(createRoomSchema)` vào route create.
  2. Tạo phòng từ frontend với topic đã chọn hoặc topic custom.
  3. Kiểm tra room được lưu.
* Expected:
  Topic từ `CreateRoomPage` phải được validate và persist.
* Actual:
  Với schema hiện tại, `motion` có nguy cơ bị loại bỏ khi validate.
* Business Impact:
  Một fix validation tưởng là đúng có thể làm hỏng luồng tạo topic và tạo phòng rỗng motion.
* Suggested Fix:
  Thêm `motion: z.string().min(1).max(240).trim()` vào `createRoomSchema`, khớp với `MAX_MOTION_LENGTH` trong `room.routes.ts`.

## BUG-CR-03: Password phòng private có thể bị trả về trong response tạo phòng
* Severity: Critical
* Area: Backend / Security / Privacy
* Location: `backend/src/features/room/room.routes.ts:619`, `backend/src/features/room/room.routes.ts:641`, `backend/src/models/DebateRoom.ts:59`
* Description:
  Field `password` trong model có `select: false`, nhưng create handler trả thẳng document vừa tạo bằng `sendSuccess(res, room, ...)`. `select: false` chỉ bảo vệ khi query lại từ DB, không chắc chắn bảo vệ document vừa được create và đang chứa password.
* Reproduction Steps:
  1. Tạo private custom room có password.
  2. Mở DevTools hoặc inspect response của `POST /api/v1/rooms/create`.
  3. Kiểm tra `data.password`.
* Expected:
  API không bao giờ trả password phòng private về client.
* Actual:
  Response tạo phòng có nguy cơ chứa plaintext password.
* Business Impact:
  Secret của phòng private có thể bị lộ qua browser devtools, log client, proxy hoặc analytics.
* Suggested Fix:
  Không trả document create thô. Query lại room bằng `.select('-password')`, hoặc convert `room.toObject()` rồi delete `password`, hoặc dùng `buildRoomPayload(room)` đã sanitize.

## BUG-CR-04: Password phòng đang lưu và so sánh dạng plaintext
* Severity: Major
* Area: Backend / Security
* Location: `backend/src/features/room/room.routes.ts:619`, `backend/src/features/room/room.routes.ts:900`
* Description:
  Password của private room được lưu trực tiếp và join room so sánh bằng `req.body.password !== room.password`. Nghĩa là secret phòng đang nằm plaintext trong database.
* Reproduction Steps:
  1. Tạo private room.
  2. Query DB với `+password`.
  3. Quan sát password lưu dạng plaintext.
* Expected:
  Nếu gọi là password, nên hash trước khi lưu và verify bằng hàm compare.
* Actual:
  Password được lưu plaintext.
* Business Impact:
  Ai có quyền đọc DB có thể thấy password phòng. Người dùng có thể tái sử dụng password ở nơi khác, nên đây là rủi ro bảo mật.
* Suggested Fix:
  Hash password phòng trước khi lưu và compare bằng bcrypt/crypto. Nếu product muốn đây chỉ là mã mời, nên đổi tên thành access code và đảm bảo tuyệt đối không trả về client.

## BUG-CR-05: Backend cho tạo phòng không có motion nếu gọi API trực tiếp
* Severity: Major
* Area: Backend / Business Logic
* Location: `backend/src/features/room/room.routes.ts:104`, `backend/src/features/room/room.routes.ts:612`, `frontend/src/pages/room/CreateRoomPage.tsx:42`
* Description:
  Frontend chặn topic rỗng, nhưng backend `normalizeMotion(undefined)` trả về chuỗi rỗng. Vì route create không validate schema, client gọi API trực tiếp có thể tạo phòng custom không có motion.
* Reproduction Steps:
  1. Gọi `POST /api/v1/rooms/create` với `title`, `format`, host/judge config hợp lệ nhưng bỏ `motion`.
  2. Kiểm tra room được lưu.
* Expected:
  Backend phải enforce cùng rule với frontend: tạo phòng cần có topic, hoặc nếu topic optional thì UI không nên bắt buộc.
* Actual:
  Có thể tạo room với `motion: ''`.
* Business Impact:
  Lobby/start flow bị lệch: room tạo được nhưng sau đó có thể không start được hoặc cần sửa topic thủ công.
* Suggested Fix:
  Require `motion` trong `createRoomSchema`. Nếu muốn cho phép tạo phòng trước rồi chọn motion sau, cần thống nhất lại UX và copy trên frontend.

## BUG-CR-06: Input password ở frontend không được mask
* Severity: Minor
* Area: Frontend / Security UX
* Location: `frontend/src/pages/room/CreateRoomPage.tsx:159`
* Description:
  Field password của private room không set `type="password"`, nên người dùng nhập password dưới dạng text thường.
* Reproduction Steps:
  1. Mở trang Create Room.
  2. Bật Private room.
  3. Nhập password.
* Expected:
  Password/access code nên được che mặc định.
* Actual:
  Password hiển thị rõ trên màn hình.
* Business Impact:
  Dễ lộ password khi share màn hình hoặc có người nhìn bên cạnh.
* Suggested Fix:
  Set `<Form.Control type="password" ... />`. Có thể thêm nút show/hide nếu cần.

## BUG-CR-07: Frontend báo lỗi tạo phòng quá chung chung
* Severity: Minor
* Area: Frontend / UX
* Location: `frontend/src/pages/room/CreateRoomPage.tsx:33`
* Description:
  `onError` luôn hiển thị `Could not create room`. Nếu backend trả lỗi password quá ngắn, judgeCount sai, validation fail, hoặc lỗi permission, user không biết cần sửa gì.
* Reproduction Steps:
  1. Submit form với input không hợp lệ, hoặc gửi request bị backend reject.
  2. Quan sát toast lỗi.
* Expected:
  User thấy message cụ thể từ backend, ví dụ password length hoặc judge count.
* Actual:
  User chỉ thấy lỗi chung chung.
* Business Impact:
  Người dùng khó tự sửa form; QA/debug cũng mất thời gian hơn.
* Suggested Fix:
  Lấy `error.response.data.message` hoặc lỗi đầu tiên trong `error.response.data.errors[]` để hiển thị.

## BUG-CR-08: Title có thể là toàn khoảng trắng hoặc chưa trim
* Severity: Minor
* Area: Backend / Data Quality
* Location: `backend/src/features/room/room.routes.ts:604`, `backend/src/features/room/room.routes.ts:611`, `backend/src/features/room/room.schema.ts:20`, `frontend/src/pages/room/CreateRoomPage.tsx:60`
* Description:
  Frontend có `required`, nhưng HTML required vẫn cho qua chuỗi toàn khoảng trắng. Backend lại không dùng `createRoomSchema`, nên title không được trim/validate ở API boundary.
* Reproduction Steps:
  1. Nhập title toàn dấu cách hoặc gọi API với `"title": "   "`.
  2. Tạo phòng.
  3. Kiểm tra title trên list/lobby.
* Expected:
  Backend reject title rỗng sau trim hoặc normalize thống nhất.
* Actual:
  Có thể lưu title nhìn như rỗng hoặc title chưa trim.
* Business Impact:
  Room list/lobby có thể hiển thị phòng không tên hoặc tên bẩn.
* Suggested Fix:
  Dùng `validate(createRoomSchema)` và chỉnh schema để trim trước khi check min length. Frontend có thể trim trước submit, nhưng backend vẫn phải là source of truth.

## Ghi chú

Build pass, nên các lỗi trên là lỗi runtime/business/security, không phải lỗi compile TypeScript.

Thứ tự fix khuyến nghị:
1. Sửa contract schema: thêm `motion`, sau đó gắn `validate(createRoomSchema)` vào `POST /rooms/create`.
2. Sanitize response tạo phòng để không trả `password`.
3. Quyết định rõ private room password là password thật hay access code; nếu là password thì hash.
4. Sửa frontend: mask password và hiển thị lỗi backend cụ thể.

---

# Kiểm tra bổ sung theo danh sách nghi ngờ CR-09 đến CR-18

Ngày kiểm tra: 2026-07-07.

Kết luận nhanh:
- Còn tái hiện: BUG-CR-09, BUG-CR-18, BUG-CR-14, BUG-CR-12, BUG-CR-13, BUG-CR-11, BUG-CR-10.
- Không còn tái hiện trong code hiện tại: BUG-CR-16, BUG-CR-17.

## Critical Bugs (Flow-blocking / Data Loss)

### BUG-CR-09: `currentTurn.status = 'transition'` vi phạm enum Mongoose, có thể làm hỏng toàn bộ phase transition
* Severity: Critical
* Area: Backend / State Machine
* Location: `backend/src/models/DebateSession.ts:31`, `backend/src/features/debate/debate.service.ts:654`
* Description:
  Schema `DebateSession.currentTurn.status` chỉ cho phép `active`, `paused`, `completed`, `waiting_to_start`, nhưng `triggerTransition()` lại set status thành `transition` rồi gọi `preSession.save()`.
* Reproduction Steps:
  1. Tạo room và start debate.
  2. Đi tới một phase speech/cross-exam.
  3. Host hoặc speaker bấm end/skip phase để gọi `triggerTransition()`.
  4. Quan sát backend log/API/socket khi session được save.
* Expected:
  Status được set bằng một giá trị hợp lệ trong enum hoặc schema phải khai báo thêm `transition`.
* Actual:
  Code set giá trị ngoài enum là `transition`, có nguy cơ làm Mongoose validation fail và chặn phase transition.
* Business Impact:
  Debate có thể bị kẹt giữa phase, timer/socket state không chuyển tiếp, người dùng phải refresh hoặc bỏ room.
* Suggested Fix:
  Thêm `transition` vào enum nếu đây là state hợp lệ, hoặc đổi sang một field riêng như `isTransitioning`/`transitionLock` để tránh phá contract của `currentTurn.status`.

### BUG-CR-18: No-Host + Human Judge không usable vì judge không bao giờ có `speakerSlot = 'S1'`
* Severity: Critical
* Area: Backend / Frontend / Business Logic / Permission
* Location: `backend/src/features/debate/debate.service.ts:366`, `backend/src/features/debate/debate.service.ts:503`, `backend/src/features/room/room.routes.ts:812`, `frontend/src/pages/room/LobbyPage.tsx:136`, `frontend/src/pages/room/LobbyPage.tsx:485`
* Description:
  No-host + human judge yêu cầu judge có `speakerSlot === 'S1'` để start/control debate. Tuy nhiên luồng assign role hiện tại chỉ gửi `speakerSlot` khi role là `debater`; khi assign judge thì frontend gửi `speakerSlot: null`, backend cũng ép `participant.speakerSlot = null`.
* Reproduction Steps:
  1. Tạo room mode `hostType = no_host`, `judgeType = human`.
  2. Assign một account làm judge.
  3. Thử start debate bằng judge đó.
  4. Kiểm tra participant của judge trong room state.
* Expected:
  No-host + human judge phải có một judge được đánh dấu controller hợp lệ, ví dụ Judge S1 hoặc một field quyền riêng.
* Actual:
  Judge không thể nhận `speakerSlot = 'S1'`, nên điều kiện permission không bao giờ đạt.
* Business Impact:
  Cả mode No-Host + Human Judge bị kẹt ở lobby, không start được debate theo rule hiện tại.
* Suggested Fix:
  Không dùng `speakerSlot` của debater để phân quyền judge. Thêm field rõ ràng như `judgeSlot`, `isPrimaryJudge`, hoặc tự động set primary judge khi assign judge trong no-host mode.

## Major Bugs

### BUG-CR-14: Auto-complete human-judge đang hardcode theo `OPP_S3`, không khớp luồng 1v1
* Severity: Major
* Area: Backend / Frontend / Business Logic / Scoring
* Location: `backend/src/features/room/room.routes.ts:1662`, `backend/src/features/room/room.routes.ts:1876`, `backend/src/features/debate/debate.routes.ts:525`, `frontend/src/pages/debate/DebateRoomPage.tsx:2478`, `frontend/src/components/debate/RoundJudgeForm.tsx:220`
* Description:
  Logic auto-complete của human judge đang dựa vào speaker cuối là `OPP_S3`. Trong khi helper scoring/expected speakers của 1v1 không thống nhất: backend có nơi coi 1v1 chỉ cần `PRO_S1`/`OPP_S1`, frontend lại vẫn sinh `PRO_S2`/`OPP_S2`/`PRO_S3`/`OPP_S3` theo round.
* Reproduction Steps:
  1. Tạo room 1v1 với human judge.
  2. Chạy đủ 3 round và submit score qua các form/endpoint hiện có.
  3. Kiểm tra khi nào session chuyển `completed`.
  4. So sánh speaker được frontend submit với expected speakers backend.
* Expected:
  Điều kiện complete phải dựa trên format thực tế của room và danh sách speaker/round hợp lệ.
* Actual:
  Backend có nhiều chỗ hardcode `OPP_S3` làm tín hiệu cuối debate; với 1v1 điều này dễ khiến debate không complete hoặc complete theo pseudo-speaker không đúng contract.
* Business Impact:
  Room 1v1 human judge có thể kẹt ở scoring/final judging hoặc lưu điểm vào speaker không đúng nghiệp vụ.
* Suggested Fix:
  Tạo một hàm duy nhất xác định final scoring unit theo `room.format` và phase/round hiện tại. Cả legacy endpoint, round-score endpoint và frontend phải dùng cùng contract.

### BUG-CR-12: Kick trong active debate thiếu socket event, user bị kick vẫn có thể ở lại debate page
* Severity: Major
* Area: Backend / Socket / Realtime UX
* Location: `backend/src/features/room/room.routes.ts:1229`, `backend/src/features/room/room.routes.ts:1393`, `backend/src/features/debate/debate.routes.ts:430`
* Description:
  Các route kick chỉ remove participant và trả response HTTP. Route lobby có broadcast room state, nhưng không có event targeted như `room:kicked`; các route kick trong active debate không emit socket event để frontend redirect/clear state cho user bị kick.
* Reproduction Steps:
  1. User B join room và mở debate page.
  2. Host kick User B trong lúc debate đang active.
  3. Quan sát client của User B.
* Expected:
  User bị kick nhận event rõ ràng, rời socket room, clear local debate state và redirect khỏi debate page.
* Actual:
  User bị kick có thể tiếp tục nhìn thấy trang debate/state cũ cho tới khi refresh hoặc gọi API mới bị reject.
* Business Impact:
  UI desync, quyền truy cập nhìn như vẫn còn hợp lệ, dễ gây nhầm lẫn trong phiên debate realtime.
* Suggested Fix:
  Khi kick, emit event targeted tới socket của user bị kick, ví dụ `room:kicked`/`debate:kicked`, sau đó broadcast room/debate state mới cho các user còn lại.

### BUG-CR-13: Các kick route không validate `userId` bằng Zod
* Severity: Major
* Area: Backend / Validation / Reliability
* Location: `backend/src/features/room/room.routes.ts:1235`, `backend/src/features/room/room.routes.ts:1397`, `backend/src/features/debate/debate.routes.ts:434`
* Description:
  Các route kick đọc trực tiếp `const { userId } = req.body` mà không validate type, required field, hoặc ObjectId format. Request thiếu/sai `userId` có thể no-op, trả response không rõ ràng, hoặc gây lỗi runtime khi logic mở rộng.
* Reproduction Steps:
  1. Gọi kick endpoint với body `{}`.
  2. Gọi tiếp với `{"userId": null}` hoặc một object thay vì string.
  3. Kiểm tra response và room state.
* Expected:
  Backend reject sớm với 400 và message validation rõ ràng.
* Actual:
  Code đi thẳng vào business logic với dữ liệu không hợp lệ.
* Business Impact:
  API contract yếu, khó debug khi client gửi sai payload, dễ sinh trạng thái không đổi nhưng user tưởng đã kick thành công.
* Suggested Fix:
  Thêm schema như `z.object({ userId: z.string().regex(/^[a-f\\d]{24}$/i) })` hoặc helper ObjectId chung, rồi gắn `validate()` cho mọi kick route.

### BUG-CR-11: `PUT /:id` update room có thể leak password trong response
* Severity: Major
* Area: Backend / Security / Data Exposure
* Location: `backend/src/features/room/room.routes.ts:692`, `backend/src/features/room/room.routes.ts:736`, `backend/src/middleware/roomGuard.ts:111`
* Description:
  Route update room dùng `roomOwnerGuard`; guard load room bằng `.select('+password')`. Sau khi update, route trả thẳng `sendSuccess(res, room, 'Room updated')`, nên private room password có thể nằm trong response.
* Reproduction Steps:
  1. Tạo private room có password.
  2. Owner gọi `PUT /api/v1/rooms/:id` để update title hoặc field bất kỳ.
  3. Kiểm tra JSON response.
* Expected:
  Response không bao giờ trả password/access code.
* Actual:
  Raw room document có nguy cơ chứa `password` vì guard đã select field này.
* Business Impact:
  Lộ password room qua network tab/log client, đặc biệt nguy hiểm nếu team coi đây là password thật chứ không chỉ access code.
* Suggested Fix:
  Sanitize response trước khi trả, hoặc query lại room public projection sau save. Có thể dùng helper `sanitizeRoom(room)` dùng chung cho create/update/get.

### BUG-CR-10: `updateRoomSchema` thiếu field mà route handler destructure, tạo dead code và sai contract update room
* Severity: Major
* Area: Backend / API Contract / Business Logic
* Location: `backend/src/features/room/room.schema.ts:69`, `backend/src/features/room/room.routes.ts:693`
* Description:
  `updateRoomSchema` chỉ khai báo `title`, `judgeCount`, `viewerChatEnabled`, `isPrivate`, `password`, nhưng route handler lại destructure thêm `format`, `hostType`, `judgeType`, `motion`. Vì middleware `validate(updateRoomSchema)` thường strip unknown keys, các field này sẽ không bao giờ tới handler.
* Reproduction Steps:
  1. Gọi `PUT /api/v1/rooms/:id` với body có `format`, `hostType`, `judgeType`, hoặc `motion`.
  2. Kiểm tra `req.body` sau validate và room sau update.
* Expected:
  Nếu route support update các field này thì schema phải khai báo và validate chúng. Nếu không support thì handler không nên có dead code.
* Actual:
  Handler có code update các field nhưng schema chặn payload trước đó.
* Business Impact:
  Frontend/team khác có thể tưởng API update được format/mode/motion nhưng thực tế không update, gây lệch expectation và lỗi khó debug.
* Suggested Fix:
  Đồng bộ schema với handler. Nếu cho update, thêm enum/validation cho `format`, `hostType`, `judgeType`, `motion`; nếu không cho update, xóa destructuring/dead code và document rõ field immutable.

## Đã kiểm tra nhưng không còn tái hiện trong code hiện tại

### BUG-CR-16: `computeAIFeedbackAndFinalize` overwrite `judgeVerdicts: []`
* Status: Không còn tái hiện trong working tree hiện tại
* Area: Backend / Scoring / AI Judge
* Location checked: `backend/src/features/debate/debate.service.ts:1133`, `backend/src/features/debate/debate.service.ts:1150`
* Verification:
  Hàm `computeAIFeedbackAndFinalize()` hiện có comment `Preserve existing judge verdicts` và lấy `existingVerdicts` từ `session.finalScores.judgeVerdicts`, sau đó gán lại `judgeVerdicts: existingVerdicts`. Không thấy đoạn overwrite `judgeVerdicts: []` trong hàm này.
* Risk:
  Vẫn nên giữ test regression cho No-Host + AI Judge để đảm bảo per-round scores không bị wipe khi finalize.

### BUG-CR-17: Surrender/draw overwrite score thật bằng dummy `100/0/50`
* Status: Không còn tái hiện trong working tree hiện tại
* Area: Backend / Scoring / Completion
* Location checked: `backend/src/features/debate/debate.service.ts`, các hàm `completeDebateWithWinner`, `surrenderDebate`, `requestDraw`
* Verification:
  `completeDebateWithWinner()` hiện giữ lại `existing.teamProposition` và `existing.teamOpposition` nếu đã có, chỉ cập nhật winner/completion reason. Không thấy logic ghi đè score bằng dummy `100/0/50`.
* Risk:
  Nên thêm test regression cho surrender và draw sau khi đã có judge scores để chắc chắn aggregate score không bị mất.
