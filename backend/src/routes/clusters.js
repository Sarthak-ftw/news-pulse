const express = require("express");
const db = require("../db");

const router = express.Router();

/**
 * GET /clusters
 * Returns all clusters sorted by latest_article_at descending.
 * Supports optional source query parameter filtering: ?source=BBC
 */
router.get("/", async (req, res, next) => {
  try {
    const { source } = req.query;
    let queryText = `
      SELECT 
        c.id, 
        c.label, 
        c.article_count, 
        c.earliest_article_at, 
        c.latest_article_at, 
        c.sources,
        c.keywords,
        a.title AS latest_title,
        a.summary AS latest_summary,
        a.source AS latest_source,
        a.published_at AS latest_published_at
      FROM clusters c
      LEFT JOIN LATERAL (
        SELECT title, summary, source, published_at
        FROM articles
        WHERE cluster_id = c.id
        ORDER BY published_at DESC
        LIMIT 1
      ) a ON true
    `;
    const params = [];

    if (source) {
      // Use PostgreSQL array containment check
      queryText += " WHERE $1 = ANY(c.sources)";
      params.push(source.trim());
    }

    queryText += " ORDER BY c.latest_article_at DESC";

    const result = await db.query(queryText, params);
    
    // Express responds with json representation
    return res.json(result.rows);
  } catch (error) {
    // Delegate to central error middleware (never expose raw DB errors)
    return next(error);
  }
});

/**
 * GET /clusters/:id
 * Returns metadata of a specific cluster along with all its articles sorted by published_at ascending.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch cluster metadata
    const clusterQuery = `
      SELECT 
        id, 
        label, 
        article_count, 
        earliest_article_at, 
        latest_article_at, 
        sources,
        keywords
      FROM clusters 
      WHERE id = $1
    `;
    const clusterResult = await db.query(clusterQuery, [id]);

    if (clusterResult.rows.length === 0) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    const cluster = clusterResult.rows[0];

    // Fetch articles linked to this cluster, excluding the large body content
    const articlesQuery = `
      SELECT 
        id, 
        title, 
        summary, 
        url, 
        source, 
        published_at 
      FROM articles 
      WHERE cluster_id = $1 
      ORDER BY published_at ASC
    `;
    const articlesResult = await db.query(articlesQuery, [id]);

    // Attach articles list to the cluster metadata object
    cluster.articles = articlesResult.rows;

    return res.json(cluster);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
