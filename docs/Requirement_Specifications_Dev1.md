# Requirement Specifications - Dev 1

**Project:** AI Debate Platform  
**Version:** v1.0  
**Date Created:** 15/06/2026  
**Owner:** Dev 1  
**Scope:** Auth, User Profile, User Stats, ELO, Leaderboard  
**References:** [Overview.md](./Overview.md), [05_Use_Cases.md](./05_Use_Cases.md), [09_Team_Task_Breakdown.md](./09_Team_Task_Breakdown.md)

---

## II. Requirement Specifications

## 1. Authentication & Authorization

### 1.1 UC-01_Register Account

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-01_Register Account** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | Guest |
| Secondary Actors | System |
| Trigger | Guest clicks the Register button or accesses the Register page directly. |
| Description | As a guest, I want to create a new account so that I can log in and use the debate platform. |
| Preconditions | Guest is not authenticated. |
| Postconditions | A new user account is created and stored in the system. |
| Normal Flow | 1. Guest opens the Register page.<br>2. Guest enters required information such as email, password, display name, and optional profile data.<br>3. System validates the input data.<br>4. System checks whether the email already exists.<br>5. System encodes the password.<br>6. System creates a new user account with default role and initial ELO.<br>7. System returns a successful registration response. |
| Alternative Flows | 1. Guest cancels registration and returns to the previous page.<br>2. Guest already has an account and clicks Login, then changes to **UC-02_Login**. |
| Exceptions | 1. If required fields are missing, system returns a validation error.<br>2. If email format is invalid, system returns a validation error.<br>3. If email already exists, system rejects the registration.<br>4. If password does not meet policy, system rejects the registration. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-01, BR-02, BR-03, BR-04, BR-05 |
| Other Information | MVP does not include forgot password or reset password. |
| Assumptions | User registers with a valid and unique email address. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-01 | Password Encoding | User password must be encoded before being stored in the database. Plain text passwords must never be stored or returned by API. |
| BR-02 | Unique Email | Each account email must be unique in the system. Registration with an existing email must be rejected. |
| BR-03 | Required Registration Data | Registration must require at least valid email, password, and display name. |
| BR-04 | Password Policy | Password must satisfy minimum security requirements defined by validation schema. |
| BR-05 | Default Account Values | New user accounts must be created with default role `user`, active status, initial ELO, and default stats. |

### 1.2 UC-02_Login

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-02_Login** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | Guest / User |
| Secondary Actors | System |
| Trigger | User clicks Login or accesses an authenticated feature while not logged in. |
| Description | As a user, I want to log in to the system so that I can access authenticated features and my personalized account. |
| Preconditions | User account has been created and is active. |
| Postconditions | User is authenticated and receives valid access and refresh tokens. |
| Normal Flow | **2.0 Email/Password Login**<br>1. User opens the Login page.<br>2. User enters email and password.<br>3. System validates input format.<br>4. System verifies account existence.<br>5. System compares the submitted password with the encoded password.<br>6. System checks whether the account is banned or blocked.<br>7. System issues access token and refresh token.<br>8. System redirects user to the home page or previous requested page. |
| Alternative Flows | **2.1 Google Login**<br>1. User clicks Login with Google.<br>2. System redirects user to Google's login/consent screen or receives Google credential from client.<br>3. User completes Google authentication.<br>4. System validates Google token and extracts verified email/profile data.<br>5. System finds existing account by email or creates a new account if allowed.<br>6. System checks whether the account is banned or blocked.<br>7. System issues access token and refresh token.<br>8. Return to step 8 of normal flow.<br><br>**2.2 Register Navigation**<br>1. User clicks Register, then changes to **UC-01_Register Account**.<br><br>**2.3 Cancel Login**<br>1. User cancels login and returns to public pages. |
| Exceptions | 1. If email or password is incorrect, system rejects login.<br>2. If Google token is invalid, expired, or unverifiable, system rejects login.<br>3. If Google email is missing or not verified, system rejects login.<br>4. If account is banned or blocked, system rejects login.<br>5. If input data is invalid, system returns a validation error. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-01, BR-03, BR-04, BR-06, BR-07, BR-20, BR-21 |
| Other Information | Access token is used for API authorization. Refresh token is used to renew access. |
| Assumptions | User remembers login credentials. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-01 | Password Encoding | User password must be encoded before being stored in the database. Plain text passwords must never be stored or returned by API. |
| BR-03 | Required Registration Data | Registration must require at least valid email, password, and display name. |
| BR-04 | Password Policy | Password must satisfy minimum security requirements defined by validation schema. |
| BR-06 | Token Authentication | Protected APIs must require a valid JWT access token in the Authorization Bearer header. |
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |
| BR-20 | Google Token Verification | Google login must validate the Google credential/token with Google's official verification mechanism before issuing platform tokens. |
| BR-21 | Google Account Mapping | Google login must map account by verified email; if no account exists, the system may create a new user account with default role, initial ELO, and Google profile data. |

