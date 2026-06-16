# Requirement Specifications - Dev 5

**Project:** AI Debate Platform  
**Version:** v1.0  
**Date Created:** 16/06/2026  
**Owner:** Dev 5  
**Scope:** Live Matches, Spectate, Replay, Shared UI Support  
**References:** [Overview.md](./Overview.md), [05_Use_Cases.md](./05_Use_Cases.md), [09_Team_Task_Breakdown.md](./09_Team_Task_Breakdown.md)

---

## II. Requirement Specifications

## 1. Live Matches & Spectate

### 1.1 UC-65_Live Matches List & Filter

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-65_Live Matches List & Filter** |
| Created By | Dev 5 |
| Date Created | 16/06/2026 |
| Primary Actor | Guest / User |
| Secondary Actors | System |
| Trigger | Actor opens the Live Matches page. |
| Description | As a guest or user, I want to browse live debate matches so that I can find active rooms to watch. |
| Preconditions | The system has active or waiting debate rooms. |
| Postconditions | Live matches are displayed with filters and room summary information. |
| Normal Flow | 1. Actor opens the Live Matches page.<br>2. System retrieves available rooms from `GET /api/v1/rooms`.<br>3. System displays room cards with title/motion, format, room type, status, participant count, host/judge mode, and started time if available.<br>4. Actor applies filters such as 1v1, 3v3, rank, custom, waiting, or live.<br>5. System refreshes the list according to selected filters.<br>6. Actor clicks a room card or Spectate button to view a match. |
| Alternative Flows | 1. If no live room matches the filter, system displays an empty state.<br>2. If actor clears filters, system returns to the default live match list.<br>3. If realtime refresh is available, system updates the list without full page reload. |
| Exceptions | 1. If live match data cannot be loaded, system displays an error state and retry option.<br>2. If a selected room is no longer available, system shows a room unavailable message.<br>3. If network request fails, system keeps the previous list when possible. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-01, BR-02, BR-03, BR-04, BR-05 |
| Other Information | Dev 5 implements Live Matches page and realtime refresh; room state source depends on Dev 2/3. |
| Assumptions | Live room data is exposed by room APIs and/or socket events. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-01 | Public Live Match Access | Guest and authenticated users may view the Live Matches list. |
| BR-02 | Live Match Filters | MVP filters must support at least format `1v1/3v3` and room type `rank/custom`. |
| BR-03 | Room Visibility | Only rooms that are public, waiting, ready, or in-progress should appear in Live Matches. Deleted, cancelled, private-hidden, or completed rooms must not appear as live matches. |
| BR-04 | Room Summary Privacy | Live match cards must show public room summary only and must not expose private room password or internal participant metadata. |
| BR-05 | Realtime List Refresh | Live Matches should refresh when room status, participant count, or availability changes. |

### 1.2 UC-42_View Match As Viewer

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-42_View Match As Viewer** |
| Created By | Dev 5 |
| Date Created | 16/06/2026 |
| Primary Actor | Viewer |
| Secondary Actors | System |
| Trigger | Actor clicks Spectate from Live Matches or opens a spectate room URL. |
| Description | As a viewer, I want to spectate an active debate so that I can watch the match without participating. |
| Preconditions | Target room exists and allows viewing. |
| Postconditions | Viewer enters the Main Room in read-only spectator mode. |
| Normal Flow | 1. Viewer clicks Spectate on a live match.<br>2. System verifies room availability and viewer join policy.<br>3. System opens debate room in viewer mode.<br>4. System displays motion, phase, timer, speaker information, team panels, chat visibility according to policy, and live room status.<br>5. System prevents viewer from selecting participant positions, speaking, judging, or controlling the room. |
| Alternative Flows | 1. If viewer is not logged in, system may still allow public spectate for rooms that permit guest viewing.<br>2. If match is completed, system may redirect to replay when available. |
| Exceptions | 1. If room does not exist, system displays not found error.<br>2. If room does not allow viewers, system displays access denied message.<br>3. If room status changes while joining, system refreshes room state or redirects to Live Matches. |
| Priority | Must Have |
| Frequency of Use | Medium |
| Business Rules | BR-06, BR-07, BR-08, BR-09 |
| Other Information | Viewer join policy is implemented by Dev 5 backend task and depends on room ownership/state from Dev 2. |
| Assumptions | Viewer is not a debate participant, host, judge, or owner in the target room. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-06 | Viewer Read-Only Access | Viewers must not perform debater, host, judge, or owner actions. |
| BR-07 | Viewer Room Policy | A viewer may enter only rooms that are public and allow spectating. |
| BR-08 | Main Room Only | Viewers may watch the Main Room only and must not access team Private Rooms. |
| BR-09 | Spectate State Sync | Viewer screen must follow server-authoritative phase, timer, and room state. |

