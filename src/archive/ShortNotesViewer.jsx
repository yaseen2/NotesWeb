import React, { useState, useMemo } from 'react';
import { useReading } from '../../context/ReadingContext';
import { paginateIntoA4Pages } from '../../utils/a4Paginator';
import PdfNotesViewer from './PdfNotesViewer';
import {
  Columns2,
  Square,
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
} from 'lucide-react';
import NewNoteModal from '../navigation/NewNoteModal';

export default function ShortNotesViewer() {
  const {
    columnMode,
    toggleColumnMode,
    openConcept,
    shortNotesData,
    currentPdfPath,
    contentLoading,
    isUpcoming,
    viewMode,
    setViewMode,
  } = useReading();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  // Intelligently paginate short notes into discrete A4 two-column pages
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

  const handleZoomIn = () => {
    setZoomPercent((prev) => Math.min(150, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomPercent((prev) => Math.max(60, prev - 10));
  };

  const handleZoomReset = () => {
    setZoomPercent(100);
  };

  if (contentLoading) {
    return (
      <div className="state-card loading-state">
        <Loader2 size={32} className="spin-icon" />
        <h3>Loading Revision Notes...</h3>
        <p>Parsing sections, takeaways, and concept anchors in real time.</p>
      </div>
    );
  }

  if (isUpcoming) {
    return (
      <div className="state-card upcoming-state">
        <Clock size={36} className="clock-icon" />
        <h3>Chapter Notes In Progress</h3>
        <p>This chapter's LaTeX short notes and contextual background are currently being prepared.</p>
      </div>
    );
  }

  if (!shortNotesData) {
    return (
      <>
        <div className="empty-vault-hero-card">
          <div className="empty-vault-icon-circle">
            <UploadCloud size={40} className="empty-vault-icon" />
          </div>
          <h2 className="empty-vault-title">Your Study Vault is Empty</h2>
          <p className="empty-vault-desc">
            NotesWeb is 100% user-driven. Drag &amp; drop any LaTeX <code>.tex</code> revision note anywhere on this screen, or click below to convert your first note.
          </p>
          <div className="empty-vault-actions">
            <button
              className="btn btn-primary empty-vault-btn"
              onClick={() => setIsNewModalOpen(true)}
            >
              <UploadCloud size={16} />
              <span>Upload &amp; Convert .tex Note</span>
            </button>
            <button
              className="btn btn-outline empty-vault-btn"
              onClick={() => setIsNewModalOpen(true)}
            >
              <Plus size={16} />
              <span>Create Note from Scratch</span>
            </button>
          </div>
          <div className="empty-vault-features">
            <div className="vault-feature-item">
              <Sparkles size={14} />
              <span>Exact A4 Two-Column Page Layout (0.5in margin)</span>
            </div>
            <div className="vault-feature-item">
              <Sparkles size={14} />
              <span>Automatic <code>tcolorbox</code> revision cards</span>
            </div>
            <div className="vault-feature-item">
              <Sparkles size={14} />
              <span>KaTeX math equations &amp; LaTeX tables</span>
            </div>
          </div>
        </div>
        <NewNoteModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
      </>
    );
  }

  // Helper to render subsection elements with grouped <ul> items, <ol> items, tables, and quotes
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
      {/* Section Heading - only render if not a continuation from previous page */}
      {!section.isContinuation && (
        <h2 className={isA4 ? "a4-section-title" : "latex-section-title"}>
          <span className={isA4 ? "a4-section-number" : "latex-section-number"}>{section.number}</span>
          <span>{section.title}</span>
        </h2>
      )}

      {/* tcolorbox Takeaway Card */}
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

      {/* Subsections, paragraphs, subsubsections and bullet lists */}
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

  // Render precompiled PDF only if mode is 'pdf' and PDF file actually exists
  if (viewMode === 'pdf' && currentPdfPath) {
    return (
      <PdfNotesViewer
        pdfUrl={currentPdfPath}
      />
    );
  }

  return (
    <div className="a4-desk-canvas" onClick={handleContainerClick}>
      {/* A4 Desk Floating Control Bar */}
      <div className="a4-floating-toolbar">
        <div className="a4-toolbar-badge" title="LaTeX Document Class: article (10pt, a4paper, twocolumn, margin=0.5in)">
          <FileText size={13} />
          <span>A4 Twocolumn (10pt • 0.5in margin)</span>
        </div>

        <span className="a4-toolbar-badge">
          {a4Pages.length} {a4Pages.length === 1 ? 'Page' : 'Pages'}
        </span>

        <div className="a4-toolbar-divider" />

        {/* View Mode Toggle: Exact PDF (if available) vs A4 Pages vs Continuous */}
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

        {/* Print / Save to PDF */}
        <button
          className="a4-toolbar-btn"
          onClick={() => window.print()}
          title="Print or Save as exact A4 PDF (Ctrl+P)"
        >
          <Printer size={13} />
          <span>Print / PDF</span>
        </button>
      </div>

      {/* Main Content Render */}
      {viewMode !== 'continuous' ? (
        /* A4 Multi-Page Layout */
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
                {/* Title on Page 1 (matches LaTeX \maketitle) */}
                {page.isFirstPage && (
                  <header className="a4-title-header">
                    <h1 className="a4-main-title">{page.title}</h1>
                    {page.subtitle && <p className="a4-subtitle">{page.subtitle}</p>}
                  </header>
                )}

                {/* Two-Column Flow Body */}
                <div className={`a4-columns-body ${columnMode}`}>
                  {page.sections.map((section, sIdx) => renderSection(section, sIdx, true))}
                </div>
              </div>

              {/* Centered Page Number Footer */}
              <footer className="a4-page-footer">
                <span className="a4-page-number">{page.pageNumber}</span>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        /* Continuous Mode Fallback */
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