### 1.3 UC-03_Logout

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-03_Logout** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | User clicks the Logout button. |
| Description | As a user, I want to log out so that my session is ended safely on the current device. |
| Preconditions | User is authenticated. |
| Postconditions | User token/session data is removed from the client and the user becomes unauthenticated. |
| Normal Flow | 1. User clicks Logout.<br>2. System clears authentication state on client.<br>3. System invalidates or removes refresh session if supported.<br>4. System redirects user to public page or Login page. |
| Alternative Flows | User closes the browser without clicking Logout; client-side token state may expire naturally. |
| Exceptions | If logout API fails, client still clears local authentication state. |
| Priority | Must Have |
| Frequency of Use | Medium |
| Business Rules | BR-06, BR-08 |
| Other Information | Logout is part of basic Auth MVP. |
| Assumptions | Client stores tokens securely according to implementation design. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-06 | Token Authentication | Protected APIs must require a valid JWT access token in the Authorization Bearer header. |
| BR-08 | Refresh Token Rule | Access token may be renewed only when refresh token/session is valid and the user account is active. |

### 1.4 UC-04_Refresh Access Token

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-04_Refresh Access Token** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | Access token expires while user is still using the system. |
| Description | As a user, I want the system to refresh my access token so that I can continue using authenticated features without logging in again. |
| Preconditions | User has a valid refresh token/session. |
| Postconditions | A new access token is issued. |
| Normal Flow | 1. Client detects access token expiration or receives an unauthorized response.<br>2. Client sends refresh token request.<br>3. System validates the refresh token.<br>4. System checks user status.<br>5. System issues a new access token.<br>6. Client retries the original request if applicable. |
| Alternative Flows | If refresh token is close to expiration, system may issue a new refresh token according to implementation design. |
| Exceptions | 1. If refresh token is invalid or expired, system rejects the request.<br>2. If user is banned, system rejects token refresh.<br>3. If refresh fails, client redirects user to Login. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-06, BR-07, BR-08 |
| Other Information | Axios interceptors should support automatic refresh. |
| Assumptions | Refresh token is available when user session is still valid. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-06 | Token Authentication | Protected APIs must require a valid JWT access token in the Authorization Bearer header. |
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |
| BR-08 | Refresh Token Rule | Access token may be renewed only when refresh token/session is valid and the user account is active. |

### 1.5 UC-05_Get Current Session

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-05_Get Current Session** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | User opens the application or refreshes the page. |
| Description | As a user, I want the system to retrieve my current session so that the application can display my account state correctly. |
| Preconditions | User sends a valid access token. |
| Postconditions | Current user profile and role information are returned. |
| Normal Flow | 1. Client calls the `me` endpoint.<br>2. System verifies access token.<br>3. System retrieves user information.<br>4. System returns user ID, role, display name, avatar, and account status data needed by the UI. |
| Alternative Flows | Client may call refresh token flow first if access token has expired. |
| Exceptions | 1. If access token is missing, system returns unauthorized error.<br>2. If token is invalid or expired, system returns unauthorized error.<br>3. If user no longer exists, system returns unauthorized error. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-06, BR-07 |
| Other Information | Used by protected route and auth store initialization. |
| Assumptions | User information returned does not expose sensitive fields such as password hash. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-06 | Token Authentication | Protected APIs must require a valid JWT access token in the Authorization Bearer header. |
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |

