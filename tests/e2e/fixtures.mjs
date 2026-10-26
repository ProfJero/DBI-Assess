// Shared Playwright setup: serve CDN files locally, point pages at the emulators, seed data.
import { test as base, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const nm = (p) => join(root, 'node_modules', p);

/** The sandbox and CI may not reach Google's or Cloudflare's CDNs; serve identical files from npm. */
async function mirrorCdn(page) {
  await page.context().route(/https:\/\/www\.gstatic\.com\/firebasejs\/9\.22\.0\/(.+\.js)$/, (route) => {
    const file = nm('firebase/' + route.request().url().split('/').pop());
    route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(file) });
  });
  await page.context().route(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^/]+\/(css|webfonts)\/(.+)$/, (route) => {
    const m = route.request().url().match(/font-awesome\/[^/]+\/(css|webfonts)\/([^?#]+)/);
    const file = nm(`@fortawesome/fontawesome-free/${m[1]}/${m[2]}`);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: m[1] === 'css' ? 'text/css' : 'font/woff2', body: readFileSync(file) });
  });
  // Anything else on a CDN (fonts, QR library) is optional for tests.
  await page.context().route(/https:\/\/(fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|res\.cloudinary\.com)\//, (route) => route.fulfill({ status: 200, body: '' }));
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mirrorCdn(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('dbi:emulator', '1');
      } catch (e) {}
    });
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await use(page);
  },
});

export { expect, mirrorCdn };

export async function studentLogin(page, id, password) {
  await page.goto('/index.html');
  await page.getByLabel('Student ID').fill(id);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/student\/dashboard\.html/);
}

export async function adminLogin(page, email, password) {
  await page.goto('/admin/index.html');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/admin\/dashboard\.html/);
}
