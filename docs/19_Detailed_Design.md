# Table of Contents

## 3. Detailed Design

| Section | Detailed Design | Actor(s) |
|---:|---|---|
| 3.1 | Register | Guest |
| 3.2 | Login | Guest |
| 3.3 | Login by Google | Guest |
| 3.4 | Reset Password | Guest |
| 3.5 | Change Password | User, Admin |
| 3.6 | Logout | User, Admin |
| 3.7 | View Public Profile | Guest |
| 3.8 | View Own Profile | User, Admin |
| 3.9 | Update Profile | User, Admin |
| 3.10 | View Platform Information | Guest, User, Admin |
| 3.11 | View Public Matches | Guest, User, Admin |
| 3.12 | View Leaderboard | Guest, User, Admin |
| 3.13 | Create Custom Room | User |
| 3.14 | Join Room | User |
| 3.15 | Rejoin Room | User |
| 3.16 | Leave Room | User, Admin |
| 3.17 | Join Ranked Queue | User |
| 3.18 | Watch Live Match | User, Admin |
| 3.19 | View Results | User, Admin |
| 3.20 | View Debate History | User |
| 3.21 | Receive Notification | User, Admin |
| 3.22 | View Topic | User |
| 3.23 | Create Topic | User |
| 3.24 | Create Post | User |
| 3.25 | Comment Post | User |
| 3.26 | View User List | Admin |
| 3.27 | Penalize User | Admin |

### Notes

- `Login by Google` is listed separately because it extends `Login` in the Guest use case diagram.
- `Create Topic` appears twice in the User use case diagram and is listed once here.
- The standalone `View` oval in the Guest diagram is not connected to an actor and does not identify a specific function, so it is not included as a Detailed Design item.