### 1.6 UC-06_JWT & RBAC Authorization

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-06_JWT & RBAC Authorization** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | System |
| Secondary Actors | User, Admin |
| Trigger | Any protected API endpoint is requested. |
| Description | As the system, I want to verify JWT and role permissions so that only authorized users can access protected features. |
| Preconditions | Protected endpoint requires authentication and/or role permission. |
| Postconditions | Request is either allowed to continue or rejected with proper error response. |
| Normal Flow | 1. Client sends Authorization header with Bearer token.<br>2. System verifies token signature and expiration.<br>3. System loads user role and status.<br>4. System checks whether user is allowed to access the endpoint.<br>5. System forwards the request to the controller. |
| Alternative Flows | Public endpoints skip authentication middleware. |
| Exceptions | 1. If token is missing, system returns 401.<br>2. If token is invalid or expired, system returns 401.<br>3. If user role is not allowed, system returns 403.<br>4. If user is banned, system returns 403. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-06, BR-07, BR-09 |
| Other Information | Roles include at least user and admin for MVP. |
| Assumptions | Backend is the source of truth for permissions. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-06 | Token Authentication | Protected APIs must require a valid JWT access token in the Authorization Bearer header. |
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |
| BR-09 | Role-Based Access Control | APIs with role restriction must reject users who do not have the required role. |

---

## 2. User Profile & Statistics

### 2.1 UC-07_View Public Profile

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-07_View Public Profile** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | Guest / User |
| Secondary Actors | System |
| Trigger | Actor opens a user's public profile page. |
| Description | As a guest or user, I want to view a public profile so that I can see basic information and debate identity of a participant. |
| Preconditions | Target user exists. |
| Postconditions | Public user profile is displayed. |
| Normal Flow | 1. Actor opens profile page by user ID.<br>2. System retrieves public profile data.<br>3. System hides sensitive account data.<br>4. System displays display name, avatar, bio, school, rank tier, ELO, and basic stats. |
| Alternative Flows | Actor returns to leaderboard or previous page. |
| Exceptions | If target user does not exist, system returns not found error. |
| Priority | Must Have |
| Frequency of Use | Medium |
| Business Rules | BR-10, BR-11 |
| Other Information | Public profile can be opened from leaderboard or debate history. |
| Assumptions | Public profile does not require authentication. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-10 | Public Profile Privacy | Public profile must not expose sensitive fields such as password hash, refresh token, private email setting, or internal security metadata. |
| BR-11 | Public User Data | Public user-facing displays may show display name, avatar, bio, school, ELO, rank tier, and public stats. |

### 2.2 UC-08_Update Profile

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-08_Update Profile** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | User opens profile edit page and submits changes. |
| Description | As a user, I want to update my profile information so that my public debate identity stays accurate. |
| Preconditions | User is authenticated and edits their own profile. |
| Postconditions | Profile information is updated. |
| Normal Flow | 1. User opens Profile page.<br>2. User edits display name, bio, or school.<br>3. System validates input length and format.<br>4. System confirms the user owns the profile.<br>5. System saves changes.<br>6. System displays updated profile. |
| Alternative Flows | User cancels editing and no data is changed. |
| Exceptions | 1. If user edits another user's profile, system returns forbidden error.<br>2. If input is invalid, system returns validation error.<br>3. If user is unauthenticated, system returns unauthorized error. |
| Priority | Must Have |
| Frequency of Use | Medium |
| Business Rules | BR-07, BR-10, BR-12 |
| Other Information | MVP supports basic profile fields only. |
| Assumptions | Advanced portfolio and AI badges are out of MVP scope. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |
| BR-10 | Public Profile Privacy | Public profile must not expose sensitive fields such as password hash, refresh token, private email setting, or internal security metadata. |
| BR-12 | Profile Ownership | A user may update only their own profile unless an admin-specific permission is implemented. |

