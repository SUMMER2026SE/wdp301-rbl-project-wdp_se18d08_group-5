# Debate Rule — Consolidated (Hợp nhất toàn bộ Case Room)

**Nguồn tổng hợp từ:** rule_host_judgeAI.md, rule_host_judgeHuman.md, rule_noHost_JudgeAI.md, rule_noHost_JudgeHuman.md, ruleScore.md, Overview.md
**Mục đích:** Chuẩn hoá toàn bộ case room thành 1 nguồn duy nhất, bổ sung vai trò S1/Captain và số lượng Judge Human — vốn chưa được ghi rõ ràng trong các file gốc.

---

## 0. Ma trận Case Room

Có 3 trục biến số tạo ra toàn bộ case:

| Trục | Giá trị |
|---|---|
| **Team size** | 1vs1 · 3vs3 |
| **Host** | Có Host · Không Host |
| **Judge** | AI · Human (1 người) · Human (nhiều người) |

### Bảng toàn bộ case chính

| # | Host | Judge | Team size | Người giữ bảng điều khiển (Start/Skip/Pause/Mute...) | Người chấm điểm |
|---|---|---|---|---|---|
| 1 | Có | AI | 1v1 / 3v3 | Host | AI Judge |
| 2 | Có | Human | 1v1 / 3v3 | Host | Judge(s) |
| 3 | Không | AI | 1v1 | 2 người chơi tự phối hợp (auto-system điều phối phase) | AI Judge |
| 4 | Không | AI | 3v3 | 2 Captain (S1 mỗi đội) tự phối hợp (auto-system điều phối phase) | AI Judge |
| 5 | Không | Human (1 Judge) | 1v1 / 3v3 | Judge duy nhất (tự động = "Judge S1") | Judge đó |
| 6 | Không | Human (nhiều Judge) | 1v1 / 3v3 | Judge S1 (chỉ định trong nhóm Judge) | Judge S1 + các Judge khác |

> Case 3 & 4 gộp chung logic "No Host + Judge AI" nhưng khác nhau ở **ai là người phối hợp**: 1v1 thì chính 2 debater; 3v3 thì 2 Captain (S1) đại diện đội.
> Case 5 & 6 gộp chung logic "No Host + Judge Human" nhưng khác ở việc "Judge S1" là do **duy nhất 1 người tự động đảm nhiệm** hay **được chỉ định** trong nhóm nhiều Judge.

---

## 1. Vai trò Captain (S1) trong 3vs3

Trong chế độ **3vs3**, mỗi đội có 3 Speaker (S1, S2, S3), mỗi người phụ trách 1 round. **S1 đồng thời là Captain (đội trưởng)** và có thêm các quyền riêng ngoài quyền Debater thông thường:

| Quyền | Speaker thường (S2, S3) | Captain (S1) |
|---|---|---|
| Bật/tắt mic, chat, vào Private Room đội | ✅ | ✅ |
| Skip Phase trong lượt trình bày của **chính mình** | ✅ (chỉ khi đang là người nói) | ✅ (khi đến lượt S1) |
| Skip Prep / Skip CE (đại diện đội, cần cả 2 đội đồng thuận) | ❌ | ✅ |
| Nhấn **Start** (ở chế độ No Host + Judge AI) | ❌ | ✅ |
| Nhấn **Surrender** thay mặt đội | ❌ | ✅ |
| Nhấn / Chấp nhận **Request Draw** thay mặt đội | ❌ | ✅ |

> ⚠️ **Cần xác nhận (chưa chốt):** Trong 4 file luật gốc, Surrender/Request Draw được ghi là quyền chung của "Debaters" không phân biệt vị trí. Bảng trên áp dụng giả định **S1 độc quyền** các hành động đại diện đội. Nếu thực tế S2/S3 vẫn được bấm nhưng cần S1 xác nhận sau, cần cập nhật lại cột này.

### 1vs1 — không có khái niệm Captain riêng

Vì chỉ có 1 Speaker duy nhất đảm nhiệm cả 3 vị trí (S1 + S2 + S3), người này **mặc nhiên có toàn bộ quyền Captain** nêu trên trong suốt trận — không cần phân biệt.

---

## 2. Judge Human — 1 Judge vs Nhiều Judge

