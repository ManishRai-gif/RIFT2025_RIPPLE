require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  retryLimit: parseInt(process.env.RETRY_LIMIT || '5', 10),
  geminiTimeout: 60000,
  dockerTimeout: 120000,
};
