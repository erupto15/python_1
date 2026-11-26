import type { Page, Request } from '@playwright/test';
import { expect, navTo } from './fixtures';

export const AUTH_STORAGE_KEY = 'climbingApp_auth';

export async function openProfile(page: Page): Promise<void> {
  await navTo(page, 'profile');
}

export async function openRegisterDialog(page: Page): Promise<void> {
  await openProfile(page);
  await page.locator('#profileRegisterBtn').click();
  await expect(page.locator('#authRegisterDialog')).toBeVisible();
}

export async function openLoginDialog(page: Page): Promise<void> {
  await openProfile(page);
  await page.locator('#profileLoginBtn').click();
  await expect(page.locator('#authLoginDialog')).toBeVisible();
}

export async function fillRegister(
  page: Page,
  { name = 'E2E Climber', email, password, password2 = password }: { name?: string; email: string; password: string; password2?: string },
): Promise<void> {
  await page.locator('#authRegisterName').fill(name);
  await page.locator('#authRegisterEmail').fill(email);
  await page.locator('#authRegisterPassword').fill(password);
  await page.locator('#authRegisterPassword2').fill(password2);
}

export async function fillLogin(page: Page, email: string, password: string, { remember = true } = {}): Promise<void> {
  await page.locator('#authLoginEmail').fill(email);
  await page.locator('#authLoginPassword').fill(password);
  await page.locator('#authLoginRemember').setChecked(remember);
  await expect(page.locator('#authLoginPassword')).toHaveValue(password);
}

export async function loginViaUi(page: Page, email: string, password: string, opts: { remember?: boolean } = {}): Promise<void> {
  await openLoginDialog(page);
  await fillLogin(page, email, password, opts);
  await page.locator('#authLoginSubmitBtn').click();
}

export async function expectLoggedIn(page: Page, email: string): Promise<void> {
  await expect(page.locator('#profileUserBlock')).toBeVisible();
  await expect(page.locator('#profileGuestBlock')).toBeHidden();
  await expect(page.locator('#profileEmail')).toHaveText(email);
}

export async function expectGuest(page: Page): Promise<void> {
  await expect(page.locator('#profileGuestBlock')).toBeVisible();
  await expect(page.locator('#profileUserBlock')).toBeHidden();
}

export function storedAuth(page: Page) {
  return page.evaluate((key) => {
    const parse = (raw: string | null) => (raw ? JSON.parse(raw) : null);
    return {
      local: parse(localStorage.getItem(key)) as { accessToken: string | null; currentUser: unknown } | null,
      session: parse(sessionStorage.getItem(key)) as { accessToken: string | null; currentUser: unknown } | null,
    };
  }, AUTH_STORAGE_KEY);
}

/** Records API requests matching `pathname` (method + url) for "exactly one request" assertions. */
export function recordRequests(page: Page, pathname: string, method = 'POST'): Request[] {
  const seen: Request[] = [];
  page.on('request', (req) => {
    if (req.method() === method && new URL(req.url()).pathname === pathname) seen.push(req);
  });
  return seen;
}
