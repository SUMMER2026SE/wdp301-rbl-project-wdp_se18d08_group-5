# Software Requirement Specification (SRS) - Features Documentation (Sections 4, 5, 6, 7, 8)

This document describes the software requirements and specifications for Sections 4, 5, 6, 7, and 8 of the AI Debate Platform, following the standard SRS template.

All screenshots below are captured directly from the **live running AI Debate Platform application**.

---

## 4. Match Discovery

### 4.1 View Live Match List
- **Function trigger**: User navigates to `/matches` or clicks "Live Matches" in the top navigation bar.
- **Function description**: Renders a list of all public debate rooms, including active live matches, waiting lobbies, and finished games.
- **Screen layout**:

![Live Matches List](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `page` (number, default: 1).
    - `limit` (number, default: 12).
    - `status` (string, optional: `all`, `waiting`, `active`, `completed`).
    - `format` (string, optional: `all`, `1v1`, `3v3`).
    - `roomType` (string, optional: `all`, `rank`, `custom`).
  - **Validation**: None.
  - **Business rule**: BR-01 (Public match visibility for all users and guests).
  - **Functionality**:
    - **Normal case**: Sends `GET /api/v1/rooms/public` and populates match cards with live viewer count, team rosters, format badges, and current match phase.
    - **Alternative case**: Displays empty state when no matches match selected search criteria.

### 4.2 Filter Matches by Format, Type, Status
- **Function trigger**: User selects filter options (Format: 1v1/3v3, Type: Rank/Custom, Status: Waiting/Active/Completed) on the `/matches` page.
- **Function description**: Dynamically filters displayed match rooms based on user preferences.
- **Screen layout**:

![Filter Matches Controls](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `format` (`1v1`, `3v3`).
    - `roomType` (`rank`, `custom`).
    - `status` (`waiting`, `active`, `completed`).
  - **Validation**: Filter values must match allowed enum sets.
  - **Business rule**: BR-01.
  - **Functionality**:
    - **Normal case**: Updates URL query parameters and re-fetches room list matching exact filters.

### 4.3 View Room Detail
- **Function trigger**: User clicks on a room card from `/matches` or navigates to `/rooms/:roomId/lobby` or `/debate/:roomId`.
- **Function description**: Retrieves complete metadata of a specific room, including topic motion, participants, judge assignments, and room rules.
- **Screen layout**:

![Room Detail Inspector](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: `roomId` must be a valid MongoDB ObjectId.
  - **Business rule**: BR-02 (Room state synchronization).
  - **Functionality**:
    - **Normal case**: Calls `GET /api/v1/rooms/:roomId` and renders room lobby or active arena interface.
    - **Abnormal case**: If room is not found, displays a "Room not found" notice and redirects to `/matches`.

### 4.4 Join Waiting / Ready Room
- **Function trigger**: User clicks "Join Room" button on a waiting or ready room card.
- **Function description**: Connects the user to a custom room lobby as a participant or spectator.
- **Screen layout**:

![Join Room Action](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `password` (string, optional) — required for private rooms.
  - **Validation**: Password must match if `isPrivate: true`. Room participant limit must not be exceeded.
  - **Business rule**: BR-03 (Room capacity rules: 2 debaters for 1v1, 6 debaters for 3v3).
  - **Functionality**:
    - **Normal case**: Hits `POST /api/v1/rooms/:roomId/join`, updates user session, and navigates to `/rooms/:roomId/lobby`.
    - **Alternative case**: If room requires a password, prompts user with a password input modal before joining.

### 4.5 Join Active Room as Viewer
- **Function trigger**: User clicks "Watch Live" on an active match card.
- **Function description**: Enters an active debate match as a spectator with view-only privileges.
- **Screen layout**:

![Join Active Room as Viewer](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: None (viewers can join active public matches freely).
  - **Business rule**: BR-06 (Spectators cannot speak or access private team rooms).
  - **Functionality**:
    - **Normal case**: Navigates user to `/debate/:roomId`, connects spectator socket, and renders live video stage and viewer chat.

---

## 5. Room Management

### 5.1 Create Custom Room
- **Function trigger**: User navigates to `/rooms/create` and submits the room creation form.
- **Function description**: Creates a new custom debate room with custom topic motion, format, and role configurations.
- **Screen layout**:

![Create Custom Room Form](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `title` (string) — required, room name.
    - `motion` (string) — required, debate topic proposition.
    - `format` (string, default: `1v1`) — `1v1` or `3v3`.
    - `roomType` (string, default: `custom`) — `custom`.
    - `isPrivate` (boolean, default: false).
    - `password` (string, optional).
    - `judgeType` (string, default: `ai`) — `ai`, `human`, or `hybrid`.
    - `hostType` (string, default: `human`) — `human` or `auto`.
  - **Validation**:
    - `title` must be between 3 and 100 characters.
    - `motion` must be between 10 and 300 characters.
  - **Business rule**: BR-04 (Room creator becomes Room Owner and initial Host).
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/rooms`, creates room in `waiting` status, and navigates creator to `/rooms/:roomId/lobby`.

### 5.2 Configure Room
- **Function trigger**: Room Owner updates parameters in the room creation form or lobby settings panel.
- **Function description**: Configures room rules, judge counts, private access passwords, and timing presets.
- **Screen layout**:

![Configure Room Settings](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `judgeCount` (number, range: 1–5).
    - `speakTimeMinutes` (number, default: 4).
    - `prepTimeMinutes` (number, default: 7).
  - **Validation**: Restricted to room owner.
  - **Business rule**: BR-04.
  - **Functionality**:
    - **Normal case**: Owner adjusts configuration settings, which updates form state prior to room creation or lobby lock.

### 5.3 Update Room
- **Function trigger**: Room Owner modifies lobby settings and clicks "Save Changes".
- **Function description**: Updates room metadata (title, motion, private status) while in lobby waiting state.
- **Screen layout**:

![Update Room Settings in Lobby](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `title`, `motion`, `isPrivate`, `password`.
  - **Validation**: Room status must be `waiting`.
  - **Business rule**: BR-04 (Cannot modify core format while room is `active`).
  - **Functionality**:
    - **Normal case**: Sends `PATCH /api/v1/rooms/:roomId` and broadcasts `room:updated` socket event to all lobby participants.

### 5.4 Delete / Cancel Room
- **Function trigger**: Room Owner clicks "Cancel Room" or "Delete Room" in lobby settings.
- **Function description**: Dissolves the room lobby and notifies connected participants.
- **Screen layout**:

![Delete / Cancel Room Action](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: User must be Room Owner.
  - **Business rule**: BR-04.
  - **Functionality**:
    - **Normal case**: Hits `DELETE /api/v1/rooms/:roomId`. Server deletes room, emits `room:cancelled` event, and redirects all participants to `/matches`.

### 5.5 Join Room
- **Function trigger**: Participant enters room lobby `/rooms/:roomId/lobby`.
- **Function description**: Registers participant presence in the room and opens real-time WebSocket room channel.
- **Screen layout**:

![Room Lobby Overview](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Participant must be authenticated.
  - **Business rule**: BR-03.
  - **Functionality**:
    - **Normal case**: Emits socket event `room:join`, receives current room state and participant list.

### 5.6 Leave Room
- **Function trigger**: User clicks "Leave Room" button in lobby or active debate stage.
- **Function description**: Disconnects user from the room and frees up their debater/judge slot.
- **Screen layout**:

![Leave Room Action Button](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: None.
  - **Business rule**: BR-05 (Leaving an active rank match counts as forfeit/surrender).
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/rooms/:roomId/leave` or socket `room:leave`. Server updates slot availability and broadcasts participant departure.

### 5.7 Select Team and Speaker Position
- **Function trigger**: Participant clicks an available slot button (e.g. Proposition S1, Opposition S2, Judge) in lobby.
- **Function description**: Assigns the user to a specific team (Proposition/Opposition) and speaker role (S1/S2/S3) or Judge slot.
- **Screen layout**:

![Select Team and Speaker Slot](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `team` (string) — `proposition`, `opposition`, or `judge`.
    - `speakerSlot` (string) — `S1`, `S2`, `S3`.
  - **Validation**: Selected slot must not be occupied or locked by another participant.
  - **Business rule**: BR-03 (Format constraints: 1v1 uses S1 slot for each team; 3v3 uses S1, S2, S3).
  - **Functionality**:
    - **Normal case**: Emits `room:select-slot`. Server updates participant slot and broadcasts `room:participant-update`.

### 5.8 Assign Participant Role
- **Function trigger**: Room Owner clicks "Assign Host" or "Assign Judge" on a participant card.
- **Function description**: Grants Host or Human Judge privileges to a specific lobby participant.
- **Screen layout**:

![Assign Participant Role](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `targetUserId` (string) — required.
    - `role` (string) — `host` or `judge`.
  - **Validation**: Only Room Owner can assign roles.
  - **Business rule**: BR-04, BR-19.
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/rooms/:roomId/assign-role` and updates role badges.

### 5.9 Lock Positions
- **Function trigger**: Room Owner toggles "Lock Positions" button in lobby.
- **Function description**: Prevents participants from changing teams or speaker slots once positions are finalized.
- **Screen layout**:

![Lock Positions Control](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `locked` (boolean) — required.
  - **Validation**: Restricted to Room Owner.
  - **Business rule**: BR-04.
  - **Functionality**:
    - **Normal case**: Emits `room:lock-positions`. Disables slot selection buttons for all lobby debaters.

### 5.10 Toggle Viewer Chat
- **Function trigger**: Host or Room Owner toggles "Viewer Chat" switch in lobby or debate arena.
- **Function description**: Enables or disables spectator chat window during the match.
- **Screen layout**:

![Toggle Viewer Chat Switch](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `enabled` (boolean) — required.
  - **Validation**: Requester must have host controls.
  - **Business rule**: BR-19.
  - **Functionality**:
    - **Normal case**: Hits `POST /api/v1/rooms/:roomId/viewer-chat` and broadcasts `room:viewer-chat-toggled`.

### 5.11 Start Debate
- **Function trigger**: Host or Room Owner clicks "Start Debate" button when all slots are filled and room status is `ready`.
- **Function description**: Transitions room from `ready` lobby to `active` debate match, launching the Motion phase.
- **Screen layout**:

![Start Debate Button](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**:
    - All required speaker slots (Pro S1, Opp S1, etc.) must be filled.
    - Room status must be `ready`.
  - **Business rule**: BR-07 (Debate startup sequence).
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/rooms/:roomId/start`. Server sets status to `active`, initializes debate session timer, and navigates all clients to `/debate/:roomId`.

### 5.12 Kick Participant in Lobby
- **Function trigger**: Room Owner clicks "Kick" icon next to a participant in the lobby list.
- **Function description**: Removes an unwanted participant from the room lobby.
- **Screen layout**:

![Kick Participant in Lobby](./srs_screen_layouts/private_team_room_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `userId` (string) — required.
  - **Validation**: Only Room Owner can kick participants in lobby.
  - **Business rule**: BR-04.
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/rooms/:roomId/kick` and emits `room:participant-kicked`.

---

## 6. Ranked Matchmaking

### 6.1 Join Ranked Queue
- **Function trigger**: User clicks "Find Ranked Match" button on `/matchmaking` and selects format (`1v1` or `3v3`).
- **Function description**: Places the user into the matchmaking queue to search for an opponent of similar ELO rating.
- **Screen layout**:

![Join Ranked Queue Interface](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `format` (string) — `1v1` or `3v3`.
  - **Validation**: User must be authenticated and not already in an active room or queue.
  - **Business rule**: BR-14 (ELO-based matchmaking search with expanding range brackets over time).
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/matchmaking/join`. Server pushes user to Redis/memory queue and starts match search worker.

### 6.2 Leave Ranked Queue
- **Function trigger**: User clicks "Cancel Search" button while in matchmaking queue.
- **Function description**: Removes user from the active matchmaking queue.
- **Screen layout**:

![Leave Ranked Queue Button](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**: None.
  - **Validation**: User must be currently in queue.
  - **Business rule**: BR-14.
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/matchmaking/leave`. Server cancels matchmaking search worker and resets UI state.

### 6.3 View Queue Status
- **Function trigger**: Real-time queue timer and status updates displayed while searching for a match.
- **Function description**: Displays search duration counter, current ELO search range bracket, and estimated wait time.
- **Screen layout**:

![Queue Status Radar Scanner](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `timeInQueueSeconds` (number).
    - `eloMin` / `eloMax` (number) — current rating search window.
  - **Validation**: None.
  - **Business rule**: BR-14 (Search range expands by ±50 ELO every 15 seconds).
  - **Functionality**:
    - **Normal case**: Client updates queue ticker every second and listens for `matchmaking:status-update` socket events.

### 6.4 Receive Match Found Notification
- **Function trigger**: Automatic server event emitted when matchmaking engine pairs compatible players.
- **Function description**: Notifies queued players that a match has been found and automatically transitions them to the created rank room.
- **Screen layout**:

![Match Found Alert Overlay](./srs_screen_layouts/matches_page_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — generated ranked room ID.
    - `assignedTeam` (string) — `proposition` or `opposition`.
    - `assignedSlot` (string) — `S1`, `S2`, or `S3`.
  - **Validation**: Server-side match verification.
  - **Business rule**: BR-14, BR-15 (Rank match auto-assignment).
  - **Functionality**:
    - **Normal case**: Server emits `matchmaking:match-found`. Client plays notification sound, displays "Match Found" banner, and auto-navigates to `/debate/:roomId`.

### 6.5 Auto-Create Ranked Room
- **Function trigger**: System backend execution when 2 (for 1v1) or 6 (for 3v3) debaters are paired.
- **Function description**: System automatically provisions a new rank debate room, assigns motions, debater slots, and launches auto-timer engine.
- **Screen layout**:

![Auto-Created Ranked Arena](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomType`: `rank`.
    - `hostType`: `auto`.
    - `judgeType`: `ai`.
  - **Validation**: System internal action.
  - **Business rule**: BR-15 (Rank rooms use AI Judge and Auto-timer system by default).
  - **Functionality**:
    - **Normal case**: Matchmaking service executes room creation, sets status to `ready` -> `active`, and initializes AI judge listener.

---

## 7. Debate Room

### 7.1 View Debate Room State
- **Function trigger**: User opens `/debate/:roomId`.
- **Function description**: Renders the live debate stage, video streams, active speaker focus, countdown timers, motion banner, and real-time chat.
- **Screen layout**:

![Debate Room Stage Overview](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: None.
  - **Business rule**: BR-09 (State synchronization across all room participants).
  - **Functionality**:
    - **Normal case**: Client fetches initial state via `GET /api/v1/debate/:roomId` and subscribes to `room:state` WebSocket stream.

### 7.2 Restore Room State After Reconnect
- **Function trigger**: Browser refresh or network reconnection while inside an active debate.
- **Function description**: Recovers current phase, exact remaining turn timer, active speaker, and transcript history upon reconnecting.
- **Screen layout**:

![Restored Debate Stage View](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `lastSequenceId` (number, optional).
  - **Validation**: Session token must match valid room participant.
  - **Business rule**: BR-16 (Seamless reconnection grace period without match disruption).
  - **Functionality**:
    - **Normal case**: On socket reconnect, client emits `room:reconnect`. Server sends current snapshot object to instantly sync client UI.

### 7.3 Start Phase
- **Function trigger**: Host clicks "Start Phase" button or phase auto-starts when timer expires.
- **Function description**: Initiates the active turn or phase (e.g. starting Proposition S1 Speech).
- **Screen layout**:

![Start Phase Host Control](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `phase` (string) — target phase name.
  - **Validation**: User must have host privileges.
  - **Business rule**: BR-19 (Role-Safe Host Controls).
  - **Functionality**:
    - **Normal case**: Host emits `debate:start-phase`. Server updates phase state and starts countdown timer.

### 7.4 Move to Next Turn
- **Function trigger**: Host clicks "Next Turn" button or speaker finishes speech.
- **Function description**: Advances debate sequence to the next speaker or phase in accordance with debate rules.
- **Screen layout**:

![Next Turn Host Button](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Host control required.
  - **Business rule**: BR-12 (Strict speaker order: Pro S1 -> Opp S1 -> Pro S2 -> Opp S2 -> Pro S3 -> Opp S3).
  - **Functionality**:
    - **Normal case**: Emits `debate:next-turn`. Server shifts turn, updates active speaker, and unmutes target microphone.

### 7.5 Finish Current Phase
- **Function trigger**: Host clicks "Finish Phase" or "End Turn Early".
- **Function description**: Ends the current speech or cross-examination phase before timer expiry.
- **Screen layout**:

![Finish Current Phase Control](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Host control required.
  - **Business rule**: BR-19.
  - **Functionality**:
    - **Normal case**: Emits `debate:finish-phase`. Server stops current phase timer and transitions to prep or feedback phase.

### 7.6 Pause Debate
- **Function trigger**: Host clicks "Pause Match" button.
- **Function description**: Freezes debate countdown timers, mutes microphones, and pauses turn execution.
- **Screen layout**:

![Pause Debate Overlay](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `reason` (string, optional).
  - **Validation**: Host control required.
  - **Business rule**: BR-17 (Pause duration limits to prevent abuse).
  - **Functionality**:
    - **Normal case**: Emits `debate:pause`. Server sets status to `paused`, freezes timer ticks, and displays "Debate Paused" banner on all clients.

### 7.7 Resume Debate
- **Function trigger**: Host clicks "Resume Match" button while match is paused.
- **Function description**: Unfreezes timers and restores active speech turn.
- **Screen layout**:

![Resume Debate Button](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Room status must be `paused`.
  - **Business rule**: BR-17, BR-19.
  - **Functionality**:
    - **Normal case**: Emits `debate:resume`. Server restores `active` status and resumes timer ticking.

### 7.8 End Debate
- **Function trigger**: Host clicks "End Debate Early" or match reaches final completion phase.
- **Function description**: Concludes the debate match early and triggers final judging deliberation.
- **Screen layout**:

![End Debate Host Action](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Host control required.
  - **Business rule**: BR-19.
  - **Functionality**:
    - **Normal case**: Emits `debate:end`. Server transitions room to `final_judging` phase.

### 7.9 Grant Speaking Permission
- **Function trigger**: System or Host enables microphone for active speaker.
- **Function description**: Unmutes microphone audio input stream for designated speaker of the current turn.
- **Screen layout**:

![Active Speaker Mic Granted](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `userId` (string) — required.
  - **Validation**: User must be active debater of the current turn.
  - **Business rule**: BR-06 (Only active debater of the turn has speaking permission).
  - **Functionality**:
    - **Normal case**: Server emits `voice:unmute-granted` to target debater's WebRTC audio channel.

### 7.10 Revoke Speaking Permission
- **Function trigger**: Turn timer expires or Host clicks "Mute Speaker".
- **Function description**: Mutes microphone audio input stream for debater whose turn has ended.
- **Screen layout**:

![Mute Active Speaker Control](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `userId` (string) — required.
  - **Validation**: None.
  - **Business rule**: BR-06.
  - **Functionality**:
    - **Normal case**: Server emits `voice:mute-enforced` and closes audio sending track.

### 7.11 Mute / Unmute Speaker
- **Function trigger**: Host clicks Mic toggle next to any speaker in participant list.
- **Function description**: Manual override to mute or unmute a debater's audio stream.
- **Screen layout**:

![Manual Mic Mute Control](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `targetUserId` (string) — required.
    - `muted` (boolean) — required.
  - **Validation**: Host control required.
  - **Business rule**: BR-19.
  - **Functionality**:
    - **Normal case**: Emits `debate:toggle-speaker-mute` and updates muted status icon.

### 7.12 Mute / Unmute Chat
- **Function trigger**: Host clicks "Mute Chat" on a participant's card.
- **Function description**: Restricts a participant from sending text chat messages in the room.
- **Screen layout**:

![Mute Participant Chat](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `targetUserId` (string) — required.
    - `chatMuted` (boolean) — required.
  - **Validation**: Host control required.
  - **Business rule**: BR-18, BR-19.
  - **Functionality**:
    - **Normal case**: Emits `debate:toggle-chat-mute`. Disables chat input for target user.

### 7.13 Issue Yellow Card
- **Function trigger**: Host clicks "Issue Yellow Card" button on an offending participant.
- **Function description**: Issues a formal warning yellow card for conduct violation or rules infraction.
- **Screen layout**:

![Issue Yellow Card Action](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `targetUserId` (string) — required.
    - `reason` (string) — required.
  - **Validation**: Host control required.
  - **Business rule**: BR-18 (Card penalty tracking logged in session record).
  - **Functionality**:
    - **Normal case**: Emits `debate:issue-card`. Displays yellow card toast notification across room and logs card entry in session data.

### 7.14 Kick Participant During Debate
- **Function trigger**: Host clicks "Kick Participant" during active debate.
- **Function description**: Evicts a participant or spectator from an active room.
- **Screen layout**:

![Kick Participant Control](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `targetUserId` (string) — required.
    - `reason` (string, optional).
  - **Validation**: Host control required.
  - **Business rule**: BR-19.
  - **Functionality**:
    - **Normal case**: Emits `debate:kick`. Forces client disconnect and redirects user to `/matches`.

### 7.15 Debater Surrender
- **Function trigger**: Active debater clicks "Surrender / Forfeit Match" button and confirms modal.
- **Function description**: Forfeits the match, awarding immediate victory to the opposing team.
- **Screen layout**:

![Debater Surrender Modal](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: User must be an active debater in the match.
  - **Business rule**: BR-10 (Surrender results in win for opponent and standard ELO deduction).
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/debate/:roomId/surrender`. Server ends match, sets winner to opposing team, and updates rankings.

### 7.16 Request Draw
- **Function trigger**: Debater clicks "Request Draw" button during match.
- **Function description**: Sends a mutual draw proposal to the opposing team.
- **Screen layout**:

![Request Draw Action](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Debater action.
  - **Business rule**: BR-10 (Draw takes effect only if opposing team accepts).
  - **Functionality**:
    - **Normal case**: Emits `debate:request-draw`. Prompts opposing team with Accept/Decline draw modal.

### 7.17 Submit Judge Score
- **Function trigger**: Human Judge fills out scoring rubrics (Matter, Manner, Method) and clicks "Submit Scores".
- **Function description**: Records human judge evaluation scores and feedback text for a speech or match.
- **Screen layout**:

![Judge Score Submission Form](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `scores` (object) — Pro & Opp team scores out of 100.
    - `feedback` (string, optional).
  - **Validation**: User must be assigned Judge. Scores must be between 0 and 100.
  - **Business rule**: BR-13 (Judges must submit scores before final verdict can be computed).
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/debate/:roomId/score`. Server saves score object.

### 7.18 Aggregate Scores
- **Function trigger**: Completion of scoring input from all assigned judges (Human and AI).
- **Function description**: Calculates weighted average scores across all judges for Proposition and Opposition.
- **Screen layout**:

![Aggregated Scores Panel](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Data**:
    - Array of individual judge score cards.
  - **Validation**: System automated execution.
  - **Business rule**: BR-13 (Weighted average calculation: AI Judge + Human Judges combined).
  - **Functionality**:
    - **Normal case**: System aggregates scores, computes total team totals, and generates final scoreboard.

### 7.19 Determine Winner
- **Function trigger**: Aggregation of final match scores.
- **Function description**: Determines the winning team (Proposition, Opposition, or Draw) based on final score totals.
- **Screen layout**:

![Winner Determination Banner](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Data**:
    - `totalProScore` (number).
    - `totalOppScore` (number).
  - **Validation**: System automated execution.
  - **Business rule**: BR-10 (Team with higher aggregated score wins; equal scores result in Draw).
  - **Functionality**:
    - **Normal case**: System sets `winner` field (`proposition`, `opposition`, `draw`) and triggers final verdict event.

### 7.20 Apply Result to Ranking
- **Function trigger**: Match completion in Ranked mode (`roomType: rank`).
- **Function description**: Computes ELO rating changes for debaters based on match outcome and updates player leaderboards.
- **Screen layout**:

![ELO Rating Adjustment Screen](./srs_screen_layouts/result_page_real.png)

- **Function details**:
  - **Data**:
    - Debater IDs, current ELOs, and match result.
  - **Validation**: Applies only to Ranked matches (`roomType: rank`).
  - **Business rule**: BR-14 (Standard ELO rating adjustment formula with K-factor 32).
  - **Functionality**:
    - **Normal case**: System updates `user.ranking.elo` in database, logs rating delta (e.g. `+24 ELO`), and refreshes leaderboard cache.

---

## 8. Debate Flow Engine

### 8.1 Motion Announcement Phase
- **Function trigger**: Room transitions to `active` status.
- **Function description**: Phase 1 of debate flow: displays topic motion banner, team lineups, and 30-second announcement timer.
- **Screen layout**:

![Motion Announcement Banner](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Duration**: 30 seconds.
  - **Business rule**: BR-12 (Debate phase sequence step 1).
  - **Functionality**: Displays motion title and counts down to Preparation phase.

### 8.2 Preparation 7 Minutes Phase
- **Function trigger**: Expiry of Motion Announcement phase.
- **Function description**: Phase 2 of debate flow: 7-minute strategy preparation period. Debaters access Private Team Rooms for team discussion.
- **Screen layout**:

![7-Minute Prep Phase View](./srs_screen_layouts/private_team_room_real.png)

- **Duration**: 7 minutes (420 seconds).
- **Business rule**: BR-12 (Step 2). Debaters can use Private Team Chat and voice channels.
- **Functionality**: Private team room tabs enabled. Countdown timer ticks down from 07:00.

### 8.3 Speech Turn Phase
- **Function trigger**: Completion of prep phase or turn transition.
- **Function description**: Main speech delivery phase (4 minutes per speaker). Alternates between Proposition and Opposition debaters (Pro S1 -> Opp S1 -> Pro S2 -> Opp S2).
- **Screen layout**:

![Speech Turn Stage View](./srs_screen_layouts/debate_room_real_1.png)

- **Duration**: 4 minutes (240 seconds) per speech turn.
- **Business rule**: BR-12 (Step 3). Only active speaker's microphone is unmuted. AI transcribes speech in real time.
- **Functionality**: Countdown timer ticks down from 04:00. Microphones for other participants locked.

### 8.4 Cross Examination Phase
- **Function trigger**: Completion of main speech turns.
- **Function description**: Phase 4 of debate flow: direct Q&A interaction between opposing teams.
- **Screen layout**:

![Cross Examination Stage View](./srs_screen_layouts/debate_room_real_1.png)

- **Duration**: Shared 3-minute timer or team question quotas (3 questions per team).
- **Business rule**: BR-11, BR-12 (Step 4). Active team submits questions; answering team responds.
- **Functionality**: Cross-exam input panel enabled. Remaining question quota counter displayed.

### 8.5 Judge Feedback Phase
- **Function trigger**: Completion of a speech or cross-exam phase.
- **Function description**: Phase 5 of debate flow: 2 to 3-minute intermission allowing human and AI judges to record feedback notes.
- **Screen layout**:

![Judge Feedback Intermission](./srs_screen_layouts/debate_room_real_2.png)

- **Duration**: 2 minutes (120 seconds).
- **Business rule**: BR-12 (Step 5). Judges submit turn feedback while stage timer counts down.

### 8.6 Preparation 1 Minute Phase
- **Function trigger**: Turn transition break between debate rounds.
- **Function description**: Phase 6 of debate flow: short 1-minute prep break for debaters before closing speeches.
- **Screen layout**:

![1-Minute Prep Intermission](./srs_screen_layouts/debate_room_real_1.png)

- **Duration**: 1 minute (60 seconds).
- **Business rule**: BR-12 (Step 6).
- **Functionality**: Short countdown timer displayed on stage.

### 8.7 Closing Speech Phase
- **Function trigger**: Transition to Speaker S3 turns.
- **Function description**: Phase 7 of debate flow: summary closing speeches delivered by Speaker 3 of each team without introducing new arguments.
- **Screen layout**:

![Closing Speech Phase View](./srs_screen_layouts/debate_room_real_1.png)

- **Duration**: 3 minutes per closing speech.
- **Business rule**: BR-12 (Step 7: Speaker S3 summary only; new arguments flagged).
- **Functionality**: S3 speaker unmuted; AI fallacy monitor screens for unintroduced claims.

### 8.8 Final Judging Phase
- **Function trigger**: Completion of all closing speeches.
- **Function description**: Phase 8 of debate flow: final judge deliberation phase where AI and human judges finalize total scores.
- **Screen layout**:

![Final Judging Deliberation](./srs_screen_layouts/debate_room_real_2.png)

- **Duration**: 3 minutes.
- **Business rule**: BR-12 (Step 8). Final scores aggregated; winner determined.
- **Functionality**: Stage displays "Judges Deliberating" overlay.

### 8.9 Completed Debate Phase
- **Function trigger**: Final verdict announcement.
- **Function description**: Phase 9 of debate flow: match concludes, winner announced, ELO updated, and match archived.
- **Screen layout**:

![Match Completed Overview](./srs_screen_layouts/result_page_real.png)

- **Business rule**: BR-10, BR-12 (Step 9).
- **Functionality**: Room status set to `completed`. Replay link `/result/:sessionId` generated.

### 8.10 Timer Warning and Completion
- **Function trigger**: Timer countdown reaching 30s, 10s, or 0s thresholds.
- **Function description**: Automatic server socket notifications warning debaters of impending turn/phase expiry and executing auto-phase transition on 0s.
- **Screen layout**:

![Timer Countdown Warning Display](./srs_screen_layouts/debate_room_real_1.png)

- **Data**:
  - `timeRemaining` (number).
  - `warningLevel` (`30s`, `10s`, `expired`).
- **Business rule**: BR-12 (Server-authoritative timer enforcement).
- **Functionality**: Server emits `timer:tick` every second and `timer:expired` at 0s, triggering auto-advance to next turn.

---

## Screen Layout Summary (Part 3)

| Section | Feature | Route / Interface | Layout Mockup |
|---------|---------|-------------------|---------------|
| §4 Match Discovery | View List, Filter, Room Detail, Join Waiting/Active | `/matches` | Live Matches Dashboard |
| §5 Room Management | Create, Configure, Update, Delete, Join, Leave, Select Slot, Lock, Start | `/rooms/create`, `/rooms/:roomId/lobby` | Custom Room Lobby |
| §6 Ranked Matchmaking | Join Queue, Leave Queue, Queue Status, Match Found, Auto-Create | `/matchmaking` | Matchmaking Console |
| §7 Debate Room | Room State, Reconnect, Host Controls (Start/Pause/Resume/Mute/Card/Kick), Surrender, Judge Score, Winner, ELO | `/debate/:roomId` | Debate Arena Stage |
| §8 Debate Flow Engine | Motion (30s), Prep (7m), Speech (4m), CE, Feedback, Prep (1m), Closing, Final Judging, Completed | System / Socket Engine | Debate Arena Stage & Timeline |
