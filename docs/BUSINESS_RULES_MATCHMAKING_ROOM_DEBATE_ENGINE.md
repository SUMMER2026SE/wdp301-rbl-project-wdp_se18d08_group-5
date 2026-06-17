# Business Rules - Matchmaking + Room + Debate Engine

**Document Version:** v1.0  
**Date:** 15/06/2026  
**Created By:** QUANVC  
**Scope:** Matchmaking + Room + Debate Engine  
**Use Cases:** UC-12 to UC-25, UC-26 to UC-43, UC-44 to UC-47, UC-52  
**References:** [05_Use_Cases.md](./05_Use_Cases.md), [01_Debate_Rule.md](./01_Debate_Rule.md), [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md), [03_Role_System.md](./03_Role_System.md)

> This document follows the UC numbering in `05_Use_Cases.md`.

---

## 2.12 UC-12: Rank Queue

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-12: Rank Queue</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>User</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The user clicks Join Queue for a ranked format.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows a user to enter a ranked matchmaking queue by format so the user can be paired with a suitable opponent or team.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Rank Queue is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR12-1, BR12-2, BR12-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR12-1 | Permission Validation | The system shall allow Rank Queue only for actors with valid permission and role. |
| BR12-2 | State Validation | The system shall execute Rank Queue only when queue, room, or debate session state is valid. |
| BR12-3 | Persistence and Response | The system shall persist the result of Rank Queue and return the updated state to affected clients. |

---

## 2.13 UC-13: Rank Match Found

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-13: Rank Match Found</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Queued User</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>User, AI Host, AI Judge</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The matchmaking service finds enough compatible users in the same ranked queue.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system matches compatible queued users, creates a ranked debate room, assigns teams and speaker positions, and prepares the debate session.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Rank Match Found is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR13-1, BR13-2, BR13-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR13-1 | Permission Validation | The system shall allow Rank Match Found only for actors with valid permission and role. |
| BR13-2 | State Validation | The system shall execute Rank Match Found only when queue, room, or debate session state is valid. |
| BR13-3 | Persistence and Response | The system shall persist the result of Rank Match Found and return the updated state to affected clients. |

---

## 2.14 UC-14: Create Custom Room

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-14: Create Custom Room</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>User</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The user submits the custom room creation form.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows a user to create a custom debate room with configurable format, host type, judge type, privacy, and lobby settings.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Create Custom Room is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR14-1, BR14-2, BR14-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR14-1 | Permission Validation | The system shall allow Create Custom Room only for actors with valid permission and role. |
| BR14-2 | State Validation | The system shall execute Create Custom Room only when queue, room, or debate session state is valid. |
| BR14-3 | Persistence and Response | The system shall persist the result of Create Custom Room and return the updated state to affected clients. |

---

## 2.15 UC-15: Edit Room Configuration

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-15: Edit Room Configuration</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The room owner submits updated lobby configuration.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the room owner to update lobby configuration before the debate starts while preserving valid participant assignments.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Edit Room Configuration is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR15-1, BR15-2, BR15-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR15-1 | Permission Validation | The system shall allow Edit Room Configuration only for actors with valid permission and role. |
| BR15-2 | State Validation | The system shall execute Edit Room Configuration only when queue, room, or debate session state is valid. |
| BR15-3 | Persistence and Response | The system shall persist the result of Edit Room Configuration and return the updated state to affected clients. |

---

## 2.16 UC-16: Delete Room

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-16: Delete Room</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The room owner confirms room deletion while the room is still waiting.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the room owner to delete or cancel a waiting custom room so it can no longer be joined or displayed as available.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Delete Room is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR16-1, BR16-2, BR16-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR16-1 | Permission Validation | The system shall allow Delete Room only for actors with valid permission and role. |
| BR16-2 | State Validation | The system shall execute Delete Room only when queue, room, or debate session state is valid. |
| BR16-3 | Persistence and Response | The system shall persist the result of Delete Room and return the updated state to affected clients. |

