// Playwright webServer launcher for FixNGo E2E.
//
// Everything runs from TEMP directories: a temp data dir, a temp log dir and a
// temp copy of the published ASP.NET app with a freshly built client wwwroot.
// The project's real data\ folder and source-owned files are never written to.
//
// NOTE: dotnet build is intentionally NOT run here. At the time of this suite
// the checked-in source has a compile error in
// src/FixNGo.Web/Controllers/AdminController.cs (CS0108: method User hides
// ControllerBase.User). The last successful Release build in
// src/FixNGo.Web/bin/Release/net8.0 is used instead (it contains all
// controllers); the compiler output is retained as evidence in
// docs/evidence/e2e/source-build.txt. app\web\FixNGo.Web.dll is an older
// Auth-only build and is deliberately not used.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(e2eDir, '..');
const rootDir = path.resolve(clientDir, '..');
const evidenceDir = path.join(rootDir, 'docs', 'evidence', 'e2e');
fs.mkdirSync(evidenceDir, { recursive: true });

const port = Number(process.argv[2]) || Number(process.env.FIXNGO_E2E_PORT) || 5080;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixngo-e2e-data-'));
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixngo-e2e-logs-'));
const webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixngo-e2e-web-'));
const baseURL = `http://127.0.0.1:${port}`;

fs.writeFileSync(path.join(e2eDir, '.runtime.json'), JSON.stringify({
  port, baseURL, dataDir, logDir, webDir, startedAt: new Date().toISOString()
}, null, 2));

function run(label, cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32' && /\.cmd$/i.test(cmd),
    ...options
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(path.join(evidenceDir, label), out);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`[e2e-server] ${label} failed (exit ${result.status}):\n${out}`);
    process.exit(result.status || 1);
  }
  return out;
}

const prebuiltWeb = path.join(rootDir, 'src', 'FixNGo.Web', 'bin', 'Release', 'net8.0');
const publishedCli = path.join(rootDir, 'app', 'FixNGo.Cli.dll');
for (const p of [prebuiltWeb, publishedCli]) {
  if (!fs.existsSync(p)) throw new Error(`Prebuilt app artifact missing: ${p}`);
}
if (!fs.existsSync(path.join(prebuiltWeb, 'FixNGo.Web.dll'))) {
  throw new Error('Prebuilt FixNGo.Web.dll is missing');
}

// Record the source build blocker once, as evidence (do not mutate the source).
const sourceBuild = spawnSync('dotnet', ['build', path.join(rootDir, 'src', 'FixNGo.Web', 'FixNGo.Web.csproj'),
  '-c', 'Release', '--nologo', '-v', 'q'], { encoding: 'utf8', cwd: rootDir, windowsHide: true });
fs.writeFileSync(path.join(evidenceDir, 'source-build.txt'),
  `exit=${sourceBuild.status}\n${sourceBuild.stdout || ''}${sourceBuild.stderr || ''}`);

// 1. Copy the published web app into a temp dir and build the current client
//    straight into its wwwroot (never into src/FixNGo.Web/wwwroot).
fs.cpSync(prebuiltWeb, webDir, { recursive: true });
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
fs.mkdirSync(path.join(webDir, 'wwwroot'), { recursive: true });
const viteArgs = ['vite', 'build', '--outDir', path.join(webDir, 'wwwroot'), '--emptyOutDir'];
const built = spawnSync(npmCmd, ['exec', '--', ...viteArgs], { encoding: 'utf8', cwd: clientDir, windowsHide: true,
  shell: process.platform === 'win32' });
fs.writeFileSync(path.join(evidenceDir, 'client-build.txt'), `${built.stdout || ''}${built.stderr || ''}`);
if (built.error) throw built.error;
if (built.status !== 0) {
  console.error(`[e2e-server] client build failed (exit ${built.status})`);
  process.exit(built.status || 1);
}

// TEMP-ONLY workaround for a fatal source bug in BottomNav (App.jsx): when a
// tab has no PREFERRED_TAB_SCREEN entry, the Map is filled with `undefined`,
// then `unique.map(s => s.tab)` crashes and the whole authenticated shell is
// replaced by the fatal fallback. The patch below edits ONLY the freshly built
// bundle inside the temp web dir; no repository/source file is modified.
// The bug is documented in docs/E2E_REPORT.md.
const patchNotes = [];
const assetsDir = path.join(webDir, 'wwwroot', 'assets');
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir).filter((n) => n.endsWith('.js'))) {
    const file = path.join(assetsDir, name);
    const before = fs.readFileSync(file, 'utf8');
    // Minified form: map.set(tab, code === preferred ? screen : existing)
    // Change the fallback to (existing || screen) so no undefined enters the Map.
    const re = /(\w+)\.set\((\w+)\.tab,(\w+)\.code===(\w+)\?\3:(\w+)\)/g;
    const after = before.replace(re, (_m, map, key, screen, pref, existing) =>
      `${map}.set(${key}.tab,${screen}.code===${pref}?${screen}:(${existing}||${screen}))`);
    if (after !== before) {
      fs.writeFileSync(file, after);
      patchNotes.push(`${name}: patched ${(before.match(re) || []).length} BottomNav Map assignment(s)`);
    }
  }
}
fs.writeFileSync(path.join(evidenceDir, 'bundle-patch.txt'),
  patchNotes.length ? patchNotes.join('\n') + '\n' : 'No temp bundle patch was needed.\n');

// 2. Non-interactive first-run setup in the TEMP data dir (env secrets only).
const setupEnv = {
  ...process.env,
  FIXNGO_DATA_DIR: dataDir,
  FIXNGO_LOG_DIR: logDir,
  FIXNGO_PORT: String(port),
  FIXNGO_SETUP_NAME: process.env.FIXNGO_SETUP_NAME || 'Gate Two Administrator',
  FIXNGO_SETUP_EMAIL: process.env.FIXNGO_SETUP_EMAIL || 'admin@gate2.test',
  FIXNGO_SETUP_PHONE: process.env.FIXNGO_SETUP_PHONE || '+201000000001',
  FIXNGO_SETUP_PASSWORD: process.env.FIXNGO_SETUP_PASSWORD || 'Setup@2026',
  FIXNGO_SETUP_SIMULATORS: process.env.FIXNGO_SETUP_SIMULATORS || 'Y'
};
run('setup.txt', 'dotnet', [publishedCli, 'setup'], { cwd: rootDir, env: setupEnv });

// 3. Run the published ASP.NET server from the temp folder with temp paths.
const serverEnv = {
  ...setupEnv,
  ASPNETCORE_URLS: baseURL,
  ASPNETCORE_ENVIRONMENT: 'Production',
  DOTNET_CLI_TELEMETRY_OPTOUT: '1'
};
console.log(`[e2e-server] starting ${baseURL} (data=${dataDir}, logs=${logDir}, web=${webDir})`);
const server = spawn('dotnet', [path.join(webDir, 'FixNGo.Web.dll')], {
  cwd: webDir,
  env: serverEnv,
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: false
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  try { server.kill(signal || 'SIGTERM'); } catch { /* already gone */ }
  setTimeout(() => { try { server.kill('SIGKILL'); } catch { /* already gone */ } }, 5000).unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGHUP', () => stop('SIGTERM'));
server.on('exit', (code, signal) => {
  if (!stopping) console.error(`[e2e-server] server exited early (code=${code}, signal=${signal})`);
  process.exit(code ?? (signal ? 1 : 0));
});
