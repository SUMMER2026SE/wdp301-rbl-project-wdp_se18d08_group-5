# Table of Contents

## 3. Detailed Design

| Section | Detailed Design | Feature | Actor(s) |
|---:|---|---|---|
| 3.1 | Register | Authentication | Guest |
| 3.2 | Login | Authentication | Guest |
| 3.3 | Login by Google | Authentication | Guest |
| 3.4 | Reset Password | Authentication | Guest |
| 3.5 | Change Password | Authentication | User, Admin |
| 3.6 | Logout | Authentication | User, Admin |
| 3.7 | View Public Profile | Profile | Guest |
| 3.8 | View Own Profile | Profile | User, Admin |
| 3.9 | Update Profile | Profile | User, Admin |
| 3.10 | View Platform Information | Platform Information | Guest, User, Admin |
| 3.11 | View Public Matches | Match Discovery | Guest, User, Admin |
| 3.12 | View Leaderboard | Ranking | Guest, User, Admin |
| 3.13 | Create Custom Room | Room Management | User |
| 3.14 | Join Room | Room Management | User |
| 3.15 | Rejoin Room | Room Management | User |
| 3.16 | Leave Room | Room Management | User, Admin |
| 3.17 | Join Ranked Queue | Matchmaking | User |
| 3.18 | Watch Live Match | Match Discovery | User, Admin |
| 3.19 | View Results | Debate Results | User, Admin |
| 3.20 | View Debate History | Debate History | User |
| 3.21 | Receive Notification | Notification | User, Admin |
| 3.22 | View Topic | Community | User |
| 3.23 | Create Topic | Community | User |
| 3.24 | Create Post | Community | User |
| 3.25 | Comment Post | Community | User |
| 3.26 | View User List | Administration | Admin |
| 3.27 | Penalize User | Administration | Admin |

## 3.1 Register

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Guest
    participant FE as RegisterPage (FE)
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant Model as User (Model)
    participant DB as MongoDB
    participant Mail as EmailService / SMTP

    rect rgb(240,248,255)
        Note over Guest,Mail: Register a local account
    end

    Guest->>FE: 1. Enter username, email, password, and confirmation
    Guest->>FE: 2. Click "Register"
    FE->>FE: 3. Validate form with Zod

    alt Invalid client-side data
        FE-->>Guest: 4. Display validation errors
    else Valid client-side data
        FE->>Ctrl: 5. POST /api/v1/auth/register
        Note over Ctrl: authLimiter + validate(registerSchema)

        alt Invalid request body
            Ctrl-->>FE: 6. 400 Validation error
            FE-->>Guest: 7. Display validation error
        else Valid request body
            Ctrl->>Svc: 8. register(data)
            Svc->>Model: 9. findOne(email or username)
            Model->>DB: 10. Query existing account
            DB-->>Model: 11. Existing user or null
            Model-->>Svc: 12. Existing user or null

            alt Email or username already exists
                Svc-->>Ctrl: 13. ConflictError
                Ctrl-->>FE: 14. 409 Conflict
                FE-->>Guest: 15. Display duplicate account error
            else Account is available
                Svc->>Svc: 16. Generate and hash verification token
                Svc->>Model: 17. create(user data and token)
                Model->>Model: 18. Hash password in pre-save hook
                Model->>DB: 19. Insert user
                DB-->>Model: 20. User created
                Model-->>Svc: 21. Created user
                Svc->>Mail: 22. sendVerificationEmail(email, rawToken)
                Mail-->>Svc: 23. Email accepted by SMTP
                Svc->>Svc: 24. Generate access/refresh tokens and sanitize user
                Svc-->>Ctrl: 25. user and token pair
                Ctrl-->>FE: 26. 201 Created
                FE-->>Guest: 27. Display registration success
            end
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Guest {
    +register()
}

class RegisterPage {
    +validateForm(data)
    +onSubmit(data)
    +displayResult()
}

class AuthController {
    +register(req, res)
}

class AuthService {
    +register(input)
    -sanitizeUser(user)
}

class EmailService {
    +sendVerificationEmail(email, token)
}

class User {
    +ObjectId _id
    +String username
    +String email
    +String password
    +String authProvider
    +Boolean isEmailVerified
    +String emailVerificationToken
    +Date emailVerificationExpires
    +save()
}

class MongoDB

Guest --> RegisterPage : enters registration data
RegisterPage --> AuthController : POST /auth/register
AuthController --> AuthService : register()
AuthService --> User : findOne() / create()
AuthService --> EmailService : sends verification link
User --> MongoDB : query / insert
MongoDB --> User : user data
AuthService --> AuthController : user and tokens
AuthController --> RegisterPage : HTTP response
RegisterPage --> Guest : result
```

## 3.2 Login

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Guest
    participant FE as LoginPage (FE)
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant Model as User (Model)
    participant DB as MongoDB
    participant Store as AuthStore (Zustand)

    rect rgb(240,248,255)
        Note over Guest,Store: Login with email and password
    end

    Guest->>FE: 1. Enter email and password
    Guest->>FE: 2. Click "Login"
    FE->>FE: 3. Validate form with Zod

    alt Invalid client-side data
        FE-->>Guest: 4. Display validation errors
    else Valid client-side data
        FE->>Ctrl: 5. POST /api/v1/auth/login
        Note over Ctrl: authLimiter + validate(loginSchema)

        alt Invalid request body
            Ctrl-->>FE: 6. 400 Validation error
            FE-->>Guest: 7. Display validation error
        else Valid request body
            Ctrl->>Svc: 8. login(email, password)
            Svc->>Model: 9. findOne(email).select(password)
            Model->>DB: 10. Query local account
            DB-->>Model: 11. User or null
            Model-->>Svc: 12. User or null

            alt User missing or not a local account
                Svc-->>Ctrl: 13. UnauthorizedError
                Ctrl-->>FE: 14. 401 Invalid email or password
                FE-->>Guest: 15. Display login error
            else Local account exists
                Svc->>Model: 16. comparePassword(password)
                Model-->>Svc: 17. Match result

                alt Password does not match
                    Svc-->>Ctrl: 18. UnauthorizedError
                    Ctrl-->>FE: 19. 401 Invalid email or password
                    FE-->>Guest: 20. Display login error
                else Account is banned
                    Svc->>Svc: 21. assertNotBanned(user)
                    Svc-->>Ctrl: 22. ForbiddenError
                    Ctrl-->>FE: 23. 403 Account is banned
                    FE-->>Guest: 24. Display blocked-account error
                else Credentials are valid
                    Svc->>Svc: 25. Generate JWT pair and sanitize user
                    Svc-->>Ctrl: 26. user, accessToken, refreshToken
                    Ctrl-->>FE: 27. 200 OK
                    FE->>Store: 28. login(user, tokens)
                    Store-->>FE: 29. Persist authenticated state
                    FE-->>Guest: 30. Redirect to requested page or home
                end
            end
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Guest {
    +login()
}

class LoginPage {
    +validateForm(data)
    +onSubmit(data)
    +displayError()
}

class AuthStore {
    +User user
    +String accessToken
    +String refreshToken
    +Boolean isAuthenticated
    +login(user, accessToken, refreshToken)
    +clearAuth()
}

class AuthController {
    +login(req, res)
}

class AuthService {
    +login(input)
    -sanitizeUser(user)
}

class User {
    +ObjectId _id
    +String email
    +String password
    +String role
    +String authProvider
    +Boolean isBanned
    +Date bannedUntil
    +comparePassword(candidatePassword)
}

class JwtUtility {
    +generateTokenPair(payload)
}

class MongoDB

Guest --> LoginPage : enters credentials
LoginPage --> AuthController : POST /auth/login
AuthController --> AuthService : login()
AuthService --> User : findOne() / comparePassword()
User --> MongoDB : query
MongoDB --> User : user data
AuthService --> JwtUtility : creates token pair
AuthService --> AuthController : user and tokens
AuthController --> LoginPage : HTTP response
LoginPage --> AuthStore : persists session
LoginPage --> Guest : result
```

