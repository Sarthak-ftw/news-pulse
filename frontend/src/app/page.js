"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import useSWR from "swr";
import ClusterDetail from "@/components/ClusterDetail";
import IngestButton from "@/components/IngestButton";
import { Layers, Calendar, Search, Info, X } from "lucide-react";

const fetcher = (url) => fetch(url).then((r) => r.json());

// Real-time animated requestAnimationFrame Breaking News Ticker component
function BreakingNewsTicker({ clusters, onItemClick }) {
  const trackRef = useRef(null);
  const animationRef = useRef(null);
  const positionRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  const [displayItems, setDisplayItems] = useState([]);

  // Diffing logic for entries (slide-in / fade-in / fade-out exits)
  useEffect(() => {
    if (!clusters || clusters.length === 0) return;

    if (displayItems.length === 0) {
      setDisplayItems(clusters.map(c => ({ ...c, isVisible: true, isExiting: false })));
      return;
    }

    const newIds = new Set(clusters.map(c => c.id));
    const currentIds = new Set(displayItems.map(i => i.id));

    // 1. Mark old items as exiting
    let updated = displayItems.map(item => {
      if (!newIds.has(item.id)) {
        return { ...item, isExiting: true };
      }
      return item;
    });

    // 2. Add new items as entering
    const toAdd = clusters
      .filter(c => !currentIds.has(c.id))
      .map(c => ({ ...c, isVisible: false, isNew: true }));

    // Merge: maintain the order from clusters array
    let merged = [];
    clusters.forEach(c => {
      const existing = displayItems.find(i => i.id === c.id);
      if (existing) {
        merged.push(existing);
      } else {
        const brandNew = toAdd.find(i => i.id === c.id);
        if (brandNew) merged.push(brandNew);
      }
    });

    // Splice back old exiting items at their index so they fade out in place
    displayItems.forEach((oldItem, idx) => {
      if (!newIds.has(oldItem.id)) {
        merged.splice(idx, 0, oldItem);
      }
    });

    setDisplayItems(merged);

    // Transition entering items in next tick
    const animTimer = setTimeout(() => {
      setDisplayItems(prev => prev.map(item => {
        if (item.isNew) {
          return { ...item, isVisible: true, isNew: false };
        }
        return item;
      }));
    }, 50);

    return () => clearTimeout(animTimer);
  }, [clusters]);

  // Clean exiting items after transition (400ms)
  useEffect(() => {
    const hasExiting = displayItems.some(i => i.isExiting);
    if (hasExiting) {
      const cleanup = setTimeout(() => {
        setDisplayItems(prev => prev.filter(i => !i.isExiting));
      }, 400);
      return () => clearTimeout(cleanup);
    }
  }, [displayItems]);

  // RequestAnimationFrame scrolling loop
  useEffect(() => {
    const scrollLoop = () => {
      if (!isHovered && trackRef.current) {
        positionRef.current -= 0.6; // Speed: 0.6px per frame (smooth scroll)
        
        const halfWidth = trackRef.current.scrollWidth / 2;
        if (halfWidth > 0 && Math.abs(positionRef.current) >= halfWidth) {
          // Wrap around seamlessly
          positionRef.current = 0;
        }
        
        trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      }
      animationRef.current = requestAnimationFrame(scrollLoop);
    };

    animationRef.current = requestAnimationFrame(scrollLoop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isHovered, displayItems]);

  if (displayItems.length === 0) return null;

  // Duplicate items array for infinite looping marquee
  const loopItems = [...displayItems, ...displayItems];

  return (
    <div className="ticker-wrap">
      <div className="ticker-title">🔥 Breaking News</div>
      <div 
        className="ticker-content"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div ref={trackRef} className="ticker-track">
          {loopItems.map((item, idx) => {
            const isCollapsed = item.isExiting || !item.isVisible;
            const displayTitle = item.latest_title || (item.label ? item.label.toUpperCase() : "UNTITLED TOPIC");
            
            return (
              <div
                key={`${item.id}-${idx}`}
                className="ticker-item"
                onClick={() => onItemClick(item.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  opacity: isCollapsed ? 0 : 1,
                  maxWidth: isCollapsed ? "0px" : "600px",
                  paddingRight: isCollapsed ? "0px" : "1.5rem",
                  paddingLeft: isCollapsed ? "0px" : "1.5rem",
                  overflow: "hidden",
                  transition: "opacity 0.4s ease, max-width 0.4s ease, padding 0.4s ease",
                }}
              >
                <span style={{ color: "#EF4444", marginRight: "0.5rem", fontSize: "0.65rem" }}>►</span>
                <span className="ticker-headline-text" title={displayTitle}>
                  {displayTitle}
                </span>
                <span style={{ margin: "0 1.25rem", color: "#6B7280" }}>·</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Grammatically formats article words
const articleWord = (n) => n === 1 ? 'article' : 'articles';

// Count-up animation component for numbers
function AnimatedCounter({ value }) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10);
    if (isNaN(end)) return;
    if (start === end) {
      setDisplayVal(end);
      return;
    }

    const duration = 800; // Total duration in ms
    const stepTime = 15; // Interval duration in ms
    const totalSteps = duration / stepTime;
    const step = (end - start) / totalSteps;
    
    let current = start;
    const timer = setInterval(() => {
      current += step;
      if (current >= end) {
        setDisplayVal(end);
        clearInterval(timer);
      } else {
        setDisplayVal(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span className="counter-value">{displayVal}</span>;
}

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

// Map news source names to specific CSS badge styles
function getSourceBadgeClass(source) {
  const name = (source || "").toLowerCase().trim();
  if (name.includes("bbc")) return "badge badge-bbc";
  if (name.includes("npr")) return "badge badge-npr";
  if (name.includes("reuters")) return "badge badge-reuters";
  if (name.includes("guardian")) return "badge badge-guardian";
  if (name.includes("jazeera")) return "badge badge-jazeera";
  return "badge badge-other";
}

// Get clean colors for publishers reporting the news
const getSourceColor = (source) => {
  const name = (source || "").toLowerCase().trim();
  if (name.includes("bbc")) return "#1D4ED8"; // blue
  if (name.includes("npr")) return "#DC2626"; // red
  if (name.includes("reuters")) return "#D97706"; // amber
  if (name.includes("guardian")) return "#059669"; // green
  if (name.includes("jazeera")) return "#8B5CF6"; // purple
  return "#9CA3AF"; // gray
};

// Map match strength bounds
const getConfidenceScore = (count) => {
  if (count === 1) {
    return { level: "Weak", blocks: "██░░░░░░░░", color: "#EF4444" };
  } else if (count >= 2 && count <= 5) {
    return { level: "Moderate", blocks: "██████░░░░", color: "#F59E0B" };
  } else {
    return { level: "Strong", blocks: "████████░░", color: "#10B981" };
  }
};

// Strip HTML tags from strings
function stripHtmlTags(htmlString) {
  if (!htmlString) return "";
  return htmlString.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Classify clusters dynamically by keywords in their label (expanded list, case-insensitive check)
function getClusterCategory(label) {
  const text = (label || "").toLowerCase();
  
  const disasterKeywords = [
    "earthquake", "quake", "flood", "hurricane", "tornado", "tsunami", "wildfire", "storm", "volcano", 
    "disaster", "climate", "temperature", "heatwave", "drought", "fire", "explosion", "crash", "accident"
  ];
  
  const worldKeywords = [
    "election", "war", "government", "minister", "president", "senate", "trump", "biden", "parliament", 
    "military", "attack", "conflict", "border", "treaty", "vote", "rally", "rebuked", "festivities", 
    "iran", "russia", "ukraine", "china", "israel", "gaza", "india", "pakistan", "coup", "protest", "diplomacy"
  ];
  
  const businessKeywords = [
    "market", "price", "bank", "economy", "trade", "oil", "financial", "stock", "crypto", "inflation", 
    "fed", "rate", "gdp", "billion", "million", "fund", "investment", "app", "prediction"
  ];
  
  const scienceKeywords = [
    "ai", "climate", "space", "research", "study", "digital", "tech", "university", "degrees", "science", 
    "health", "vaccine", "disease", "drug", "medical", "environment", "energy", "solar", "nuclear", "quantum"
  ];
  
  const sportsKeywords = [
    "game", "sport", "music", "film", "gta", "rockstar", "planet", "romcom", "football", "cricket", 
    "nba", "cup", "tournament", "champion", "award", "celebrity", "entertainment", "brazil", "scotland"
  ];

  if (disasterKeywords.some(kw => text.includes(kw))) return "disasters";
  if (worldKeywords.some(kw => text.includes(kw))) return "world";
  if (businessKeywords.some(kw => text.includes(kw))) return "business";
  if (scienceKeywords.some(kw => text.includes(kw))) return "science";
  if (sportsKeywords.some(kw => text.includes(kw))) return "sports";
  return "general";
}

// Grammatically formats the article count and source summary
function getArticleCountSummary(count, sources) {
  const word = articleWord(count);
  if (!sources || sources.length === 0) {
    return `${count} ${word} covering this story.`;
  }
  
  // Format sources list (e.g. "BBC, NPR, and Reuters")
  let sourcesStr = "";
  if (sources.length === 1) {
    sourcesStr = sources[0];
  } else if (sources.length === 2) {
    sourcesStr = `${sources[0]} and ${sources[1]}`;
  } else {
    sourcesStr = `${sources.slice(0, -1).join(", ")}, and ${sources[sources.length - 1]}`;
  }
  
  return `${count} ${word} from ${sourcesStr} covering this story.`;
}

// Helper to format date as YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDaysAgoString = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateToYYYYMMDD = (d) => {
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Parse date pickers inputs in browser local timezone
const parseDateInput = (inputStr, endOfDay = false) => {
  if (!inputStr) return null;
  const [year, month, day] = inputStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

// Deduplicate clusters sharing more than 2 words in the same category (keep higher article count)
function deduplicateClusters(clusters) {
  if (!clusters || clusters.length === 0) return [];
  
  // Sort by article_count descending so we keep the one with the higher article count
  const sorted = [...clusters].sort((a, b) => b.article_count - a.article_count);
  const kept = [];
  
  const getWords = (label) => {
    return (label || "")
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ""))
      .filter(w => w.length > 2); // Filter short words
  };

  for (const c of sorted) {
    let isDuplicate = false;
    const wordsC = getWords(c.label);
    const setC = new Set(wordsC);
    
    for (const existing of kept) {
      const wordsE = getWords(existing.label);
      let commonCount = 0;
      
      for (const w of wordsE) {
        if (setC.has(w)) {
          commonCount++;
        } else {
          // Check simple plural variation (e.g. earthquake vs earthquakes)
          for (const wc of wordsC) {
            if (wc === w + "s" || w === wc + "s" || wc === w + "es" || w === wc + "es") {
              commonCount++;
              break;
            }
          }
        }
      }
      
      if (commonCount > 2) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      kept.push(c);
    }
  }
  
  // Re-sort the deduplicated list chronologically (by latest_article_at desc)
  return kept.sort((a, b) => {
    const timeA = new Date(a.latest_published_at || a.latest_article_at).getTime();
    const timeB = new Date(b.latest_published_at || b.latest_article_at).getTime();
    return timeB - timeA;
  });
}

// Category sections configuration (priority order)
const CATEGORIES = [
  { id: "disasters", title: "🚨 Disasters & Environment", color: "#EF4444" },
  { id: "world", title: "🌍 World & Politics", color: "var(--accent-color)" },
  { id: "business", title: "💰 Business & Economy", color: "#059669" },
  { id: "science", title: "🔬 Science & Tech", color: "#8B5CF6" },
  { id: "sports", title: "⚽ Sports & Culture", color: "#EC4899" },
  { id: "general", title: "📰 General News", color: "#6B7280" }
];

// Animated Skeleton Grid Placeholder for loading state
function SkeletonGrid() {
  return (
    <div className="news-grid">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="skeleton-card skeleton-pulse">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="skeleton-badge" />
            <div className="skeleton-badge" style={{ width: "15%" }} />
          </div>
          <div className="skeleton-line skeleton-title" style={{ marginTop: "0.5rem" }} />
          <div className="skeleton-line skeleton-title" style={{ width: "60%" }} />
          <div className="skeleton-line" style={{ marginTop: "0.5rem" }} />
          <div className="skeleton-line" style={{ width: "80%" }} />
          
          <div className="skeleton-footer">
            <div className="skeleton-badge" style={{ width: "35%" }} />
            <div className="skeleton-badge" style={{ width: "20%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [localClusters, setLocalClusters] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Feed filters: BBC, NPR, Reuters, Al Jazeera, The Guardian
  const [filters, setFilters] = useState({
    BBC: true,
    NPR: true,
    Reuters: true,
    "Al Jazeera": true,
    "The Guardian": true,
  });

  // Date picker state - separated into temporary inputs vs applied filters (empty/blank by default)
  const [tempFromDate, setTempFromDate] = useState("");
  const [tempToDate, setTempToDate] = useState("");

  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [isDateFilterApplied, setIsDateFilterApplied] = useState(false); // No date filter applied on first load
  const [quickPillActive, setQuickPillActive] = useState("all");

  // Separate load limit variables for each category section
  const [disastersLimit, setDisastersLimit] = useState(6);
  const [worldLimit, setWorldLimit] = useState(6);
  const [businessLimit, setBusinessLimit] = useState(6);
  const [techLimit, setTechLimit] = useState(6);
  const [sportsLimit, setSportsLimit] = useState(6);
  const [generalLimit, setGeneralLimit] = useState(6);

  // Silent Background Auto Refresh states
  const [newStoriesCount, setNewStoriesCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [latestSilentData, setLatestSilentData] = useState(null);

  // Live Statistics Navbar Tracker states
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [lastUpdatedText, setLastUpdatedText] = useState("just now");

  const getLimitForCategory = (catId) => {
    if (catId === "disasters") return disastersLimit;
    if (catId === "world") return worldLimit;
    if (catId === "business") return businessLimit;
    if (catId === "science") return techLimit;
    if (catId === "sports") return sportsLimit;
    return generalLimit;
  };

  const incrementLimitForCategory = (catId) => {
    if (catId === "disasters") setDisastersLimit(prev => prev + 6);
    else if (catId === "world") setWorldLimit(prev => prev + 6);
    else if (catId === "business") setBusinessLimit(prev => prev + 6);
    else if (catId === "science") setTechLimit(prev => prev + 6);
    else if (catId === "sports") setSportsLimit(prev => prev + 6);
    else setGeneralLimit(prev => prev + 6);
  };

  // Reset pagination limits back to 6 whenever filters change
  useEffect(() => {
    setDisastersLimit(6);
    setWorldLimit(6);
    setBusinessLimit(6);
    setTechLimit(6);
    setSportsLimit(6);
    setGeneralLimit(6);
  }, [searchQuery, filters, appliedFromDate, appliedToDate, isDateFilterApplied]);

  // Fetch cluster data containing lateral join latest articles
  // Polls silently in the background every 60 seconds
  const { data: clustersData, error, isLoading, mutate, isValidating } = useSWR(
    "/api/clusters",
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true
    }
  );

  const toggleFilter = (source) => {
    setFilters((prev) => ({
      ...prev,
      [source]: !prev[source],
    }));
  };

  // Sync SWR data to local state with smart merge logic
  useEffect(() => {
    if (clustersData && Array.isArray(clustersData)) {
      if (localClusters.length === 0) {
        setLocalClusters(clustersData);
      } else {
        // Build a map of current clusters
        const currentMap = new Map(localClusters.map(c => [c.id, c]));
        const freshIds = new Set(clustersData.map(c => c.id));
        
        let hasChanges = false;
        let newCount = 0;
        
        // 1. Check for removed and updated clusters
        const updatedList = localClusters.map(oldCluster => {
          if (!freshIds.has(oldCluster.id)) {
            // Obsolete cluster removed
            hasChanges = true;
            return null;
          }
          const fresh = clustersData.find(c => c.id === oldCluster.id);
          // Check if article count or latest headline updated
          if (
            fresh.article_count !== oldCluster.article_count ||
            fresh.latest_article_at !== oldCluster.latest_article_at ||
            fresh.latest_title !== oldCluster.latest_title
          ) {
            hasChanges = true;
            return { ...oldCluster, ...fresh };
          }
          return oldCluster;
        }).filter(Boolean);
        
        // 2. Identify new clusters to add
        const newClusters = clustersData.filter(c => !currentMap.has(c.id));
        if (newClusters.length > 0) {
          hasChanges = true;
          newCount = newClusters.length;
          // Insert new clusters at the top of localClusters
          updatedList.unshift(...newClusters);
        }

        if (hasChanges) {
          setLocalClusters(updatedList);
          
          if (newCount > 0) {
            setNewStoriesCount(newCount);
            setShowToast(true);
          }
        }
      }
    }
  }, [clustersData]);

  // Update navbar last-updated timestamp on local state changes
  useEffect(() => {
    if (localClusters.length > 0) {
      setLastUpdated(new Date());
    }
  }, [localClusters]);

  // Ticking local counter relative time text helper
  useEffect(() => {
    const updateTimeText = () => {
      const diff = Math.floor((new Date() - lastUpdated) / 1000);
      if (diff < 60) {
        setLastUpdatedText("just now");
      } else {
        const mins = Math.floor(diff / 60);
        setLastUpdatedText(`${mins} min ago`);
      }
    };

    updateTimeText(); // Execute once on start
    const timeInterval = setInterval(updateTimeText, 10000); // Check every 10s
    return () => clearInterval(timeInterval);
  }, [lastUpdated]);

  // Close toast with slide-out transition
  const handleCloseToast = () => {
    const element = document.getElementById("toast-alert");
    if (element) {
      element.classList.add("exiting");
    }
    setTimeout(() => {
      setShowToast(false);
    }, 300);
  };

  // Toast Auto-Dismiss Timer (5 seconds)
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        handleCloseToast();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Quick pill actions (updates values and immediately applies filter)
  const handleQuickFilterClick = (type) => {
    const today = getTodayString();
    setQuickPillActive(type);

    if (type === "today") {
      setTempFromDate(today);
      setTempToDate(today);
      setAppliedFromDate(today);
      setAppliedToDate(today);
      setIsDateFilterApplied(true);
    } else if (type === "24h") {
      const yesterday = getDaysAgoString(1);
      setTempFromDate(yesterday);
      setTempToDate(today);
      setAppliedFromDate(yesterday);
      setAppliedToDate(today);
      setIsDateFilterApplied(true);
    } else if (type === "7d") {
      const sevenDaysAgo = getDaysAgoString(7);
      setTempFromDate(sevenDaysAgo);
      setTempToDate(today);
      setAppliedFromDate(sevenDaysAgo);
      setAppliedToDate(today);
      setIsDateFilterApplied(true);
    } else if (type === "all") {
      setTempFromDate("");
      setTempToDate("");
      setAppliedFromDate("");
      setAppliedToDate("");
      setIsDateFilterApplied(false);
    }
  };

  // Apply manual picker bounds
  const handleApplyFilter = () => {
    setAppliedFromDate(tempFromDate);
    setAppliedToDate(tempToDate);
    setIsDateFilterApplied(true);
    setQuickPillActive("custom");
  };

  // Reset/Clear active bounds (empty/blank inputs)
  const handleClearFilter = () => {
    setTempFromDate("");
    setTempToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setIsDateFilterApplied(false);
    setQuickPillActive("all");
  };

  // Filter clusters locally based on search query, source checkboxes, and date filters
  const filteredClusters = useMemo(() => {
    if (!localClusters || !Array.isArray(localClusters)) return [];

    return localClusters.filter((cluster) => {
      // 1. Filter by sources checkboxes
      const matchesSource = cluster.sources.some((sourceName) => {
        return filters[sourceName] === true;
      });

      if (!matchesSource) return false;

      // 2. Filter by search query (client-side matching on cluster label + sources list)
      let matchesSearch = true;
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        const labelMatch = (cluster.label || "").toLowerCase().includes(query);
        const sourcesMatch = cluster.sources.some(s => s.toLowerCase().includes(query));
        matchesSearch = labelMatch || sourcesMatch;
      }
      if (!matchesSearch) return false;

      // 3. Filter by date range boundary (inclusive comparison of latest_article_at)
      if (isDateFilterApplied) {
        const clusterDateStr = cluster.latest_article_at || cluster.latest_published_at;
        if (!clusterDateStr) return false;
        const clusterDate = new Date(clusterDateStr);

        if (quickPillActive === "today") {
          const fromDate = new Date();
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date();
          toDate.setHours(23, 59, 59, 999);
          if (clusterDate < fromDate || clusterDate > toDate) return false;
        } else if (quickPillActive === "24h") {
          const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const toDate = new Date();
          if (clusterDate < fromDate || clusterDate > toDate) return false;
        } else if (quickPillActive === "7d") {
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - 7);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date();
          toDate.setHours(23, 59, 59, 999);
          if (clusterDate < fromDate || clusterDate > toDate) return false;
        } else {
          // Custom / manual inputs
          if (appliedFromDate) {
            const fromDate = parseDateInput(appliedFromDate, false);
            if (fromDate && clusterDate < fromDate) return false;
          }
          if (appliedToDate) {
            const toDate = parseDateInput(appliedToDate, true);
            if (toDate && clusterDate > toDate) return false;
          }
        }
      }

      return true;
    });
  }, [localClusters, filters, searchQuery, isDateFilterApplied, appliedFromDate, appliedToDate, quickPillActive]);

  // Extract total loaded news metrics
  const totalClusters = useMemo(() => {
    return localClusters && Array.isArray(localClusters) ? localClusters.length : 0;
  }, [localClusters]);

  const totalArticles = useMemo(() => {
    return localClusters && Array.isArray(localClusters) 
      ? localClusters.reduce((acc, c) => acc + c.article_count, 0) 
      : 0;
  }, [localClusters]);

  // Extract top 10 clusters for the breaking news ticker, sorted by article count (importance) and published time (recency)
  const breakingNews = useMemo(() => {
    if (!localClusters || !Array.isArray(localClusters)) return [];

    return [...localClusters]
      .filter(c => c.latest_title)
      .sort((a, b) => {
        // Sort by article count (importance) first
        if (b.article_count !== a.article_count) {
          return b.article_count - a.article_count;
        }
        // Sort by recency second
        const timeA = new Date(a.latest_published_at || a.latest_article_at || 0).getTime();
        const timeB = new Date(b.latest_published_at || b.latest_article_at || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 10);
  }, [localClusters]);

  // Extract top 5 clusters by article count for the Trending Now row
  const trendingClusters = useMemo(() => {
    if (!localClusters || !Array.isArray(localClusters)) return [];
    return [...localClusters]
      .sort((a, b) => b.article_count - a.article_count)
      .slice(0, 5);
  }, [localClusters]);

  // Group filtered clusters into category compartments and assign global indices for stagger delays
  const categorizedClusters = useMemo(() => {
    let globalCounter = 0;
    
    const groups = {
      disasters: [],
      world: [],
      business: [],
      science: [],
      sports: [],
      general: []
    };

    filteredClusters.forEach((cluster) => {
      const catId = getClusterCategory(cluster.label);
      groups[catId].push({
        ...cluster,
        globalIndex: globalCounter++
      });
    });

    return groups;
  }, [filteredClusters]);

  // Count how many categories are visible (categories with at least 3 deduplicated clusters)
  const visibleCategoriesCount = useMemo(() => {
    let count = 0;
    CATEGORIES.forEach((cat) => {
      const rawCatClusters = categorizedClusters[cat.id] || [];
      const catClusters = deduplicateClusters(rawCatClusters);
      if (catClusters.length >= 3) {
        count++;
      }
    });
    return count;
  }, [categorizedClusters]);

  // Calculate loaded news date ranges hint message
  const dateRangeHint = useMemo(() => {
    if (!localClusters || !Array.isArray(localClusters) || localClusters.length === 0) return "";
    
    const times = localClusters
      .map(c => new Date(c.earliest_article_at || c.latest_article_at).getTime())
      .filter(t => !isNaN(t));
      
    if (times.length === 0) return "";
    
    const earliestDate = new Date(Math.min(...times));
    const latestDate = new Date(Math.max(...times));
    
    return `Your news data ranges from ${formatDateToYYYYMMDD(earliestDate)} to ${formatDateToYYYYMMDD(latestDate)}`;
  }, [localClusters]);

  // Trending pill selection handler: selects card and scrolls to it smoothly
  const handleTrendingClick = (clusterId) => {
    setSelectedClusterId(clusterId);
    setTimeout(() => {
      const cardElement = document.getElementById(`cluster-${clusterId}`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  // Ticker headline click handler: expands category limits if needed, scrolls, opens drawer, and flashes card
  const handleTickerItemClick = (clusterId) => {
    const cluster = localClusters.find(c => c.id === clusterId);
    if (cluster) {
      const catId = getClusterCategory(cluster.label);
      const rawCatClusters = categorizedClusters[catId] || [];
      const catClusters = deduplicateClusters(rawCatClusters);
      const index = catClusters.findIndex(c => c.id === clusterId);
      
      const currentLimit = getLimitForCategory(catId);
      if (index >= 0 && index >= currentLimit) {
        // Expand the limit for that category to show the card
        const newLimit = Math.ceil((index + 1) / 6) * 6;
        if (catId === "disasters") setDisastersLimit(newLimit);
        else if (catId === "world") setWorldLimit(newLimit);
        else if (catId === "business") setBusinessLimit(newLimit);
        else if (catId === "science") setTechLimit(newLimit);
        else if (catId === "sports") setSportsLimit(newLimit);
        else setGeneralLimit(newLimit);
      }
    }

    // Set selected cluster ID to trigger details panel opening
    setSelectedClusterId(clusterId);

    // Scroll into view and flash highlight
    setTimeout(() => {
      const cardElement = document.getElementById(`cluster-${clusterId}`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
        cardElement.classList.add("highlight-flash");
        setTimeout(() => {
          cardElement.classList.remove("highlight-flash");
        }, 1500);
      }
    }, 150);
  };

  return (
    <div className="dashboard-container" style={{ flexDirection: "column" }}>
      
      {/* 1. TOP NAVBAR HEADER */}
      <header className="navbar-header">
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <a href="#" className="navbar-brand">News Pulse ⚡</a>
          
          {/* SILENT AUTO MONITORING LIVE STATISTICS */}
          {clustersData && (
            <div className="live-stats-bar">
              <span>📰 <AnimatedCounter value={totalArticles} /> {articleWord(totalArticles)}</span>
              <span className="live-stats-divider">•</span>
              <span>🧩 <AnimatedCounter value={totalClusters} /> {totalClusters === 1 ? 'cluster' : 'clusters'}</span>
              <span className="live-stats-divider">•</span>
              <span>⏱ Updated {lastUpdatedText}</span>
              <span className="live-stats-divider">•</span>
              {isValidating && !isLoading ? (
                <span className="pulse-dot-container" title="Checking for new stories..." style={{ color: "#F59E0B" }}>
                  <span className="pulse-dot-yellow" /> Updating...
                </span>
              ) : (
                <span className="pulse-dot-container" title="Automatically checking for new stories every 60 seconds." style={{ cursor: "help" }}>
                  <span className="pulse-dot" /> Live
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="navbar-controls">
          {/* Source Filter Checkbox Group */}
          <div className="navbar-filter-group">
            <span className="navbar-filter-label">Filter</span>
            {["BBC", "NPR", "Reuters", "Al Jazeera", "The Guardian"].map((source) => (
              <label key={source} className="navbar-checkbox">
                <input
                  type="checkbox"
                  checked={filters[source]}
                  onChange={() => toggleFilter(source)}
                />
                {source}
              </label>
            ))}
          </div>

          {/* Refresh control triggers ingestion */}
          <IngestButton onRefreshComplete={() => mutate()} />
        </div>
      </header>

      {/* 2. BREAKING NEWS HORIZONTAL TICKER BAR */}
      <BreakingNewsTicker
        clusters={breakingNews}
        onItemClick={handleTickerItemClick}
      />

      {/* 3. SCROLLABLE MAIN BODY */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        
        {/* Left Feed Panel */}
        <div className="left-panel">
          <main className="main-content">
            
            {/* Trending Now Section */}
            {trendingClusters.length > 0 && (
              <div className="trending-wrap">
                <div className="trending-header">
                  <span>🔥 Trending Now</span>
                </div>
                <div className="trending-container">
                  {trendingClusters.map((tc) => (
                    <button
                      key={tc.id}
                      className="trending-pill"
                      onClick={() => handleTrendingClick(tc.id)}
                    >
                      <span className="trending-fire">🔥</span>
                      <span style={{ marginRight: "0.25rem" }}>{tc.label}</span>
                      <span className="trending-count">{tc.article_count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input Box */}
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search topics, sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Date Filter Bar Row */}
            <div className="date-filter-bar" style={{ marginBottom: dateRangeHint ? "0.75rem" : "2.25rem" }}>
              <div className="date-input-group">
                <span>From:</span>
                <input
                  type="date"
                  className="date-picker"
                  value={tempFromDate}
                  max={getTodayString()}
                  onChange={(e) => setTempFromDate(e.target.value)}
                />
              </div>
              
              <div className="date-input-group">
                <span>To:</span>
                <input
                  type="date"
                  className="date-picker"
                  value={tempToDate}
                  min={tempFromDate}
                  max={getTodayString()}
                  onChange={(e) => setTempToDate(e.target.value)}
                />
              </div>

              <button className="apply-filter-btn" onClick={handleApplyFilter}>
                Apply Filter
              </button>

              <div className="quick-filters">
                <span className="quick-filter-label">Quick filter:</span>
                <button
                  className={`date-pill ${quickPillActive === "today" ? "active" : ""}`}
                  onClick={() => handleQuickFilterClick("today")}
                >
                  Today
                </button>
                <button
                  className={`date-pill ${quickPillActive === "24h" ? "active" : ""}`}
                  onClick={() => handleQuickFilterClick("24h")}
                >
                  Last 24h
                </button>
                <button
                  className={`date-pill ${quickPillActive === "7d" ? "active" : ""}`}
                  onClick={() => handleQuickFilterClick("7d")}
                >
                  Last 7 days
                </button>
                <button
                  className={`date-pill ${quickPillActive === "all" ? "active" : ""}`}
                  onClick={() => handleQuickFilterClick("all")}
                >
                  All time
                </button>
              </div>
            </div>

            {/* Date range hint message below picker row */}
            {dateRangeHint && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0px", marginBottom: "1.75rem", fontStyle: "italic" }}>
                {dateRangeHint}
              </p>
            )}

            {/* Active Date Filter Banner */}
            {isDateFilterApplied && (
              <div className="filter-active-banner">
                <span>
                  Showing news from <strong>{appliedFromDate || "the beginning"}</strong> to <strong>{appliedToDate || "today"}</strong>
                </span>
                <button className="clear-filter-btn" onClick={handleClearFilter}>
                  Clear filter ×
                </button>
              </div>
            )}

            {/* Loading/Error states */}
            {isLoading && !clustersData ? (
              <div style={{ marginTop: "1rem" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: "1.25rem", opacity: 0.65 }}>
                  Loading Latest Stories...
                </h2>
                <SkeletonGrid />
              </div>
            ) : error ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", color: "#EF4444", minHeight: "200px" }}>
                Error loading news feed. Make sure the Node.js backend is running on port 3001.
              </div>
            ) : (filteredClusters.length === 0 || visibleCategoriesCount === 0) ? (
              /* EMPTY STORIES STATE */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "350px", color: "var(--text-secondary)", gap: "1rem" }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                  <path d="M18 14h-8" />
                  <path d="M15 18h-5" />
                  <path d="M10 6h8v4h-8V6Z" />
                </svg>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>No stories found</h3>
                <p style={{ fontSize: "0.85rem", maxWidth: "280px", textAlign: "center" }}>
                  No active news items fit the current filters or search query.
                </p>
                <button 
                  className="apply-filter-btn" 
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => mutate()}
                >
                  Refresh Feed
                </button>
              </div>
            ) : (
              /* CATEGORY SECTIONS */
              CATEGORIES.map((cat) => {
                const rawCatClusters = categorizedClusters[cat.id] || [];
                // Deduplicate before displaying
                const catClusters = deduplicateClusters(rawCatClusters);
                
                // Hide category section completely if it contains fewer than 3 clusters
                if (catClusters.length < 3) return null;

                const limit = getLimitForCategory(cat.id);
                const visibleClusters = catClusters.slice(0, limit);

                return (
                  <section key={cat.id} style={{ marginBottom: "2.5rem" }}>
                    {/* Category Title Header */}
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      {cat.title}
                    </h2>
                    {/* Divider Line */}
                    <div style={{ height: "1px", backgroundColor: "var(--border-color)", marginBottom: "1rem" }} />
                    
                    {/* Category 3-Column Card Grid */}
                    <div key={`${cat.id}-${refreshKey}`} className="news-grid">
                      {visibleClusters.map((cluster) => {
                        const isSelected = cluster.id === selectedClusterId;
                        
                        const primarySource = cluster.latest_source || cluster.sources[0] || "BBC";
                        const displayTitle = cluster.latest_title || (cluster.label ? cluster.label.toUpperCase() : "Untitled Topic");
                        
                        // Fix Card text dynamically to actual article count summary
                        const displaySummary = getArticleCountSummary(cluster.article_count, cluster.sources);
                        const relativeTime = getRelativeTime(cluster.latest_published_at || cluster.latest_article_at);

                        // Extract TF-IDF keywords (prefer database keywords, fallback to label split)
                        const keywords = cluster.keywords && cluster.keywords.length > 0 
                          ? cluster.keywords 
                          : (cluster.label || "").split(" ").filter(w => w.length > 2);

                        // Source dots configuration
                        const displaySources = cluster.sources.slice(0, 4);
                        const extraSourcesCount = cluster.sources.length - 4;

                        return (
                          <article
                            id={`cluster-${cluster.id}`}
                            key={cluster.id}
                            className={`editorial-card ${isSelected ? "selected" : ""}`}
                            onClick={() => setSelectedClusterId(cluster.id)}
                            style={{ "--index": cluster.globalIndex }}
                          >
                            <div className="card-metadata">
                              <span className={getSourceBadgeClass(primarySource)}>
                                {primarySource}
                              </span>
                              <span className="timestamp">{relativeTime}</span>
                            </div>

                            {/* Title with Custom tooltip explaining why clustered */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                              <h3 className="card-headline" style={{ flex: 1 }}>{displayTitle}</h3>
                              
                              {/* Why Clustered Tooltip */}
                              {keywords.length > 0 && (
                                <div className="tooltip-container" onClick={(e) => e.stopPropagation()}>
                                  <Info size={14} style={{ color: "var(--text-secondary)", opacity: 0.6, cursor: "help" }} />
                                  <div className="tooltip-content">
                                    <p>Grouped because these keywords frequently appeared together:</p>
                                    <ul>
                                      {keywords.map(kw => (
                                        <li key={kw}>• {kw}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>

                            <p className="card-summary">{displaySummary}</p>

                            {/* Confidence indicators */}
                            {(() => {
                              const conf = getConfidenceScore(cluster.article_count);
                              return (
                                <div 
                                  title="Confidence is estimated from the number of corroborating articles." 
                                  style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.75rem", cursor: "help", padding: "0.2rem 0" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Match Strength</span>
                                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: conf.color, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                    {conf.blocks}
                                    <span style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>{conf.level}</span>
                                  </span>
                                </div>
                              );
                            })()}

                            <div className="card-footer" style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
                              {/* Source Coverage Colored Circles */}
                              <div 
                                className="source-dots-wrap" 
                                title={`Reporting publishers: ${cluster.sources.join(", ")}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {displaySources.map((src) => (
                                  <span 
                                    key={src}
                                    className="source-dot" 
                                    style={{ backgroundColor: getSourceColor(src) }}
                                    title={src}
                                  />
                                ))}
                                {extraSourcesCount > 0 && (
                                  <span className="source-plus-pill" title={cluster.sources.slice(4).join(", ")}>
                                    +{extraSourcesCount}
                                  </span>
                                )}
                              </div>

                              <span className="card-count-pill">
                                {cluster.article_count} {articleWord(cluster.article_count)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Load More Button */}
                    {catClusters.length > limit && (
                      <div className="load-more-container">
                        <button
                          className="load-more-btn"
                          onClick={() => incrementLimitForCategory(cat.id)}
                        >
                          Load more
                        </button>
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </main>
        </div>

        {/* Right Sidebar Details Drawer */}
        {selectedClusterId && (
          <>
            <div className="drawer-backdrop" onClick={() => setSelectedClusterId(null)} />
            <aside className="right-panel">
              <ClusterDetail
                clusterId={selectedClusterId}
                onClose={() => setSelectedClusterId(null)}
              />
            </aside>
          </>
        )}
      </div>

      {/* Top-Right Toast Notification */}
      {showToast && (
        <div id="toast-alert" className="toast-top-right">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
              📰 {newStoriesCount} New {newStoriesCount === 1 ? 'Story' : 'Stories'} Available
            </span>
            <button className="toast-close-btn" onClick={handleCloseToast} aria-label="Close notification">
              <X size={14} />
            </button>
          </div>
          <span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.75)" }}>
            The latest headlines have been added.
          </span>
        </div>
      )}
    </div>
  );
}
