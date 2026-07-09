# rule_noHost_JudgeHuman.md

# Debate Mode: No Host + Judge Human

---

## 1. Tổng quan

Không có Host trong chế độ này.
Các **chức năng của Host được chuyển giao cho Judge** — cụ thể là **Judge S1** (Judge đầu tiên / chính).

Luồng tổng thể **giống với chế độ Host + Judge Human**, ngoại trừ:
* Không có vai trò Host riêng biệt.
* Judge S1 đảm nhiệm tất cả chức năng điều phối mà Host thường làm.
* Judge S1 vẫn đồng thời thực hiện vai trò chấm điểm và feedback.

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

### Judges
Một hoặc nhiều giám khảo người thật.
**Judge S1** đảm nhiệm thêm các chức năng điều phối.

### Viewers
Người xem trận đấu.

---

## 3. Ghi chú chế độ 1vs1 và 3vs3

* **1vs1:** Mỗi đội có 1 Speaker duy nhất đảm nhiệm cả 3 round.
* **3vs3:** Mỗi đội có 3 Speaker khác nhau, mỗi người đảm nhiệm 1 round.

---

## 4. Match Initialization

Khi vào room, timer **không** tự đếm ngược.
Trận chỉ bắt đầu khi **Judge S1 nhấn Start** (thay thế cho Host).

### Debaters
* Được bật/tắt microphone.
* Được gửi chat trong Debate Room.
* Được vào Private Room của đội mình.

### Judges
* Được bật/tắt microphone.
* Được chat trong Debate Room.
* Được vào Judge Private Room.

### Viewers
* Xem và nghe toàn bộ Debate Room.
* Chỉ chat trong Viewer Chat.
* Không được bật microphone.
* Chỉ được nói khi Judge S1 cấp quyền.

---

## 5. Judge S1 Permissions (Quyền điều phối thay Host)

Judge S1 có các chức năng điều phối:

* Start Phase
* Skip Phase (End Phase sớm)
* Pause Timer
* Resume Timer
* End Match
* Mute/Unmute microphone của participant
* Enable/Disable chat của participant
* Grant/Revoke speaking permission cho Viewer
* Enter/Exit bất kỳ Private Room nào

Judge S1 có thể truy cập:
* Proposition Private Room
* Opposition Private Room
* Judge Private Room

### Judge S1 vẫn giữ quyền của Judge thông thường:
* Chấm điểm từng round.
* Gửi feedback.
* Gửi reaction: Agree / Disagree
* Submit Score lên hệ thống.

---

## 6. Judge (Không phải S1) Permissions

Các Judge còn lại có thể:
* Bật/tắt microphone.
* Chat trong Debate Room.
* Chat trong Judge Private Room.
* Gửi reaction: Agree / Disagree
* Chấm điểm từng round.
* Gửi feedback.
* Submit Score lên hệ thống.
* Vào/thoát Judge Private Room.

---

## 7. Debater Permissions

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
* Preparation Phase — chỉ Judge S1 hoặc cả 2 đội cùng skip
* Cross Examination — chỉ Judge S1 hoặc cả 2 đội cùng skip

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

Trừ khi Judge S1 cấp quyền nói.

---

## 9. Private Rooms

Có 3 Private Rooms độc lập:

### Proposition Private Room
* Proposition Speaker(s)
* Judge S1 (thay quyền Host)

### Opposition Private Room
* Opposition Speaker(s)
* Judge S1 (thay quyền Host)

### Judge Private Room
* Tất cả Judges (bao gồm Judge S1)

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
* Chờ Judge S1 nhấn Start để sang phase tiếp theo.

Judge S1 có thể:
* Pause timer
* Resume timer
* Skip Phase (kết thúc sớm)

---

## 11. Transition Between Phases

Khi một phase kết thúc (hết giờ / Judge S1 skip / Speaker skip / điều kiện skip đạt được):