## 3.3 Login by Google

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Guest
    participant GoogleUI as Google Identity Services
    participant FE as LoginPage (FE)
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant GoogleAPI as Google OAuth2Client
    participant Model as User (Model)
    participant DB as MongoDB
    participant Store as AuthStore (Zustand)

    rect rgb(240,248,255)
        Note over Guest,Store: Login with Google
    end

    Guest->>GoogleUI: 1. Click "Sign in with Google"
    GoogleUI-->>FE: 2. Return Google ID credential
    FE->>Ctrl: 3. POST /api/v1/auth/google with idToken
    Note over Ctrl: authLimiter + validate(googleLoginSchema)
    Ctrl->>Svc: 4. googleLogin(idToken)

    alt Google OAuth is not configured
        Svc-->>Ctrl: 5. BadRequestError
        Ctrl-->>FE: 6. 400 Bad Request
        FE-->>Guest: 7. Display Google login error
    else Google OAuth is configured
        Svc->>GoogleAPI: 8. verifyIdToken(idToken, audience)

        alt Invalid token or missing identity claims
            GoogleAPI-->>Svc: 9. Verification failure
            Svc-->>Ctrl: 10. 401 Invalid Google token
            Ctrl-->>FE: 11. 401 Unauthorized
            FE-->>Guest: 12. Display Google login error
        else Valid Google payload
            GoogleAPI-->>Svc: 13. email, subject, name, picture
            Svc->>Model: 14. findOne(googleId or email)
            Model->>DB: 15. Query linked account
            DB-->>Model: 16. Existing user or null
            Model-->>Svc: 17. Existing user or null

            alt New Google user
                Svc->>Svc: 18. createUniqueUsername(baseUsername)
                Svc->>Model: 19. create(verified Google profile)
                Model->>DB: 20. Insert user
                DB-->>Model: 21. User created
                Model-->>Svc: 22. Created user
            else Existing user
                Svc->>Model: 23. Link googleId and update verified profile
                Model->>DB: 24. Save user
                DB-->>Model: 25. User updated
                Model-->>Svc: 26. Updated user
            end

            alt Account is banned
                Svc->>Svc: 27. assertNotBanned(user)
                Svc-->>Ctrl: 28. ForbiddenError
                Ctrl-->>FE: 29. 403 Account is banned
                FE-->>Guest: 30. Display blocked-account error
            else Account is active
                Svc->>Svc: 31. Generate JWT pair and sanitize user
                Svc-->>Ctrl: 32. user, accessToken, refreshToken
                Ctrl-->>FE: 33. 200 OK
                FE->>Store: 34. login(user, tokens)
                Store-->>FE: 35. Persist authenticated state
                FE-->>Guest: 36. Redirect to requested page or home
            end
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Guest {
    +loginWithGoogle()
}

class LoginPage {
    +initializeGoogleButton()
    +handleGoogleCredential(credential)
}

class GoogleIdentityServices {
    +initialize(config)
    +renderButton(element, options)
}

class AuthStore {
    +login(user, accessToken, refreshToken)
}

class AuthController {
    +googleLogin(req, res)
}

class AuthService {
    +googleLogin(input)
    -createUniqueUsername(baseUsername)
    -sanitizeUser(user)
}

class OAuth2Client {
    +verifyIdToken(options)
}

class User {
    +ObjectId _id
    +String email
    +String username
    +String authProvider
    +String googleId
    +Boolean isEmailVerified
    +Boolean isBanned
    +save()
}

class MongoDB

