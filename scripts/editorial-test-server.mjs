import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Only this isolated synthetic-test directory is reset. Interactive local data is separate.
const state = resolve(process.argv[2]==='integration'?'.git/integration-browser-state':'.git/editorial-browser-state');
rmSync(state, { recursive: true, force: true });
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
const env = { ...process.env, XDG_CONFIG_HOME: resolve('.git/runtime-config'), XDG_CACHE_HOME: resolve('.git/runtime-cache'), WRANGLER_SEND_METRICS: 'false' };
const common = ['--config', 'wrangler.editorial.local.jsonc', '--persist-to', state];
const migration = spawnSync(process.execPath, [cli, 'd1', 'migrations', 'apply', 'EDITORIAL_DB', '--local', ...common], { env, encoding: 'utf8' });
if (migration.status !== 0) { process.stderr.write(migration.stderr); process.stdout.write(migration.stdout); process.exit(migration.status ?? 1); }
const child = spawn(process.execPath, [cli, 'dev', '--local', ...common, '--ip', '127.0.0.1', '--port', '8788'], { env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
