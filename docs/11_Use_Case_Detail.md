# 11 — Use Case Detail (Chi tiết từng UC)

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** Đặc tả chi tiết — bổ sung cho [05_Use_Cases.md](./05_Use_Cases.md)  
**Tham chiếu:** [01_Debate_Rule](./01_Debate_Rule.md) · [02_Matchmaking](./02_Matchmaking_Room_System.md) · [03_Role_System](./03_Role_System.md) · [04_TRD](./04_TRD_Technical_Requirements.md) · [10_Idea](./10_Idea_Build_Community.md)

> **⚠️ LƯU Ý (v1.1 — 18/05/2026):** File này vẫn dùng hệ thống đánh số UC cũ (110 UC). Phạm vi MVP đã được rút gọn xuống **66 UC** — xem [05_Use_Cases.md](./05_Use_Cases.md) v1.1 để biết danh mục UC mới. Các UC thuộc Phase 2 (Knowledge, Tournament bracket, Community feed, AI Host, Portfolio...) trong file này chỉ mang tính tham khảo, không triển khai trong MVP.

> File này mô tả **đầy đủ** 110 use case (UC-01 → UC-110). Danh mục tóm tắt và luồng tổng hợp xem tại [05_Use_Cases.md](./05_Use_Cases.md).

---

## Mục lục