Guest --> GoogleIdentityServices : authenticates
GoogleIdentityServices --> LoginPage : ID credential
LoginPage --> AuthController : POST /auth/google
AuthController --> AuthService : googleLogin()
AuthService --> OAuth2Client : verifies token
AuthService --> User : findOne() / create() / save()
User --> MongoDB : query / insert / update
MongoDB --> User : user data
AuthService --> AuthController : user and tokens
AuthController --> LoginPage : HTTP response
LoginPage --> AuthStore : persists session
LoginPage --> Guest : result
```

## 3.4 Reset Password

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Guest
    participant ForgotFE as ForgotPasswordPage (FE)
    participant ResetFE as ResetPasswordPage (FE)
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant Model as User (Model)
    participant DB as MongoDB
    participant Mail as EmailService / SMTP

    rect rgb(240,248,255)
        Note over Guest,Mail: Request and use a password-reset link
    end

    Guest->>ForgotFE: 1. Enter email and submit
    ForgotFE->>ForgotFE: 2. Validate email with Zod
    ForgotFE->>Ctrl: 3. POST /api/v1/auth/forgot-password
    Ctrl->>Svc: 4. forgotPassword(email)
    Svc->>Model: 5. findOne(email).select(reset fields)
    Model->>DB: 6. Query user
    DB-->>Model: 7. User or null
    Model-->>Svc: 8. User or null

    alt Existing local account
        Svc->>Svc: 9. Generate and hash reset token with 1-hour expiry
        Svc->>Model: 10. save(reset token and expiry)
        Model->>DB: 11. Update user
        DB-->>Model: 12. User updated
        Model-->>Svc: 13. Saved
        Svc->>Mail: 14. sendPasswordResetEmail(email, rawToken)
        Mail-->>Svc: 15. Reset link sent
    else Unknown email or Google-only account
        Note over Svc: Do not disclose whether the account exists
    end

    Svc-->>Ctrl: 16. Complete without account details
    Ctrl-->>ForgotFE: 17. 200 Generic success message
    ForgotFE-->>Guest: 18. Display reset-link notice

    opt Guest receives a reset email
        Mail-->>Guest: 19. Email containing /reset-password?token=...
        Guest->>ResetFE: 20. Open link and enter new password
        ResetFE->>ResetFE: 21. Read token and validate matching passwords

        alt Missing token or invalid form
            ResetFE-->>Guest: 22. Display validation error
        else Token and form are present
            ResetFE->>Ctrl: 23. POST /api/v1/auth/reset-password
            Ctrl->>Svc: 24. resetPassword(token, password)
            Svc->>Model: 25. findOne(hashed token and unexpired date)
            Model->>DB: 26. Query reset token
            DB-->>Model: 27. User or null
            Model-->>Svc: 28. User or null

            alt Token is invalid or expired
                Svc-->>Ctrl: 29. BadRequestError
                Ctrl-->>ResetFE: 30. 400 Invalid or expired token
                ResetFE-->>Guest: 31. Display reset error
            else Token is valid
                Svc->>Model: 32. Set password and clear reset fields
                Model->>Model: 33. Hash password in pre-save hook
                Model->>DB: 34. Save user
                DB-->>Model: 35. User updated
                Model-->>Svc: 36. Saved
                Svc-->>Ctrl: 37. Password reset completed
                Ctrl-->>ResetFE: 38. 200 Password reset successful
                ResetFE-->>Guest: 39. Display success and login link
            end
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Guest {
    +requestPasswordReset()
    +resetPassword()
}

class ForgotPasswordPage {
    +onSubmit(email)
    +displayGenericResult()
}

class ResetPasswordPage {
    +readToken()
    +validatePasswords()
    +onSubmit(data)
}

class AuthController {
    +forgotPassword(req, res)
    +resetPassword(req, res)
}

class AuthService {
    +forgotPassword(input)
    +resetPassword(input)
}

class EmailService {
    +sendPasswordResetEmail(email, token)
}

class TokenUtility {
    +generateRawToken()
    +hashToken(token)
}

class User {
    +ObjectId _id
    +String email
    +String password
    +String authProvider
    +String passwordResetToken
    +Date passwordResetExpires
    +save()
}

class MongoDB

Guest --> ForgotPasswordPage : submits email
ForgotPasswordPage --> AuthController : POST /auth/forgot-password
Guest --> ResetPasswordPage : submits token and password
ResetPasswordPage --> AuthController : POST /auth/reset-password
AuthController --> AuthService : delegates reset operations
AuthService --> TokenUtility : generates / hashes token
AuthService --> EmailService : sends reset link
AuthService --> User : findOne() / save()
User --> MongoDB : query / update
MongoDB --> User : user data
AuthController --> ForgotPasswordPage : generic response
AuthController --> ResetPasswordPage : reset result
```

## 3.5 Change Password

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Account as User / Admin
    participant FE as ChangePasswordPage (FE)
    participant AuthMW as authenticate Middleware
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant Model as User (Model)
    participant DB as MongoDB

    rect rgb(240,248,255)
        Note over Account,DB: Change the current account password
    end

    Account->>FE: 1. Enter current password, new password, confirmation
    Account->>FE: 2. Click "Change password"
    FE->>FE: 3. Validate form with Zod

    alt Invalid client-side data
        FE-->>Account: 4. Display validation errors
    else Valid client-side data
        FE->>AuthMW: 5. POST /api/v1/auth/change-password with Bearer token
        AuthMW->>AuthMW: 6. Verify access token
        AuthMW->>Model: 7. findById(token.userId)
        Model->>DB: 8. Query role and ban status
        DB-->>Model: 9. User or null
        Model-->>AuthMW: 10. Authentication data

        alt Missing, invalid, or expired access token
            AuthMW-->>FE: 11. 401 Unauthorized
            FE-->>Account: 12. Redirect to login or display error
        else Account is banned
            AuthMW-->>FE: 13. 403 Account is banned
            FE-->>Account: 14. Clear session and redirect to login
        else Authenticated account
            AuthMW->>Ctrl: 15. Forward validated request with userId
            Ctrl->>Svc: 16. changePassword(userId, data)
            Svc->>Model: 17. findById(userId).select(password)
            Model->>DB: 18. Query account
            DB-->>Model: 19. User or null
            Model-->>Svc: 20. User or null

            alt User not found
                Svc-->>Ctrl: 21. 400 User not found
                Ctrl-->>FE: 22. 400 Bad Request
                FE-->>Account: 23. Display error
            else Google-only account
                Svc-->>Ctrl: 24. 400 Password login is not enabled
                Ctrl-->>FE: 25. 400 Bad Request
                FE-->>Account: 26. Display account-provider error
            else Local account
                Svc->>Model: 27. comparePassword(currentPassword)
                Model-->>Svc: 28. Match result

                alt Current password is incorrect
                    Svc-->>Ctrl: 29. UnauthorizedError
                    Ctrl-->>FE: 30. 401 Current password is incorrect
                    FE-->>Account: 31. Display password error
                else Current password is correct
                    Svc->>Model: 32. Set new password and save()
                    Model->>Model: 33. Hash password in pre-save hook
                    Model->>DB: 34. Update password
                    DB-->>Model: 35. User updated
                    Model-->>Svc: 36. Saved
                    Svc-->>Ctrl: 37. Password changed
                    Ctrl-->>FE: 38. 200 OK
                    FE-->>Account: 39. Reset form and display success
                end
            end
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Account {
    +String role
    +changePassword()
}

class ChangePasswordPage {
    +validateForm(data)
    +onSubmit(data)
    +resetForm()
}

class AuthenticateMiddleware {
    +authenticate(req, res, next)
}

class AuthController {
    +changePassword(req, res)
}

class AuthService {
    +changePassword(userId, input)
}

class JwtUtility {
    +verifyAccessToken(token)
}

class User {
    +ObjectId _id
    +String password
    +String authProvider
    +String role
    +Boolean isBanned
    +Date bannedUntil
    +comparePassword(candidatePassword)
    +save()
}

class MongoDB

