const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/newspulse";

// Strip password from connection string for logging safety
const safeLogString = connectionString.replace(/:[^:@\n]+@/, ":****@");
console.log(`[Database] Initializing pg pool connection to: ${safeLogString}`);

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false,
});

// Log pool errors
pool.on("error", (err) => {
  console.error("[Database] Unexpected error on idle client:", err.message);
});

module.exports = {
  /**
   * Execute a query against the connection pool.
   * @param {string} text - SQL statement
   * @param {Array} params - query parameters
   */
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (error) {
      console.error(`[Database] Query Execution Error: ${error.message} (SQL: ${text})`);
      throw error; // Let router/middleware catch it and respond with standard 500
    }
  },
  pool,
};
