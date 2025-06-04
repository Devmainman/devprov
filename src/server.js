import app from './app.js';
import connectDB from './config/db.js';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the correct directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - using absolute path
const envPath = path.join(__dirname, '../../userend/src/config/config.env');
console.log('Environment file path:', envPath);

// Verify file exists
import fs from 'fs';
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: config.env file not found at:', envPath);
  process.exit(1);
}

dotenv.config({ path: envPath });

// Debug loaded variables
console.log('Loaded environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI ? '*****' : 'NOT FOUND'
});


// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});