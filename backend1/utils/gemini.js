const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('./logger');

let model = null;

function getModel() {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  if (!model) {
    const client = new GoogleGenerativeAI(config.geminiApiKey);
    model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return model;
}

function truncate(text, max = 2400) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated ${s.length - max} chars]`;
}

async function generateContent(prompt, tag = 'repoAnalysis') {
  const started = Date.now();
  logger.info(`[${tag}] prompt:\n${truncate(prompt)}`);
  const m = getModel();
  const result = await m.generateContent(prompt);
  const text = result?.response?.text?.() || '';
  const trimmed = text.trim();
  logger.info(
    `[${tag}] response (${Date.now() - started}ms):\n${truncate(trimmed)}`
  );
  if (!trimmed) {
    throw new Error('Empty Gemini response');
  }
  return trimmed;
}

module.exports = { generateContent };