- [A. Xác thực (UC-01–09)](#a-xác-thực-uc-0109)
- [B. Hồ sơ & Portfolio (UC-10–18)](#b-hồ-sơ--portfolio-uc-1018)
- [C. Matchmaking & Phòng (UC-19–34)](#c-matchmaking--phòng-uc-1934)
- [D. Động cơ Debate (UC-35–52)](#d-động-cơ-debate-uc-3552)
- [E. Host điều phối (UC-53–59)](#e-host-điều-phối-uc-5359)
- [F. Chấm điểm & Kết quả (UC-60–64)](#f-chấm-điểm--kết-quả-uc-6064)
- [G. Realtime (UC-65–70)](#g-realtime-uc-6570)
- [H. AI (UC-71–82)](#h-ai-uc-7182)
- [I. Xếp hạng & Credibility (UC-83–88)](#i-xếp-hạng--credibility-uc-8388)
- [J. Tri thức (UC-89–94)](#j-tri-thức-uc-8994)
- [K. Arena & Cộng đồng (UC-95–100)](#k-arena--cộng-đồng-uc-95100)
- [L. Giải đấu (UC-101–106)](#l-giải-đấu-uc-101106)
- [M. Quản trị (UC-107–110)](#m-quản-trị-uc-107110)

**Quy ước ưu tiên:** `MVP-M` = bắt buộc MVP · `MVP-S` = nên có MVP · `P2` = phase 2

---

## A. Xác thực (UC-01–09)

### UC-01 — Đăng ký tài khoản

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-M |
| **Actor** | Guest |
| **Mô tả** | Người chưa có tài khoản tạo tài khoản để tham gia nền tảng tranh biện. |
| **Mục tiêu** | Có danh tính hệ thống, ELO khởi tạo, có thể đăng nhập và vào queue/phòng. |

**Tiền điều kiện:** Chưa đăng nhập; email/username chưa tồn tại trong hệ thống.

**Hậu điều kiện:** Bản ghi `User` được tạo; `role` mặc định `debater`; ELO/tier khởi tạo theo TRD; client nhận access + refresh token (hoặc cookie refresh).

**Luồng chính**
1. Guest mở trang `/register`.
2. Nhập username, email, password (và xác nhận password nếu có).
3. FE validate (Zod); gửi `POST /api/v1/auth/register`.
4. BE validate, hash password (bcrypt), lưu user.
5. Phát JWT; redirect dashboard hoặc onboarding.

**Luồng thay thế**
- Email/username trùng → `400` + thông báo field.
- Password không đạt policy → lỗi validation.
- Lỗi server → `500`, không tạo user trùng lặp.

**Quy tắc nghiệp vụ:** Một email = một tài khoản; username unique.

**UC liên quan:** UC-02, UC-08

**Kỹ thuật:** `POST /api/v1/auth/register` — [04_TRD §7](./04_TRD_Technical_Requirements.md)

---

### UC-02 — Đăng nhập

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-M |
| **Actor** | Guest / User |
| **Mô tả** | Xác thực danh tính và mở phiên làm việc. |
| **Mục tiêu** | Truy cập các chức năng yêu cầu đăng nhập (queue, tạo phòng, profile). |

**Tiền điều kiện:** Có tài khoản hợp lệ; chưa bị ban vĩnh viễn.

**Hậu điều kiện:** Access token hợp lệ; refresh token lưu an toàn (httpOnly cookie hoặc secure storage).

**Luồng chính**
1. Nhập email/username + password.
2. `POST /api/v1/auth/login`.
3. BE xác thực bcrypt; phát token.
4. Client lưu token; gọi `GET /api/v1/auth/me` (UC-08).

**Luồng thay thế**
- Sai mật khẩu → `401`, không tiết lộ user tồn tại hay không.
- Tài khoản bị ban → `403` + lý do (nếu policy cho phép).

**UC liên quan:** UC-03, UC-04, UC-08, UC-09

**Kỹ thuật:** `POST /api/v1/auth/login`

---

### UC-03 — Đăng xuất

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Kết thúc phiên làm việc an toàn. |
| **Mục tiêu** | Thu hồi quyền truy cập trên thiết bị hiện tại. |

**Tiền điều kiện:** Đã đăng nhập.

**Hậu điều kiện:** Refresh token vô hiệu (blacklist hoặc xóa); client xóa access token; socket disconnect nếu đang trong phòng.

**Luồng chính:** User bấm Đăng xuất → `POST /api/v1/auth/logout` → xóa token local → redirect landing/login.

**Luồng thay thế:** Mất mạng khi logout → client vẫn xóa token local; lần refresh sau sẽ fail.

**UC liên quan:** UC-65 (disconnect socket)

**Kỹ thuật:** `POST /api/v1/auth/logout`

---

### UC-04 — Làm mới access token

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Gia hạn phiên khi access token hết hạn mà refresh còn hợp lệ. |
| **Mục tiêu** | Không bắt user đăng nhập lại liên tục trong trận dài. |

**Tiền điều kiện:** Refresh token còn hiệu lực; chưa logout.

**Hậu điều kiện:** Access token mới; (tuỳ chọn) refresh token rotation.

**Luồng chính:** Interceptor FE phát hiện `401` → `POST /api/v1/auth/refresh-token` → cập nhật header → retry request.

**Luồng thay thế:** Refresh hết hạn → buộc UC-02.

**UC liên quan:** UC-02, UC-09

**Kỹ thuật:** `POST /api/v1/auth/refresh-token`

---

### UC-05 — Quên mật khẩu

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-S |
| **Actor** | Guest / User |
| **Mô tả** | Khởi tạo luồng khôi phục mật khẩu qua email. |
| **Mục tiêu** | User lấy lại quyền truy cập khi quên mật khẩu. |

**Tiền điều kiện:** Email đã đăng ký (phản hồi chung để tránh enumerate).

**Hậu điều kiện:** Token reset one-time được tạo (TTL ngắn); email gửi link reset.

**Luồng chính:** Nhập email → BE tạo token reset → gửi email → thông báo “nếu email tồn tại, đã gửi hướng dẫn”.

**Luồng thay thế:** Email không tồn tại → vẫn trả message giống (bảo mật).

**UC liên quan:** UC-06

---

### UC-06 — Đặt lại mật khẩu

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-S |
| **Actor** | Guest / User |
| **Mô tả** | Đặt mật khẩu mới bằng token từ email UC-05. |
| **Mục tiêu** | Khôi phục đăng nhập. |

**Tiền điều kiện:** Token reset hợp lệ, chưa hết hạn, chưa dùng.

**Hậu điều kiện:** Password mới hash; token reset vô hiệu; (tuỳ chọn) invalidate mọi refresh token cũ.

**Luồng chính:** Mở link email → form mật khẩu mới → validate → lưu → redirect login.

**Luồng thay thế:** Token hết hạn → yêu cầu UC-05 lại.

**UC liên quan:** UC-05, UC-02

---

### UC-07 — Đổi mật khẩu

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | User đã đăng nhập đổi mật khẩu khi biết mật khẩu cũ. |
| **Mục tiêu** | Bảo mật tài khoản chủ động. |

**Tiền điều kiện:** Đã đăng nhập.

**Hậu điều kiện:** Mật khẩu mới có hiệu lực; session hiện tại giữ hoặc buộc login lại (policy).

**Luồng chính:** Settings → nhập old + new password → `PUT /api/v1/auth/change-password` → thông báo thành công.

**Luồng thay thế:** Sai mật khẩu cũ → `400`.

**Kỹ thuật:** `PUT /api/v1/auth/change-password`

---

### UC-08 — Lấy thông tin phiên (me)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Lấy profile và metadata user đang đăng nhập. |
| **Mục tiêu** | Hydrate UI (tên, avatar, ELO, role hệ thống). |

**Tiền điều kiện:** Access token hợp lệ.

**Hậu điều kiện:** Client có object user đầy đủ cho navbar, phòng, queue.

**Luồng chính:** App load → `GET /api/v1/auth/me` → lưu store (Zustand).

**Luồng thay thế:** Token invalid → UC-04 hoặc UC-02.

**UC liên quan:** UC-02, UC-10

**Kỹ thuật:** `GET /api/v1/auth/me`

---

### UC-09 — JWT & phân quyền API (RBAC)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xác thực |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Middleware xác thực JWT và kiểm tra role/route trên mọi API bảo vệ. |
| **Mục tiêu** | Chỉ actor hợp lệ thực hiện hành động (debater không gọi API Host). |

**Tiền điều kiện:** Request có header `Authorization: Bearer`.

**Hậu điều kiện:** Request được gắn `req.user`; hoặc `401`/`403`.

**Luồng chính:** Verify JWT → load user → check role (`debater`, `admin`, …) → check quyền trong phòng (room role) nếu API room-scoped.

**Quy tắc nghiệp vụ:** Role hệ thống ≠ role trong phòng; API Host yêu cầu `roomRole === host` — [03_Role_System](./03_Role_System.md).

**UC liên quan:** Tất cả UC API

**Kỹ thuật:** Middleware auth + room permission — [04_TRD](./04_TRD_Technical_Requirements.md)

---

## B. Hồ sơ & Portfolio (UC-10–18)

### UC-10 — Xem hồ sơ công khai

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | MVP-M |
| **Actor** | Guest / User |
| **Mô tả** | Xem trang profile công khai của user khác (hoặc chính mình). |
| **Mục tiêu** | Tra cứu đối thủ, thành tích trước khi thách đấu. |

**Tiền điều kiện:** User ID tồn tại; profile không bị ẩn (policy).

**Hậu điều kiện:** Hiển thị displayName, avatar, ELO, tier, stats tóm tắt.

**Luồng chính:** Mở `/users/:id` → `GET /api/v1/users/:id` → render.

**UC liên quan:** UC-13, UC-18

**Kỹ thuật:** `GET /api/v1/users/:id`

---

### UC-11 — Cập nhật hồ sơ

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Chỉnh sửa thông tin hiển thị công khai. |
| **Mục tiêu** | Cá nhân hóa danh tính trên nền tảng. |

**Tiền điều kiện:** Đăng nhập; chỉ sửa profile của chính mình (hoặc admin).

**Hậu điều kiện:** DB cập nhật displayName, bio, school, v.v.

**Luồng chính:** Form settings → validate → `PUT /api/v1/users/:id/profile`.

**Luồng thay thế:** Field không hợp lệ → lỗi validation.

**Kỹ thuật:** `PUT /api/v1/users/:id/profile`

---

### UC-12 — Tải / cập nhật avatar

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Upload ảnh đại diện. |
| **Mục tiêu** | Nhận diện trực quan trong phòng và leaderboard. |

**Tiền điều kiện:** Đăng nhập; file đúng định dạng/kích thước.

**Hậu điều kiện:** URL avatar mới (storage/CDN).

**Luồng chính:** Chọn file → upload → BE lưu → cập nhật user.avatarUrl.

**Luồng thay thế:** File quá lớn / sai MIME → từ chối.

---

### UC-13 — Xem thống kê trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | MVP-M |
| **Actor** | Guest / User |
| **Mô tả** | Xem W/L, tổng trận, điểm trung bình theo tiêu chí BGK. |
| **Mục tiêu** | Đánh giá trình độ nhanh. |

**Tiền điều kiện:** User có ít nhất 0 trận (hiển thị 0 nếu mới).

**Hậu điều kiện:** Dashboard stats render.

**Luồng chính:** `GET /api/v1/users/:id/stats` → hiển thị cards/biểu đồ đơn giản.

**UC liên quan:** UC-64, UC-16

**Kỹ thuật:** `GET /api/v1/users/:id/stats`

---

### UC-14 — Xem lịch sử tranh biện

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Danh sách các phiên debate đã tham gia. |
| **Mục tiêu** | Xem lại motion, kết quả, vai trò (Pro/Opp, S1–S3). |

**Tiền điều kiện:** Đăng nhập (lịch sử riêng) hoặc public list (policy).

**Hậu điều kiện:** Pagination danh sách session.

**Luồng chính:** Tab History → query sessions by userId → link tới replay/thread (UC-96).

**UC liên quan:** UC-48, UC-96

---

### UC-15 — Tìm kiếm người dùng

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Tìm user theo username/displayName. |
| **Mục tiêu** | Mời vào phòng, challenge, xem profile. |

**Tiền điều kiện:** Đăng nhập (hoặc guest nếu cho phép).

**Hậu điều kiện:** Danh sách kết quả gợi ý.

**Kỹ thuật:** `GET /api/v1/users/search?q=`

---

### UC-16 — Digital Debate Portfolio

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Trang portfolio nâng cao: biểu đồ kỹ năng theo tiêu chí BGK (Logic, Rebuttal, CE, …). |
| **Mục tiêu** | Thể hiện năng lực lâu dài — [10 §3.1](./10_Idea_Build_Community.md). |

**Tiền điều kiện:** Đủ dữ liệu trận đã chấm (UC-60–63).

**Hậu điều kiện:** Biểu đồ radar/line theo thời gian; breakdown theo vai S1/S2/S3.

**Luồng chính:** Mở Portfolio → aggregate scores từ sessions → visualize.

**UC liên quan:** UC-13, UC-17, UC-48

---

### UC-17 — AI Certified Badges

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | P2 |
| **Actor** | System |
| **Mô tả** | Hệ thống tự trao badge khi đạt ngưỡng khách quan (Logic Master, Fallacy Resistant, …). |
| **Mục tiêu** | Gamification không phụ thuộc vote — [10 §3.2](./10_Idea_Build_Community.md). |

**Tiền điều kiện:** Job định kỳ hoặc trigger sau UC-48.

**Hậu điều kiện:** Badge gắn profile; thông báo UC-62 (nếu bật).

**Quy tắc nghiệp vụ:** Badge không thu hồi tự động trừ khi admin can thiệp.

**UC liên quan:** UC-73, UC-74, UC-16

---

### UC-18 — Xem portfolio người khác

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Hồ sơ |
| **Ưu tiên** | P2 |
| **Actor** | Guest / User |
| **Mô tả** | Xem portfolio công khai của debater khác. |
| **Mục tiêu** | Scout đối thủ trước giải đấu / challenge. |

**Tiền điều kiện:** Profile public; UC-16 đã triển khai.

**Hậu điều kiện:** Read-only view portfolio + badges.

**UC liên quan:** UC-10, UC-16, UC-100

---

## C. Matchmaking & Phòng (UC-19–34)

### UC-19 — Xếp hàng Rank (ELO)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Matchmaking |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | User vào hàng chờ ghép trận xếp hạng theo format **1v1** hoặc **3v3**. |
| **Mục tiêu** | Tìm đối thủ cân sức theo ELO — [02 §3](./02_Matchmaking_Room_System.md). |

**Tiền điều kiện:** Đăng nhập; không trong trận active; không bị ban; chọn đúng queue (1v1 vs 3v3 tách bảng).

**Hậu điều kiện:** Trạng thái `in_queue`; UI “đang tìm trận”; timeout policy (tuỳ chọn).

**Luồng chính**
1. Chọn mode 1v1 hoặc 3v3.
2. Xác nhận (hiển thị ELO hiện tại).
3. Gửi join queue (socket hoặc REST).
4. Chờ UC-20.

**Luồng thay thế**
- User hủy queue → rời hàng, không tạo room.
- Timeout không ghép được → thông báo + gợi ý mở rộng range ELO (P2).

**Quy tắc nghiệp vụ:** Một user chỉ một queue tại một thời điểm.

**UC liên quan:** UC-20, UC-64, UC-71, UC-72

---

### UC-20 — Ghép trận Rank

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Matchmaking |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Khi đủ người trong queue, hệ thống ghép cặp ELO và tạo room. |
| **Mục tiêu** | Bắt đầu trận rank không cần Owner người. |

**Tiền điều kiện:** ≥2 user (hoặc 2 đội 3v3) trong cùng queue phù hợp.

**Hậu điều kiện:** `Match` + `Room` tạo; **AI Host + AI BGK** gán mặc định; debater được assign Pro/Opp; redirect vào phòng.

**Luồng chính**
1. Matcher chọn cặp ELO gần nhất.
2. Tạo room `type: rank`, status `waiting` hoặc `active` theo flow.
3. Gán team Proposition / Opposition.
4. Push notification/socket cho cả hai phía.
5. Chuyển UC-35 (Motion) khi ready.

**Quy tắc nghiệp vụ:** Không có Room Owner người; điều phối = AI Host — [02 §6](./02_Matchmaking_Room_System.md).

**UC liên quan:** UC-19, UC-35, UC-71, UC-72, UC-64

---

### UC-21 — Tạo Custom Room

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Tạo phòng debate tùy chỉnh; user trở thành **Room Owner**. |
| **Mục tiêu** | Tổ chức trận tự do (1v1/3v3, Host/Judge human hoặc AI). |

**Tiền điều kiện:** Đăng nhập.

**Hậu điều kiện:** Room `waiting`; `createdBy` = Owner; Room ID; hiển thị Custom Live Matches.

**Luồng chính**
1. Mở “Tạo phòng”.
2. Chọn: Format (1v1/3v3), Host (Human/AI), Judge (Human 1|3 / AI 1), Privacy (Public/Password).
3. `POST /api/v1/rooms/create`.
4. Redirect lobby với quyền Owner.

**Cấu hình bắt buộc:** Xem [02 §4.1](./02_Matchmaking_Room_System.md).

**Luồng thay thế:** Validation fail → hiển thị lỗi field.

**UC liên quan:** UC-22, UC-25, UC-27–32

**Kỹ thuật:** `POST /api/v1/rooms/create`

---

### UC-22 — Chỉnh sửa cấu hình phòng (lobby)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Room Owner |
| **Mô tả** | Sửa cấu hình khi phòng còn `waiting`. |
| **Mục tiêu** | Điều chỉnh trước khi start mà không tạo phòng mới. |

**Tiền điều kiện:** Room `waiting`; actor = Owner.

**Hậu điều kiện:** Config cập nhật; participant nhận socket `room:config-updated`.

**Luồng chính:** Form edit → `PUT /api/v1/rooms/:id` → broadcast lobby.

**Luồng thay thế:** Room đã `active` → từ chối (chỉ Host điều phối trong trận).

**UC liên quan:** UC-21, UC-31

**Kỹ thuật:** `PUT /api/v1/rooms/:id`

---

### UC-23 — Chuyển Room Ownership

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-S |
| **Actor** | Room Owner |
| **Mô tả** | Chuyển quyền Owner cho user khác trong lobby. |
| **Mục tiêu** | Captain đội khác quản lý phòng khi người tạo rời. |

**Tiền điều kiện:** Room `waiting`; target user trong phòng; Owner xác nhận.

**Hậu điều kiện:** `createdBy` / ownerId đổi; UI cập nhật badge Owner.

**Luồng chính:** Owner chọn user → confirm → API transfer → notify lobby.

**UC liên quan:** UC-21, UC-34

---

### UC-24 — Hủy / xóa phòng (lobby)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Room Owner |
| **Mô tả** | Hủy phòng chưa bắt đầu hoặc kết thúc sớm (policy). |
| **Mục tiêu** | Giải phóng slot Live Matches. |

**Tiền điều kiện:** Owner; room `waiting` (hoặc Host kết thúc nếu `active` — UC-41).

**Hậu điều kiện:** Room `cancelled`/`deleted`; participant redirect.

**Kỹ thuật:** `DELETE /api/v1/rooms/:id`

---

### UC-25 — Duyệt Live Matches

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Community / Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Guest / User |
| **Mô tả** | Danh sách trận đang diễn ra / chờ — Community Live Matches. |
| **Mục tiêu** | Khám phá trận để xem hoặc join. |

**Tiền điều kiện:** Không bắt buộc đăng nhập để xem list (join có thể cần login).

**Hậu điều kiện:** Danh sách realtime cập nhật qua socket/polling.

**Luồng chính:** Mở `/live` → `GET /api/v1/rooms?status=active,waiting` → filter.

**Bộ lọc:** 1v1 / 3v3 · Rank / Custom · có/không password — [02 §2](./02_Matchmaking_Room_System.md).

**UC liên quan:** UC-26, UC-27

**Kỹ thuật:** `GET /api/v1/rooms`

---

### UC-26 — Xem trận (Viewer)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Viewer |
| **Mô tả** | Vào phòng ở vai trò khán giả, xem Main Room theo phase. |
| **Mục tiêu** | Spectator không ảnh hưởng luồng trận — [03 Viewer](./03_Role_System.md). |

**Tiền điều kiện:** Room public hoặc đã nhập đúng password (chỉ xem).

**Hậu điều kiện:** `roomRole: viewer`; nhận timer/phase; không mic speech.

**Luồng chính:** Từ Live Matches → “Xem” → join socket read-only → render Main Room.

**Luồng thay thế:** Phòng full viewer cap (nếu có) → từ chối.

**UC liên quan:** UC-65, UC-66, UC-95

---

### UC-27 — Join Custom Room

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Tham gia phòng custom, vào trạng thái `waiting` trong lobby. |
| **Mục tiêu** | Chiếm slot debater/judge/host hoặc viewer. |

**Tiền điều kiện:** Room tồn tại, chưa full; password đúng nếu có.

**Hậu điều kiện:** User trong `room.participants`; hiển thị lobby.

**Luồng chính:** Nhập Room ID / link → password (nếu có) → `POST /api/v1/rooms/:id/join` → lobby.

**Luồng thay thế:** Sai password → `403`; đã trong phòng khác → policy kick hoặc từ chối.

**UC liên quan:** UC-28, UC-31

**Kỹ thuật:** `POST /api/v1/rooms/:id/join`

---

### UC-28 — Select Position

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Chọn vị trí khi Owner bật Select Position. |
| **Mục tiêu** | Gán Pro/Opp, S1–S3, Judge, Host — [02 §4.3](./02_Matchmaking_Room_System.md). |

**Tiền điều kiện:** Room `waiting`; Select Position enabled; slot chưa bị lock.

**Hậu điều kiện:** `team` + `speakerSlot` hoặc `judge`/`host` được gán.

**Luồng chính:** Click slot trống trên sơ đồ phòng → chọn team/role → confirm → broadcast lobby.

**Quy tắc nghiệp vụ:** Không trùng slot; 1v1 một debater = S1+S2+S3; slot AI không cần người.

**UC liên quan:** UC-29, UC-31, UC-51

---

### UC-29 — Lock position

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Room Owner |
| **Mô tả** | Khóa vị trí đã chọn, không cho đổi trước trận. |
| **Mục tiêu** | Tránh tranh slot phút chót. |

**Tiền điều kiện:** Owner; lobby `waiting`.

**Hậu điều kiện:** Slot `locked`; user không đổi position (trừ Owner unlock).

**UC liên quan:** UC-28, UC-32

---

### UC-30 — Gán slot Host / Judge (human)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Room Owner |
| **Mô tả** | Owner chỉ định user cụ thể vào slot Host hoặc Judge human. |
| **Mục tiêu** | Tổ chức giải / trận có BGK người thật. |

**Tiền điều kiện:** Cấu hình phòng có slot human tương ứng.

**Hậu điều kiện:** User có `roomRole: host` hoặc `judge`.

**UC liên quan:** UC-21, UC-53, UC-60

---

### UC-31 — Lobby waiting → ready

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Host / Owner / System |
| **Mô tả** | Xác nhận đủ người/slot để sẵn sàng bắt đầu. |
| **Mục tiêu** | Chỉ Start khi điều kiện lobby thỏa. |

**Tiền điều kiện:** Đủ debater (và judge/host human nếu cấu hình); mọi slot bắt buộc đã fill.

**Hậu điều kiện:** Room `ready` (hoặc flag tương đương); nút Start enabled.

**Quy tắc nghiệp vụ:** Slot AI không tính vào số người cần join — [02 §4.2](./02_Matchmaking_Room_System.md).

**UC liên quan:** UC-32

---

### UC-32 — Start trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Room Owner / Host |
| **Mô tả** | Bắt đầu trận từ lobby. |
| **Mục tiêu** | Chuyển room `active`, khởi động debate engine. |

**Tiền điều kiện:** UC-31 thỏa; actor là Owner hoặc Host.

**Hậu điều kiện:** Phase `motion`; session debate tạo; timer authority server.

**Luồng chính:** Bấm Start → `POST /api/v1/rooms/:id/start` → UC-35.

**UC liên quan:** UC-35, UC-52

**Kỹ thuật:** `POST /api/v1/rooms/:id/start`

---

### UC-33 — Rời phòng

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Participant |
| **Mô tả** | User rời lobby hoặc trận (theo policy). |
| **Mục tiêu** | Giải phóng slot; xử lý forfeit nếu đang active. |

**Tiền điều kiện:** Đang trong phòng.

**Hậu điều kiện:** Xóa khỏi participants; socket leave; (active) có thể forfeit hoặc pause — policy phòng.

**Kỹ thuật:** `POST /api/v1/rooms/:id/leave`

---

### UC-34 — Kick / ban (lobby)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Phòng |
| **Ưu tiên** | MVP-M |
| **Actor** | Room Owner |
| **Mô tả** | Loại user khỏi phòng trước khi start (hoặc ban khỏi phòng này). |
| **Mục tiêu** | Kỷ luật lobby — [03 Owner](./03_Role_System.md). |

**Tiền điều kiện:** Owner; target không phải Owner; thường `waiting`.

**Hậu điều kiện:** User bị remove; (ban) không join lại được roomId này.

**UC liên quan:** UC-57 (Host kick trong trận)

---

## D. Động cơ Debate (UC-35–52)

### UC-35 — Motion Announcement

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Host / System |
| **Mô tả** | Công bố chủ đề tranh biện (motion) mở đầu trận. |
| **Mục tiêu** | Hai đội biết đề bài trước prep 7 phút — [01 §3](./01_Debate_Rule.md). |

**Tiền điều kiện:** Room `active`; phase bắt đầu.

**Hậu điều kiện:** `session.motion` lưu; UI hiển thị motion; chuyển UC-36.

**Luồng chính:** Host (hoặc AI Host) đọc/giới thiệu motion → BGK có thể nhận xét mở đầu → system set phase `prep_7`.

**UC liên quan:** UC-36, UC-71, UC-91

---

### UC-36 — Preparation 7 phút

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Debator, Host, Judge |
| **Mô tả** | Giai đoạn chuẩn bị 7 phút với Main Room + Private Room mỗi đội. |
| **Mục tiêu** | Đội lên chiến thuật, phân công speaker — [01 §4](./01_Debate_Rule.md). |

**Tiền điều kiện:** Motion đã công bố.

**Hậu điều kiện:** Timer 7' hết → UC-38.

**Luồng chính:** Host bắt đầu prep → debater vào private room (UC-37) → hết giờ → mời về Main.

**Quy tắc nghiệp vụ:** **7 phút**, không 15 phút — [02 §3.3](./02_Matchmaking_Room_System.md).

**UC liên quan:** UC-37, UC-38, UC-44

---

### UC-37 — Vào / rời Private Room đội mình

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Debator |
| **Mô tả** | Debater chỉ vào private channel của đội Pro hoặc Opp trong prep. |
| **Mục tiêu** | Trao đổi nội bộ không lộ cho đối phương. |

**Tiền điều kiện:** Phase `prep_7` hoặc `prep_1`; user là debater đội tương ứng.

**Hậu điều kiện:** Join socket room `private:pro` hoặc `private:opp`.

**Luồng thay thế:** Cố vào private đối phương → từ chối.

**UC liên quan:** UC-36, UC-44, UC-67

---

### UC-38 — Kết thúc prep → bắt đầu trận chính

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Host |
| **Mô tả** | Sau prep 7', Host mời hai đội về Main và bắt đầu lượt nói đầu tiên. |
| **Mục tiêu** | Chuyển sang Round 1 — Proposition S1 trước. |

**Hậu điều kiện:** Phase `speech`; `currentSpeaker` = Pro S1; UC-39 kích hoạt.

**UC liên quan:** UC-39, UC-40

---

### UC-39 — Speech (4 phút)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Host, Debator |
| **Mô tả** | Speaker phát biểu khi Host cho tín hiệu; timer **4 phút** chạy. |
| **Mục tiêu** | Đúng luật thời lượng — [01 §6](./01_Debate_Rule.md). |

**Tiền điều kiện:** Đúng lượt speaker; Host đã “cho phép bắt đầu”.

**Hậu điều kiện:** Speech kết thúc (hết giờ hoặc speaker dừng) → CE (nếu S1/S2) hoặc BGK (S3).

**Luồng chính:** Host signal → timer 4' → mic chỉ speaker → ghi transcript (UC-48).

**UC liên quan:** UC-40, UC-41, UC-43, UC-45, UC-73

---

### UC-40 — Luật lượt nói

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Engine enforce thứ tự: Pro S1 → Opp S1 → Pro S2 → Opp S2 → Pro S3 → Opp S3. |
| **Mục tiêu** | Không nhảy lượt trái luật. |

**Quy tắc nghiệp vụ:** Đội **Ủng hộ (Proposition)** luôn mở đầu mỗi round — [01 §5](./01_Debate_Rule.md).

**UC liên quan:** UC-52

---

### UC-41 — Cross Examination

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Debator |
| **Mô tả** | Chất vấn sau Speaker 1 & 2: Pass Turn / Finish, 3 phút/đội, tối đa 2 câu/đội. |
| **Mục tiêu** | Thay thế POI — đúng [01 §10](./01_Debate_Rule.md). |

**Luồng chính (5 bước):**
1. Host mở CE sau speech S1 hoặc S2.
2. Đội hỏi đặt câu (timer chỉ trừ khi đội mình active).
3. **Pass Turn** — chuyển quyền hỏi/trả lời.
4. Lặp tối đa 2 câu/đội.
5. **Finish** — kết thúc CE → UC-43.

**Luồng thay thế:** Hết 3 phút → auto Finish; câu hỏi không hợp lệ → UC-75 từ chối.

**Kỹ thuật:** `cross-exam:pass-turn`, `cross-exam:finish` — [08_Socket §2.4](./08_Socket_Realtime_Guide.md); `POST .../cross-exam/pass-turn|finish`

**UC liên quan:** UC-42, UC-75

---

### UC-42 — CE — phạt thiếu câu hỏi/trả lời

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Áp dụng hình phạt khi đội không dùng hết quota CE theo §10.3. |
| **Mục tiêu** | Công bằng thời gian hỏi đáp. |

**Hậu điều kiện:** Ghi log penalty; BGK có thể trừ điểm CE (UC-60).

**UC liên quan:** UC-41, UC-60

---

### UC-43 — BGK nhận xét sau mỗi speaker

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Judge (BGK) |
| **Mô tả** | Nhận xét 3–5 phút sau mỗi lượt speech (+ CE nếu có). |
| **Mục tiêu** | Phản hồi và chấm tạm — [01 §12](./01_Debate_Rule.md). |

**Tiêu chí (100):** Logic 30 · Rebuttal 20 · Evidence 15 · CE 15 · Strategy 10 · Communication 10.

**Hậu điều kiện:** Phase `judge_feedback` → sau đó UC-44.

**UC liên quan:** UC-44, UC-60, UC-61

---

### UC-44 — Prep 1 phút giữa các lượt

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Debator, System |
| **Mô tả** | Khoảng chuẩn bị ngắn trước speaker tiếp theo. |
| **Mục tiêu** | Đội huddle nhanh — [01 §8](./01_Debate_Rule.md). |

**UC liên quan:** UC-37, UC-39

---

### UC-45 — Closing (Speaker 3)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Debator, System |
| **Mô tả** | Pro S3 và Opp S3 tổng kết; **không** CE; **không** luận điểm mới. |
| **Mục tiêu** | Closing đúng luật — [01 §9](./01_Debate_Rule.md). |

**UC liên quan:** UC-49, UC-46

---

### UC-46 — Final Judging

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Judge (BGK) |
| **Mô tả** | BGK chốt điểm và verdict cuối trận. |
| **Mục tiêu** | Kết quả chính thức trước công bố. |

**UC liên quan:** UC-47, UC-60–63

---

### UC-47 — Công bố đội thắng / hòa

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Host, BGK |
| **Mô tả** | Host/BGK công bố Proposition thắng, Opposition thắng, hoặc hòa. |
| **Mục tiêu** | Kết thúc trải nghiệm trận rõ ràng. |

**UC liên quan:** UC-63, UC-64, UC-96

---

### UC-48 — Lưu phiên completed + transcript

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Persist session, speeches, scores, transcript khi trận kết thúc. |
| **Mục tiêu** | Replay, lịch sử, AI phân tích sau trận. |

**Hậu điều kiện:** `session.status = completed`; UC-14, UC-96 có thể chạy.

**Kỹ thuật:** `GET /api/v1/rooms/:id/session`

**UC liên quan:** UC-14, UC-96

---

### UC-49 — Ghi nhận luận điểm mới (S3)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-S |
| **Actor** | System, Host |
| **Mô tả** | Phát hiện claim/framework/impact mới ở Speaker 3 — cảnh báo hoặc log. |
| **Mục tiêu** | Enforce §11 — [01_Debate_Rule.md](./01_Debate_Rule.md). |

**UC liên quan:** UC-45, UC-73, UC-74

---

### UC-50 — Host điều phối thời gian dư

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-S |
| **Actor** | Host |
| **Mô tả** | Dùng thời gian trống tương tác khán giả / recap (không phá phase). |
| **Mục tiêu** | Trải nghiệm show chuyên nghiệp. |

---

### UC-51 — 1v1 — một debater giữ S1+S2+S3

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | Debator |
| **Mô tả** | Ở format 1v1, một người phát biểu cả ba lượt cho đội. |
| **Mục tiêu** | Giữ nguyên timeline phase như 3v3 — [01 §1](./01_Debate_Rule.md). |

**UC liên quan:** UC-28, UC-40

---

### UC-52 — Orchestration luồng 25 bước

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Debate Engine |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | State machine điều phối toàn bộ trận theo [01 §15](./01_Debate_Rule.md). |
| **Mục tiêu** | Một nguồn sự thật phase/timer trên server. |

**Tóm tắt:** Motion → Prep 7' → (Pro S1 → CE → BGK → prep 1') → (Opp S1 → …) → Round 2 tương tự S2 → Pro S3 → Opp S3 → Final Judging → completed.

**UC liên quan:** UC-35–48, UC-66

---

## E. Host điều phối (UC-53–59)

### UC-53 — Tạm dừng / tiếp tục trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-M |
| **Actor** | Host |
| **Mô tả** | Pause/resume timer và phase khi sự cố kỹ thuật hoặc kỷ luật. |
| **Mục tiêu** | Kiểm soát trận — [03 §4](./03_Role_System.md). |

**Kỹ thuật:** `POST .../host/pause`, `.../host/resume`

**UC liên quan:** UC-66

---

### UC-54 — Chuyển lượt thủ công / ghi đè timer

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-S |
| **Actor** | Host |
| **Mô tả** | Host ép chuyển phase hoặc điều chỉnh thời gian còn lại. |
| **Mục tiêu** | Xử lý edge case; ghi audit log. |

**Kỹ thuật:** `POST .../host/next-turn`

---

### UC-55 — Phát thẻ vàng

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-M |
| **Actor** | Host |
| **Mô tả** | Cảnh cáo vi phạm (thời gian, thái độ, luật). |
| **Mục tiêu** | Kỷ luật có bậc. |

**Kỹ thuật:** `POST .../host/issue-card` (type: yellow)

**UC liên quan:** UC-56

---

### UC-56 — Phát thẻ đỏ

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-M |
| **Actor** | Host |
| **Mô tả** | Truất quyền phát biểu hoặc loại khỏi lượt hiện tại. |
| **Mục tiêu** | Xử lý vi phạm nghiêm trọng. |

**UC liên quan:** UC-55, UC-57

---

### UC-57 — Kick / mute / cấm chat

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-M |
| **Actor** | Host |
| **Mô tả** | Loại user khỏi phòng đang active hoặc mute mic/chat. |
| **Mục tiêu** | An toàn phòng realtime. |

**Kỹ thuật:** `POST .../host/kick`

**UC liên quan:** UC-34, UC-67

---

### UC-58 — Bật/tắt chat Viewer

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-S |
| **Actor** | Host |
| **Mô tả** | Cấu hình viewer có được chat trong Main Room hay không. |
| **Mục tiêu** | Giảm nhiễu khi trận nghiêm túc. |

---

### UC-59 — Chuyển quyền Host (human)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Host |
| **Ưu tiên** | MVP-S |
| **Actor** | Host, Owner |
| **Mô tả** | Chuyển vai Host sang user khác khi Host human rời. |
| **Mục tiêu** | Trận không bị kẹt khi Host disconnect. |

**UC liên quan:** UC-30, UC-71

---

## F. Chấm điểm & Kết quả (UC-60–64)

### UC-60 — Judge (human) nộp điểm

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Chấm điểm |
| **Ưu tiên** | MVP-M |
| **Actor** | Judge |
| **Mô tả** | BGK người nhập điểm theo 6 tiêu chí §13. |
| **Mục tiêu** | Kết quả human-in-the-loop cho custom room. |

**Kỹ thuật:** `POST .../judge/submit-score`

**UC liên quan:** UC-62, UC-63

---

### UC-61 — AI BGK chấm tạm sau mỗi lượt

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Chấm điểm |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | AI Judge phát nhận xét + điểm tạm sau speech/CE. |
| **Mục tiêu** | Rank mode mặc định — UC-72. |

**UC liên quan:** UC-43, UC-72, UC-77

---

### UC-62 — Tổng hợp điểm nhiều judge + AI

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Chấm điểm |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Aggregate khi có 3 judge human hoặc AI+human. |
| **Mục tiêu** | Một verdict thống nhất (trung bình có trọng số — policy). |

**UC liên quan:** UC-63

---

### UC-63 — Xác định winner

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Chấm điểm |
| **Ưu tiên** | MVP-M |
| **Actor** | System, BGK |
| **Mô tả** | So sánh tổng điểm Proposition vs Opposition. |
| **Mục tiêu** | `winnerTeam`: proposition | opposition | draw |

**UC liên quan:** UC-47, UC-64

---

### UC-64 — Cập nhật ELO sau trận Rank

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Chấm điểm |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Tính ELO mới cho participant sau trận `type: rank`. |
| **Mục tiêu** | Xếp hạng công bằng — công thức TRD. |

**Tiền điều kiện:** Session completed; có winner.

**UC liên quan:** UC-19, UC-83

---

## G. Realtime (UC-65–70)

### UC-65 — Kết nối socket + join room

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Realtime |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | WebSocket authenticate và join room channel. |
| **Mục tiêu** | Nhận phase/timer/chat realtime. |

**Kỹ thuật:** Socket.IO `join-room` — [08_Socket](./08_Socket_Realtime_Guide.md)

---

### UC-66 — Đồng bộ phase & timer (server-authoritative)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Realtime |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Server là nguồn thời gian; broadcast `phase:changed`, `timer:tick`. |
| **Mục tiêu** | Client không tự đếm ngược độc lập. |

**UC liên quan:** UC-52, UC-39

---

### UC-67 — Chat phòng

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Realtime |
| **Ưu tiên** | MVP-M |
| **Actor** | Participant |
| **Mô tả** | Chat Main Room và private team; phân loại chat/system. |
| **Mục tiêu** | Giao tiếp theo phase và role. |

**UC liên quan:** UC-78, UC-58

---

### UC-68 — Typing indicator

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Realtime |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Hiển thị “đang nhập…” trong chat. |

---

### UC-69 — Online presence

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Realtime |
| **Ưu tiên** | MVP-S |
| **Actor** | System |
| **Mô tả** | Trạng thái online/offline participant trong lobby/phòng. |

---

### UC-70 — Reconnect

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Realtime |
| **Ưu tiên** | MVP-M |
| **Actor** | User, System |
| **Mô tả** | Sau mất kết nối, client nhận lại phase, timer, CE state. |
| **Mục tiêu** | Không phá trận khi mạng chập chờn. |

**Luồng chính:** Reconnect socket → server gửi snapshot `room:state` → UI sync.

**UC liên quan:** UC-65, UC-66

---

## H. AI (UC-71–82)

### UC-71 — AI Host điều phối phase

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | AI thực hiện vai Host: motion, prep, signal speech, chuyển CE/BGK. |
| **Mục tiêu** | Rank mode không cần Host người — [07_AI](./07_AI_Integration_Guide.md). |

**UC liên quan:** UC-35–52, UC-20

---

### UC-72 — AI BGK nhận xét & chấm

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | AI Judge sau mỗi lượt và cuối trận. |
| **Mục tiêu** | Thay BGK human trong rank. |

**UC liên quan:** UC-43, UC-61, UC-77

---

### UC-73 — AI phân tích speech

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | Trích claims, điểm mạnh/yếu từ transcript speech. |
| **Mục tiêu** | Hỗ trợ BGK và debater (ẩn hoặc hiện tùy mode). |

**Kỹ thuật:** `POST /api/v1/ai/analyze-speech`

---

### UC-74 — AI phát hiện ngụy biện

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-S |
| **Actor** | System (AI) |
| **Mô tả** | Gắn nhãn fallacy cho đoạn lập luận. |
| **Mục tiêu** | Giáo dục + UC-17 badge. |

**Kỹ thuật:** `POST /api/v1/ai/detect-fallacy`

---

### UC-75 — AI validate câu hỏi Cross Examination

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | Kiểm tra câu hỏi CE là câu hỏi thật, không phải speech dài. |
| **Mục tiêu** | Enforce §10 — không POI-style monologue. |

**Kỹ thuật:** `POST /api/v1/ai/validate-cross-exam-question`

**UC liên quan:** UC-41

---

### UC-76 — AI tóm tắt trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | Tóm tắt toàn trận sau `completed`. |
| **Mục tiêu** | Replay, thread, portfolio. |

**Kỹ thuật:** `POST /api/v1/ai/summarize-debate`

**UC liên quan:** UC-96

---

### UC-77 — AI phán quyết cuối

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | So sánh hai đội, đưa verdict khi AI là BGK chính. |
| **Mục tiêu** | UC-63 trong rank mode. |

**Kỹ thuật:** `POST /api/v1/ai/score-argument` (aggregate)

---

### UC-78 — AI kiểm tra toxic (chat)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System (AI) |
| **Mô tả** | Lọc nội dung chat toxic trước khi broadcast. |
| **Mục tiêu** | An toàn cộng đồng. |

**Kỹ thuật:** `POST /api/v1/ai/check-toxic`

---

### UC-79 — Phát hiện spam chat

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-S |
| **Actor** | System |
| **Mô tả** | Rate limit + heuristic lặp tin nhắn. |

**UC liên quan:** UC-78

---

### UC-80 — AI gợi ý phản biện

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-S |
| **Actor** | Debator + AI |
| **Mô tả** | Debater yêu cầu gợi ý rebuttal (tùy chọn, có thể tắt trong rank). |
| **Mục tiêu** | Học tập; không dùng trong rank competitive (policy). |

**Kỹ thuật:** `POST /api/v1/ai/generate-rebuttal`

---

### UC-81 — AI coaching sau trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | P2 |
| **Actor** | Debater + AI |
| **Mô tả** | Báo cáo cải thiện cá nhân sau trận dựa trên scores + transcript. |

**UC liên quan:** UC-16, UC-48

---

### UC-82 — Fallback khi OpenAI unavailable

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | AI |
| **Ưu tiên** | MVP-M |
| **Actor** | System |
| **Mô tả** | Retry, queue, hoặc thông báo tạm dừng AI Host/BGK. |
| **Mục tiêu** | Trận không crash im lặng. |

**Luồng thay thế:** Chuyển sang judge human nếu có; hoặc pause UC-53.

---

## I. Xếp hạng & Credibility (UC-83–88)

### UC-83 — Leaderboard Global (ELO)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xếp hạng |
| **Ưu tiên** | MVP-M |
| **Actor** | User |
| **Mô tả** | Bảng xếp hạng ELO tổng, tách 1v1 / 3v3. |
| **Mục tiêu** | Động lực rank — [10 §3.4](./10_Idea_Build_Community.md). |

**Kỹ thuật:** `GET /api/v1/users/leaderboard`

**UC liên quan:** UC-64

---

### UC-84 — Leaderboard Weekly / Monthly / Yearly

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xếp hạng |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Bảng theo chu kỳ, reset điểm kỳ. |
| **Mục tiêu** | Cơ hội cho user mới. |

---

### UC-85 — Vinh danh top kỳ (badge mùa)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Xếp hạng |
| **Ưu tiên** | P2 |
| **Actor** | System |
| **Mô tả** | Trao danh hiệu cuối weekly/monthly/yearly. |

**UC liên quan:** UC-17, UC-84

---

### UC-86 — Credibility score

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Credibility |
| **Ưu tiên** | P2 |
| **Actor** | System |
| **Mô tả** | Điểm uy tín từ chất lượng argument, evidence, vote. |
| **Mục tiêu** | [10 §3.3](./10_Idea_Build_Community.md). |

**UC liên quan:** UC-87, UC-90

---

### UC-87 — Trọng số vote theo Credibility

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Credibility |
| **Ưu tiên** | P2 |
| **Actor** | System |
| **Mô tả** | Vote Agree/Disagree có trọng số theo credibility người vote. |

**UC liên quan:** UC-90, UC-99

---

### UC-88 — Top Contributors (Evidence)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Credibility |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Bảng đóng góp evidence chất lượng cao. |

**UC liên quan:** UC-89

---

## J. Tri thức (UC-89–94)

### UC-89 — Đăng Evidence

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Knowledge |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Đăng dẫn chứng: claim, source, type, topic; gắn motion/argument. |
| **Mục tiêu** | Evidence Bank — [10 §1.1](./10_Idea_Build_Community.md). |

**Quy tắc:** Evidence phải gắn ≥1 Motion hoặc Argument.

---

### UC-90 — Vote Evidence

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Knowledge |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Agree/Disagree; trọng số theo UC-87. |

---

### UC-91 — Tạo / đề xuất Motion

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Knowledge |
| **Ưu tiên** | P2 |
| **Actor** | User, Admin |
| **Mô tả** | Official (admin) hoặc Community (vote ngưỡng). |
| **Mục tiêu** | Motion System — [10 §1.2](./10_Idea_Build_Community.md). |

---

### UC-92 — Xem Motion hai cột Pro vs Con

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Knowledge |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | UI hai cột; arguments và evidence theo stance. |

**UC liên quan:** UC-93, UC-94

---

### UC-93 — Tạo Argument

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Knowledge |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Luận điểm Pro/Con, link motion, đính kèm evidence. |

---

### UC-94 — Argument phản biện Argument

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Knowledge |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Cây tranh luận; dùng trong match prep hoặc replay. |

**UC liên quan:** UC-93, UC-98

---

## K. Arena & Cộng đồng (UC-95–100)

### UC-95 — Reaction realtime khi xem trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Arena |
| **Ưu tiên** | MVP-S |
| **Actor** | Viewer |
| **Mô tả** | Emoji/reaction không ảnh hưởng điểm. |
| **Mục tiêu** | [10 §2.1](./10_Idea_Build_Community.md). |

**UC liên quan:** UC-26

---

### UC-96 — Tự động tạo Debate Thread sau trận

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Arena |
| **Ưu tiên** | MVP-S |
| **Actor** | System |
| **Mô tả** | Sinh thread: motion, verdict, timeline, transcript. |
| **Mục tiêu** | [10 §2.2](./10_Idea_Build_Community.md). |

**Tiền điều kiện:** UC-48 completed.

**UC liên quan:** UC-97–99

---

### UC-97 — Bình luận thread theo stance

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Arena |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Comment Pro/Con trên debate thread. |

**Kỹ thuật:** `POST /api/v1/posts/:id/comment` (hoặc module thread riêng)

---

### UC-98 — Phản biện theo speaker / đoạn transcript

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Arena |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Anchor comment vào timestamp hoặc speaker slot. |

---

### UC-99 — Vote lại kết quả BGK

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Arena |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Agree/Disagree với verdict — **không** thay chấm chính thức. |
| **Mục tiêu** | Pulse cộng đồng. |

**UC liên quan:** UC-87

---

### UC-100 — Challenge / Debate Duel

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Arena |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Gửi lời thách → đối phương chấp nhận → kiểm tra rating → trận công khai. |
| **Mục tiêu** | [10 §2.3](./10_Idea_Build_Community.md). |

**Luồng chính:** Challenge → Accept → UC-21 custom/public → Live feed.

**UC liên quan:** UC-21, UC-25

---

## L. Giải đấu (UC-101–106)

### UC-101 — Tournament Hub

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Tournament |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Duyệt giải Official / Community đang & sắp diễn ra. |
| **Mục tiêu** | [10 §4.1](./10_Idea_Build_Community.md). |

**Kỹ thuật:** `GET /api/v1/tournaments`

---

### UC-102 — Tạo giải

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Tournament |
| **Ưu tiên** | P2 |
| **Actor** | Organizer, Admin |
| **Mô tả** | Tạo tournament: format, thời gian, số đội, loại giải. |

**Kỹ thuật:** `POST /api/v1/tournaments/create`

---

### UC-103 — Đăng ký đội / cá nhân

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Tournament |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Đăng ký; tạo team; mời thành viên; kiểm tra rating/số người. |

**Kỹ thuật:** `POST /api/v1/tournaments/:id/register`

---

### UC-104 — Tạo bracket & lịch

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Tournament |
| **Ưu tiên** | P2 |
| **Actor** | System, Organizer |
| **Mô tả** | Single/double elimination hoặc round robin. |

**Kỹ thuật:** `GET /api/v1/tournaments/:id/brackets`

---

### UC-105 — Auto tạo debate room cho trận giải

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Tournament |
| **Ưu tiên** | P2 |
| **Actor** | System |
| **Mô tả** | Đến giờ thi đấu → tạo room theo [01](./01_Debate_Rule.md), gán debater/judge/host. |

**UC liên quan:** UC-21, UC-32, UC-52

---

### UC-106 — Cập nhật bracket + Portfolio

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Tournament |
| **Ưu tiên** | P2 |
| **Actor** | System |
| **Mô tả** | Sau mỗi trận: advance bracket, ghi thành tích giải vào portfolio. |

**Kỹ thuật:** `POST /api/v1/tournaments/:id/advance`

**UC liên quan:** UC-16, UC-48, UC-96

---

## M. Quản trị (UC-107–110)

### UC-107 — Báo cáo vi phạm

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Quản trị |
| **Ưu tiên** | MVP-S |
| **Actor** | User |
| **Mô tả** | Report user, chat, hoặc nội dung thread. |
| **Mục tiêu** | Luồng moderation. |

---

### UC-108 — Admin xử lý báo cáo

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Quản trị |
| **Ưu tiên** | MVP-S |
| **Actor** | Admin |
| **Mô tả** | Review report → cảnh cáo / ban / bỏ qua. |

**UC liên quan:** UC-109

---

### UC-109 — Quản trị user (ban, role)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Quản trị |
| **Ưu tiên** | MVP-S |
| **Actor** | Admin |
| **Mô tả** | Ban account, đổi role hệ thống (`admin`, `debater`). |

**UC liên quan:** UC-02, UC-19

---

### UC-110 — Daily Challenge (Survival Mode)

| Thuộc tính | Nội dung |
|------------|----------|
| **Miền** | Quản trị / Gamification |
| **Ưu tiên** | P2 |
| **Actor** | User |
| **Mô tả** | Bài tập tranh biện hàng ngày do AI tạo; streak leaderboard. |
| **Mục tiêu** | [10 §3.5](./10_Idea_Build_Community.md). |

**Luồng chính:** Nhận challenge → phản biện trong timebox → AI chấm → cập nhật streak.

**UC liên quan:** UC-81, UC-73

---

## Phụ lục: Template tham chiếu

Mỗi UC trong file này tuân template:

| Trường | Mục đích |
|--------|----------|
| Miền / Ưu tiên | Phân loại sprint |
| Actor / Mô tả / Mục tiêu | Nghiệp vụ |
| Tiền & Hậu điều kiện | Ràng buộc test |
| Luồng chính / thay thế | QA & dev |
| Quy tắc nghiệp vụ | Khớp doc 01–03 |
| UC liên quan | Traceability |
| Kỹ thuật | API / Socket / TRD |

---

*Chi tiết đầy đủ 110 UC · Bản tóm tắt: [05_Use_Cases.md](./05_Use_Cases.md) v1.0*

