# 00 — Presentation

**Phiên bản:** v1.1 | **Ngày:** 18/05/2026  
**Loại tài liệu:** Trình bày dự án (khách hàng, nhà đầu tư, đối tác, trường/CLB)  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) · [10_Idea_Build_Community.md](./10_Idea_Build_Community.md)

---

## 1. Một câu về dự án

**AI Debate Platform** là nền tảng web tổ chức tranh biện trực tuyến theo chuẩn học thuật quốc tế, chạy theo thời gian thực, có trọng tài và khán giả — và được **trợ lý bởi trí tuệ nhân tạo** để đánh giá công bằng, phân tích lập luận và giữ không gian tranh luận văn minh.

---

## 2. Dự án này dùng để làm gì?

Trong thực tế, một trận tranh biện có cấu trúc (motion, chuẩn bị, lượt nói, chất vấn, chấm điểm) thường cần:

- Phòng họp hoặc hội trường, nhiều người cùng chỗ.
- Một **chủ trì (Host)** điều phối thời gian và từng giai đoạn.
- **Ban giám khảo (BGK)** nhận xét sau mỗi phần và chốt kết quả.
- Thời gian chuẩn bị (trên nền tảng: **7 phút** trước trận) và logistics cho CLB, trường, giải online.

Nền tảng này **đưa toàn bộ trải nghiệm đó lên internet** theo **[01_Debate_Rule.md](./01_Debate_Rule.md)**: hai đội **Ủng hộ / Phản đối**, chế độ **1v1 hoặc 3v3**, **Cross Examination** sau các lượt mở đầu, BGK (người hoặc AI).

**Giá trị sử dụng cụ thể:**

| Nhu cầu | Nền tảng đáp ứng |
|--------|------------------|
| CLB tranh biện, đội tuyển trường | Tổ chức trận tập, trận nội bộ, lưu lịch sử và điểm số. |
| Giáo dục (THPT, đại học) | Tiết học hoặc đánh giá kỹ năng hùng biện, tư duy phản biện. |
| Giải đấu online | Tạo giải, lịch đấu — không phụ thuộc một phần mềm chat rời rạc. |
| Cá nhân luyện tập | Tham gia trận, xem phân tích sau cùng, theo dõi tiến bộ qua xếp hạng. |

---

## 3. Ai là người dùng chính?

- **Người tranh biện (debater):** đội **Ủng hộ (Proposition)** hoặc **Phản đối (Opposition)**; phát biểu 4 phút/lượt, chất vấn có cấu trúc (Cross Examination).
- **Chủ trì (host):** bắt đầu/kết thúc trận, điều khiển thời gian, xử lý vi phạm nhẹ (cảnh báo).
- **Giám khảo (judge):** cho điểm theo các tiêu chí thống nhất (logic, cấu trúc, bằng chứng, phản biện, trình bày).
- **Khán giả:** theo dõi trực tiếp qua Live Matches.
- **Ban tổ chức / trường / CLB:** tạo phòng, quản lý trận đấu.

---

## 4. Nền tảng có những tính năng gì? (trình bày dễ hiểu)

### 4.1 Phòng tranh biện "đúng nghĩa" — không chỉ là video call

- **Luật theo Debate_rule:** motion → chuẩn bị 7 phút (Main Room + Private Room từng đội) → các vòng tranh biện → **Speaker 3** tổng kết **không** đưa luận điểm mới.
- **Cross Examination:** sau Speaker 1 & 2 — mỗi đội tối đa 2 câu, 3 phút; hệ thống hỗ trợ Pass Turn / Finish và đồng bộ timer.
- **BGK nhận xét** 3-5 phút sau mỗi lượt speaker; **Host** điều phối phase và kỷ luật phòng.

### 4.2 Trải nghiệm thời gian thực

- Mọi người thấy **cùng phase** (chuẩn bị, speech, chất vấn, nhận xét BGK), **cùng đồng hồ** — server-authoritative.

### 4.3 Tài khoản, hồ sơ và xếp hạng

- Đăng ký, đăng nhập, quản lý hồ sơ cá nhân (ảnh đại diện, giới thiệu, trường/CLB).
- **Bảng xếp hạng ELO:** sau các trận, hệ thống cập nhật trình thi đấu tương đối — phù hợp văn hóa game hóa học tập.
- **Live Matches:** xem danh sách trận đang diễn ra, spectate trực tiếp.

### 4.4 Sau trận: xem lại và học hỏi

- **Xem lại trận đấu** theo dòng thời gian (từng lượt phát biểu, điểm nhận xét).
- **Thống kê cá nhân:** giúp người chơi thấy điểm mạnh-yếu qua nhiều trận.

