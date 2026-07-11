# Matchmaking / Queue UI/UX Improvement Documentation

This document describes the enhancements made to the Matchmaking / Rank Queue module in the frontend, detailing the sci-fi visual radar scanner, stats cards, and console controls.

---

## 🛰️ Design Philosophy

The competitive matchmaking page has been converted into a high-fidelity **Sci-Fi Queue Center**. Features include:

1. **Futuristic Radar Dish**: When searching for an opponent, a military radar scan overlay activates, rendering rotating sweeps and pulsing ping beacons in real-time.
2. **System Log Console**: An inline terminal showing queue status alerts (socket bindings, ELO range expansions).
3. **Queue Console Deck**: Cyberpunk styled console buttons to initialize or cancel matching.
4. **Transition Tickers**: Glowing alert headers indicating when a match is found before moving to the arena page.

---

## 📁 File Structure Additions & Modifications

### 1. Stylesheet

- **[NEW]** [`frontend/src/styles/matchmaking.css`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/styles/matchmaking.css): Configures the keyframes for radar sweeps, concentric dashed circles, pulsing coordinates, and command console logs.

### 2. Components (`frontend/src/components/matchmaking/`)

The matchmaking page has been divided into 4 modular components:

- **[NEW]** [`QueueConsole.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matchmaking/QueueConsole.tsx): Toggles matchmaking search format (1v1 vs 3v3) and ELO matchmaking levels.
- **[NEW]** [`RadarScanner.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matchmaking/RadarScanner.tsx): An animated radar dish detailing the search progress.
- **[NEW]** [`QueueStatsCard.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matchmaking/QueueStatsCard.tsx): Displays current wait time, ELO search range expansions, and system logs.
- **[NEW]** [`MatchFoundBanner.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/matchmaking/MatchFoundBanner.tsx): Renders an overlay block when a debate room is successfully generated.

### 3. Integrated Pages (`frontend/src/pages/matchmaking/`)

- **[MODIFIED]** [`RankQueuePage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/matchmaking/RankQueuePage.tsx): Updated to load the visual components, keeping the react-query status checks and navigate hooks working.
