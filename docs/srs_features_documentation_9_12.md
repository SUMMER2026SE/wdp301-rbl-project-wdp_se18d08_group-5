# Software Requirement Specification (SRS) - Features Documentation

This document describes the software requirements and specifications for Sections 9, 10, 11, and 12 of the AI Debate Platform, following the standard SRS template.

All screenshots below are captured directly from the **live running AI Debate Platform application**.

---

## 9. Cross Examination

### 9.1 Ask CE Question
- **Function trigger**: A debater from the active team types a question in the Cross Examination input box and clicks the "Ask" button or presses the Enter key.
- **Function description**: Allows debaters to submit questions to the opposing team during the Cross Examination phase.
- **Screen layout**:

![Cross Examination Input Area](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required, the ID of the current debate room.
    - `team` (string) — required, the team of the active debater (`proposition` or `opposition`).
    - `question` (string) — required, the question content.
  - **Validation**:
    - The question content must not be empty.
    - Remaining question quota for the team must be greater than 0.
  - **Business rule**: BR-11 (quota per team limits), BR-12 (asking team turn validation), BR-13 (active CE phase only).
  - **Functionality**:
    - **Normal case**: When the CE phase is active, the input box is enabled. The debater types the question and submits it. The client emits the socket event `cross-exam:question` to the server, which broadcasts the question to the entire room and updates the remaining quota for that team.
    - **Alternative case**: If the team's quota is exhausted, the "Ask" button and input field are disabled.
    - **Abnormal case**: If the network connection is lost, the input is disabled and the reconnection overlay appears.

### 9.2 Submit CE Answer
- **Function trigger**: A debater from the answering team speaks or types their response to a question during the Cross Examination phase.
- **Function description**: Allows debaters to submit answers to the cross-examination questions in real time.
- **Screen layout**:

![Cross Examination Panel Overview](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `team` (string) — required, the answering team.
    - `answer` (string) — required, transcript of the spoken answer.
  - **Validation**:
    - The answer transcript must not be empty.
  - **Business rule**: BR-11, BR-13.
  - **Functionality**:
    - **Normal case**: The answering debater speaks. The speech is transcribed and sent via the socket event `cross-exam:answer`, updating the transcript of the debate.

### 9.3 Pass CE Turn
- **Function trigger**: A debater clicks the "Pass" button on the Cross-exam panel.
- **Function description**: Allows the active team to pass their turn, which consumes one question from their quota.
- **Screen layout**:

![Pass CE Button](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**:
    - The action must be performed by a debater belonging to the active asking team.
  - **Business rule**: BR-11, BR-12.
  - **Functionality**:
    - **Normal case**: The active debater clicks "Pass", which sends the socket event `cross-exam:pass-turn`. The server decrements the team's question quota and shifts focus or ends the phase if all quotas are used.

### 9.4 Finish CE Phase
- **Function trigger**: The host, owner, or Judge S1 clicks the "Finish CE" button.
- **Function description**: Immediately terminates the Cross Examination phase early.
- **Screen layout**:

![Finish CE Action](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**:
    - The user must have host controls (Host role, Room Owner, or Judge S1 in no-host rooms).
  - **Business rule**: BR-11, BR-19 (Role-Safe Controls).
  - **Functionality**:
    - **Normal case**: The controller clicks "Finish CE". The client emits `cross-exam:finish`, and the server immediately shifts the room phase to "judge_feedback" or the next scheduled phase.

### 9.5 Broadcast CE State Update
- **Function trigger**: Automatic server event triggered by timer ticks, quota updates, or phase transitions.
- **Function description**: Broadcasts the current Cross Examination status to all clients to keep the UI in sync.
- **Screen layout**:

![Shared CE Timer and Quota Status](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `activeTeam` (string) — the team currently allowed to ask questions.
    - `questionsPro` (number) — questions asked by Proposition.
    - `questionsOpp` (number) — questions asked by Opposition.
    - `timeRemainingPro`/`timeRemainingOpp` (number) — remaining speech/answer time.
    - `sharedRemaining` (number) — shared countdown timer for the CE phase.
  - **Validation**: None (server-side broadcast).
  - **Business rule**: BR-09 (Spectate State Sync).
  - **Functionality**:
    - **Normal case**: The server periodically broadcasts `cross-exam:update` with current stats. All clients receive this and update the countdown display and quota remaining gauges.

---

## 10. Chat & Communication

### 10.1 Main Room Chat
- **Function trigger**: A participant types a message and clicks Send or presses Enter in the Main Chat tab.
- **Function description**: Provides a real-time text chat channel for debaters, hosts, and judges in the main room.
- **Screen layout**:

![Main Chat Tab View](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `message` (string) — required, the text content.
  - **Validation**:
    - Content must not be empty.
    - Length must not exceed 500 characters.
    - The participant must not be chat-muted by the host.
  - **Business rule**: BR-18.
  - **Functionality**:
    - **Normal case**: The user sends a message. The client emits the `chat:send` event, and the server broadcasts the message to the main channel.

### 10.2 Viewer Chat
- **Function trigger**: A spectator/viewer types a message in the Viewer Chat tab and submits it.
- **Function description**: Separate chat room for viewers to interact without disrupting the active debate.
- **Screen layout**:

![Viewer Chat Tab View](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `message` (string) — required.
  - **Validation**:
    - Viewer chat must be enabled for the room.
  - **Business rule**: BR-08 (viewers only access main room).
  - **Functionality**:
    - **Normal case**: Viewer sends a message via `viewer-chat:send`. It is broadcasted exclusively to the viewer channel.

### 10.3 Toggle Viewer Chat Availability
- **Function trigger**: The host or owner toggles the "Viewer Chat" switch.
- **Function description**: Enables or disables the viewer chat feature in the room.
- **Screen layout**:

![Viewer Chat Toggle Switch](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `enabled` (boolean) — required.
  - **Validation**:
    - Requester must be host or owner.
  - **Business rule**: BR-19.
  - **Functionality**:
    - **Normal case**: Host toggles the switch. The client sends a request to `POST /api/v1/rooms/:roomId/viewer-chat`, and the server updates room settings and broadcasts `room:viewer-chat-toggled` to enforce client-side chat window lock.

### 10.4 Private Team Room
- **Function trigger**: A debater clicks the "Private Room" tab during the preparation phase.
- **Function description**: Enters the isolated team workspace for strategy formulation.
- **Screen layout**:

![Private Team Room Navigation](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `team` (string) — required (`proposition` or `opposition`).
  - **Validation**:
    - The user must be a debater of the specified team or room owner/host.
  - **Business rule**: BR-08 (Viewers cannot access private room).
  - **Functionality**:
    - **Normal case**: User is navigated to `/debate/:roomId/private/:team`. The client joins the corresponding socket room `private-room:join`.

### 10.5 Private Team Chat
- **Function trigger**: A debater submits a message inside the Private Room chat panel.
- **Function description**: Restricts text chat communication exclusively to members of the same team.
- **Screen layout**:

![Private Chat Input Panel](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `message` (string) — required.
  - **Validation**:
    - Access limited to debaters of the matching team or room host.
  - **Business rule**: BR-08.
  - **Functionality**:
    - **Normal case**: Message is sent via `private-chat:send` and distributed only to the team sub-room.

### 10.6 Voice Room Join/Leave
- **Function trigger**: Clicking the "Mic" icon toggle.
- **Function description**: Connects or disconnects the user from the room's WebRTC audio stream.
- **Screen layout**:

![Microphone Toggle Button](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `userId` (string) — required.
    - `action` (string) — `join` or `leave`.
  - **Validation**:
    - Microphones are subject to host muting.
  - **Business rule**: BR-06 (Viewers cannot speak).
  - **Functionality**:
    - **Normal case**: User toggles voice on. Client emits `voice:join`, initiates peer connection, and opens audio input. Toggling off emits `voice:leave` and closes audio tracks.

### 10.7 Voice Offer/Answer/ICE Signaling
- **Function trigger**: Peer connection negotiation between room participants.
- **Function description**: Relays WebRTC signaling data via the server to establish direct audio/video connections.
- **Function details**:
  - **Data**:
    - SDP offer, SDP answer, and ICE candidates.
  - **Functionality**:
    - Relays payloads via `voice:offer`, `voice:answer`, and `voice:ice-candidate` server events.

### 10.8 Live Translation Captions
- **Function trigger**: Speaking while translation captions are toggled active.
- **Function description**: Transcribes the speaker's audio and provides translated text captions at the bottom of the stage.
- **Screen layout**:

![Live Translation Caption Display](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `audioStream` (blob) — audio packets.
    - `targetLanguage` (string) — language to translate to (e.g. `en`, `vi`, `ja`).
  - **Functionality**:
    - Audio is sent via `translation:audio`, translated on the server, and sent back via `translation:caption` to be displayed dynamically.

---

## 11. AI Support

### 11.1 Analyze Speech
- **Function trigger**: Turn transition or completion of a speech.
- **Function description**: AI parses the turn transcript to extract key arguments, claims, fallacies, and structural strengths.
- **Screen layout**:

![AI Speech Analysis](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `transcript` (string) — required.
  - **Functionality**: Invokes `POST /api/v1/ai/analyze-speech` to obtain argument breakdown.

### 11.2 Score Argument
- **Function trigger**: Submission of a speech by debater.
- **Function description**: Evaluates the argument using pre-defined rubrics (logic, presentation, rebuttals).
- **Screen layout**:

![Real-Time Scoring Panel](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `transcript` (string).
  - **Functionality**: Calls `POST /api/v1/ai/score-argument`, returns a raw score out of 20.

### 11.3 Judge a Turn
- **Function trigger**: Completion of a speech phase.
- **Function description**: Automatically evaluates the active turn, generating scores and text feedback.
- **Screen layout**:

![AI Judge Status](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Functionality**: Server invokes `POST /api/v1/ai/judge-turn` and broadcasts `ai:turn-judged`.

### 11.4 Generate Final Verdict
- **Function trigger**: Completion of all speech and feedback rounds.
- **Function description**: Evaluates the overall performance and declares the official AI verdict on the match.
- **Function details**:
  - **Functionality**: Triggered via `POST /api/v1/ai/final-verdict` to generate scores and winner.

### 11.5 Generate Debate Summary
- **Function trigger**: Debate match finishes.
- **Function description**: Generates a high-level concise summary of the debate arguments for display on the results page.
- **Screen layout**:

![AI Verdict and Summary Panel](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Functionality**: Invokes `POST /api/v1/ai/summarize-debate`, saving the result under `session.aiSummary` for permanent replay view.

### 11.6 Toxic Content Check
- **Function trigger**: Real-time message send or speech transcription.
- **Function description**: Screens content to block insults, toxicity, and inappropriate terms.
- **Screen layout**:

![Toxic Content Monitor](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Functionality**: Hits `POST /api/v1/ai/check-toxic`. If flagged, blocks message and increments infraction warnings.

### 11.7 AI Unavailable Fallback
- **Function trigger**: AI API failure, quota limit, or timeout.
- **Function description**: Automatically falls back to manual human judging or displays warning placeholders.
- **Functionality**: If the AI response fails, client/server catches error, sets AI indicator to "unavailable" or "pending manual review" without disrupting debate room state.

---

## 12. Replay & Results

### 12.1 View Replay
- **Function trigger**: User opens the match results link `/result/:sessionId`.
- **Function description**: Renders the complete timeline, final scoreboard, and transcripts of a finished match.
- **Screen layout**:

![Match Replay/Result Overview](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Data**:
    - `sessionId` (string) — required.
  - **Functionality**: Sends `GET /api/v1/debate/:roomId/replay` to pull match records and display them.

### 12.2 View Final Scores
- **Function trigger**: Accessing the match results route.
- **Function description**: Displays points breakdown and final scoreboard for Proposition and Opposition.
- **Screen layout**:

![Scoreboard Breakdown Panel](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Business rule**: BR-11 (Replay Data Structure).
  - **Functionality**: Aggregates and displays scores out of 100 with progress bar visual indicators.

### 12.3 View Winner/Result
- **Function trigger**: Accessing the match results route.
- **Function description**: Highlights the determined winner with colored status badges (Proposition Wins / Opposition Wins / Draw Match).
- **Screen layout**:

![Winner Announcement Banner](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Business rule**: BR-10.
  - **Functionality**: Renders neon badge indicating the match outcome.

### 12.4 View Turn Timeline/Transcript
- **Function trigger**: Scrolling down the match results page.
- **Function description**: Shows detailed transcripts and judge evaluations organized by debate round and speaker.
- **Screen layout**:

![Timeline and Judges Feedback Section](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Business rule**: BR-12 (Transcript organized per turn).
  - **Functionality**: Shows round details, speech scores, CE scores, and text notes left by each judge.

### 12.5 View AI Summary
- **Function trigger**: Accessing the match results route.
- **Function description**: Renders the AI summary card at the bottom of the scoreboard.
- **Screen layout**:

![AI Summary Card](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Functionality**: Displays `session.aiSummary` text inside a permanent dark styling block.
