# rule_noHost_JudgeAI.md

# Debate Mode: No Host + Judge AI

---

## 1. Tổng quan

Không có Host trong chế độ này.
Toàn bộ luồng trận đấu được **hệ thống tự động điều khiển**.

**Judge** là AI — hệ thống tự động thu thập nội dung, sinh feedback và chấm điểm sau mỗi round và cuối trận.

> Đây cũng là cấu hình mặc định của **Rank Queue**: rank queue luôn là No Host + Judge AI.

Trận chỉ bắt đầu khi **cả 2 đội cùng nhấn Start** (nút Start do S1 đảm nhiệm ở chế độ 3vs3).

---

## 2. Participants

### Proposition Team
* Speaker 1 (S1)
* Speaker 2 (S2) — chỉ có ở chế độ 3vs3
* Speaker 3 (S3) — chỉ có ở chế độ 3vs3

### Opposition Team
* Speaker 1 (S1)
* Speaker 2 (S2) — chỉ có ở chế độ 3vs3
* Speaker 3 (S3) — chỉ có ở chế độ 3vs3

### AI Judge
Hệ thống AI tự động đánh giá — không phải người dùng trong room.

### Viewers
Người xem trận đấu.

---

## 3. Ghi chú chế độ 1vs1 và 3vs3

* **1vs1:** Mỗi đội có 1 Speaker duy nhất đảm nhiệm cả 3 round.
* **3vs3:** Mỗi đội có 3 Speaker khác nhau, mỗi người đảm nhiệm 1 round. Nút Start do S1 của mỗi đội đảm nhiệm.

---

## 4. Match Initialization

Khi vào room, timer **không** tự đếm ngược.
Trận chỉ bắt đầu khi **cả 2 đội cùng nhấn Start**.

### Debaters
* Được bật/tắt microphone.
* Được gửi chat trong Debate Room.
* Được vào Private Room của đội mình.

### Viewers
* Xem và nghe toàn bộ Debate Room.
* Chỉ chat trong Viewer Chat.
* Không được bật microphone.

---

## 5. Debater Permissions

Debaters có thể:
* Bật/tắt microphone.
* Chat trong Debate Room.
* Chat trong Private Room của đội.
* Vào/thoát Private Room của đội.
* Xem timer hiện tại.
* Nhấn **Start** (S1 của mỗi đội — để bắt đầu trận).
* Nhấn **Skip Phase** trong lượt phát biểu của mình.
* Nhấn **Surrender** trong suốt trận đấu.
* Nhấn **Request Draw** trong suốt trận đấu.

### Skip Phase
Người đang phát biểu được phép nhấn Skip Phase trong:
* Lượt trình bày (Opening / Deep Clash / Final Summary)

Preparation Phase kết thúc sớm khi:
* Cả 2 đội cùng skip (S1 của mỗi đội đảm nhiệm)

Cross Examination kết thúc sớm khi:
* Cả 2 đội cùng skip

---

## 6. AI Judge

AI Judge không phải người dùng trong room.

AI Judge thực hiện:
* Thu thập nội dung phát biểu của từng round.
* Sinh feedback sau mỗi round (hiển thị lên màn hình trong Free Time).
* Chấm điểm từng round.
* Tổng kết và submit score cuối cùng sau Round 3.

---

## 7. Viewer Permissions

Viewer có thể:
* Xem trận đấu.
* Nghe Debate Room.
* Xem Debate Chat.
* Chat trong Viewer Chat.

Viewer không được:
* Bật microphone.
* Chat trong Debate Room.

---

## 8. Private Rooms

Có 2 Private Rooms độc lập:

### Proposition Private Room
* Proposition Speaker(s)

### Opposition Private Room
* Opposition Speaker(s)

### Private Room Rules
* Âm thanh chỉ nghe được bởi thành viên trong cùng phòng.
* Chat chỉ hiển thị trong cùng phòng.
* Người ngoài phòng không nghe hoặc xem được nội dung.
* Có nút Enter Private Room và Exit Private Room.

