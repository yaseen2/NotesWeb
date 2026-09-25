// src/components/reader/EdgeConceptPopover.jsx - Wikipedia-Grade Academic Concept Card & Study Notes
// Features directional callout caret, adaptive hero banner, encyclopedic lead typography, and personal notes.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  X,
  Check,
  Trash2,
  ExternalLink,
  Edit3,
  Bookmark,
} from 'lucide-react';
import {
  saveAnnotation,
  deleteAnnotation,
  getSavedAnnotations,
  findAnnotationByConceptOrPhrase,
} from '../../utils/annotationStorage';
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
  const textareaRef = useRef(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const conceptId = activeTarget?.conceptId;
  const { phrase, rect, targetSection, imageUrl } = activeTarget || {};

  const matchedAnnotation = useMemo(() => {
    return findAnnotationByConceptOrPhrase(savedAnnotations, conceptId, phrase);
  }, [conceptId, phrase, savedAnnotations]);

  const activeAnnotationId = matchedAnnotation?.id || conceptId;
  const currentAnnotation = matchedAnnotation;

  // Initialize note text from saved annotation
  useEffect(() => {
    if (currentAnnotation?.text) {
      setNoteText(currentAnnotation.text);
      setIsEditingNote(false);
    } else {
      setNoteText('');
      setIsEditingNote(false);
    }
  }, [currentAnnotation]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingNote && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditingNote]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isEditingNote) {
          setIsEditingNote(false);
          setNoteText(currentAnnotation?.text || '');
        } else {
          onClose();
        }
      } else if (!isEditingNote && (e.key === 'e' || e.key === 'E')) {
        const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        if (!isInput) {
          e.preventDefault();
          setIsEditingNote(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditingNote, currentAnnotation]);

  if (!activeTarget || !rect) return null;

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

  // Prefer placing where there is ample room (>= 270px)
  const cardComfortHeight = 270;
  let isAbove = false;
  if (spaceAbove >= cardComfortHeight && spaceAbove >= spaceBelow) {
    isAbove = true;
  } else if (spaceBelow >= cardComfortHeight) {
    isAbove = false;
  } else {
    isAbove = spaceAbove >= spaceBelow;
  }

  // Calculate dynamic caret offset (aligned with word center)
  const wordCenterX = rect.left + rect.width / 2;
  const caretOffsetLeft = Math.max(22, Math.min(popoverWidth - 22, wordCenterX - left));

  const popoverStyle = {
    position: 'fixed',
    left: `${left}px`,
    width: `${popoverWidth}px`,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: `${Math.min(460, Math.max(260, isAbove ? spaceAbove - 16 : spaceBelow - 16))}px`,
  };

  if (isAbove) {
    popoverStyle.bottom = `${Math.max(12, screenH - rect.top + 8)}px`;
  } else {
    // If placing below, ensure the card fits comfortably without cutting off bottom actions
    const idealTop = rect.bottom + 8;
    const maxTop = Math.max(12, screenH - 280);
    const resolvedTop = idealTop > maxTop ? Math.max(12, idealTop - 25) : idealTop;
    popoverStyle.top = `${resolvedTop}px`;
  }

  const handleSaveNote = () => {
    if (!noteText.trim()) {
      handleDeleteNote();
      return;
    }
    const targetId = activeAnnotationId || `user_note_${Date.now()}`;
    const updated = saveAnnotation(subjectId, chapterId, targetId, noteText, phrase);
    if (onAnnotationsChanged) onAnnotationsChanged(updated);
    setIsEditingNote(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleDeleteNote = () => {
    if (activeAnnotationId) {
      deleteAnnotation(subjectId, chapterId, activeAnnotationId);
    }
    if (conceptId && conceptId !== activeAnnotationId) {
      deleteAnnotation(subjectId, chapterId, conceptId);
    }
    const updated = getSavedAnnotations(subjectId, chapterId);
    if (onAnnotationsChanged) onAnnotationsChanged(updated);
    setNoteText('');
    setIsEditingNote(false);
  };

  const existingHighlight = useMemo(() => {
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

  // Format encyclopedic summary in Wikipedia style with bold term
  const renderEncyclopedicSnippet = () => {
    const raw = activeTarget.snippet?.trim();
    if (!raw) {
      return (
        <p className="edge-popover-desc">
          <strong className="edge-encyclopedic-lead">{phrase}</strong> is a core concept linked directly to contextual notes and historical analysis.
        </p>
      );
    }

    const escaped = (phrase || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\b)(${escaped})(\\b|$)`, 'i');
    const match = raw.match(regex);

    if (match && match.index !== undefined) {
      const before = raw.slice(0, match.index);
      const term = match[2];
      const after = raw.slice(match.index + match[0].length);
      return (
        <p className="edge-popover-desc">
          {before}
          <strong className="edge-encyclopedic-lead">{term}</strong>
          {after}
        </p>
      );
    }

    return (
      <p className="edge-popover-desc">
        <strong className="edge-encyclopedic-lead">{phrase}</strong> — {raw}
      </p>
    );
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
      {/* Directional Callout Caret (Points directly at hovered word) */}
      <div
        className={`edge-popover-caret ${isAbove ? 'caret-down' : 'caret-up'}`}
        style={{ left: `${caretOffsetLeft}px` }}
        aria-hidden="true"
      >
        <svg width="18" height="9" viewBox="0 0 18 9" className="caret-svg">
          {isAbove ? (
            <>
              <polygon points="0,0 9,9 18,0" className="caret-bg" />
              <polyline points="0,0 9,9 18,0" className="caret-stroke" />
            </>
          ) : (
            <>
              <polygon points="0,9 9,0 18,9" className="caret-bg" />
              <polyline points="0,9 9,0 18,9" className="caret-stroke" />
            </>
          )}
        </svg>
      </div>

      {/* Adaptive Wikipedia Hero Banner (when image available) */}
      {imageUrl && (
        <div className="edge-popover-hero-banner">
          <img
            src={imageUrl}
            alt={phrase}
            className="edge-popover-hero-img"
            loading="lazy"
          />
          <div className="edge-hero-overlay" />
        </div>
      )}

      {/* Card Header */}
      <div className="edge-popover-header">
        <div className="edge-popover-title-row">
          <Sparkles size={14} className="edge-popover-icon" />
          <h4 className="edge-popover-title">{phrase}</h4>
          {existingHighlight && (
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.1rem 0.35rem',
                borderRadius: '3px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                letterSpacing: '0.04em',
              }}
            >
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
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem',
                color: 'var(--text-muted)',
              }}
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
        {renderEncyclopedicSnippet()}

        {/* Edge-Style Comment & Personal Study Notes Section */}
        <div className="edge-comment-section">
          {currentAnnotation && !isEditingNote ? (
            <div className="edge-saved-comment-box">
              <div className="edge-comment-meta">
                <span className="edge-comment-label">
                  <Bookmark size={12} /> My Study Note
                </span>
                <div className="edge-comment-actions">
                  <button
                    className="edge-btn-icon"
                    onClick={() => setIsEditingNote(true)}
                    title="Edit Note (E)"
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
          ) : isEditingNote ? (
            <div className="edge-comment-editor">
              <textarea
                ref={textareaRef}
                className="edge-comment-textarea"
                placeholder="Add personal note, mnemonic, or exam takeaway..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSaveNote();
                  }
                }}
                rows={2}
              />
              <div className="edge-comment-editor-footer">
                <span className="edge-ctrl-hint">Ctrl+Enter to save</span>
                <button
                  className="btn btn-secondary edge-btn-sm"
                  onClick={() => {
                    setIsEditingNote(false);
                    setNoteText(currentAnnotation?.text || '');
                  }}
                >
                  Cancel
                </button>
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
          ) : (
            <button
              className="edge-add-note-prompt-btn"
              onClick={() => setIsEditingNote(true)}
              title="Add a personal study note, mnemonic, or takeaway (E)"
            >
              <MessageSquare size={13} className="prompt-icon" />
              <span>Add personal note or mnemonic...</span>
              <span className="prompt-key-hint">E</span>
            </button>
          )}

          {savedSuccess && (
            <div className="edge-save-toast">
              <Check size={12} /> Note saved to this concept!
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Bar */}
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
          <span className="edge-action-kbd">Alt+2</span>
          <ExternalLink size={12} className="edge-btn-trailing" />
        </button>
      </div>
    </div>
  );
}

