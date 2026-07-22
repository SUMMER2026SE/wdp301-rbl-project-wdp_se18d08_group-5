# Software Requirement Specification (SRS) - Features Documentation (Sections 13, 14, 15)

This document describes the software requirements and specifications for Sections 13, 14, and 15 of the AI Debate Platform, following the standard SRS template.

All screenshots below are captured directly from the **live running AI Debate Platform application**.

---

## 13. Forum / Community

### 13.1 View Topic List
- **Function trigger**: User clicks the "Forum" link in the main navigation bar or navigates to `/forum`.
- **Function description**: Displays all active community debate topics with search filters, sorting options, stance breakdown percentages, and overall platform forum metrics.
- **Screen layout**:

![Forum Topic List](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `search` (string, optional) — search keyword for filtering topics.
    - `filter` (string, optional) — filter category (`all`, `hot`, `controversial`).
    - `sortBy` (string, optional) — sort parameter (`active`, `newest`, `popular`).
    - `page` (number, default: 1), `limit` (number, default: 12).
  - **Validation**: None.
  - **Business rule**: BR-20 (Public community topics accessible to all users).
  - **Functionality**:
    - **Normal case**: Renders the Forum Dashboard with active topics grid, search bar, category pills, and statistics panel (total topics, opinions, and votes).
    - **Alternative case**: If no topics match the search filter, displays an empty state banner with a "Create Topic" prompt.

### 13.2 View Topic Detail
- **Function trigger**: User clicks on a topic card in the forum list or opens `/forum/:topicId`.
- **Function description**: Shows the complete topic details, motion title, description, voting stats (Agree vs Disagree percentage), top arguments, and post comments stream.
- **Screen layout**:

![Forum Topic Detail](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `topicId` (string) — required, unique topic identifier.
  - **Validation**: `topicId` must be a valid MongoDB ObjectId.
  - **Business rule**: BR-20.
  - **Functionality**:
    - **Normal case**: Sends `GET /api/v1/forum/topics/:topicId`, fetches full topic metadata, stance vote distribution, and user posts.
    - **Abnormal case**: If topic is not found, displays a 404 alert and a button to return to `/forum`.

### 13.3 Create Topic
- **Function trigger**: User clicks the "+ Create Topic" button on the forum page and submits the creation modal form.
- **Function description**: Allows authenticated users to propose a new debate topic or motion for community discussion.
- **Screen layout**:

![Create Topic Modal](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `title` (string) — required, topic title/motion.
    - `description` (string) — required, background information.
    - `category` (string, default: `general`) — topic domain (e.g. `ethics`, `society`, `technology`).
  - **Validation**:
    - `title` length must be between 10 and 200 characters.
    - `description` length must not exceed 2000 characters.
  - **Business rule**: BR-21 (Only authenticated users can create forum topics).
  - **Functionality**:
    - **Normal case**: Submits `POST /api/v1/forum/topics`. Server saves topic, sets initial votes count to 0, and redirects user to the newly created topic page.
    - **Alternative case**: Unauthenticated users clicking "Create Topic" are redirected to `/login`.

### 13.4 Set Stance (Agree / Disagree)
- **Function trigger**: User clicks the "Agree" (Pro) or "Disagree" (Opp) button on a forum topic.
- **Function description**: Records the user's opinion stance on a topic and updates real-time voting percentages.
- **Screen layout**:

![Set Topic Stance](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `topicId` (string) — required.
    - `stance` (string) — required (`agree` or `disagree`).
  - **Validation**: Stance must be either `agree` or `disagree`.
  - **Business rule**: BR-22 (One vote per user per topic; voting again toggles or changes stance).
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/forum/topics/:topicId/vote`. Server updates stance tallies and returns updated Agree/Disagree percentages.

### 13.5 Create Post
- **Function trigger**: User types an argument/opinion in the topic discussion form and clicks "Publish Argument".
- **Function description**: Publishes a structured argument post within a specific forum topic.
- **Screen layout**:

![Create Argument Post](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `topicId` (string) — required.
    - `stance` (string) — required (`agree` or `disagree`).
    - `content` (string) — required, text of the post.
  - **Validation**: `content` must be between 20 and 5000 characters.
  - **Business rule**: BR-21, BR-18 (Subject to toxic content moderation check).
  - **Functionality**:
    - **Normal case**: Emits `POST /api/v1/forum/topics/:topicId/posts`. Upon success, appends post card under the selected stance column.

### 13.6 Like / Unlike Post
- **Function trigger**: User clicks the Thumbs Up (Like) icon on a forum argument post card.
- **Function description**: Adds or removes a upvote to show endorsement of an argument.
- **Screen layout**:

![Like/Unlike Argument Post](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `postId` (string) — required.
  - **Validation**: User must be authenticated.
  - **Business rule**: BR-22 (Toggle behavior: liking an already liked post unlikes it).
  - **Functionality**:
    - **Normal case**: Hits `POST /api/v1/forum/posts/:postId/like`. Server increments/decrements like count and updates button active state.

### 13.7 View Comments
- **Function trigger**: User clicks the "Comments" collapse button on an individual post.
- **Function description**: Expands and loads nested discussion comments under a forum post.
- **Screen layout**:

![View Post Comments](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `postId` (string) — required.
  - **Validation**: None.
  - **Business rule**: BR-20.
  - **Functionality**:
    - **Normal case**: Sends `GET /api/v1/forum/posts/:postId/comments` and renders comment thread chronologically.

### 13.8 Add Comment
- **Function trigger**: User types in the comment input box under a post and clicks "Reply".
- **Function description**: Submits a reply comment under a specific forum argument post.
- **Screen layout**:

![Add Post Comment](./srs_screen_layouts/forum_page_real.png)

- **Function details**:
  - **Data**:
    - `postId` (string) — required.
    - `content` (string) — required.
  - **Validation**: `content` length must be between 2 and 1000 characters.
  - **Business rule**: BR-21.
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/forum/posts/:postId/comments` and updates comment list in real time.

---

## 14. Report & Moderation Request

### 14.1 Create Report
- **Function trigger**: User clicks "Report" on any content or participant modal.
- **Function description**: General reporting mechanism for flagging policy violations across the platform.
- **Screen layout**:

![Create Report Interface](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `targetType` (string) — required (`user`, `message`, `room`, `debate`, `other`).
    - `targetId` (string) — required.
    - `reason` (string) — required (e.g. `harassment`, `hate_speech`, `spam`, `cheating`, `other`).
    - `details` (string, optional) — supplementary explanation.
  - **Validation**: `reason` must not be empty.
  - **Business rule**: BR-25 (Report tickets created in `open` status for admin queue review).
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/reports`. Server saves report and returns confirmation ticket ID.

### 14.2 Report User
- **Function trigger**: Clicking "Report User" from a participant profile modal or leaderboard row.
- **Function description**: Flags a user account for inappropriate behavior, offensive profile, or repeated toxicity.
- **Screen layout**:

![Report User Modal](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `reportedUserId` (string) — required.
    - `reason` (string) — required.
    - `details` (string, optional).
  - **Validation**: Cannot report own user account.
  - **Business rule**: BR-25.
  - **Functionality**:
    - **Normal case**: Hits `POST /api/v1/reports/user` with target `user`. Ticket is logged under user moderation queue.

### 14.3 Report Message
- **Function trigger**: Hovering over a chat message and clicking the "Flag/Report" icon.
- **Function description**: Flags a specific chat message or speech transcript for toxic language, insults, or harassment.
- **Screen layout**:

![Report Message Interface](./srs_screen_layouts/debate_room_real_1.png)

- **Function details**:
  - **Data**:
    - `messageId` (string) — required.
    - `roomId` (string) — required.
    - `reason` (string) — required.
    - `messageSnippet` (string) — text snippet of flagged message.
  - **Validation**: Message must exist.
  - **Business rule**: BR-25, BR-18.
  - **Functionality**:
    - **Normal case**: Submits `POST /api/v1/reports/message`, linking message snippet and room context.

### 14.4 Report Room / Debate
- **Function trigger**: Clicking "Report Room" from the room options menu in lobby or debate arena.
- **Function description**: Flags an entire debate room for inappropriate motion, host abuse, or match disruption.
- **Screen layout**:

![Report Room Interface](./srs_screen_layouts/debate_room_real_2.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `reason` (string) — required.
    - `details` (string, optional).
  - **Validation**: Room must exist.
  - **Business rule**: BR-25.
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/reports/room`, attaching room metadata and active participants snapshot.

---

## 15. Administration

### 15.1 View Admin Overview
- **Function trigger**: Admin user accesses `/admin` or clicks "Admin Dashboard" in navigation.
- **Function description**: Displays high-level system analytics, metric cards (total users, active rooms, open reports, toxic message counts), and recent activity tables.
- **Screen layout**:

![Admin Dashboard Overview](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - System metrics summary object.
  - **Validation**: User must have `admin` role.
  - **Business rule**: BR-30 (Restricted to `admin` role only).
  - **Functionality**:
    - **Normal case**: Executes `GET /api/v1/admin/overview` and renders overview metric cards, user status breakdown, room status distribution, and recent reports.
    - **Abnormal case**: Non-admin users are redirected to `/` with an authorization error toast.

### 15.2 View User List
- **Function trigger**: Admin clicks the "Users" tab in the Admin Dashboard.
- **Function description**: Renders a paginated table of all registered users with role badges, verification status, ELO ratings, and action controls.
- **Screen layout**:

![Admin User Management Table](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `page` (number), `limit` (number, default: 10).
  - **Validation**: None.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Hits `GET /api/v1/admin/users` and displays user rows with pagination controls.

### 15.3 Search / Filter Users
- **Function trigger**: Admin types in the user search field or selects Role/Status dropdowns and clicks "Search".
- **Function description**: Filters user list by username, email, display name, role (`user`, `admin`), or status (`active`, `banned`, `pending`).
- **Screen layout**:

![Search and Filter Users](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `search` (string, optional).
    - `role` (string, optional).
    - `status` (string, optional).
  - **Validation**: None.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Sends `GET /api/v1/admin/users?search=...&role=...&status=...` and updates user table.

### 15.4 View User Detail / Activity
- **Function trigger**: Admin clicks on a user row or "View Activity" button.
- **Function description**: Retrieves comprehensive user profile data, rooms created/joined counts, and report history.
- **Screen layout**:

![User Detail Modal](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `userId` (string) — required.
  - **Validation**: Valid ObjectId.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Calls `GET /api/v1/admin/users/:userId` and pops up user detail card.

### 15.5 Update User Role
- **Function trigger**: Admin selects a new role (`user` or `admin`) from the role dropdown in a user table row.
- **Function description**: Changes a user's security role and access privileges.
- **Screen layout**:

![Update User Role Dropdown](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `userId` (string) — required.
    - `role` (string) — required (`user` or `admin`).
  - **Validation**: Cannot modify own admin account role.
  - **Business rule**: BR-31 (Self-role downgrade prohibited).
  - **Functionality**:
    - **Normal case**: Sends `PATCH /api/v1/admin/users/:userId/role`. Updates user permissions and refreshes table.

### 15.6 Ban User
- **Function trigger**: Admin clicks "Ban" button on a user row and submits the ban duration modal.
- **Function description**: Suspends a user account for a specified preset duration (`1h`, `24h`, `7d`, `30d`, `custom`) with a stated reason.
- **Screen layout**:

![Ban User Modal](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `userId` (string) — required.
    - `durationPreset` (string) — required (`1h`, `24h`, `7d`, `30d`, `custom`).
    - `customDurationValue` (number, optional).
    - `customDurationUnit` (string, optional: `minutes`, `hours`, `days`).
    - `reason` (string, optional).
  - **Validation**: Admin cannot ban their own account.
  - **Business rule**: BR-32 (Banned users are immediately blocked from authentication and active room sockets).
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/admin/users/:userId/ban`. Sets `isBanned: true`, calculates `bannedUntil`, and emits socket disconnect.

### 15.7 Unban User
- **Function trigger**: Admin clicks "Unban" button on a banned user row.
- **Function description**: Lifts an active ban from a suspended user account.
- **Screen layout**:

![Unban User Action](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `userId` (string) — required.
  - **Validation**: User must be currently banned.
  - **Business rule**: BR-32.
  - **Functionality**:
    - **Normal case**: Hits `POST /api/v1/admin/users/:userId/unban`. Resets `isBanned: false` and clears ban timestamps.

### 15.8 View Room List
- **Function trigger**: Admin clicks the "Rooms" tab in the Admin Dashboard.
- **Function description**: Displays all system debate rooms regardless of status, including room format, participant count, and host info.
- **Screen layout**:

![Admin Room List Table](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `page` (number), `limit` (number).
  - **Validation**: None.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Sends `GET /api/v1/admin/rooms` and populates room management table.

### 15.9 Search / Filter Rooms
- **Function trigger**: Admin inputs search query or selects Status, Type (`rank`, `custom`), or Format (`1v1`, `3v3`) filters.
- **Function description**: Filters room records in real time based on search criteria.
- **Screen layout**:

![Search and Filter Rooms](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `search` (string, optional).
    - `status` (string, optional).
    - `roomType` (string, optional).
    - `format` (string, optional).
  - **Validation**: None.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Calls `GET /api/v1/admin/rooms?status=...&roomType=...` and updates list view.

### 15.10 View Room Detail
- **Function trigger**: Admin clicks on a room title or "Manage Room" button.
- **Function description**: Shows complete room parameters, current phase, connected debaters, judges, and toxic chat logs.
- **Screen layout**:

![Admin Room Detail Modal](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
  - **Validation**: Valid ObjectId.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Hits `GET /api/v1/admin/rooms/:roomId` and opens detailed room management inspector.

### 15.11 Update Room Status
- **Function trigger**: Admin selects a new status (`waiting`, `ready`, `active`, `paused`, `completed`, `cancelled`) from room controls.
- **Function description**: Overrides the lifecycle state of a debate room.
- **Screen layout**:

![Update Room Status Control](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `status` (string) — required.
    - `reason` (string, optional).
  - **Validation**: None.
  - **Business rule**: BR-33 (State transitions broadcasted via WebSocket to all room clients).
  - **Functionality**:
    - **Normal case**: Emits `PATCH /api/v1/admin/rooms/:roomId/status`. Server updates room state and emits `admin:room-status-updated` event.

### 15.12 Kick Participant by Admin
- **Function trigger**: Admin clicks "Kick" icon next to a participant in room detail inspector.
- **Function description**: Forcefully removes a participant or spectator from a debate room.
- **Screen layout**:

![Kick Participant Action](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `userId` (string) — required.
    - `reason` (string, optional).
  - **Validation**: Participant must be inside the room.
  - **Business rule**: BR-33.
  - **Functionality**:
    - **Normal case**: Sends `POST /api/v1/admin/rooms/:roomId/kick`. Removes user from participant array and emits `admin:participant-kicked`.

### 15.13 Mute / Unmute Participant by Admin
- **Function trigger**: Admin toggles the Mute switch for a participant in room inspector.
- **Function description**: Mutes or unmutes a user's audio microphone or chat privilege in a live room.
- **Screen layout**:

![Mute/Unmute Participant Action](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `userId` (string) — required.
    - `muted` (boolean) — required.
    - `reason` (string, optional).
  - **Validation**: None.
  - **Business rule**: BR-33.
  - **Functionality**:
    - **Normal case**: Calls `POST /api/v1/admin/rooms/:roomId/mute`. Updates muted flag and broadcasts `admin:participant-muted`.

### 15.14 Toggle Room Viewer Chat by Admin
- **Function trigger**: Admin toggles the "Viewer Chat" switch for a room.
- **Function description**: Globally enables or disables spectator chat for a specific room.
- **Screen layout**:

![Toggle Viewer Chat Action](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `roomId` (string) — required.
    - `enabled` (boolean) — required.
  - **Validation**: None.
  - **Business rule**: BR-19, BR-33.
  - **Functionality**:
    - **Normal case**: Hits `POST /api/v1/admin/rooms/:roomId/viewer-chat` and updates viewer chat setting.

### 15.15 View Report List
- **Function trigger**: Admin clicks the "Reports" tab in the Admin Dashboard.
- **Function description**: Displays all moderation tickets submitted by users with status badges (`open`, `reviewing`, `resolved`, `dismissed`).
- **Screen layout**:

![Admin Report List Table](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `page` (number), `limit` (number).
  - **Validation**: None.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Sends `GET /api/v1/admin/reports` and populates moderation tickets table.

### 15.16 Search / Filter Reports
- **Function trigger**: Admin enters keywords or filters reports by Status or Target Type (`user`, `message`, `room`, `debate`).
- **Function description**: Filters report queue according to selected status and target.
- **Screen layout**:

![Search and Filter Reports](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `search` (string, optional).
    - `status` (string, optional).
    - `targetType` (string, optional).
  - **Validation**: None.
  - **Business rule**: BR-30.
  - **Functionality**:
    - **Normal case**: Calls `GET /api/v1/admin/reports?status=...&targetType=...` and updates ticket view.

### 15.17 Resolve / Dismiss Report
- **Function trigger**: Admin opens report modal and clicks "Resolve" or "Dismiss".
- **Function description**: Updates a report ticket status to `resolved` or `dismissed` with admin resolution notes.
- **Screen layout**:

![Resolve/Dismiss Report Modal](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `reportId` (string) — required.
    - `status` (string) — required (`resolved` or `dismissed`).
    - `resolution` (string) — required (`none`, `warned`, `muted`, `banned`, `dismissed`).
    - `adminNote` (string, optional).
  - **Validation**: None.
  - **Business rule**: BR-25, BR-30.
  - **Functionality**:
    - **Normal case**: Sends `PATCH /api/v1/admin/reports/:reportId`. Updates ticket status and records admin timestamp.

### 15.18 Apply Moderation Action from Report
- **Function trigger**: Admin selects a resolution action (`warned`, `muted`, `banned`) inside the report modal and submits.
- **Function description**: Automatically executes a penalty action (e.g. banning the reported user) directly from the report resolution interface.
- **Screen layout**:

![Apply Moderation Action Modal](./srs_screen_layouts/admin_overview_real.png)

- **Function details**:
  - **Data**:
    - `reportId` (string) — required.
    - `resolution` (string: `banned`).
    - `ban` (object, optional): `durationPreset`, `reason`.
  - **Validation**: Valid ban configuration if resolution is `banned`.
  - **Business rule**: BR-25, BR-32.
  - **Functionality**:
    - **Normal case**: Sends `PATCH /api/v1/admin/reports/:reportId` with `ban` payload. Simultaneously resolves ticket and applies ban to reported user.

---

## Screen Layout Summary (Part 2)

| Section | Feature | Route / Interface | Layout Mockup |
|---------|---------|-------------------|---------------|
| §13 Forum / Community | Topic List, Detail, Create Topic, Stance, Posts, Likes, Comments | `/forum`, `/forum/:topicId` | Forum Dashboard |
| §14 Report & Moderation | Create Report, Report User, Message, Room | `Report API` | Admin Overview & Room Arena |
| §15 Administration | Overview, Users, Rooms, Reports, Ban/Unban, Role Update, Status | `/admin` | Admin Dashboard |
