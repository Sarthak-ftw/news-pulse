"use client";

import { useState } from "react";
import { RotateCw, AlertTriangle, Check } from "lucide-react";

export default function IngestButton({ onRefreshComplete }) {
  const [status, setStatus] = useState("idle"); // idle | triggering | scraping | done | failed
  const [errorMsg, setErrorMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const triggerIngest = async () => {
    try {
      setStatus("triggering");
      setErrorMsg("");

      const res = await fetch("/api/ingest/trigger", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Ingest trigger failed with status ${res.status}`);
      }

      const data = await res.json();
      const jobId = data.jobId;
      if (!jobId) {
        throw new Error("Server returned an empty Job ID.");
      }

      setStatus("scraping");
      startPolling(jobId);
    } catch (error) {
      console.error("[Ingest] Trigger Error:", error);
      setStatus("failed");
      setErrorMsg(error.message || "Failed to trigger ingestion");
      // Reset status to idle after a delay
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const startPolling = (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ingest/status/${jobId}`);
        if (!res.ok) {
          throw new Error("Failed to check status.");
        }

        const data = await res.json();
        
        if (data.status === "done") {
          clearInterval(pollInterval);
          setStatus("done");
          setLastUpdated(new Date());
          
          if (onRefreshComplete) {
            onRefreshComplete();
          }

          // Reset status to idle after showing success
          setTimeout(() => setStatus("idle"), 3000);
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setStatus("failed");
          setErrorMsg(data.error || "Scraper process execution failed.");
          setTimeout(() => setStatus("idle"), 6000);
        }
      } catch (error) {
        clearInterval(pollInterval);
        setStatus("failed");
        setErrorMsg(error.message || "Status polling connection dropped.");
        setTimeout(() => setStatus("idle"), 6000);
      }
    }, 2000); // Poll every 2 seconds
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <button
        className="navbar-btn"
        disabled={status === "triggering" || status === "scraping"}
        onClick={triggerIngest}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderColor: status === "failed" ? "#EF4444" : status === "done" ? "#10B981" : "rgba(255,255,255,0.15)",
        }}
      >
        <RotateCw
          size={14}
          className={status === "triggering" || status === "scraping" ? "spinner" : ""}
          style={{
            color: status === "failed" ? "#EF4444" : status === "done" ? "#10B981" : "inherit"
          }}
        />
        {status === "idle" && "Refresh Data"}
        {status === "triggering" && "Initializing..."}
        {status === "scraping" && "Scraping news..."}
        {status === "done" && "Updated!"}
        {status === "failed" && "Failed"}
      </button>

      {lastUpdated && (
        <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
          Synced: {lastUpdated.toLocaleTimeString()}
        </span>
      )}

      {status === "failed" && errorMsg && (
        <span className="mono" style={{ fontSize: "0.65rem", color: "#EF4444", maxWidth: "200px", textAlign: "right" }}>
          Error: {errorMsg}
        </span>
      )}
    </div>
  );
}
