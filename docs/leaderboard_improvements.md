# Leaderboard UI/UX Improvement Documentation

This document describes the enhancements made to the Leaderboard / Rankings module in the frontend, outlining the design choices, component modularization, and user interactions.

---

## 🏆 Design Philosophy

The Rankings page has been converted into a premium **E-sports League Standings** dashboard. Key features include:

1. **Interactive 3D Podium**: On the first page, the top 3 players are highlighted on floating neon-themed pedestals. Rank 1 is centered, elevated, and glowing with Gold neon. Rank 2 (left) and Rank 3 (right) are styled with Silver and Bronze neon frames respectively.
2. **Win Rate Ratio Bars**: Standard win/loss/draw records are supplemented with visual progress bars indicating player win percentages.
3. **Standings Medals**: The top 10 competitors display custom medals/badges instead of boring plain index numbers.
4. **Client-side Filtering**: Instant searching and ELO tier selection tabs (e.g. GrandMaster, Master, Expert, Advanced, etc.) to immediately narrow down standings.

---

## 📁 File Structure Additions & Modifications

### 1. Stylesheet

- **[NEW]** [`frontend/src/styles/leaderboard.css`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/styles/leaderboard.css): Sets styling variables for pedestals, custom table headers, e-sports medals, glowing ELO numbers, and dynamic card overlays.

### 2. Components (`frontend/src/components/ranking/`)

The rankings page has been split into 4 modular components:

- **[NEW]** [`LeaderboardPodium.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/ranking/LeaderboardPodium.tsx): Renders the 3D-podium layout for Ranks 1, 2, and 3, complete with ELO tags, custom avatar rings, and win ratios.
- **[NEW]** [`LeaderboardStatsCard.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/ranking/LeaderboardStatsCard.tsx): Displays overall summary metrics (Peak ELO score, average ELO in list, and total competitors shown).
- **[NEW]** [`LeaderboardSearchFilter.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/ranking/LeaderboardSearchFilter.tsx): A search bar and selection pills for all ELO ranks to filter results.
- **[NEW]** [`LeaderboardRow.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/ranking/LeaderboardRow.tsx): Renders high-fidelity table rows featuring custom medals, user ELO displays, and inline win rate progress bars.

### 3. Integrated Pages (`frontend/src/pages/ranking/`)

- **[MODIFIED]** [`LeaderboardPage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/ranking/LeaderboardPage.tsx): Overhauled to integrate all newly created widgets, styling classes, and client-side searching/filtering, while preserving all existing `react-i18next` translation keys.

---

## 🕹️ Interactive Features Overview

### A. E-sports Medals & Indexes

- **Top 1 Gold Trophy**: `bi-trophy-fill` icon with gold circular background.
- **Top 2 & 3 Medals**: Silver and bronze circular badges.
- **Top 4-10 Badges**: Highlighted semi-translucent circular frame to designate the top ten tier.
- **Other standings**: Clean numerical representation.

### B. Instant Searching & Tier Selection

- Typing into the search bar dynamically filters matches in real-time.
- Selecting ranking buttons (e.g. _Master_) restricts lists instantly without requiring reloading delay, boosting UX speed.

### C. Win Rate Visual Gauge

- Shows green progress lines calculated by `(wins / totalGames) * 100`.
- Provides hover and visual highlights of win/loss/draw breakdowns.
