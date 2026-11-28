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

# Seed the licensed starter recordings once on the attached volume.
music_seed_marker="${MEDIA_DIR:-/data/media}/.music-starter-v1"
if [ ! -f "$music_seed_marker" ]; then
  (
    node Backend/scripts/import-music.js Backend/scripts/music-starter.json --volume &&
      touch "$music_seed_marker"
  ) &
fi

music_release_marker="${MEDIA_DIR:-/data/media}/.music-library-v1"
if [ ! -f "$music_release_marker" ]; then
  (
    node Backend/scripts/load-music-release.js &&
      touch "$music_release_marker"
  ) &
fi

sticker_marker="${MEDIA_DIR:-/data/media}/.sticker-pack-16236f7d57198444"
if [ -f Backend/scripts/combined-stickers.zip ] && [ ! -f "$sticker_marker" ]; then
  (
    node Backend/scripts/install-sticker-pack.js Backend/scripts/combined-stickers.zip &&
      touch "$sticker_marker"
  ) &
fi

exec node Backend/server.js
