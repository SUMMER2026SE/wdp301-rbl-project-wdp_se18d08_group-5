Bạn đã có quyền truy cập toàn bộ source code của project và thư mục .claude.

Hãy đọc toàn bộ các file .md trong .claude (rules, agents, skills, mobile guidelines...) rồi triển khai ứng dụng mobile Android hoàn chỉnh cho AI Debate Platform dựa trên website hiện tại.

Mục tiêu

Tạo app mobile có đầy đủ chức năng tương đương website.

Sử dụng backend API hiện có của dự án (không mock API).

Kết nối đúng authentication, websocket realtime, debate lifecycle, scoring, room, private room, rank queue, profile, history, result...

Tự sửa mobile code để chạy được end-to-end.

UI/UX phải tối ưu cho Android, không bê nguyên giao diện web sang mobile.

Không để crash, không lỗi compile, không warning nghiêm trọng.

Yêu cầu bắt buộc
1. Đọc rule trong .claude

Đọc toàn bộ file .md trong .claude.

Áp dụng đúng convention, architecture, coding style và mobile rules đã định nghĩa.

Không tự tạo style trái với rule.

2. Kết nối Backend thật

Cấu hình Base URL cho Android Emulator và thiết bị thật.

Kết nối toàn bộ API hiện có.

Kết nối Socket.IO realtime.

Xử lý token, refresh token, reconnect.

Không dùng dữ liệu giả.

3. Triển khai đầy đủ chức năng mobile

Authentication

Login

Register

Forgot password

Persist session

Home

Live matches

Rank queue

Create room

Room list

Filter / Search

Debate Room

Realtime timer

Current phase

Current speaker

Round info

Mic / camera controls

Debate chat

Viewer chat

Judge panel

Host control panel

Phase transition popup

Judge feedback

Score board

Result modal

Private Room

Enter / Exit

Private audio

Private chat

Permission đúng theo rule

Rank Queue

Matchmaking

Queue state

Auto join room

Sử dụng đúng mode No Host + AI Judge

Profile & History

Profile

Stats

Match history

Replay list

4. Debate Lifecycle

Triển khai đúng 100% tài liệu rule cho tất cả mode:

Host + Human Judge

Host + AI Judge

No Host + Human Judge

No Host + AI Judge

Đảm bảo realtime phase synchronization.

5. UI/UX Mobile

Không dùng layout desktop.

Thiết kế lại cho mobile:

Bottom navigation

Full-screen debate room

Floating mic button

Collapsible side panels

Bottom sheets cho chat / participant list

Responsive cho mọi kích thước Android

Dark mode đẹp và đồng nhất

Touch target tối thiểu 48dp

Animation mượt

6. Chất lượng code

Không duplicate logic.

Tuân thủ architecture hiện tại.

Tách service / state / UI rõ ràng.

Không hardcode API.

Không để memory leak.

Không để socket duplicate.

Không để crash khi mất mạng.

7. Kiểm tra cuối

Sau khi hoàn thành:

Tự chạy build Android.

Tự fix mọi lỗi compile.

Tự fix mọi lỗi runtime phát hiện được.

Rà soát toàn bộ flow chính.

Đảm bảo app có thể chạy được từ Login → Debate → Result.

Kết quả mong muốn

Một ứng dụng Android hoàn chỉnh cho AI Debate Platform, sử dụng backend thật, realtime đầy đủ, UI/UX tối ưu cho mobile và không phát sinh lỗi.
“Hãy ưu tiên sửa trực tiếp mobile app hiện có thay vì tạo project mới.”