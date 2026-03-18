// components/TopSpots.tsx

"use client";

import { useEffect, useState } from "react";
import { fetchTopSpots, TopSpot } from "@/lib/fetchTopSpots";

const ACTIVITY_LABELS: Record<string, string> = {
  hike: "Hiking",
  surf: "Surfing",
  snowboard: "Snowboarding",
};

function getLabelColor(label: string | null): { bg: string; text: string } {
  switch (label) {
    case "GREAT":
      return {
        bg: "hsl(var(--score-great) / 0.15)",
        text: "hsl(var(--score-great))",
      };
    case "OK":
      return {
        bg: "hsl(var(--score-ok) / 0.15)",
        text: "hsl(var(--score-ok))",
      };
    case "TERRIBLE":
      return {
        bg: "hsl(var(--score-terrible) / 0.12)",
        text: "hsl(var(--score-terrible))",
      };
    default:
      return {
        bg: "hsl(var(--muted))",
        text: "hsl(var(--muted-foreground))",
      };
  }
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "hsl(var(--surface))",
        border: "1px solid hsl(var(--border-subtle))",
        borderRadius: "12px",
        padding: "1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "hsl(var(--muted))",
            animation: "topSpotsPulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            flex: 1,
            height: "14px",
            borderRadius: "4px",
            background: "hsl(var(--muted))",
            animation: "topSpotsPulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
      <div
        style={{
          height: "12px",
          borderRadius: "4px",
          background: "hsl(var(--muted))",
          width: "60%",
          animation: "topSpotsPulse 1.5s ease-in-out infinite 0.15s",
        }}
      />
      <div
        style={{
          height: "5px",
          borderRadius: "3px",
          background: "hsl(var(--muted))",
          animation: "topSpotsPulse 1.5s ease-in-out infinite 0.3s",
        }}
      />
    </div>
  );
}

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
      <>
        <style>{`
          @keyframes topSpotsPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
            width: "100%",
          }}
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (topSpots.length === 0) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "hsl(var(--muted-foreground))",
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
      {topSpots.map((spot, index) => {
        const labelColors = getLabelColor(spot.label);

        return (
          <div
            key={`${spot.spot_name}-${spot.activity}`}
            style={{
              background: "hsl(var(--surface))",
              borderRadius: "12px",
              padding: "1.2rem",
              border: "1px solid hsl(var(--border-subtle))",
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
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
            {/* Header row: rank + name + verdict badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {/* Rank */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
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
                #{index + 1}
              </div>

              {/* Spot name */}
              <h3
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-display, system-ui, sans-serif)",
                }}
              >
                {spot.spot_name}
              </h3>

              {/* Verdict badge */}
              {spot.label && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "999px",
                    background: labelColors.bg,
                    color: labelColors.text,
                  }}
                >
                  {spot.label}
                </span>
              )}
            </div>

            {/* Activity + session count row */}
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

            {/* Score bar */}
            <div
              style={{
                width: "100%",
                height: "5px",
                background: "hsl(var(--muted))",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: spot.score !== null ? `${spot.score}%` : "0%",
                  background: labelColors.text,
                  borderRadius: "3px",
                  transition: "width 0.6s ease",
                  opacity: 0.8,
                }}
              />
            </div>

            {/* Score number */}
            {spot.score !== null && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "hsl(var(--muted-foreground))",
                  alignSelf: "flex-end",
                }}
              >
                {spot.score}/100
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
