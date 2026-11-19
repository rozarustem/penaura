#!/bin/bash
# Pull-based CD: har bir AWS (Auto Scaling) serveri 'deploy' branch'ini kuzatadi.
# CI testlardan o'tgach 'deploy' branch'ini yangilaydi, server esa o'zini yangilaydi.
# Cron har 3 daqiqada ishga tushiradi. AWS kalitlari kerak emas.
set -e
cd "$(dirname "$0")/.."
exec 9>/tmp/penaura-update.lock
flock -n 9 || exit 0

git fetch -q origin deploy
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/deploy)
[ "$LOCAL" = "$REMOTE" ] && exit 0

git reset -q --hard origin/deploy
docker compose -f docker-compose.aws.yml up -d --build
docker image prune -f > /dev/null
echo "$(date -u +%FT%TZ) yangilandi: $REMOTE"
