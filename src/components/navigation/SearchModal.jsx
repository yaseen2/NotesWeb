// src/components/navigation/SearchModal.jsx - Fast Client-side Cross-Subject Search (100% User Vault Driven)

import React, { useState, useEffect, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import { getVaultSubjects } from '../../utils/vaultManager';
import { getAllConnections } from '../../utils/linkManager';
import { Search, X, Sparkles, BookOpen, FileText } from 'lucide-react';

function extractSnippetAroundMatch(rawText, matchIndex, matchLength, maxChars = 110) {
  if (!rawText || matchIndex < 0) return '';
  const half = Math.floor(maxChars / 2);
  const start = Math.max(0, matchIndex - half);
  const end = Math.min(rawText.length, matchIndex + matchLength + half);
  let snippet = rawText.slice(start, end).replace(/\r?\n+/g, ' ');
  snippet = snippet
    .replace(/\\(text[a-z]+|textit|textbf|emph|large|huge|section|subsection)\{([^}]*)\}/g, '$2')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[*_#`~{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < rawText.length) snippet = snippet + '…';
  return snippet;
}

export default function SearchModal() {
  const {
    searchOpen,
    setSearchOpen,
    openConcept,
    setActiveSubjectId,
    setActiveChapterId,
    activeSubjectId,
    activeChapterId,
  } = useReading();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsListRef = useRef(null);

  const vaultSubjects = getVaultSubjects();
  const allConnections = getAllConnections();

  // Index chapters & subjects
  const indexedChapters = vaultSubjects.flatMap((sub) =>
    (sub.chapters || []).map((ch) => ({
      type: 'chapter',
      id: ch.id,
      title: ch.title,
      subtitle: ch.subtitle || ch.period || '',
      subjectId: sub.id,
      chapterId: ch.id,
      subjectTitle: sub.title,
      chapterTitle: ch.title,
    }))
  );

  // Index user concept links
  const indexedConcepts = Object.entries(allConnections).flatMap(([key, conns]) => {
    const [subId, chId] = key.split('/');
    const subject = vaultSubjects.find((s) => s.id === subId);
    const chapter = subject?.chapters?.find((c) => c.id === chId);

    return (conns || []).map((conn) => {
      const term = conn.source?.text || (conn.source?.terms && conn.source.terms[0]) || 'Concept';
      const targetSec = conn.targets?.[0]?.targetSectionId || '';
      const snippet = conn.targets?.[0]?.snippet || '';
      return {
        type: 'concept',
        id: conn.id,
        term,
        targetSection: targetSec,
        summary: snippet || `Linked to #${targetSec}`,
        subjectId: subId,
        chapterId: chId,
        subjectTitle: subject?.title || subId,
        chapterTitle: chapter?.title || chId,
      };
    });
  });

  // Deep index sections & topics with contextual snippet extraction
  const indexedContent = vaultSubjects.flatMap((sub) =>
    (sub.chapters || []).flatMap((ch) => {
      const results = [];
      const shortRaw = ch.shortNotesRaw || '';
      const longRaw = ch.longNotesRaw || '';

      // 1. Extract LaTeX sections (\section{...} & \subsection{...})
      const secRegex = /\\(sub)?section\{([^}]+)\}/g;
      let m;
      while ((m = secRegex.exec(shortRaw)) !== null) {
        const title = m[2].replace(/\\/g, '').trim();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const contextSnippet = extractSnippetAroundMatch(shortRaw, m.index + m[0].length, 80);
        results.push({
          type: 'topic',
          id: `sec-${sub.id}-${ch.id}-${slug}`,
          term: title,
          targetSection: slug,
          summary: contextSnippet || `Section in ${ch.title}`,
          subjectId: sub.id,
          chapterId: ch.id,
          subjectTitle: sub.title,
          chapterTitle: ch.title,
        });
      }

      // 2. Extract Markdown headers from Long Notes (# Header)
      const mdHeadingRegex = /^#{1,4}\s+([^\n]+)/gm;
      let hm;
      while ((hm = mdHeadingRegex.exec(longRaw)) !== null) {
        const cleanTitle = hm[1].replace(/[*_#\\]/g, '').trim();
        if (cleanTitle.length > 2 && !results.some((r) => r.term.toLowerCase() === cleanTitle.toLowerCase())) {
          const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const contextSnippet = extractSnippetAroundMatch(longRaw, hm.index + hm[0].length, 80);
          results.push({
            type: 'topic',
            id: `md-${sub.id}-${ch.id}-${slug}`,
            term: cleanTitle,
            targetSection: slug,
            summary: contextSnippet || `Context topic in ${ch.title}`,
            subjectId: sub.id,
            chapterId: ch.id,
            subjectTitle: sub.title,
            chapterTitle: ch.title,
          });
        }
      }

      // 3. Extract key terms from LaTeX \textbf{...}
      const boldRegex = /\\textbf\{([^{}]+)\}/g;
      let bm;
      while ((bm = boldRegex.exec(shortRaw)) !== null) {
        const term = bm[1].replace(/\\/g, '').trim();
        if (term.length >= 3 && term.length <= 40 && !/^\d+$/.test(term) && !results.some((r) => r.term.toLowerCase() === term.toLowerCase())) {
          const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const contextSnippet = extractSnippetAroundMatch(shortRaw, bm.index, bm[0].length);
          results.push({
            type: 'concept',
            id: `bold-${sub.id}-${ch.id}-${slug}`,
            term,
            targetSection: slug,
            summary: contextSnippet || `Key term in ${ch.title}`,
            subjectId: sub.id,
            chapterId: ch.id,
            subjectTitle: sub.title,
            chapterTitle: ch.title,
          });
        }
      }

      // 4. Extract key terms from Markdown bold (**...**)
      const mdBoldRegex = /\*\*([^*\n]{3,40})\*\*/g;
      let mbm;
      while ((mbm = mdBoldRegex.exec(longRaw)) !== null) {
        const term = mbm[1].replace(/\\/g, '').trim();
        if (term.length >= 3 && !/^\d+[\.\)]?$/.test(term) && !results.some((r) => r.term.toLowerCase() === term.toLowerCase())) {
          const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const contextSnippet = extractSnippetAroundMatch(longRaw, mbm.index, mbm[0].length);
          results.push({
            type: 'concept',
            id: `mdbold-${sub.id}-${ch.id}-${slug}`,
            term,
            targetSection: slug,
            summary: contextSnippet || `Key concept in ${ch.title}`,
            subjectId: sub.id,
            chapterId: ch.id,
            subjectTitle: sub.title,
            chapterTitle: ch.title,
          });
        }
      }

      return results;
    })
  );

  const allIndexedItems = [...indexedChapters, ...indexedConcepts, ...indexedContent];

  // Auto-focus input when modal opens & reset query
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [searchOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchOpen]);

  // Filter items based on query
  const filteredItems = query.trim()
    ? allIndexedItems.filter((item) => {
        const q = query.toLowerCase();
        if (item.type === 'chapter') {
          return (
            item.title.toLowerCase().includes(q) ||
            item.subjectTitle.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
          );
        }
        return (
          item.term.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.subjectTitle.toLowerCase().includes(q) ||
          item.chapterTitle.toLowerCase().includes(q)
        );
      })
    : allIndexedItems.slice(0, 12);

  // Reset selectedIndex when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (resultsListRef.current) {
      const selectedEl = resultsListRef.current.querySelector('.search-result-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item) => {
    setSearchOpen(false);

    if (item.type === 'chapter') {
      setActiveSubjectId(item.subjectId);
      setActiveChapterId(item.chapterId);
      return;
    }

    // Concept or Topic item
    if (item.subjectId !== activeSubjectId || item.chapterId !== activeChapterId) {
      setActiveSubjectId(item.subjectId);
      setActiveChapterId(item.chapterId);
      setTimeout(() => {
        openConcept(item.id, item.targetSection, null, item.term);
      }, 350);
    } else {
      openConcept(item.id, item.targetSection, null, item.term);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, filteredItems.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
    }
  };

  if (!searchOpen) return null;

  return (
    <div className="search-backdrop" onClick={() => setSearchOpen(false)}>
      <div
        className="search-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search Concepts and Notes"
      >
        {/* Search Input Bar */}
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search across notes, concepts, and chapters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-autocomplete="list"
          />
          {query && (
            <button className="search-clear-btn" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
          <span className="search-esc-hint">ESC to close</span>
        </div>

        {/* Results List */}
        <div className="search-results-list" ref={resultsListRef}>
          {filteredItems.length === 0 ? (
            <div className="search-empty">
              <p>{query ? `No notes or concepts matching "${query}"` : 'Vault is empty. Add a note to start searching.'}</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={`${item.subjectId}-${item.chapterId}-${item.id}`}
                className={`search-result-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelect(item);
                }}
              >
                <div className="result-header">
                  <div className="result-title-group">
                    {item.type === 'chapter' ? (
                      <FileText size={14} className="result-sparkle" />
                    ) : item.type === 'topic' ? (
                      <BookOpen size={14} className="result-sparkle" />
                    ) : (
                      <Sparkles size={14} className="result-sparkle" />
                    )}
                    <span className="result-title">{item.type === 'chapter' ? item.title : item.term}</span>
                  </div>
                  <span className="result-badge">
                    <BookOpen size={11} />
                    <span>{item.subjectTitle}</span>
                  </span>
                </div>
                {item.type === 'chapter' ? (
                  <p className="result-summary">{item.subtitle || 'Study Chapter'}</p>
                ) : (
                  <p className="result-summary">{item.summary}</p>
                )}
                <div className="result-meta">
                  {item.type === 'concept' && <span className="result-anchor-tag">#{item.targetSection}</span>}
                  <span className="result-chapter-tag">• {item.chapterTitle}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
