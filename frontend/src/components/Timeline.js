"use client";

import { useMemo } from "react";
import { Hash } from "lucide-react";

// Helper to generate a consistent color based on cluster label hash
// Restricts hue to electric blues, teals, and purples that fit the dark theme
function getPillColors(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Hue range: 190 (teal-blue) to 310 (purple-pink)
  const hue = Math.abs(hash % 120) + 190;
  return {
    fill: `hsla(${hue}, 85%, 60%, 0.15)`,
    stroke: `hsla(${hue}, 90%, 65%, 0.8)`,
    glow: `hsla(${hue}, 90%, 65%, 0.3)`,
    text: `hsla(${hue}, 95%, 85%, 1)`
  };
}

export default function Timeline({ data, selectedClusterId, onSelectCluster }) {
  // 1. Process timestamps and ranges
  const { minStart, maxEnd, duration, gridLines } = useMemo(() => {
    if (!data || data.length === 0) {
      return { minStart: 0, maxEnd: 0, duration: 0, gridLines: [] };
    }

    const times = data.flatMap((c) => [
      new Date(c.start).getTime(),
      new Date(c.end).getTime(),
    ]);

    let min = Math.min(...times);
    let max = Math.max(...times);

    // If all times are the same (single article or instant), pad the range
    if (min === max) {
      min -= 6 * 3600 * 1000; // Subtract 6 hours
      max += 6 * 3600 * 1000; // Add 6 hours
    } else {
      // Add a small padding (1 hour) on both sides for aesthetics
      min -= 1 * 3600 * 1000;
      max += 1 * 3600 * 1000;
    }

    const range = max - min;
    const divisions = 5;
    const grid = [];
    
    for (let i = 0; i <= divisions; i++) {
      const val = min + (range / divisions) * i;
      const date = new Date(val);
      grid.push({
        percent: (i / divisions) * 100,
        timeLabel: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        dateLabel: date.toLocaleDateString([], { month: "short", day: "numeric" }),
      });
    }

    return { minStart: min, maxEnd: max, duration: range, gridLines: grid };
  }, [data]);

  // 2. Map coordinates for each cluster
  const timelineItems = useMemo(() => {
    if (duration === 0) return [];
    
    return data.map((c) => {
      const startMs = new Date(c.start).getTime();
      const endMs = new Date(c.end).getTime();

      let startPercent = ((startMs - minStart) / duration) * 100;
      let endPercent = ((endMs - minStart) / duration) * 100;
      let widthPercent = endPercent - startPercent;

      // Enforce minimum width of 4% so even instant/single-article clusters are clickable
      if (widthPercent < 4) {
        widthPercent = 4;
        // Keep within timeline bounds
        if (startPercent + widthPercent > 100) {
          startPercent = 100 - widthPercent;
        }
      }

      const colors = getPillColors(c.label);

      return {
        ...c,
        x: startPercent,
        w: widthPercent,
        colors,
      };
    });
  }, [data, minStart, duration]);

  if (!data || data.length === 0) {
    return (
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%", 
          padding: "2rem",
          color: "var(--text-secondary)",
          border: "1px dashed var(--border-color)",
          borderRadius: "12px"
        }}
      >
        <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📡</span>
        <p>No active news clusters loaded.</p>
        <p style={{ fontSize: "0.8rem" }}>Click "Refresh Data" to scrape recent articles.</p>
      </div>
    );
  }

  return (
    <div className="timeline-outer-container">
      {/* Time Axis Headers */}
      <div 
        style={{ 
          position: "relative", 
          height: "30px", 
          borderBottom: "1px solid var(--border-color)", 
          marginBottom: "1rem" 
        }}
      >
        {gridLines.map((line, idx) => (
          <div
            key={idx}
            className="mono"
            style={{
              position: "absolute",
              left: `${line.percent}%`,
              transform: "translateX(-50%)",
              fontSize: "0.7rem",
              color: "var(--text-secondary)",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <div>{line.timeLabel}</div>
            <div style={{ fontSize: "0.6rem", opacity: 0.6 }}>{line.dateLabel}</div>
          </div>
        ))}
      </div>

      {/* Timeline Rows Container */}
      <div 
        style={{ 
          flex: 1, 
          position: "relative", 
          overflowY: "auto", 
          overflowX: "hidden",
          paddingRight: "0.5rem"
        }}
      >
        {/* Background Grid Lines */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {gridLines.map((line, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: `${line.percent}%`,
                top: 0,
                bottom: 0,
                width: "1px",
                borderLeft: "1px dashed rgba(255,255,255,0.03)",
              }}
            />
          ))}
        </div>

        {/* Cluster Rails */}
        <div 
          style={{ 
            position: "relative", 
            display: "flex", 
            flexDirection: "column", 
            gap: "0.75rem",
            padding: "0.5rem 0",
            minHeight: "100%"
          }}
        >
          {timelineItems.map((item) => {
            const isSelected = item.id === selectedClusterId;
            // Height scales with intensity: ranges from 22px to 38px
            const height = 22 + item.intensity * 16;
            // Opacity scales with intensity: ranges from 0.5 to 1.0
            const opacity = 0.5 + item.intensity * 0.5;

            return (
              <div
                key={item.id}
                onClick={() => onSelectCluster(item.id)}
                style={{
                  position: "relative",
                  width: "100%",
                  height: "44px", // Fixed rail height
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* Cluster Pill Bar */}
                <div
                  className="timeline-pill"
                  style={{
                    position: "absolute",
                    left: `${item.x}%`,
                    width: `${item.w}%`,
                    height: `${height}px`,
                    backgroundColor: isSelected ? item.colors.stroke : item.colors.fill,
                    border: `1px solid ${item.colors.stroke}`,
                    borderRadius: `${height / 2}px`,
                    opacity: isSelected ? 1 : opacity,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 0.75rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    boxShadow: isSelected 
                      ? `0 0 12px ${item.colors.glow}, inset 0 0 4px rgba(255,255,255,0.2)` 
                      : `0 2px 4px rgba(0,0,0,0.2)`,
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = item.colors.glow;
                      e.currentTarget.style.boxShadow = `0 0 8px ${item.colors.glow}`;
                      e.currentTarget.style.transform = "scaleY(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = item.colors.fill;
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
                      e.currentTarget.style.transform = "none";
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: isSelected ? "var(--bg-color)" : item.colors.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      userSelect: "none"
                    }}
                  >
                    {item.label}
                  </span>
                  
                  {/* Article count indicator inside the pill if it fits */}
                  {item.w > 8 && (
                    <span
                      className="mono"
                      style={{
                        marginLeft: "auto",
                        fontSize: "0.65rem",
                        padding: "0.05rem 0.3rem",
                        borderRadius: "8px",
                        backgroundColor: isSelected ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.08)",
                        color: isSelected ? "var(--bg-color)" : "var(--text-primary)",
                        fontWeight: 700,
                      }}
                    >
                      {item.article_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info / Color Guide */}
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginTop: "1rem", 
          paddingTop: "0.75rem", 
          borderTop: "1px solid var(--border-color)",
          fontSize: "0.75rem",
          color: "var(--text-secondary)"
        }}
      >
        <div style={{ display: "flex", gap: "1rem" }}>
          <span>● Size/Color: Cluster Intensity</span>
          <span>● Click bar to inspect articles</span>
        </div>
        <span className="mono" style={{ fontSize: "0.65rem" }}>Range: Dynamic Grid</span>
      </div>
    </div>
  );
}
