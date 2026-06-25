import logging
import re
from html.parser import HTMLParser
import feedparser
import trafilatura
from newspaper import Article

logger = logging.getLogger(__name__)

class HTMLTagStripper(HTMLParser):
    """
    Simple parser to strip HTML tags from a string.
    """
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []
        
    def handle_data(self, d):
        self.fed.append(d)
        
    def get_data(self):
        return "".join(self.fed)

def strip_html_tags(html_text: str) -> str:
    """
    Strips HTML tags from summary or body.
    """
    if not html_text:
        return ""
    try:
        stripper = HTMLTagStripper()
        stripper.feed(html_text)
        cleaned = stripper.get_data()
        # Replace multiple spaces/newlines with single ones
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()
    except Exception as e:
        logger.warning(f"Failed to strip HTML tags: {e}")
        return html_text

def fetch_feed_entries(feed_url: str) -> list:
    """
    Fetches and parses raw feed entries from a given URL using feedparser.
    """
    logger.info(f"Parsing RSS feed from {feed_url}...")
    try:
        feed = feedparser.parse(feed_url)
        if feed.bozo:
            logger.warning(f"Feedparser flagged a bozo exception or parsing warning for {feed_url}: {feed.bozo_exception}")
        
        entries = feed.entries
        logger.info(f"Successfully fetched {len(entries)} entries from {feed_url}")
        return entries
    except Exception as e:
        logger.error(f"Failed to fetch RSS feed from {feed_url}: {e}")
        return []

def extract_with_trafilatura(url: str) -> str or None:
    """
    Extracts text content using trafilatura.
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            extracted_text = trafilatura.extract(downloaded)
            if extracted_text:
                return extracted_text.strip()
    except Exception as e:
        logger.debug(f"trafilatura failed for URL {url}: {e}")
    return None

def extract_with_newspaper(url: str) -> str or None:
    """
    Extracts text content using newspaper3k.
    """
    try:
        article = Article(url)
        article.download()
        article.parse()
        if article.text:
            return article.text.strip()
    except Exception as e:
        logger.debug(f"newspaper3k failed for URL {url}: {e}")
    return None

def extract_full_text(url: str, summary_fallback: str) -> str:
    """
    Attempts to fetch full article body text using trafilatura (preferred).
    Falls back to newspaper3k if trafilatura fails.
    Falls back to tag-stripped summary if both fail.
    """
    logger.info(f"Extracting full body for: {url}")
    
    # 1. Try Trafilatura
    try:
        body = extract_with_trafilatura(url)
        if body:
            logger.info("Successfully extracted text using trafilatura.")
            return body
    except Exception as e:
        logger.warning(f"Error executing trafilatura on {url}: {e}")
        
    # 2. Try Newspaper3k
    try:
        body = extract_with_newspaper(url)
        if body:
            logger.info("Successfully extracted text using newspaper3k.")
            return body
    except Exception as e:
        logger.warning(f"Error executing newspaper3k on {url}: {e}")
        
    # 3. Fallback to summary (stripped of HTML tags)
    logger.info("Both full text extractors failed. Falling back to stripped summary.")
    return strip_html_tags(summary_fallback)
