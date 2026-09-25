# NotesWeb 📚

> **Specialized, High-Yield Two-Tier Study & Revision Web Platform**

NotesWeb is designed for high-stakes, revision-intensive academic and competitive exam preparation (such as CSS Pakistan Affairs, History, and beyond). It bridges the gap between **high-density revision summaries** (Short Notes) and **comprehensive contextual deep-dives** (Long Notes), featuring frictionless concept-level deep linking without losing reading context.

---

## 🌟 Key Features

- **Dual-Tier Dual-Pane Reading Architecture:**
  - **Tier 1 (Short Notes / Revision Cards):** Ultra-condensed, scannable revision cards styled with authentic LaTeX `tcolorbox` aesthetics, bold lead-in bullet points, and high-yield takeaways.
  - **Tier 2 (Long Notes / Deep Context):** Full background narrative rendered from Markdown/Google Docs with structured headings, analytical quotes, and historical context.
- **Zero Reading Position Loss:** Click any highlighted concept term in your Short Notes to instantly inspect the relevant section in the Context Drawer without losing your place or disorientation.
- **Reading Themes & Ergonomics:**
  - 📄 **Paper / Light:** Crisp, glare-free off-white academic paper background (`#fcfbf9`).
  - 📜 **Warm Sepia:** Eye-fatigue-free parchment palette for prolonged late-night study sessions.
  - 🌙 **Midnight Slate:** Modern, dark-slate mode with muted contrast for visual comfort.
- **Instant Client-Side Search:** Search across all subjects, chapters, takeaways, and topics with sub-millisecond response times.
- **Local-First & Offline Capable:** Zero backend dependencies; your entire vault, edits, and reading preferences load instantly from local storage.
- **Mobile-First Responsive Layout:** Full desktop split-screen context pane transitions into a smooth touch-friendly bottom-sheet on tablets and mobile devices.

---

## 🛠️ Tech Stack & Dependencies

- **Core & Runtime:** [React 18](https://react.dev/), [Vite 6](https://vitejs.dev/)
- **Mathematics & Typography:** [KaTeX](https://katex.org/) for beautiful mathematical & LaTeX formula rendering
- **Markdown Processing:** [Marked](https://marked.js.org/) for fast, extensible markdown rendering
- **Icons & UI:** [Lucide React](https://lucide.dev/) for crisp vector iconography
- **Document Tooling:** [PDF.js](https://mozilla.github.io/pdf.js/) for in-browser document parsing and reference layers

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yaseen2/NotesWeb.git

# Navigate to project directory
cd NotesWeb

# Install dependencies
npm install
```

### Development Server

```bash
# Start Vite development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📁 Content Structure & Note Authoring

NotesWeb strictly separates the **Content Layer** from the **UI Rendering Layer**:

```
src/
├── data/
│   └── defaultVault.js    # Bundled default vault (Pakistan Affairs, etc.)
├── components/
│   ├── reader/            # ShortNotesViewer, LongNotesViewer, ConceptTag
│   ├── drawer/            # ContextDrawer, PeekCard, SplitPaneContainer
│   ├── navigation/        # Header, SubjectPicker, ChapterNav, SearchModal
│   └── ui/                # ThemeToggle, Button, Badge, Card
├── context/               # ReadingContext & VaultContext
└── styles/                # Themes, LaTeX styling, and design tokens
```

### Adding or Updating Notes

1. **Subjects & Chapters:**
   Each subject in the vault defines metadata (`id`, `title`, `code`, `chapters`).
2. **Short Notes (LaTeX-style):**
   Formatted with LaTeX-style sections, `\begin{tcolorbox}[title=Key Takeaway]`, and bulleted `\begin{itemize}` points with concept anchors.
3. **Long Notes (Markdown / Docs):**
   Formatted with clear Markdown headings (`#`, `##`, `###`) matching the concept anchors used in the Short Notes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