---

## 5. AI được dùng để làm gì? (ở góc độ "lợi ích", không đi sâu kỹ thuật)

AI trong dự án **không thay thế hoàn toàn con người** trong vai trò giám khảo hoặc giáo viên, mà **hỗ trợ quy mô, tốc độ và tính nhất quán** — đặc biệt khi thiếu chuyên gia hoặc cần phản hồi nhanh sau mỗi phần thi.

### 5.1 AI như một "trợ giám khảo" phân tích từng bài phát biểu

- Tóm tắt **luận điểm chính**, mức độ dùng bằng chứng, điểm mạnh / điểm yếu.
- Phát hiện **các lỗi lập luận phổ biến** (fallacy) để người chơi học cách tư duy phản biện.
- Cho **điểm theo các tiêu chí thống nhất** — hỗ trợ ban giám khảo con người có thêm một thước đo nhất quán.

### 5.2 AI giúp giữ không gian tranh luận văn minh

- **Lọc / cảnh báo** nội dung chat toxic, xúc phạm, hoặc spam — giảm tải cho chủ trì.

### 5.3 AI tổng kết cả trận

- **Tóm tắt toàn trận** cho khán giả và ban tổ chức: các mâu thuẫn chính, ai triển khai tốt phần nào.
- **Phán quyết cuối** kèm lý do — dùng song song với phiếu chấm của giám khảo người.

### 5.4 Auto-timer system (thay AI Host)

Khi **không có chủ trì người**, hệ thống tự động:

- **Chuyển phase** theo timer (prep → speech → CE → BGK → closing).
- **Thông báo chuyển phần** qua system message.
- Đơn giản, ổn định, không phụ thuộc AI cho orchestration.

> *AI Host đầy đủ (điều phối bằng ngôn ngữ tự nhiên) — dự kiến Phase 2.*

---

## 6. Vì sao dự án đáng chú ý với khách hàng và nhà đầu tư?

1. **Thị trường giáo dục kỹ năng & nội dung số:** nhu cầu luyện hùng biện, tư duy phản biện — đang tăng ở học đường và doanh nghiệp.
2. **Khác biệt rõ so với "họp Zoom + chat":** sản phẩm gắn **luật thi đấu**, **đồng hồ chung**, **vai trò chuẩn** — tức là "đường đua" chứ không chỉ là "phòng nói chuyện".
3. **AI đi đúng chỗ:** không phải chatbot chit-chat, mà **giảm chi phí vận hành**, **tăng tốc phản hồi**, **tăng tính minh bạch** (tiêu chí chấm thống nhất, có log phân tích).
4. **Mô hình mở rộng:** từ buổi tập CLB → giải trường → giải khu vực online; có lớp **cộng đồng và giải đấu** để giữ người dùng quay lại (Phase 2).

---

## 7. Điều nào *không* nằm trong phạm vi MVP?

- **Giải đấu đầy đủ** (bracket, auto room) — Phase 2.
- **Cộng đồng** (posts, vote, comment, thread) — Phase 2.
- **AI Host** (điều phối bằng ngôn ngữ tự nhiên) — Phase 2.
- **Portfolio, AI Badges, Credibility** — Phase 2.
- Mức độ chi tiết AI phụ thuộc **ngân sách API** và **lộ trình phát triển**.

---

## 8. Tài liệu liên quan (cho team và due diligence)

| Tài liệu | Nội dung |
|----------|----------|
| [Overview.md](./Overview.md) | Tổng quan dự án |
| [README.md](./README.md) | Mục lục toàn bộ tài liệu |
| [01_Debate_Rule.md](./01_Debate_Rule.md) | Luật tranh biện (chuẩn) |
| [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md) | Ghép trận & phòng |
| [03_Role_System.md](./03_Role_System.md) | Phân quyền trong phòng |
| [04_TRD_Technical_Requirements.md](./04_TRD_Technical_Requirements.md) | Yêu cầu kỹ thuật, kiến trúc, API |
| [05_Use_Cases.md](./05_Use_Cases.md) | Use case (66 UC MVP) |
| [06_Development_Plan_6Weeks.md](./06_Development_Plan_6Weeks.md) | Kế hoạch triển khai |
| [10_Idea_Build_Community.md](./10_Idea_Build_Community.md) | Ý tưởng Phase 2 |

---

*Nếu cần thêm phiên bản tiếng Anh một trang (one-pager) cho nhà đầu tư quốc tế, có thể xuất từ cùng một khung nội dung trên.*