---

## 2.17 UC-17: Join Custom Room

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-17: Join Custom Room</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>User</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Owner</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The user chooses to join a public or private custom room.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows a user to join an accessible custom room after validating room status, capacity, duplicate participation, and password rules.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Join Custom Room is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR17-1, BR17-2, BR17-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR17-1 | Permission Validation | The system shall allow Join Custom Room only for actors with valid permission and role. |
| BR17-2 | State Validation | The system shall execute Join Custom Room only when queue, room, or debate session state is valid. |
| BR17-3 | Persistence and Response | The system shall persist the result of Join Custom Room and return the updated state to affected clients. |

---

## 2.18 UC-18: Select Position

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-18: Select Position</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Owner</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">An assigned debater selects team and speaker slot.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows an assigned debater to choose a valid team and speaker slot before positions are locked.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Select Position is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR18-1, BR18-2, BR18-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR18-1 | Permission Validation | The system shall allow Select Position only for actors with valid permission and role. |
| BR18-2 | State Validation | The system shall execute Select Position only when queue, room, or debate session state is valid. |
| BR18-3 | Persistence and Response | The system shall persist the result of Select Position and return the updated state to affected clients. |

---

## 2.19 UC-19: Lock Position

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-19: Lock Position</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Debater</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The owner locks lobby debater positions.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the owner to lock debater team and speaker positions so participants cannot change required debate slots before start.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Lock Position is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR19-1, BR19-2, BR19-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR19-1 | Permission Validation | The system shall allow Lock Position only for actors with valid permission and role. |
| BR19-2 | State Validation | The system shall execute Lock Position only when queue, room, or debate session state is valid. |
| BR19-3 | Persistence and Response | The system shall persist the result of Lock Position and return the updated state to affected clients. |

---

## 2.20 UC-20: Assign Host / Judge

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-20: Assign Host / Judge</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host, Judge</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The owner assigns or changes a participant role in the lobby.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the owner to assign participants as debater, host, judge, or viewer and to satisfy human host or judge requirements.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Assign Host / Judge is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR20-1, BR20-2, BR20-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR20-1 | Permission Validation | The system shall allow Assign Host / Judge only for actors with valid permission and role. |
| BR20-2 | State Validation | The system shall execute Assign Host / Judge only when queue, room, or debate session state is valid. |
| BR20-3 | Persistence and Response | The system shall persist the result of Assign Host / Judge and return the updated state to affected clients. |

---

## 2.21 UC-21: Lobby Waiting to Ready

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-21: Lobby Waiting to Ready</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Owner, Host, Debater, Judge</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A participant joins, leaves, changes role, or changes position.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system evaluates lobby readiness based on required debaters, locked positions, and required human host or judge assignments.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Lobby Waiting to Ready is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR21-1, BR21-2, BR21-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR21-1 | Permission Validation | The system shall allow Lobby Waiting to Ready only for actors with valid permission and role. |
| BR21-2 | State Validation | The system shall execute Lobby Waiting to Ready only when queue, room, or debate session state is valid. |
| BR21-3 | Persistence and Response | The system shall persist the result of Lobby Waiting to Ready and return the updated state to affected clients. |

---

## 2.22 UC-22: Start Debate

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-22: Start Debate</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner or Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Debaters, Judges</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The owner or assigned host clicks Start Debate.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system starts a valid room by creating or activating the debate session and moving the room from lobby state into active debate state.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Start Debate is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR22-1, BR22-2, BR22-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR22-1 | Permission Validation | The system shall allow Start Debate only for actors with valid permission and role. |
| BR22-2 | State Validation | The system shall execute Start Debate only when queue, room, or debate session state is valid. |
| BR22-3 | Persistence and Response | The system shall persist the result of Start Debate and return the updated state to affected clients. |

---

