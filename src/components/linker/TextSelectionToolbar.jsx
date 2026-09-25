// src/components/linker/TextSelectionToolbar.jsx - Floating action pill on text highlight
// Strictly Short Notes (PDF) -> Long Notes directional linking + Inline Study Comments + W3C Color Highlighting

import React, { useState, useEffect, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import { saveAnnotation } from '../../utils/annotationStorage';
import { addOrUpdateConnection } from '../../utils/linkManager';
import {
  saveHighlight,
  extractTextQuoteFromRange,
  HIGHLIGHT_COLORS,
} from '../../utils/highlightManager';
import { Link2, MessageSquarePlus, MessageSquare, Check, X, Highlighter } from 'lucide-react';

export default function TextSelectionToolbar() {
  const {
    startConnectMode,
    workMode,
    connectSource,
    setDrawerOpen,
    activeSubjectId,
    activeChapterId,
    refreshConnections,
  } = useReading();

  const [selectedText, setSelectedText] = useState('');
  const [currentTextQuote, setCurrentTextQuote] = useState(null);
  const [position, setPosition] = useState(null); // { top, left, isAbove, rectTop, rectBottom }
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  const isAddingNoteRef = useRef(false);
  isAddingNoteRef.current = isAddingNote;

  const toolbarRef = useRef(null);

  useEffect(() => {
    // Disable text selection toolbar in edit mode or when already connecting
    if (workMode === 'edit' || connectSource) {
      setSelectedText('');
      setCurrentTextQuote(null);
      setPosition(null);
      setIsAddingNote(false);
      return;
    }

    const handleMouseUp = (e) => {
      // If click was inside the toolbar itself or currently typing a note, don't dismiss
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) {
        return;
      }

      if (isAddingNoteRef.current) {
        return;
      }

      // Small delay to allow browser selection to finalize
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          if (!isAddingNoteRef.current) {
            setSelectedText('');
            setCurrentTextQuote(null);
            setPosition(null);
          }
          return;
        }

        const text = selection.toString().trim();
        if (!text || text.length < 2 || text.length > 150) {
          if (!isAddingNoteRef.current) {
            setSelectedText('');
            setCurrentTextQuote(null);
            setPosition(null);
          }
          return;
        }

        const anchorNode = selection.anchorNode;
        const parentEl =
          anchorNode?.nodeType === Node.ELEMENT_NODE
            ? anchorNode
            : anchorNode?.parentElement;

        // User constraint: Short Note -> Long Notes ONLY.
        // Explicitly reject any selection originating in Long Notes, modals, header, or sidebars
        if (
          parentEl?.closest(
            '.long-notes-container, .context-drawer, .header, .vault-sidebar, .modal-backdrop, .modal-card, input, textarea'
          )
        ) {
          if (!isAddingNoteRef.current) {
            setSelectedText('');
            setCurrentTextQuote(null);
            setPosition(null);
          }
          return;
        }

        // Must originate in Short Notes (PDF textLayer, canvas, page sheet, desk canvas, or primary reader pane)
        const inShort = parentEl?.closest(
          '.textLayer, .pdf-page-sheet, .pdf-zoom-container, .pdf-desk-canvas, .primary-reader-pane, .latex-document'
        );

        if (!inShort) {
          if (!isAddingNoteRef.current) {
            setSelectedText('');
            setCurrentTextQuote(null);
            setPosition(null);
          }
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const quote = extractTextQuoteFromRange(range);

        // Position fixed relative to viewport
        const popoverWidth = 350;
        const screenW = window.innerWidth;
        let left = rect.left + rect.width / 2 - popoverWidth / 2;
        if (left < 16) left = 16;
        if (left + popoverWidth > screenW - 16) left = screenW - popoverWidth - 16;

        // Space above vs below: toolbar pill height ~ 40px
        const isAbove = rect.top >= 52;
        const top = isAbove ? Math.max(12, rect.top - 46) : Math.min(window.innerHeight - 60, rect.bottom + 8);

        setSelectedText(text);
        setCurrentTextQuote(quote);
        setIsAddingNote(false);
        setNoteText('');
        setPosition({
          top,
          left,
          isAbove,
          rectTop: rect.top,
          rectBottom: rect.bottom,
        });
      }, 50);
    };

    const handleSelectionChange = () => {
      if (isAddingNoteRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectedText('');
        setPosition(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [workMode, connectSource]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAddingNote) {
          setIsAddingNote(false);
        } else if (selectedText) {
          setSelectedText('');
          setPosition(null);
          window.getSelection()?.removeAllRanges();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingNote, selectedText]);

  if (!selectedText || !position) return null;

  const handleConnectClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startConnectMode(selectedText, 'short');
    setDrawerOpen(true);
    setSelectedText('');
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleStartAddNote = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAddingNote(true);
    setNoteText('');
  };

  const handleSaveNote = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanNote = noteText.trim();
    if (!cleanNote) return;

    const conceptId = `user_note_${Date.now()}`;

    // 1. Save personal study comment in annotation storage
    saveAnnotation(activeSubjectId, activeChapterId, conceptId, cleanNote, selectedText);

    // 2. Add connection in linkManager so PDF coordinate extractor recognizes and highlights it
    const newConnection = {
      id: conceptId,
      isBuiltin: false,
      source: {
        text: selectedText,
        terms: [selectedText],
        side: 'short',
      },
      targets: [
        {
          id: `target_${Date.now()}`,
          label: selectedText,
          targetSectionId: conceptId,
          snippet: cleanNote,
        },
      ],
    };
    addOrUpdateConnection(activeSubjectId, activeChapterId, newConnection);

    // 3. Trigger immediate refresh to paint SVG highlight
    refreshConnections();

    // 4. Reset & dismiss
    setIsAddingNote(false);
    setSelectedText('');
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleApplyHighlight = (colorId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedText) return;

    const highlightId = `hl_${Date.now()}`;
    const quote = currentTextQuote || { exact: selectedText, prefix: '', suffix: '' };

    // 1. Save in W3C Highlight Engine
    saveHighlight(activeSubjectId, activeChapterId, {
      id: highlightId,
      color: colorId,
      textQuote: quote,
    });

    // 2. Add connection so PDF / concept layer paints the highlight
    const newConnection = {
      id: highlightId,
      isBuiltin: false,
      color: colorId,
      source: {
        text: selectedText,
        terms: [selectedText],
        side: 'short',
      },
      targets: [
        {
          id: `target_${Date.now()}`,
          label: selectedText,
          targetSectionId: highlightId,
        },
      ],
    };
    addOrUpdateConnection(activeSubjectId, activeChapterId, newConnection);
    refreshConnections();
    window.dispatchEvent(new CustomEvent('notesweb-highlights-updated'));

    // 3. Reset & dismiss
    setSelectedText('');
    setCurrentTextQuote(null);
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAddingNote(false);
    setSelectedText('');
    setCurrentTextQuote(null);
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  // Calculate dynamic style
  const toolbarStyle = {
    position: 'fixed',
    left: `${position.left}px`,
    zIndex: 9999,
  };

  if (isAddingNote) {
    if (position.isAbove) {
      toolbarStyle.bottom = `${Math.max(16, window.innerHeight - position.rectTop + 8)}px`;
    } else {
      toolbarStyle.top = `${Math.min(window.innerHeight - 190, position.rectBottom + 8)}px`;
    }
  } else {
    if (position.isAbove) {
      toolbarStyle.bottom = `${Math.max(12, window.innerHeight - position.rectTop + 8)}px`;
    } else {
      toolbarStyle.top = `${Math.min(window.innerHeight - 60, position.rectBottom + 8)}px`;
    }
  }

  return (
    <div
      ref={toolbarRef}
      className={`text-selection-toolbar ${isAddingNote ? 'is-note-mode' : 'is-pill-mode'}`}
      style={toolbarStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {!isAddingNote ? (
        <div className="selection-pill-row">
          {/* Highlighter Color Palette */}
          <div className="selection-colors-group">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                className="selection-color-dot"
                style={{ backgroundColor: c.hex, borderColor: c.border }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleApplyHighlight(c.id, e)}
                title={`Highlight in ${c.name}`}
                aria-label={`Highlight in ${c.name}`}
              />
            ))}
          </div>

          <div className="selection-pill-divider" />

          <button
            className="selection-pill-btn selection-btn-comment"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleStartAddNote}
            title={`Add personal note to "${selectedText}"`}
          >
            <MessageSquarePlus size={13} className="pill-comment-icon" />
            <span>Add Note</span>
          </button>

          <button
            className="selection-pill-btn selection-btn-connect"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleConnectClick}
            title={`Connect "${selectedText}" to Long Notes context`}
          >
            <Link2 size={13} className="pill-link-icon" />
            <span>Connect</span>
          </button>

          <button
            className="selection-pill-close"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDismiss}
            title="Dismiss (Esc)"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="selection-note-card">
          <div className="selection-note-header">
            <div className="selection-note-title">
              <MessageSquare size={13} className="selection-note-icon" />
              <span>Add Note / Comment</span>
            </div>
            <button
              className="selection-note-close"
              onClick={() => setIsAddingNote(false)}
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>

          <div className="selection-note-quote" title={selectedText}>
            “{selectedText.length > 55 ? selectedText.substring(0, 52) + '…' : selectedText}”
          </div>

          <textarea
            className="selection-note-textarea"
            rows={2}
            autoFocus
            placeholder="Write personal note, takeaway, or mnemonic..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSaveNote();
              }
            }}
          />

          <div className="selection-note-actions">
            <span className="selection-note-hint">Ctrl+Enter to save</span>
            <div className="selection-note-btn-group">
              <button
                className="btn btn-secondary selection-btn-sm"
                onClick={() => setIsAddingNote(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary selection-btn-sm"
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
              >
                <Check size={12} />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
