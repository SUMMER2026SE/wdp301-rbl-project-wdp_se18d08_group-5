# AI Debate Platform - Frontend

React-based single-page application for the AI Debate Platform.

## Tech Stack

- **React 18** with TypeScript
- **Vite** — build tool and dev server
- **React Router v6** — client-side routing
- **Zustand** — state management
- **React Query (TanStack)** — server state and caching
- **React Bootstrap + Bootstrap 5** — UI components
- **Socket.IO Client** — real-time communication
- **React Hook Form + Zod** — form handling and validation
- **Axios** — HTTP client
- **Recharts** — data visualization

## Project Structure

```
src/
├── components/common/    # Shared UI components (Navbar, LoadingScreen, ProtectedRoute)
├── config/               # Environment configuration
├── hooks/                # Custom hooks (useSocket, useDebateSocket, useAuthInit)
├── layouts/              # Page layouts (MainLayout, DebateLayout)
├── pages/                # Route pages
│   ├── auth/             # Login, Register
│   ├── debate/           # Debate room
│   ├── matches/          # Live matches
│   ├── matchmaking/      # Ranked queue
│   ├── ranking/          # Leaderboard
│   ├── replay/           # Match replay
│   ├── room/             # Create room, Lobby
│   └── user/             # Profile
├── routes/               # Route definitions
├── services/             # API service layer
├── stores/               # Zustand stores (auth, debate)
├── types/                # TypeScript type definitions
└── utils/                # Constants, formatters
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint & Format

```bash
npm run lint
npm run format
```

## Path Aliases

The project uses path aliases for cleaner imports:

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@features/*` | `src/features/*` |
| `@hooks/*` | `src/hooks/*` |
| `@stores/*` | `src/stores/*` |
| `@services/*` | `src/services/*` |
| `@types/*` | `src/types/*` |
| `@utils/*` | `src/utils/*` |
| `@layouts/*` | `src/layouts/*` |
| `@pages/*` | `src/pages/*` |
