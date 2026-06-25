import uuid
import logging
from collections import defaultdict
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

class UnionFind:
    """
    Standard Union-Find (Disjoint Set Union) data structure with path compression.
    Used for greedy grouping of articles into connected components based on similarity.
    """
    def __init__(self, n):
        self.parent = list(range(n))
        
    def find(self, i):
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])  # Path compression
        return self.parent[i]
        
    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j

import re

def clean_text_for_tfidf(text: str) -> str:
    """
    Strips URLs, domain names, publisher noise, and non-alphabetic chars
    to clean the text before TF-IDF vectorization.
    """
    # Remove URLs
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    # Convert to lowercase
    text = text.lower()
    # Remove publisher names, domain keywords, and generic words
    noise_words = ['npr', 'bbc', 'reuters', 'news', 'www', 'guardian', 'world', 'com', 'co', 'uk', 'rss', 'feed']
    for word in noise_words:
        text = re.sub(r'\b' + word + r'\b', '', text)
    # Keep only alphabetic characters
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    # Collapse extra whitespaces
    return re.sub(r'\s+', ' ', text).strip()

def cluster_articles(articles: list[dict], similarity_threshold: float = 0.08) -> tuple[list[dict], list[dict]]:
    """
    Groups articles into clusters based on title + summary similarity.
    
    Returns:
        tuple: (updated_articles, list_of_clusters)
        where each article has its "cluster_id" set, and each cluster has the format:
        {
          "cluster_id": str (uuid),
          "label": str,
          "article_ids": list[str],
          "article_count": int,
          "earliest_article_at": datetime,
          "latest_article_at": datetime,
          "sources": list[str]
        }
    """
    if not articles:
        logger.info("No articles to cluster.")
        return [], []
        
    n = len(articles)
    logger.info(f"Clustering {n} articles with TF-IDF and Cosine Similarity threshold = {similarity_threshold}...")
    
    # 1. Combine title and summary for feature extraction
    # Replace None summaries with empty strings
    texts = []
    for art in articles:
        title = art.get("title") or ""
        summary = art.get("summary") or ""
        combined = title + " " + summary
        texts.append(clean_text_for_tfidf(combined))
        
    # 2. Extract TF-IDF features
    # Combine standard English stop words with our custom list of noise words
    custom_stop_words = list(ENGLISH_STOP_WORDS) + [
        "href", "http", "https", "www", "html", "com", "org", "net", "src", "alt", "img", "div", "class", "span",
        "new", "said", "says", "also", "would", "could", "year", "years", "just", "like", "more", "one", "two", "three",
        "will", "have", "been", "that", "this", "with", "from", "they", "their", "were", "about", "after", "before", "during", "through"
    ]
    vectorizer = TfidfVectorizer(stop_words=custom_stop_words, max_features=5000)
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except Exception as e:
        logger.warning(f"TF-IDF vectorizer failed (likely due to empty texts or only stop words): {e}")
        # Fallback: group all articles into a single generic cluster
        fallback_cluster_id = str(uuid.uuid4())
        times = [a["published_at"] for a in articles]
        sources = list(set(a["source"] for a in articles))
        for a in articles:
            a["cluster_id"] = fallback_cluster_id
            
        fallback_cluster = {
            "cluster_id": fallback_cluster_id,
            "label": "general news",
            "article_ids": [a["id"] for a in articles],
            "article_count": len(articles),
            "earliest_article_at": min(times),
            "latest_article_at": max(times),
            "sources": sources
        }
        return articles, [fallback_cluster]
        
    # 3. Calculate pairwise cosine similarity
    sim_matrix = cosine_similarity(tfidf_matrix)
    
    # 4. Group using Union-Find
    uf = UnionFind(n)
    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i, j] > similarity_threshold:
                uf.union(i, j)
                
    # 5. Extract components
    components = defaultdict(list)
    for i in range(n):
        root = uf.find(i)
        components[root].append(i)
        
    # 6. Generate clusters and labels
    feature_names = vectorizer.get_feature_names_out()
    clusters = []
    
    for root, indices in components.items():
        cluster_id = str(uuid.uuid4())
        cluster_articles = [articles[idx] for idx in indices]
        
        # Link articles to this cluster ID
        for art in cluster_articles:
            art["cluster_id"] = cluster_id
            
        # Time metadata
        times = [art["published_at"] for art in cluster_articles]
        earliest_article_at = min(times)
        latest_article_at = max(times)
        
        # Sources metadata
        sources = list(set(art["source"] for art in cluster_articles))
        
        # Calculate cluster label (top 3 TF-IDF terms) and extract up to 5 keywords
        cluster_tfidf = tfidf_matrix[indices]
        # Average weight for each word across all articles in this cluster
        mean_weights = np.asarray(cluster_tfidf.mean(axis=0)).flatten()
        top_indices = mean_weights.argsort()[::-1]
        
        # Take the top 5 terms that have non-zero average weight
        keywords = []
        for idx in top_indices:
            if mean_weights[idx] > 0:
                keywords.append(feature_names[idx])
            if len(keywords) == 5:
                break
                
        label = " ".join(keywords[:3]) if keywords else "general news"
        
        clusters.append({
            "cluster_id": cluster_id,
            "label": label,
            "article_ids": [art["id"] for art in cluster_articles],
            "article_count": len(cluster_articles),
            "earliest_article_at": earliest_article_at,
            "latest_article_at": latest_article_at,
            "sources": sources,
            "keywords": keywords
        })
        
    logger.info(f"Formed {len(clusters)} clusters from {n} articles.")
    return articles, clusters
