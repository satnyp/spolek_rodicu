// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

const baseUrl = 'http://127.0.0.1:4173';
const refs = [
  { route: '/__design/login', ref: 'prihlasovaci_obrazovka.png', out: 'login.diff.png' },
  { route: '/__design/main?theme=light', ref: 'design_main.png', out: 'main-light.diff.png' },
  { route: '/__design/main?theme=dark', ref: 'dark_mode.png', out: 'main-dark.diff.png' },
  { route: '/__design/settings', ref: 'nastaveni.png', out: 'settings.diff.png' }
];

let server: ChildProcessWithoutNullStreams;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'pipe' });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite did not start in time')), 30000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('127.0.0.1:4173')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => {
      if (chunk.toString().toLowerCase().includes('error')) {
        clearTimeout(timer);
        reject(new Error(chunk.toString()));
      }
    });
  });

  browser = await chromium.launch();
  page = await browser.newPage();
}, 45000);

afterAll(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

describe('design parity screenshots', () => {
  it.each(refs)('matches $route', async ({ route, ref, out }) => {
    const referencePath = path.resolve('desing_html', ref);
    const reference = PNG.sync.read(readFileSync(referencePath));

    await page.setViewportSize({ width: reference.width, height: reference.height });
    await page.goto(`${baseUrl}${route}`);
    await page.waitForTimeout(350);

    const current = PNG.sync.read(await page.screenshot({ fullPage: false }));
    const diff = new PNG({ width: current.width, height: current.height });
    const mismatched = pixelmatch(current.data, reference.data, diff.data, current.width, current.height, { threshold: 0.12 });
    const ratio = mismatched / (current.width * current.height);

    if (ratio > 0.01) {
      const diffDir = path.resolve('test-results/visual-diff');
      if (!existsSync(diffDir)) {
        mkdirSync(diffDir, { recursive: true });
      }
      writeFileSync(path.join(diffDir, out), PNG.sync.write(diff));
    }

    expect(ratio).toBeLessThanOrEqual(0.01);
  }, 30000);
});
