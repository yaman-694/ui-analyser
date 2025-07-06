import Redis from "ioredis";

// Initialize Redis client
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    reconnectOnError: (err) => {
		console.error("Redis connection error:", err.message);
		return true; // Attempt reconnect on error
	},
	retryStrategy: (times) => {
		console.warn(`Retrying Redis connection attempt #${times}`);
		// Return time in ms to retry, or null to stop retrying
		return Math.min(times * 100, 3000);
	}
});
  
export default redis;