// src/components/navigation/Header.jsx - Refined, Professional Navigation Header

import React from 'react';
import { useReading } from '../../context/ReadingContext';
import {
  BookOpen,
  Sun,
  Moon,
  Coffee,
  Search,
  PanelLeft,
  PanelLeftClose,
  Edit3,
} from 'lucide-react';

export default function Header() {
  const {
    theme,
    toggleTheme,
    workMode,
    setWorkMode,
    drawerOpen,
    setDrawerOpen,
    setSearchOpen,
    vaultOpen,
    setVaultOpen,
  } = useReading();

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
    <header className="app-header">
      {/* Left: Vault Toggle & Modern Brand Identity */}
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
          <div className="brand-icon-badge">
            <BookOpen size={14} className="brand-icon" />
          </div>
          <span className="brand-name">NotesWeb</span>
          <span className="brand-tag">REVISION</span>
        </div>
      </div>

      {/* Center: Sleek Command Palette / Global Search */}
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

      {/* Right: Refined Action Controls */}
      <div className="header-right">
        {/* Read / Edit Mode Switcher */}
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

        <div className="header-divider" />

        {/* Long Notes Context Drawer Button */}
        <button
          className={`header-context-btn ${drawerOpen ? 'active' : ''}`}
          onClick={() => setDrawerOpen(!drawerOpen)}
          title={drawerOpen ? 'Close Long Notes Context (Esc)' : 'Open Long Notes Context'}
          aria-label="Toggle Long Notes Context"
        >
          <BookOpen size={14} />
          <span>Long Notes</span>
          <span className={`drawer-indicator-dot ${drawerOpen ? 'open' : ''}`} />
        </button>
      </div>
    </header>
  );
}
