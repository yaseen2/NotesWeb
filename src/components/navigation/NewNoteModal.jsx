// src/components/navigation/NewNoteModal.jsx - Clean, Professional Note Ingestion Modal

import React, { useState, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import { getVaultSubjects, addCustomChapter, addCustomSubject } from '../../utils/vaultManager';
import { extractLatexMetadata } from '../../utils/latexParser';
import {
  X,
  Plus,
  BookPlus,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';

const DEFAULT_LATEX_TEMPLATE = `\\title{\\textbf{Study Notes: Core Synthesis}\\\\ \\large Key Principles & Revision}
\\author{NotesWeb Vault}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction & Conceptual Framework}

\\begin{tcolorbox}[colback=cardblue!5,colframe=cardblue,title={KEY TAKEAWAY: CORE CONCEPT}]
Synthesize the primary high-yield takeaway in 2-3 concise sentences.
\\end{tcolorbox}

\\subsection{Major Pillars & Theoretical Foundations}
\\begin{itemize}
  \\item \\textbf{Fundamental Principle}: Core theoretical definition and rationale.
  \\item \\textbf{Key Application}: Analytical frameworks, methodologies, and outcomes.
\\end{itemize}

\\end{document}
`;

const DEFAULT_MARKDOWN_TEMPLATE = `# Comprehensive Background & Analysis

## 1. Deep Contextual Overview
Write your detailed narrative background here, exported from Google Docs or written in Markdown.

## 2. Key Strategic Outcomes
- Detailed examination of long-term conceptual, analytical, and practical consequences.
`;

export default function NewNoteModal({ isOpen, onClose, onNoteCreated }) {
  const { setActiveSubjectId, setActiveChapterId, setWorkMode } = useReading();
  const subjects = getVaultSubjects();

  const [selectedSubjectOption, setSelectedSubjectOption] = useState(() => {
    return subjects.length > 0 ? subjects[0].id : '__NEW__';
  });
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterPeriod, setChapterPeriod] = useState('');
  const [pdfPath, setPdfPath] = useState(null);
  const [uploadedPdfFile, setUploadedPdfFile] = useState(null);
  const [shortNotesRaw, setShortNotesRaw] = useState(DEFAULT_LATEX_TEMPLATE);
  const [longNotesRaw, setLongNotesRaw] = useState(DEFAULT_MARKDOWN_TEMPLATE);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const isCreatingNewSubject = selectedSubjectOption === '__NEW__' || subjects.length === 0;

  // Handle file ingestion (.pdf, .tex, or .md)
  const processUploadedFile = (file) => {
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      const objUrl = URL.createObjectURL(file);
      setPdfPath(objUrl);
      setUploadedPdfFile(file);
      if (!chapterTitle) {
        setChapterTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
      }
      setUploadMessage(`Imported PDF "${file.name}"`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;

      if (
        file.name.endsWith('.tex') ||
        file.name.endsWith('.latex') ||
        content.includes('\\documentclass') ||
        content.includes('\\section')
      ) {
        const meta = extractLatexMetadata(content);
        setShortNotesRaw(content);
        if (meta.title && meta.title !== 'Revision Notes') {
          setChapterTitle(meta.title);
        } else {
          setChapterTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
        }
        if (meta.period) {
          setChapterPeriod(meta.period);
        }
        setUploadMessage(`Imported "${meta.title || file.name}"`);
      } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
        setLongNotesRaw(content);
        setUploadMessage(`Imported Markdown "${file.name}"`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((f) => processUploadedFile(f));
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((f) => processUploadedFile(f));
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!chapterTitle.trim()) {
      alert('Please enter a note title or upload a .tex file.');
      return;
    }

    let targetSubjectId = selectedSubjectOption;

    if (isCreatingNewSubject) {
      if (!newSubjectTitle.trim()) {
        alert('Please enter a subject name.');
        return;
      }
      const newSub = addCustomSubject({
        title: newSubjectTitle.trim(),
        code: 'NOTES',
        description: 'Study collection',
      });
      targetSubjectId = newSub.id;
    }

    const res = addCustomChapter(targetSubjectId, {
      title: chapterTitle.trim(),
      subtitle: chapterPeriod.trim() || 'Study Notes',
      period: chapterPeriod.trim() || '',
      pdfPath: pdfPath || null,
      pdfFile: uploadedPdfFile,
      shortNotesRaw,
      longNotesRaw,
    });

    setActiveSubjectId(res.subject.id);
    setActiveChapterId(res.chapter.id);
    setWorkMode('read');
    if (onNoteCreated) onNoteCreated(res.subject.id, res.chapter.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card new-note-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <BookPlus size={18} className="modal-icon" />
            <h3 className="modal-heading">Add Note to Vault</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleCreate} className="modal-body-form">
          {/* File Drag & Drop Zone */}
          <div
            className={`file-dropzone ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.markdown,.txt,.tex"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <UploadCloud size={24} className="dropzone-icon" />
            <div className="dropzone-text">
              <span className="dropzone-main-text">
                Drag &amp; drop a <strong>.pdf</strong> or <strong>.md</strong> file
              </span>
              <span className="dropzone-sub-text">or click to browse from your computer</span>
            </div>
          </div>

          {uploadMessage && (
            <div className="upload-success-toast">
              <CheckCircle2 size={14} />
              <span>{uploadMessage}</span>
            </div>
          )}

          {/* Subject Field */}
          {subjects.length > 0 ? (
            <div className="form-group">
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
          ) : null}

          {/* New Subject Name Input if needed */}
          {isCreatingNewSubject && (
            <div className="form-group">
              <label className="form-label">Subject Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Constitutional Law, Quantum Mechanics..."
                value={newSubjectTitle}
                onChange={(e) => setNewSubjectTitle(e.target.value)}
                required
                autoFocus={isCreatingNewSubject}
              />
            </div>
          )}

          {/* Note Title */}
          <div className="form-group">
            <label className="form-label">Note Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Fundamental Rights, Hamilton's Principle..."
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              required
            />
          </div>

          {/* Subtitle / Topic (Optional) */}
          <div className="form-group">
            <label className="form-label">Subtitle or Topic <span className="label-optional">(optional)</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Chapter 1, Core Definitions, Review Notes..."
              value={chapterPeriod}
              onChange={(e) => setChapterPeriod(e.target.value)}
            />
          </div>

          {/* Modal Footer */}
          <div className="modal-footer-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={15} />
              <span>Create Note</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
