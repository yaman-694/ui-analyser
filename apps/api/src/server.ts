import { config } from 'dotenv';
config();

import express from 'express';
import { errorHandler, notFound } from './middleware/error.middleware';
import router from './routes';

// Initialize the Express application
const app = express();
const port = process.env.PORT || 3000;

// Middleware configuration for different routes
// Special handling for Stripe webhook - it needs the raw body for signature verification
// Use the correct path based on your API version
const version = process.env.API_VERSION || 'v1';
app.use(`/api/${version}/webhook/stripe`, express.raw({ type: 'application/json' }));

// For all other routes - parse JSON as usual
app.use(express.json());

// Register global middleware
import { attachServices } from './middleware/services.middleware';
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