| | 1 Judge Human | Nhiều Judge Human |
|---|---|---|
| Chấm điểm / feedback / reaction | ✅ | ✅ (mỗi Judge độc lập) |
| Submit Score cuối | Judge đó tự submit | Cần tổng hợp từ tất cả Judge (xem `ruleScore.md` — tie-break có bước "toàn bộ Judge biểu quyết") |
| Vai trò khi **Có Host** | Không đổi — Host vẫn điều phối | Không đổi |
| Vai trò khi **Không Host** | Tự động là "Judge S1" → ôm toàn bộ bảng điều khiển Host | Cần **chỉ định** 1 người làm Judge S1 → người đó ôm bảng điều khiển; các Judge còn lại chỉ chấm điểm/feedback như bình thường |

> ⚠️ **Cần xác nhận (chưa chốt):** Khi No Host + nhiều Judge Human, nếu Judge S1 mất kết nối/rời phòng, có cơ chế chuyển giao quyền "S1" cho Judge khác không, hay quyền này cố định theo người được chỉ định từ đầu trận?

---

## 3. Cơ chế phối hợp khi Không Host + Judge AI (Rank Queue mặc định)

Đây là case đặc biệt vì **không ai giữ bảng điều khiển kiểu Host** — hệ thống tự vận hành:

* Timer tự động đếm ngược, hết giờ → mute 3s → tự đếm 10s → **tự động chuyển phase** (không cần ai bấm Start).
* Riêng việc **skip sớm** Preparation Phase và Cross Examination cần **cả 2 đội cùng đồng thuận**:
  - 1v1: 2 debater tự thoả thuận trực tiếp.
  - 3v3: 2 Captain (S1 mỗi đội) đại diện đội để đồng thuận.
* Nút **Start** đầu trận: cả 2 đội phải cùng nhấn (do S1/Captain đảm nhiệm ở 3v3, hoặc chính người chơi ở 1v1).

> ⚠️ **Cần xác nhận (chưa chốt):** Nếu 2 Captain bất đồng về việc skip Prep/CE — có cơ chế timeout (mặc định KHÔNG skip, chờ hết giờ tự nhiên) hay có luật xử lý tranh chấp khác? Giả định hiện tại: **không đồng thuận = không skip**, phase tiếp tục chạy đến hết giờ.

---

## 4. Bảng phân quyền tổng hợp theo từng case

### 4.1 Có Host (Judge AI hoặc Human) — không đổi theo team size

| Quyền | Host | Debater (S1/Captain) | Debater (S2/S3) | Judge (nếu Human) | Viewer |
|---|---|---|---|---|---|
| Start/Skip Phase, Pause/Resume, End Match | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mute/Unmute participant, Enable/Disable chat | ✅ | ❌ | ❌ | ❌ | ❌ |
| Grant speaking cho Viewer | ✅ | ❌ | ❌ | ❌ | ❌ |
| Vào mọi Private Room | ✅ | Chỉ phòng đội mình | Chỉ phòng đội mình | Chỉ Judge Room (nếu có) | ❌ |
| Skip Phase lượt nói của mình | — | ✅ | ✅ | — | — |
| Skip Prep/CE (đại diện đội) | — | ✅ | ❌ | — | — |
| Surrender / Request Draw | — | ✅ | ❌ | — | — |
| Chấm điểm, feedback, submit score | — | — | — | ✅ (nếu Judge Human) | — |

### 4.2 Không Host + Judge AI

| Quyền | Captain (S1) mỗi đội / người chơi (1v1) | Debater (S2/S3) | Viewer |
|---|---|---|---|
| Nhấn Start đầu trận (cần cả 2 đội) | ✅ | ❌ | ❌ |
| Skip Prep/CE (cần đồng thuận 2 đội) | ✅ | ❌ | ❌ |
| Skip Phase lượt nói của mình | ✅ | ✅ | ❌ |
| Surrender / Request Draw | ✅ | ❌ | ❌ |
| Pause/Resume, Mute thủ công | Không có — hệ thống tự động, không ai có quyền này | | |

### 4.3 Không Host + Judge Human (1 hoặc nhiều Judge)

