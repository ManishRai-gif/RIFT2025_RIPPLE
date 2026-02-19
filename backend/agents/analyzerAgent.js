const { generateContent, extractJson } = require('../utils/gemini');
const logger = require('../utils/logger');

const BUG_TYPES = ['LINTING', 'SYNTAX', 'LOGIC', 'TYPE_ERROR', 'IMPORT', 'INDENTATION'];

function normalizeBugType(s) {
  const u = String(s || '').toUpperCase().replace(/-/g, '_');
  if (BUG_TYPES.includes(u)) return u;
  if (u.includes('LINT')) return 'LINTING';
  if (u.includes('SYNTAX')) return 'SYNTAX';
  if (u.includes('LOGIC')) return 'LOGIC';
  if (u.includes('TYPE')) return 'TYPE_ERROR';
  if (u.includes('IMPORT')) return 'IMPORT';
  if (u.includes('INDENT')) return 'INDENTATION';
  return 'LOGIC';
}

function extractLineNumber(testOutput, filePath) {
  const re = new RegExp(`(${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^:]*):(\\d+)`, 'i');
  const m = testOutput.match(re);
  return m ? parseInt(m[2], 10) : null;
}

async function analyzeBug(repoPath, testOutput, context = {}) {
  try {
    const prompt = `You are a bug analyzer. Given test/output from a Node.js or Python project, identify the root cause.

Test output:
${String(testOutput).slice(0, 8000)}

${context.fileContent ? `Relevant file content:\n${String(context.fileContent).slice(0, 4000)}` : ''}

Classify the bug type as ONE of: LINTING, SYNTAX, LOGIC, TYPE_ERROR, IMPORT, INDENTATION

Respond with valid JSON only, no markdown:
{
  "rootCause": "brief description of the bug",
  "file": "path/to/file.js or path/to/file.py or empty string",
  "line": 15,
  "bugType": "SYNTAX",
  "suggestion": "what fix is needed (e.g. add the colon at the correct position, remove the import statement)",
  "confidence": 0.9
}`;

    const text = await generateContent(prompt, { tag: 'analyzeBug' });
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.rootCause !== 'string') {
      return { rootCause: 'Unknown', file: '', line: null, bugType: 'LOGIC', suggestion: 'Manual inspection needed', confidence: 0 };
    }
    const file = String(parsed.file || '').trim();
    return {
      rootCause: String(parsed.rootCause).slice(0, 500),
      file,
      line: typeof parsed.line === 'number' ? parsed.line : (parsed.line ? parseInt(parsed.line, 10) : null) || extractLineNumber(testOutput, file),
      bugType: normalizeBugType(parsed.bugType),
      suggestion: String(parsed.suggestion || '').slice(0, 500),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    };
  } catch (err) {
    logger.error('analyzerAgent error:', err.message);
    return { rootCause: 'Analysis failed', file: '', line: null, bugType: 'LOGIC', suggestion: 'Retry or manual fix', confidence: 0 };
  }
}

module.exports = { analyzeBug };
