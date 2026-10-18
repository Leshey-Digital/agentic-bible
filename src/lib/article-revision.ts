import {execFileSync} from 'node:child_process';

export type ArticleRevision = {
  date: string;
  commit: string;
  subject: string;
} | null;

const sourcePath = (id: string) => `src/content/articles/${id}.md`;

/** Read the latest real source-file commit at the build's pinned Git revision. */
export function articleRevision(id: string, options: {repo?: string; sourceCommit?: string | null} = {}): ArticleRevision {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
  const repo = options.repo ?? process.cwd();
  const pin = options.sourceCommit ?? 'HEAD';
  if (pin !== 'HEAD' && !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(pin)) return null;
  try {
    const output = execFileSync('git', ['log', '-1', '--format=%cI%x00%H%x00%s', pin, '--', sourcePath(id)], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
      maxBuffer: 4096,
    }).trimEnd();
    const [committedAt, commit, subject] = output.split('\0');
    if (!committedAt || !/^\d{4}-\d\d-\d\dT/.test(committedAt) || !/^[a-f0-9]{40}$/.test(commit) || !subject) return null;
    return {date: committedAt.slice(0, 10), commit, subject};
  } catch {
    // Isolated previews can lack Git history. Unknown provenance stays unknown.
    return null;
  }
}

