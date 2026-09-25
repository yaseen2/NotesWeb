# Rule: Quality Assurance & Reading Experience (NotesWeb)

## Reading Experience & Ergonomics QA
- **Contrast & Legibility:** Verify that all 3 themes (Paper Light, Warm Sepia, Midnight Dark) pass WCAG AA contrast ratio (minimum 4.5:1 for body text, 3:1 for large headings and UI icons).
- **Typography Stability:** Text rendering must have no abrupt font-swapping or layout shifts (CLS = 0). Line length should stay within 65–75 characters on desktop for narrative text.

## Concept Linking & Drawer QA
- **Zero Reading Position Loss:** Clicking a concept to inspect Long Notes MUST NEVER cause the Short Notes view to jump or scroll away from the user's active reading line.
- **Drawer Behavior:**
  - Drawer slides in smoothly without lagging or dropping frames.
  - Pressing `ESC` closes the drawer immediately and returns focus to the clicked concept.
  - Opening the drawer on desktop should not horizontally push or squash the Short Notes into illegible widths.
- **Graceful Fallbacks:** If a concept tag links to an anchor that does not exist in Long Notes, the system must gracefully highlight the topic root with an informative fallback notice.

## Performance & Responsiveness
- **Instant Search:** Client-side search queries must respond in under 50ms across all subjects and chapters.
- **Mobile (< 1024px) Ergonomics:**
  - Concept tags must have comfortable tap areas (minimum 44x44px touch targets).
  - Context drawer must transition into a sleek bottom sheet or full-width slide-over with a prominent dismiss button.
- **Cross-Browser:** Test in Chrome, Firefox, Edge, and Safari (WebKit).
