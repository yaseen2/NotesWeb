import React, { useState, useEffect, useCallback } from 'react';
import { ReadingContext, useReading } from './useReading.js';
import { fetchChapterData } from '../utils/contentLoader.js';
import { parseLatexNotes } from '../utils/latexParser.js';
import {
  getChapterConnections,
  addOrUpdateConnection,
  removeConnection,
} from '../utils/linkManager.js';
import {
  getVaultSubjects,
  clearVaultToZero,
  restoreDefaultSeedVault,
  syncVaultWithIndexedDB,
} from '../utils/vaultManager.js';

export { useReading, ReadingContext };

export function ReadingProvider({ children }) {
  // Sync local data to high-capacity IndexedDB on mount
  useEffect(() => {
    syncVaultWithIndexedDB();
  }, []);

  // Theme: 'paper' | 'sepia' | 'dark'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('notesweb_theme') || 'paper';
  });

  // Font Size: 14px, 15.5px, 17px
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('notesweb_fontsize') || '15.5px';
  });

  // Column Mode: 'two-column' | 'single-column'
  const [columnMode, setColumnMode] = useState(() => {
    return localStorage.getItem('notesweb_column_mode') || 'two-column';
  });

  // View Mode: 'pdf' (Exact Compiled PDF) | 'a4' (Calibrated HTML A4 Sheet) | 'continuous'
  const [viewMode, setViewModeState] = useState(() => {
    return localStorage.getItem('notesweb_view_mode') || 'pdf';
  });

  const setViewMode = useCallback((mode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem('notesweb_view_mode', mode);
    } catch (e) {}
  }, []);

  // Work Mode: 'read' | 'edit'
  const [workMode, setWorkMode] = useState('read');

  // Active Subject & Chapter selection (with URL query params deep-linking)
  const [activeSubjectId, setActiveSubjectId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlSub = params.get('subject');
      if (urlSub) return urlSub;
    } catch (e) {}
    const subjects = getVaultSubjects();
    return subjects[0]?.id || '';
  });

  const [activeChapterId, setActiveChapterId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCh = params.get('chapter');
      if (urlCh) return urlCh;
    } catch (e) {}
    const subjects = getVaultSubjects();
    return subjects[0]?.chapters?.[0]?.id || '';
  });

  // Loaded Content State
  const [shortNotesRaw, setShortNotesRaw] = useState('');
  const [shortNotesData, setShortNotesData] = useState(null);
  const [longNotesRaw, setLongNotesRaw] = useState('');
  const [currentPdfPath, setCurrentPdfPath] = useState(null);
  const [chapterConnections, setChapterConnections] = useState([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [isUpcoming, setIsUpcoming] = useState(false);

  // Context Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeConcept, setActiveConcept] = useState(null);
  const [activeAnchor, setActiveAnchor] = useState(null);

  // Multi-Target Menu State (for concepts with multiple historical milestones)
  const [activeMultiTarget, setActiveMultiTarget] = useState(null);
  const [multiTargetPosition, setMultiTargetPosition] = useState(null);

  // Point-and-Click Connect Mode State
  const [connectSource, setConnectSource] = useState(null); // { text, side: 'short'|'long', snippet }

  // Search Modal
  const [searchOpen, setSearchOpen] = useState(false);

  // Vault Sidebar (Obsidian File Explorer)
  const [vaultOpen, setVaultOpen] = useState(false);

  // Sync theme to root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('notesweb_theme', theme);
  }, [theme]);

  // Sync column mode to localStorage
  useEffect(() => {
    localStorage.setItem('notesweb_column_mode', columnMode);
  }, [columnMode]);

  // Sync font size
  useEffect(() => {
    document.documentElement.style.setProperty('--text-base', fontSize);
    localStorage.setItem('notesweb_fontsize', fontSize);
  }, [fontSize]);

  // Sync subject, chapter, and activeAnchor to URL query params & hash
  useEffect(() => {
    if (!activeSubjectId && !activeChapterId) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (activeSubjectId) params.set('subject', activeSubjectId);
      if (activeChapterId) params.set('chapter', activeChapterId);
      const hash = activeAnchor ? `#${activeAnchor}` : (window.location.hash || '');
      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      window.history.replaceState(null, '', newUrl);
    } catch (e) {}
  }, [activeSubjectId, activeChapterId, activeAnchor]);

  // Dynamically load chapter content when subject or chapter changes
  useEffect(() => {
    let isCancelled = false;

    async function loadContent() {
      setContentLoading(true);
      setDrawerOpen(false);
      setActiveConcept(null);
      setActiveAnchor(null);
      setActiveMultiTarget(null);
      setConnectSource(null);

      if (!activeSubjectId || !activeChapterId) {
        setIsUpcoming(false);
        setShortNotesRaw('');
        setShortNotesData(null);
        setLongNotesRaw('');
        setCurrentPdfPath(null);
        setChapterConnections([]);
        setContentLoading(false);
        return;
      }

      const result = await fetchChapterData(activeSubjectId, activeChapterId);
      if (isCancelled) return;

      if (result.isUpcoming) {
        setIsUpcoming(true);
        setShortNotesRaw('');
        setShortNotesData(null);
        setLongNotesRaw('');
        setCurrentPdfPath(null);
        setChapterConnections([]);
      } else {
        setIsUpcoming(false);
        const conns = getChapterConnections(
          activeSubjectId,
          activeChapterId,
          result.shortNotesRaw,
          result.longNotesRaw
        );
        setShortNotesRaw(result.shortNotesRaw);
        setLongNotesRaw(result.longNotesRaw);
        setCurrentPdfPath(result.pdfPath);
        setChapterConnections(conns);

        const parsed = parseLatexNotes(result.shortNotesRaw, conns);
        setShortNotesData(parsed);

        if (result.pdfPath) {
          setViewMode('pdf');
        } else {
          setViewMode('a4');
        }

        if (window.location.hash) {
          const anchorFromHash = window.location.hash.replace(/^#/, '');
          if (anchorFromHash) {
            setTimeout(() => {
              setActiveAnchor(anchorFromHash);
              setDrawerOpen(true);
            }, 300);
          }
        }
      }

      setContentLoading(false);
    }

    loadContent();

    return () => {
      isCancelled = true;
    };
  }, [activeSubjectId, activeChapterId]);

  const resetToZero = useCallback(() => {
    clearVaultToZero();
    setActiveSubjectId('');
    setActiveChapterId('');
    setShortNotesRaw('');
    setShortNotesData(null);
    setLongNotesRaw('');
    setCurrentPdfPath(null);
    setChapterConnections([]);
  }, []);

  const restoreSampleVault = useCallback(() => {
    restoreDefaultSeedVault();
    const subjects = getVaultSubjects();
    if (subjects.length > 0) {
      setActiveSubjectId(subjects[0].id);
      setActiveChapterId(subjects[0].chapters?.[0]?.id || '');
    }
  }, []);

  // Re-parse short notes whenever chapterConnections change
  const refreshConnections = useCallback(() => {
    const conns = getChapterConnections(
      activeSubjectId,
      activeChapterId,
      shortNotesRaw,
      longNotesRaw
    );
    setChapterConnections(conns);
    if (shortNotesRaw) {
      const parsed = parseLatexNotes(shortNotesRaw, conns);
      setShortNotesData(parsed);
    }
  }, [activeSubjectId, activeChapterId, shortNotesRaw, longNotesRaw]);

  // Listen for ESC key to close drawer, search, or connect mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (connectSource) {
          setConnectSource(null);
        } else if (activeMultiTarget) {
          setActiveMultiTarget(null);
        } else if (searchOpen) {
          setSearchOpen(false);
        } else if (drawerOpen) {
          setDrawerOpen(false);
        } else if (vaultOpen) {
          setVaultOpen(false);
        }
      }
      // Ctrl+E / Cmd+E toggle Edit/Read mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setWorkMode((prev) => (prev === 'read' ? 'edit' : 'read'));
      }
      // Ctrl+B / Cmd+B toggle Vault Explorer Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setVaultOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectSource, activeMultiTarget, drawerOpen, searchOpen, vaultOpen]);

  // Open context drawer from concept trigger
  const openConcept = (conceptId, targetSection, clickEvent = null, customTerm = null) => {
    const conn = chapterConnections.find((c) => c.id === conceptId);

    // If concept has multiple targets, show multi-target choice popover
    if (conn && conn.targets && conn.targets.length > 1 && clickEvent) {
      const rect = clickEvent.target.getBoundingClientRect();
      setActiveMultiTarget(conn);
      setMultiTargetPosition({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(10, rect.left + window.scrollX - 40),
      });
      return;
    }

    const firstTarget = conn?.targets?.[0];
    const targetAnchorId = targetSection || firstTarget?.targetSectionId || conceptId;

    const displayTerm = customTerm ||
      conn?.source?.terms?.[0] ||
      conn?.source?.text ||
      (typeof conceptId === 'string'
        ? conceptId
            .replace(/^(texsec|mdbold|bold|sec)-[^-]+-[^-]+-/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())
        : 'Concept');

    const conceptData = {
      id: conceptId,
      terms: customTerm
        ? [customTerm]
        : (conn?.source?.terms || (conn?.source?.text ? [conn.source.text] : [displayTerm])),
      targetSection: targetAnchorId,
      summary: firstTarget?.summary || '',
      isUserCustom: conn && !conn.isBuiltin,
      connectionRecord: conn,
    };

    setActiveConcept(conceptData);
    setActiveAnchor(targetAnchorId);
    setDrawerOpen(true);
  };

  // Jump directly to a specific target from multi-target menu
  const selectMultiTarget = (target, conn) => {
    setActiveMultiTarget(null);
    const conceptData = {
      id: conn.id,
      terms: conn.source?.terms || [conn.source?.text],
      targetSection: target.targetSectionId,
      summary: target.summary || '',
      isUserCustom: !conn.isBuiltin,
      connectionRecord: conn,
    };
    setActiveConcept(conceptData);
    setActiveAnchor(target.targetSectionId);
    setDrawerOpen(true);
  };

  // Point-and-Click Connect Mode Actions
  const startConnectMode = (sourceText, side = 'short') => {
    setConnectSource({
      text: sourceText,
      side,
    });
    // Ensure drawer is open so user can click target on right
    if (!drawerOpen) {
      setDrawerOpen(true);
    }
  };

  const cancelConnectMode = () => {
    setConnectSource(null);
  };

  // Complete connection when target element is clicked
  const completeConnection = (target) => {
    if (!connectSource) return;

    const newConnection = {
      id: `user_conn_${Date.now()}`,
      isBuiltin: false,
      source: {
        text: connectSource.text,
        terms: [connectSource.text],
        side: connectSource.side,
      },
      targets: [
        {
          id: `target_${Date.now()}`,
          label: target.label || target.text?.substring(0, 36) || 'Linked Anchor',
          targetSectionId: target.targetSectionId || target.id,
          paragraphIndex: target.paragraphIndex,
          snippet: target.snippet || target.text?.substring(0, 120),
        },
      ],
    };

    addOrUpdateConnection(activeSubjectId, activeChapterId, newConnection);
    setConnectSource(null);
    refreshConnections();

    // Trigger visual feedback by opening to newly created link
    setActiveConcept({
      id: newConnection.id,
      terms: [connectSource.text],
      targetSection: newConnection.targets[0].targetSectionId,
      summary: newConnection.targets[0].snippet,
      isUserCustom: true,
      connectionRecord: newConnection,
    });
    setActiveAnchor(newConnection.targets[0].targetSectionId);
    setDrawerOpen(true);
  };

  // Delete a user-created connection
  const deleteConnection = (connectionId) => {
    removeConnection(activeSubjectId, activeChapterId, connectionId);
    if (activeConcept?.id === connectionId) {
      setActiveConcept(null);
    }
    setActiveMultiTarget(null);
    refreshConnections();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'paper') return 'sepia';
      if (prev === 'sepia') return 'dark';
      return 'paper';
    });
  };

  const toggleColumnMode = () => {
    setColumnMode((prev) => (prev === 'two-column' ? 'single-column' : 'two-column'));
  };

  return (
    <ReadingContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        fontSize,
        setFontSize,
        columnMode,
        setColumnMode,
        toggleColumnMode,
        viewMode,
        setViewMode,
        workMode,
        setWorkMode,
        activeSubjectId,
        setActiveSubjectId,
        activeChapterId,
        setActiveChapterId,
        shortNotesRaw,
        setShortNotesRaw,
        shortNotesData,
        longNotesRaw,
        setLongNotesRaw,
        currentPdfPath,
        chapterConnections,
        contentLoading,
        isUpcoming,
        drawerOpen,
        setDrawerOpen,
        activeConcept,
        activeAnchor,
        openConcept,
        closeDrawer,
        activeMultiTarget,
        multiTargetPosition,
        selectMultiTarget,
        closeMultiTargetMenu: () => setActiveMultiTarget(null),
        connectSource,
        startConnectMode,
        cancelConnectMode,
        completeConnection,
        deleteConnection,
        refreshConnections,
        searchOpen,
        setSearchOpen,
        vaultOpen,
        setVaultOpen,
        resetToZero,
        restoreSampleVault,
      }}
    >
      {children}
    </ReadingContext.Provider>
  );
}
