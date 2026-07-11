# Lobby Page UI/UX Improvement Documentation

This document describes the enhancements made to the Debate Match Lobby page in the frontend, detailing layout updates and style rules.

---

## 🚪 Design Philosophy

The Debate Lobby page has been optimized for wide-screen configurations to fully utilize visual spaces. Highlights include:

1. **Widescreen Container Adjustments**: The container class is overridden with `.lobby-page-container` to expand the max-width up to `1400px`, avoiding narrow margin traps.
2. **Glassmorphism Group Boxes**: Card frames use dark gradient overlays, subtle cyan neon borders, and glowing title divider stripes.
3. **Optimized Tables**: Participant lists are laid out in a translucent table grid with highlighted owner tags and hover sweeps.
4. **Action Alerts**: Start warnings and locked states are styled using primary icons and neon badge indicators.

---

## 📁 File Structure Additions & Modifications

### 1. Stylesheet

- **[NEW]** [`frontend/src/styles/lobby.css`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/styles/lobby.css): Custom variables defining lobby card borders, table cells padding, modal overlays, and primary button hover states.

### 2. Integrated Pages (`frontend/src/pages/room/`)

- **[MODIFIED]** [`LobbyPage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/room/LobbyPage.tsx): Overhauled to import the new `lobby.css` and use the `.lobby-page-container` container.