### 2.3 UC-09_Update Avatar

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-09_Update Avatar** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | User submits avatar URL or uploads avatar according to implementation design. |
| Description | As a user, I want to update my avatar so that my account is recognizable in profile, lobby, and leaderboard. |
| Preconditions | User is authenticated. |
| Postconditions | Avatar is updated and shown in user-facing pages. |
| Normal Flow | 1. User opens avatar update control.<br>2. User provides avatar URL or selected image according to UI support.<br>3. System validates avatar input.<br>4. System stores avatar reference.<br>5. System displays new avatar. |
| Alternative Flows | User removes or replaces existing avatar if supported. |
| Exceptions | 1. If avatar URL/file is invalid, system returns validation error.<br>2. If upload service fails, system returns an error and keeps old avatar.<br>3. If user is unauthenticated, system returns unauthorized error. |
| Priority | Should Have |
| Frequency of Use | Low |
| Business Rules | BR-07, BR-13 |
| Other Information | Use case document notes avatar as URL input for MVP. |
| Assumptions | Avatar must be safe to display in web UI. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |
| BR-13 | Avatar Validation | Avatar URL or uploaded avatar must pass validation before being saved or displayed. |

### 2.4 UC-10_View Match Statistics

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-10_View Match Statistics** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | Guest / User |
| Secondary Actors | System |
| Trigger | Actor opens stats section on a user's profile. |
| Description | As a guest or user, I want to view match statistics so that I can understand a debater's performance. |
| Preconditions | Target user exists. |
| Postconditions | User statistics are displayed. |
| Normal Flow | 1. Actor opens profile stats.<br>2. System aggregates or retrieves user stats.<br>3. System displays wins, losses, average score, rank tier, ELO, and debate count. |
| Alternative Flows | If user has no completed debate, system displays empty/default stats. |
| Exceptions | If stats cannot be loaded, system displays an error state. |
| Priority | Must Have |
| Frequency of Use | Medium |
| Business Rules | BR-11, BR-14, BR-15 |
| Other Information | Stats are derived from completed debate sessions. |
| Assumptions | Only completed sessions are counted in official stats. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-11 | Public User Data | Public user-facing displays may show display name, avatar, bio, school, ELO, rank tier, and public stats. |
| BR-14 | Completed Match Stats | Official W/L, average score, and debate count must be calculated from completed debate sessions only. |
| BR-15 | Rank Match Eligibility | ELO must be updated only for ranked matches, not custom room matches. |

### 2.5 UC-11_View Debate History

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-11_View Debate History** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | System |
| Trigger | User opens debate history from profile or dashboard. |
| Description | As a user, I want to view my debate history so that I can review past matches and track progress. |
| Preconditions | User is authenticated. |
| Postconditions | Debate history list is displayed. |
| Normal Flow | 1. User opens Debate History page.<br>2. System verifies authentication.<br>3. System retrieves completed debate sessions involving the user.<br>4. System displays date, format, side, result, score, ELO change, and replay link when available. |
| Alternative Flows | User filters or paginates history if UI supports it. |
| Exceptions | 1. If user is unauthenticated, system returns unauthorized error.<br>2. If no history exists, system displays empty state. |
| Priority | Should Have |
| Frequency of Use | Medium |
| Business Rules | BR-07, BR-14, BR-15 |
| Other Information | Debate replay is owned by Dev 5, but history can link to replay when available. |
| Assumptions | History data is available after debate session is completed. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-07 | Invalid Session Handling | Missing, invalid, or expired tokens must return unauthorized response and must not expose protected data. |
| BR-14 | Completed Match Stats | Official W/L, average score, and debate count must be calculated from completed debate sessions only. |
| BR-15 | Rank Match Eligibility | ELO must be updated only for ranked matches, not custom room matches. |