Account --> ChangePasswordPage : submits passwords
ChangePasswordPage --> AuthenticateMiddleware : Bearer token and request
AuthenticateMiddleware --> JwtUtility : verifies access token
AuthenticateMiddleware --> User : checks account status
AuthenticateMiddleware --> AuthController : authenticated request
AuthController --> AuthService : changePassword()
AuthService --> User : findById() / comparePassword() / save()
User --> MongoDB : query / update
MongoDB --> User : user data
AuthController --> ChangePasswordPage : HTTP response
ChangePasswordPage --> Account : result
```

## 3.6 Logout

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Account as User / Admin
    participant FE as AppNavbar (FE)
    participant Api as authService (FE)
    participant AuthMW as authenticate Middleware
    participant Model as User (Model)
    participant DB as MongoDB
    participant Ctrl as AuthController
    participant Store as AuthStore (Zustand)

    rect rgb(240,248,255)
        Note over Account,Store: Logout from a stateless JWT session
    end

    Account->>FE: 1. Click "Logout"
    FE->>Api: 2. logout()
    Api->>AuthMW: 3. POST /api/v1/auth/logout with Bearer token
    AuthMW->>AuthMW: 4. Verify access token
    AuthMW->>Model: 5. findById(token.userId)
    Model->>DB: 6. Query role and ban status
    DB-->>Model: 7. User or null
    Model-->>AuthMW: 8. Authentication data

    alt Token and account are valid
        AuthMW->>Ctrl: 9. Forward authenticated request
        Note over Ctrl: No server-side token revocation is performed
        Ctrl-->>Api: 10. 200 Logged out
        Api-->>FE: 11. Request completed
    else Authentication fails
        AuthMW-->>Api: 12. 401 or 403
        Api-->>FE: 13. Reject request
    end

    Note over FE,Store: finally block always clears local authentication
    FE->>Store: 14. logout()
    Store->>Store: 15. Clear user and both JWTs from persisted state
    Store-->>FE: 16. Unauthenticated state
    FE-->>Account: 17. Navigate to home page
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Account {
    +logout()
}

class AppNavbar {
    +handleLogout()
}

class AuthApiService {
    +logout()
}

class AuthStore {
    +User user
    +String accessToken
    +String refreshToken
    +Boolean isAuthenticated
    +logout()
    +clearAuth()
}

class AuthenticateMiddleware {
    +authenticate(req, res, next)
}

class AuthController {
    +logout(req, res)
}

class JwtUtility {
    +verifyAccessToken(token)
}

class User {
    +ObjectId _id
    +String role
    +Boolean isBanned
    +Date bannedUntil
}

class MongoDB

Account --> AppNavbar : clicks logout
AppNavbar --> AuthApiService : logout()
AuthApiService --> AuthenticateMiddleware : POST /auth/logout
AuthenticateMiddleware --> JwtUtility : verifies token
AuthenticateMiddleware --> User : checks account
User --> MongoDB : query
MongoDB --> User : authentication data
AuthenticateMiddleware --> AuthController : authenticated request
AuthController --> AuthApiService : success response
AppNavbar --> AuthStore : clears persisted session
AppNavbar --> Account : redirects home
```

## 3.7 View Public Profile

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Guest
    participant FE as ProfilePage (FE)
    participant Api as userService (FE)
    participant Route as UserRoutes
    participant Model as User (Model)
    participant DB as MongoDB

    rect rgb(240,248,255)
        Note over Guest,DB: View a public user profile
    end

    Guest->>FE: 1. Open /profile/{userId}
    FE->>Api: 2. getProfile(userId)
    Api->>Route: 3. GET /api/v1/users/{userId}
    Route->>Model: 4. findById(userId)
    Model->>DB: 5. Query user
    DB-->>Model: 6. User or null
    Model-->>Route: 7. User or null

    alt User not found
        Route-->>Api: 8. 404 User not found
        Api-->>FE: 9. Reject request
        FE-->>Guest: 10. Display profile-not-found error
    else User exists
        Note over Model,Route: Fields marked select:false are omitted by Mongoose
        Route-->>Api: 11. 200 Public user data
        Api-->>FE: 12. User profile, stats, and ranking
        FE->>FE: 13. Calculate presentation metrics
        FE-->>Guest: 14. Display public profile
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class Guest {
    +viewPublicProfile(userId)
}

class ProfilePage {
    +loadProfile(userId)
    +getDisplayName(user)
    +getWinRate(user)
    +getAverageScore(user)
    +renderProfile()
}

class UserApiService {
    +getProfile(userId)
}

class UserRoutes {
    +getPublicProfile(req, res)
}

class User {
    +ObjectId _id
    +String username
    +String email
    +String role
    +String authProvider
    +Boolean isEmailVerified
    +Profile profile
    +Stats stats
    +Ranking ranking
    +Date createdAt
}

class Profile {
    +String displayName
    +String avatar
    +String bio
    +String school
    +String club
}

class Stats {
    +Number totalDebates
    +Number wins
    +Number losses
    +Number draws
    +Number avgScore
}

class Ranking {
    +Number elo
    +String tier
    +Number seasonPoints
}

class MongoDB

