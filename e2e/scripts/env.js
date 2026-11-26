const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'climbing-guidebook', 'backend');
const E2E_PORT = Number(process.env.E2E_PORT || 8799);
const E2E_DB_PATH = process.env.E2E_DB_PATH || path.join(os.tmpdir(), `e2e-guidebook-${E2E_PORT}.db`);
const E2E_UPLOAD_DIR = path.join(os.tmpdir(), `e2e-guidebook-uploads-${E2E_PORT}`);

/**
 * The frontend treats localhost / 127.0.0.1 on any port except 8000 as "dev" and sends API calls
 * to http://127.0.0.1:8000. A non-local hostname mapped to 127.0.0.1 via Chrome's
 * --host-resolver-rules keeps API calls same-origin without touching app code.
 */
const E2E_HOST = 'guidebook.e2e';
const BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;
const DIRECT_URL = `http://127.0.0.1:${E2E_PORT}`;

/** Must match ADMIN_EMAIL_HINT in app.js: the frontend decides "admin" by this exact email. */
const ADMIN_EMAIL = 'admin@climbing-guidebook.local';
const ADMIN_LOGIN = 'admin4test';
const ADMIN_PASSWORD = 'adminpass123';

function backendEnv() {
  return {
    DATABASE_URL: `sqlite:///${E2E_DB_PATH}`,
    APP_ENV: 'development',
    CONFIG_FILE: path.join(os.tmpdir(), 'e2e-guidebook-no-config.yaml'),
    ADMIN_EMAIL,
    ADMIN_LOGIN,
    ADMIN_PASSWORD,
    ADMIN_DISPLAY_NAME: 'E2E Admin',
    JWT_SECRET: 'e2e',
    TELEGRAM_BOT_TOKEN: '',
    SMTP_HOST: '',
    MEDIA_UPLOAD_DIR: E2E_UPLOAD_DIR,
    ASSISTANT_API_KEY: '',
    CARTO_BASEMAPS_API_KEY: '',
    PYTHONUNBUFFERED: '1',
  };
}

/** [command, prefixArgs] for running python with backend deps. */
function pythonCommand() {
  if (process.env.E2E_PYTHON) return [process.env.E2E_PYTHON, []];
  const venvPython = path.join(BACKEND_DIR, '.venv', 'bin', 'python');
  if (!process.env.CI && fs.existsSync(venvPython)) return [venvPython, []];
  return ['python', []];
}

module.exports = {
  REPO_ROOT,
  BACKEND_DIR,
  E2E_PORT,
  E2E_DB_PATH,
  E2E_UPLOAD_DIR,
  E2E_HOST,
  BASE_URL,
  DIRECT_URL,
  ADMIN_EMAIL,
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  backendEnv,
  pythonCommand,
};
