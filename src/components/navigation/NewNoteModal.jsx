// src/components/navigation/NewNoteModal.jsx - Two-Tier Note Ingestion Modal
// Enforces mandatory upload of both Short Notes (LaTeX/PDF) and Long Notes (Markdown/Context)

import React, { useState, useRef, useEffect } from 'react';
import { useReading } from '../../context/ReadingContext';
import { getVaultSubjects, addCustomChapter, addCustomSubject } from '../../utils/vaultManager';
import { extractLatexMetadata } from '../../utils/latexParser';
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

export default function NewNoteModal({ isOpen, onClose, onNoteCreated, initialFiles = [] }) {
  const { setActiveSubjectId, setActiveChapterId, setWorkMode } = useReading();
  const subjects = getVaultSubjects();

  // Subject & Chapter Metadata
  const [selectedSubjectOption, setSelectedSubjectOption] = useState(() => {
    return subjects.length > 0 ? subjects[0].id : '__NEW__';
  });
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterPeriod, setChapterPeriod] = useState('');

  // Tier 1: Short Notes (Mandatory)
  const [shortMode, setShortMode] = useState('file'); // 'file' | 'paste'
  const [shortFile, setShortFile] = useState(null);
  const [shortPdfUrl, setShortPdfUrl] = useState(null);
  const [shortPdfFile, setShortPdfFile] = useState(null);
  const [shortContent, setShortContent] = useState('');
  const [shortFileType, setShortFileType] = useState(null); // 'pdf' | 'tex'

  // Tier 2: Long Notes (Mandatory)
  const [longMode, setLongMode] = useState('file'); // 'file' | 'paste'
  const [longFile, setLongFile] = useState(null);
  const [longContent, setLongContent] = useState('');

  // Drag state & feedback
  const [isModalDragOver, setIsModalDragOver] = useState(false);
  const [shortDragOver, setShortDragOver] = useState(false);
  const [longDragOver, setLongDragOver] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const shortFileInputRef = useRef(null);
  const longFileInputRef = useRef(null);

  // Ingest any files passed via props on open
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      ingestFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  if (!isOpen) return null;

  const isCreatingNewSubject = selectedSubjectOption === '__NEW__' || subjects.length === 0;

  // Process Short Notes file (.pdf, .tex, .latex)
  const handleShortFile = (file) => {
    if (!file) return;
    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith('.pdf')) {
      const objUrl = URL.createObjectURL(file);
      setShortFile(file);
      setShortPdfFile(file);
      setShortPdfUrl(objUrl);
      setShortFileType('pdf');
      setShortMode('file');
      setErrorMessage(null);

      // Auto-extract title if blank
      if (!chapterTitle.trim()) {
        const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        setChapterTitle(cleanName.replace(/\b\w/g, (l) => l.toUpperCase()));
      }
    } else if (nameLower.endsWith('.tex') || nameLower.endsWith('.latex')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setShortFile(file);
        setShortPdfFile(null);
        setShortPdfUrl(null);
        setShortContent(content);
        setShortFileType('tex');
        setShortMode('file');
        setErrorMessage(null);

        // Auto-extract title & period from LaTeX
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
      };
      reader.readAsText(file);
    } else {
      setErrorMessage(`"${file.name}" is not a recognized Short Notes format. Please upload a .pdf or .tex file.`);
    }
  };

  // Process Long Notes file (.md, .markdown, .txt)
  const handleLongFile = (file) => {
    if (!file) return;
    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith('.md') || nameLower.endsWith('.markdown') || nameLower.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setLongFile(file);
        setLongContent(content);
        setLongMode('file');
        setErrorMessage(null);

        // Auto-extract title from markdown H1 if still blank
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
    } else {
      setErrorMessage(`"${file.name}" is not a recognized Long Notes format. Please upload a .md or .txt file.`);
    }
  };

  // Dual-file ingestion router (intelligent assignment based on extension)
  const ingestFiles = (files) => {
    const fileArr = Array.from(files);
    fileArr.forEach((file) => {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf') || name.endsWith('.tex') || name.endsWith('.latex')) {
        handleShortFile(file);
      } else if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
        handleLongFile(file);
      } else {
        setErrorMessage(`Unsupported file "${file.name}". Please upload .pdf/.tex for Short Notes and .md/.txt for Long Notes.`);
      }
    });
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
    ? !!shortFile && (shortFileType === 'pdf' ? !!shortPdfFile : shortContent.trim().length > 0)
    : shortContent.trim().length > 0;

  const hasLongNotes = longContent.trim().length > 0;

  const hasTitle = chapterTitle.trim().length > 0;
  const isFormComplete = hasShortNotes && hasLongNotes && hasTitle;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormAttempted(true);

    if (!hasShortNotes && !hasLongNotes) {
      setErrorMessage('Both Short Notes and Long Notes are mandatory. Please provide both.');
      return;
    }
    if (!hasShortNotes) {
      setErrorMessage('Short Notes are mandatory. Please upload a .pdf / .tex file or paste LaTeX code.');
      return;
    }
    if (!hasLongNotes) {
      setErrorMessage('Long Notes are mandatory. Please upload a .md / .txt file or paste Markdown content.');
      return;
    }
    if (!hasTitle) {
      setErrorMessage('Please enter a note title.');
      return;
    }

    let targetSubjectId = selectedSubjectOption;
    if (isCreatingNewSubject) {
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

    // Prepare Short Notes Raw representation
    let finalShortNotesRaw = '';
    if (shortFileType === 'tex' || shortMode === 'paste') {
      finalShortNotesRaw = shortContent.trim();
    } else {
      // PDF-based short notes
      finalShortNotesRaw = `% ${chapterTitle.trim()} LaTeX Short Notes\n\\section{1}{${chapterTitle.trim()}}\n100% Authentic LaTeX PDF short notes attached.`;
    }

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
      onDragOver={(e) => {
        e.preventDefault();
        setIsModalDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsModalDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsModalDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          ingestFiles(e.dataTransfer.files);
        }
      }}
    >
      <div
        className={`modal-card upload-two-tier-modal ${isModalDragOver ? 'modal-drag-active' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <BookPlus size={19} className="modal-icon" />
            <div>
              <h3 className="modal-heading">Upload Two-Tier Study Note</h3>
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
                  onChange={(e) => setSelectedSubjectOption(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  <option value="__NEW__">+ Create New Subject...</option>
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
                  placeholder="e.g. Partition of Bengal (1905), Quantum State..."
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
              {isCreatingNewSubject && (
                <div className="form-group upload-field-half">
                  <label className="form-label">New Subject Name <span className="label-required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Pakistan Affairs, Modern Physics..."
                    value={newSubjectTitle}
                    onChange={(e) => setNewSubjectTitle(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className={`form-group ${isCreatingNewSubject ? 'upload-field-half' : 'upload-field-full'}`}>
                <label className="form-label">
                  Subtitle or Period <span className="label-optional">(optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1905–1924, Chapter 1, Review Summary..."
                  value={chapterPeriod}
                  onChange={(e) => setChapterPeriod(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* TWO MANDATORY UPLOAD TIERS */}
          <div className="upload-dual-tiers-container">
            {/* TIER 1: SHORT NOTES (MANDATORY) */}
            <div
              className={`upload-tier-card ${
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
                    <span className="tier-subtitle">LaTeX PDF (.pdf) or TeX Source (.tex)</span>
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
                    accept=".pdf,.tex,.latex"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleShortFile(e.target.files[0]);
                    }}
                  />

                  {shortFile ? (
                    <div className="upload-attached-card">
                      <div className="attached-card-icon">
                        <FileCheck2 size={24} className="text-success" />
                      </div>
                      <div className="attached-card-details">
                        <span className="attached-filename" title={shortFile.name}>
                          {shortFile.name}
                        </span>
                        <div className="attached-meta-row">
                          <span className="attached-type-tag">
                            {shortFileType === 'pdf' ? 'Authentic PDF' : 'LaTeX Source'}
                          </span>
                          <span className="attached-filesize">{formatFileSize(shortFile.size)}</span>
                          <span className="attached-status-ok">✓ Attached</span>
                        </div>
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
                        setShortDragOver(true);
                      }}
                      onDragLeave={() => setShortDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setShortDragOver(false);
                        if (e.dataTransfer.files?.[0]) handleShortFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => shortFileInputRef.current?.click()}
                    >
                      <UploadCloud size={24} className="drop-target-icon" />
                      <div className="drop-target-text">
                        <span className="drop-target-prompt">
                          Drop <strong>.pdf</strong> or <strong>.tex</strong> file here
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
                    placeholder={'\\section{1}{Core Takeaway}\n\\begin{tcolorbox}[title=Concept]\nHigh-yield revision takeaway here...\n\\end{tcolorbox}'}
                    value={shortContent}
                    onChange={(e) => {
                      setShortContent(e.target.value);
                      setShortFileType('tex');
                      if (errorMessage) setErrorMessage(null);
                    }}
                  />
                  <div className="paste-footer-meta">
                    <span>{shortContent.length} characters</span>
                    {shortContent.trim().length > 0 && <span className="text-success">✓ Ready</span>}
                  </div>
                </div>
              )}
            </div>

            {/* TIER 2: LONG NOTES (MANDATORY) */}
            <div
              className={`upload-tier-card ${
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
                    <span className="tier-subtitle">Markdown (.md) or Google Docs export (.txt)</span>
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
                    accept=".md,.markdown,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLongFile(e.target.files[0]);
                    }}
                  />

                  {longFile ? (
                    <div className="upload-attached-card">
                      <div className="attached-card-icon">
                        <CheckCircle2 size={24} className="text-success" />
                      </div>
                      <div className="attached-card-details">
                        <span className="attached-filename" title={longFile.name}>
                          {longFile.name}
                        </span>
                        <div className="attached-meta-row">
                          <span className="attached-type-tag">Markdown Document</span>
                          <span className="attached-filesize">
                            ~{countWords(longContent)} words ({formatFileSize(longFile.size)})
                          </span>
                          <span className="attached-status-ok">✓ Attached</span>
                        </div>
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
                        setLongDragOver(true);
                      }}
                      onDragLeave={() => setLongDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setLongDragOver(false);
                        if (e.dataTransfer.files?.[0]) handleLongFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => longFileInputRef.current?.click()}
                    >
                      <UploadCloud size={24} className="drop-target-icon" />
                      <div className="drop-target-text">
                        <span className="drop-target-prompt">
                          Drop <strong>.md</strong> or <strong>.txt</strong> file here
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
                    placeholder={'# In-Depth Background Analysis\n\n## 1. Historical & Strategic Overview\nDetailed context paragraphs exported from Google Docs or Markdown...'}
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
                    {longContent.trim().length > 0 && <span className="text-success">✓ Ready</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                  <Sparkles size={12} /> Ready to Ingest
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
              <span>{isFormComplete ? 'Add Note to Vault' : 'Attach Both Notes to Continue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
