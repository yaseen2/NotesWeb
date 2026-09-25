// src/components/navigation/Header.jsx - Refined, Professional Navigation Header

import React, { useMemo, useState } from 'react';
import { useReading } from '../../context/ReadingContext';
import { getVaultSubjects } from '../../utils/vaultManager';
import {
  BookOpen,
  Sun,
  Moon,
  Coffee,
  Search,
  ChevronDown,
  PanelLeft,
  PanelLeftClose,
  Edit3,
  Plus,
} from 'lucide-react';
import NewNoteModal from './NewNoteModal';

export default function Header() {
  const {
    theme,
    toggleTheme,
    workMode,
    setWorkMode,
    fontSize,
    setFontSize,
    columnMode,
    toggleColumnMode,
    viewMode,
    setViewMode,
    currentPdfPath,
    activeSubjectId,
    setActiveSubjectId,
    activeChapterId,
    setActiveChapterId,
    drawerOpen,
    setDrawerOpen,
    setSearchOpen,
    vaultOpen,
    setVaultOpen,
  } = useReading();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const subjects = useMemo(() => getVaultSubjects(), [activeSubjectId, activeChapterId]);
  const currentSubject = subjects.find((s) => s.id === activeSubjectId) || subjects[0] || { chapters: [] };
  const chapters = currentSubject.chapters || [];
  const currentChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0] || null;

  const handleFontSizeCycle = () => {
    if (fontSize === '14px') setFontSize('15.5px');
    else if (fontSize === '15.5px') setFontSize('17px');
    else setFontSize('14px');
  };

  const getThemeIcon = () => {
    if (theme === 'paper') return <Sun size={15} />;
    if (theme === 'sepia') return <Coffee size={15} />;
    return <Moon size={15} />;
  };

  const getThemeName = () => {
    if (theme === 'paper') return 'Paper';
    if (theme === 'sepia') return 'Sepia';
    return 'Dark';
  };

  return (
    <>
      <header className="app-header">
        {/* Left: Vault Toggle & Minimal Breadcrumbs */}
        <div className="header-left">
          <button
            className={`vault-toggle-btn ${vaultOpen ? 'active' : ''}`}
            onClick={() => setVaultOpen(!vaultOpen)}
            title="Toggle Vault Sidebar (Ctrl+B)"
            aria-label="Toggle Vault Sidebar"
          >
            {vaultOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          <div className="brand-group">
            <span className="brand-name">NotesWeb</span>
          </div>

          <div className="header-breadcrumbs">
            {subjects.length > 0 ? (
              <>
                {/* Subject Selector */}
                <div className="select-wrapper">
                  <select
                    value={currentSubject.id || ''}
                    onChange={(e) => {
                      const newSubId = e.target.value;
                      setActiveSubjectId(newSubId);
                      const subj = subjects.find((s) => s.id === newSubId);
                      if (subj && subj.chapters?.[0]) {
                        setActiveChapterId(subj.chapters[0].id);
                      } else {
                        setActiveChapterId('');
                      }
                    }}
                    className="header-select"
                    aria-label="Select Subject"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="select-arrow" />
                </div>

                <span className="header-crumb-sep">/</span>

                {/* Chapter Selector or Add Button */}
                {chapters.length > 0 ? (
                  <div className="select-wrapper">
                    <select
                      value={activeChapterId || ''}
                      onChange={(e) => setActiveChapterId(e.target.value)}
                      className="header-select"
                      aria-label="Select Note"
                    >
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="select-arrow" />
                  </div>
                ) : (
                  <button
                    className="header-inline-new-btn"
                    onClick={() => setIsNewModalOpen(true)}
                    title="Add a note to this subject"
                  >
                    <Plus size={13} />
                    <span>New Note</span>
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Center: Sleek Command Palette / Search Trigger */}
        <div className="header-center">
          <button
            className="header-search-bar"
            onClick={() => setSearchOpen(true)}
            title="Search notes, concepts, and topics (Ctrl+K)"
            aria-label="Search Vault"
          >
            <div className="search-bar-content">
              <Search size={14} className="search-bar-icon" />
              <span className="search-bar-text">Search notes or concepts...</span>
            </div>
            <kbd className="search-bar-kbd">Ctrl K</kbd>
          </button>
        </div>

        {/* Right: Refined, Minimalist Action Controls */}
        <div className="header-right">
          {/* Subtle Edit Action */}
          <button
            className={`header-icon-btn ${workMode === 'edit' ? 'active-mode' : ''}`}
            onClick={() => setWorkMode(workMode === 'read' ? 'edit' : 'read')}
            title={workMode === 'read' ? 'Edit LaTeX & Markdown source (Ctrl+E)' : 'Switch back to Reading View (Ctrl+E)'}
            aria-label="Toggle Read / Edit Mode"
          >
            {workMode === 'read' ? <Edit3 size={15} /> : <BookOpen size={15} />}
          </button>

          {/* Theme Switcher */}
          <button
            className="header-icon-btn"
            onClick={toggleTheme}
            title={`Theme: ${getThemeName()}`}
            aria-label="Toggle Theme"
          >
            {getThemeIcon()}
          </button>

          {/* Long Notes Context Drawer Button */}
          <button
            className={`header-context-btn ${drawerOpen ? 'active' : ''}`}
            onClick={() => setDrawerOpen(!drawerOpen)}
            title={drawerOpen ? 'Close Long Notes Context (ESC)' : 'Open Long Notes Context'}
            aria-label="Toggle Long Notes Context"
          >
            <BookOpen size={15} />
            <span>Long Notes</span>
          </button>
        </div>
      </header>

      {/* Note Creation Modal */}
      <NewNoteModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
    </>
  );
}

