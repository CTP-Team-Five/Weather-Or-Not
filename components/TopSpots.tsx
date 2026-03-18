// components/TopSpots.tsx

"use client";

import { useEffect, useState } from "react";
import { fetchTopSpots, TopSpot } from "@/lib/fetchTopSpots";

const activityIcons: Record<string, string> = {
  hike: "🥾",
  surf: "🏄",
  snowboard: "🎿",
};

export default function TopSpots() {
  const [topSpots, setTopSpots] = useState<TopSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopSpots() {
      setLoading(true);
      const spots = await fetchTopSpots();
      setTopSpots(spots.slice(0, 6)); // Show top 6
      setLoading(false);
    }

    loadTopSpots();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.5)",
        }}
      >
        Loading top spots...
      </div>
    );
  }

  if (topSpots.length === 0) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.5)",
        }}
      >
        No spots yet. Be the first to add one!
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1rem",
        width: "100%",
      }}
    >
      {topSpots.map((spot, index) => (
        <div
          key={`${spot.spot_name}-${spot.activity}`}
          style={{
            background: "rgba(40, 40, 40, 0.6)",
            borderRadius: "12px",
            padding: "1.2rem",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(50, 50, 50, 0.7)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(40, 40, 40, 0.6)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {/* Rank Badge */}
          <div
            style={{
              position: "absolute",
              top: "0.75rem",
              left: "0.75rem",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#a5b4fc",
            }}
          >
            #{index + 1}
          </div>

          {/* Activity Icon (Background) */}
          <div
            style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              fontSize: "3rem",
              opacity: 0.08,
            }}
          >
            {activityIcons[spot.activity] || "📍"}
          </div>

          {/* Content */}
          <div style={{ marginTop: "2rem" }}>
            {/* Spot Name */}
            <h3
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "#e5e5e5",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {spot.spot_name}
            </h3>

            {/* Activity + Session Count */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.85rem",
                color: "rgba(255, 255, 255, 0.6)",
                marginBottom: "0.75rem",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {activityIcons[spot.activity] || "📍"}
                <span style={{ textTransform: "capitalize" }}>
                  {spot.activity === "snowboard" ? "Snowboarding" : spot.activity}
                </span>
              </span>
              <span>•</span>
              <span>
                {spot.session_count} {spot.session_count === 1 ? "session" : "sessions"}
              </span>
            </div>

            {/* Popularity Bar */}
            <div
              style={{
                width: "100%",
                height: "4px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (spot.session_count / topSpots[0].session_count) * 100)}%`,
                  background: "linear-gradient(90deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.6))",
                  borderRadius: "2px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
