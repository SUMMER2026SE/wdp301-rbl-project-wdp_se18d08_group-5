# Issues Part 2

Nguon tong hop: `docs/09_Team_Task_Breakdown.md`, `docs/13_Todo_List_MVP.md`, va cac bug report hien co.

| ID | Title | State | Assignee | Milestone | Short note |
|---:|---|---|---|---|---|
| 21 | Implement ELO-based matchmaking | Open | Dev2 | iter2 | Pair users by rating for ranked queue. |
| 22 | Auto-create ranked room on match found | Open | Dev2 | iter2 | Create room and assign teams after pairing. |
| 23 | Emit `match:found` socket event | Open | Dev3 | iter2 | Notify matched users in realtime. |
| 24 | Implement room update endpoint | Open | Dev2 | iter2 | Allow owner to update lobby configuration. |
| 25 | Implement room delete endpoint | Open | Dev2 | iter2 | Owner should be able to delete waiting room. |
| 26 | Implement assign-role endpoint | Open | Dev2 | iter2 | Support assigning host and human judge roles. |
| 27 | Viewer join active match | Open | Dev5 | iter3 | Spectators should join active rooms safely. |
| 28 | Move host controls to room routes | Open | Dev2 | iter3 | Consolidate pause/resume/card/kick endpoints. |
| 29 | Add host mute and chat restriction | Open | Dev2 | iter3 | Host needs control for mic/chat moderation. |
| 30 | Add CE pass-turn endpoint | Open | Dev3 | iter3 | Cross-exam needs pass turn API. |
| 31 | Add CE finish endpoint | Open | Dev3 | iter3 | Cross-exam needs controlled finish API. |
| 32 | Add score summary endpoint | Open | Dev2 | iter3 | Return judge and AI score totals. |
| 33 | Add result endpoint | Open | Dev2 | iter3 | Return winner, scores, and ELO delta. |
| 34 | Trigger ELO update after debate | Open | Dev1 | iter3 | Ranked match result should update rating. |
| 35 | Complete 25-step debate engine | Open | Dev2 | iter3 | Implement full phase state machine. |
| 36 | Add motion assignment flow | Open | Dev2 | iter2 | Debate should announce assigned motion/topic. |
| 37 | Add prep timers | Open | Dev3 | iter2 | Support 7-minute and 1-minute prep phases. |
| 38 | Enforce CE question/answer limits | Open | Dev3 | iter3 | Apply max questions and missing answer penalty. |
| 39 | Enforce Speaker 3 rules | Open | Dev2 | iter3 | S3 should have no CE and no new arguments. |
| 40 | Persist completed session transcript | Open | Dev2 | iter3 | Save completed state and transcript for replay/result. |
