// In-memory registry to store job states
// Key: jobId (string) -> Value: { status, startedAt, completedAt, error }
const jobs = new Map();

module.exports = {
  /**
   * Retrieves status for a given job.
   * @param {string} id - Job identifier
   * @returns {object|undefined}
   */
  get: (id) => jobs.get(id),

  /**
   * Registers or updates a job status.
   * @param {string} id - Job identifier
   * @param {object} data - Job status details
   */
  set: (id, data) => jobs.set(id, data),

  /**
   * Checks if a job identifier exists in the registry.
   * @param {string} id - Job identifier
   * @returns {boolean}
   */
  has: (id) => jobs.has(id),

  /**
   * Deletes a job registry entry.
   * @param {string} id - Job identifier
   * @returns {boolean}
   */
  delete: (id) => jobs.delete(id),

  /**
   * Lists all active job records.
   * @returns {Array} List of [jobId, jobData] pairs
   */
  list: () => Array.from(jobs.entries()),
};
