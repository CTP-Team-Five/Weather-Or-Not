"use client";

import { useState } from "react";
import { SavedPin } from "./data/pinStore";
import {
  HiTrash,
  HiMapPin,
  HiChevronLeft,
  HiChevronRight,
} from "react-icons/hi2";

interface MapPinManagerProps {
  pins: SavedPin[];
  onFocus: (pinId: string) => void;
  onDelete: (pinId: string) => void;
}

const activityIcons: Record<string, string> = {
  hike: "🥾",
  surf: "🏄",
  snowboard: "🎿",
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
          aria-label="Open pin manager"
        >
          <HiMapPin className="wo-pin-pill-icon" />
          <span>Pins</span>
          <HiChevronRight className="wo-pin-pill-chevron" />
        </button>

        {/* Expanded panel */}
        <div
          className={`wo-pin-panel ${isOpen ? "wo-pin-panel--open" : ""
            }`}
          aria-hidden={!isOpen}
        >
          <div className="wo-pin-panel-header">
            <div>
              <div className="wo-pin-panel-title">Manage Pins</div>
              <div className="wo-pin-panel-subtitle">
                {pins.length} {pins.length === 1 ? "pin" : "pins"} saved
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="wo-pin-panel-close"
              aria-label="Collapse pin manager"
            >
              <HiChevronLeft className="wo-pin-pill-icon" />
            </button>
          </div>

          <div className="wo-pin-panel-body">
            {pins.length === 0 ? (
              <div className="wo-pin-panel-empty">
                No pins yet. Search for a location and add a pin!
              </div>
            ) : (
              pins.map((pin) => (
                <div key={pin.id} className="wo-pin-item">
                  <div className="wo-pin-item-header">
                    <div className="wo-pin-item-emoji">
                      {activityIcons[pin.activity] || "📍"}
                    </div>
                    <div className="wo-pin-item-main">
                      <div className="wo-pin-item-area">{pin.area}</div>
                      <div className="wo-pin-item-activity">
                        {pin.activity === "snowboard"
                          ? "Snowboarding"
                          : pin.activity}
                      </div>
                    </div>
                  </div>

                  <div className="wo-pin-item-actions">
                    <button
                      type="button"
                      onClick={() => onFocus(pin.id)}
                      className="wo-pin-item-btn"
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(pin.id, pin.area)}
                      className="wo-pin-item-btn wo-pin-item-btn--danger"
                    >
                      <HiTrash className="wo-pin-pill-icon" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