1. Tất cả microphone tự động tắt.
2. Debate Chat bị khóa.
3. Hiển thị popup đếm ngược **3 giây** (kèm thông báo phase sắp tới).
4. Timer reset về **00:00**.
5. **Chờ Judge S1 nhấn Start** để bắt đầu phase tiếp theo.

---

## 12. Free Time (Between Rounds)

Sau khi kết thúc mỗi round (sau CE):
* Timer reset về 00:00.
* Tất cả participant được tự do: mở mic, chat, camera.
* Judges thực hiện nhận xét và chấm điểm round vừa xong.
* Chờ Judge S1 nhấn Start để sang round tiếp theo.

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

Sau khi match kết thúc (bằng bất kỳ hình thức nào):
* Trận đấu bị xóa khỏi danh sách Live Matches.
* Hệ thống tổng kết điểm (khi Judge submit score cuối cùng) và hiển thị kết quả 2 đội + đội chiến thắng.
* Sau **10 giây**, page tự động chuyển hướng đến trang Result.
* Hoặc user (Debater / Judge) có thể nhấn **View Result** để chuyển ngay.

---

## 15. Debate Lifecycle

```
Vào Room (timer không chạy)

↓ Judge S1 nhấn Start (thay quyền Host)

Đếm ngược 3s

↓

[PREPARATION PHASE — 7 phút]
Kết thúc khi: hết 7p | Judge S1 skip | cả 2 đội cùng skip

↓ Mute + Lock Chat (3s) → Timer reset 00:00

↓ Judge S1 nhấn Start

Đếm ngược 3s

↓

══════════════════════════
ROUND 1 — Opening Arguments
══════════════════════════

[S1 Proposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S1 Prop skip | Judge S1 skip

↓ Mute + Lock Chat (3s) — popup: "Tới lượt Opposition"

↓ Judge S1 nhấn Start → Đếm ngược 3s

[S1 Opposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S1 Oppo skip | Judge S1 skip

↓ Mute + Lock Chat (3s) — popup: "Chuẩn bị CE" → Timer reset 00:00

↓ Judge S1 nhấn Start → Đếm ngược 3s

[CROSS EXAMINATION — 2 phút]
Cả 2 đội đều được mở mic
Kết thúc khi: hết 2p | cả 2 đội cùng skip | Judge S1 skip

↓ Mute + Lock Chat (3s) — popup: "Hết Round 1" → Timer reset 00:00

[FREE TIME — Judges nhận xét & chấm điểm Round 1]
Tất cả participant tự do: mic, chat, camera
Chờ Judge S1 Start để tiếp tục

↓ Judge S1 nhấn Start → Đếm ngược 3s

══════════════════════════
ROUND 2 — Deep Clash
══════════════════════════

(Luồng giống Round 1 — S2 thay S1 ở chế độ 3vs3)

↓

[FREE TIME — Judges nhận xét & chấm điểm Round 2]

↓ Judge S1 nhấn Start → Đếm ngược 3s

══════════════════════════
ROUND 3 — Final Summary (chỉ có trình bày, không có CE)
══════════════════════════

[S3 Proposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S3 Prop skip | Judge S1 skip

↓ Mute + Lock Chat (3s) — popup: "Tới lượt Opposition"

↓ Judge S1 nhấn Start → Đếm ngược 3s

[S3 Opposition trình bày — 3 phút]
Kết thúc khi: hết 3p | S3 Oppo skip | Judge S1 skip

↓ Mute + Lock Chat (3s) — popup: "Finish Debate" → Đếm ngược 3s

[FREE TIME — Judges feedback & submit score cuối cùng]
Tất cả participant tự do: mic, chat, camera

↓ Judges submit score cuối cùng

Hệ thống tổng kết điểm → Hiển thị kết quả + đội chiến thắng

↓ 10s hoặc nhấn View Result

Chuyển đến trang Result
```
