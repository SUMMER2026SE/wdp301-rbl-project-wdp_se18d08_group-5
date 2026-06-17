# Actors and Use Case Descriptions

**Project:** AI Debate Platform  
**Source documents:** `Overview.md`, `03_Role_System.md`, `05_Use_Cases.md`, `16_Screens_Flow_Authorization_Functions.md`, `Requirement_Specifications_Dev1.md`, `Requirement_Specifications_Dev5.md`  
**Purpose:** Describe the main actors and summarize the use cases shown in the attached use case diagrams.

---

## I. Overview

## 1. User Requirements

### 1.1 Actors

| # | Actor | Description |
|---|---|---|
| 1 | Admin | An authenticated account with administrator privileges. Admin can access public platform information and perform management actions such as monitoring users, rooms, and reports; updating user roles; banning or unbanning users; moderating rooms; and resolving reports. |
| 2 | User | An authenticated account that can use the main debate platform features. User can manage their own profile, view stats and debate history, create or join custom rooms, join ranked queue, watch live matches, interact with debate-related content, and receive system notifications. |
| 3 | Guest | An unauthenticated visitor. Guest can register, log in, use Google login, and browse public information such as public profiles, public matches, and the leaderboard. Guest must log in before using protected features such as creating rooms, joining ranked queue, or participating in debates. |

**Actor note:** Room Owner, Host, Debater, Judge, and Viewer are room-level roles assigned to an authenticated User after the user joins or creates a room. System is a supporting actor that handles authentication, matchmaking, timers, AI judging, scoring, notifications, and authorization.

### 1.2 Use Cases

#### a. Scope By Actor

| Actor | Main Use Cases |
|---|---|
| Admin | Register, Login, Login by Google, View Public Profile, View Public Matches, View Leaderboard, Admin Dashboard, Manage Users, Manage Rooms, Review Reports |
| User | Login, Login by Google, Logout, Reset Password, Update Profile, View Own Profile, Join Room as Viewer, Join Custom Room, Create Custom Room, View Leaderboard, Join Ranked Queue, View Public Matches, View Stats, Watch Live Match, Interact with Match Post, Receive Notification, View Debate History |
| Guest | Register, Login, Login by Google, View Public Profile, View Public Matches, View Leaderboard |

#### b. Descriptions

| ID | Feature | Use Case | Primary Actor(s) | Use Case Description |
|---|---|---|---|---|
| UC-01 | Authentication | Register | Guest | Guest creates a new account by submitting required registration information so that they can become an authenticated User of the platform. |
| UC-02 | Authentication | Login | Guest, User, Admin | Actor signs in with valid credentials to start an authenticated session and access role-appropriate features. |
| UC-03 | Authentication | Login by Google | Guest, User, Admin | Actor signs in through Google as an alternative login method. This use case extends Login. |
| UC-04 | Authentication | Logout | User, Admin | Authenticated actor ends the current session and clears local authentication state. |
| UC-05 | Authentication | Reset Password | Guest, User | Actor requests or completes password reset to recover account access when they cannot use the current password. |
| UC-06 | Profile | View Public Profile | Guest, User, Admin | Actor views another user's public profile, including display name, avatar, rank, ELO, and basic public statistics. |
| UC-07 | Profile | View Own Profile | User, Admin | Authenticated actor opens their own profile to review personal information, ranking, profile actions, and related debate activity. |
| UC-08 | Profile | Update Profile | User, Admin | Authenticated actor updates their own profile information such as display name, avatar, bio, school, or club. |
| UC-09 | Profile & Statistics | View Stats | Guest, User, Admin | Actor views a user's debate statistics, including wins, losses, ELO, rank tier, total debates, and average score when available. |
| UC-10 | Match Discovery | View Public Matches | Guest, User, Admin | Actor browses public live or waiting debate rooms with filters such as format, room type, and status. |
| UC-11 | Match Discovery | Watch Live Match | User, Viewer | Authenticated actor enters an active debate as a viewer to watch the main room, phase, timer, speaker information, and public chat according to room policy. |
| UC-12 | Room Management | Join Room as Viewer | User, Viewer | User joins an available room in viewer mode without taking debater, host, judge, or owner actions. This use case extends room joining when spectator mode is selected. |
| UC-13 | Room Management | Join Custom Room | User | User joins a custom room from the public match list or room invitation, enters the lobby, and may be assigned a room-level role. |
| UC-14 | Room Management | Create Custom Room | User | User creates a custom debate room and becomes Room Owner, then configures format, host mode, judge mode, visibility, and room access settings. |
| UC-15 | Matchmaking | Join Ranked Queue | User | User chooses a ranked format such as 1v1 or 3v3 and enters matchmaking so the system can create a ranked debate room when enough players are available. |
| UC-16 | Ranking | View Leaderboard | Guest, User, Admin | Actor views the global leaderboard sorted by ELO and can navigate to public profiles from ranking entries. |
| UC-17 | Debate History | View Debate History | User | User views previous completed debates, including motion, format, role, side, result, score, ELO change, and replay link when available. |
| UC-18 | Notification | Receive Notification | User | User receives system notifications for relevant events such as match found, room updates, role changes, kick or mute events, debate status changes, and report outcomes. |
| UC-19 | Match Interaction | Interact with Match Post | User | User interacts with debate-related posts or match discussion content, such as reading, reacting, commenting, or following a match thread when the community feature is available. |
| UC-20 | Administration | Admin Dashboard | Admin | Admin opens the admin dashboard to view overview metrics, users, rooms, reports, and moderation activity. |
| UC-21 | Administration | Manage Users | Admin | Admin searches and filters users, updates roles, reviews user details, and bans or unbans accounts according to platform rules. |
| UC-22 | Administration | Manage Rooms | Admin | Admin reviews room details, updates room status, moderates participants, kicks or mutes users, and manages viewer chat where permitted. |
| UC-23 | Administration | Review Reports | Admin | Admin reviews submitted reports, updates report status or resolution, adds notes, and applies moderation actions such as warning, muting, or banning. |

#### c. Use Case Relationships

| Base Use Case | Relationship | Related Use Case | Description |
|---|---|---|---|
| Login | `<<extend>>` | Login by Google | Google login is an optional authentication path that extends the normal login flow. |
| Join Custom Room | `<<extend>>` | Join Room as Viewer | Joining as viewer is an optional room-joining path when the actor wants to spectate instead of participating. |

