const config = require('../config');
const logger = require('./logger');

let genAI = null;

function getClient() {
  if (!config.geminiApiKey) return null;
  try {
    if (!genAI) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      genAI = new GoogleGenerativeAI(config.geminiApiKey);
    }
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  } catch (err) {
    logger.error('Gemini client init error:', err.message);
    return null;
  }
}

async function generateContent(prompt, options = {}) {
  const client = getClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const timeout = options.timeout || config.geminiTimeout;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const result = await Promise.race([
      client.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout')), timeout)
      ),
    ]);
    clearTimeout(timeoutId);
    const response = result.response;
    const text = response?.text?.();
    if (!text) throw new Error('Empty Gemini response');
    return text.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

module.exports = { generateContent, extractJson };
