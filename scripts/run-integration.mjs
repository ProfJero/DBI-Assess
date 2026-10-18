// Starts the Firebase emulators and the Worker locally, then runs the integration (and optionally e2e) tests.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name) => process.env[`${name.toUpperCase()}_BIN`] || join(root, 'node_modules/.bin', name);
const e2e = process.argv.includes('--e2e');

writeFileSync(join(root, 'worker/.dev.vars'), [
  'FIREBASE_PROJECT_ID=demo-dbi-assess',
  'REGISTRY_PROJECT_ID=demo-registry',
  'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
  'ALLOWED_ORIGINS=*',
].join('\n'));

const procs = [];
const start = (cmd, args, opts) => {
  const p = spawn(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  procs.push(p);
  return p;
};
const waitFor = async (url, ms = 120000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const stopAll = () => procs.forEach((p) => p.kill('SIGTERM'));
process.on('exit', stopAll);

const emu = start(bin('firebase'), ['emulators:start', '--only', 'firestore,auth', '--project', 'demo-dbi-assess']);
emu.stderr.on('data', (d) => process.env.DEBUG && process.stderr.write(d));
const wrk = start(bin('wrangler'), ['dev', '--port', '8787', '--ip', '127.0.0.1'], { cwd: join(root, 'worker') });
wrk.stderr.on('data', (d) => process.env.DEBUG && process.stderr.write(d));
wrk.stdout.on('data', (d) => process.env.DEBUG && process.stdout.write(d));

if (e2e) start(process.execPath, [join(root, 'scripts/serve.mjs')]);

await waitFor('http://127.0.0.1:8080/');
await waitFor('http://127.0.0.1:9099/');
await waitFor('http://127.0.0.1:8787/health');
if (e2e) await waitFor('http://127.0.0.1:5055/index.html');

const files = e2e ? ['tests/e2e'] : ['tests/integration/worker.test.mjs'];
const runner = e2e ? spawn(bin('playwright'), ['test', ...process.argv.slice(3)], { cwd: root, stdio: 'inherit', env: { ...process.env, PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: '1' } }) : spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: root, stdio: 'inherit' });
runner.on('exit', (code) => {
  stopAll();
  process.exit(code ?? 1);
});
