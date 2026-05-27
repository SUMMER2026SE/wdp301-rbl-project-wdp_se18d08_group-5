# 01 — Debate Rule (Luật tranh biện)

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** **Chuẩn (canonical)** — mọi tài liệu khác trong `docs/` phải khớp file này  
**Tham chiếu kỹ thuật:** [04_TRD_Technical_Requirements.md](./04_TRD_Technical_Requirements.md) · [08_Socket_Realtime_Guide.md](./08_Socket_Realtime_Guide.md)

---

## 1. Tổng quan hệ thống

**AI Debate Platform** là nền tảng tranh biện đối kháng theo thời gian thực giữa hai đội:

- **Đội Ủng hộ (Proposition)**
- **Đội Phản đối (Opposition)**

**Chế độ:** `1v1` · `3v3` — ở 1v1, một người đảm nhận cả ba vai Speaker 1, 2, 3 cho đội mình.

**Thành phần:**

- **Host** — điều phối trận
- **BGK** — Ban giám khảo (AI hoặc Human)
- Hệ thống quản lý thời gian và lượt tranh biện
- **Main Room** + **Private Room** cho từng đội (giai đoạn chuẩn bị)

---

## 2. Cấu trúc trận debate

| # | Giai đoạn |
|---|-----------|
| 1 | Motion Announcement |
| 2 | Preparation Phase |
| 3 | Debate Round 1 |
| 4 | Debate Round 2 |
| 5 | Closing Round |
| 6 | Final Judging |

---

## 3. Motion Announcement

Khi hệ thống công bố **Motion**:

- Host giới thiệu chủ đề tranh biện
- BGK và Host có thể: khuấy động không khí, nhận định mở đầu, câu hỏi định hướng, phân tích độ khó / tính tranh cãi của motion

**Ví dụ:**

- *"Liệu AI có nên thay thế giáo viên?"*
- *"Đây là motion có tính đối kháng rất cao."*

---

## 4. Preparation Phase

Sau khi Motion được công bố: hai đội có **7 phút** chuẩn bị trước khi trận chính thức bắt đầu.

### 4.1 Không gian chuẩn bị

- 1 **Main Room**
- 1 **Private Room** — đội Ủng hộ
- 1 **Private Room** — đội Phản đối

Trong thời gian chuẩn bị, thành viên mỗi đội có thể:

- Ra vào Private Room của đội mình
- Quay lại Main Room theo dõi Host / BGK
- Trao đổi chiến thuật với đồng đội

### 4.2 Hoạt động trong 7 phút

**Hai đội:** phân tích motion · chiến lược · phân công speaker · chuẩn bị lập luận · dự đoán phản biện đối phương.

**Host & BGK:** khuấy động · tạo áp lực tranh biện · tương tác khán giả · điều phối nhịp trận.

### 4.3 Kết thúc Preparation

- Host mời hai đội vào trận chính thức
- Speaker về Main Room
- Host giới thiệu lượt tranh biện đầu tiên

---

## 5. Quy tắc chung

### 5.1 Thứ tự phát biểu

**Đội Ủng hộ luôn trình bày trước.**

1. Proposition Speaker 1  
2. Opposition Speaker 1  
3. Proposition Speaker 2  
4. Opposition Speaker 2  
5. Proposition Speaker 3  
6. Opposition Speaker 3  

### 5.2 Bắt đầu tính giờ

Mỗi lượt chỉ bắt đầu tính giờ khi:

- Host cho phép bắt đầu, **hoặc**
- Hệ thống phát tín hiệu bắt đầu chính thức

**Ví dụ:** *"Speaker 1 của đội Ủng hộ, bạn có thể bắt đầu."* → đồng hồ speech được kích hoạt.

---

## 6. Thời gian tranh biện

| Loại | Quy định |
|------|----------|
| **Speech** | 4 phút / speaker |
| **Cross Examination** | Sau mỗi lượt S1 & S2: 3 phút / đội, tối đa **2 câu hỏi** / đội |
| **Judge feedback** | Sau mỗi lượt speaker: BGK nhận xét **3–5 phút** |
| **Prep giữa lượt** | Sau BGK: hai đội **1 phút** chuẩn bị |

Nếu còn dư thời gian, Host có thể: tương tác khán giả · tổng hợp diễn biến · tạo không khí tranh biện.

---

## 7. Debate Round 1 — Opening Arguments

### 7.1 Proposition Speaker 1

**Nhiệm vụ:** bối cảnh · định nghĩa · giới hạn phạm vi · lập trường đội Ủng hộ · lập luận chính đầu tiên.

→ Sau phần trình bày: **Cross Examination Phase**.

### 7.2 Opposition Speaker 1

**Nhiệm vụ:** phản biện định nghĩa/phạm vi (nếu cần) · lập trường đội Phản đối · phản biện đội Ủng hộ · lập luận chính đầu tiên.

→ Sau phần trình bày: **Cross Examination Phase**.

---

## 8. Debate Round 2 — Deep Clash

### 8.1 Proposition Speaker 2

