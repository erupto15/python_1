// eslint-disable-next-line @typescript-eslint/no-var-requires
const env = require('../../scripts/env');

export const DIRECT_URL: string = env.DIRECT_URL;
export const ADMIN = {
  login: env.ADMIN_LOGIN as string,
  email: env.ADMIN_EMAIL as string,
  password: env.ADMIN_PASSWORD as string,
};

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

/** Plain fetch against the backend (bypasses the browser). */
export async function api<T = any>(
  pathname: string,
  { method = 'GET', body, token }: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${DIRECT_URL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) throw new ApiError(res.status, parsed, `${method} ${pathname} -> ${res.status}: ${text.slice(0, 300)}`);
  return parsed as T;
}

export async function loginStatus(email: string, password: string): Promise<number> {
  const res = await fetch(`${DIRECT_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

export async function adminToken(): Promise<string> {
  const data = await api<{ access_token: string }>('/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN.login, password: ADMIN.password },
  });
  return data.access_token;
}

let counter = 0;
export function uniqueEmail(tag = 'user'): string {
  counter += 1;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `e2e-${tag}-${Date.now().toString(36)}-${process.pid}-${counter}-${rnd}@example.com`;
}

export async function registerViaApi(email: string, password: string, displayName = 'E2E User') {
  return api<{ access_token: string; user: { id: string; email: string } }>('/api/auth/register', {
    method: 'POST',
    body: { email, password, display_name: displayName },
  });
}
