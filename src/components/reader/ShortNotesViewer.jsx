// src/components/reader/ShortNotesViewer.jsx - Universal Short Notes Reader
// Automatically routes to Authentic PDF Viewer (when PDF attached) or High-Precision A4 LaTeX Reader

import React, { useState, useMemo, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import { paginateIntoA4Pages } from '../../utils/a4Paginator';
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
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
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
    viewMode,
    setViewMode,
    activeSubjectId,
    setActiveSubjectId,
    activeChapterId,
    setActiveChapterId,
    restoreSampleVault,
  } = useReading();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const fileInputRef = useRef(null);

  // Intelligently paginate short notes into discrete A4 two-column pages for HTML mode
  const a4Pages = useMemo(() => {
    return paginateIntoA4Pages(shortNotesData);
  }, [shortNotesData]);

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

  const handleZoomIn = () => setZoomPercent((prev) => Math.min(150, prev + 10));
  const handleZoomOut = () => setZoomPercent((prev) => Math.max(60, prev - 10));
  const handleZoomReset = () => setZoomPercent(100);

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

    if (!targetSubjectId || subjects.length === 0) {
      const newSub = addCustomSubject({
        title: 'Uploaded Notes',
        code: 'PDF',
        description: 'User study collection',
      });
      targetSubjectId = newSub.id;
    }

    const res = addCustomChapter(targetSubjectId, {
      title: cleanTitle,
      subtitle: 'Original PDF Note',
      period: '',
      pdfPath: objectUrl,
      pdfFile: file,
      shortNotesRaw: '',
      longNotesRaw: '',
    });

    setActiveSubjectId(res.subject.id);
    setActiveChapterId(res.chapter.id);
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

  // 3. Exact PDF View: If a PDF is attached and viewMode is 'pdf'
  if (currentPdfPath && viewMode === 'pdf') {
    return <PdfNotesViewer pdfUrl={currentPdfPath} />;
  }

  // Helper to render subsection elements with grouped lists, tables, and quotes
  const renderSubElements = (elements, isA4 = true) => {
    if (!elements || elements.length === 0) return null;
    const rendered = [];
    let currentBulletList = [];
    let currentNumberedList = [];

    const flushLists = (keyPrefix) => {
      if (currentBulletList.length > 0) {
        rendered.push(
          <ul key={`ul-${keyPrefix}`} className={isA4 ? "a4-item-list" : "latex-item-list"}>
            {currentBulletList}
          </ul>
        );
        currentBulletList = [];
      }
      if (currentNumberedList.length > 0) {
        rendered.push(
          <ol key={`ol-${keyPrefix}`} className={isA4 ? "a4-enumerate-list" : "latex-enumerate-list"}>
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
              className={isA4 ? "a4-table-wrapper" : "latex-table-wrapper"}
              dangerouslySetInnerHTML={{ __html: el.content }}
            />
          );
        } else if (el.type === 'quote') {
          rendered.push(
            <blockquote
              key={`quote-${idx}`}
              className={isA4 ? "a4-quote" : "latex-quote"}
              dangerouslySetInnerHTML={{ __html: el.content }}
            />
          );
        } else if (el.type === 'subsubsection') {
          rendered.push(
            <h4 key={`h4-${idx}`} className={isA4 ? "a4-subsubsection-title" : "latex-subsubsection-title"}>
              {el.content}
            </h4>
          );
        } else if (el.type === 'paragraph') {
          rendered.push(
            <p
              key={`p-${idx}`}
              className={isA4 ? "a4-paragraph" : "latex-paragraph"}
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
  const renderSection = (section, secIdx = 0, isA4 = true) => (
    <section key={`${section.id || section.number}-${secIdx}`} className={isA4 ? "a4-section" : "latex-section"} id={section.id}>
      {!section.isContinuation && (
        <h2 className={isA4 ? "a4-section-title" : "latex-section-title"}>
          <span className={isA4 ? "a4-section-number" : "latex-section-number"}>{section.number}</span>
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
        <div key={sIdx} className={isA4 ? "a4-subsection" : "latex-subsection"}>
          {sub.title && (
            <h3 className={isA4 ? "a4-subsection-title" : "latex-subsection-title"}>
              {sub.number && <span className={isA4 ? "a4-sub-number" : "latex-sub-number"}>{sub.number} </span>}
              <span>{sub.title}</span>
            </h3>
          )}
          {renderSubElements(sub.elements, isA4)}
        </div>
      ))}
    </section>
  );

  // 4. If shortNotesData is available (LaTeX compiled view)
  if (shortNotesData && shortNotesData.sections && shortNotesData.sections.length > 0) {
    return (
      <div className="a4-desk-canvas" onClick={handleContainerClick}>
        {/* Floating Desk Toolbar */}
        <div className="a4-floating-toolbar">
          <div className="a4-toolbar-badge" title="LaTeX Document Class: article (10pt, a4paper, twocolumn, margin=0.5in)">
            <FileText size={13} />
            <span>A4 Twocolumn (10pt • 0.5in margin)</span>
          </div>

          <span className="a4-toolbar-badge">
            {a4Pages.length} {a4Pages.length === 1 ? 'Page' : 'Pages'}
          </span>

          <div className="a4-toolbar-divider" />

          {currentPdfPath && (
            <button
              className={`a4-toolbar-btn ${viewMode === 'pdf' ? 'active' : ''}`}
              onClick={() => setViewMode('pdf')}
              title="Exact 100% Compiled LaTeX PDF"
            >
              <FileCheck size={13} />
              <span>Exact PDF</span>
            </button>
          )}

          <button
            className={`a4-toolbar-btn ${viewMode === 'a4' || !currentPdfPath ? 'active' : ''}`}
            onClick={() => setViewMode('a4')}
            title="Render as calibrated HTML A4 sheets"
          >
            <FileText size={13} />
            <span>Web (A4)</span>
          </button>

          <button
            className={`a4-toolbar-btn ${viewMode === 'continuous' ? 'active' : ''}`}
            onClick={() => setViewMode('continuous')}
            title="Switch to continuous scrolling view"
          >
            <BookOpen size={13} />
            <span>Continuous</span>
          </button>

          <div className="a4-toolbar-divider" />

          {/* Zoom Controls */}
          <div className="a4-zoom-group">
            <button
              className="a4-zoom-btn"
              onClick={handleZoomOut}
              title="Zoom Out"
              disabled={zoomPercent <= 60}
            >
              <ZoomOut size={12} />
            </button>
            <span className="a4-zoom-label">{zoomPercent}%</span>
            <button
              className="a4-zoom-btn"
              onClick={handleZoomIn}
              title="Zoom In"
              disabled={zoomPercent >= 150}
            >
              <ZoomIn size={12} />
            </button>
            {zoomPercent !== 100 && (
              <button
                className="a4-zoom-btn"
                onClick={handleZoomReset}
                title="Reset Zoom to 100%"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>

          <div className="a4-toolbar-divider" />

          <button
            className="a4-toolbar-btn"
            onClick={() => window.print()}
            title="Print or Save as exact A4 PDF (Ctrl+P)"
          >
            <Printer size={13} />
            <span>Print / PDF</span>
          </button>
        </div>

        {/* Content Render */}
        {viewMode !== 'continuous' ? (
          <div
            className="a4-zoom-container"
            style={{
              transform: zoomPercent !== 100 ? `scale(${zoomPercent / 100})` : 'none',
            }}
          >
            {a4Pages.map((page, pIdx) => (
              <article
                key={page.pageNumber || pIdx}
                className="a4-page-sheet"
                data-page-number={page.pageNumber}
                aria-label={`A4 Page ${page.pageNumber}`}
              >
                <div className="a4-page-inner">
                  {page.isFirstPage && (
                    <header className="a4-title-header">
                      <h1 className="a4-main-title">{page.title}</h1>
                      {page.subtitle && <p className="a4-subtitle">{page.subtitle}</p>}
                    </header>
                  )}

                  <div className={`a4-columns-body ${columnMode}`}>
                    {page.sections.map((section, sIdx) => renderSection(section, sIdx, true))}
                  </div>
                </div>

                <footer className="a4-page-footer">
                  <span className="a4-page-number">{page.pageNumber}</span>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <article
            className="latex-document"
            style={{
              transform: zoomPercent !== 100 ? `scale(${zoomPercent / 100})` : 'none',
              transformOrigin: 'top center',
            }}
            aria-label="LaTeX Short Revision Notes"
          >
            <header className="latex-title-header">
              <h1 className="latex-main-title">{shortNotesData.title}</h1>
              {shortNotesData.subtitle && (
                <p className="latex-subtitle">{shortNotesData.subtitle}</p>
              )}
            </header>

            <div className={`latex-body ${columnMode}`}>
              {shortNotesData.sections.map((section, sIdx) => renderSection(section, sIdx, false))}
            </div>
          </article>
        )}
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
