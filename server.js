import app from './app';
import connectDB from './config/db';
import { createServer } from 'http';
import cron from './services/cronService';

// Load environment variables
require('dotenv').config({ path: './config/config.env' });

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

console.log('Starting cron jobs...');
import './services/cronService';

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});