// components/TopSpots.tsx

"use client";

import { useEffect, useState } from "react";
import { fetchTopSpots, TopSpot } from "@/lib/fetchTopSpots";

const ACTIVITY_LABELS: Record<string, string> = {
  hike: "Hiking",
  surf: "Surfing",
  snowboard: "Snowboarding",
};

export default function TopSpots() {
  const [topSpots, setTopSpots] = useState<TopSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopSpots() {
      setLoading(true);
      const spots = await fetchTopSpots();
      setTopSpots(spots.slice(0, 6));
      setLoading(false);
    }
    loadTopSpots();
  }, []);

  if (loading) {
    return (
      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.85rem", padding: "1rem 0" }}>
        Loading popular spots…
      </div>
    );
  }

  if (topSpots.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
        No spots yet. Be the first to add one!
      </div>
    );
  }

  const maxCount = topSpots[0].session_count;

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
            background: "hsl(var(--surface))",
            borderRadius: "12px",
            padding: "1.2rem",
            border: "1px solid hsl(var(--border-subtle))",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "hsl(var(--surface-elevated))";
            e.currentTarget.style.borderColor = "hsl(var(--border))";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 20px -8px hsl(var(--shadow) / 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "hsl(var(--surface))";
            e.currentTarget.style.borderColor = "hsl(var(--border-subtle))";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {/* Rank + name */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: "hsl(var(--accent) / 0.12)",
                border: "1px solid hsl(var(--accent) / 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "hsl(var(--accent))",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </div>
            <h3
              style={{
                margin: 0,
                flex: 1,
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {spot.spot_name}
            </h3>
          </div>

          {/* Activity + saves */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            <span style={{ fontWeight: 500 }}>
              {ACTIVITY_LABELS[spot.activity] ?? spot.activity}
            </span>
            <span style={{ fontSize: "0.75rem" }}>
              {spot.session_count} {spot.session_count === 1 ? "save" : "saves"}
            </span>
          </div>

          {/* Popularity bar */}
          <div
            style={{
              width: "100%",
              height: "4px",
              background: "hsl(var(--muted))",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round((spot.session_count / maxCount) * 100)}%`,
                background: "hsl(var(--accent))",
                borderRadius: "2px",
                transition: "width 0.4s ease",
                opacity: 0.6,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
