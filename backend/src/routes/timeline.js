const express = require("express");
const db = require("../db");

const router = express.Router();

/**
 * GET /timeline
 * Returns all clusters formatted for the timeline chart.
 * Supports optional source query parameter filtering: ?source=BBC
 * Computes intensity = article_count / max_article_count_across_all_clusters.
 */
router.get("/", async (req, res, next) => {
  try {
    const { source } = req.query;

    // 1. Fetch the global maximum article count across all clusters in the database
    const maxQuery = "SELECT MAX(article_count) AS max_count FROM clusters";
    const maxResult = await db.query(maxQuery);
    const maxCount = parseInt(maxResult.rows[0].max_count, 10) || 0;

    // 2. Fetch the timeline clusters list (optionally filtered by source)
    let queryText = `
      SELECT 
        id, 
        label, 
        earliest_article_at AS start, 
        latest_article_at AS "end", 
        article_count, 
        sources 
      FROM clusters
    `;
    const params = [];

    if (source) {
      queryText += " WHERE $1 = ANY(sources)";
      params.push(source.trim());
    }

    queryText += " ORDER BY latest_article_at DESC";

    const result = await db.query(queryText, params);
    const clusters = result.rows;

    // 3. Map the clusters to the timeline format, calculating intensity
    const response = clusters.map((c) => {
      // Calculate intensity relative to global max count
      const intensity = maxCount > 0 ? parseFloat((c.article_count / maxCount).toFixed(4)) : 0;
      
      return {
        id: c.id,
        label: c.label,
        start: c.start,
        end: c.end,
        article_count: c.article_count,
        sources: c.sources,
        intensity: intensity,
      };
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