Guest --> ProfilePage : opens profile URL
ProfilePage --> UserApiService : getProfile()
UserApiService --> UserRoutes : GET /users/{id}
UserRoutes --> User : findById()
User --> MongoDB : query
MongoDB --> User : user data
User *-- Profile
User *-- Stats
User *-- Ranking
UserRoutes --> UserApiService : HTTP response
UserApiService --> ProfilePage : profile data
ProfilePage --> Guest : rendered public profile
```

### Notes

- `Login by Google` is listed separately because it extends `Login` in the Guest use case diagram.
- `Create Topic` appears twice in the User use case diagram and is listed once here.
- The standalone `View` oval in the Guest diagram is not connected to an actor and does not identify a specific function, so it is not included as a Detailed Design item.

---

## 3.15 Rejoin Room

The current implementation restores a participant through Socket.IO. The client emits `join-room` again after the socket connects or reconnects, and the server rebuilds the authoritative room state from `DebateRoom`, `DebateSession`, and `Message`.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Matches as LiveMatchesPage (FE)
    participant Debate as DebateRoomPage (FE)
    participant Hook as useDebateSocket
    participant Socket as Socket.IO Gateway
    participant Handler as RoomSocketHandler
    participant Room as DebateRoom (Model)
    participant Session as DebateSession (Model)
    participant Message as Message (Model)
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over User,DB: Rejoin Room
    end

    User->>Matches: 1. Click "Rejoin"
    Matches->>Debate: 2. Navigate to /debate/{roomId}
    Debate->>Hook: 3. Mount debate socket synchronization
    Hook->>Socket: 4. Emit join-room { roomId }
    Socket->>Handler: 5. joinRoom(roomId, userId)

    Handler->>Room: 6. findById(roomId)
    Room->>DB: 7. Query room without password
    DB-->>Room: 8. Return room
    Room-->>Handler: 9. Room and participants

    alt Room missing or user is not a participant
        Handler-->>Socket: 10. room:error and failed acknowledgement
        Socket-->>Hook: 11. Rejoin rejected
        Hook-->>Debate: 12. Set synchronization error
        Debate-->>User: 13. Display retry/error state
    else Participant is authorized
        par Load debate session
            Handler->>Session: 10. findOne({ roomId })
            Session->>DB: 11. Query current session
            DB-->>Session: 12. Session state
            Session-->>Handler: 13. Current phase, turn, timer and scores
        and Load public chat history
            Handler->>Message: 10. find recent room messages
            Message->>DB: 11. Query latest 50 messages
            DB-->>Message: 12. Message records
            Message-->>Handler: 13. Ordered chat history
        end

        Handler->>Socket: 14. Join socket room {roomId}
        Handler->>Socket: 15. Emit room:joined and room:state-restore
        Handler->>Socket: 16. Emit chat:history
        Handler->>Handler: 17. Cancel pending disconnect timeout
        Socket-->>Hook: 18. Deliver authoritative room state
        Hook->>Debate: 19. restoreState(payload)
        Debate-->>User: 20. Display restored debate room
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class User {
    +String id
    +rejoinRoom()
}

class LiveMatchesPage {
    +handleRejoinClick(roomId)
}

class DebateRoomPage {
    +String roomId
    +renderRestoredState()
}

class UseDebateSocket {
    +emitJoin(roomId)
    +restoreState(payload)
    +retrySync()
}

class RoomSocketHandler {
    +joinRoom(payload, ack)
    +rejoinRoom(payload, ack)
    +buildRoomStatePayload(roomId, userId)
}

class DebateRoom {
    +ObjectId id
    +String status
    +Participant[] participants
    +findById()
}

class DebateSession {
    +ObjectId roomId
    +CurrentTurn currentTurn
    +FinalScores finalScores
    +findOne()
}

class Message {
    +ObjectId roomId
    +String content
    +Date timestamp
    +find()
}

class MongoDB

User --> LiveMatchesPage : selects rejoin
LiveMatchesPage --> DebateRoomPage : navigates
DebateRoomPage --> UseDebateSocket : starts synchronization
UseDebateSocket --> RoomSocketHandler : join-room
RoomSocketHandler --> DebateRoom : reads participant state
RoomSocketHandler --> DebateSession : reads debate state
RoomSocketHandler --> Message : reads chat history
DebateRoom --> MongoDB : query
DebateSession --> MongoDB : query
Message --> MongoDB : query
RoomSocketHandler --> UseDebateSocket : state restore
UseDebateSocket --> DebateRoomPage : updates store
DebateRoomPage --> User : restored room
```

---

## 3.16 Leave Room

Leaving a room is persisted through `POST /api/v1/rooms/{id}/leave`. The route removes the participant, clears host/judge references, transfers ownership when required, and broadcasts the updated room state.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Actor as User / Admin
    participant FE as LobbyPage or DebateRoomPage (FE)
    participant Guard as RoomParticipantGuard
    participant Ctrl as RoomController
    participant Room as DebateRoom (Model)
    participant Socket as Socket.IO Gateway
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over Actor,DB: Leave Room
    end

    Actor->>FE: 1. Click "Leave room"
    FE->>Guard: 2. POST /rooms/{id}/leave { newOwnerId? }
    Guard->>Guard: 3. Authenticate access token
    Guard->>Room: 4. Find room and participant
    Room->>DB: 5. Query room
    DB-->>Room: 6. Return room
    Room-->>Guard: 7. Room participant data

    alt User is not an authenticated participant
        Guard-->>FE: 8. 401/403 response
        FE-->>Actor: 9. Return to matches
    else Participant is authorized
        Guard->>Ctrl: 8. Forward room and participant
        Ctrl->>Ctrl: 9. Remove participant
        Ctrl->>Ctrl: 10. Clear host and judge references

        alt Room becomes empty
            Ctrl->>Room: 11. deleteOne()
            Room->>DB: 12. Delete room
            DB-->>Room: 13. Room deleted
            Room-->>Ctrl: 14. Delete confirmed
            Ctrl-->>FE: 15. 200 OK - room deleted
        else Participants remain
            alt Leaving participant is the owner
                Ctrl->>Ctrl: 11. Select requested or first successor
                Ctrl->>Ctrl: 12. Transfer owner and primary role
            else Leaving participant is not the owner
                Ctrl->>Ctrl: 11. Keep current owner
            end

            Ctrl->>Room: 13. save()
            Room->>DB: 14. Update room
            DB-->>Room: 15. Room updated
            Room-->>Ctrl: 16. Updated room
            Ctrl->>Socket: 17. broadcastRoomState(roomId)
            Socket-->>FE: 18. room:state-restore for remaining clients
            Ctrl-->>FE: 19. 200 OK - Left room
        end

        FE->>FE: 20. Clear stored debate room
        FE-->>Actor: 21. Navigate to /matches
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class UserOrAdmin {
    +ObjectId id
    +leaveRoom()
}

class RoomPage {
    +leaveMutation(newOwnerId)
    +clearDebateRoomFromStorage()
}

class RoomParticipantGuard {
    +authenticate(token)
    +verifyParticipant(roomId, userId)
}

class RoomController {
    +leaveRoom(roomId, userId, newOwnerId)
    +transferOwnership(room, successor)
    +broadcastRoomState(roomId)
}

class DebateRoom {
    +ObjectId id
    +ObjectId createdBy
    +ObjectId hostId
    +Participant[] participants
    +Judge[] judges
    +save()
    +deleteOne()
}

class SocketIOServer {
    +to(roomId)
    +emit(event, payload)
}

class MongoDB

