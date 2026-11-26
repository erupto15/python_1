#!/usr/bin/env node
/**
 * Starts the FastAPI backend (which also serves the frontend) on a fresh SQLite DB.
 * Used by playwright.config webServer. Ctrl+C / SIGTERM is forwarded to uvicorn.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { E2E_PORT, E2E_DB_PATH, E2E_UPLOAD_DIR, BACKEND_DIR, backendEnv, pythonCommand } = require('./env');

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  fs.rmSync(E2E_DB_PATH + suffix, { force: true });
}
fs.rmSync(E2E_UPLOAD_DIR, { recursive: true, force: true });
fs.mkdirSync(E2E_UPLOAD_DIR, { recursive: true });

const [cmd, baseArgs] = pythonCommand();
const args = [...baseArgs, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(E2E_PORT), '--log-level', 'warning'];

const child = spawn(cmd, args, {
  cwd: BACKEND_DIR,
  env: { ...process.env, ...backendEnv() },
  stdio: 'inherit',
});

const forward = (signal) => () => {
  if (!child.killed) child.kill(signal);
};
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
console.log(`[e2e] backend: ${cmd} ${args.join(' ')} (db ${E2E_DB_PATH})`);
