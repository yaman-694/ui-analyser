/**
 * Create connection to Redis and a queue for processing URLs.
 */

import { Queue } from "bullmq";
import redis from "../config/redis";

/**
 * Queue for processing URLs.
 *
 * @type {Queue}
 * @property {Object} connection - The Redis connection object.
 * @property {Object} defaultJobOptions - Default options for jobs in the queue.
 * @property {number} defaultJobOptions.attempts - Number of attempts to process the job.
 * @property {Object} defaultJobOptions.backoff - Backoff strategy for retries.
 * @property {string} defaultJobOptions.backoff.type - Type of backoff strategy (e.g., "exponential").
 * @property {number} defaultJobOptions.backoff.delay - Delay in milliseconds for the backoff.
 */
export const analyzeUIQueue = new Queue("analyze-ui", {
	connection: redis,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 1000
		}
	}
});
