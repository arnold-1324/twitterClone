#!/bin/sh
set -eu

# Redis is used only within this Railway service. The rate limiter expires its
# keys automatically, so Redis does not require its own persistent volume.
if [ "${REDIS_URL:-}" = "redis://127.0.0.1:6379" ]; then
  redis_password=$(node -p 'require("node:crypto").randomBytes(24).toString("hex")')
  export REDIS_URL="redis://:${redis_password}@127.0.0.1:6379"
  redis-server --bind 127.0.0.1 --protected-mode yes --port 6379 --requirepass "$redis_password" \
    --maxmemory 32mb --maxmemory-policy noeviction --save "" --appendonly no &
  unset redis_password
fi

exec node Backend/server.js
