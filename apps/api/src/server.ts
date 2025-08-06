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
  origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : '*',
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
