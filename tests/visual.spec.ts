import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const cases = [
  { route: '/__design/login', baseline: 'prihlasovaci_obrazovka.png' },
  { route: '/__design/main?theme=light', baseline: 'design_main.png' },
  { route: '/__design/main?theme=dark', baseline: 'dark_mode.png' },
  { route: '/__design/settings', baseline: 'nastaveni.png' }
];

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({ content: '*{animation:none !important;transition:none !important;}' });
  await page.addInitScript(`(() => { const fixed = new Date('2025-01-12T08:00:00Z').getTime(); const RealDate = Date; class MockDate extends RealDate { constructor(...args){ super(args.length ? args[0] : fixed); } static now(){ return fixed; } } window.Date = MockDate; })();`);
});

for (const c of cases) {
  test(`visual ${c.route}`, async ({ page }, testInfo) => {
    await page.goto(c.route);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const actual = await page.screenshot({ fullPage: true });
    const expectedPath = path.join(process.cwd(), 'docs/design', c.baseline);
    const expected = PNG.sync.read(fs.readFileSync(expectedPath));
    const actualPng = PNG.sync.read(actual);

    const diff = new PNG({ width: expected.width, height: expected.height });
    const mismatched = pixelmatch(expected.data, actualPng.data, diff.data, expected.width, expected.height, { threshold: 0.2 });
    const ratio = mismatched / (expected.width * expected.height);

    if (ratio > 0.008) {
      const outDir = testInfo.outputDir;
      fs.writeFileSync(path.join(outDir, `${c.baseline}.actual.png`), PNG.sync.write(actualPng));
      fs.writeFileSync(path.join(outDir, `${c.baseline}.diff.png`), PNG.sync.write(diff));
    }

    expect(ratio).toBeLessThanOrEqual(0.008);
  });
}
