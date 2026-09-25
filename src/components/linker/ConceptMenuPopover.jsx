// src/components/linker/ConceptMenuPopover.jsx - Popover menu for multi-target concepts and link deletion

import React, { useEffect, useRef } from 'react';
import { useReading } from '../../context/ReadingContext';
import { Sparkles, ArrowRight, Trash2, X, MapPin } from 'lucide-react';

export default function ConceptMenuPopover() {
  const {
    activeMultiTarget,
    multiTargetPosition,
    closeMultiTargetMenu,
    selectMultiTarget,
    deleteConnection,
  } = useReading();

  const popoverRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    if (!activeMultiTarget) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        closeMultiTargetMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMultiTarget, closeMultiTargetMenu]);

  if (!activeMultiTarget || !multiTargetPosition) return null;

  const conceptTitle =
    activeMultiTarget.source?.terms?.[0] || activeMultiTarget.source?.text || 'Concept Hub';

  return (
    <div
      ref={popoverRef}
      className="concept-hub-popover"
      style={{
        position: 'absolute',
        top: `${multiTargetPosition.top}px`,
        left: `${multiTargetPosition.left}px`,
        zIndex: 55,
      }}
    >
      <div className="hub-header">
        <div className="hub-title-group">
          <Sparkles size={14} className="hub-sparkle" />
          <span className="hub-title">{conceptTitle}</span>
        </div>
        <button className="hub-close-btn" onClick={closeMultiTargetMenu}>
          <X size={13} />
        </button>
      </div>

      <p className="hub-subtitle">Connected Historical Contexts ({activeMultiTarget.targets.length}):</p>

      <div className="hub-targets-list">
        {activeMultiTarget.targets.map((target, idx) => (
          <div
            key={target.id || idx}
            className="hub-target-item"
            onClick={() => selectMultiTarget(target, activeMultiTarget)}
          >
            <div className="hub-target-info">
              <MapPin size={13} className="hub-target-icon" />
              <div className="hub-target-text-group">
                <span className="hub-target-label">{target.label}</span>
                {target.snippet && (
                  <p className="hub-target-snippet">{target.snippet.substring(0, 90)}…</p>
                )}
              </div>
            </div>
            <ArrowRight size={14} className="hub-target-arrow" />
          </div>
        ))}
      </div>

      {/* Delete option if it is a user-created custom link */}
      {!activeMultiTarget.isBuiltin && (
        <div className="hub-footer">
          <button
            className="hub-delete-btn"
            onClick={() => deleteConnection(activeMultiTarget.id)}
            title="Delete this custom connection"
          >
            <Trash2 size={12} />
            <span>Remove Connection</span>
          </button>
        </div>
      )}
    </div>
  );
}