---

## 9. Automatic Phase Transition

Khi một phase kết thúc (hết giờ / Speaker skip / điều kiện skip đạt được):

1. Tất cả microphone tự động tắt.
2. Debate Chat bị khóa.
3. Chờ **3 giây**.
4. Hệ thống đếm ngược **10 giây**.
5. Tự động chuyển sang phase tiếp theo.

---

## 10. Free Time (Between Rounds)

Sau khi kết thúc mỗi round (sau CE):
* Timer reset về 00:00.
* Tất cả participant được tự do: mở mic, chat, camera.
* **Hệ thống đợi AI sinh feedback** và hiển thị thông báo feedback lên màn hình.
* Sau khi hiển thị xong feedback, hệ thống tự đếm ngược **10 giây** rồi chuyển sang round tiếp theo.

---

## 11. Surrender & Draw

### Surrender
Nếu 1 trong 2 đội nhấn Surrender trong quá trình thi đấu:
* Hiển thị thông báo: đội [X] chấp nhận thua.
* Đội chiến thắng là đội còn lại.
* Match kết thúc ngay lập tức.

### Draw
Nếu 1 đội yêu cầu hòa và đội kia chấp thuận:
* Hiển thị thông báo: 2 đội hòa.
* Match kết thúc ngay lập tức.

---

## 12. Match End & Result

Sau khi match kết thúc:
* Trận đấu bị xóa khỏi danh sách Live Matches.
* **AI tổng kết điểm** và hệ thống hiển thị kết quả 2 đội + đội chiến thắng.
* Sau **10 giây**, page tự động chuyển hướng đến trang Result.
* Hoặc Debater có thể nhấn **View Result** để chuyển ngay.

---

## 13. Debate Lifecycle

Đếm ngược 3s

↓

[PREPARATION PHASE — 7 phút]
Kết thúc khi: hết 7p | cả 2 đội cùng skip

↓ Mute + Lock Chat (3s) → Đếm ngược 3s

↓

══════════════════════════
ROUND 1 — Opening Arguments
══════════════════════════

[S1 Proposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S1 Prop skip

↓ Mute + Lock Chat (3s) — popup: "Tới lượt Opposition" → Đếm ngược 3s

[S1 Opposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S1 Oppo skip

↓ Mute + Lock Chat (3s) — popup: "Chuẩn bị CE" → Timer reset 00:00 → Đếm ngược 3s

[CROSS EXAMINATION — 2 phút]
Cả 2 đội đều được mở mic
Kết thúc khi: hết 2p | cả 2 đội cùng skip

↓ Mute + Lock Chat (3s) — popup: "Hết Round 1" → Timer reset 00:00 → Đếm ngược 3s

[FREE TIME — Hệ thống đợi AI sinh feedback Round 1]
Tất cả participant tự do: mic, chat, camera
AI feedback hiển thị lên màn hình → Đếm ngược 10s

↓

══════════════════════════
ROUND 2 — Deep Clash
══════════════════════════

(Luồng giống Round 1 — S2 thay S1 ở chế độ 3vs3)

↓

[FREE TIME — AI sinh feedback Round 2 → Đếm ngược 10s]

↓

══════════════════════════
ROUND 3 — Final Summary (chỉ có trình bày, không có CE)
══════════════════════════

[S3 Proposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S3 Prop skip

↓ Mute + Lock Chat (3s) — popup: "Tới lượt Opposition" → Đếm ngược 3s

[S3 Opposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S3 Oppo skip

↓ Mute + Lock Chat (3s) — popup: "Finish Debate" → Đếm ngược 3s

[FREE TIME]
Tất cả participant tự do: mic, chat, camera
AI tổng kết điểm → Hiển thị kết quả + đội chiến thắng

↓ 10s hoặc nhấn View Result

Chuyển đến trang Result
```
