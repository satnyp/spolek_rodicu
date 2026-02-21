import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const routes = [
  { name: 'login', path: '/__design/login', baseline: 'prihlasovaci_obrazovka.png' },
  { name: 'main-light', path: '/__design/main?theme=light', baseline: 'design_main.png' },
  { name: 'main-dark', path: '/__design/main?theme=dark', baseline: 'dark_mode.png' },
  { name: 'settings', path: '/__design/settings', baseline: 'nastaveni.png' }
] as const;

const maxDiffPixelRatio = 0.008;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.documentElement.setAttribute('data-no-motion', 'true');
  });
});

for (const route of routes) {
  test(`design route ${route.name}`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const actualPath = testInfo.outputPath(`${route.name}-actual.png`);
    const diffPath = testInfo.outputPath(`${route.name}-diff.png`);
    await page.screenshot({ path: actualPath, fullPage: true });

    const baselinePath = path.resolve(testInfo.project.testDir, '../../docs/design', route.baseline);
    const [actualBuf, baselineBuf] = await Promise.all([fs.readFile(actualPath), fs.readFile(baselinePath)]);

    const actual = PNG.sync.read(actualBuf);
    const baseline = PNG.sync.read(baselineBuf);

    expect(actual.width, `${route.name}: width mismatch`).toBe(baseline.width);
    expect(actual.height, `${route.name}: height mismatch`).toBe(baseline.height);

    const diff = new PNG({ width: actual.width, height: actual.height });
    const diffPixels = pixelmatch(actual.data, baseline.data, diff.data, actual.width, actual.height, { threshold: 0.1 });
    const ratio = diffPixels / (actual.width * actual.height);
    await fs.writeFile(diffPath, PNG.sync.write(diff));

    expect(ratio, `${route.name}: pixel ratio ${ratio.toFixed(4)} exceeded ${maxDiffPixelRatio}`).toBeLessThanOrEqual(maxDiffPixelRatio);
  });
}