---

## 3. Ranking & Leaderboard

### 3.1 UC-52_Update ELO After Rank Match

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-52_Update ELO After Rank Match** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | System |
| Secondary Actors | User |
| Trigger | A ranked debate match is completed and winner/draw result is finalized. |
| Description | As the system, I want to update ELO after ranked matches so that ranking reflects user performance. |
| Preconditions | Debate session is completed, result is final, and session is a ranked match. |
| Postconditions | User ELO, rank tier, ELO history, and stats are updated once. |
| Normal Flow | 1. Debate result is finalized.<br>2. System checks whether the match is ranked.<br>3. System checks whether ELO has already been applied.<br>4. System calculates ELO changes for both sides.<br>5. System updates each participant's ELO and rank tier.<br>6. System records ELO history and marks session as ELO applied.<br>7. Updated ranking data becomes available in profile and leaderboard. |
| Alternative Flows | If match result is draw, system applies draw-specific ELO calculation. |
| Exceptions | 1. If session is not ranked, system does not update ELO.<br>2. If ELO was already applied, system skips duplicate update.<br>3. If participant data is missing, system logs error and prevents partial duplicate update. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-14, BR-15, BR-16, BR-17, BR-18 |
| Other Information | Dev 2 triggers ELO update after debate ends; Dev 1 owns ELO calculation service. |
| Assumptions | Debate winner is already determined by scoring module before ELO update. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-14 | Completed Match Stats | Official W/L, average score, and debate count must be calculated from completed debate sessions only. |
| BR-15 | Rank Match Eligibility | ELO must be updated only for ranked matches, not custom room matches. |
| BR-16 | Single ELO Application | ELO update for a debate session must be applied at most once. |
| BR-17 | Rank Tier Calculation | Rank tier must be recalculated whenever a user's ELO changes. |
| BR-18 | ELO History | ELO changes should be recorded with match ID, old ELO, new ELO, delta, and result for progress tracking. |

### 3.2 UC-64_Global Leaderboard

#### a. Functionalities

| Field | Description |
|---|---|
| UC ID and Name | **UC-64_Global Leaderboard** |
| Created By | Dev 1 |
| Date Created | 15/06/2026 |
| Primary Actor | User |
| Secondary Actors | Guest, System |
| Trigger | Actor opens Leaderboard page. |
| Description | As a user, I want to view the global leaderboard so that I can compare rankings based on ELO. |
| Preconditions | Ranking data exists in the system. |
| Postconditions | Global leaderboard is displayed. |
| Normal Flow | 1. Actor opens Leaderboard page.<br>2. System retrieves top users sorted by ELO.<br>3. System limits result to global top 50 for MVP.<br>4. System displays rank number, avatar, display name, school, ELO, rank tier, wins, losses, and average score.<br>5. Actor may open a public profile from the leaderboard. |
| Alternative Flows | If no ranked users exist, system displays empty leaderboard. |
| Exceptions | If leaderboard data cannot be loaded, system displays an error state. |
| Priority | Must Have |
| Frequency of Use | High |
| Business Rules | BR-10, BR-11, BR-16, BR-17, BR-19 |
| Other Information | Weekly/monthly/yearly leaderboards are out of MVP scope. |
| Assumptions | Leaderboard is based on global ELO only. |

#### b. Business Rules

| ID | Business Rule | Business Rule Description |
|---|---|---|
| BR-10 | Public Profile Privacy | Public profile must not expose sensitive fields such as password hash, refresh token, private email setting, or internal security metadata. |
| BR-11 | Public User Data | Public user-facing displays may show display name, avatar, bio, school, ELO, rank tier, and public stats. |
| BR-16 | Single ELO Application | ELO update for a debate session must be applied at most once. |
| BR-17 | Rank Tier Calculation | Rank tier must be recalculated whenever a user's ELO changes. |
| BR-19 | Leaderboard Scope | MVP leaderboard must show Global Top 50 by ELO; seasonal leaderboard is out of MVP scope. |
