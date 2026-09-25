# Rule: Documentation & Note Authoring (NotesWeb)

## Code-Level Documentation
- Every component and utility has a concise header comment: purpose, props/inputs, and behavior.
- Document the concept-linking contracts (e.g., how `conceptId` resolution works and how missing anchors are handled).
- Keep state and context hooks documented with simple usage examples.

## Note Authoring Guide (For Content Creators & Contributors)
Document the straightforward process for adding or updating notes:
1. **Adding a New Subject:**
   - Add entry in `src/data/subjectsRegistry.js` with `id`, `title`, and icon.
2. **Adding Short Notes:**
   - Place structured JSON/data in `src/data/subjects/[subject-id]/short/`.
   - Specify `title`, `period`, `keyTakeaway`, `subsections`, and interactive `concepts`.
3. **Adding Long Notes:**
   - Place markdown or structured sections in `src/data/subjects/[subject-id]/long/`.
   - Use standard markdown headings (`## Section Title {#anchor-id}`) matching the concept keys.

## Repository Documentation
- Root `README.md` must contain:
  - Project vision: 2-tier dual-pane study platform for high-yield exams.
  - Tech stack & dependencies.
  - Quickstart guide: `npm install`, `npm run dev`, `npm run build`.
  - Content structure and how to import Google Docs / LaTeX notes.
- Keep `.agents/rules/` files concise, lean, and updated.