## 2.23 UC-23: Leave Room

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-23: Leave Room</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Participant</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A participant clicks Leave Room.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows a participant to leave a room and releases the participant role or position according to the current room status.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Leave Room is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR23-1, BR23-2, BR23-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR23-1 | Permission Validation | The system shall allow Leave Room only for actors with valid permission and role. |
| BR23-2 | State Validation | The system shall execute Leave Room only when queue, room, or debate session state is valid. |
| BR23-3 | Persistence and Response | The system shall persist the result of Leave Room and return the updated state to affected clients. |

---

## 2.24 UC-24: Lobby Kick / Ban

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-24: Lobby Kick / Ban</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Owner</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Participant</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The owner kicks a participant from the lobby.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the owner to remove a participant from the lobby and release that participant role and position assignment.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Lobby Kick / Ban is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR24-1, BR24-2, BR24-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR24-1 | Permission Validation | The system shall allow Lobby Kick / Ban only for actors with valid permission and role. |
| BR24-2 | State Validation | The system shall execute Lobby Kick / Ban only when queue, room, or debate session state is valid. |
| BR24-3 | Persistence and Response | The system shall persist the result of Lobby Kick / Ban and return the updated state to affected clients. |

---

## 2.25 UC-25: Browse Live Matches

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-25: Browse Live Matches</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Guest or User</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A guest or user opens the live matches page.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system displays available waiting or active rooms and supports filtering so users can browse, view, or join matches according to access rules.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Browse Live Matches is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR25-1, BR25-2, BR25-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR25-1 | Permission Validation | The system shall allow Browse Live Matches only for actors with valid permission and role. |
| BR25-2 | State Validation | The system shall execute Browse Live Matches only when queue, room, or debate session state is valid. |
| BR25-3 | Persistence and Response | The system shall persist the result of Browse Live Matches and return the updated state to affected clients. |

---

## 2.26 UC-26: Motion Announcement

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-26: Motion Announcement</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Debaters, Judges, Viewers</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A debate session becomes active and requires a motion.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system announces the debate motion to all participants and stores the motion as the topic for the active debate session.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Motion Announcement is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR26-1, BR26-2, BR26-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR26-1 | Permission Validation | The system shall allow Motion Announcement only for actors with valid permission and role. |
| BR26-2 | State Validation | The system shall execute Motion Announcement only when queue, room, or debate session state is valid. |
| BR26-3 | Persistence and Response | The system shall persist the result of Motion Announcement and return the updated state to affected clients. |

---

## 2.27 UC-27: Preparation 7 Minutes

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-27: Preparation 7 Minutes</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The motion has been announced.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system provides the teams with the required seven-minute preparation phase after the motion is announced.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Preparation 7 Minutes is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR27-1, BR27-2, BR27-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR27-1 | Permission Validation | The system shall allow Preparation 7 Minutes only for actors with valid permission and role. |
| BR27-2 | State Validation | The system shall execute Preparation 7 Minutes only when queue, room, or debate session state is valid. |
| BR27-3 | Persistence and Response | The system shall persist the result of Preparation 7 Minutes and return the updated state to affected clients. |

---

## 2.28 UC-28: Team Private Room

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-28: Team Private Room</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A debater enters or exits a team private room.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows debaters to enter and leave their own team private room for strategy discussion during allowed phases.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Team Private Room is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR28-1, BR28-2, BR28-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR28-1 | Permission Validation | The system shall allow Team Private Room only for actors with valid permission and role. |
| BR28-2 | State Validation | The system shall execute Team Private Room only when queue, room, or debate session state is valid. |
| BR28-3 | Persistence and Response | The system shall persist the result of Team Private Room and return the updated state to affected clients. |

---

## 2.29 UC-29: End Prep and Start Main Debate

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-29: End Prep and Start Main Debate</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Debaters</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">Preparation time ends or the host ends preparation.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system ends the preparation phase, returns participants to the main debate flow, and prepares Proposition Speaker 1 as the first speaker.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">End Prep and Start Main Debate is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR29-1, BR29-2, BR29-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR29-1 | Permission Validation | The system shall allow End Prep and Start Main Debate only for actors with valid permission and role. |
| BR29-2 | State Validation | The system shall execute End Prep and Start Main Debate only when queue, room, or debate session state is valid. |
| BR29-3 | Persistence and Response | The system shall persist the result of End Prep and Start Main Debate and return the updated state to affected clients. |

