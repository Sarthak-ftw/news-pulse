import sys
import logging
import time
import db
import fetcher
import normalizer
import clusterer

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# RSS Feeds configuration
# BBC World, BBC Technology, BBC Business, NPR World, NPR Politics, Reuters World, Reuters Business, Guardian World, Guardian Tech, Al Jazeera
FEEDS = [
    {
        "source": "BBC", 
        "url": "http://feeds.bbci.co.uk/news/world/rss.xml"
    },
    {
        "source": "BBC", 
        "url": "http://feeds.bbci.co.uk/news/technology/rss.xml"
    },
    {
        "source": "BBC", 
        "url": "http://feeds.bbci.co.uk/news/business/rss.xml"
    },
    {
        "source": "NPR", 
        "url": "https://feeds.npr.org/1004/rss.xml"
    },
    {
        "source": "NPR", 
        "url": "https://feeds.npr.org/1014/rss.xml"
    },
    {
        "source": "Reuters", 
        "url": "https://feeds.reuters.com/Reuters/worldNews"
    },
    {
        "source": "Reuters", 
        "url": "https://feeds.reuters.com/reuters/businessNews"
    },
    {
        "source": "The Guardian", 
        "url": "https://www.theguardian.com/world/rss"
    },
    {
        "source": "The Guardian", 
        "url": "https://www.theguardian.com/technology/rss"
    },
    {
        "source": "Al Jazeera",
        "url": "https://www.aljazeera.com/xml/rss/all.xml"
    }
]

def run_pipeline():
    logger.info("Executing News Pulse pipeline run...")
    
    # 1. Establish database connection and initialize schema
    try:
        conn = db.get_db_connection()
        db.init_db(conn)
    except Exception as e:
        logger.critical(f"Database connection or initialization failed: {e}")
        return 0, 0
        
    # 2. Fetch and normalize articles from RSS feeds
    raw_entries_with_sources = []
    
    for feed_config in FEEDS:
        source = feed_config["source"]
        url = feed_config["url"]
        
        entries = fetcher.fetch_feed_entries(url)
        
        # Limit to 100 articles per feed (max 1000 total)
        entries = entries[:100]
            
        for entry in entries:
            raw_entries_with_sources.append((entry, source))
            
    if not raw_entries_with_sources:
        logger.warning("No entries fetched from any RSS feed.")
        conn.close()
        return 0, 0

    logger.info(f"Total raw RSS entries fetched: {len(raw_entries_with_sources)}")
    
    # Normalize entries
    normalized_articles = []
    for entry, source in raw_entries_with_sources:
        normalized = normalizer.normalize_entry(entry, source)
        if normalized:
            normalized_articles.append(normalized)
            
    logger.info(f"Successfully normalized {len(normalized_articles)} articles.")
    
    # Local deduplication to prevent duplicate constraint issues during bulk insert
    seen_ids = set()
    deduped_articles = []
    for art in normalized_articles:
        if art["id"] not in seen_ids:
            seen_ids.add(art["id"])
            deduped_articles.append(art)
    normalized_articles = deduped_articles
    
    if not normalized_articles:
        logger.warning("No articles remained after normalization.")
        conn.close()
        return 0, 0
        
    # 3. Deduplicate against the database
    all_hashes = [art["id"] for art in normalized_articles]
    try:
        existing_hashes = db.get_existing_article_ids(conn, all_hashes)
        logger.info(f"Found {len(existing_hashes)} duplicate articles already in database.")
    except Exception as e:
        logger.error(f"Failed to query existing articles for deduplication: {e}")
        conn.close()
        return 0, 0
        
    # Filter for new articles only
    new_articles = [art for art in normalized_articles if art["id"] not in existing_hashes]
    logger.info(f"Number of new articles to process: {len(new_articles)}")
    
    if not new_articles:
        logger.info("No new articles to fetch or cluster.")
        conn.close()
        return 0, 0
        
    # 4. Extract full body text (with graceful fallback to summary)
    for index, art in enumerate(new_articles, 1):
        logger.info(f"[{index}/{len(new_articles)}] Extracting content for: {art['title']}")
        art["body"] = fetcher.extract_full_text(art["url"], art["summary"])
        
    # 5. Run TF-IDF clustering on all new articles
    try:
        new_articles_with_clusters, clusters = clusterer.cluster_articles(new_articles, similarity_threshold=0.08)
    except Exception as e:
        logger.error(f"Error during article clustering: {e}. Defaulting to generic clustering.")
        new_articles_with_clusters, clusters = new_articles, []
        
    # 6. Save clusters and articles to the database
    try:
        if clusters:
            db.save_clusters(conn, clusters)
        db.save_articles(conn, new_articles_with_clusters)
        logger.info("Successfully persisted clusters and articles to database.")
    except Exception as e:
        logger.error(f"Failed to save results to database: {e}")
        conn.rollback()
        conn.close()
        return 0, 0
        
    conn.close()
    return len(new_articles), len(clusters)

def main():
    logger.info("Starting News Pulse scraping and clustering pipeline...")
    
    total_articles = 0
    total_clusters = 0
    
    for i in range(3):
        print(f"Scrape run {i+1}/3...")
        new_arts, new_clusts = run_pipeline()
        total_articles += new_arts
        total_clusters += new_clusts
        if i < 2:
            time.sleep(5)
            
    # Format matches the required job summary parser output: "Fetched X articles, created Y clusters"
    print(f"Fetched {total_articles} articles, created {total_clusters} clusters")

if __name__ == "__main__":
    main()
