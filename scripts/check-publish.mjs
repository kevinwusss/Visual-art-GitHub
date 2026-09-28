import {execFileSync} from 'node:child_process';
import {readFileSync, statSync} from 'node:fs';

// Examine exactly the tracked and unignored files; never print matched secrets.
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean))];
const problems = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') problems.push(`${file}: private environment file`);
  if (/^(node_modules|\.next|\.logs|\.scrape-venv|data\/uploads)\//.test(file)) problems.push(`${file}: private/generated directory`);
  if (statSync(file).size > 95 * 1024 * 1024) problems.push(`${file}: exceeds project publication size limit`);
  if (/\.(webp|png|jpg|jpeg|gif|woff2|ico|pdf|zip)$/i.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (/\bsk-[A-Za-z0-9_-]{20,}/.test(text) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) problems.push(`${file}: potential credential`);
  if (file === '.env.example' && /^(?:DEEPSEEK_API_KEY|BOCHA_API_KEY)=\S+/m.test(text)) problems.push(`${file}: API keys must be empty`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Publication preflight passed: ${files.length} files; no supported credential patterns or excluded directories found. This is not a comprehensive security audit.`);