Phản biện đối phương · bảo vệ luận điểm đội mình · bổ sung luận điểm mới · mở rộng phân tích và ví dụ.

→ **Cross Examination Phase**.

### 8.2 Opposition Speaker 2

Phản biện sâu đội Ủng hộ · bảo vệ luận điểm đội mình · bổ sung luận điểm mới · mở rộng phân tích và ví dụ.

→ **Cross Examination Phase**.

---

## 9. Closing Round — Final Summary

### 9.1 Proposition Speaker 3

- **Không** được đưa luận điểm mới
- Tổng hợp mâu thuẫn chính · so sánh hai bên · chỉ điểm yếu đối phương · chứng minh đội Ủng hộ vượt trội

**Không có chất vấn** ở vòng tổng kết.

### 9.2 Opposition Speaker 3

Tương tự 9.1 cho đội Phản đối. **Không có chất vấn.**

---

## 10. Quy tắc chất vấn (Cross Examination)

Áp dụng sau lượt trình bày của **Speaker 1 và Speaker 2** (mỗi bên).

### 10.1 Giới hạn

- Tối đa **2 câu hỏi** / đội
- **3 phút** thời gian riêng / đội
- Thời gian chỉ trừ khi đội đó **đang hỏi** hoặc **đang trả lời**

### 10.2 Luồng chuẩn

| Bước | Đội | Hành động |
|------|-----|-----------|
| 1 | Proposition | Hỏi câu 1 → **Pass Turn** |
| 2 | Opposition | Trả lời câu 1 → Hỏi câu 1 → **Pass Turn** |
| 3 | Proposition | Trả lời câu 1 → Hỏi câu 2 → **Pass Turn** |
| 4 | Opposition | Trả lời câu 2 → Hỏi câu 2 → **Pass Turn** |
| 5 | Proposition | Trả lời câu 2 → có thể **Finish** nếu còn thời gian |

### 10.3 Hoàn thành & phạt

Hoàn thành khi đã **hỏi đủ 2** và **trả lời đủ 2**.

Nếu hết giờ mà thiếu hỏi hoặc thiếu trả lời:

- Đội đó **mất điểm** phần còn thiếu
- Đối phương được **điểm tối đa** phần tương ứng

### 10.4 Nội dung chất vấn

- Không biến chất vấn thành speech mới · không độc thoại dài
- Câu hỏi: ngắn, trực tiếp, liên quan debate
- Câu trả lời: đúng trọng tâm, trả lời trực tiếp

### 10.5 Điều khiển hệ thống

| Action | Chức năng |
|--------|-----------|
| **Pass Turn** | Chuyển lượt cho đội đối phương |
| **Finish** | Kết thúc phần chất vấn |
| **Timer Sync** | Đồng bộ thời gian |
| **Auto Stop** | Tự dừng khi hết thời gian |

---

## 11. Quy tắc luận điểm mới

**Là luận điểm mới** nếu: claim mới · framework mới · mechanism mới · impact mới.

**Không tính là mới** nếu: làm rõ luận điểm cũ · thêm ví dụ · mở rộng phân tích từ lập luận đã có.

**Speaker 3 không được đưa luận điểm mới.**

---

## 12. Vai trò BGK (AI Judge / Human Judge)

**Sau mỗi lượt speaker:** nhận xét lập luận · phản biện · chất vấn · khả năng phản hồi · chấm điểm tạm.

**Sau trận:** kết quả cuối · công bố đội thắng · giải thích lý do.

---

## 13. Tiêu chí chấm điểm

| Tiêu chí | Điểm |
|----------|------|
| Logic & Reasoning | 30 |
| Rebuttal Quality | 20 |
| Evidence & Examples | 15 |
| Cross Examination | 15 |
| Strategy & Consistency | 10 |
| Communication & Clarity | 10 |
| **Tổng** | **100** |

---

## 14. Điều kiện chiến thắng

Đội thắng khi vượt trội về: hệ thống lập luận · phản biện · bảo vệ lập trường · chất vấn · trả lời chất vấn · các mâu thuẫn chính của trận.

---

## 15. Luồng thời gian tổng thể (25 bước)

1. Motion được công bố  
2. Host và BGK mở đầu  
3. Hai đội chuẩn bị **7 phút**  
4. Proposition Speaker 1 trình bày  
5. Cross Examination  
6. BGK nhận xét (3–5 phút)  
7. Hai đội prep **1 phút**  
8. Opposition Speaker 1 trình bày  
9. Cross Examination  
10. BGK nhận xét  
11. Prep 1 phút  
12. Proposition Speaker 2  
13. Cross Examination  
14. BGK nhận xét  
15. Prep 1 phút  
16. Opposition Speaker 2  
17. Cross Examination  
18. BGK nhận xét  
19. Prep 1 phút  
20. Proposition Speaker 3 tổng kết  
21. BGK nhận xét  
22. Prep 1 phút  
23. Opposition Speaker 3 tổng kết  
24. BGK đánh giá cuối  
25. Công bố kết quả  
