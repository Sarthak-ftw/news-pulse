const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment configurations
dotenv.config();

const clustersRouter = require("./routes/clusters");
const timelineRouter = require("./routes/timeline");
const ingestRouter = require("./routes/ingest");
const db = require("./db");

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/clusters", clustersRouter);
app.use("/timeline", timelineRouter);
app.use("/ingest", ingestRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized error handler middleware (never leaks database details)
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack || err.message);
  
  // Respond with a clean generic internal server error
  return res.status(500).json({ 
    error: "An internal server error occurred. Please try again later." 
  });
});

// Start listening
const server = app.listen(port, () => {
  console.log(`[Server] News Pulse Node.js backend listening on port ${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log("[Server] Shutdown signal received. Closing pool and server...");
  server.close(() => {
    console.log("[Server] HTTP server closed.");
    db.pool.end(() => {
      console.log("[Database] Pool connections drained. Exit.");
      process.exit(0);
    });
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
