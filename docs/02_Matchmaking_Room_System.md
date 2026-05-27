# 02 — Matchmaking & Room System

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** Đặc tả sản phẩm — ghép trận & phòng debate  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) (chuẩn) · [03_Role_System.md](./03_Role_System.md)

---

## 1. Tổng quan

Nền tảng hoạt động như **“chơi cờ online” cho debate**: ghép trận / tạo phòng → lobby → motion → chuẩn bị → trận theo phase cố định → BGK chấm → kết quả & ELO.

**Hai kênh vào trận:**

| Kênh | Mô tả |
|------|--------|
| **Random Matchmaking (Rank)** | Ghép theo ELO; mặc định **AI Host + AI Judge (BGK)**. |
| **Custom Room** | Người tạo cấu hình Host/Judge (Human hoặc AI), 1v1 hoặc 3v3, có/không password. |

**Community Live Matches:** danh sách trận đang diễn ra / chờ — xem (Viewer) hoặc join (nếu đủ điều kiện + password).

---

## 2. Community Live Matches

- Hiển thị trận: **đang diễn ra** / **chờ bắt đầu**.
- **Viewer:** xem Main Room (theo phase hiện tại).
- **Custom có password:** nút View + Join (nhập đúng mật khẩu).
- **Filter:** 1v1 / 3v3 · Rank / Custom · có/không password.

---

## 3. Random Matchmaking (Rank Mode)

### 3.1 Cơ chế

- Ghép đối thủ theo **ELO** (tách bảng **1v1** và **3v3**).
- **Host:** AI (điều phối phase, timer, Cross Examination).
- **Judge (BGK):** AI (nhận xét sau mỗi lượt speaker, chấm cuối trận).

### 3.2 Sau khi ghép

1. Hệ thống tạo **match + room**.
2. **Motion Announcement** — công bố chủ đề (motion).
3. **Preparation Phase — 7 phút** (theo [01_Debate_Rule.md §4](./01_Debate_Rule.md)) — không phải 15 phút.
4. Vào luồng trận chính (Round 1 → Round 2 → Closing → Final Judging).

### 3.3 Không gian chuẩn bị (7 phút)

Theo Debate_rule:

- **1 Main Room** + **1 Private Room / đội** (Ủng hộ / Phản đối).
- Đội: vào private room trao đổi chiến thuật, phân công Speaker 1–3 (3v3) hoặc một người đảm nhận cả 3 vai (1v1).
- Host & BGK: có thể tương tác Main Room (khuấy động, định hướng — không chấm thay debate).

Hết 7 phút → Host mời hai đội về Main Room → bắt đầu lượt nói đầu tiên.

### 3.4 Thứ tự speaker (3v3)

Đội **Ủng hộ (Proposition)** luôn trước:

`Pro S1 → Opp S1 → Pro S2 → Opp S2 → Pro S3 → Opp S3`

Chi tiết thời lượng, Cross Examination, BGK feedback: xem [01_Debate_Rule.md §5–15](./01_Debate_Rule.md).

### 3.5 Chế độ 1v1

Một debater đảm nhận **Speaker 1, 2, 3** cho đội mình; luồng phase và thời gian **giữ nguyên** như 3v3.

---

## 4. Custom Room System

### 4.1 Tạo phòng — Room Owner

**Room Owner** = user bấm “Tạo phòng” (`createdBy`). Không bắt buộc online suốt trận nếu đã gán **Host** (người hoặc AI).

**Cấu hình khi tạo:**

| Thành phần | Tùy chọn |
|------------|----------|
| **Format** | 1v1 · 3v3 |
| **Host** | Human (1) · AI (1) |
| **Judge (BGK)** | Human (1 hoặc 3) · AI (1) |
| **Debater** | 1 hoặc 3 / đội (Ủng hộ & Phản đối) |
| **Privacy** | Public · Password |

Sinh **Room ID**; hiển thị trong **Custom Live Matches**.

### 4.2 Join & Waiting Room

