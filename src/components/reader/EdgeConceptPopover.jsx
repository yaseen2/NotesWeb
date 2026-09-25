// src/components/reader/EdgeConceptPopover.jsx - Edge-Style Floating Context & Comment Card
// Provides inline quick context, personal annotations/comments, and 1-click deep linking to Long Notes.

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  X,
  Check,
  Trash2,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { saveAnnotation, deleteAnnotation } from '../../utils/annotationStorage';
import { getSavedHighlights, deleteHighlight } from '../../utils/highlightManager';

export default function EdgeConceptPopover({
  activeTarget,
  onClose,
  onOpenLongNotes,
  subjectId,
  chapterId,
  savedAnnotations = {},
  onAnnotationsChanged,
  onMouseEnter,
  onMouseLeave,
}) {
  const popoverRef = useRef(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const conceptId = activeTarget?.conceptId;
  const currentAnnotation = conceptId ? savedAnnotations[conceptId] : null;

  // Initialize note text from saved annotation
  useEffect(() => {
    if (currentAnnotation) {
      setNoteText(currentAnnotation.text);
      setIsEditingNote(false);
    } else {
      setNoteText('');
      setIsEditingNote(false);
    }
  }, [conceptId, currentAnnotation]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activeTarget) return null;

  const { phrase, rect, targetSection } = activeTarget;

  // Position calculation: center horizontally over rect, position above or below
  const popoverWidth = 320;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  let left = rect.left + rect.width / 2 - popoverWidth / 2;
  // Boundary constraints
  if (left < 16) left = 16;
  if (left + popoverWidth > screenW - 16) left = screenW - popoverWidth - 16;

  const spaceAbove = rect.top;
  const spaceBelow = screenH - rect.bottom;

  // Prefer above if enough room; otherwise below
  const isAbove = spaceAbove >= 200 || spaceAbove > spaceBelow;

  const popoverStyle = {
    position: 'fixed',
    left: `${left}px`,
    width: `${popoverWidth}px`,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
  };

  if (isAbove) {
    popoverStyle.bottom = `${Math.max(16, screenH - rect.top + 8)}px`;
    popoverStyle.maxHeight = `${Math.max(140, rect.top - 24)}px`;
  } else {
    popoverStyle.top = `${Math.min(screenH - 120, rect.bottom + 8)}px`;
    popoverStyle.maxHeight = `${Math.max(140, screenH - rect.bottom - 24)}px`;
  }

  const handleSaveNote = () => {
    if (!noteText.trim()) {
      handleDeleteNote();
      return;
    }
    const updated = saveAnnotation(subjectId, chapterId, conceptId, noteText);
    if (onAnnotationsChanged) onAnnotationsChanged(updated);
    setIsEditingNote(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleDeleteNote = () => {
    const updated = deleteAnnotation(subjectId, chapterId, conceptId);
    if (onAnnotationsChanged) onAnnotationsChanged(updated);
    setNoteText('');
    setIsEditingNote(false);
  };

  const existingHighlight = React.useMemo(() => {
    if (!subjectId || !chapterId || !activeTarget) return null;
    const list = getSavedHighlights(subjectId, chapterId);
    return list.find(
      (h) =>
        h.id === conceptId ||
        (h.textQuote?.exact && h.textQuote.exact.toLowerCase() === (activeTarget.phrase || '').toLowerCase())
    );
  }, [subjectId, chapterId, conceptId, activeTarget]);

  const handleRemoveHighlight = (e) => {
    e.stopPropagation();
    if (existingHighlight) {
      deleteHighlight(subjectId, chapterId, existingHighlight.id);
      window.dispatchEvent(new CustomEvent('notesweb-highlights-updated'));
      onClose();
    }
  };

  return (
    <div
      ref={popoverRef}
      className={`edge-concept-popover wikipedia-preview-card ${isAbove ? 'placement-above' : 'placement-below'}`}
      style={popoverStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="edge-popover-header">
        <div className="edge-popover-title-row">
          <Sparkles size={14} className="edge-popover-icon" />
          <h4 className="edge-popover-title">{phrase}</h4>
          {existingHighlight && (
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '0.1rem 0.35rem',
              borderRadius: '3px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              letterSpacing: '0.04em'
            }}>
              {existingHighlight.color}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {existingHighlight && (
            <button
              className="edge-btn-icon"
              onClick={handleRemoveHighlight}
              title="Remove this highlight"
              aria-label="Remove highlight"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-muted)' }}
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            className="edge-popover-close-btn"
            onClick={onClose}
            title="Close card (Esc)"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body / Wikipedia-style Quick Takeaway Snippet */}
      <div className="edge-popover-body">
        <p className="edge-popover-desc">
          {activeTarget.snippet
            ? activeTarget.snippet
            : 'Core concept linked directly to contextual notes and historical analysis.'}
        </p>

        {/* Edge-Style Comment & Personal Notes Section */}
        <div className="edge-comment-section">
          {currentAnnotation && !isEditingNote ? (
            <div className="edge-saved-comment-box">
              <div className="edge-comment-meta">
                <span className="edge-comment-label">
                  <MessageSquare size={12} /> Your Personal Note
                </span>
                <div className="edge-comment-actions">
                  <button
                    className="edge-btn-icon"
                    onClick={() => setIsEditingNote(true)}
                    title="Edit Note"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    className="edge-btn-icon text-danger"
                    onClick={handleDeleteNote}
                    title="Delete Note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="edge-comment-text">{currentAnnotation.text}</p>
            </div>
          ) : isEditingNote || !currentAnnotation ? (
            <div className="edge-comment-editor">
              <textarea
                className="edge-comment-textarea"
                placeholder="Add study comment, mnemonic, or exam takeaway..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                autoFocus={isEditingNote}
              />
              <div className="edge-comment-editor-footer">
                {isEditingNote && (
                  <button
                    className="btn btn-secondary edge-btn-sm"
                    onClick={() => setIsEditingNote(false)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="btn btn-primary edge-btn-sm"
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                >
                  <Check size={12} />
                  <span>Save Note</span>
                </button>
              </div>
            </div>
          ) : null}

          {savedSuccess && (
            <div className="edge-save-toast">
              <Check size={12} /> Note saved to this concept!
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="edge-popover-footer">
        <button
          className="btn btn-primary edge-action-btn"
          onClick={(e) => {
            onOpenLongNotes(conceptId, targetSection, e, phrase);
            onClose();
          }}
          title="Open deep context in Long Notes side drawer (Alt+2)"
        >
          <BookOpen size={14} />
          <span>Open in Long Notes</span>
          <ExternalLink size={12} className="edge-btn-trailing" />
        </button>
      </div>
    </div>
  );
}
