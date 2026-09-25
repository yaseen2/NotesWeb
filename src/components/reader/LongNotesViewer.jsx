// src/components/reader/LongNotesViewer.jsx - Detailed Context Viewer with Point-and-Click Connect Mode & Backlinks

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useReading } from '../../context/ReadingContext';
import { parseLongNotesMarkdown } from '../../utils/markdownParser.js';
import { FileQuestion, Target, Check, X, ArrowLeft } from 'lucide-react';

export default function LongNotesViewer() {
  const {
    activeAnchor,
    activeConcept,
    longNotesRaw,
    contentLoading,
    connectSource,
    completeConnection,
    cancelConnectMode,
    chapterConnections,
    deleteConnection,
  } = useReading();

  const containerRef = useRef(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Parse markdown into enhanced HTML with anchors
  const longNotesHtml = useMemo(() => {
    if (!longNotesRaw) return '';
    return parseLongNotesMarkdown(longNotesRaw);
  }, [longNotesRaw]);

  // Compute backlinks mapping: targetSectionId -> array of source concept objects
  const backlinksByTargetId = useMemo(() => {
    const map = {};
    if (!chapterConnections) return map;
    chapterConnections.forEach((conn) => {
      if (!conn.targets) return;
      conn.targets.forEach((tgt) => {
        const tid = tgt.targetSectionId;
        if (!tid) return;
        if (!map[tid]) map[tid] = [];
        map[tid].push({
          conceptId: conn.id,
          sourceText: conn.source?.text || conn.source?.terms?.[0] || conn.id,
          isBuiltin: conn.isBuiltin,
        });
      });
    });
    return map;
  }, [chapterConnections]);

  // Helper to scroll the Short Notes pane directly back to a concept or card (works in PDF and Web A4)
  const scrollToShortConcept = (conceptText) => {
    if (!conceptText) return;

    // 1. PDF Mode check: find matching SVG concept box
    const pdfBoxes = Array.from(document.querySelectorAll('.pdf-concept-box'));
    const pdfMatch = pdfBoxes.find((box) => {
      const id = box.getAttribute('data-concept-id');
      const phrase = box.getAttribute('data-phrase') || '';
      return (
        id === conceptText ||
        phrase.toLowerCase().includes(conceptText.toLowerCase()) ||
        conceptText.toLowerCase().includes(phrase.toLowerCase())
      );
    });

    if (pdfMatch) {
      pdfMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pdfMatch.classList.remove('flash-target');
      void pdfMatch.offsetWidth;
      pdfMatch.classList.add('flash-target');
      setTimeout(() => pdfMatch.classList.remove('flash-target'), 2600);
      return;
    }

    // 2. Web A4 & Continuous HTML mode check
    const shortDoc = document.querySelector('.latex-document, .a4-desk-canvas');
    if (!shortDoc) return;

    // Search in prioritized order: exact ID -> Section Heading -> Concept Trigger -> Container
    let match = null;
    try {
      match = shortDoc.querySelector(`[data-concept-id="${CSS.escape(conceptText)}"]`);
    } catch (e) {}

    if (!match) {
      const headings = Array.from(
        shortDoc.querySelectorAll('.latex-section, .a4-section-title, .latex-subsection, h1, h2, h3')
      );
      match = headings.find((h) =>
        h.textContent.toLowerCase().includes(conceptText.toLowerCase())
      );
    }

    if (!match) {
      const triggers = Array.from(shortDoc.querySelectorAll('.concept-trigger'));
      match = triggers.find((t) =>
        t.textContent.toLowerCase().includes(conceptText.toLowerCase())
      );
    }

    if (!match) {
      const boxes = Array.from(shortDoc.querySelectorAll('.a4-box, .tcolorbox, .a4-page-section'));
      match = boxes.find((b) =>
        b.textContent.toLowerCase().includes(conceptText.toLowerCase())
      );
    }

    if (match) {
      match.scrollIntoView({ behavior: 'smooth', block: 'center' });
      match.classList.remove('flash-target');
      void match.offsetWidth;
      match.classList.add('flash-target');
      setTimeout(() => match.classList.remove('flash-target'), 2600);
    }
  };

  // Inject bidirectional backlink chips into the rendered DOM
  useEffect(() => {
    if (!containerRef.current || !Object.keys(backlinksByTargetId).length) return;
    const root = containerRef.current;

    // Remove any previously inserted backlink badges
    root.querySelectorAll('.backlink-chip-container').forEach((el) => el.remove());

    Object.entries(backlinksByTargetId).forEach(([targetId, links]) => {
      let targetEl = null;
      try {
        targetEl = root.querySelector(`#${CSS.escape(targetId)}`);
      } catch (e) {}

      if (!targetEl) {
        targetEl =
          root.querySelector(`[id*="${targetId}"]`) ||
          root.querySelector(`[data-heading-slug*="${targetId}"]`);
      }

      if (targetEl) {
        const container = document.createElement('div');
        container.className = 'backlink-chip-container';

        links.forEach((link) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'backlink-chip';
          chip.title = `Jump back to Short Note: "${link.sourceText}"`;
          chip.innerHTML = `
            <span class="backlink-chip-icon">↩</span>
            <span class="backlink-chip-label">Short Note:</span>
            <strong class="backlink-chip-text">${link.sourceText}</strong>
          `;
          chip.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollToShortConcept(link.sourceText);
          };
          container.appendChild(chip);
        });

        if (targetEl.classList.contains('long-note-anchor') && targetEl.nextElementSibling) {
          targetEl.parentNode.insertBefore(container, targetEl.nextElementSibling);
        } else {
          targetEl.parentNode.insertBefore(container, targetEl);
        }
      }
    });
  }, [backlinksByTargetId, longNotesHtml]);

  // When activeAnchor changes, smoothly scroll the target into view and highlight it
  useEffect(() => {
    if (!activeAnchor || !containerRef.current) return;

    const timer = setTimeout(() => {
      const root = containerRef.current;
      let targetEl = null;

      // 1. Direct ID match
      try {
        targetEl = root.querySelector(`#${CSS.escape(activeAnchor)}`);
      } catch (e) {}

      // 2. Partial / substring match on ID or data-heading-slug
      if (!targetEl) {
        targetEl =
          root.querySelector(`[id*="${activeAnchor}"]`) ||
          root.querySelector(`[data-heading-slug*="${activeAnchor}"]`);
      }

      // 3. Fallback: Search headings for concept terms
      if (!targetEl && activeConcept?.terms) {
        const headings = root.querySelectorAll('h1, h2, h3, h4, strong');
        for (const h of headings) {
          const text = h.textContent.toLowerCase();
          if (activeConcept.terms.some((term) => text.includes(term.toLowerCase()))) {
            targetEl = h;
            break;
          }
        }
      }

      // 4. Fallback: Search paragraphs for concept terms
      if (!targetEl && activeConcept?.terms) {
        const paras = root.querySelectorAll('p');
        for (const p of paras) {
          const text = p.textContent.toLowerCase();
          if (activeConcept.terms.some((term) => text.includes(term.toLowerCase()))) {
            targetEl = p;
            break;
          }
        }
      }

      if (targetEl) {
        const scrollToTarget = () => {
          const scrollContainer = root.closest('.drawer-body') || root.parentElement;
          if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const targetTop = (targetRect.top - containerRect.top) + scrollContainer.scrollTop - 24;
            scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          const highlightEl = targetEl.classList.contains('long-note-anchor')
            ? targetEl.nextElementSibling || targetEl
            : targetEl;

          highlightEl.classList.remove('flash-target');
          void highlightEl.offsetWidth; // Trigger reflow
          highlightEl.classList.add('flash-target');
        };

        // Scroll immediately and re-run after drawer CSS slide transition completes (300ms)
        scrollToTarget();
        const retryTimer = setTimeout(scrollToTarget, 320);
        return () => clearTimeout(retryTimer);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [activeAnchor, activeConcept, longNotesHtml]);

  // Handle Point-and-Click connection when in Connect Mode
  const handleArticleClick = (e) => {
    if (!connectSource) return;

    // Find the nearest paragraph, heading, blockquote, or list item clicked
    const targetBlock = e.target.closest('p, h1, h2, h3, h4, li, blockquote');
    if (!targetBlock) return;

    e.preventDefault();
    e.stopPropagation();

    // Determine target ID or nearest heading anchor
    let targetSectionId = targetBlock.id;
    if (!targetSectionId) {
      // Find closest preceding heading or anchor
      let prev = targetBlock.previousElementSibling;
      while (prev) {
        if (prev.id) {
          targetSectionId = prev.id;
          break;
        }
        prev = prev.previousElementSibling;
      }
    }

    if (!targetSectionId) {
      targetSectionId = `anchor_${Date.now()}`;
      targetBlock.id = targetSectionId;
    }

    const snippet = targetBlock.textContent.trim().substring(0, 110);
    const label =
      targetBlock.tagName.startsWith('H')
        ? targetBlock.textContent.trim()
        : snippet.substring(0, 40) + '…';

    setSelectedTarget({
      targetSectionId,
      label,
      snippet,
      element: targetBlock,
    });
  };

  const handleConfirmConnection = () => {
    if (selectedTarget) {
      completeConnection(selectedTarget);
      setSelectedTarget(null);
    }
  };

  if (contentLoading) {
    return (
      <div className="state-card loading-state">
        <p>Loading context background...</p>
      </div>
    );
  }

  if (!longNotesRaw) {
    return (
      <div className="state-card empty-state">
        <FileQuestion size={36} className="empty-icon" />
        <h3>Long Notes Context Not Yet Added</h3>
        <p>
          The short notes for this chapter are available on the left. The full background markdown
          source will be linked here once exported from Google Docs.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`long-notes-container ${connectSource ? 'connect-mode-active' : ''}`}
      ref={containerRef}
      onClick={handleArticleClick}
    >
      {/* Connect Mode Active Banner */}
      {connectSource && (
        <aside className="connect-mode-banner" aria-label="Point-and-Click Linking Banner">
          <div className="connect-banner-header">
            <Target size={16} className="pulse-target-icon" />
            <span className="connect-banner-title">
              Click any sentence or heading to link with: <strong>"{connectSource.text}"</strong>
            </span>
          </div>
          <button className="connect-cancel-btn" onClick={cancelConnectMode} title="Cancel Connect Mode (ESC)">
            <X size={14} />
            <span>Cancel</span>
          </button>
        </aside>
      )}

      {/* Target Confirmation Bar */}
      {selectedTarget && (
        <div className="target-confirm-bar" role="dialog" aria-label="Confirm Link Target">
          <div className="target-confirm-info">
            <span className="confirm-badge">Selected Target:</span>
            <p className="confirm-snippet">"{selectedTarget.snippet}"</p>
          </div>
          <div className="target-confirm-actions">
            <button className="btn btn-sm btn-primary" onClick={handleConfirmConnection}>
              <Check size={14} />
              <span>Link Together</span>
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setSelectedTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Concept Quick Peek Banner if triggered from a tag */}
      {activeConcept && activeConcept.summary && !connectSource && (
        <aside className="concept-peek-card" aria-label="Exam Quick Insight">
          <div className="concept-peek-header">
            <span className="concept-peek-badge">High-Yield Exam Context</span>
            <span className="concept-peek-title">{activeConcept.terms?.[0] || activeConcept.id}</span>
            <div className="concept-peek-actions">
              <button
                className="locate-short-note-btn"
                onClick={() => scrollToShortConcept(activeConcept.terms?.[0] || activeConcept.id)}
                title="Locate and highlight this card in Short Notes"
              >
                <ArrowLeft size={12} />
                <span>Locate in Short Notes</span>
              </button>
              {activeConcept.isUserCustom && (
                <button
                  className="delete-custom-link-btn"
                  onClick={() => deleteConnection(activeConcept.id)}
                  title="Remove this user-created link"
                >
                  <X size={13} />
                  <span>Remove Link</span>
                </button>
              )}
            </div>
          </div>
          <p className="concept-peek-summary">{activeConcept.summary}</p>
        </aside>
      )}

      {/* Rendered Long Notes Article */}
      <article
        className="long-notes-article"
        dangerouslySetInnerHTML={{ __html: longNotesHtml }}
      />
    </div>
  );
}