---

## 2.30 UC-30: Speech

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-30: Speech</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host, Judge</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The host or system starts the current speaker speech turn.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system manages a speech turn by tracking the current speaker, timer, transcript, and transition to the next debate phase.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Speech is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR30-1, BR30-2, BR30-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR30-1 | Permission Validation | The system shall allow Speech only for actors with valid permission and role. |
| BR30-2 | State Validation | The system shall execute Speech only when queue, room, or debate session state is valid. |
| BR30-3 | Persistence and Response | The system shall persist the result of Speech and return the updated state to affected clients. |

---

## 2.31 UC-31: Speaking Order

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-31: Speaking Order</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Debaters, Host</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A speech turn or phase transition completes.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system enforces the required speaker order from Proposition Speaker 1 through Opposition Speaker 3.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Speaking Order is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR31-1, BR31-2, BR31-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR31-1 | Permission Validation | The system shall allow Speaking Order only for actors with valid permission and role. |
| BR31-2 | State Validation | The system shall execute Speaking Order only when queue, room, or debate session state is valid. |
| BR31-3 | Persistence and Response | The system shall persist the result of Speaking Order and return the updated state to affected clients. |

---

## 2.32 UC-32: Cross Examination

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-32: Cross Examination</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">An S1 or S2 speech is completed.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system manages cross examination after eligible speeches, including pass turn, finish, question limits, timers, and CE transcript state.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Cross Examination is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR32-1, BR32-2, BR32-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR32-1 | Permission Validation | The system shall allow Cross Examination only for actors with valid permission and role. |
| BR32-2 | State Validation | The system shall execute Cross Examination only when queue, room, or debate session state is valid. |
| BR32-3 | Persistence and Response | The system shall persist the result of Cross Examination and return the updated state to affected clients. |

---

## 2.33 UC-33: CE Missing Question / Answer Penalty

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-33: CE Missing Question / Answer Penalty</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Judge</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Judge, Debaters</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">Cross examination ends with missing required questions or answers.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system records incomplete cross-examination obligations so missing questions or answers can be considered during scoring.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">CE Missing Question / Answer Penalty is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR33-1, BR33-2, BR33-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR33-1 | Permission Validation | The system shall allow CE Missing Question / Answer Penalty only for actors with valid permission and role. |
| BR33-2 | State Validation | The system shall execute CE Missing Question / Answer Penalty only when queue, room, or debate session state is valid. |
| BR33-3 | Persistence and Response | The system shall persist the result of CE Missing Question / Answer Penalty and return the updated state to affected clients. |

---

## 2.34 UC-34: Judge Feedback After Speaker

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-34: Judge Feedback After Speaker</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Judge</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>AI Judge, Debaters</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A speaker turn and its related CE phase are completed.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows assigned judges or AI judge logic to provide feedback after a completed speaker turn.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Judge Feedback After Speaker is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR34-1, BR34-2, BR34-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR34-1 | Permission Validation | The system shall allow Judge Feedback After Speaker only for actors with valid permission and role. |
| BR34-2 | State Validation | The system shall execute Judge Feedback After Speaker only when queue, room, or debate session state is valid. |
| BR34-3 | Persistence and Response | The system shall persist the result of Judge Feedback After Speaker and return the updated state to affected clients. |

---

## 2.35 UC-35: One-Minute Prep Between Turns

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-35: One-Minute Prep Between Turns</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">Judge feedback ends and another applicable turn remains.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system provides a one-minute preparation interval between applicable debate turns after judge feedback.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">One-Minute Prep Between Turns is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR35-1, BR35-2, BR35-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR35-1 | Permission Validation | The system shall allow One-Minute Prep Between Turns only for actors with valid permission and role. |
| BR35-2 | State Validation | The system shall execute One-Minute Prep Between Turns only when queue, room, or debate session state is valid. |
| BR35-3 | Persistence and Response | The system shall persist the result of One-Minute Prep Between Turns and return the updated state to affected clients. |

