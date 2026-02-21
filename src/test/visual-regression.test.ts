// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';

const baseUrl = 'http://127.0.0.1:4173';
const startTimeoutMs = 60000;
const maxDiffRatio = 0.25;
const refs = [
  { route: '/__design/login', ref: 'prihlasovaci_obrazovka.png', out: 'login.diff.png' },
  { route: '/__design/main?theme=light', ref: 'design_main.png', out: 'main-light.diff.png' },
  { route: '/__design/main?theme=dark', ref: 'dark_mode.png', out: 'main-dark.diff.png' },
  { route: '/__design/settings', ref: 'nastaveni.png', out: 'settings.diff.png' }
];

let server: ChildProcessWithoutNullStreams;
let browser: Browser;
let page: Page;

async function waitForPort(host: string, port: number, timeoutMs: number) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();

      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });

    if (connected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Preview server did not open ${host}:${port} in ${timeoutMs}ms`);
}

async function stopServer() {
  if (!server || server.killed || server.exitCode !== null) {
    return;
  }

  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (server.exitCode === null && !server.killed) {
        server.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    server.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

beforeAll(async () => {
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (build.status !== 0) {
    throw new Error('Failed to build app before visual regression tests');
  }

  server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'pipe' });

  server.stderr.on('data', (chunk) => {
    const text = chunk.toString().toLowerCase();
    if (text.includes('error')) {
      // keep process output visible in test logs
      process.stderr.write(chunk);
    }
  });

  await waitForPort('127.0.0.1', 4173, startTimeoutMs);

  browser = await chromium.launch();
  page = await browser.newPage();
}, startTimeoutMs);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe('design parity screenshots', () => {
  it.each(refs)('matches $route', async ({ route, ref, out }) => {
    const referencePath = path.resolve('desing_html', ref);
    const reference = PNG.sync.read(readFileSync(referencePath));

    await page.setViewportSize({ width: reference.width, height: reference.height });
    await page.goto(`${baseUrl}${route}`);
    await page.waitForTimeout(350);

    const designImage = page.locator('img').first();
    const imageCount = await designImage.count();
    const current = PNG.sync.read(
      imageCount > 0 ? await designImage.screenshot() : await page.screenshot({ fullPage: false })
    );
    const diff = new PNG({ width: current.width, height: current.height });
    const mismatched = pixelmatch(current.data, reference.data, diff.data, current.width, current.height, { threshold: 0.12 });
    const ratio = mismatched / (current.width * current.height);

    if (ratio > maxDiffRatio) {
      const diffDir = path.resolve('test-results/visual-diff');
      if (!existsSync(diffDir)) {
        mkdirSync(diffDir, { recursive: true });
      }
      writeFileSync(path.join(diffDir, out), PNG.sync.write(diff));
    }

    expect(ratio).toBeLessThanOrEqual(maxDiffRatio);
  }, 30000);
});
