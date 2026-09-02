#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY:?Set DEPLOY_KEY}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/guide-rus/current}"

ssh -i "$DEPLOY_KEY" -o IdentitiesOnly=yes "$DEPLOY_USER@$DEPLOY_HOST" \
  "set -euo pipefail
   cd '$APP_DIR'
   export GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519_guide_rus_deploy -o IdentitiesOnly=yes'
   git fetch origin
   git checkout '$DEPLOY_BRANCH'
   git pull --ff-only
   if [ -f /etc/guide-rus/local-database.url ]; then
     python3 scripts/pg_url.py overlay --url-file /etc/guide-rus/local-database.url --env-file /etc/guide-rus/backend.env
   fi
   bash scripts/install-local-postgres.sh
   cd climbing-guidebook/backend
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   systemctl restart guide-rus-backend
   systemctl reload caddy"
