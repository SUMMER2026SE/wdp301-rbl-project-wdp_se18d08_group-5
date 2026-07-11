# Live Matches UI/UX Improvement Documentation

This document describes the enhancements made to the Live Matches module in the frontend, detailing the design specifications, component structure, and user flows.

---

## 🎬 Design Philosophy

The Live Matches page has been converted from a plain card list into a **Cyberpunk Streaming Arena** layout. Main changes include:

1. **ON AIR Featured Match Banner**: The most active live debate is highlighted in a widescreen glassmorphism hero banner with a pulsing red broadcast dot.
2. **Interactive Filters Deck**: Format toggles and drop-downs have been structured as an integrated cockpit control panel.
3. **Status-Based Card Glows**:
   - `Live`: Pulsing green outer glows (`--bs-success`) and red status tags.
   - `Lobbies`: Cyan neon borders.
   - `Completed`: Muted dark styles.
4. **Sidebar Metrics**: Dashboard analytics detailing total rooms, active viewers, waiting lobbies, and occupancy.

---

## 📁 File Structure Additions & Modifications

### 1. Stylesheet

- **[NEW]** [`frontend/src/styles/matches.css`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/styles/matches.css): Defines styling rules for pulsing ON AIR tags, custom button group colors, status-based glow effects, and responsive card alignments.

### 2. Components (`frontend/src/components/matches/`)

The matches page has been refactored into 5 modular components:

- **[NEW]** [`FeaturedMatchHero.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matches/FeaturedMatchHero.tsx): Promotes the featured active debate with animated "LIVE" tickers and spectate triggers.
- **[NEW]** [`MatchesSearchFilter.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matches/MatchesSearchFilter.tsx): Cyberpunk filter deck to manage format, status, and room types.
- **[NEW]** [`MatchCard.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matches/MatchCard.tsx): Displays individual match details, active user counts, format tags, and context-dependent action buttons (Spectate, Rejoin, Join Lobby, results).
- **[NEW]** [`JoinRoomModal.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matches/JoinRoomModal.tsx): Handles room entry passwords for locked rooms.
- **[NEW]** [`MatchesStatsWidget.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matches/MatchesStatsWidget.tsx): Aggregates total participants and active streams.

### 3. Integrated Pages (`frontend/src/pages/matches/`)

- **[MODIFIED]** [`LiveMatchesPage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/matches/LiveMatchesPage.tsx): Integrates all new widgets, socket update handlers, and spectating mutations.

---

## 🕹️ Interactive Features Overview

### A. Dynamic Spectating & Rejoining

- The system automatically scans the user's role on the match.
- If a participant is a host/debater/judge, the card displays **Rejoin**.
- If a participant is a visitor, the card displays **Watch Live**.
- Private matches launch a verification drawer requesting the password key.

### B. Live Socket Synchronization

- Sockets restore state triggers are bound to page queries to invalidate and fetch the latest match counts and occupancies in real-time.
