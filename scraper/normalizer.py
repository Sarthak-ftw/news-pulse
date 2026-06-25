import hashlib
import logging
import datetime
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)

def normalize_entry(entry: dict, source_name: str) -> dict or None:
    """
    Normalizes a single RSS feed entry dict into the unified schema:
    {
      "id": str,          # sha256 hash of url
      "title": str,
      "summary": str,
      "body": str,        # starts empty
      "url": str,
      "source": str,
      "published_at": datetime
    }
    """
    url = entry.get("link") or entry.get("id")
    if not url:
        logger.warning(f"Skipping RSS entry '{entry.get('title', 'No Title')}' because it lacks a URL/ID.")
        return None
    
    url = url.strip()
    
    # Unique ID: sha256 of URL
    article_id = hashlib.sha256(url.encode("utf-8")).hexdigest()
    
    title = entry.get("title", "").strip()
    if not title:
        title = "Untitled Article"
        
    # Extract summary
    # 1. Check content:encoded (feedparser puts this in entry.content list)
    summary = ""
    content_list = entry.get("content")
    if content_list and len(content_list) > 0:
        summary = content_list[0].get("value", "")
        
    # 2. Check summary (corresponds to <summary> or <description>)
    if not summary:
        summary = entry.get("summary", "")
        
    # 3. Check description explicitly (in case feedparser didn't map it to summary)
    if not summary:
        summary = entry.get("description", "")
        
    # Clean up summary
    summary = summary.strip()
    
    # Parse published date
    published_at = None
    
    # Look for raw strings in standard RSS fields
    date_keys = ["published", "pubDate", "dc:date", "updated", "created"]
    for key in date_keys:
        val = entry.get(key)
        if val:
            try:
                published_at = date_parser.parse(str(val))
                # Ensure date is timezone-aware
                if published_at.tzinfo is None:
                    published_at = published_at.replace(tzinfo=datetime.timezone.utc)
                break
            except Exception:
                continue
                
    # Fallback to feedparser's parsed structure tuple if parsing raw strings failed
    if not published_at:
        pub_parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        if pub_parsed:
            try:
                published_at = datetime.datetime(*pub_parsed[:6], tzinfo=datetime.timezone.utc)
            except Exception:
                pass
                
    # Fallback to current time if still None
    if not published_at:
        published_at = datetime.datetime.now(datetime.timezone.utc)
        
    return {
        "id": article_id,
        "title": title,
        "summary": summary,
        "body": "",  # Will be extracted later
        "url": url,
        "source": source_name,
        "published_at": published_at
    }
