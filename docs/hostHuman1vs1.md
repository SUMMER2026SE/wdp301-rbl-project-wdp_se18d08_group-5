# hostHuman3vs3.md

# Human Host Debate Mode (3 vs 3)

## 1. Participants

### Host

Người điều phối toàn bộ trận đấu.

### Proposition Team

* Speaker 1
* Speaker 2
* Speaker 3

### Opposition Team

* Speaker 1
* Speaker 2
* Speaker 3

### Judges

Một hoặc nhiều giám khảo.

### Viewers

Người xem trận đấu.

---

# 2. Match Initialization

Khi trận đấu vừa được tạo:

## Host

Có toàn quyền điều phối.

## Debaters

* Được bật/tắt microphone.
* Được gửi chat trong Debate Room.
* Được vào Private Room của đội mình.

## Judges

* Được bật/tắt microphone.
* Được chat trong Debate Room.
* Được vào Judge Private Room.

## Viewers

* Xem và nghe toàn bộ Debate Room.
* Chỉ chat trong Viewer Chat.
* Không được bật microphone.
* Chỉ được nói khi Host cấp quyền.

---

# 3. Host Permissions

Host có các chức năng:

* Start Phase
* End Phase
* Pause Timer
* Resume Timer
* End Match
* Mute/Unmute participant microphone
* Enable/Disable participant chat
* Grant/Revoke speaking permission for viewers
* Enter any Private Room
* Exit Private Room

Host có thể truy cập:

* Proposition Private Room
* Opposition Private Room
* Judge Private Room

---

# 4. Debater Permissions

Debaters có thể:

* Bật/tắt microphone.
* Chat trong Debate Room.
* Chat trong Private Room của đội.
* Vào/thoát Private Room của đội.
* Xem timer hiện tại.

### End Phase Button

Trong các lượt phát biểu:

* Proposition Speaker 1
* Proposition Speaker 2
* Proposition Speaker 3
* Opposition Speaker 1
* Opposition Speaker 2
* Opposition Speaker 3

Người đang phát biểu được phép nhấn:

* End Phase

### Không được dùng End Phase

Trong:

* Preparation Phase
* Cross Examination

---

# 5. Judge Permissions

Judge có thể:

* Bật/tắt microphone.
* Chat trong Debate Room.
* Chat trong Judge Private Room.
* Gửi reaction:

  * Agree
  * Disagree
* Chấm điểm từng vòng.
* Gửi feedback.
* Gửi điểm lên hệ thống.
* Vào/thoát Judge Private Room.

---

# 6. Viewer Permissions

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

# 7. Private Rooms

Có 3 Private Rooms độc lập:

## Proposition Private Room

Chỉ gồm:

* Proposition Speaker 1
* Proposition Speaker 2
* Proposition Speaker 3
* Host

## Opposition Private Room

Chỉ gồm:

* Opposition Speaker 1
* Opposition Speaker 2
* Opposition Speaker 3
* Host

## Judge Private Room

Chỉ gồm:

* Judges
* Host

### Private Room Rules

* Âm thanh chỉ nghe được bởi thành viên trong cùng phòng.
* Chat chỉ hiển thị trong cùng phòng.
* Người ngoài phòng không nghe hoặc xem được nội dung.
* Có nút Enter Private Room.
* Có nút Exit Private Room.

---

# 8. Timer Rules

Mỗi phase có bộ đếm ngược riêng.

Khi thời gian hết:

* Timer dừng ở 00:00.
* Không tự động chuyển phase.
* Chờ Host nhấn Start Phase.

Host có thể:

* Pause
* Resume
* End Phase

---

# 9. Auto Mute Transition

Khi:

* Phase hết giờ.
* Host nhấn End Phase.
* Speaker nhấn End Phase.

Hệ thống thực hiện:

1. Tất cả microphone tự động tắt.
2. Chat Debate Room bị khóa.
3. Trạng thái kéo dài 3 giây.
4. Chuyển sang phase tiếp theo.
5. Chờ Host nhấn Start Phase.

Lưu ý:

Đây không phải lệnh cấm microphone.

Người dùng vẫn có thể bật lại microphone khi phase mới bắt đầu.

---

# 10. Debate Lifecycle

Motion Announcement

↓

Host Start

↓

Preparation Phase
(7 minutes OR Host End Phase OR toàn bộ thành viên hai đội End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Host Start

↓

Round 1 — Opening Arguments

↓

Proposition Speaker 1
(3 minutes OR Host End Phase OR Speaker End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Host Start

↓

Opposition Speaker 1
(3 minutes OR Host End Phase OR Speaker End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Host Start

↓

Cross Examination
(2 minutes OR Host End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Judge Feedback

↓

Host Start

↓

Round 2 — Deep Clash

↓

Proposition Speaker 2
(3 minutes OR Host End Phase OR Speaker End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Host Start

↓

Opposition Speaker 2
(3 minutes OR Host End Phase OR Speaker End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Host Start

↓

Cross Examination
(2 minutes OR Host End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Judge Feedback

↓

Host Start

↓

Closing Round — Final Summary

↓

Proposition Speaker 3
(3 minutes OR Host End Phase OR Speaker End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Host Start

↓

Opposition Speaker 3
(3 minutes OR Host End Phase OR Speaker End Phase)

↓

Mute Mic + Lock Chat (3s)

↓

Final Judging

↓

Result Announcement

↓

End Match
