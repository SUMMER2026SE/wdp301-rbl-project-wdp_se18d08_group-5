# Issues Part 1

Nguon tong hop: `issues_report_excel_prompt.md`, `custom_room_bug_report.md`, `debate_flow_bug_report.md`, `debate_lifecycle_test_report.md`.

| ID | Title | State | Assignee | Milestone | Short note |
|---:|---|---|---|---|---|
| 1 | Create room route missing schema validation | Closed | Dev2 | iter3 | Route create room can bypass `createRoomSchema`. |
| 2 | `createRoomSchema` missing motion field | Closed | Dev2 | iter3 | Schema may strip topic/motion when validation is enabled. |
| 3 | Private room password may leak on create | Closed | Dev2 | iter3 | Create response should never return room password. |
| 4 | Private room password stored as plaintext | Open | Dev2 | iter3 | Password/access code should be hashed or renamed clearly. |
| 5 | Backend can create room without motion | Closed | Dev2 | iter3 | Direct API call can create invalid room topic. |
| 6 | Private password input is not masked | Closed | Dev2 | iter3 | Frontend input should use password mode. |
| 7 | Create room error message is too generic | Open | Dev2 | iter3 | UI should show backend validation message. |
| 8 | Room title can be blank after trim | Open | Dev2 | iter3 | Backend should trim and reject whitespace-only titles. |
| 9 | Transition status rejected by schema | Open | Dev2 | iter3 | `currentTurn.status = transition` is not in enum. |
| 10 | No-host human judge controller blocked | Open | Dev2 | iter3 | Judge controller can have `speakerSlot = null`. |
| 11 | No-host AI starts after one S1 confirms | Open | Dev2 | iter3 | Both S1 debaters should agree before start. |
| 12 | Round 3 speaker order mismatch | Open | Dev2 | iter3 | Backend order conflicts with docs/frontend. |
| 13 | Final judging phase missing | Open | Dev2 | iter3 | Last speech should go to final judging flow. |
| 14 | OPP_S3 announcement text is wrong | Closed | Dev2 | iter3 | Popup should say "Finish Debate". |
| 15 | Scoring tiebreaker count bug | Closed | Dev2 | iter3 | S3/R2 tiebreak averages used wrong count. |
| 16 | Scoring scale mismatch risk | Open | Dev2 | iter3 | Rules and stored/displayed score need one clear contract. |
| 17 | Update room may leak password | Open | Dev2 | iter3 | Update response should sanitize private password. |
| 18 | `updateRoomSchema` misses handler fields | Open | Dev2 | iter3 | Schema and route update contract are inconsistent. |
| 19 | Kick during active debate lacks socket event | Open | Dev3 | iter3 | Kicked user may stay on stale debate page. |
| 20 | Kick routes do not validate `userId` | Open | Dev2 | iter3 | Invalid body should return clear 400 validation error. |