UserOrAdmin --> RoomPage : requests leave
RoomPage --> RoomParticipantGuard : POST leave
RoomParticipantGuard --> DebateRoom : verifies membership
RoomParticipantGuard --> RoomController : authorized request
RoomController --> DebateRoom : remove/update/delete
DebateRoom --> MongoDB : persist
RoomController --> SocketIOServer : broadcast update
SocketIOServer --> RoomPage : synchronized state
RoomPage --> UserOrAdmin : redirect
```

---

## 3.17 Join Ranked Queue

The ranked queue is created through `POST /api/v1/matchmaking/queue`. `MatchmakingService` searches compatible waiting entries by format and ELO tolerance, creates the ranked room and session when enough players are available, then emits `match:found` to each matched user.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as RankQueuePage (FE)
    participant Ctrl as MatchmakingController
    participant Svc as MatchmakingService
    participant Queue as MatchQueue (Model)
    participant UserModel as User (Model)
    participant Room as DebateRoom (Model)
    participant Session as DebateSession (Model)
    participant Socket as Socket.IO Gateway
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over User,DB: Join Ranked Queue
    end

    User->>FE: 1. Select 1v1 or 3v3 format
    User->>FE: 2. Click "Join queue"
    FE->>Ctrl: 3. POST /matchmaking/queue { format }
    Ctrl->>Ctrl: 4. Authenticate user
    Ctrl->>Queue: 5. find active queue entry by userId
    Queue->>DB: 6. Query waiting or matched entry
    DB-->>Queue: 7. Existing entry or null
    Queue-->>Ctrl: 8. Queue status

    alt User is already waiting
        Ctrl-->>FE: 9. 400 Already in queue
        FE-->>User: 10. Display queue error
    else User is already in an active match
        Ctrl-->>FE: 9. 400 Already matched
        FE-->>User: 10. Display match status
    else User can enter queue
        Ctrl->>UserModel: 9. findById(userId)
        UserModel->>DB: 10. Query ranking and profile
        DB-->>UserModel: 11. User record
        UserModel-->>Ctrl: 12. User with current ELO

        alt User not found
            Ctrl-->>FE: 13. 404 User not found
            FE-->>User: 14. Display error
        else User exists
            Ctrl->>Queue: 13. create waiting queue entry
            Queue->>DB: 14. Insert MatchQueue
            DB-->>Queue: 15. Queue entry created
            Queue-->>Ctrl: 16. Waiting entry
            Ctrl->>Svc: 17. tryCreateRankMatch(entry)
            Svc->>Queue: 18. Find compatible waiting entries
            Queue->>DB: 19. Query by format, status and ELO range
            DB-->>Queue: 20. Candidate entries
            Queue-->>Svc: 21. Compatible candidates

            alt Not enough compatible players
                Svc-->>Ctrl: 22. matched = false
                Ctrl-->>FE: 23. 201 Joined queue, status waiting
                FE-->>User: 24. Display queue scanner
            else Enough compatible players
                Svc->>UserModel: 22. Load all matched users
                UserModel->>DB: 23. Query usernames and avatars
                DB-->>UserModel: 24. Matched users
                UserModel-->>Svc: 25. Ordered player records
                Svc->>Room: 26. create ranked debate room
                Room->>DB: 27. Insert active DebateRoom
                DB-->>Room: 28. Room created
                Room-->>Svc: 29. Ranked room
                Svc->>Session: 30. create initial debate session
                Session->>DB: 31. Insert DebateSession
                DB-->>Session: 32. Session created
                Session-->>Svc: 33. Initial session
                Svc->>Queue: 34. Mark all entries matched
                Queue->>DB: 35. Update matchedRoomId and status
                DB-->>Queue: 36. Queue entries updated
                Svc->>Socket: 37. Emit match:found to user channels
                Socket-->>FE: 38. match:found { roomId }
                Svc-->>Ctrl: 39. matched = true and room
                Ctrl-->>FE: 40. 201 Match found
                FE-->>User: 41. Navigate to /debate/{roomId}
            end
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class UserActor {
    +ObjectId id
    +joinRankedQueue()
}

class RankQueuePage {
    +DebateFormat format
    +joinMutation()
    +handleEnterDebate()
}

class MatchmakingController {
    +joinQueue(userId, format)
    +getStatus(userId)
    +leaveQueue(userId)
}

class MatchmakingService {
    +tryCreateRankMatch(entry)
    +getQueueEloTolerance(entry)
    +getQueueWaitTimeSeconds(entry)
    +emitMatchFound(userIds, roomId)
}

class MatchQueue {
    +ObjectId userId
    +String format
    +Number eloAtQueue
    +String status
    +ObjectId matchedRoomId
    +create()
    +find()
    +updateMany()
}

class UserModel {
    +ObjectId id
    +String username
    +Ranking ranking
    +findById()
}

class DebateRoom {
    +String roomType
    +String format
    +String status
    +Participant[] participants
    +create()
}

class DebateSession {
    +ObjectId roomId
    +CurrentTurn currentTurn
    +create()
}

class SocketIOServer {
    +to(userChannel)
    +emit(matchFound, payload)
}

class MongoDB

UserActor --> RankQueuePage : chooses format
RankQueuePage --> MatchmakingController : POST queue
MatchmakingController --> MatchQueue : checks and creates entry
MatchmakingController --> UserModel : reads ELO
MatchmakingController --> MatchmakingService : attempts match
MatchmakingService --> MatchQueue : finds and updates entries
MatchmakingService --> UserModel : loads players
MatchmakingService --> DebateRoom : creates match room
MatchmakingService --> DebateSession : creates session
MatchmakingService --> SocketIOServer : publishes match found
MatchQueue --> MongoDB : query/update
UserModel --> MongoDB : query
DebateRoom --> MongoDB : insert
DebateSession --> MongoDB : insert
SocketIOServer --> RankQueuePage : match:found
RankQueuePage --> UserActor : enters debate
```

---

## 3.18 Watch Live Match

