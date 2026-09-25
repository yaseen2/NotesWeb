# Rule: Incremental Build Workflow

## Why
Large one-shot builds cause dropped requirements, broken linking logic, and complex debugging. Build NotesWeb in small, verifiable increments.

## NotesWeb Build Phases
When planning or implementing, follow these prioritized phases:
1. **Data Schema & Content Ingestion:** Define structured schemas for Short Notes (LaTeX-style takeaways/bullets) and Long Notes (Google Docs/Markdown sections). Load initial Pakistan Affairs dataset.
2. **Design Tokens & Reading Themes:** Core layout tokens, reading typography (Latin Modern/Inter/Serif), and theme modes (Light, Paper/Sepia, Dark).
3. **Short Notes Reader (Primary View):** High-density revision cards, takeaway boxes, and structured bullet lists.
4. **Context Drawer & Long Notes Pane:** Side-by-side context pane on desktop / slide-over drawer that displays deep-dive material without losing short notes reading position.
5. **Bidirectional Concept Linking:** Interactive concept triggers in short notes that link deterministically to headings/paragraphs in long notes.
6. **Navigation & Global Search:** Subject/chapter switcher, chapter outline/TOC, and fast client-side keyword search.
7. **Mobile & Tablet Ergonomics:** Responsive touch targets (>=44px), mobile bottom sheet drawer, and distraction-free reading controls.
8. **Final QA & Polish Pass:** Keyboard shortcuts (ESC to close drawer, J/K navigation), zero layout shift, and performance checks.

## Process Rules
1. Work on exactly one item from the plan per step. Confirm it runs and renders correctly before moving to the next.
2. After each step: state what was built, verify visually and functionally, and note any follow-ups.
3. Keep changes additive and modular. Never perform massive rewrites of working features to add a small feature.
4. Re-read the relevant rules file(s) before each step.
