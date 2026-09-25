# Rule: Architecture & Scalability (NotesWeb)

## Core Architectural Principles
NotesWeb must separate the **Content Layer** from the **UI Rendering Layer**. Adding new subjects (e.g., Islamic History, Gender Studies) or chapters should be purely data-driven without modifying UI components.

## Two-Tier Data Model (Extensible to 3 Tiers)
1. **Short Notes Tier (`shortNotes`):**
   - Derived from LaTeX structure (`.tex`).
   - Fields: `id`, `subjectId`, `chapterId`, `title`, `period`, `keyTakeaway` (content + theme color), `subsections: [{ title, points: [] }]`, `concepts: [{ term, targetSectionId }]`.
2. **Long Notes Tier (`longNotes`):**
   - Derived from Google Docs / Markdown sources (`.md`).
   - Fields: `id`, `subjectId`, `chapterId`, `title`, `sections: [{ id, heading, contentMarkdown }]`.
3. **Future Extensibility (Shortest / Flash-Facts Tier):**
   - The schema must include an optional `flashFacts: [{ label, value, date }]` or `keyDates: []` slot per topic so the 3rd tier can be activated later with zero database or schema migrations.

## Semantic Concept Linking Engine
- Every concept trigger in Short Notes references a deterministic target anchor in Long Notes (e.g. `conceptId: "swadeshi-boycott"` maps to `sectionId: "swadeshi-boycott"`).
- The Context Resolver:
  - If target section exists: scroll drawer directly to the highlighted section.
  - Fallback: if no granular anchor exists, open the parent topic's long note at the top with a search highlight.

## Directory Structure
```
src/
├── data/                  # Content layer (decoupled from UI)
│   ├── subjects/          # e.g., pakistan-affairs/, islamic-history/
│   │   ├── short/         # Structured short notes JSON/data
│   │   └── long/          # Markdown or structured long notes
│   └── subjectsRegistry.js# Registry of all available subjects & chapters
├── components/
│   ├── reader/            # ShortNotesViewer, LongNotesViewer, ConceptTag
│   ├── drawer/            # ContextDrawer, PeekCard, SplitPaneContainer
│   ├── navigation/        # Header, SubjectPicker, ChapterNav, SearchModal
│   └── ui/                # ThemeToggle, Button, Badge, Card
├── context/               # ReadingContext (activeSubject, activeChapter, activeConcept, theme)
├── styles/                # Design tokens, reading themes, LaTeX styling
└── utils/                 # LaTeX parser, markdown renderer, search indexer
```

## Scalability & Offline-First Hygiene
- **Local-first & Zero Latency:** No heavy backend required for reading. All data loads client-side with lightning speed.
- **Fast Client Search:** Index notes with a lightweight index (e.g., Fuse.js / MiniSearch) so searching across subjects returns instant results under 20ms.
- **Config & Theme Persistence:** Reading preferences (theme, font size, drawer width) persist in `localStorage`.
