# Forum UI/UX Improvement Documentation

This document describes the enhancements made to the Forum module in the frontend, outlining the design philosophy, components structure, and styling details.

---

## 🎨 Design Philosophy

The redesign elevates the basic forums into a premium **Neon Cyberpunk Arena** matching the site's dark-mode design system. Key improvements include:

1. **Interactive Ratio Split Bars**: Visual display of the percentage of Agree vs Disagree votes on cards and headers.
2. **Glassmorphism Panels**: Deep translucent backgrounds, subtle primary color overlays, and thin neon borders.
3. **Polarized Stance Columns**: Side-by-side split lanes representing Proposition (vibrant cyan neon) vs Opposition (vibrant magenta/pink neon) opinions.
4. **Enhanced Typography**: Headlines styled with the futuristic `Orbitron` typeface, body text with the structured `Rajdhani` sans-serif, and styled counters.

---

## 📁 File Structure Additions & Modifications

### 1. Stylesheet

- **[NEW]** [`frontend/src/styles/forum.css`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/styles/forum.css): Defines custom utility classes, grid templates, shadow glows, animations, timeline comments, and hover scaling.

### 2. Components (`frontend/src/components/forum/`)

We separated the large page files into 9 modular, reusable, type-safe React components:

- **[NEW]** [`ForumEmptyState.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumEmptyState.tsx): Displays a glowing wireframe layout if no results are found.
- **[NEW]** [`ForumTopicCard.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumTopicCard.tsx): Displays the debate topic preview, votes bar, active timing, and author details.
- **[NEW]** [`ForumStancePoll.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumStancePoll.tsx): Circular/linear voting proportion indicator at the top of the topic detail page.
- **[NEW]** [`ForumPostCard.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumPostCard.tsx): A high-fidelity card to show user stance, opinion text, collapsible research/evidence text and images, reaction counters, and integrated comment sections.
- **[NEW]** [`ForumCommentSection.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumCommentSection.tsx): A timeline comment stream showing stance badges for commenter alignment.
- **[NEW]** [`CreateTopicModal.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/CreateTopicModal.tsx): Dialog for starting a debate with countdown markers and quick-preset inspiration prompts.
- **[NEW]** [`ForumPageHeader.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumPageHeader.tsx): The page hero banner with search inputs, sort selectors, and category filters.
- **[NEW]** [`ForumStatsWidget.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/ForumStatsWidget.tsx): Aggregated statistics dashboard displaying hot trending topics.
- **[NEW]** [`StanceToggle.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/components/forum/StanceToggle.tsx): An interactive double switch button with neon highlight states.

### 3. Integrated Pages (`frontend/src/pages/forum/`)

- **[MODIFIED]** [`ForumPage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/forum/ForumPage.tsx): Integrates sorting (Active, Newest, Most Posts, Most Votes) and filtering options (All, Hot, Controversial) locally on the client to ensure instant feedback, alongside rendering components.
- **[MODIFIED]** [`ForumTopicPage.tsx`](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/pages/forum/ForumTopicPage.tsx): Displays side-by-side battle lanes for the debate columns, a custom styled opinion form with live file attachment preview, and modularized query/mutation actions.

---

## 🕹️ Interactive Features Overview

### A. Sort & Filter Controls

- **Search Input**: Filters topics dynamically based on search query matching.
- **Quick Filters**:
  - `All`: Default view.
  - `Hot`: Restricts to active debates (topics with multiple posts or votes).
  - `Controversial`: Isolates debates with close voting ratios (e.g. difference is less than 45% of total votes).
- **Sorting Choices**:
  - `Active`: Default activity order.
  - `Newest`: Sorts from the latest created date.
  - `Most Posts`: Sorts topics based on post density.
  - `Most Votes`: Sorts topics by total participant feedback.

### B. Dynamic Stance Selection

- Selecting **Agree** or **Disagree** updates the database state via `stanceMutation`.
- Selecting a side opens a premium visual composer. The composer is customized dynamically: a cyan overlay for Proposition arguments and a magenta layout for Opposition arguments.
- Once published, opinion cards are automatically appended to the respective battle columns with custom glowing borders.

### C. Collapsible Supporting Evidence

- Users can optionally link evidence text and images to back up their views.
- If a post contains evidence, it is collapsed into a distinct styled drawer within the post card.
- Clicking attached thumbnails launches high-resolution views.
