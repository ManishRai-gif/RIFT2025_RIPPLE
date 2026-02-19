const fs = require('fs');
const path = require('path');
const { generateContent, extractJson } = require('../utils/gemini');
const logger = require('../utils/logger');

function validateFix(fix) {
  if (!fix || typeof fix !== 'object') return false;
  const file = fix.file;
  const content = fix.content;
  if (typeof file !== 'string' || file.includes('..') || file.includes('/etc') || file.includes('package.json')) return false;
  if (typeof content !== 'string') return false;
  return true;
}

async function proposeFix(filePath, fileContent, analysis, testOutput) {
  try {
    const prompt = `You are a code fixer. Fix the bug based on analysis.

File path: ${filePath}

Current file content:
\`\`\`
${String(fileContent || '').slice(0, 6000)}
\`\`\`

Analysis: ${analysis.rootCause}
Suggestion: ${analysis.suggestion}

Test output (failure):
${String(testOutput).slice(0, 3000)}

Respond with valid JSON only:
{
  "file": "${filePath}",
  "content": "the complete fixed file content as a string, properly escaped for JSON"
}

Return the ENTIRE fixed file content. Do not use placeholder comments.`;

    const text = await generateContent(prompt);
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.content !== 'string') {
      return null;
    }
    const content = parsed.content;
    const fix = { file: filePath, content };
    if (!validateFix(fix)) return null;
    return fix;
  } catch (err) {
    logger.error('fixAgent error:', err.message);
    return null;
  }
}

async function applyFix(repoPath, fix) {
  try {
    if (!validateFix(fix)) return false;
    const fullPath = path.resolve(path.join(repoPath, fix.file));
    const resolvedRepo = path.resolve(repoPath);
    if (!fullPath.startsWith(resolvedRepo)) return false;
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, fix.content, 'utf8');
    return true;
  } catch (err) {
    logger.error('applyFix error:', err.message);
    return false;
  }
}

module.exports = { proposeFix, applyFix, validateFix };