The Live Matches page loads available rooms, then joins a running room as a viewer when the current user is not already a participant. Private rooms require a valid password before the debate page and socket channel are opened.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Actor as User / Admin
    participant Matches as LiveMatchesPage (FE)
    participant RoomCtrl as RoomController
    participant UserModel as User (Model)
    participant Room as DebateRoom (Model)
    participant Debate as DebateRoomPage (FE)
    participant Socket as RoomSocketHandler
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over Actor,DB: Watch Live Match
    end

    Actor->>Matches: 1. Open Live Matches
    Matches->>RoomCtrl: 2. GET /rooms?status=active
    RoomCtrl->>Room: 3. Find visible live rooms
    Room->>DB: 4. Query active/paused rooms
    DB-->>Room: 5. Live room list
    Room-->>RoomCtrl: 6. Rooms without passwords
    RoomCtrl-->>Matches: 7. 200 OK with live matches
    Matches-->>Actor: 8. Display available matches
    Actor->>Matches: 9. Click "Watch Live"

    alt Actor is already a room participant
        Matches->>Debate: 10. Navigate to /debate/{roomId}?mode=viewer
    else Actor is not a participant
        alt Room is private
            Matches-->>Actor: 10. Prompt for room password
            Actor->>Matches: 11. Submit password
            Matches->>RoomCtrl: 12. POST /rooms/{id}/join { password }
        else Room is public
            Matches->>RoomCtrl: 10. POST /rooms/{id}/join
        end

        RoomCtrl->>Room: 13. findById(roomId) with password
        Room->>DB: 14. Query room
        DB-->>Room: 15. Room record
        Room-->>RoomCtrl: 16. Room state

        alt Room closed or password invalid
            RoomCtrl-->>Matches: 17. 400/403 response
            Matches-->>Actor: 18. Display connection error
        else Room accepts the viewer
            RoomCtrl->>UserModel: 17. findById(actorId)
            UserModel->>DB: 18. Query profile
            DB-->>UserModel: 19. User record
            UserModel-->>RoomCtrl: 20. Username and avatar
            RoomCtrl->>Room: 21. Add participant with viewer role
            Room->>DB: 22. Save room participants
            DB-->>Room: 23. Room updated
            Room-->>RoomCtrl: 24. Updated room
            RoomCtrl-->>Matches: 25. 200 Joined room
            Matches->>Debate: 26. Navigate to debate viewer mode
        end
    end

    Debate->>Socket: 27. Emit join-room { roomId }
    Socket->>Room: 28. Verify participant and load room state
    Room->>DB: 29. Query authoritative state
    DB-->>Room: 30. Current room
    Room-->>Socket: 31. Participant authorized
    Socket-->>Debate: 32. room:state-restore
    Debate-->>Actor: 33. Display live debate stream and state
```

### Class Diagram

```mermaid
classDiagram
direction LR

class UserOrAdmin {
    +ObjectId id
    +watchLiveMatch()
}

class LiveMatchesPage {
    +getLiveRooms(filters)
    +handleWatchClick(room)
    +submitPrivatePassword(password)
}

class RoomController {
    +listRooms(filters)
    +joinRoom(roomId, userId, password)
    +broadcastRoomState(roomId)
}

class UserModel {
    +ObjectId id
    +String username
    +Profile profile
    +findById()
}

class DebateRoom {
    +ObjectId id
    +String status
    +Boolean isPrivate
    +String password
    +Participant[] participants
    +find()
    +findById()
    +save()
}

class DebateRoomPage {
    +String roomId
    +renderViewerMode()
}

class RoomSocketHandler {
    +joinRoom(payload, ack)
    +buildRoomStatePayload(roomId, userId)
}

class MongoDB

UserOrAdmin --> LiveMatchesPage : selects live match
LiveMatchesPage --> RoomController : lists/joins room
RoomController --> DebateRoom : validates and adds viewer
RoomController --> UserModel : loads viewer profile
DebateRoom --> MongoDB : query/update
UserModel --> MongoDB : query
LiveMatchesPage --> DebateRoomPage : opens viewer mode
DebateRoomPage --> RoomSocketHandler : joins socket channel
RoomSocketHandler --> DebateRoom : verifies participant
RoomSocketHandler --> DebateRoomPage : restores live state
DebateRoomPage --> UserOrAdmin : displays match
```

---

## 3.19 View Results

The result page calls `GET /api/v1/debate/{roomId}/replay`. The backend loads the final `DebateSession` and selected `DebateRoom` data, and the frontend calculates the per-round presentation from stored judge verdicts.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Actor as User / Admin
    participant FE as ResultPage (FE)
    participant Ctrl as DebateController
    participant Session as DebateSession (Model)
    participant Room as DebateRoom (Model)
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over Actor,DB: View Results
    end

    Actor->>FE: 1. Select "View Result"
    FE->>Ctrl: 2. GET /debate/{roomId}/replay
    Ctrl->>Session: 3. findOne({ roomId })
    Session->>DB: 4. Query debate session
    DB-->>Session: 5. Session or null
    Session-->>Ctrl: 6. Replay session

    alt Session not found
        Ctrl-->>FE: 7. 404 Session not found
        FE-->>Actor: 8. Display match not found
    else Session exists
        Ctrl->>Room: 7. findById(roomId)
        Room->>DB: 8. Query title, motion, format and participants
        DB-->>Room: 9. Room data
        Room-->>Ctrl: 10. Result room summary
        Ctrl-->>FE: 11. 200 OK { room, session }
        FE->>FE: 12. Group judge verdicts by round and team
        FE->>FE: 13. Calculate display totals and winner label
        FE-->>Actor: 14. Display scoreboard, feedback and participants
    end

    opt Score changes while page is open
        Ctrl-->>FE: 15. score:updated or score:winner-determined
        FE->>Ctrl: 16. Refetch replay data
        Ctrl-->>FE: 17. Return latest result
        FE-->>Actor: 18. Refresh result view
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class UserOrAdmin {
    +viewResults(roomId)
}

class ResultPage {
    +String roomId
    +loadReplay()
    +groupVerdictsByRound()
    +calculateDisplayTotals()
    +renderResult()
}

class DebateController {
    +getReplay(roomId)
    +getScores(roomId)
}

class DebateSession {
    +ObjectId roomId
    +TurnHistory[] turnHistory
    +FinalScores finalScores
    +String aiSummary
    +findOne()
}

class DebateRoom {
    +ObjectId id
    +String title
    +String motion
    +String format
    +Participant[] participants
    +findById()
}

class MongoDB

UserOrAdmin --> ResultPage : opens result
ResultPage --> DebateController : GET replay
DebateController --> DebateSession : loads final scores
DebateController --> DebateRoom : loads match context
DebateSession --> MongoDB : query
DebateRoom --> MongoDB : query
DebateController --> ResultPage : room and session
ResultPage --> UserOrAdmin : rendered result
```

---

## 3.20 View Debate History

