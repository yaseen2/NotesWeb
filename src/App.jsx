// src/App.jsx - Main Application Shell for NotesWeb (Autonomous Two-Tier Study Workbench)

import React, { useState, useRef, useEffect } from 'react';
import { ReadingProvider, useReading } from './context/ReadingContext';
import Header from './components/navigation/Header';
import SplitContainer from './components/drawer/SplitContainer';
import DualEditor from './components/editor/DualEditor';
import VaultSidebar from './components/navigation/VaultSidebar';
import SearchModal from './components/navigation/SearchModal';
import TextSelectionToolbar from './components/linker/TextSelectionToolbar';
import ConceptMenuPopover from './components/linker/ConceptMenuPopover';
import VaultLockModal from './components/navigation/VaultLockModal';
import { isVaultPasswordProtected, isVaultUnlocked } from './utils/vaultCrypto';
import { extractLatexMetadata } from './utils/latexParser';
import { addCustomChapter } from './utils/vaultManager';
import { UploadCloud } from 'lucide-react';
import './App.css';

function AppContent() {
  const [isLocked, setIsLocked] = useState(() => {
    return isVaultPasswordProtected() && !isVaultUnlocked();
  });

  const {
    activeSubjectId,
    setActiveSubjectId,
    setActiveChapterId,
    workMode,
    setWorkMode,
    vaultOpen,
    setVaultOpen,
  } = useReading();

  const [isWindowDragOver, setIsWindowDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Window-level drag and drop listeners
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsWindowDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsWindowDragOver(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const finishCreation = (texContent, mdContent, meta, fileName) => {
    const title =
      meta.title && meta.title !== 'Revision Notes'
        ? meta.title
        : fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

    const res = addCustomChapter(activeSubjectId, {
      title,
      subtitle: meta.period || 'Uploaded Study Notes',
      period: meta.period || '',
      shortNotesRaw: texContent,
      longNotesRaw: mdContent || '',
    });

    setActiveSubjectId(res.subject.id);
    setActiveChapterId(res.chapter.id);
    setWorkMode('read');
  };

  const handleWindowDrop = (e) => {
    e.preventDefault();
    setIsWindowDragOver(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const pdfFile = fileList.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    const texFile = fileList.find(
      (f) =>
        f.name.endsWith('.tex') ||
        f.name.endsWith('.latex') ||
        f.type === 'text/x-tex'
    );
    const mdFile = fileList.find(
      (f) =>
        f.name.endsWith('.md') ||
        f.name.endsWith('.markdown') ||
        f.name.endsWith('.txt')
    );

    if (pdfFile) {
      const objUrl = URL.createObjectURL(pdfFile);
      const title = pdfFile.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

      if (mdFile) {
        const mdReader = new FileReader();
        mdReader.onload = (mdEvent) => {
          const res = addCustomChapter(activeSubjectId, {
            title,
            subtitle: 'Imported PDF Note',
            pdfPath: objUrl,
            pdfFile: pdfFile,
            longNotesRaw: mdEvent.target.result,
          });
          setActiveSubjectId(res.subject.id);
          setActiveChapterId(res.chapter.id);
          setWorkMode('read');
        };
        mdReader.readAsText(mdFile);
      } else {
        const res = addCustomChapter(activeSubjectId, {
          title,
          subtitle: 'Imported PDF Note',
          pdfPath: objUrl,
          pdfFile: pdfFile,
        });
        setActiveSubjectId(res.subject.id);
        setActiveChapterId(res.chapter.id);
        setWorkMode('read');
      }
      return;
    }

    if (texFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const texContent = event.target.result;
        const meta = extractLatexMetadata(texContent);

        if (mdFile) {
          const mdReader = new FileReader();
          mdReader.onload = (mdEvent) => {
            const mdContent = mdEvent.target.result;
            finishCreation(texContent, mdContent, meta, texFile.name);
          };
          mdReader.readAsText(mdFile);
        } else {
          finishCreation(texContent, '', meta, texFile.name);
        }
      };
      reader.readAsText(texFile);
    }
  };

  return (
    <div
      className="app-layout"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleWindowDrop}
    >
      <Header />
      <VaultSidebar isOpen={vaultOpen} onClose={() => setVaultOpen(false)} />

      {/* Primary Workspace: Switches smoothly between Read & Edit mode */}
      {workMode === 'edit' ? <DualEditor /> : <SplitContainer />}

      <SearchModal />
      <TextSelectionToolbar />
      <ConceptMenuPopover />
      <VaultLockModal isOpen={isLocked} onUnlocked={() => setIsLocked(false)} />

      {/* Full-Screen Drag-and-Drop Ingestion Overlay */}
      {isWindowDragOver && (
        <div
          className="window-drag-overlay"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleWindowDrop}
        >
          <div className="window-drag-card">
            <UploadCloud size={56} className="drag-icon-pulse" />
            <h2 className="drag-overlay-title">Drop PDF or Study Notes</h2>
            <p className="drag-overlay-subtitle">
              Instant vector PDF rendering with deep-linked contextual notes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReadingProvider>
      <AppContent />
    </ReadingProvider>
  );
}
