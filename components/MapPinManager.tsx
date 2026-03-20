"use client";

import { useState } from "react";
import { SavedPin } from "./data/pinStore";
import {
  HiTrash,
  HiMapPin,
  HiChevronLeft,
  HiChevronRight,
  HiArrowRight,
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

export default function MapPinManager({
  pins,
  onFocus,
  onDelete,
}: MapPinManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

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

          <div className="wo-pin-panel-body">
            {pins.length === 0 ? (
              <div className="wo-pin-panel-empty">
                <HiMapPin style={{ width: 20, height: 20, opacity: 0.3, marginBottom: '0.5rem' }} />
                <div>No spots saved yet.</div>
                <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>Search and drop a pin to get started.</div>
              </div>
            ) : (
              pins.map((pin) => {
                const Icon = ActivityIcon[pin.activity];
                const label = activityLabels[pin.activity] || pin.activity;
                const displayName = (pin as any).canonical_name || pin.area;
                return (
                  <div
                    key={pin.id}
                    className={`wo-pin-item wo-pin-item--${pin.activity}`}
                  >
                    <div className="wo-pin-item-icon">
                      {Icon && <Icon size={16} strokeWidth={2.2} />}
                    </div>
                    <div className="wo-pin-item-info">
                      <div className="wo-pin-item-area">{displayName}</div>
                      <div className="wo-pin-item-activity">{label}</div>
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