---

## 2.36 UC-36: Closing Speaker 3

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-36: Closing Speaker 3</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Judge</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The debate reaches Speaker 3 turns.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system manages Speaker 3 closing turns and ensures closing speeches do not enter a cross-examination phase.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Closing Speaker 3 is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR36-1, BR36-2, BR36-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR36-1 | Permission Validation | The system shall allow Closing Speaker 3 only for actors with valid permission and role. |
| BR36-2 | State Validation | The system shall execute Closing Speaker 3 only when queue, room, or debate session state is valid. |
| BR36-3 | Persistence and Response | The system shall persist the result of Closing Speaker 3 and return the updated state to affected clients. |

---

## 2.37 UC-37: Final Judging

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-37: Final Judging</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Judge</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>AI Judge</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">All required speeches are completed or a special outcome ends the debate.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system supports final judging after required debate phases are completed or after a special outcome policy ends the debate.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Final Judging is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR37-1, BR37-2, BR37-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR37-1 | Permission Validation | The system shall allow Final Judging only for actors with valid permission and role. |
| BR37-2 | State Validation | The system shall execute Final Judging only when queue, room, or debate session state is valid. |
| BR37-3 | Persistence and Response | The system shall persist the result of Final Judging and return the updated state to affected clients. |

---

## 2.38 UC-38: Winner / Draw Announcement

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-38: Winner / Draw Announcement</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host or Judge</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Participants</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">Final judging or special outcome resolution produces a result.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system announces the final result as Proposition win, Opposition win, or draw and makes the result visible to participants.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Winner / Draw Announcement is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR38-1, BR38-2, BR38-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR38-1 | Permission Validation | The system shall allow Winner / Draw Announcement only for actors with valid permission and role. |
| BR38-2 | State Validation | The system shall execute Winner / Draw Announcement only when queue, room, or debate session state is valid. |
| BR38-3 | Persistence and Response | The system shall persist the result of Winner / Draw Announcement and return the updated state to affected clients. |

---

## 2.39 UC-39: Persist Completed Session and Transcript

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-39: Persist Completed Session and Transcript</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host or Judge</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Debaters, Judges, Viewers</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A debate reaches completed state.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system persists completed debate data including session status, winner or draw, scores, turn history, and transcripts for replay and history.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Persist Completed Session and Transcript is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR39-1, BR39-2, BR39-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR39-1 | Permission Validation | The system shall allow Persist Completed Session and Transcript only for actors with valid permission and role. |
| BR39-2 | State Validation | The system shall execute Persist Completed Session and Transcript only when queue, room, or debate session state is valid. |
| BR39-3 | Persistence and Response | The system shall persist the result of Persist Completed Session and Transcript and return the updated state to affected clients. |

---

## 2.40 UC-40: 1v1 Speaker Mapping

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-40: 1v1 Speaker Mapping</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Debater</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>None</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A one-versus-one room is prepared or started.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system maps a single debater to Speaker 1, Speaker 2, and Speaker 3 for each team in one-versus-one format.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">1v1 Speaker Mapping is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR40-1, BR40-2, BR40-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR40-1 | Permission Validation | The system shall allow 1v1 Speaker Mapping only for actors with valid permission and role. |
| BR40-2 | State Validation | The system shall execute 1v1 Speaker Mapping only when queue, room, or debate session state is valid. |
| BR40-3 | Persistence and Response | The system shall persist the result of 1v1 Speaker Mapping and return the updated state to affected clients. |

---

