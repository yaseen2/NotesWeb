// src/components/drawer/SplitContainer.jsx - Split Screen Container preserving reading position

import React from 'react';
import { useReading } from '../../context/ReadingContext';
import ShortNotesViewer from '../reader/ShortNotesViewer';
import ContextDrawer from './ContextDrawer';

export default function SplitContainer() {
  const { drawerOpen } = useReading();

  return (
    <main className={`split-container ${drawerOpen ? 'drawer-is-open' : ''}`}>
      {/* Primary Reading Pane: Short Notes */}
      <section className="primary-reader-pane" aria-label="Short Notes View">
        <ShortNotesViewer />
      </section>

      {/* Secondary Context Pane: Long Notes Drawer */}
      <ContextDrawer />
    </main>
  );
}
