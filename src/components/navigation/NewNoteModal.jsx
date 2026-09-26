// src/components/navigation/NewNoteModal.jsx - Professional Two-Tier Note Ingestion & Update Modal
// Enforces clean distinction between Short Notes (Summary/PDF/MD/TeX) and Long Notes (Full Context/MD)

import React, { useState, useRef, useEffect } from 'react';
import { useReading } from '../../context/ReadingContext';
import {
  getVaultSubjects,
  addCustomChapter,
  addCustomSubject,
  saveChapterEdits,
  updateChapterPdf,
} from '../../utils/vaultManager';
import { savePdfBlob } from '../../utils/db';
import { extractLatexMetadata, parseLatexNotes } from '../../utils/latexParser';
import {
  X,
  Plus,
  BookPlus,
  UploadCloud,
  CheckCircle2,
  FileText,
  BookOpen,
  AlertCircle,
  Trash2,
  RefreshCw,
  FileCheck2,
  FileCode,
  Sparkles,
  ArrowLeftRight,
  Info,
} from 'lucide-react';

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function getSnippet(str, maxLines = 2) {
  if (!str) return '';
  return str.split('\n').filter((l) => l.trim().length > 0).slice(0, maxLines).join(' • ');
}

export default function NewNoteModal({
  isOpen,
  onClose,
  onNoteCreated,
  initialFiles = [],
  editSubjectId = null,
  editChapterId = null,
}) {
  const {
    setActiveSubjectId,
    setActiveChapterId,
    setWorkMode,
    setShortNotesRaw,
    setLongNotesRaw,
    setCurrentPdfPath,
    setShortNotesData,
    refreshConnections,
  } = useReading();

  const subjects = getVaultSubjects();
  const isEditMode = !!(editSubjectId && editChapterId);

  // Subject & Chapter Metadata
  const [selectedSubjectOption, setSelectedSubjectOption] = useState(() => {
    if (editSubjectId) return editSubjectId;
    return subjects.length > 0 ? subjects[0].id : '__NEW__';
  });
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterPeriod, setChapterPeriod] = useState('');

  // Tier 1: Short Notes (Summary / Cards / PDF / TeX / MD)
  const [shortMode, setShortMode] = useState('file'); // 'file' | 'paste'
  const [shortFile, setShortFile] = useState(null);
  const [shortPdfUrl, setShortPdfUrl] = useState(null);
  const [shortPdfFile, setShortPdfFile] = useState(null);
  const [shortContent, setShortContent] = useState('');
  const [shortFileType, setShortFileType] = useState(null); // 'pdf' | 'tex' | 'md' | 'text'

  // Tier 2: Long Notes (Context / Full Source / MD)
  const [longMode, setLongMode] = useState('file'); // 'file' | 'paste'
  const [longFile, setLongFile] = useState(null);
  const [longContent, setLongContent] = useState('');

  // Drag state & feedback
  const [shortDragOver, setShortDragOver] = useState(false);
  const [longDragOver, setLongDragOver] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const shortFileInputRef = useRef(null);
  const longFileInputRef = useRef(null);

  // Initialize or hydrate in Edit Mode
  useEffect(() => {
    if (isOpen && isEditMode) {
      const subject = subjects.find((s) => s.id === editSubjectId);
      const chapter = subject?.chapters?.find((c) => c.id === editChapterId);
      if (chapter) {
        setChapterTitle(chapter.title || '');
        setChapterPeriod(chapter.period || '');
        setSelectedSubjectOption(editSubjectId);

        // Load existing edits from localStorage
        const savedEdits = localStorage.getItem(`notesweb_edits_${editSubjectId}_${editChapterId}`);
        if (savedEdits) {
          try {
            const parsed = JSON.parse(savedEdits);
            if (parsed.shortNotesRaw) {
              setShortContent(parsed.shortNotesRaw);
              setShortFileType(parsed.shortNotesRaw.includes('\\section') ? 'tex' : 'md');
            }
            if (parsed.longNotesRaw) {
              setLongContent(parsed.longNotesRaw);
            }
          } catch (e) {}
        } else {
          if (chapter.shortNotesRaw) {
            setShortContent(chapter.shortNotesRaw);
            setShortFileType(chapter.shortNotesRaw.includes('\\section') ? 'tex' : 'md');
          }
          if (chapter.longNotesRaw) {
            setLongContent(chapter.longNotesRaw);
          }
        }

        if (chapter.pdfPath) {
          setShortPdfUrl(chapter.pdfPath);
          setShortFileType('pdf');
          setShortFile({ name: `${chapter.title}.pdf`, size: 0 });
        }
      }
    } else if (isOpen && initialFiles && initialFiles.length > 0) {
      ingestGenericFiles(initialFiles);
    }
  }, [isOpen, isEditMode, editSubjectId, editChapterId]);

  if (!isOpen) return null;

  const isCreatingNewSubject = selectedSubjectOption === '__NEW__' || subjects.length === 0;

  // Process Short Notes file (.pdf, .tex, .latex, .md, .txt)
  const handleShortFile = (file) => {
    if (!file) return;
    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith('.pdf')) {
      const objUrl = URL.createObjectURL(file);
      setShortFile(file);
      setShortPdfFile(file);
      setShortPdfUrl(objUrl);
      setShortFileType('pdf');
      setShortContent('');
      setShortMode('file');
      setErrorMessage(null);

      if (!chapterTitle.trim()) {
        const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        setChapterTitle(cleanName.replace(/\b\w/g, (l) => l.toUpperCase()));
      }
    } else {
      // Text, LaTeX, or Markdown
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setShortFile(file);
        setShortPdfFile(null);
        setShortPdfUrl(null);
        setShortContent(content);
        setShortMode('file');
        setErrorMessage(null);

        if (nameLower.endsWith('.tex') || nameLower.endsWith('.latex')) {
          setShortFileType('tex');
          const meta = extractLatexMetadata(content);
          if (meta.title && meta.title !== 'Revision Notes' && !chapterTitle.trim()) {
            setChapterTitle(meta.title);
          } else if (!chapterTitle.trim()) {
            const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            setChapterTitle(cleanName.replace(/\b\w/g, (l) => l.toUpperCase()));
          }
          if (meta.period && !chapterPeriod.trim()) {
            setChapterPeriod(meta.period);
          }
        } else {
          setShortFileType('md');
          if (!chapterTitle.trim()) {
            const h1Match = content.match(/^#\s+(.+)$/m);
            if (h1Match && h1Match[1]) {
              setChapterTitle(h1Match[1].trim());
            } else {
              const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
              setChapterTitle(cleanName.replace(/\b\w/g, (l) => l.toUpperCase()));
            }
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Process Long Notes file (.md, .markdown, .txt, .pdf)
  const handleLongFile = (file) => {
    if (!file) return;
    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith('.pdf')) {
      // A PDF was provided for Long Notes
      setLongFile(file);
      setLongMode('file');
      setErrorMessage(null);

      // Attempt to read text or provide reference
      const reader = new FileReader();
      reader.onload = () => {
        setLongContent(`# ${file.name.replace(/\.pdf$/i, '')}\n\n*Reference PDF document: "${file.name}" (${formatFileSize(file.size)})*`);
      };
      reader.readAsArrayBuffer(file);

      if (!chapterTitle.trim()) {
        const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        setChapterTitle(cleanName.replace(/\b\w/g, (l) => l.toUpperCase()));
      }
    } else {
      // Standard Markdown or Plain Text
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setLongFile(file);
        setLongContent(content);
        setLongMode('file');
        setErrorMessage(null);

        if (!chapterTitle.trim()) {
          const h1Match = content.match(/^#\s+(.+)$/m);
          if (h1Match && h1Match[1]) {
            setChapterTitle(h1Match[1].trim());
          } else {
            const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            setChapterTitle(cleanName.replace(/\b\w/g, (l) => l.toUpperCase()));
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Smart routing when multiple files dropped at once on generic area
  const ingestGenericFiles = (files) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 1) {
      // Single file dropped: if short slot is empty, put it in short; otherwise long
      if (!hasShortNotes) {
        handleShortFile(fileArr[0]);
      } else {
        handleLongFile(fileArr[0]);
      }
      return;
    }

    // Two or more files: look for semantic cues in filenames and file sizes
    let shortCandidate = null;
    let longCandidate = null;

    fileArr.forEach((f) => {
      const n = f.name.toLowerCase();
      if (
        n.includes('short') ||
        n.includes('summary') ||
        n.includes('brief') ||
        n.includes('cheat') ||
        n.includes('takeaway') ||
        n.includes('rev')
      ) {
        shortCandidate = f;
      } else if (
        n.includes('long') ||
        n.includes('detail') ||
        n.includes('context') ||
        n.includes('full') ||
        n.includes('complete') ||
        n.includes('book') ||
        n.includes('chapter')
      ) {
        longCandidate = f;
      }
    });

    // If no filename clues, assign smaller file to Short Notes and larger file to Long Notes
    if (!shortCandidate || !longCandidate) {
      const sortedBySize = [...fileArr].sort((a, b) => a.size - b.size);
      shortCandidate = sortedBySize[0];
      longCandidate = sortedBySize[1] || sortedBySize[0];
    }

    if (shortCandidate) handleShortFile(shortCandidate);
    if (longCandidate && longCandidate !== shortCandidate) handleLongFile(longCandidate);
  };

  // Swap Short Notes and Long Notes
  const handleSwapTiers = () => {
    const prevShortFile = shortFile;
    const prevShortPdfUrl = shortPdfUrl;
    const prevShortPdfFile = shortPdfFile;
    const prevShortContent = shortContent;
    const prevShortFileType = shortFileType;
    const prevShortMode = shortMode;

    const prevLongFile = longFile;
    const prevLongContent = longContent;
    const prevLongMode = longMode;

    // Move Long -> Short
    setShortFile(prevLongFile);
    setShortPdfUrl(null);
    setShortPdfFile(null);
    setShortContent(prevLongContent);
    setShortFileType('md');
    setShortMode(prevLongMode);

    // Move Short -> Long
    setLongFile(prevShortFile);
    setLongContent(prevShortContent || (prevShortPdfFile ? `# ${chapterTitle}\n*Derived from ${prevShortPdfFile.name}*` : ''));
    setLongMode(prevShortMode);

    setErrorMessage(null);
  };

  // Clear Short Notes
  const clearShortNotes = () => {
    setShortFile(null);
    setShortPdfFile(null);
    setShortPdfUrl(null);
    setShortContent('');
    setShortFileType(null);
  };

  // Clear Long Notes
  const clearLongNotes = () => {
    setLongFile(null);
    setLongContent('');
  };

  // Validation checks
  const hasShortNotes = shortMode === 'file'
    ? !!shortFile || !!shortPdfUrl || shortContent.trim().length > 0
    : shortContent.trim().length > 0;

  const hasLongNotes = longContent.trim().length > 0 || !!longFile;
  const hasTitle = chapterTitle.trim().length > 0;
  const isFormComplete = hasShortNotes && hasLongNotes && hasTitle;

  // Warning checks for duplicates or potential swaps
  const isLikelyDuplicate =
    shortFile &&
    longFile &&
    shortFile.name === longFile.name &&
    shortFile.name.length > 0;

  const isIdenticalContent =
    shortContent.trim().length > 80 &&
    longContent.trim().length > 80 &&
    shortContent.trim() === longContent.trim();

  const isShortVeryLarge =
    (shortPdfFile && shortPdfFile.size > 8 * 1024 * 1024) ||
    shortContent.length > 50000;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormAttempted(true);

    if (!hasShortNotes && !hasLongNotes) {
      setErrorMessage('Both Short Notes and Long Notes are mandatory. Please provide both.');
      return;
    }
    if (!hasShortNotes) {
      setErrorMessage('Short Notes are mandatory. Please upload a summary (.pdf, .tex, .md, .txt) or paste content.');
      return;
    }
    if (!hasLongNotes) {
      setErrorMessage('Long Notes are mandatory. Please upload a detailed source (.md, .txt, .pdf) or paste content.');
      return;
    }
    if (!hasTitle) {
      setErrorMessage('Please enter a note title.');
      return;
    }

    let targetSubjectId = selectedSubjectOption;
    if (isCreatingNewSubject && !isEditMode) {
      if (!newSubjectTitle.trim()) {
        setErrorMessage('Please enter a Subject Name.');
        return;
      }
      const newSub = addCustomSubject({
        title: newSubjectTitle.trim(),
        code: 'NOTES',
        description: 'Study collection',
      });
      targetSubjectId = newSub.id;
    }

    // Determine final short notes raw text
    let finalShortNotesRaw = '';
    if (shortFileType === 'tex' || shortFileType === 'md' || shortMode === 'paste') {
      finalShortNotesRaw = shortContent.trim();
    } else if (shortPdfFile || shortPdfUrl) {
      finalShortNotesRaw = `% ${chapterTitle.trim()} LaTeX Short Notes\n\\section{1}{${chapterTitle.trim()}}\n100% Authentic LaTeX PDF short notes attached.`;
    }

    if (isEditMode) {
      // Update existing chapter
      saveChapterEdits(editSubjectId, editChapterId, {
        shortNotesRaw: finalShortNotesRaw,
        longNotesRaw: longContent.trim(),
      });

      if (shortPdfFile) {
        savePdfBlob(editChapterId, shortPdfFile).catch(console.error);
        updateChapterPdf(editSubjectId, editChapterId, shortPdfUrl);
        setCurrentPdfPath(shortPdfUrl);
      } else if (!shortPdfUrl) {
        // Clear PDF if user replaced with text/markdown
        updateChapterPdf(editSubjectId, editChapterId, null);
        setCurrentPdfPath(null);
      }

      setShortNotesRaw(finalShortNotesRaw);
      setLongNotesRaw(longContent.trim());
      const parsedData = parseLatexNotes(finalShortNotesRaw);
      setShortNotesData(parsedData);
      refreshConnections();
      setWorkMode('read');
      onClose();
      return;
    }

    // Create brand new chapter
    const res = addCustomChapter(targetSubjectId, {
      title: chapterTitle.trim(),
      subtitle: chapterPeriod.trim() || 'Study Notes',
      period: chapterPeriod.trim() || '',
      pdfPath: shortPdfUrl || null,
      pdfFile: shortPdfFile || null,
      shortNotesRaw: finalShortNotesRaw,
      longNotesRaw: longContent.trim(),
    });

    setActiveSubjectId(res.subject.id);
    setActiveChapterId(res.chapter.id);
    setWorkMode('read');
    if (onNoteCreated) onNoteCreated(res.subject.id, res.chapter.id);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card upload-two-tier-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <BookPlus size={20} className="modal-icon" />
            <div>
              <h3 className="modal-heading">
                {isEditMode ? 'Update Note Documents' : 'Upload Two-Tier Study Note'}
              </h3>
              <p className="modal-subheading">
                NotesWeb connects high-density <strong>Short Notes</strong> with comprehensive <strong>Long Notes</strong>.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="modal-body-form upload-modal-form">
          {/* Metadata Section: Subject & Note Title */}
          <div className="upload-metadata-section">
            <div className="upload-metadata-row">
              {/* Subject Select */}
              <div className="form-group upload-field-half">
                <label className="form-label">Subject</label>
                <select
                  className="form-input form-select"
                  value={selectedSubjectOption}
                  disabled={isEditMode}
                  onChange={(e) => setSelectedSubjectOption(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  {!isEditMode && <option value="__NEW__">+ Create New Subject...</option>}
                </select>
              </div>

              {/* Note Title */}
              <div className="form-group upload-field-half">
                <label className="form-label">
                  Note Title <span className="label-required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${formAttempted && !hasTitle ? 'input-error' : ''}`}
                  placeholder="e.g. Difference between Gender and Women Studies"
                  value={chapterTitle}
                  onChange={(e) => {
                    setChapterTitle(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  required
                />
              </div>
            </div>

            {/* Optional New Subject Title or Period */}
            <div className="upload-metadata-row">
              {isCreatingNewSubject && !isEditMode && (
                <div className="form-group upload-field-half">
                  <label className="form-label">
                    New Subject Name <span className="label-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Gender Studies, Pakistan Affairs..."
                    value={newSubjectTitle}
                    onChange={(e) => setNewSubjectTitle(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className={`form-group ${isCreatingNewSubject && !isEditMode ? 'upload-field-half' : 'upload-field-full'}`}>
                <label className="form-label">
                  Subtitle or Period <span className="label-optional">(optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Chapter 1, Key Definitions, Exam Synthesis..."
                  value={chapterPeriod}
                  onChange={(e) => setChapterPeriod(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Quick Swap Tiers Bar */}
          <div className="upload-swap-bar">
            <span className="swap-bar-hint">
              Drop documents into their respective cards below, or click swap if they are in the wrong order:
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline swap-tiers-btn"
              onClick={handleSwapTiers}
              title="Swap Short Notes and Long Notes slots"
            >
              <ArrowLeftRight size={13} />
              <span>Swap Short &amp; Long Notes</span>
            </button>
          </div>

          {/* TWO MANDATORY UPLOAD TIERS */}
          <div className="upload-dual-tiers-container">
            {/* TIER 1: SHORT NOTES (MANDATORY) */}
            <div
              className={`upload-tier-card tier-short-card ${
                hasShortNotes ? 'tier-complete' : formAttempted ? 'tier-incomplete' : ''
              }`}
            >
              <div className="upload-tier-header">
                <div className="tier-header-left">
                  <FileText size={17} className="tier-icon text-primary" />
                  <div>
                    <div className="tier-title-row">
                      <h4 className="tier-title">Short Notes</h4>
                      <span className="badge-mandatory">Mandatory</span>
                    </div>
                    <span className="tier-subtitle">
                      Revision summary • PDF (.pdf), Markdown (.md), or TeX (.tex)
                    </span>
                  </div>
                </div>

                <div className="tier-mode-toggle">
                  <button
                    type="button"
                    className={`mode-btn ${shortMode === 'file' ? 'active' : ''}`}
                    onClick={() => setShortMode('file')}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${shortMode === 'paste' ? 'active' : ''}`}
                    onClick={() => setShortMode('paste')}
                  >
                    Paste
                  </button>
                </div>
              </div>

              {shortMode === 'file' ? (
                <div>
                  <input
                    ref={shortFileInputRef}
                    type="file"
                    accept=".pdf,.tex,.latex,.md,.markdown,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleShortFile(e.target.files[0]);
                    }}
                  />

                  {hasShortNotes && (shortFile || shortPdfUrl || shortContent) ? (
                    <div className="upload-attached-card">
                      <div className="attached-card-icon">
                        <FileCheck2 size={24} className="text-success" />
                      </div>
                      <div className="attached-card-details">
                        <span className="attached-filename" title={shortFile?.name || `${chapterTitle} (Short Notes)`}>
                          {shortFile?.name || `${chapterTitle} (Short Notes)`}
                        </span>
                        <div className="attached-meta-row">
                          <span className="attached-type-tag">
                            {shortFileType === 'pdf' ? 'PDF Document' : shortFileType === 'tex' ? 'LaTeX TeX' : 'Markdown Summary'}
                          </span>
                          {shortFile?.size > 0 && (
                            <span className="attached-filesize">{formatFileSize(shortFile.size)}</span>
                          )}
                          {shortContent && (
                            <span className="attached-filesize">~{countWords(shortContent)} words</span>
                          )}
                          <span className="attached-status-ok">✓ Attached to Short Notes</span>
                        </div>
                        {shortContent && (
                          <p className="attached-snippet-preview">
                            "{getSnippet(shortContent)}"
                          </p>
                        )}
                      </div>
                      <div className="attached-card-actions">
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => shortFileInputRef.current?.click()}
                          title="Replace file"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action action-danger"
                          onClick={clearShortNotes}
                          title="Remove Short Notes"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`upload-drop-target ${shortDragOver ? 'drag-over' : ''} ${
                        formAttempted && !hasShortNotes ? 'drop-target-error' : ''
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShortDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShortDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShortDragOver(false);
                        if (e.dataTransfer.files?.[0]) handleShortFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => shortFileInputRef.current?.click()}
                    >
                      <UploadCloud size={24} className="drop-target-icon" />
                      <div className="drop-target-text">
                        <span className="drop-target-prompt">
                          Drop <strong>Short Notes</strong> (.pdf, .md, .tex, .txt) here
                        </span>
                        <span className="drop-target-hint">or click to browse from computer</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="upload-paste-container">
                  <textarea
                    className={`upload-paste-textarea ${
                      formAttempted && !hasShortNotes ? 'textarea-error' : ''
                    }`}
                    rows={5}
                    placeholder={'Paste short revision notes (Markdown or LaTeX):\n\n## 1. Key Takeaways\n- Point 1\n- Point 2\n\n> Key Concept definition...'}
                    value={shortContent}
                    onChange={(e) => {
                      setShortContent(e.target.value);
                      setShortFileType(e.target.value.includes('\\section') ? 'tex' : 'md');
                      setShortPdfFile(null);
                      setShortPdfUrl(null);
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />
                  <div className="paste-footer-meta">
                    <span>{shortContent.length} characters • ~{countWords(shortContent)} words</span>
                    {shortContent.trim().length > 0 && <span className="text-success">✓ Ready for Short Notes</span>}
                  </div>
                </div>
              )}
            </div>

            {/* TIER 2: LONG NOTES (MANDATORY) */}
            <div
              className={`upload-tier-card tier-long-card ${
                hasLongNotes ? 'tier-complete' : formAttempted ? 'tier-incomplete' : ''
              }`}
            >
              <div className="upload-tier-header">
                <div className="tier-header-left">
                  <BookOpen size={17} className="tier-icon text-accent" />
                  <div>
                    <div className="tier-title-row">
                      <h4 className="tier-title">Long Notes</h4>
                      <span className="badge-mandatory">Mandatory</span>
                    </div>
                    <span className="tier-subtitle">
                      Comprehensive background • Markdown (.md), Text (.txt), or PDF (.pdf)
                    </span>
                  </div>
                </div>

                <div className="tier-mode-toggle">
                  <button
                    type="button"
                    className={`mode-btn ${longMode === 'file' ? 'active' : ''}`}
                    onClick={() => setLongMode('file')}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${longMode === 'paste' ? 'active' : ''}`}
                    onClick={() => setLongMode('paste')}
                  >
                    Paste
                  </button>
                </div>
              </div>

              {longMode === 'file' ? (
                <div>
                  <input
                    ref={longFileInputRef}
                    type="file"
                    accept=".md,.markdown,.txt,.pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLongFile(e.target.files[0]);
                    }}
                  />

                  {hasLongNotes && (longFile || longContent) ? (
                    <div className="upload-attached-card">
                      <div className="attached-card-icon">
                        <CheckCircle2 size={24} className="text-success" />
                      </div>
                      <div className="attached-card-details">
                        <span className="attached-filename" title={longFile?.name || `${chapterTitle} (Long Notes)`}>
                          {longFile?.name || `${chapterTitle} (Long Notes)`}
                        </span>
                        <div className="attached-meta-row">
                          <span className="attached-type-tag">Detailed Source</span>
                          {longFile?.size > 0 && (
                            <span className="attached-filesize">{formatFileSize(longFile.size)}</span>
                          )}
                          <span className="attached-filesize">
                            ~{countWords(longContent)} words
                          </span>
                          <span className="attached-status-ok">✓ Attached to Long Notes</span>
                        </div>
                        {longContent && (
                          <p className="attached-snippet-preview">
                            "{getSnippet(longContent)}"
                          </p>
                        )}
                      </div>
                      <div className="attached-card-actions">
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => longFileInputRef.current?.click()}
                          title="Replace file"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action action-danger"
                          onClick={clearLongNotes}
                          title="Remove Long Notes"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`upload-drop-target ${longDragOver ? 'drag-over' : ''} ${
                        formAttempted && !hasLongNotes ? 'drop-target-error' : ''
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLongDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLongDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLongDragOver(false);
                        if (e.dataTransfer.files?.[0]) handleLongFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => longFileInputRef.current?.click()}
                    >
                      <UploadCloud size={24} className="drop-target-icon" />
                      <div className="drop-target-text">
                        <span className="drop-target-prompt">
                          Drop <strong>Long Notes</strong> (.md, .txt, .pdf) here
                        </span>
                        <span className="drop-target-hint">or click to browse from computer</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="upload-paste-container">
                  <textarea
                    className={`upload-paste-textarea ${
                      formAttempted && !hasLongNotes ? 'textarea-error' : ''
                    }`}
                    rows={5}
                    placeholder={'Paste comprehensive context background:\n\n# Detailed Analysis\n\n## 1. Historical & Structural Context\nWrite in-depth reference paragraphs exported from Google Docs or Markdown...'}
                    value={longContent}
                    onChange={(e) => {
                      setLongContent(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />
                  <div className="paste-footer-meta">
                    <span>
                      ~{countWords(longContent)} words ({longContent.length} chars)
                    </span>
                    {longContent.trim().length > 0 && <span className="text-success">✓ Ready for Long Notes</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Duplicate Document or Large File Warning Alerts */}
          {(isLikelyDuplicate || isIdenticalContent) && (
            <div className="upload-warning-banner" role="alert">
              <AlertCircle size={15} />
              <span>
                <strong>Warning:</strong> The exact same document is loaded into both Short Notes and Long Notes. Short Notes should be a concise summary, while Long Notes contains the comprehensive background.
              </span>
            </div>
          )}

          {isShortVeryLarge && !isLikelyDuplicate && (
            <div className="upload-tip-banner">
              <Info size={15} />
              <span>
                <strong>Notice:</strong> Your Short Notes file is unusually large (~{countWords(shortContent)} words / {formatFileSize(shortPdfFile?.size)}). If this is your full textbook or detailed notes, click <strong>"Swap Short &amp; Long Notes"</strong> above.
              </span>
            </div>
          )}

          {/* Validation & Error Messaging */}
          {errorMessage && (
            <div className="upload-error-alert" role="alert">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dual-Tier Progress Indicator */}
          <div className="upload-status-bar">
            <div className="status-item">
              <span className={`status-indicator ${hasShortNotes ? 'status-ready' : 'status-pending'}`}>
                {hasShortNotes ? '✓' : '1'}
              </span>
              <span className="status-label">
                Short Notes: <strong>{hasShortNotes ? 'Attached' : 'Required'}</strong>
              </span>
            </div>

            <div className="status-divider" />

            <div className="status-item">
              <span className={`status-indicator ${hasLongNotes ? 'status-ready' : 'status-pending'}`}>
                {hasLongNotes ? '✓' : '2'}
              </span>
              <span className="status-label">
                Long Notes: <strong>{hasLongNotes ? 'Attached' : 'Required'}</strong>
              </span>
            </div>

            <div className="status-overall-badge">
              {isFormComplete ? (
                <span className="badge-complete">
                  <Sparkles size={12} /> {isEditMode ? 'Ready to Update' : 'Ready to Ingest'}
                </span>
              ) : (
                <span className="badge-incomplete">
                  {hasShortNotes && !hasLongNotes
                    ? 'Attach Long Notes to finish'
                    : !hasShortNotes && hasLongNotes
                    ? 'Attach Short Notes to finish'
                    : 'Both files required'}
                </span>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="modal-footer-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary upload-submit-btn ${!isFormComplete ? 'btn-disabled' : ''}`}
            >
              <Plus size={15} />
              <span>
                {isEditMode
                  ? isFormComplete
                    ? 'Update Note Documents'
                    : 'Attach Both Notes to Update'
                  : isFormComplete
                  ? 'Add Note to Vault'
                  : 'Attach Both Notes to Continue'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
