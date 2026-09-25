// src/components/editor/DualEditor.jsx - In-Browser Dual LaTeX & Markdown Editor (Web-based Obsidian Workbench)

import React, { useState, useEffect, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import { saveChapterEdits, resetChapterEdits } from '../../utils/vaultManager';
import {
  Save,
  RotateCcw,
  BookOpen,
  Code2,
  FileCode,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function DualEditor() {
  const {
    activeSubjectId,
    activeChapterId,
    shortNotesRaw,
    setShortNotesRaw,
    longNotesRaw,
    setLongNotesRaw,
    setWorkMode,
    refreshConnections,
  } = useReading();

  const [texContent, setTexContent] = useState(shortNotesRaw || '');
  const [mdContent, setMdContent] = useState(longNotesRaw || '');
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'reset' | null

  const texTextareaRef = useRef(null);
  const mdTextareaRef = useRef(null);

  // Sync initial content
  useEffect(() => {
    setTexContent(shortNotesRaw || '');
    setMdContent(longNotesRaw || '');
  }, [shortNotesRaw, longNotesRaw]);

  // Handle Save & Re-render
  const handleSave = () => {
    const success = saveChapterEdits(activeSubjectId, activeChapterId, {
      shortNotesRaw: texContent,
      longNotesRaw: mdContent,
    });

    if (success) {
      setShortNotesRaw(texContent);
      setLongNotesRaw(mdContent);
      refreshConnections();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    }
  };

  // Handle Save and immediately return to reading mode
  const handleSaveAndReturn = () => {
    handleSave();
    setWorkMode('read');
  };

  // Reset to original default file
  const handleReset = () => {
    if (window.confirm('Reset this note to original disk content? Any custom in-browser edits will be cleared.')) {
      resetChapterEdits(activeSubjectId, activeChapterId);
      window.location.reload();
    }
  };

  // Handle keyboard shortcuts (Ctrl+S to save, Tab key in textareas)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [texContent, mdContent, activeSubjectId, activeChapterId]);

  // Support Tab key indentation inside textarea
  const handleTabKey = (e, setter) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const value = e.target.value;
      setter(value.substring(0, start) + '  ' + value.substring(end));
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Helper to insert snippets at cursor
  const insertSnippet = (textareaRef, setter, snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.substring(start, end) || 'Text';
    const replacement = snippet.replace('{{SEL}}', selected);

    setter(value.substring(0, start) + replacement + value.substring(end));
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + replacement.length;
      textarea.selectionEnd = start + replacement.length;
    }, 0);
  };

  // Stats calculation
  const getWordCount = (str) => {
    return str ? str.trim().split(/\s+/).filter(Boolean).length : 0;
  };

  return (
    <div className="dual-editor-container" aria-label="In-Browser Dual Editor">
      {/* Editor Top Control Bar */}
      <div className="editor-top-bar">
        <div className="editor-left-meta">
          <div className="editor-mode-badge">
            <Code2 size={15} />
            <span>Dual Editor Mode</span>
          </div>
          <span className="editor-kbd-guide">
            Press <kbd>Ctrl+S</kbd> to save &amp; re-render, <kbd>Ctrl+E</kbd> or <kbd>Esc</kbd> to return to reading.
          </span>
        </div>

        <div className="editor-actions">
          {saveStatus === 'saved' && (
            <span className="editor-status-toast success">
              <CheckCircle2 size={14} /> Saved &amp; Re-rendered!
            </span>
          )}

          <button
            className="btn btn-sm btn-outline editor-reset-btn"
            onClick={handleReset}
            title="Reset note back to original default"
          >
            <RotateCcw size={13} />
            <span>Reset to Original</span>
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onClick={handleSave}
            title="Save changes and re-render parser without leaving edit mode"
          >
            <Save size={14} />
            <span>Save (Ctrl+S)</span>
          </button>

          <button
            className="btn btn-sm btn-primary"
            onClick={handleSaveAndReturn}
            title="Save changes and switch to interactive reading mode"
          >
            <BookOpen size={14} />
            <span>Save &amp; View Live</span>
          </button>
        </div>
      </div>

      {/* Editor Workspace: Split Panes */}
      <div className="editor-split-panes">
        {/* Left Pane: LaTeX Short Notes */}
        <div className="editor-pane latex-editor-pane">
          <div className="pane-header">
            <div className="pane-title">
              <FileCode size={15} className="pane-icon" />
              <span>Short Notes Source (LaTeX <code>.tex</code>)</span>
            </div>
            <div className="pane-quick-tools">
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(
                    texTextareaRef,
                    setTexContent,
                    '\\begin{tcolorbox}[colback=cardblue!5,colframe=cardblue,title={{{SEL}}}]\nKey takeaway statement...\n\\end{tcolorbox}\n'
                  )
                }
                title="Insert tcolorbox Takeaway Card"
              >
                + Takeaway Box
              </button>
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(texTextareaRef, setTexContent, '\\section{{{SEL}}}\n')
                }
                title="Insert LaTeX Section"
              >
                + Section
              </button>
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(texTextareaRef, setTexContent, '\\textbf{{{SEL}}}')
                }
                title="Insert Bold Text"
              >
                <b>B</b>
              </button>
            </div>
          </div>

          <div className="pane-editor-wrapper">
            <textarea
              ref={texTextareaRef}
              className="code-textarea latex-textarea"
              value={texContent}
              onChange={(e) => setTexContent(e.target.value)}
              onKeyDown={(e) => handleTabKey(e, setTexContent)}
              placeholder="% Paste or write your LaTeX short revision notes here..."
              spellCheck={false}
            />
          </div>

          <div className="pane-footer">
            <span>{texContent.split('\n').length} lines</span>
            <span>{getWordCount(texContent)} words</span>
          </div>
        </div>

        {/* Right Pane: Markdown Long Notes */}
        <div className="editor-pane md-editor-pane">
          <div className="pane-header">
            <div className="pane-title">
              <Sparkles size={15} className="pane-icon" />
              <span>Long Notes Context (Markdown <code>.md</code>)</span>
            </div>
            <div className="pane-quick-tools">
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(mdTextareaRef, setMdContent, '### {{SEL}}\n')
                }
                title="Insert Markdown Heading 3"
              >
                ### Heading
              </button>
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(mdTextareaRef, setMdContent, '**{{SEL}}**')
                }
                title="Insert Bold Text"
              >
                **Bold**
              </button>
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(mdTextareaRef, setMdContent, '- {{SEL}}')
                }
                title="Insert Bullet List Item"
              >
                • List
              </button>
              <button
                className="tool-btn"
                onClick={() =>
                  insertSnippet(mdTextareaRef, setMdContent, '> [!NOTE]\n> {{SEL}}\n')
                }
                title="Insert Callout Note"
              >
                &gt; Callout
              </button>
            </div>
          </div>

          <div className="pane-editor-wrapper">
            <textarea
              ref={mdTextareaRef}
              className="code-textarea md-textarea"
              value={mdContent}
              onChange={(e) => setMdContent(e.target.value)}
              onKeyDown={(e) => handleTabKey(e, setMdContent)}
              placeholder="# Paste or write your comprehensive Markdown background source here..."
              spellCheck={false}
            />
          </div>

          <div className="pane-footer">
            <span>{mdContent.split('\n').length} lines</span>
            <span>{getWordCount(mdContent)} words</span>
          </div>
        </div>
      </div>
    </div>
  );
}
