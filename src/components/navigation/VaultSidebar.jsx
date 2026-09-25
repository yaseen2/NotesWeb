// src/components/navigation/VaultSidebar.jsx - Collapsible Obsidian-style Study Vault Explorer

import React, { useState, useMemo } from 'react';
import { useReading } from '../../context/ReadingContext';
import {
  getVaultSubjects,
  deleteChapter,
  deleteSubject,
  exportFullVaultData,
  importFullVaultData,
} from '../../utils/vaultManager';
import { getAllConnections } from '../../utils/linkManager';
import {
  FolderTree,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Download,
  Upload,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Sparkles,
  Link as LinkIcon,
  Trash2,
  Shield,
  Lock,
} from 'lucide-react';
import NewNoteModal from './NewNoteModal';
import VaultSecurityModal from './VaultSecurityModal';

export default function VaultSidebar({ isOpen, onClose }) {
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const {
    activeSubjectId,
    setActiveSubjectId,
    activeChapterId,
    setActiveChapterId,
    workMode,
    setWorkMode,
    resetToZero,
    restoreSampleVault,
  } = useReading();

  const [filterQuery, setFilterQuery] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [vaultVersion, setVaultVersion] = useState(0);

  const subjects = useMemo(() => getVaultSubjects(), [isOpen, isNewModalOpen, vaultVersion, activeSubjectId, activeChapterId]);
  const allConnections = useMemo(() => getAllConnections(), [isOpen, vaultVersion]);

  // Compute total connection links count across vault
  const totalConnectionCount = useMemo(() => {
    let count = 0;
    Object.values(allConnections).forEach((chapConns) => {
      if (Array.isArray(chapConns)) count += chapConns.length;
    });
    return count;
  }, [allConnections]);

  const handleDeleteSubject = (subId, subTitle) => {
    if (window.confirm(`Delete subject "${subTitle}" and all its notes?`)) {
      deleteSubject(subId);
      const remaining = getVaultSubjects();
      if (remaining.length === 0) {
        resetToZero();
      } else if (activeSubjectId === subId) {
        setActiveSubjectId(remaining[0]?.id || '');
        setActiveChapterId(remaining[0]?.chapters?.[0]?.id || '');
      }
      setVaultVersion((v) => v + 1);
    }
  };

  const handleDeleteChapter = (subId, chId, chTitle) => {
    if (window.confirm(`Delete note "${chTitle}"?`)) {
      deleteChapter(subId, chId);
      const remaining = getVaultSubjects();
      const currentSub = remaining.find((s) => s.id === subId);
      if (activeChapterId === chId) {
        setActiveChapterId(currentSub?.chapters?.[0]?.id || '');
      }
      setVaultVersion((v) => v + 1);
    }
  };

  const handleClearAllToZero = () => {
    if (window.confirm('Start from zero? This will completely empty your vault so you can add your own notes from scratch.')) {
      resetToZero();
      setVaultVersion((v) => v + 1);
    }
  };

  const handleRestoreSample = () => {
    restoreSampleVault();
    setVaultVersion((v) => v + 1);
  };

  const toggleFolder = (subId) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [subId]: !prev[subId],
    }));
  };

  // Filtered tree based on search query
  const filteredSubjects = useMemo(() => {
    if (!filterQuery.trim()) return subjects;
    const q = filterQuery.toLowerCase();
    return subjects
      .map((s) => {
        const matchesSubject =
          s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
        const matchingChapters = s.chapters.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            (c.subtitle && c.subtitle.toLowerCase().includes(q))
        );
        if (matchesSubject || matchingChapters.length > 0) {
          return {
            ...s,
            chapters: matchesSubject ? s.chapters : matchingChapters,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [subjects, filterQuery]);

  // Export full vault JSON
  const handleExportVault = () => {
    const data = exportFullVaultData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notesweb_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import vault JSON
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = importFullVaultData(event.target.result);
        if (result.success) {
          setImportStatus('Vault imported successfully! Reloading...');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          alert('Failed to import vault: ' + result.error);
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectChapter = (subId, chId, isUpcoming) => {
    if (isUpcoming) return;
    setActiveSubjectId(subId);
    setActiveChapterId(chId);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && <div className="vault-sidebar-backdrop" onClick={onClose} />}

      <aside className={`vault-sidebar ${isOpen ? 'open' : ''}`} aria-label="Study Vault Explorer">
        {/* Header: Quiet Obsidian-style workspace header */}
        <div className="vault-sidebar-header">
          <div className="vault-title-wrap">
            <span className="vault-section-title">VAULT</span>
            <span className="vault-note-counter">
              {subjects.reduce((acc, s) => acc + (s.chapters?.length || 0), 0)}
            </span>
          </div>
          <div className="vault-header-actions">
            <button
              className="vault-ghost-btn"
              onClick={() => setIsNewModalOpen(true)}
              title="New Note (or upload PDF)"
              aria-label="New Note"
            >
              <Plus size={15} />
            </button>
            <button
              className="vault-ghost-btn"
              onClick={onClose}
              title="Close Sidebar (Ctrl+B)"
              aria-label="Close Sidebar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Minimal Search Input */}
        <div className="vault-search-box">
          <Search size={13} className="vault-search-icon" />
          <input
            type="text"
            className="vault-search-input"
            placeholder="Search notes..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              className="vault-clear-search"
              onClick={() => setFilterQuery('')}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Tree View of Subjects and Chapters */}
        <div className="vault-tree-container">
          {filteredSubjects.length === 0 ? (
            <div className="vault-empty-search">
              <FolderOpen size={24} className="vault-empty-icon" />
              <p className="vault-empty-title">No notes in vault</p>
              <p className="vault-empty-sub">
                Drop any .pdf into the workspace or create a note.
              </p>
              <div className="vault-empty-actions">
                <button
                  className="vault-empty-action-btn"
                  onClick={() => setIsNewModalOpen(true)}
                >
                  <Plus size={13} /> New Note
                </button>
                <button
                  className="vault-empty-secondary-btn"
                  onClick={handleRestoreSample}
                >
                  Restore sample note
                </button>
              </div>
            </div>
          ) : (
            filteredSubjects.map((sub) => {
              const isCollapsed = !!collapsedFolders[sub.id];
              const isCurrentSubject = sub.id === activeSubjectId;

              return (
                <div key={sub.id} className="vault-subject-node">
                  {/* Subject Folder Row */}
                  <div
                    className={`vault-folder-row ${isCurrentSubject ? 'active-subject' : ''}`}
                    onClick={() => toggleFolder(sub.id)}
                  >
                    <span className="vault-chevron">
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </span>
                    <span className="vault-folder-icon">
                      {isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
                    </span>
                    <span className="vault-folder-name" title={sub.title}>
                      {sub.title}
                    </span>
                    <button
                      className="vault-item-delete-btn"
                      title="Delete subject and notes"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubject(sub.id, sub.title);
                      }}
                      aria-label="Delete subject"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Notes List inside Subject */}
                  {!isCollapsed && (
                    <div className="vault-chapters-list">
                      {sub.chapters.map((ch) => {
                        const isActive =
                          isCurrentSubject && ch.id === activeChapterId;
                        const key = `${sub.id}/${ch.id}`;
                        const connsCount = allConnections[key]?.length || 0;

                        return (
                          <div
                            key={ch.id}
                            className={`vault-file-row ${isActive ? 'active-file' : ''} ${ch.isUpcoming ? 'upcoming' : ''}`}
                            onClick={() =>
                              handleSelectChapter(sub.id, ch.id, ch.isUpcoming)
                            }
                            title={ch.title}
                          >
                            <FileText size={13} className="vault-file-icon" />
                            <div className="vault-file-text-wrap">
                              <span className="vault-file-name">{ch.title}</span>
                              {ch.period && (
                                <span className="vault-file-period">{ch.period}</span>
                              )}
                            </div>

                            {/* Badge counters & actions */}
                            <div className="vault-row-badges">
                              {ch.isUpcoming ? (
                                <span className="vault-badge-soon">Soon</span>
                              ) : connsCount > 0 ? (
                                <span
                                  className="vault-badge-links"
                                  title={`${connsCount} deep links`}
                                >
                                  <LinkIcon size={9} />
                                  {connsCount}
                                </span>
                              ) : null}
                              <button
                                className="vault-item-delete-btn"
                                title="Delete note"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChapter(sub.id, ch.id, ch.title);
                                }}
                                aria-label="Delete note"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Minimalist Micro-Footer */}
        <div className="vault-footer">
          <span className="vault-footer-links" title={`${totalConnectionCount} total concept links`}>
            <LinkIcon size={11} /> {totalConnectionCount} links
          </span>

          <div className="vault-footer-actions">
            <button
              className="vault-ghost-btn"
              onClick={handleExportVault}
              title="Export vault backup (JSON)"
              aria-label="Export backup"
            >
              <Download size={13} />
            </button>

            <label
              className="vault-ghost-btn vault-import-label"
              title="Import vault backup (JSON)"
              aria-label="Import backup"
            >
              <Upload size={13} />
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </label>

            <button
              className="vault-ghost-btn"
              onClick={handleRestoreSample}
              title="Restore sample note"
              aria-label="Restore sample note"
            >
              <Sparkles size={13} />
            </button>

            <button
              className="vault-ghost-btn"
              onClick={() => setIsSecurityModalOpen(true)}
              title="Vault Privacy & Encryption"
              aria-label="Privacy & Security"
            >
              <Shield size={13} />
            </button>

            <button
              className="vault-ghost-btn danger-hover"
              onClick={handleClearAllToZero}
              title="Clear vault to zero"
              aria-label="Clear vault to zero"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {importStatus && (
            <div className="vault-import-toast">{importStatus}</div>
          )}
        </div>
      </aside>

      {/* New Note / Chapter Modal */}
      <NewNoteModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />

      {/* Vault Privacy & Encryption Settings Modal */}
      <VaultSecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        onLockNow={() => window.location.reload()}
      />
    </>
  );
}
