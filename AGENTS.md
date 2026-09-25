# Project Agent Instructions

This project is **NotesWeb**: a specialized, high-performance two-tier study and revision web platform.
It connects **Short Notes** (structured, high-density revision cards derived from LaTeX) with **Long Notes** (comprehensive contextual background derived from Google Docs/Markdown), featuring concept-level deep linking without losing reading context.

Detailed rules live in `.agents/rules/`, split by topic so each file stays small and cheap to re-read on every task.

Read every file in `.agents/rules/` before writing any code. If a rule here ever conflicts with a specific rules file, the specific file wins.

## Quick summary
- Build incrementally, one feature tier at a time — see `01-workflow.md`
- Reading-first UX: clean LaTeX typography, dual-pane drawer, zero reading position loss — see `02-design-ux.md`
- Scalable two-tier data model (with future 3rd tier / shortest notes support) — see `03-architecture-scalability.md`
- Document everything for developers and note authors — see `04-documentation.md`
- Accessibility, fast search, KaTeX accuracy, and mobile ergonomics — see `05-quality-assurance.md`

## Rules files
- `.agents/rules/01-workflow.md`
- `.agents/rules/02-design-ux.md`
- `.agents/rules/03-architecture-scalability.md`
- `.agents/rules/04-documentation.md`
- `.agents/rules/05-quality-assurance.md`
