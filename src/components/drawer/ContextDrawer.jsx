// src/components/drawer/ContextDrawer.jsx - Slide-in Context Drawer for Long Notes

import React from 'react';
import { useReading } from '../../context/ReadingContext';
import LongNotesViewer from '../reader/LongNotesViewer';
import { X, BookOpen, Sparkles } from 'lucide-react';

export default function ContextDrawer() {
  const { drawerOpen, closeDrawer, activeConcept } = useReading();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Drawer Container */}
      <aside
        className={`context-drawer ${drawerOpen ? 'open' : ''}`}
        aria-label="Deep Context Notes"
        aria-hidden={!drawerOpen}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <div className="drawer-badge">
              <BookOpen size={13} />
              <span>Long Notes (Master Source)</span>
            </div>
            {activeConcept && (
              <h2 className="drawer-concept-title">
                <Sparkles size={15} className="sparkle-icon" />
                <span>{activeConcept.terms?.[0] || 'Deep Dive Context'}</span>
              </h2>
            )}
          </div>

          <button
            className="drawer-close-btn"
            onClick={closeDrawer}
            title="Close Context Drawer (ESC)"
            aria-label="Close Context Drawer"
          >
            <span className="kbd-shortcut">ESC</span>
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          <LongNotesViewer />
        </div>
      </aside>
    </>
  );
}
