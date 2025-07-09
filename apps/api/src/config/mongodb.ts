import mongoose from "mongoose";

// MongoDB connection instance.
let connection: typeof mongoose | null = null;

/**
 * Connect to the MongoDB database.
 * @returns {Promise<void>}
 */
export async function mongodbConnect() {
	try {
		connection = await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/uianalyser");
	} catch (error) {
		console.error("MongoDB connection error: ", error);
		process.exit(1);
	}
}

/**
 * Disconnect from the MongoDB database.
 * @returns {Promise<void>}
 */
export async function mongodbDisconnect() {
	if (connection) {
		try {
			await mongoose.disconnect();
			console.log("Disconnected from MongoDB");
		} catch (error) {
			console.error("MongoDB disconnection error: ", error);
		}
	}
}
