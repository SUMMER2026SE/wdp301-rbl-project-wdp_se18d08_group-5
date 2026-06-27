# rule_host_judgeAI.md

# Debate Mode: Host + Judge AI

---

## 1. Tổng quan

Chế độ này có **Host** người thật điều phối trận đấu.
**Judge** là AI — hệ thống tự động thu thập nội dung, sinh feedback và chấm điểm sau mỗi round và cuối trận.

Luồng tổng thể **giống với chế độ Host + Judge Human**, ngoại trừ:
* Phần feedback và submit score do **AI thực hiện và gửi lên hệ thống** thay vì Judge người thật.
* Không có Judge Private Room cho người thật.
* Host vẫn giữ nguyên toàn bộ chức năng điều phối.

---

## 2. Participants

### Host
Người điều phối toàn bộ trận đấu.

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
* **3vs3:** Mỗi đội có 3 Speaker khác nhau, mỗi người đảm nhiệm 1 round.

---

## 4. Match Initialization

Khi trận đấu được tạo, timer **không** tự đếm ngược.
Trận chỉ bắt đầu khi **Host nhấn Start**.

### Host
Có toàn quyền điều phối ngay từ đầu.

### Debaters
* Được bật/tắt microphone.
* Được gửi chat trong Debate Room.
* Được vào Private Room của đội mình.

### Viewers
* Xem và nghe toàn bộ Debate Room.
* Chỉ chat trong Viewer Chat.
* Không được bật microphone.
* Chỉ được nói khi Host cấp quyền.

---

## 5. Host Permissions

Host có các chức năng:

* Start Phase
* Skip Phase (End Phase sớm)
* Pause Timer
* Resume Timer
* End Match
* Mute/Unmute microphone của participant
* Enable/Disable chat của participant
* Grant/Revoke speaking permission cho Viewer
* Enter/Exit bất kỳ Private Room nào

Host có thể truy cập:
* Proposition Private Room
* Opposition Private Room

---

## 6. Debater Permissions

Debaters có thể:
* Bật/tắt microphone.
* Chat trong Debate Room.
* Chat trong Private Room của đội.
* Vào/thoát Private Room của đội.
* Xem timer hiện tại.
* Nhấn **Skip Phase** trong lượt phát biểu của mình.
* Nhấn **Surrender** trong suốt trận đấu.
* Nhấn **Request Draw** trong suốt trận đấu.

### Skip Phase
Người đang phát biểu được phép nhấn Skip Phase trong:
* Lượt trình bày (Opening / Deep Clash / Final Summary)

Không được nhấn Skip Phase trong:
* Preparation Phase — chỉ Host hoặc cả 2 đội cùng skip
* Cross Examination — chỉ Host hoặc cả 2 đội cùng skip

---

## 7. AI Judge

AI Judge không phải người dùng trong room.

AI Judge thực hiện:
* Thu thập nội dung phát biểu của từng round.
* Sinh feedback sau mỗi round (hiển thị lên màn hình trong Free Time).
* Chấm điểm từng round.
* Tổng kết và submit score cuối cùng sau Round 3.

AI Judge không có:
* Microphone.
* Khả năng chat trong Debate Room.
* Private Room riêng.

---

## 8. Viewer Permissions

Viewer có thể:
* Xem trận đấu.
* Nghe Debate Room.
* Xem Debate Chat.
* Chat trong Viewer Chat.

Viewer không được:
* Bật microphone.
* Chat trong Debate Room.

Trừ khi Host cấp quyền nói.

---

## 9. Private Rooms

Có 2 Private Rooms độc lập (không có Judge Private Room):

### Proposition Private Room
* Proposition Speaker(s)
* Host

### Opposition Private Room
* Opposition Speaker(s)
* Host

### Private Room Rules
* Âm thanh chỉ nghe được bởi thành viên trong cùng phòng.
* Chat chỉ hiển thị trong cùng phòng.
* Người ngoài phòng không nghe hoặc xem được nội dung.
* Có nút Enter Private Room và Exit Private Room.

