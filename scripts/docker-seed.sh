#!/bin/sh
set -eu
if [ "${NODE_ENV:-}" != "production" ] && [ -f /data/dev-secrets.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /data/dev-secrets.env
  set +a
fi
if [ "${SEED_DEMO:-}" = "true" ]; then
  npx tsx prisma/seed.ts
fi