## 2.41 UC-41: Full Debate Orchestration

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-41: Full Debate Orchestration</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Host, Debaters, Judges</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The debate starts and must progress through official phases.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system orchestrates the full debate lifecycle from motion announcement through preparation, speeches, cross examination, judging, result, and completion.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Full Debate Orchestration is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR41-1, BR41-2, BR41-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR41-1 | Permission Validation | The system shall allow Full Debate Orchestration only for actors with valid permission and role. |
| BR41-2 | State Validation | The system shall execute Full Debate Orchestration only when queue, room, or debate session state is valid. |
| BR41-3 | Persistence and Response | The system shall persist the result of Full Debate Orchestration and return the updated state to affected clients. |

---

## 2.42 UC-42: Viewer Spectate

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-42: Viewer Spectate</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Viewer</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>System</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A user or guest opens an accessible room as viewer.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows viewers to spectate accessible rooms while preventing viewer access to debater, host, judge, and private-team controls.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Viewer Spectate is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR42-1, BR42-2, BR42-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR42-1 | Permission Validation | The system shall allow Viewer Spectate only for actors with valid permission and role. |
| BR42-2 | State Validation | The system shall execute Viewer Spectate only when queue, room, or debate session state is valid. |
| BR42-3 | Persistence and Response | The system shall persist the result of Viewer Spectate and return the updated state to affected clients. |

---

## 2.43 UC-43: New Argument Warning in S3

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-43: New Argument Warning in S3</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Judge, Debater</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">Speaker 3 content is reviewed during or after closing speech.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system or host records a warning when Speaker 3 introduces a new argument that should not appear in closing speeches.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">New Argument Warning in S3 is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Could Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR43-1, BR43-2, BR43-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR43-1 | Permission Validation | The system shall allow New Argument Warning in S3 only for actors with valid permission and role. |
| BR43-2 | State Validation | The system shall execute New Argument Warning in S3 only when queue, room, or debate session state is valid. |
| BR43-3 | Persistence and Response | The system shall persist the result of New Argument Warning in S3 and return the updated state to affected clients. |

---

## 2.44 UC-44: Pause / Resume Debate

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-44: Pause / Resume Debate</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Participants</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The assigned host clicks Pause or Resume.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the assigned host to pause and resume active debate progression.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Pause / Resume Debate is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR44-1, BR44-2, BR44-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR44-1 | Permission Validation | The system shall allow Pause / Resume Debate only for actors with valid permission and role. |
| BR44-2 | State Validation | The system shall execute Pause / Resume Debate only when queue, room, or debate session state is valid. |
| BR44-3 | Persistence and Response | The system shall persist the result of Pause / Resume Debate and return the updated state to affected clients. |

---

## 2.45 UC-45: Issue Yellow Card

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-45: Issue Yellow Card</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Participant</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The assigned host issues a yellow card to a participant.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the assigned host to issue a yellow card or warning to a participant and record the moderation reason.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Issue Yellow Card is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR45-1, BR45-2, BR45-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR45-1 | Permission Validation | The system shall allow Issue Yellow Card only for actors with valid permission and role. |
| BR45-2 | State Validation | The system shall execute Issue Yellow Card only when queue, room, or debate session state is valid. |
| BR45-3 | Persistence and Response | The system shall persist the result of Issue Yellow Card and return the updated state to affected clients. |

---

## 2.46 UC-46: Kick / Mute Participant

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-46: Kick / Mute Participant</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Participant</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The assigned host kicks or mutes a participant.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the assigned host to kick or mute a participant during an active debate according to moderation and role policy.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Kick / Mute Participant is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR46-1, BR46-2, BR46-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR46-1 | Permission Validation | The system shall allow Kick / Mute Participant only for actors with valid permission and role. |
| BR46-2 | State Validation | The system shall execute Kick / Mute Participant only when queue, room, or debate session state is valid. |
| BR46-3 | Persistence and Response | The system shall persist the result of Kick / Mute Participant and return the updated state to affected clients. |

---

