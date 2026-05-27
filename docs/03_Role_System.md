# 03 — Role System (Phân quyền trong phòng)

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** Đặc tả sản phẩm — vai trò & quyền hạn  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) · [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md)

---

## 1. Tổng quan

Trong **một phòng debate** có 4 vai trò tranh biện + 1 meta-role:

| Vai trò | Mô tả ngắn |
|---------|------------|
| **Debator** | Thành viên đội **Ủng hộ (Proposition)** hoặc **Phản đối (Opposition)** — luôn là người. |
| **Host** | Điều phối phase, timer, tín hiệu bắt đầu speech, Cross Examination, kỷ luật phòng. |
| **Judge (BGK)** | Ban giám khảo — Human hoặc AI; nhận xét & chấm theo [01_Debate_Rule.md §12–13](./01_Debate_Rule.md). |
| **Viewer** | Khán giả — xem Main Room, tương tác theo cấu hình. |
| **Room Owner** | Meta: user tạo phòng; quyền cấu hình lobby (không thay thế Host khi trận đang chạy). |

**Host / Judge** có thể là **Human** hoặc **AI** (cấu hình lúc tạo phòng hoặc mặc định Rank mode).

---

## 2. Debator — Quyền hạn

### 2.1 Truy cập

- Vào **Main Room** khi được phép theo phase.
- Vào **Private Room** của đội mình trong **Preparation Phase (7 phút)** và các khoảng prep 1 phút giữa lượt (nếu bật).
- **Không** vào Private Room đối phương.

### 2.2 Giao tiếp

- Mic/chat theo phase: chỉ khi **được Host cho phép** hoặc đúng lượt (speech / Cross Examination).
- Chat nội bộ đội trong private room (nếu bật).

### 2.3 Trình bày & Cross Examination

- **Speech:** phát biểu khi Host/system cho tín hiệu bắt đầu; **4 phút** / speaker ([Debate_rule §6](./01_Debate_Rule.md)).
- **Cross Examination** (sau Speaker 1 & 2): đặt tối đa **2 câu** / đội, **3 phút** riêng; dùng **Pass Turn** / **Finish** — không biến thành speech dài.
- **Speaker 3:** không luận điểm mới; **không** Cross Examination.

### 2.4 Trong đội (Captain — khuyến nghị)

- Gán ai giữ **Speaker 1 / 2 / 3** (3v3); 1v1 một người giữ cả ba.
- Thứ tự ai xin hỏi trong Cross Examination nội bộ đội.

### 2.5 Giới hạn

- Không điều phối phase · không chấm điểm · không kick/ban · không mute người khác (trừ quyền team chat nội bộ).

---

## 3. Judge (BGK) — Quyền hạn

### 3.1 Đánh giá (theo Debate_rule)

Sau **mỗi lượt speaker**:

- Nhận xét lập luận, phản biện, Cross Examination, khả năng phản hồi.
- Chấm điểm tạm thời.

Sau trận:

- Kết quả cuối, đội thắng, giải thích.

**Tiêu chí (100 điểm):** Logic 30 · Rebuttal 20 · Evidence 15 · Cross Examination 15 · Strategy 10 · Communication 10.

### 3.2 Human Judge — thêm

- Reaction (không ảnh hưởng điểm).
- Mic/chat nhận xét (theo cấu hình phòng).
- **Đề xuất** thẻ vàng/đỏ (thực thi thường do Host — xem 3.4).

### 3.3 AI Judge (BGK)

- Tự động nhận xét sau lượt; tổng kết cuối trận.
- Không tham gia Private Room đội.

### 3.4 Kỷ luật

- **Đề xuất** cảnh cáo / thẻ (policy phòng).
- **Không** kick trực tiếp (thuộc Host / Owner lobby) trừ phòng cấu hình đặc biệt.

### 3.5 Giới hạn

- Không tranh luận thay debater · không điều khiển timer/phase (thuộc Host).

---

## 4. Host — Quyền hạn

### 4.1 Điều phối trận (khớp Debate_rule)

- **Motion Announcement** — mở đầu cùng BGK.
- Bắt đầu / kết thúc **Preparation 7 phút**; mời đội về Main Room.
- Cho phép speaker bắt đầu (“Speaker 1 đội Ủng hộ, bạn có thể bắt đầu”) → kích hoạt **Speech Timer**.
- Chuyển phase: Speech → **Cross Examination** → **Judge Feedback 3–5'** → **Prep 1'** → lượt tiếp theo.
- Pause / resume / kết thúc trận sớm (policy).

