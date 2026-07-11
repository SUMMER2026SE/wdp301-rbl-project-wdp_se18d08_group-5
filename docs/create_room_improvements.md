# Room Creation UI/UX Improvement Documentation

This document describes the enhancements made to the Create Room module in the frontend, outlining the design choices, template preset widgets, and style guidelines.

---

## 🛠️ Design Philosophy

The room creation page has been converted into a premium **Gaming Setup Console**. Key improvements include:

1. **Interactive Preset Templates**: Standard match modes (AI Duel, Human League, Private Training) are highlighted as large cards. Clicking any card instantly configures formats, host seats, judging metrics, and privacy locks.
2. **Cyberpunk Inputs**: Form inputs are rendered inside clean grouped panels, utilizing glowing neon labels, styled selectors, and custom switch controllers.
3. **Structured Flow Layout**: The form parameters are clearly grouped into 3 distinct sections (1. Room Profile, 2. Arena Parameters, and 3. Privacy Configuration) to make form-filling logical and tidy.

---

## 📁 File Structure Additions & Modifications

### 1. Stylesheet

- **[NEW]** [`frontend/src/styles/create_room.css`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/styles/create_room.css): Defines styling classes for grouped form sections, preset card selectors, active neon switches, and hover scaling.

### 2. Components (`frontend/src/components/room/`)

The room creation page includes the following preset selector module:

- **[NEW]** [`CreateRoomPresets.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/room/CreateRoomPresets.tsx): Renders custom templates (e.g. AI Practice, League Championship, Locked Sparring) to let users pre-populate the form instantly.

### 3. Integrated Pages (`frontend/src/pages/room/`)

- **[MODIFIED]** [`CreateRoomPage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/room/CreateRoomPage.tsx): Updated to load the preset templates and style fields while maintaining inputs validation and mutation calls.
