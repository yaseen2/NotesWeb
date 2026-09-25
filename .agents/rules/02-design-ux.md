# Rule: Design & User Experience (NotesWeb)

## Core Philosophy
NotesWeb is a high-yield study platform. The design must be distraction-free, aesthetically refined, and engineered for sustained reading and rapid exam recall.

## Academic & Reading Ergonomics
- **Typography:**
  - Modern, crisp font pairings with an academic touch (e.g. Latin Modern / Outfit / Inter / Merriweather).
  - Optimal reading measure: 65–75 characters per line for narrative body text.
  - Comfortable line-height: `1.6` to `1.8` for long notes, `1.4` to `1.5` for concise bullet lists.
- **Reading Themes:**
  - Provide 3 carefully calibrated modes:
    1. **Paper / Light:** Soft off-white background (`#fcfbf9` or `#f8f9fa`) to eliminate harsh glare.
    2. **Sepia / Warm:** Warm parchment tone (`#f4ecd8` / `#2c221e`) for long, eye-fatigue-free reading sessions.
    3. **Dark / Midnight:** Deep neutral slate (`#0f172a` / `#1e293b`) with muted text contrast (not stark `#000000` / `#ffffff`).

## Dual-Tier Visual Hierarchy
- **Short Notes View (Revision Tier):**
  - High-density revision cards styled with authentic LaTeX `tcolorbox` aesthetics (colored left-border or header banner, muted background fill).
  - Clear bullet points with scannable bold lead-ins (e.g., `**Core Demand:** Separate Electorates`).
  - Interactive concept triggers must have a distinct, inviting visual cue (subtle dotted underline or accent highlight tag) with instant hover/focus feedback.
- **Long Notes Context (Deep-Dive Tier):**
  - Rendered in a clean, article-style reading format with clear heading hierarchy (H1–H4), analytical blockquotes, and exam takeaways.

## Context Drawer & Interaction Rules
- **Zero Reading Position Loss:** Clicking a concept to inspect long notes must **never** disorient or scroll the Short Notes view. Closing the context view must return the user precisely to where they were reading.
- **Desktop (>= 1024px):** Split-screen or docked slide-in drawer on the right side so Short Notes and Long Context can be read concurrently.
- **Tablet / Mobile (< 1024px):** Slide-over panel or responsive bottom-sheet with a clear drag handle and close button.
- **Keyboard Shortcuts:** `ESC` to close context drawer; `Alt + 1` for Short Notes, `Alt + 2` for Long Notes.

## Responsiveness & Touch Targets
- Mobile-first responsive layout from 320px to large screens.
- All interactive links, buttons, and concept tags must have touch target sizes of at least 44x44px on mobile devices.
- No hover-only interactions: all features must work with a single tap.
