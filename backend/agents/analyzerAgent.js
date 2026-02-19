const { generateContent, extractJson } = require('../utils/gemini');
const logger = require('../utils/logger');

async function analyzeBug(repoPath, testOutput, context = {}) {
  try {
    const prompt = `You are a bug analyzer. Given test output from a Node.js project, identify the root cause.

Test output:
${String(testOutput).slice(0, 8000)}

${context.fileContent ? `Relevant file content:\n${String(context.fileContent).slice(0, 4000)}` : ''}

Respond with valid JSON only, no markdown:
{
  "rootCause": "brief description of the bug",
  "file": "path/to/file.js or empty string",
  "suggestion": "what fix is needed",
  "confidence": 0.9
}`;

    const text = await generateContent(prompt);
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.rootCause !== 'string') {
      return { rootCause: 'Unknown', file: '', suggestion: 'Manual inspection needed', confidence: 0 };
    }
    return {
      rootCause: String(parsed.rootCause).slice(0, 500),
      file: String(parsed.file || ''),
      suggestion: String(parsed.suggestion || '').slice(0, 500),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    };
  } catch (err) {
    logger.error('analyzerAgent error:', err.message);
    return { rootCause: 'Analysis failed', file: '', suggestion: 'Retry or manual fix', confidence: 0 };
  }
}

module.exports = { analyzeBug };