---

## 10. Timer Rules

Mỗi phase có bộ đếm ngược riêng.

Khi thời gian hết:
* Timer dừng ở 00:00.
* Phase **không** tự động chuyển.
* Chờ Host nhấn Start để sang phase tiếp theo.

Host có thể:
* Pause timer
* Resume timer
* Skip Phase (kết thúc sớm)

---

## 11. Transition Between Phases

Khi một phase kết thúc (hết giờ / Host skip / Speaker skip / điều kiện skip đạt được):

1. Tất cả microphone tự động tắt.
2. Debate Chat bị khóa.
3. Hiển thị popup đếm ngược **3 giây** (kèm thông báo phase sắp tới).
4. Timer reset về **00:00**.
5. **Chờ Host nhấn Start** để bắt đầu phase tiếp theo.

---

## 12. Free Time (Between Rounds)

Sau khi kết thúc mỗi round (sau CE):
* Timer reset về 00:00.
* Tất cả participant được tự do: mở mic, chat, camera.
* **Hệ thống đợi AI sinh feedback** và hiển thị thông báo feedback lên màn hình.
* Chờ Host nhấn Start để sang round tiếp theo.

---

## 13. Surrender & Draw

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

## 14. Match End & Result

Sau khi match kết thúc:
* Trận đấu bị xóa khỏi danh sách Live Matches.
* **AI tổng kết điểm** và hệ thống hiển thị kết quả 2 đội + đội chiến thắng.
* Sau **10 giây**, page tự động chuyển hướng đến trang Result.
* Hoặc user (Debater / Host) có thể nhấn **View Result** để chuyển ngay.

---

## 15. Debate Lifecycle

```
Vào Room (timer không chạy)

↓ Host Start

Đếm ngược 3s

↓

[PREPARATION PHASE — 7 phút]
Kết thúc khi: hết 7p | Host skip | cả 2 đội cùng skip

↓ Mute + Lock Chat (3s) → Timer reset 00:00

↓ Host Start

Đếm ngược 3s

↓

══════════════════════════
ROUND 1 — Opening Arguments
══════════════════════════

[S1 Proposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S1 Prop skip | Host skip

↓ Mute + Lock Chat (3s) — popup: "Tới lượt Opposition"

↓ Host Start → Đếm ngược 3s

[S1 Opposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S1 Oppo skip | Host skip

↓ Mute + Lock Chat (3s) — popup: "Chuẩn bị CE" → Timer reset 00:00

↓ Host Start → Đếm ngược 3s

[CROSS EXAMINATION — 2 phút]
Cả 2 đội đều được mở mic
Kết thúc khi: hết 2p | cả 2 đội cùng skip | Host skip

↓ Mute + Lock Chat (3s) — popup: "Hết Round 1" → Timer reset 00:00

[FREE TIME — AI sinh feedback & hiển thị lên màn hình]
Tất cả participant tự do: mic, chat, camera
Chờ Host Start để tiếp tục

↓ Host Start → Đếm ngược 3s

══════════════════════════
ROUND 2 — Deep Clash
══════════════════════════

(Luồng giống Round 1 — S2 thay S1 ở chế độ 3vs3)

↓

[FREE TIME — AI sinh feedback Round 2]

↓ Host Start → Đếm ngược 3s

══════════════════════════
ROUND 3 — Final Summary (chỉ có trình bày, không có CE)
══════════════════════════

[S3 Opposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S3 Oppo skip | Host skip

↓ Mute + Lock Chat (3s) — popup: "Tới lượt Proposition"

↓ Host Start → Đếm ngược 3s

[S3 Proposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S3 Prop skip | Host skip

↓ Mute + Lock Chat (3s) — popup: "Finish Debate" → Đếm ngược 3s

[FREE TIME]
Tất cả participant tự do: mic, chat, camera
AI tổng kết điểm → Hiển thị kết quả + đội chiến thắng

↓ 10s hoặc nhấn View Result

Chuyển đến trang Result
```
