import { config } from 'dotenv';
config();

import cors from 'cors';
import express from 'express';
import { errorHandler, notFound } from './middleware/error.middleware';
import { attachServices } from './middleware/services.middleware';

import { mongodbConnect } from './config/mongodb';
import router from './routes';

// Initialize the Express application
const app = express();
const port = process.env.API_PORT || 3001;

// For all other routes - parse JSON as usual
app.use(express.json());

mongodbConnect();

// Enable CORS for all routes
app.use(cors({
  origin: (origin, callback) => {
    const isProd = process.env.NODE_ENV === 'production';
    // Allow all in dev and non-browser requests (no origin header)
    if (!isProd || !origin) return callback(null, true);

    // In prod, read allowed origins from env: CLIENT_URLS (comma-separated) or CLIENT_URL (single)
    const raw = process.env.CLIENT_URLS || process.env.CLIENT_URL || '';
    const allowedOrigins = raw.split(',').map(s => s.trim()).filter(Boolean);

    return allowedOrigins.includes(origin)
      ? callback(null, true)
      : callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Register global middleware
app.use(attachServices);

// Register routes
app.use(router);

// 404 handler for undefined routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
