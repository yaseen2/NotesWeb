// src/components/reader/PdfNotesViewer.jsx - High-Performance Authentic PDF Reader with SVG Concept Layer
// Implements Chromium/Edge-grade architecture: Retina Canvas + SVG Vector Bounding Boxes + Edge-Style Popovers

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useReading } from '../../context/ReadingContext';
import { extractConceptBoundingBoxes } from '../../utils/pdfCoordinateExtractor';
import { getSavedAnnotations, findAnnotationByConceptOrPhrase } from '../../utils/annotationStorage';
import { getSavedHighlights } from '../../utils/highlightManager';
import { savePdfBlob } from '../../utils/db';
import { extractMarkdownTargets } from '../../utils/linkManager';
import EdgeConceptPopover from './EdgeConceptPopover';
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Printer,
  Download,
  AlertCircle,
  BookOpen,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  deleteChapter,
  updateChapterPdf,
  getVaultSubjects,
} from '../../utils/vaultManager';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfNotesViewer({ pdfUrl = null, layoutMode, setLayoutMode }) {
  const {
    openConcept,
    chapterConnections,
    theme,
    shortNotesData,
    shortNotesRaw,
    longNotesRaw,
    activeSubjectId,
    setActiveSubjectId,
    activeChapterId,
    setActiveChapterId,
    resetToZero,
    viewMode,
    setViewMode,
  } = useReading();

  const hoverIntentTimer = useRef(null);
  const hoverGraceTimer = useRef(null);

  // Clean up timer handles on unmount
  useEffect(() => {
    return () => {
      clearTimeout(hoverIntentTimer.current);
      clearTimeout(hoverGraceTimer.current);
    };
  }, []);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [renderedPages, setRenderedPages] = useState(0);

  // Edge-style popover state
  const [activePopoverTarget, setActivePopoverTarget] = useState(null);
  const activePopoverTargetRef = useRef(null);
  activePopoverTargetRef.current = activePopoverTarget;
  const isPinnedRef = useRef(false);

  const [savedAnnotations, setSavedAnnotations] = useState(() =>
    getSavedAnnotations(activeSubjectId, activeChapterId)
  );
  const savedAnnotationsRef = useRef(savedAnnotations);
  savedAnnotationsRef.current = savedAnnotations;

  const [savedHighlights, setSavedHighlights] = useState(() =>
    getSavedHighlights(activeSubjectId, activeChapterId)
  );

  // Click outside listener to dismiss popover when pinned
  useEffect(() => {
    if (!activePopoverTarget) return;

    const handlePointerDown = (e) => {
      if (e.target.closest('.edge-concept-popover')) return;
      if (e.target.closest('.pdf-concept-box')) return;

      clearTimeout(hoverIntentTimer.current);
      clearTimeout(hoverGraceTimer.current);
      isPinnedRef.current = false;
      setActivePopoverTarget(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activePopoverTarget]);

  useEffect(() => {
    setSavedAnnotations(getSavedAnnotations(activeSubjectId, activeChapterId));
    setSavedHighlights(getSavedHighlights(activeSubjectId, activeChapterId));

    const handleHighlightsUpdated = () => {
      const hls = getSavedHighlights(activeSubjectId, activeChapterId);
      setSavedHighlights(hls);
      if (pagesContainerRef.current) {
        const allRects = pagesContainerRef.current.querySelectorAll('.pdf-concept-box');
        allRects.forEach((r) => {
          const phrase = (r.getAttribute('data-phrase') || '').toLowerCase().trim();
          const match = hls.find((h) => (h.textQuote?.exact || '').toLowerCase().trim() === phrase);
          if (match) {
            r.classList.remove('highlight-amber', 'highlight-sage', 'highlight-lavender', 'highlight-rose', 'highlight-sky');
            r.classList.add('is-highlight', `highlight-${match.color}`);
            r.setAttribute('data-is-highlight', 'true');
            r.setAttribute('data-color', match.color);
            r.setAttribute('title', `Highlighted (${match.color}): "${r.getAttribute('data-phrase')}"`);
          } else if (r.getAttribute('data-is-highlight') === 'true') {
            r.classList.remove('is-highlight', 'highlight-amber', 'highlight-sage', 'highlight-lavender', 'highlight-rose', 'highlight-sky');
            r.removeAttribute('data-is-highlight');
            r.removeAttribute('data-color');
            r.setAttribute('title', `${r.getAttribute('data-phrase')} — Hover for Wikipedia preview, click for full context`);
          }
        });
      }
    };

    const handleAnnotationsUpdated = () => {
      const annots = getSavedAnnotations(activeSubjectId, activeChapterId);
      setSavedAnnotations(annots);
      savedAnnotationsRef.current = annots;

      if (pagesContainerRef.current) {
        const allRects = pagesContainerRef.current.querySelectorAll('.pdf-concept-box');
        allRects.forEach((r) => {
          const cid = r.getAttribute('data-concept-id');
          const phrase = r.getAttribute('data-phrase');
          const matched = findAnnotationByConceptOrPhrase(annots, cid, phrase);
          if (matched?.text?.trim()) {
            r.classList.add('has-user-comment');
            r.setAttribute('data-has-comment', 'true');
            r.setAttribute('title', `Note: "${matched.text}" — Click or hover to view`);
          } else {
            r.classList.remove('has-user-comment');
            r.removeAttribute('data-has-comment');
            r.setAttribute('title', `${phrase} — Click or hover for context`);
          }
        });
      }
    };

    window.addEventListener('notesweb-highlights-updated', handleHighlightsUpdated);
    window.addEventListener('notesweb-annotations-updated', handleAnnotationsUpdated);
    return () => {
      window.removeEventListener('notesweb-highlights-updated', handleHighlightsUpdated);
      window.removeEventListener('notesweb-annotations-updated', handleAnnotationsUpdated);
    };
  }, [activeSubjectId, activeChapterId]);

  const containerRef = useRef(null);
  const pagesContainerRef = useRef(null);
  const reuploadInputRef = useRef(null);

  const handleReuploadPdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    await savePdfBlob(activeChapterId, file);
    updateChapterPdf(activeSubjectId, activeChapterId, objUrl, file);
    window.location.reload();
  };

  const handleDeleteCurrentNote = () => {
    if (window.confirm('Delete this note from your vault?')) {
      deleteChapter(activeSubjectId, activeChapterId);
      const remaining = getVaultSubjects();
      const currentSub = remaining.find((s) => s.id === activeSubjectId);
      if (currentSub && currentSub.chapters && currentSub.chapters.length > 0) {
        setActiveChapterId(currentSub.chapters[0].id);
      } else if (remaining.length > 0) {
        setActiveSubjectId(remaining[0].id);
        setActiveChapterId(remaining[0].chapters?.[0]?.id || '');
      } else {
        resetToZero();
      }
    }
  };

  // Sync saved annotations when subject or chapter changes
  useEffect(() => {
    setSavedAnnotations(getSavedAnnotations(activeSubjectId, activeChapterId));
    setActivePopoverTarget(null);
  }, [activeSubjectId, activeChapterId]);

  // Extract markdown targets for Wikipedia-style contextual snippets
  const markdownTargets = useMemo(() => {
    return extractMarkdownTargets(longNotesRaw);
  }, [longNotesRaw]);

  // Extract concept phrases dynamically from connections, sections, and LaTeX bold tags
  const conceptList = useMemo(() => {
    const list = [];
    const seen = new Set();

    const addConcept = (id, phrase, targetSection = null, color = null, isHighlight = false) => {
      const p = (phrase || '').trim();
      const norm = p.toLowerCase();
      if (!p || p.length < 2) return;

      const existing = list.find((it) => it.phrase.toLowerCase() === norm);
      if (existing) {
        if (isHighlight) {
          existing.color = color;
          existing.isHighlight = true;
          existing.id = id;
        }
        return;
      }

      let snippet = '';
      let imageUrl = null;
      if (markdownTargets.length > 0) {
        const match = markdownTargets.find(
          (t) =>
            t.slug === targetSection ||
            t.cleanTitle.toLowerCase() === norm ||
            t.cleanTitle.toLowerCase().includes(norm) ||
            norm.includes(t.cleanTitle.toLowerCase())
        );
        if (match) {
          if (match.snippet) snippet = match.snippet;
          if (match.imageUrl) imageUrl = match.imageUrl;
        }
      }

      // Sentence search fallback: find the sentence in Long Notes mentioning this concept
      if (!snippet && longNotesRaw) {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
          const sentenceRegex = new RegExp(`([^.!?\\n]*?\\b${escaped}\\b[^.!?\\n]*?[.!?])`, 'i');
          const m = longNotesRaw.match(sentenceRegex);
          if (m && m[1]) {
            snippet = m[1].replace(/[*_#\\]/g, '').replace(/\s+/g, ' ').trim();
          }
        } catch (e) {}
      }

      list.push({
        id: id || norm.replace(/\s+/g, '-'),
        phrase: p,
        targetSection: targetSection || id || norm.replace(/\s+/g, '-'),
        snippet,
        imageUrl,
        color,
        isHighlight,
      });
    };

    // 1. W3C Saved Highlights (Top Priority)
    if (Array.isArray(savedHighlights)) {
      savedHighlights.forEach((hl) => {
        if (hl?.textQuote?.exact) {
          addConcept(hl.id, hl.textQuote.exact, hl.targetAnchorId || hl.id, hl.color, true);
        }
      });
    }

    // 2. User & Auto Chapter connections
    if (Array.isArray(chapterConnections)) {
      chapterConnections.forEach((conn) => {
        const id = conn.id || conn.conceptId;
        const targetSec = conn.targets?.[0]?.targetSectionId || conn.targetSection || id;
        const terms = conn.source?.terms || (conn.source?.text ? [conn.source.text] : (conn.title ? [conn.title] : []));
        const color = conn.color || null;
        terms.forEach((term) => addConcept(id, term, targetSec, color, Boolean(color)));
        if (conn.source?.text) addConcept(id, conn.source.text, targetSec, color, Boolean(color));
      });
    }

    // 3. Sections and subsections from parsed shortNotesData
    if (shortNotesData?.sections) {
      shortNotesData.sections.forEach((sec) => {
        if (sec.title) {
          const cleanTitle = sec.title.replace(/\s*\([^)]*\)/g, '').trim();
          addConcept(`sec-${sec.id}`, cleanTitle, sec.id);
          addConcept(`sec-${sec.id}-full`, sec.title, sec.id);
        }
        if (sec.takeaway?.title) {
          addConcept(`takeaway-${sec.id}`, sec.takeaway.title, sec.id);
        }
        if (Array.isArray(sec.subsections)) {
          sec.subsections.forEach((sub, sIdx) => {
            if (sub.title) {
              const cleanSub = sub.title.replace(/\s*\([^)]*\)/g, '').trim();
              addConcept(`sub-${sec.id}-${sIdx}`, cleanSub, sec.id);
            }
          });
        }
      });
    }

    // 4. LaTeX bold terms \textbf{...} in shortNotesRaw
    if (shortNotesRaw) {
      const boldRegex = /\\textbf\{([^{}]+)\}/g;
      let m;
      while ((m = boldRegex.exec(shortNotesRaw)) !== null) {
        const term = m[1].replace(/\\/g, '').replace(/[{}\\]/g, '').trim();
        if (term.length >= 3 && term.length <= 45 && !/^\d+$/.test(term)) {
          addConcept(`term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, term);
        }
      }
    }

    // 5. Saved Annotations & Personal Study Notes (matched by user selection phrase)
    if (savedAnnotations && typeof savedAnnotations === 'object') {
      Object.entries(savedAnnotations).forEach(([cId, annot]) => {
        if (annot?.phrase) {
          addConcept(cId, annot.phrase, cId);
        }
      });
    }

    return list;
  }, [chapterConnections, shortNotesData, shortNotesRaw, savedAnnotations, savedHighlights, markdownTargets]);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setRenderedPages(0);

    const targetUrl = pdfUrl;
    if (!targetUrl) {
      if (setViewMode) setViewMode('a4');
      return;
    }

    const loadingTask = pdfjsLib.getDocument({
      url: targetUrl,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/',
      cMapPacked: true,
    });

    loadingTask.promise
      .then((doc) => {
        if (isCancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Failed to load PDF:', err);
        setError(err.message || 'Failed to load PDF document.');
        setLoading(false);
      });

    return () => {
      isCancelled = true;
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  // Render individual page with Retina Canvas + SVG Vector Bounding Boxes + Invisible Text Layer
  const renderPage = useCallback(async (pageNum, pageContainer) => {
    if (!pdfDoc || !pageContainer) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      // High-DPI Retina scaling for crisp LaTeX typography
      const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);

      // Base A4 scale: PDF default is 72 dpi. A4 is 595.28 x 841.89 points.
      // Standard 96 dpi target width is 210mm (~793.7px). Scale ~1.3333
      const baseScale = 1.3333;
      const viewport = page.getViewport({ scale: baseScale });
      const renderViewport = page.getViewport({ scale: baseScale * pixelRatio });

      let canvas = pageContainer.querySelector('.pdf-page-canvas');
      let textLayerDiv = pageContainer.querySelector('.textLayer');

      if (!canvas || !textLayerDiv) {
        pageContainer.innerHTML = '';

        // 1. Authentic LaTeX Canvas Layer
        canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.className = 'pdf-page-canvas';
        pageContainer.appendChild(canvas);

        // 2. Pure Invisible Text Layer for Native Selection (Ctrl+C)
        textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer pdf-text-layer selectionRendering';
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
        textLayerDiv.style.setProperty('--total-scale-factor', `${viewport.scale}`);
        textLayerDiv.style.setProperty('--scale-round-x', '1px');
        textLayerDiv.style.setProperty('--scale-round-y', '1px');
        pageContainer.style.setProperty('--total-scale-factor', `${viewport.scale}`);
        pageContainer.style.setProperty('--scale-round-x', '1px');
        pageContainer.style.setProperty('--scale-round-y', '1px');
        pageContainer.appendChild(textLayerDiv);

        const renderContext = {
          canvasContext: ctx,
          viewport: renderViewport,
        };

        await page.render(renderContext).promise;

        // Render text layer (styled completely transparent in latex.css)
        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
        });
        await textLayer.render();

        // 3. Connect Mozilla's native DrawLayer for continuous, unified Edge-style selection
        try {
          if (pdfjsLib.DrawLayer) {
            const drawLayer = new pdfjsLib.DrawLayer({
              pageIndex: pageNum,
              textLayer: textLayerDiv,
            });
            drawLayer.setParent(pageContainer);
          }
        } catch (err) {
          console.warn('DrawLayer setup:', err);
        }
      }

      // 4. SVG Vector Bounding-Box Highlight Layer (Zero text, zero drift, sub-pixel fit)
      const existingSvg = pageContainer.querySelector('.pdf-svg-highlight-layer');
      if (existingSvg) existingSvg.remove();

      const conceptBoxes = await extractConceptBoundingBoxes(page, viewport, conceptList);

      const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgLayer.setAttribute('class', 'pdf-svg-highlight-layer');
      svgLayer.setAttribute('viewBox', `0 0 ${Math.floor(viewport.width)} ${Math.floor(viewport.height)}`);
      svgLayer.style.width = `${Math.floor(viewport.width)}px`;
      svgLayer.style.height = `${Math.floor(viewport.height)}px`;

      conceptBoxes.forEach((cb) => {
        const matchedAnnotation = findAnnotationByConceptOrPhrase(savedAnnotationsRef.current, cb.conceptId, cb.phrase);
        const hasNote = Boolean(matchedAnnotation?.text?.trim());
        const createdRects = [];

        cb.rects.forEach((rect) => {
          const rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rectEl.setAttribute('x', rect.x);
          rectEl.setAttribute('y', rect.y);
          rectEl.setAttribute('width', rect.width);
          rectEl.setAttribute('height', rect.height);
          rectEl.setAttribute('rx', '3');
          const isHighlight = Boolean(cb.isHighlight || cb.color);
          const highlightClass = cb.color ? `is-highlight highlight-${cb.color}` : (isHighlight ? 'is-highlight highlight-amber' : '');
          rectEl.setAttribute('class', `pdf-concept-box ${highlightClass} ${hasNote ? 'has-user-comment' : ''}`.trim());
          if (isHighlight) {
            rectEl.setAttribute('data-is-highlight', 'true');
            if (cb.color) rectEl.setAttribute('data-color', cb.color);
          }
          if (hasNote) {
            rectEl.setAttribute('data-has-comment', 'true');
          }
          rectEl.setAttribute('data-concept-id', cb.conceptId);
          rectEl.setAttribute('data-target-section', cb.targetSection);
          rectEl.setAttribute('data-phrase', cb.phrase);
          rectEl.setAttribute(
            'title',
            hasNote
              ? `Note: "${matchedAnnotation.text}" — Click or hover to view`
              : (isHighlight ? `Highlighted: "${cb.phrase}"` : `${cb.phrase} — Click or hover for context`)
          );

          createdRects.push(rectEl);
          svgLayer.appendChild(rectEl);
        });

        // Compute stable union bounding rect for all rects of this concept on this page
        const getAnchorRect = () => {
          let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          createdRects.forEach((el) => {
            const b = el.getBoundingClientRect();
            if (b.left < minLeft) minLeft = b.left;
            if (b.top < minTop) minTop = b.top;
            if (b.right > maxRight) maxRight = b.right;
            if (b.bottom > maxBottom) maxBottom = b.bottom;
          });
          if (minLeft === Infinity) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
          return {
            left: minLeft,
            top: minTop,
            right: maxRight,
            bottom: maxBottom,
            width: maxRight - minLeft,
            height: maxBottom - minTop,
          };
        };

        const triggerPopover = (isClick = false) => {
          clearTimeout(hoverIntentTimer.current);
          clearTimeout(hoverGraceTimer.current);

          if (isClick) {
            isPinnedRef.current = true;
          }

          // If already active for this exact concept, keep it steady without re-rendering
          if (activePopoverTargetRef.current?.conceptId === cb.conceptId) {
            return;
          }

          const r = getAnchorRect();
          setActivePopoverTarget({
            conceptId: cb.conceptId,
            targetSection: cb.targetSection,
            phrase: cb.phrase,
            snippet: cb.snippet || '',
            imageUrl: cb.imageUrl || null,
            rect: r,
          });
        };

        createdRects.forEach((rectEl) => {
          // 1. Direct Click (instant reveal and pinned)
          rectEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerPopover(true);
          });

          // 2. Debounced Hover Intent
          rectEl.addEventListener('mouseenter', () => {
            clearTimeout(hoverGraceTimer.current);

            // If already open for this exact concept, do not restart timers or recreate
            if (activePopoverTargetRef.current?.conceptId === cb.conceptId) {
              return;
            }

            clearTimeout(hoverIntentTimer.current);
            hoverIntentTimer.current = setTimeout(() => {
              triggerPopover(false);
            }, 180);
          });

          // 3. Grace Window on mouseleave with same-concept and popover protection
          rectEl.addEventListener('mouseleave', (e) => {
            clearTimeout(hoverIntentTimer.current);

            // If pinned by user click, stay open stably
            if (isPinnedRef.current) return;

            // If moving to another rect of the SAME concept or into the popover, don't dismiss
            const rel = e.relatedTarget;
            if (rel) {
              if (rel.closest && (rel.closest(`[data-concept-id="${cb.conceptId}"]`) || rel.closest('.edge-concept-popover'))) {
                return;
              }
            }

            clearTimeout(hoverGraceTimer.current);
            hoverGraceTimer.current = setTimeout(() => {
              if (!isPinnedRef.current) {
                setActivePopoverTarget(null);
              }
            }, 320);
          });
        });
      });

      pageContainer.appendChild(svgLayer);
    } catch (e) {
      console.error(`Error rendering page ${pageNum}:`, e);
    }
  }, [pdfDoc, conceptList]);

  // Render all pages whenever pdfDoc changes
  useEffect(() => {
    if (!pdfDoc || !pagesContainerRef.current) return;

    let isCancelled = false;

    async function renderAll() {
      const pageContainers = pagesContainerRef.current.querySelectorAll('.pdf-page-sheet-inner');
      for (let i = 0; i < pageContainers.length; i++) {
        if (isCancelled) break;
        await renderPage(i + 1, pageContainers[i]);
        if (!isCancelled) {
          setRenderedPages(i + 1);
        }
      }
    }

    renderAll();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, renderPage]);

  // Handle concept clicks on the SVG highlight layer
  const handleContainerClick = (e) => {
    const trigger = e.target.closest('.pdf-concept-box');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();

      const conceptId = trigger.getAttribute('data-concept-id');
      const targetSection = trigger.getAttribute('data-target-section');
      const phrase = trigger.getAttribute('data-phrase');
      const rect = trigger.getBoundingClientRect();

      setActivePopoverTarget({
        conceptId,
        targetSection,
        phrase,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      });
      return;
    }

    // Dismiss popover if clicking on canvas or background
    setActivePopoverTarget(null);
  };

  const handleZoomIn = () => setZoomPercent((prev) => Math.min(150, prev + 10));
  const handleZoomOut = () => setZoomPercent((prev) => Math.max(60, prev - 10));
  const handleZoomReset = () => setZoomPercent(100);

  return (
    <div className="a4-desk-canvas pdf-desk-canvas" onClick={handleContainerClick} ref={containerRef}>
      {/* Zen Floating Micro-Dock in Bottom-Right (Quiet & Distraction-Free) */}
      <div className="pdf-zen-dock" onClick={(e) => e.stopPropagation()}>
        <span className="pdf-zen-page-count">
          {numPages > 0 ? `${numPages} Pages` : 'Loading...'}
        </span>

        <div className="pdf-zen-divider" />

        <button
          className="pdf-zen-btn"
          onClick={() => window.print()}
          title="Print or Save PDF (Ctrl+P)"
          aria-label="Print PDF"
        >
          <Printer size={13} />
        </button>

        <div className="pdf-zen-divider" />

        <button
          className="pdf-zen-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
          disabled={zoomPercent <= 60}
          aria-label="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          className="pdf-zen-label-btn"
          onClick={handleZoomReset}
          title="Reset Zoom to 100%"
        >
          {zoomPercent}%
        </button>
        <button
          className="pdf-zen-btn"
          onClick={handleZoomIn}
          title="Zoom In"
          disabled={zoomPercent >= 150}
          aria-label="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="state-card loading-state pdf-loading-card">
          <Loader2 size={32} className="spin-icon" />
          <h3>Loading Compiled LaTeX PDF...</h3>
          <p>Mounting vector pages and attaching SVG concept anchors.</p>
        </div>
      )}

      {error && (
        <div className="state-card error-state pdf-error-card">
          <AlertCircle size={32} className="text-danger" />
          <h3>Could Not Load PDF</h3>
          <p>{error}</p>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="file"
              accept=".pdf"
              ref={reuploadInputRef}
              style={{ display: 'none' }}
              onChange={handleReuploadPdf}
            />
            <button
              className="btn btn-sm btn-primary"
              onClick={() => reuploadInputRef.current?.click()}
              title="Select local PDF for this note"
            >
              <Upload size={14} /> Attach / Re-select PDF
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleDeleteCurrentNote}
              title="Delete this note from vault"
            >
              <Trash2 size={14} /> Delete this Note
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                if (window.confirm('Clear entire vault and start fresh from zero?')) {
                  resetToZero();
                }
              }}
              title="Start fresh from zero"
            >
              Start from Zero
            </button>
          </div>
        </div>
      )}

      {/* Main Multi-Page PDF Container */}
      {!loading && !error && numPages > 0 && (
        <div
          ref={pagesContainerRef}
          className="a4-zoom-container pdf-zoom-container"
          style={{
            transform: zoomPercent !== 100 ? `scale(${zoomPercent / 100})` : 'none',
          }}
        >
          {Array.from({ length: numPages }, (_, idx) => (
            <article
              key={idx + 1}
              className="a4-page-sheet pdf-page-sheet"
              data-page-number={idx + 1}
              aria-label={`PDF Page ${idx + 1} of ${numPages}`}
            >
              <div className="pdf-page-sheet-inner" />
            </article>
          ))}
        </div>
      )}

      {/* Edge-Style Concept Popover (Anchored at exact word coordinates) */}
      {activePopoverTarget && (
        <EdgeConceptPopover
          activeTarget={activePopoverTarget}
          onClose={() => {
            isPinnedRef.current = false;
            setActivePopoverTarget(null);
          }}
          onMouseEnter={() => {
            clearTimeout(hoverGraceTimer.current);
          }}
          onMouseLeave={() => {
            if (!isPinnedRef.current) {
              clearTimeout(hoverGraceTimer.current);
              hoverGraceTimer.current = setTimeout(() => {
                if (!isPinnedRef.current) {
                  setActivePopoverTarget(null);
                }
              }, 320);
            }
          }}
          onOpenLongNotes={(conceptId, targetSection, evt, phrase) => {
            isPinnedRef.current = false;
            setActivePopoverTarget(null);
            openConcept(conceptId, targetSection, evt, phrase);
          }}
          subjectId={activeSubjectId}
          chapterId={activeChapterId}
          savedAnnotations={savedAnnotations}
          onAnnotationsChanged={(newAnnotations) => {
            setSavedAnnotations(newAnnotations);
            savedAnnotationsRef.current = newAnnotations;
            // Update classes on existing SVG rects across rendered pages
            if (pagesContainerRef.current) {
              const allRects = pagesContainerRef.current.querySelectorAll('.pdf-concept-box');
              allRects.forEach((r) => {
                const cid = r.getAttribute('data-concept-id');
                const phrase = r.getAttribute('data-phrase');
                const matched = findAnnotationByConceptOrPhrase(newAnnotations, cid, phrase);
                if (matched?.text?.trim()) {
                  r.classList.add('has-user-comment');
                  r.setAttribute('data-has-comment', 'true');
                  r.setAttribute('title', `Note: "${matched.text}" — Click or hover to view`);
                } else {
                  r.classList.remove('has-user-comment');
                  r.removeAttribute('data-has-comment');
                  r.setAttribute('title', `${phrase} — Click or hover for context`);
                }
              });
            }
          }}
        />
      )}
    </div>
  );
}
