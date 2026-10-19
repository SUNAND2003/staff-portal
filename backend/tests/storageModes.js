/*
 * Verifies how the API behaves when avatar storage credentials are missing.
 *   1. Start the API:  cd backend && npm run dev
 *   2. Run:            cd backend && npm run test:storage
 * Spawns its own API instances on ports 5001/5002 with Cloudinary/Blob
 * credentials explicitly removed from the environment, so it asserts the
 * production 503 responses without needing real credentials.
 */
const { spawn } = require('child_process');
const path = require('path');
const results = [];
const check = (n, ok, info = '') => results.push({ n, ok, info });

const BACKEND = path.join(__dirname, '..');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function formWith(buffer, filename, type) {
  const f = new FormData();
  f.append('avatar', new Blob([buffer], { type }), filename);
  return f;
}

function spawnApi(port, extraEnv) {
  const env = { ...process.env, PORT: String(port), ...extraEnv };
  delete env.CLOUDINARY_URL;
  delete env.CLOUDINARY_CLOUD_NAME;
  delete env.CLOUDINARY_API_KEY;
  delete env.CLOUDINARY_API_SECRET;
  delete env.BLOB_READ_WRITE_TOKEN;
  const child = spawn(process.execPath, ['server.js'], { cwd: BACKEND, env, stdio: 'pipe' });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  return { child, getLog: () => log };
}

async function waitHealth(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/health`);
      if (r.ok) return r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function uploadScenario(label, port) {
  const login = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'hexa', password: 'Hexa2026' }),
  }).then((r) => r.json()).catch((e) => ({ error: e.message }));

  const token = login.token;
  check(`${label}: admin login works`, !!token, token ? '' : JSON.stringify(login).slice(0, 160));
  if (!token) return null;

  const res = await fetch(`http://localhost:${port}/api/profile/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formWith(PNG, 'avatar.png', 'image/png'),
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, message: (data && data.message) || '' };
}

(async () => {
  // ── scenario 1: Cloudinary forced, credentials missing ────────────────────
  {
    const { child, getLog } = spawnApi(5001, { AVATAR_STORAGE: 'cloudinary' });
    try {
      const health = await waitHealth(5001);
      check('forced cloudinary: API boots and reports storage backend',
        !!health && health.storage === 'cloudinary', health ? `storage=${health.storage}` : 'no health');

      const r = await uploadScenario('forced cloudinary', 5001);
      if (r) {
        check('forced cloudinary without credentials -> 503 (not 500, not a crash)',
          r.status === 503, `status=${r.status}`);
        check('503 message names CLOUDINARY_URL',
          /CLOUDINARY_URL/.test(r.message), r.message.slice(0, 150));
        check('503 message also names the three discrete variables',
          /CLOUDINARY_CLOUD_NAME/.test(r.message), '');
      }

      // server must still be alive after the failed upload
      const alive = await fetch(`http://localhost:5001/api/health`).then((x) => x.ok).catch(() => false);
      check('API still healthy after storage failure', alive, '');
    } finally {
      child.kill();
    }
  }

  // ── scenario 2: deployed with nothing configured (the pre-fix behaviour) ──
  {
    const { child } = spawnApi(5002, { AVATAR_STORAGE: 'unconfigured' });
    try {
      const health = await waitHealth(5002);
      check('unconfigured: API boots', !!health, health ? `storage=${health.storage}` : 'no health');

      const r = await uploadScenario('unconfigured', 5002);
      if (r) {
        check('unconfigured deployment -> 503', r.status === 503, `status=${r.status}`);
        check('message names BOTH storage options',
          /CLOUDINARY_URL/.test(r.message) && /BLOB_READ_WRITE_TOKEN/.test(r.message),
          r.message.slice(0, 180));
      }

      const alive = await fetch(`http://localhost:5002/api/health`).then((x) => x.ok).catch(() => false);
      check('API still healthy (no FUNCTION_INVOCATION_FAILED)', alive, '');
    } finally {
      child.kill();
    }
  }

  console.log('\n=== STORAGE CONFIGURATION CHECKS ===');
  let pass = 0;
  for (const x of results) {
    console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.n}${x.info ? '  [' + x.info + ']' : ''}`);
    if (x.ok) pass++;
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  if (pass !== results.length) process.exitCode = 1;
})();
