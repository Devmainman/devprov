// src/config/env.js
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, './config.env');

const loadEnv = () => {
  const result = config({ path: envPath });
  if (result.error) throw result.error;
  
  console.log('Env Loaded:', {
    twilioSid: !!process.env.TWILIO_ACCOUNT_SID,
    jwtSecret: !!process.env.JWT_SECRET
  });
  
  return process.env;
};

export default loadEnv();