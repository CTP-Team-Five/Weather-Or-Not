"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { SavedPin } from "./data/pinStore";
import {
  HiTrash,
  HiMapPin,
  HiChevronLeft,
  HiChevronRight,
  HiArrowRight,
  HiMagnifyingGlass,
  HiXMark,
} from "react-icons/hi2";
import { ActivityIcon } from "@/components/icons/ActivityIcons";

interface MapPinManagerProps {
  pins: SavedPin[];
  onFocus: (pinId: string) => void;
  onDelete: (pinId: string) => void;
}

const activityLabels: Record<string, string> = {
  hike: "Hiking",
  surf: "Surfing",
  snowboard: "Snowboarding",
};

function getPinDisplayName(pin: SavedPin): string {
  return pin.canonical_name || pin.area;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="wo-pin-search-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function MapPinManager({
  pins,
  onFocus,
  onDelete,
}: MapPinManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when panel opens, clear when it closes
  useEffect(() => {
    if (isOpen) {
      // Delay to let the slide animation start so the input is visible
      const t = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    setSearchQuery("");
  }, [isOpen]);

  const filteredPins = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pins;
    return pins.filter((pin) => {
      const fields = [
        pin.name,
        pin.area,
        pin.canonical_name,
        activityLabels[pin.activity] || pin.activity,
        ...(pin.tags || []),
      ].filter(Boolean) as string[];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [pins, searchQuery]);

  const handleDelete = (pinId: string, pinArea: string) => {
    const confirmed = window.confirm(`Delete "${pinArea}"?`);
    if (confirmed) onDelete(pinId);
  };

  return (
    <div className="wo-pin-manager-root">
      <div className="wo-pin-manager-inner">
        {/* Collapsed pill */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`wo-pin-pill ${isOpen ? "wo-pin-pill--hidden" : ""}`}
          aria-label="Open spots list"
        >
          <HiMapPin className="wo-pin-pill-icon" />
          <span>Spots</span>
          {pins.length > 0 && (
            <span className="wo-pin-pill-count">{pins.length}</span>
          )}
          <HiChevronRight className="wo-pin-pill-chevron" />
        </button>

        {/* Expanded panel */}
        <div
          className={`wo-pin-panel ${isOpen ? "wo-pin-panel--open" : ""}`}
          aria-hidden={!isOpen}
        >
          <div className="wo-pin-panel-header">
            <div className="wo-pin-panel-header-left">
              <HiMapPin style={{ width: 14, height: 14, opacity: 0.5 }} />
              <span className="wo-pin-panel-title">Saved Spots</span>
              <span className="wo-pin-panel-count">{pins.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="wo-pin-panel-close"
              aria-label="Close"
            >
              <HiChevronLeft style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* ── Search input ──────────────────────────────────────────── */}
          {pins.length > 0 && (
            <div className="wo-pin-search">
              <HiMagnifyingGlass className="wo-pin-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter spots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wo-pin-search-input"
                autoComplete="off"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wo-pin-search-clear"
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                  aria-label="Clear search"
                >
                  <HiXMark style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
          )}

          {/* ── Pin list ───────────────────────────────────────────────── */}
          <div className="wo-pin-panel-body">
            {pins.length === 0 ? (
              <div className="wo-pin-panel-empty">
                <HiMapPin style={{ width: 20, height: 20, opacity: 0.3, marginBottom: '0.5rem' }} />
                <div>No spots saved yet.</div>
                <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>Search and drop a pin to get started.</div>
              </div>
            ) : filteredPins.length === 0 ? (
              <div className="wo-pin-panel-empty">
                <HiMagnifyingGlass style={{ width: 18, height: 18, opacity: 0.3, marginBottom: '0.5rem' }} />
                <div>No matches for &ldquo;{searchQuery}&rdquo;</div>
              </div>
            ) : (
              filteredPins.map((pin) => {
                const Icon = ActivityIcon[pin.activity];
                const label = activityLabels[pin.activity] || pin.activity;
                const displayName = getPinDisplayName(pin);
                const q = searchQuery.trim();
                return (
                  <div
                    key={pin.id}
                    className={`wo-pin-item wo-pin-item--${pin.activity}`}
                  >
                    <div className="wo-pin-item-icon">
                      {Icon && <Icon size={16} strokeWidth={2.2} />}
                    </div>
                    <div className="wo-pin-item-info">
                      <div className="wo-pin-item-area">{highlightMatch(displayName, q)}</div>
                      <div className="wo-pin-item-activity">{highlightMatch(label, q)}</div>
                    </div>
                    <div className="wo-pin-item-actions">
                      <button
                        type="button"
                        onClick={() => { onFocus(pin.id); setIsOpen(false); }}
                        className="wo-pin-item-btn"
                        title="Focus on map"
                      >
                        <HiArrowRight style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(pin.id, pin.area)}
                        className="wo-pin-item-btn wo-pin-item-btn--danger"
                        title="Delete spot"
                      >
                        <HiTrash style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