---

## 2. Replay

### 2.1 UC-66_View Replay

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-66_View Replay** |
| Created By | Dev 5 |
| Date Created | 16/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | User clicks Replay from debate history, completed room, or shared replay link. |
| Description | As a user, I want to view a replay of a completed debate so that I can review transcript, timeline, scores, and key match events. |
| Preconditions | Debate session is completed and replay data exists. |
| Postconditions | Replay timeline and transcript are displayed. |
| Normal Flow | 1. User opens replay page.<br>2. System calls `GET /api/v1/rooms/:id/replay`.<br>3. System verifies replay availability and access policy.<br>4. System displays replay metadata including motion, teams, format, result, scores, and completion time.<br>5. System displays timeline by debate phase and turn.<br>6. User selects a timeline item.<br>7. System jumps to the selected transcript section and shows speaker, side, phase, timestamp, content, and related feedback when available. |
| Alternative Flows | 1. User navigates between previous/next turns.<br>2. User opens replay from profile debate history.<br>3. If AI summary exists, system may display summary section from Dev 4 output. |
| Exceptions | 1. If replay does not exist, system displays replay unavailable message.<br>2. If room is not completed, system prevents replay viewing and may redirect to live room.<br>3. If transcript is partially missing, system displays available sections and marks missing data clearly. |
| Priority | Must Have |
| Frequency of Use | Medium |
| Business Rules | BR-10, BR-11, BR-12, BR-13, BR-14, BR-15 |
| Other Information | Dev 5 owns replay schema/data structure and replay UI; completed room/session data depends on Dev 2 and Dev 3. |
| Assumptions | Transcript per turn is persisted when debate session is completed. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-10 | Completed Replay Only | Replay must be available only for completed debate sessions. |
| BR-11 | Replay Data Structure | Replay must store timeline, phase, turn order, speaker, side, transcript content, timestamps, scores, result, and feedback references when available. |
| BR-12 | Transcript Per Turn | Transcript should be organized per debate turn so the UI can jump directly to a selected turn. |
| BR-13 | Replay Access | Authenticated users may view available replay data according to room visibility policy. |
| BR-14 | Replay Integrity | Replay data should be read-only after session completion except for system repair or admin maintenance. |
| BR-15 | Missing Replay Handling | If replay data is incomplete, the system must show a clear unavailable or partial-data state instead of crashing. |

---

## 3. Shared UI & Debate UI Support

### 3.1 FE-5_Shared UI Components

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **FE-5_Shared UI Components** |
| Created By | Dev 5 |
| Date Created | 16/06/2026 |
| Primary Actor | User |
| Secondary Actors | Dev 2, Dev 3, System |
| Trigger | Debate, lobby, live match, or replay pages need reusable UI components. |
| Description | As the product team, we need shared UI components so that room, live match, debate, and replay screens remain consistent and responsive. |
| Preconditions | Frontend project and design conventions are available. |
| Postconditions | Shared components are implemented and reusable by related features. |
| Normal Flow | 1. Dev 5 defines shared components for buttons, modals, cards, badges, room status indicators, team display, score breakdown, speech display, result announcement, and responsive debate layout.<br>2. Components accept typed props and avoid embedding feature-specific API logic when possible.<br>3. Dev 2/3 integrate components into lobby and debate room flows.<br>4. Dev 5 verifies responsive layout on desktop and mobile. |
| Alternative Flows | If a component is highly feature-specific, Dev 5 implements it near the feature module and exposes only reusable pieces. |
| Exceptions | 1. If required room/debate data shape is not finalized, component uses stable placeholders or loading states.<br>2. If API/socket data is unavailable, UI shows empty, loading, or error state. |
| Priority | Should Have |
| Frequency of Use | High |
| Business Rules | BR-16, BR-17, BR-18, BR-19 |
| Other Information | This is support scope, not a standalone product UC. It supports Dev 2/3 UI delivery. |
| Assumptions | Shared UI follows the existing frontend stack and styling approach. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-16 | Responsive UI | Live, lobby, debate, and replay screens must be usable on desktop and mobile. |
| BR-17 | Consistent Component Style | Shared UI components must use consistent spacing, typography, colors, and status labels across features. |
| BR-18 | Clear Loading And Error States | Components that depend on API/socket data must provide loading, empty, and error states. |
| BR-19 | Role-Safe Controls | UI must not display actionable controls to actors who do not have permission for those actions. |

