"use client";

import useSWR from "swr";
import { X, ExternalLink, Calendar, Layers } from "lucide-react";

const fetcher = (url) => fetch(url).then((r) => r.json());

const articleWord = (n) => n === 1 ? 'article' : 'articles';

// Format published date into relative string
function getRelativeTime(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 0) return "just now";
  
  const intervals = [
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "m", seconds: 60 },
    { label: "s", seconds: 1 },
  ];

  for (const interval of intervals) {
    const value = Math.floor(seconds / interval.seconds);
    if (value >= 1) {
      return `${value}${interval.label} ago`;
    }
  }
  return "just now";
}

// Map news source names to specific CSS badge styles (including Guardian green)
function getSourceBadgeClass(source) {
  const name = (source || "").toLowerCase().trim();
  if (name.includes("bbc")) return "badge badge-bbc";
  if (name.includes("npr")) return "badge badge-npr";
  if (name.includes("reuters")) return "badge badge-reuters";
  if (name.includes("guardian")) return "badge badge-guardian";
  if (name.includes("jazeera")) return "badge badge-jazeera";
  return "badge badge-other";
}

// Clean raw HTML tags from article summaries before rendering
function stripHtmlTags(htmlString) {
  if (!htmlString) return "";
  // Strip tags using regex
  let cleaned = htmlString.replace(/<[^>]*>/g, "");
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned.trim();
}

export default function ClusterDetail({ clusterId, onClose }) {
  const { data: cluster, error, isLoading } = useSWR(
    clusterId ? `/api/clusters/${clusterId}` : null,
    fetcher
  );

  if (!clusterId) {
    return (
      <div style={{ padding: "2rem", color: "var(--text-secondary)", textAlign: "center" }}>
        Select a topic cluster from the grid to inspect articles.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <div className="spinner" style={{ border: "2px solid rgba(0,0,0,0.05)", borderTop: "2px solid var(--accent-color)", borderRadius: "50%", width: "24px", height: "24px" }} />
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div style={{ padding: "2rem", color: "#EF4444" }}>
        Failed to load cluster details.
      </div>
    );
  }

  // Format dates for display (including both date and time for multi-day spans)
  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const startStr = formatDateTime(cluster.earliest_article_at);
  const endStr = formatDateTime(cluster.latest_article_at);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--surface-color)" }}>
      {/* Header */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", position: "relative" }}>
        <div style={{ flex: 1, paddingRight: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", lineHeight: "1.3" }}>
            {cluster.label ? cluster.label.toUpperCase() : "Untitled Cluster"}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.25rem", backgroundColor: "#F3F4F6", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
              <Layers size={12} /> {cluster.article_count} {articleWord(cluster.article_count)}
            </span>
            <span style={{ color: "var(--border-color)" }}>|</span>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Calendar size={12} /> {startStr} – {endStr}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          aria-label="Close panel"
          style={{ 
            position: "absolute",
            top: "1.5rem",
            right: "1.5rem",
            padding: "0.4rem", 
            borderRadius: "50%",
            display: "inline-flex", 
            alignItems: "center", 
            justifyContent: "center",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-color)",
            cursor: "pointer",
          }}
          className="close-drawer-btn"
        >
          <X size={16} />
        </button>
      </div>

      {/* Articles List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 1.25rem" }}>
        {cluster.articles && cluster.articles.length > 0 ? (
          cluster.articles.map((article) => {
            const cleanedSummary = stripHtmlTags(article.summary);
            
            return (
              <div 
                key={article.id} 
                className="editorial-article-card"
                style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.6rem" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={getSourceBadgeClass(article.source)}>
                    {article.source}
                  </span>
                  <span className="timestamp">
                    {getRelativeTime(article.published_at)}
                  </span>
                </div>
                
                <h3 className="article-headline" style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0.2rem 0", color: "var(--text-primary)", lineHeight: "1.4" }}>
                  {article.title}
                </h3>
                
                {cleanedSummary && (
                  <p className="card-summary" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {cleanedSummary}
                  </p>
                )}

                {article.url && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.2rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.65 }}>
                      {article.url}
                    </span>
                    <div>
                      <a 
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="read-more-btn"
                      >
                        Read Full Article <span>→</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ padding: "2rem", color: "var(--text-secondary)", textAlign: "center" }}>
            No articles found in this cluster.
          </div>
        )}
      </div>
    </div>
  );
}
