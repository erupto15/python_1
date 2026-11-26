import { execFileSync } from 'node:child_process';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const env = require('../../scripts/env');

const INSERT_TEMP_PASSWORD = `
import sys
from datetime import datetime, timedelta, timezone
from app import security
from app.db import SessionLocal
from app.models import PasswordResetCode, User

email, temp_password = sys.argv[1], sys.argv[2]
db = SessionLocal()
try:
    user = db.query(User).filter(User.email == email).one()
    db.add(PasswordResetCode(
        user_id=user.id,
        code_hash=security.hash_password(temp_password),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        attempts=0,
    ))
    db.commit()
finally:
    db.close()
print("ok")
`;

/** Emulates "the user received a temporary password by e-mail" (no SMTP in tests). */
export function insertTempPassword(email: string, tempPassword: string): void {
  const [cmd, prefix] = env.pythonCommand();
  const out = execFileSync(cmd, [...prefix, '-c', INSERT_TEMP_PASSWORD, email, tempPassword], {
    cwd: env.BACKEND_DIR,
    env: { ...process.env, ...env.backendEnv() },
    encoding: 'utf8',
  });
  if (!out.includes('ok')) throw new Error(`insertTempPassword failed: ${out}`);
}
