const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fs = require('fs').promises;
const path = require('path');

const outDir = path.join(__dirname, '..', 'verify-output');

async function ensureOutDir() {
  try {
    await fs.mkdir(outDir, { recursive: true });
  } catch (e) {
    console.warn('Không tạo được', outDir, e && e.message);
  }
}

async function run(cmd, file) {
  const filePath = path.join(outDir, file);
  console.log('> ', cmd);
  try {
    const { stdout, stderr } = await exec(cmd, { maxBuffer: 50 * 1024 * 1024 });
    const out = (stdout || '') + (stderr ? `\n---stderr---\n${stderr}` : '');
    await fs.writeFile(filePath, out, 'utf8');
    return { stdout, stderr };
  } catch (err) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || err.message || '';
    const out = stdout + '\n---ERR---\n' + stderr;
    try {
      await fs.writeFile(filePath, out, 'utf8');
    } catch (e) {
      console.error('Failed to write', filePath, e);
    }
    return { stdout, stderr, err };
  }
}

async function main() {
  await ensureOutDir();

  // Detect compose command
  let compose = 'docker compose';
  try {
    await exec('docker compose version');
  } catch (e) {
    try {
      await exec('docker-compose version');
      compose = 'docker-compose';
    } catch (e2) {
      /* không có bản v1 lẫn v2 — báo ở bước dùng `compose` bên dưới */
    }
  }

  // Build & up
  await run(`${compose} up -d --build`, 'compose-up.txt');

  // ps
  await run(
    `${compose} ps --all --format "table {{.Name}}\t{{.Service}}\t{{.State}}\t{{.Ports}}"`,
    'compose-ps.txt'
  );

  // logs
  await run(
    `${compose} logs --tail=200 keycloak minio postgres user-service content-service storage-service frontend-main frontend-forum`,
    'compose-logs.txt'
  );

  // health endpoints
  const endpoints = [
    { name: 'storage', url: 'http://localhost:4002/health' },
    { name: 'user', url: 'http://localhost:4000/health' },
    { name: 'content', url: 'http://localhost:4001/health' },
    { name: 'frontend-main', url: 'http://localhost:3000/' },
    { name: 'frontend-forum', url: 'http://localhost:3001/' },
    {
      name: 'keycloak-oidc',
      url: 'http://localhost:8080/realms/tsudev-local/.well-known/openid-configuration',
    },
  ];

  for (const ep of endpoints) {
    // Use curl if available
    const outfile = `health-${ep.name}.txt`;
    try {
      await run(`curl -sS ${ep.url}`, outfile);
    } catch (e) {
      await fs.writeFile(path.join(outDir, outfile), 'no-response', 'utf8');
    }
  }

  // presign
  await run(
    `curl -sS -X POST http://localhost:4002/api/presign -H "Content-Type: application/json" -d '{"fileName":"verify.txt","contentType":"text/plain"}'`,
    'presign-response.json'
  );

  // attempt upload if presign provided a url
  try {
    const presign = await fs.readFile(path.join(outDir, 'presign-response.json'), 'utf8');
    let parsed = null;
    try {
      parsed = JSON.parse(presign);
    } catch (e) {
      parsed = null;
    }
    if (parsed && parsed.url) {
      // PUT and save HTTP code
      const putCmd = `curl -sS -X PUT -H "Content-Type: text/plain" --data-binary "hello from verify script" "${
        parsed.url
      }" -w "%{http_code}" -o "${path.join(outDir, 'put-output-body.txt')}"`;
      const { stdout } = await exec(putCmd, { maxBuffer: 10 * 1024 * 1024 });
      await fs.writeFile(path.join(outDir, 'put-status.txt'), String(stdout || ''), 'utf8');
    }
  } catch (e) {
    await fs.writeFile(
      path.join(outDir, 'put-status.txt'),
      'put-failed: ' + (e && e.message ? e.message : String(e)),
      'utf8'
    );
  }

  // list files
  await run(`curl -sS http://localhost:4002/api/files`, 'storage-files.json');

  // list outputs
  try {
    const files = await fs.readdir(outDir);
    console.log('verify-output files:');
    for (const f of files) console.log(' -', f);
  } catch (e) {
    console.warn('Không đọc được', outDir, e && e.message);
  }

  console.log('Done. Please attach the files in verify-output/');
}

main().catch((err) => {
  console.error('verify-stack failed', err);
  process.exit(1);
});
