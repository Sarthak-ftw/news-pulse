import os
import logging
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

load_dotenv()

def get_db_connection():
    """
    Establish a connection to the PostgreSQL database.
    Prioritizes DATABASE_URL environment variable, falls back to PG* env vars,
    and defaults to localhost with user/pass postgres if nothing is set.
    """
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        logger.info("Connecting to database using DATABASE_URL.")
        return psycopg2.connect(db_url)
    
    # Fallback to individual connection parameters
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "postgres")
    dbname = os.getenv("PGDATABASE", "newspulse")
    
    logger.info(f"Connecting to database {dbname} on {host}:{port} as user {user}.")
    return psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname
    )

def init_db(conn):
    """
    Creates the articles and clusters tables if they do not exist.
    """
    create_clusters_table_sql = """
    CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        article_count INTEGER DEFAULT 0,
        earliest_article_at TIMESTAMP WITH TIME ZONE,
        latest_article_at TIMESTAMP WITH TIME ZONE,
        sources TEXT[],
        keywords TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    create_articles_table_sql = """
    CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        body TEXT,
        url TEXT NOT NULL,
        source TEXT NOT NULL,
        published_at TIMESTAMP WITH TIME ZONE,
        cluster_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    with conn.cursor() as cur:
        logger.info("Initializing database schema...")
        cur.execute(create_clusters_table_sql)
        cur.execute(create_articles_table_sql)
        # Migrate schema dynamically in case tables were already initialized
        cur.execute("ALTER TABLE clusters ADD COLUMN IF NOT EXISTS keywords TEXT[];")
        conn.commit()
        logger.info("Database schema initialized successfully.")

def get_existing_article_ids(conn, article_ids: list) -> set:
    """
    Takes a list of article IDs (hashes) and returns a set containing the ones
    that are already present in the database. Useful for bulk deduplication.
    """
    if not article_ids:
        return set()
    
    with conn.cursor() as cur:
        # Check membership using standard SQL array format
        cur.execute("SELECT id FROM articles WHERE id = ANY(%s)", (list(article_ids),))
        rows = cur.fetchall()
        return {row[0] for row in rows}

def save_clusters(conn, clusters: list[dict]):
    """
    Saves a list of clusters to the database using bulk upsert.
    Expects each cluster dict to match:
    {
        "cluster_id": str,
        "label": str,
        "article_count": int,
        "earliest_article_at": datetime,
        "latest_article_at": datetime,
        "sources": list[str],
        "keywords": list[str]
    }
    """
    if not clusters:
        return
    
    upsert_sql = """
    INSERT INTO clusters (
        id, label, article_count, earliest_article_at, latest_article_at, sources, keywords
    ) VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        article_count = EXCLUDED.article_count,
        earliest_article_at = EXCLUDED.earliest_article_at,
        latest_article_at = EXCLUDED.latest_article_at,
        sources = EXCLUDED.sources,
        keywords = EXCLUDED.keywords,
        updated_at = NOW();
    """
    
    values = [
        (
            c["cluster_id"],
            c["label"],
            c["article_count"],
            c["earliest_article_at"],
            c["latest_article_at"],
            c["sources"],
            c.get("keywords", [])
        )
        for c in clusters
    ]
    
    with conn.cursor() as cur:
        logger.info(f"Saving {len(clusters)} clusters to the database...")
        execute_values(cur, upsert_sql, values)
        conn.commit()

def save_articles(conn, articles: list[dict]):
    """
    Saves a list of normalized articles to the database.
    Expects each article dict to match:
    {
        "id": str,
        "title": str,
        "summary": str,
        "body": str,
        "url": str,
        "source": str,
        "published_at": datetime,
        "cluster_id": str or None
    }
    """
    if not articles:
        return
    
    upsert_sql = """
    INSERT INTO articles (
        id, title, summary, body, url, source, published_at, cluster_id
    ) VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        body = EXCLUDED.body,
        url = EXCLUDED.url,
        source = EXCLUDED.source,
        published_at = EXCLUDED.published_at,
        cluster_id = EXCLUDED.cluster_id;
    """
    
    values = [
        (
            a["id"],
            a["title"],
            a["summary"],
            a["body"],
            a["url"],
            a["source"],
            a["published_at"],
            a.get("cluster_id")
        )
        for a in articles
    ]
    
    with conn.cursor() as cur:
        logger.info(f"Saving {len(articles)} articles to the database...")
        execute_values(cur, upsert_sql, values)
        conn.commit()
