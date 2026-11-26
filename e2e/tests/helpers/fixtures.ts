import { test as base, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DIRECT_URL } from './api';
import { readSeedState, type SeedState } from './data';

const NODE_MODULES = path.join(__dirname, '..', '..', 'node_modules');

/** 1x1 transparent PNG for map tiles. */
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** unpkg.com/<pkg>@<ver>/<file> -> served from e2e/node_modules (Leaflet is pinned in package.json). */
async function serveFromNodeModules(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const m = url.pathname.match(/^\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+)$/);
  const file = m ? path.join(NODE_MODULES, m[1], m[2]) : '';
  if (file && fs.existsSync(file)) {
    await route.fulfill({
      status: 200,
      body: fs.readFileSync(file),
      headers: {
        'content-type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
        'access-control-allow-origin': '*',
      },
    });
    return;
  }
  await route.abort();
}

export async function installNetworkStubs(page: Page): Promise<void> {
  await page.route(/^https:\/\/unpkg\.com\//, serveFromNodeModules);
  await page.route(/^https:\/\/fonts\.googleapis\.com\//, (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  await page.route(/^https:\/\/fonts\.gstatic\.com\//, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com|tile\.opentopomap|arcgisonline|\/tiles?\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG }),
  );
  // Everything else outside the app origin (CDNs, analytics, OSRM, ...) must not make tests flaky.
  await page.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'guidebook.e2e' && url.hostname !== 'unpkg.com'
      && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) && !/tile|basemaps|arcgis/.test(url.hostname),
    (r) => r.abort('blockedbyclient'),
  );
}

export interface PageDiagnostics {
  pageErrors: string[];
  consoleErrors: string[];
  externalRequests: string[];
}

type Fixtures = {
  diagnostics: PageDiagnostics;
  seed: SeedState;
  /**
   * The test backend runs on SQLite, so /health reports persistent_storage=false and the app shows a
   * 3 s red toast over the bottom of the screen. By default the browser sees a "persistent" backend;
   * boot.spec opts out to check the warning itself.
   */
  persistentHealth: boolean;
};

/** Console noise that is not an app bug (blocked third-party requests in the sandbox). */
const IGNORED_CONSOLE = [/net::ERR_BLOCKED_BY_CLIENT/, /ERR_FAILED/];

export const test = base.extend<Fixtures>({
  seed: async ({}, use) => {
    await use(readSeedState());
  },
  persistentHealth: [true, { option: true }],
  diagnostics: [async ({ page, persistentHealth }, use, testInfo) => {
    const diag: PageDiagnostics = { pageErrors: [], consoleErrors: [], externalRequests: [] };
    page.on('pageerror', (err) => diag.pageErrors.push(`${err.name}: ${err.message}\n${err.stack ?? ''}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
      diag.consoleErrors.push(text);
    });
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.protocol.startsWith('http') && u.hostname !== 'guidebook.e2e') diag.externalRequests.push(req.url());
    });
    await installNetworkStubs(page);
    if (persistentHealth) {
      await page.route(/\/health$/, async (route) => {
        // route.fetch() runs in Node, where guidebook.e2e does not resolve.
        const res = await route.fetch({ url: `${DIRECT_URL}/health` });
        const body = await res.json();
        await route.fulfill({ response: res, json: { ...body, persistent_storage: true } });
      });
    }
    await use(diag);
    if (diag.consoleErrors.length) {
      await testInfo.attach('console-errors.txt', { body: diag.consoleErrors.join('\n'), contentType: 'text/plain' });
    }
    expect(diag.pageErrors, 'uncaught exceptions in the page').toEqual([]);
  }, { auto: true }],
});

export { expect };

/** Opens the app and waits for the shell to become usable. */
export async function openApp(page: Page, pathname = '/'): Promise<void> {
  await page.goto(pathname);
  await waitForAppReady(page);
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof (window as any).app === 'object' && !!(window as any).app);
  await expect(page.locator('#tgBootOverlay')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#appBottomNav')).toBeVisible();
}

export async function navTo(page: Page, tab: 'catalog' | 'map' | 'profile'): Promise<void> {
  await page.locator(`#appBottomNav [data-app-nav="${tab}"]`).click();
  await expect(page.locator(`#${tab}`)).toHaveClass(/\bactive\b/);
}

export async function shot(page: Page, testInfo: import('@playwright/test').TestInfo, name: string): Promise<string> {
  const file = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return file;
}
