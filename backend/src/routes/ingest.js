const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const jobs = require("../jobs");

const router = express.Router();

/**
 * POST /ingest/trigger
 * Spawns the Python scraper as a background child process.
 * Returns the generated jobId immediately.
 */
router.post("/trigger", (req, res) => {
  // Generate a human-readable job ID using timestamp
  const jobId = `job_${Date.now()}`;
  const startedAt = new Date().toISOString();

  // Initialize status in the in-memory registry
  jobs.set(jobId, {
    status: "running",
    startedAt: startedAt,
    completedAt: null,
    error: null,
  });

  // Load configuration from environment variables
  const pythonBin = process.env.PYTHON_BIN || "python";
  const relativeScriptPath = process.env.PYTHON_SCRIPT_PATH || "../scraper/main.py";
  
  // Resolve absolute paths
  const scriptAbsPath = path.resolve(process.cwd(), relativeScriptPath);
  const scriptDir = path.dirname(scriptAbsPath);

  console.log(`[Jobs] Triggering job ${jobId}. Bin: ${pythonBin}, Script: ${scriptAbsPath}`);

  // Spawn child process. Set Cwd to script directory so imports and .env work inside the scraper.
  const child = spawn(pythonBin, [scriptAbsPath], {
    cwd: scriptDir,
    env: { ...process.env } // Inherit parent environment
  });

  let stdoutAccumulator = "";
  let stderrAccumulator = "";

  child.stdout.on("data", (data) => {
    stdoutAccumulator += data.toString();
  });

  child.stderr.on("data", (data) => {
    stderrAccumulator += data.toString();
  });

  // Hook up close event
  child.on("close", (code) => {
    const completedAt = new Date().toISOString();
    const currentJob = jobs.get(jobId);

    if (code === 0) {
      console.log(`[Jobs] Job ${jobId} completed successfully.`);
      jobs.set(jobId, {
        ...currentJob,
        status: "done",
        completedAt: completedAt,
      });
    } else {
      console.error(`[Jobs] Job ${jobId} failed with exit code ${code}. Stderr: ${stderrAccumulator}`);
      jobs.set(jobId, {
        ...currentJob,
        status: "failed",
        completedAt: completedAt,
        error: stderrAccumulator.trim() || `Process exited with code ${code}`,
      });
    }
  });

  // Hook up process level error event (e.g. command not found)
  child.on("error", (err) => {
    const completedAt = new Date().toISOString();
    const currentJob = jobs.get(jobId);

    console.error(`[Jobs] Job ${jobId} failed to start: ${err.message}`);
    jobs.set(jobId, {
      ...currentJob,
      status: "failed",
      completedAt: completedAt,
      error: `Failed to spawn Python process: ${err.message}`,
    });
  });

  // Return job ID immediately
  return res.json({ jobId });
});

/**
 * GET /ingest/status/:jobId
 * Returns the status of the specified job ID.
 */
router.get("/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: `Job ID ${jobId} not found` });
  }

  // Format exactly as requested: { jobId, status, completedAt } (including startedAt/error for better debugging)
  return res.json({
    jobId,
    status: job.status,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
  });
});

module.exports = router;
