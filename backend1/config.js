const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3002', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  retryLimit: parseInt(process.env.RETRY_LIMIT || '1', 10)
};

