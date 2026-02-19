const config = require('../config');
const logger = require('./logger');

let genAI = null;

function truncate(text, max = 1600) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated ${s.length - max} chars]`;
}

function safeTag(tag) {
  const t = String(tag || 'gemini').trim();
  return t.length > 60 ? t.slice(0, 60) : t;
}

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
  const tag = safeTag(options.tag);
  const startedAt = Date.now();
  
  try {
    logger.info(`[${tag}] prompt:\n${truncate(prompt, 2400)}`);
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
    const trimmed = text.trim();
    logger.info(`[${tag}] response (${Date.now() - startedAt}ms):\n${truncate(trimmed, 2400)}`);
    return trimmed;
  } catch (err) {
    clearTimeout(timeoutId);
    logger.error(`[${tag}] error (${Date.now() - startedAt}ms):`, err.message);
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
