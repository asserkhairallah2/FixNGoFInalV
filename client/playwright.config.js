import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const portFile = path.join(here, 'e2e', 'port.json');

// A random loopback port is reserved for this suite in e2e/port.json so the
// webServer and every worker use exactly the same base URL. Override with
// FIXNGO_E2E_PORT when that port is occupied on a particular machine.
function resolvePort() {
  if (process.env.FIXNGO_E2E_PORT) {
    const p = Number(process.env.FIXNGO_E2E_PORT);
    if (Number.isInteger(p) && p >= 1024) return p;
    throw new Error(`Invalid FIXNGO_E2E_PORT: ${process.env.FIXNGO_E2E_PORT}`);
  }
  const cfg = JSON.parse(fs.readFileSync(portFile, 'utf8'));
  if (!Number.isInteger(cfg.port) || cfg.port < 1024) throw new Error('Invalid e2e/port.json');
  return cfg.port;
}

const port = resolvePort();
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  globalSetup: './e2e/global-setup.js',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  parallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['json', { outputFile: '../docs/evidence/e2e/results.json' }]
  ],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 60_000
  },
  webServer: {
    command: `node e2e/server.mjs ${port}`,
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      FIXNGO_E2E_PORT: String(port),
      FIXNGO_E2E_BASE_URL: baseURL
    }
  }
});