- User vào → trạng thái **`waiting`**.
- Số slot chờ = debater + judge (human) + host (human) — **không tính slot AI**.
- Ví dụ: 3v3, Judge×3 human, Host AI → 6 debater + 3 judge = 9 slot người.

### 4.3 Chọn vị trí (Select Position)

Owner bật **Select Position** → player chọn:

- Đội **Proposition / Opposition**
- **Speaker 1 / 2 / 3** (hoặc debater duy nhất ở 1v1)
- **Judge** · **Host** (nếu slot Human còn trống)

**Lock position:** sau khi lock, không đổi vai trước trận.

### 4.4 Quyền Room Owner (lobby)

- Chuyển **ownership** cho user khác.
- Kick / ban (lobby).
- Bật/tắt Select Position · lock/unlock vị trí.
- **Start trận** (hoặc ủy quyền cho Host nếu Owner ≠ Host).

Khi trận **`active`**: điều hành phase thuộc **Host**; chấm điểm thuộc **BGK** — xem [03_Role_System.md](./03_Role_System.md).

---

## 5. Workflow Custom Room (chuẩn)

```
[Tạo phòng] Owner + cấu hình Host/Judge/1v1|3v3
      ↓
[Waiting] Join slot · Select Position · Ready
      ↓
[Start] Owner hoặc Host bấm bắt đầu
      ↓
[Motion Announcement] Host/BGK giới thiệu motion
      ↓
[Preparation 7 phút] Main + Private Room từng đội
      ↓
[Debate Round 1] Pro S1 → Cross Exam → BGK 3–5' → prep 1'
              → Opp S1 → Cross Exam → BGK → prep 1'
      ↓
[Debate Round 2] Pro S2 → … · Opp S2 → …
      ↓
[Closing] Pro S3 · Opp S3 (không Cross Exam)
      ↓
[Final Judging] BGK kết quả · công bố thắng thua
      ↓
[completed] Replay · ELO (nếu rank/custom bật)
```

Luồng chi tiết 25 bước: [01_Debate_Rule.md §15](./01_Debate_Rule.md).

---

## 6. Workflow Rank Matchmaking

```
[Queue 1v1 hoặc 3v3] → Ghép ELO
      ↓
[Tạo room tự động] AI Host + AI BGK
      ↓
[Motion] → [Prep 7'] → [Luồng trận Debate_rule]
      ↓
[Cập nhật ELO] theo kết quả
```

Không có Room Owner người; quyền điều phối = **AI Host** (policy hệ thống).

---

## 7. Hai đội tự tạo phòng chơi với nhau

| Câu hỏi | Trả lời |
|---------|---------|
| Ai là Owner? | **Ai bấm Tạo phòng trước** (thường captain một đội hoặc người trung lập). |
| Owner có phải Host? | **Không.** Nên chọn Host = AI hoặc người thứ ba để công bằng. |
| Owner có phải debater? | **Không.** Có thể chỉ mở phòng rồi vào Viewer. |
| Prep bao lâu? | **7 phút** (chuẩn Debate_rule), không dùng 15 phút. |

---

## 8. Tóm tắt ba lớp hệ thống

| Lớp | Chức năng |
|-----|-----------|
| **Matchmaking** | ELO queue · auto room · AI Host/BGK |
| **Room** | Custom config · Owner · lobby · start |
| **Community** | Live list · spectate · filter |

---

## 9. Tài liệu liên quan

| File | Nội dung |
|------|----------|
| [01_Debate_Rule.md](./01_Debate_Rule.md) | Luật trận — **chuẩn duy nhất** |
| [03_Role_System.md](./03_Role_System.md) | Debator / Host / Judge / Viewer / Owner |
| [04_TRD_Technical_Requirements.md](./04_TRD_Technical_Requirements.md) | API, schema, kỹ thuật |
| [05_Use_Cases.md](./05_Use_Cases.md) | Use case UC-19–34 (matchmaking & phòng) |