| Quyền | Judge S1 (duy nhất hoặc được chỉ định) | Judge khác (nếu có) | Captain (S1 Debater) | Debater khác | Viewer |
|---|---|---|---|---|---|
| Start/Skip Phase, Pause/Resume, End Match | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mute/Unmute, Enable/Disable chat | ✅ | ❌ | ❌ | ❌ | ❌ |
| Grant speaking cho Viewer | ✅ | ❌ | ❌ | ❌ | ❌ |
| Vào mọi Private Room | ✅ | Chỉ Judge Room | Chỉ phòng đội mình | Chỉ phòng đội mình | ❌ |
| Chấm điểm, feedback, reaction, submit score | ✅ | ✅ | ❌ | ❌ | ❌ |
| Skip Phase lượt nói của mình | — | — | ✅ | ✅ | ❌ |
| Surrender / Request Draw | — | — | ✅ | ❌ | ❌ |

---

## 5. Luồng trận (chung, áp dụng mọi case — khác nhau ở "ai bấm Start" và "tốc độ chuyển phase")

```
Vào Room (timer không chạy)
   ↓ [Start bởi: Host / Judge S1 / 2 Captain-Debater đồng thuận]
Đếm ngược 3s
   ↓
[PREPARATION — 7 phút]
   Kết thúc khi: hết giờ | người điều phối skip | 2 Captain đồng thuận skip
   ↓ Mute + Lock Chat (3s) → chờ hoặc auto-đếm 10s → Start tiếp
══════ ROUND 1 — Opening ══════
S1 Prop (3') → S1 Opp (3') → Cross Examination (2')
   ↓
FREE TIME — Feedback + Chấm điểm (AI hoặc Judge)
══════ ROUND 2 — Deep Clash ══════
(giống Round 1, S2 thay S1 ở 3v3)
══════ ROUND 3 — Final Summary (không CE) ══════
S3 Prop (3') → S3 Opp (3')
   ↓
FREE TIME — Tổng kết điểm cuối (AI submit / Judge(s) submit)
   ↓ 10s hoặc View Result
Trang Result
```

Khác biệt duy nhất giữa các case nằm ở:
1. **Ai bấm Start/Skip** (bảng mục 4).
2. **Tốc độ chuyển phase**: Có người điều phối (Host/Judge S1) → chờ người đó bấm Start; Không Host + AI → tự động đếm 10s và chuyển.

---

## 6. Quy tắc chấm điểm (không đổi theo case — xem `ruleScore.md`)

| Category | Max Points |
|---|---:|
| Speaker 1 | 20 |
| Cross Examination 1 | 20 |
| Speaker 2 | 20 |
| Cross Examination 2 | 20 |
| Speaker 3 | 20 |
| **Total** | **100** |

**Tie-break:** So Speaker 3 → So tổng Round 2 → Toàn bộ Judge biểu quyết (chỉ áp dụng khi có Judge Human; case AI Judge cần bổ sung cơ chế tie-break riêng — **chưa được định nghĩa trong tài liệu gốc**).

---

## 7. Danh sách các điểm còn hở — cần chốt trước khi đưa vào code

| # | Vấn đề | Case liên quan | Trạng thái |
|---|---|---|---|
| 1 | Surrender/Draw trong 3v3: chỉ S1 độc quyền, hay S2/S3 bấm được nhưng cần S1 xác nhận? | Mọi case 3v3 | Chưa chốt |
| 2 | Judge S1 (No Host + nhiều Judge Human) rời phòng/mất kết nối → có chuyển giao quyền "S1" cho Judge khác không? | Case 6 | Chưa chốt |
| 3 | 2 Captain bất đồng skip Prep/CE (No Host + AI) → mặc định không skip hay có cơ chế xử lý khác? | Case 3, 4 | Giả định: không skip, chạy hết giờ |
| 4 | Tie-break cuối trận khi Judge là AI (không có "Judge biểu quyết") → dùng tiêu chí nào? | Case 1, 3, 4 | Chưa định nghĩa |
| 5 | Ai được chỉ định làm Judge S1 khi có nhiều Judge Human — do hệ thống random, do Room Owner chọn, hay do các Judge tự bầu? | Case 6 | Chưa chốt |

---

*Tài liệu này là bản hợp nhất/nháp dựa trên các file luật gốc + bổ sung của người dùng ngày 14/07/2026. Cần rà soát lại với team Product/BA trước khi đưa vào `01_Debate_Rule.md` chính thức.*
