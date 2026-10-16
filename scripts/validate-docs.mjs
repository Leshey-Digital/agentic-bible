import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Worktree files are included so this also checks a change before it is committed.
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(p => p.endsWith('.md'));
let links = 0;
const failures = [];
for (const file of [...new Set(files)]) {
  const content = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of content.matchAll(/\[[^\]]+\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|#)/.test(href)) continue;
    // Site-root links in article Markdown refer to generated routes, checked after build.
    if (href.startsWith('/')) continue;
    links++;
    const path = decodeURIComponent(href.split('#')[0]);
    if (!existsSync(resolve(dirname(file), path))) failures.push(`${file}: missing ${href}`);
  }
  if (/^(?:<{7}|={7}|>{7})/m.test(content)) failures.push(`${file}: unresolved conflict marker`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`PASS: ${new Set(files).size} Markdown files, ${links} relative file links, no missing targets or conflict markers.`);
console.log('Scope: file links only; generated route/fragment links are checked by npm test. Remote sources need editorial verification.');