### 4.2 Cross Examination (điều phối)

- Giám sát luồng Pass Turn / Finish.
- Timer sync; auto stop khi hết 3 phút / đủ 2 câu hỏi–trả lời.
- Áp dụng quy tắc mất điểm phần còn thiếu ([Debate_rule §10.3](./01_Debate_Rule.md)).

### 4.3 Quản lý người dùng

- Kick / ban (trong trận).
- Mute mic / cấm chat (từng user hoặc Viewer toàn phòng).
- Thẻ vàng / đỏ (cảnh cáo, truất quyền phát biểu).
- Chuyển quyền **Host** cho Human khác (không áp dụng chuyển sang AI giữa trận nếu policy cấm).

### 4.4 Giao tiếp

- Mic/chat xuyên suốt (điều phối).
- Điều khiển chat Viewer (bật/tắt).

### 4.5 AI Host

- Thực hiện các mục 4.1–4.2 tự động; thông báo chuyển phase.
- **Không** thay BGK chấm điểm chính thức (trừ khi đồng thời cấu hình AI Judge).

### 4.6 Giới hạn

- **Không** chấm điểm chính thức (trừ cấu hình đặc biệt).
- **Không** tham gia đội debate.

---

## 5. Viewer — Quyền hạn

### 5.1 Xem

- Main Room realtime: motion, speaker, timer, phase, kết quả BGK (nếu công khai).

### 5.2 Tương tác (tùy cấu hình)

- Chat công khai · reaction.
- **Không** mic · **không** speech · **không** Cross Examination.

### 5.3 Mở rộng

- Xin vào debater nếu phòng cho phép và còn slot (Host/Owner duyệt).

---

## 6. Room Owner (meta-role)

### 6.1 Đặc điểm

- User tạo phòng; **có thể trùng** Host, Debator, Viewer, hoặc không vào trận.
- **AI không là Owner.**

### 6.2 Lobby (`waiting` / `ready`)

| Quyền | Owner |
|--------|-------|
| Sửa cấu hình phòng (format, Host/Judge Human/AI, password) | Có |
| Chỉ định / đổi Host Human | Có |
| Kick / ban lobby | Có |
| Select Position · lock slot | Có |
| **Start trận** | Có (hoặc ủy quyền Host) |
| Chuyển ownership | Có |

### 6.3 Trận đang chạy (`active`)

| Quyền | Owner (không phải Host) | Owner = Host |
|--------|-------------------------|--------------|
| Điều phối phase / timer | Không | Có (như Host §4) |
| Kick / thẻ / mute | Không | Có |
| Sửa cấu hình phòng | Không (đã lock) | Không |
| Hủy phòng | Policy: cần Host + đồng ý đội | Có (theo policy) |

### 6.4 Cảnh cáo “3 lần” (nếu bật khi tạo phòng)

- Host (hoặc AI Host) ghi nhận warning/thẻ.
- **3 cảnh cáo** trong cùng trận → auto kick / cấm đến hết trận (cấu hình phòng).

---

## 7. Ma trận phân quyền nhanh

| Hành động | Debator | Host | Judge | Viewer | Owner (lobby) |
|-----------|---------|------|-------|--------|----------------|
| Speech / Cross Exam | Có (đúng lượt) | Không | Không | Không | Không |
| Bắt đầu phase / timer | Không | **Có** | Không | Không | Start trận |
| Chấm điểm BGK | Không | Không | **Có** | Không | Không |
| Thẻ vàng/đỏ | Không | **Có** | Đề xuất | Không | Lobby kick |
| Kick / mute | Không | **Có** | Thường không | Không | Lobby |
| Private Room đội mình | Prep/prep 1' | Không | Không | Không | Không |

---

## 8. Tài liệu liên quan

- [01_Debate_Rule.md](./01_Debate_Rule.md) — luật trận  
- [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md) — tạo/join/ghép trận  
- [04_TRD_Technical_Requirements.md](./04_TRD_Technical_Requirements.md) — RBAC hệ thống (`admin`, `debater`, …)