The history page calls `GET /api/v1/users/{id}/history`. The backend verifies the user, loads completed rooms containing that user, joins them with debate sessions, and derives win/loss/draw for each history item.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as HistoryPage (FE)
    participant Ctrl as UserController
    participant UserModel as User (Model)
    participant Room as DebateRoom (Model)
    participant Session as DebateSession (Model)
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over User,DB: View Debate History
    end

    User->>FE: 1. Open debate history
    FE->>Ctrl: 2. GET /users/{id}/history?page&limit
    Ctrl->>Ctrl: 3. Normalize pagination values
    Ctrl->>UserModel: 4. findById(userId)
    UserModel->>DB: 5. Query user identifier
    DB-->>UserModel: 6. User or null
    UserModel-->>Ctrl: 7. User lookup result

    alt User not found
        Ctrl-->>FE: 8. 404 User not found
        FE-->>User: 9. Display history error
    else User exists
        par Load completed rooms
            Ctrl->>Room: 8. find completed rooms containing user
            Room->>DB: 9. Query, sort and paginate rooms
            DB-->>Room: 10. Completed room records
            Room-->>Ctrl: 11. Paginated rooms
        and Count completed rooms
            Ctrl->>Room: 8. countDocuments(filter)
            Room->>DB: 9. Count matching rooms
            DB-->>Room: 10. Total count
            Room-->>Ctrl: 11. Total history items
        end

        Ctrl->>Session: 12. find sessions by roomIds
        Session->>DB: 13. Query final scores
        DB-->>Session: 14. Debate sessions
        Session-->>Ctrl: 15. Session map by roomId
        Ctrl->>Ctrl: 16. Derive role, side and win/loss/draw
        Ctrl-->>FE: 17. 200 paginated history
        FE->>FE: 18. Render history cards and pagination
        FE-->>User: 19. Display debate history
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class UserActor {
    +ObjectId id
    +viewDebateHistory()
}

class HistoryPage {
    +Number page
    +loadHistory(userId, page)
    +openReplay(sessionId)
}

class UserController {
    +getHistory(userId, page, limit)
    +deriveResult(participant, winner)
}

class UserModel {
    +ObjectId id
    +String username
    +findById()
}

class DebateRoom {
    +ObjectId id
    +String title
    +String motion
    +String format
    +String status
    +Date endedAt
    +Participant[] participants
    +find()
    +countDocuments()
}

class DebateSession {
    +ObjectId id
    +ObjectId roomId
    +FinalScores finalScores
    +find()
}

class DebateHistoryItem {
    +String sessionId
    +String roomId
    +String userRole
    +String userSide
    +String result
}

class MongoDB

UserActor --> HistoryPage : opens history
HistoryPage --> UserController : GET history
UserController --> UserModel : validates user
UserController --> DebateRoom : loads completed matches
UserController --> DebateSession : loads winners
UserController --> DebateHistoryItem : maps response
UserModel --> MongoDB : query
DebateRoom --> MongoDB : query/count
DebateSession --> MongoDB : query
UserController --> HistoryPage : paginated items
HistoryPage --> UserActor : displays history
```

---

## 3.21 Receive Notification

Notifications are currently realtime and transient rather than stored in a standalone `Notification` collection. Personalized events such as `match:found` are sent to `user:{userId}` Socket.IO channels. Debate notifications are derived from persisted judge verdicts and system messages, then rendered by `DebateMotionStage`.

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Actor as User / Admin
    participant FE as Notification UI (FE)
    participant Hook as Socket Hooks
    participant Socket as Socket.IO Gateway
    participant Publisher as Matchmaking or Debate Service
    participant Queue as MatchQueue (Model)
    participant Session as DebateSession (Model)
    participant Message as Message (Model)
    participant DB as MongoDB

    rect rgb(240,248,255)
    Note over Actor,DB: Receive Notification
    end

    Actor->>FE: 1. Open authenticated application
    FE->>Hook: 2. Initialize socket listeners
    Hook->>Socket: 3. Connect with access token
    Socket->>Socket: 4. Verify JWT

    alt Token is invalid
        Socket-->>Hook: 5. Authentication error
        Hook-->>FE: 6. Connection unavailable
        FE-->>Actor: 7. Display authentication state
    else Token is valid
        Socket->>Socket: 5. Join user:{userId} channel

        alt Ranked match is found
            Publisher->>Queue: 6. Mark queue entries matched
            Queue->>DB: 7. Save matchedRoomId and status
            DB-->>Queue: 8. Queue records updated
            Queue-->>Publisher: 9. Match persisted
            Publisher->>Socket: 10. Emit match:found to user channel
            Socket-->>Hook: 11. match:found { roomId }
            Hook-->>FE: 12. Notify match found
            FE-->>Actor: 13. Show toast and open debate room
        else Judge score or system update is produced
            alt Judge score update
                Publisher->>Session: 6. Save judge verdict/final score
                Session->>DB: 7. Update DebateSession
                DB-->>Session: 8. Session updated
                Session-->>Publisher: 9. Updated score state
                Publisher->>Socket: 10. Emit score update to room channel
            else System message update
                Publisher->>Message: 6. Save system message
                Message->>DB: 7. Insert Message
                DB-->>Message: 8. Message created
                Message-->>Publisher: 9. Persisted system update
                Publisher->>Socket: 10. Emit room/message update
            end

            Socket-->>Hook: 11. Deliver realtime room event
            Hook-->>FE: 12. Refresh session/store data
            FE->>FE: 13. Build notification from verdicts/messages
            FE-->>Actor: 14. Display notification in Motion Announcement
        end
    end
```

### Class Diagram

```mermaid
classDiagram
direction LR

class UserOrAdmin {
    +ObjectId id
    +receiveNotification()
}

class NotificationUI {
    +showToast(message)
    +renderDebateNotifications(items)
}

class SocketHooks {
    +useSocket()
    +useMatchSocket()
    +useDebateSocket()
    +subscribe(event, handler)
}

class SocketIOServer {
    +authenticate(token)
    +join(userChannel)
    +to(channel)
    +emit(event, payload)
}

class EventPublisher {
    +emitMatchFound(userIds, roomId)
    +publishScoreUpdate(roomId, scores)
    +publishSystemMessage(roomId, message)
}

class MatchQueue {
    +ObjectId userId
    +String status
    +ObjectId matchedRoomId
    +updateMany()
}

class DebateSession {
    +ObjectId roomId
    +FinalScores finalScores
    +save()
}

class Message {
    +ObjectId roomId
    +String type
    +String content
    +Date timestamp
    +create()
}

class DebateMotionStage {
    +Notification[] notifications
    +renderNotifications()
}

class MongoDB

UserOrAdmin --> NotificationUI : views notifications
NotificationUI --> SocketHooks : registers listeners
SocketHooks --> SocketIOServer : authenticated connection
EventPublisher --> MatchQueue : persists match state
EventPublisher --> DebateSession : persists score state
EventPublisher --> Message : persists system update
MatchQueue --> MongoDB : update
DebateSession --> MongoDB : update
Message --> MongoDB : insert
EventPublisher --> SocketIOServer : emits realtime event
SocketIOServer --> SocketHooks : pushes event
SocketHooks --> NotificationUI : updates UI
NotificationUI --> DebateMotionStage : renders debate feed
NotificationUI --> UserOrAdmin : toast/feed
```
