# AI Debate Platform — Documentation Index

**Phiên bản:** v1.1 (Rút gọn) | **Ngày:** 18/05/2026

> **Bắt đầu tại đây:** [Overview.md](./Overview.md) — tổng quan dự án, mô hình sản phẩm, MVP vs P2, bản đồ tài liệu.

---

## Thay đổi v1.1 (18/05/2026)

Scope MVP đã được **rút gọn** từ 110 UC xuống **~66 UC** để phù hợp với 5 dev / 6 tuần:
- Loại bỏ: Community feed, Tournament bracket, AI Host, Knowledge Bank, Portfolio/Badges, Credibility
- Đơn giản hóa: AI features (6 thay vì 12), Host controls (4 thay vì 7), Auth (6 thay vì 9)
- Dev 5 chuyển sang hỗ trợ Dev 2/3 thay vì làm community riêng

Chi tiết: xem [Overview.md §5](./Overview.md) — "Đã loại khỏi MVP".

---

## Danh sách tài liệu

| # | File | Loại | Nội dung |
|---|------|------|----------|
| — | [Overview.md](./Overview.md) | Tổng quan | Điểm vào: sản phẩm, MVP scope, map docs |
| 00 | [00_Presentation.md](./00_Presentation.md) | Pitch | Trình bày dự án — KH, nhà đầu tư, đối tác |
| 01 | [01_Debate_Rule.md](./01_Debate_Rule.md) | **Chuẩn** | Luật tranh biện (motion, prep, speech, CE, BGK) |
| 02 | [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md) | Sản phẩm | Ghép trận ELO, Custom Room, workflow |
| 03 | [03_Role_System.md](./03_Role_System.md) | Sản phẩm | Phân quyền: Debator, Host, Judge, Viewer, Owner |
| 04 | [04_TRD_Technical_Requirements.md](./04_TRD_Technical_Requirements.md) | Kỹ thuật | TRD: API, schema, kiến trúc |
| 05 | [05_Use_Cases.md](./05_Use_Cases.md) | Kỹ thuật | **66 use case** MVP — danh mục & luồng |
| 06 | [06_Development_Plan_6Weeks.md](./06_Development_Plan_6Weeks.md) | Kế hoạch | Timeline 6 tuần (rút gọn) |
| 07 | [07_AI_Integration_Guide.md](./07_AI_Integration_Guide.md) | Kỹ thuật | AI BGK, Speech Analysis, Toxic |
| 08 | [08_Socket_Realtime_Guide.md](./08_Socket_Realtime_Guide.md) | Kỹ thuật | Socket.IO, timer, Cross Examination |
| 09 | [09_Team_Task_Breakdown.md](./09_Team_Task_Breakdown.md) | Kế hoạch | Task từng developer (rút gọn) |
| 10 | [10_Idea_Build_Community.md](./10_Idea_Build_Community.md) | Ý tưởng | Roadmap Phase 2 (sau MVP) |

> **Lưu ý:** File `11_Use_Case_Detail.md` cần được cập nhật theo UC mới (66 UC). Hiện tại tham khảo nhưng số UC đã thay đổi.

---

## Đọc theo mục đích

### Pitch / đầu tư / đối tác

`Overview` → `00_Presentation` → `01_Debate_Rule` (tóm tắt)

### Phát triển MVP (6 tuần)

`Overview` → `01` → `02` → `03` → `05` → `06` → `09` → `04` → `07` + `08` khi code

### Phase 2 (sau MVP)

`10_Idea_Build_Community` — toàn bộ feature cộng đồng, tournament, portfolio

---

## Tech Stack

```
Frontend:  React + TypeScript + Vite + TailwindCSS + Zustand + Socket.IO Client
Backend:   Node.js + Express + TypeScript + Socket.IO + Mongoose
Database:  MongoDB Atlas
AI:        OpenAI GPT-4o API
Deploy:    Vercel (FE) + Render (BE) + MongoDB Atlas
```

---

## Team (MVP — v1.1)

| Dev | Feature |
|-----|---------|
| Dev 1 | Auth + User + ELO + Leaderboard |
| Dev 2 | Matchmaking + Custom Room + Debate Engine |
| Dev 3 | Socket.IO + Timer + Chat + Cross Examination |
| Dev 4 | AI BGK + Speech Analysis + Toxic Detection |
| Dev 5 | Live Matches + Replay + Hỗ trợ Dev 2/3 (UI) |

---

## Scope Lock

**MVP scope đã lock (v1.1).** Không thêm feature mới. Mọi ý tưởng mở rộng → ghi vào [10_Idea_Build_Community.md](./10_Idea_Build_Community.md) cho Phase 2.
