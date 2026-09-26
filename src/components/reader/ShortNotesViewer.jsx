// src/components/reader/ShortNotesViewer.jsx - Universal Short Notes Reader
// Directly renders Authentic PDF Viewer (when PDF attached) or Clean LaTeX Document

import React, { useState, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import PdfNotesViewer from './PdfNotesViewer';
import { addCustomChapter, addCustomSubject, getVaultSubjects } from '../../utils/vaultManager';
import {
  FileText,
  FileCheck,
  Loader2,
  Clock,
  UploadCloud,
  Plus,
  Sparkles,
  BookOpen,
  Layers,
  Compass,
} from 'lucide-react';
import NewNoteModal from '../navigation/NewNoteModal';

export default function ShortNotesViewer() {
  const {
    columnMode,
    openConcept,
    shortNotesData,
    currentPdfPath,
    contentLoading,
    isUpcoming,
    activeSubjectId,
    setActiveSubjectId,
    activeChapterId,
    setActiveChapterId,
    restoreSampleVault,
  } = useReading();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Handle concept clicks via event delegation
  const handleContainerClick = (e) => {
    const trigger = e.target.closest('.concept-trigger');
    if (!trigger) return;

    e.preventDefault();
    e.stopPropagation();

    const conceptId = trigger.getAttribute('data-concept-id') || trigger.getAttribute('data-connection-id');
    const targetSection = trigger.getAttribute('data-target-section');

    if (conceptId) {
      openConcept(conceptId, targetSection, e);
    }
  };

  // Handle direct PDF drop on the workspace canvas
  const handlePdfDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processDroppedPdf(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processDroppedPdf(files[0]);
    }
  };

  const processDroppedPdf = (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a valid .pdf file.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

    let subjects = getVaultSubjects();
    let targetSubjectId = activeSubjectId;

    if (!targetSubjectId || !subjects.some((s) => s.id === targetSubjectId)) {
      if (subjects.length > 0) {
        targetSubjectId = subjects[0].id;
      } else {
        const newSub = addCustomSubject('Imported Notes');
        targetSubjectId = newSub.id;
      }
    }

    const newChapter = addCustomChapter(targetSubjectId, {
      title: cleanTitle,
      shortNotes: `% ${cleanTitle} LaTeX Short Notes\n\\section{1}{Overview}\nDrop in contextual notes or connect concepts.`,
      longNotes: `# ${cleanTitle}\n\nContextual analysis and detailed reference background.`,
      pdfPath: objectUrl,
    });

    setActiveSubjectId(targetSubjectId);
    setActiveChapterId(newChapter.id);
  };

  // 1. Loading State
  if (contentLoading) {
    return (
      <div className="state-card loading-state">
        <Loader2 size={32} className="spin-icon" />
        <h3>Loading Revision Notes...</h3>
        <p>Parsing sections, takeaways, and concept anchors in real time.</p>
      </div>
    );
  }

  // 2. Upcoming / Note in preparation
  if (isUpcoming) {
    return (
      <div className="state-card upcoming-state">
        <Clock size={36} className="clock-icon" />
        <h3>Chapter Notes In Progress</h3>
        <p>This chapter's LaTeX short notes and contextual background are currently being prepared.</p>
      </div>
    );
  }

  // 3. Authentic PDF View: If a PDF is attached, render high-performance PDF.js reader
  if (currentPdfPath) {
    return <PdfNotesViewer pdfUrl={currentPdfPath} />;
  }

  // Helper to render subsection elements with grouped lists, tables, and quotes
  const renderSubElements = (elements) => {
    if (!elements || elements.length === 0) return null;
    const rendered = [];
    let currentBulletList = [];
    let currentNumberedList = [];

    const flushLists = (keyPrefix) => {
      if (currentBulletList.length > 0) {
        rendered.push(
          <ul key={`ul-${keyPrefix}`} className="latex-item-list">
            {currentBulletList}
          </ul>
        );
        currentBulletList = [];
      }
      if (currentNumberedList.length > 0) {
        rendered.push(
          <ol key={`ol-${keyPrefix}`} className="latex-enumerate-list">
            {currentNumberedList}
          </ol>
        );
        currentNumberedList = [];
      }
    };

    elements.forEach((el, idx) => {
      if (el.type === 'item') {
        if (currentNumberedList.length > 0) flushLists(`switch-num-${idx}`);
        currentBulletList.push(
          <li key={idx} dangerouslySetInnerHTML={{ __html: el.content }} />
        );
      } else if (el.type === 'numbered-item') {
        if (currentBulletList.length > 0) flushLists(`switch-bullet-${idx}`);
        currentNumberedList.push(
          <li key={idx} dangerouslySetInnerHTML={{ __html: el.content }} />
        );
      } else {
        flushLists(idx);

        if (el.type === 'table') {
          rendered.push(
            <div
              key={`tbl-${idx}`}
              className="latex-table-wrapper"
              dangerouslySetInnerHTML={{ __html: el.content }}
            />
          );
        } else if (el.type === 'quote') {
          rendered.push(
            <blockquote
              key={`quote-${idx}`}
              className="latex-quote"
              dangerouslySetInnerHTML={{ __html: el.content }}
            />
          );
        } else if (el.type === 'subsubsection') {
          rendered.push(
            <h4 key={`h4-${idx}`} className="latex-subsubsection-title">
              {el.content}
            </h4>
          );
        } else if (el.type === 'paragraph') {
          rendered.push(
            <p
              key={`p-${idx}`}
              className="latex-paragraph"
              dangerouslySetInnerHTML={{ __html: el.content }}
            />
          );
        }
      }
    });

    flushLists('end');
    return rendered;
  };

  // Helper to render a section block
  const renderSection = (section, secIdx = 0) => (
    <section key={`${section.id || section.number}-${secIdx}`} className="latex-section" id={section.id}>
      {!section.isContinuation && (
        <h2 className="latex-section-title">
          <span className="latex-section-number">{section.number}</span>
          <span>{section.title}</span>
        </h2>
      )}

      {section.takeaway && (
        <aside
          className={`tcolorbox tcolorbox-${section.takeaway.color}`}
          aria-label={section.takeaway.title}
        >
          <div className="tcolorbox-title">{section.takeaway.title}</div>
          <div
            className="tcolorbox-content"
            dangerouslySetInnerHTML={{ __html: section.takeaway.content }}
          />
        </aside>
      )}

      {section.subsections && section.subsections.map((sub, sIdx) => (
        <div key={sIdx} className="latex-subsection">
          {sub.title && (
            <h3 className="latex-subsection-title">
              {sub.number && <span className="latex-sub-number">{sub.number} </span>}
              <span>{sub.title}</span>
            </h3>
          )}
          {renderSubElements(sub.elements)}
        </div>
      ))}
    </section>
  );

  // 4. If shortNotesData is available without PDF (Clean LaTeX Document View)
  if (shortNotesData && shortNotesData.sections && shortNotesData.sections.length > 0) {
    return (
      <div className="latex-desk-canvas" onClick={handleContainerClick}>
        <article className="latex-document" aria-label="LaTeX Short Revision Notes">
          <header className="latex-title-header">
            <h1 className="latex-main-title">{shortNotesData.title}</h1>
            {shortNotesData.subtitle && (
              <p className="latex-subtitle">{shortNotesData.subtitle}</p>
            )}
          </header>

          <div className={`latex-body ${columnMode}`}>
            {shortNotesData.sections.map((section, sIdx) => renderSection(section, sIdx))}
          </div>
        </article>
      </div>
    );
  }

  // 5. Empty Vault / Onboarding Screen
  return (
    <div
      className={`workspace-empty-canvas ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handlePdfDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="workspace-hero-card">
        <div className="workspace-hero-badge">
          <Sparkles size={13} className="badge-sparkle" />
          <span>Specialized Two-Tier Revision Platform</span>
        </div>

        <h1 className="workspace-hero-title">Welcome to NotesWeb</h1>
        <p className="workspace-hero-subtitle">
          Pure vector bounding-box concept linking, sub-pixel LaTeX typography, and lossless deep-linking to contextual Long Notes.
        </p>

        <div
          className="workspace-dropzone-box"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="dropzone-icon-bubble">
            <UploadCloud size={28} />
          </div>
          <div className="dropzone-text-group">
            <span className="dropzone-primary-text">
              Drop any <strong>.pdf</strong> file here to start reading
            </span>
            <span className="dropzone-secondary-text">
              or click to browse from your computer
            </span>
          </div>
        </div>

        <div className="workspace-hero-actions">
          <button
            className="btn btn-primary hero-btn-main"
            onClick={() => setIsNewModalOpen(true)}
          >
            <Plus size={15} />
            <span>Create Note with Context</span>
          </button>

          <button
            className="btn btn-outline hero-btn-secondary"
            onClick={restoreSampleVault}
            title="Load sample CSS Pakistan Affairs revision note and explore features"
          >
            <Compass size={15} />
            <span>Explore Sample Note</span>
          </button>
        </div>

        <div className="workspace-features-grid">
          <div className="feature-pill-card">
            <div className="feature-pill-icon">
              <FileCheck size={16} />
            </div>
            <div className="feature-pill-content">
              <h4>100% Authentic PDF</h4>
              <p>Retina-rendered vector canvas preserves genuine TeX kerning &amp; layout.</p>
            </div>
          </div>

          <div className="feature-pill-card">
            <div className="feature-pill-icon">
              <Layers size={16} />
            </div>
            <div className="feature-pill-content">
              <h4>Dynamic Vector Highlights</h4>
              <p>Calculates sub-pixel glyph coordinates from raw PDF stream.</p>
            </div>
          </div>

          <div className="feature-pill-card">
            <div className="feature-pill-icon">
              <BookOpen size={16} />
            </div>
            <div className="feature-pill-content">
              <h4>Zero Hardcoding</h4>
              <p>Jaccard semantic discovery matches any academic subject dynamically.</p>
            </div>
          </div>
        </div>
      </div>

      <NewNoteModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
    </div>
  );
}