## 2.47 UC-47: Kick / Chat Ban

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-47: Kick / Chat Ban</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Host</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Participant</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">The assigned host bans or restores participant chat access.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system allows the assigned host to restrict a participant chat access or remove the participant from active room communication.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Kick / Chat Ban is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Should Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR47-1, BR47-2, BR47-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR47-1 | Permission Validation | The system shall allow Kick / Chat Ban only for actors with valid permission and role. |
| BR47-2 | State Validation | The system shall execute Kick / Chat Ban only when queue, room, or debate session state is valid. |
| BR47-3 | Persistence and Response | The system shall persist the result of Kick / Chat Ban and return the updated state to affected clients. |

---

## 2.52 UC-52: Update ELO After Rank Debate

### a. Functional Description

<table>
  <tr>
    <td><strong>UC ID and Name:</strong></td>
    <td colspan="3"><strong>UC-52: Update ELO After Rank Debate</strong></td>
  </tr>
  <tr>
    <td><strong>Created By:</strong></td>
    <td>QUANVC</td>
    <td><strong>Date Created:</strong></td>
    <td>15/06/2026</td>
  </tr>
  <tr>
    <td><strong>Primary Actor:</strong></td>
    <td>Ranking Service</td>
    <td><strong>Secondary Actors:</strong></td>
    <td>Ranking Service, Debaters</td>
  </tr>
  <tr>
    <td><strong>Trigger:</strong></td>
    <td colspan="3">A ranking-eligible debate reaches completed state with a valid result.</td>
  </tr>
  <tr>
    <td><strong>Description:</strong></td>
    <td colspan="3">The system updates ranking points after a completed ranking-eligible debate based on win, loss, draw, surrender, or other valid final result.</td>
  </tr>
  <tr>
    <td><strong>Preconditions:</strong></td>
    <td colspan="3">The actor is authenticated or allowed for this action. The room, queue, or debate session state is valid.</td>
  </tr>
  <tr>
    <td><strong>Postconditions:</strong></td>
    <td colspan="3">Update ELO After Rank Debate is completed successfully and the updated state is stored or returned to clients.</td>
  </tr>
  <tr>
    <td><strong>Normal Flow:</strong></td>
    <td colspan="3">1. The actor starts the use case.<br>2. The system validates permission and current state.<br>3. The system executes the requested action.<br>4. The system persists the updated data.<br>5. The system returns or broadcasts the updated result.</td>
  </tr>
  <tr>
    <td><strong>Alternative Flows:</strong></td>
    <td colspan="3">1. Required data is incomplete.<br>2. The system rejects the action with a validation message.<br><br>3. A special room or debate policy applies.<br>4. The system follows that policy and stores the outcome.</td>
  </tr>
  <tr>
    <td><strong>Exceptions:</strong></td>
    <td colspan="3">Unauthorized actor.<br>Invalid room, queue, or session state.<br>Missing required data.<br>Database or service error.</td>
  </tr>
  <tr>
    <td><strong>Priority:</strong></td>
    <td colspan="3">Must Have</td>
  </tr>
  <tr>
    <td><strong>Frequency of Use:</strong></td>
    <td colspan="3">Every applicable system flow</td>
  </tr>
  <tr>
    <td><strong>Business Rules:</strong></td>
    <td colspan="3">BR52-1, BR52-2, BR52-3</td>
  </tr>
  <tr>
    <td><strong>Other Information:</strong></td>
    <td colspan="3">This use case must follow system role permissions, room status rules, and debate state-machine rules.</td>
  </tr>
  <tr>
    <td><strong>Assumptions:</strong></td>
    <td colspan="3">The backend state is the source of truth and the frontend only sends valid user actions.</td>
  </tr>
</table>

### b. Business Rules

| ID | Business Rule | Business Rule Description |
|----|---------------|---------------------------|
| BR52-1 | Permission Validation | The system shall allow Update ELO After Rank Debate only for actors with valid permission and role. |
| BR52-2 | State Validation | The system shall execute Update ELO After Rank Debate only when queue, room, or debate session state is valid. |
| BR52-3 | Persistence and Response | The system shall persist the result of Update ELO After Rank Debate and return the updated state to affected clients. |

---

