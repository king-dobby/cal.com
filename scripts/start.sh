#!/bin/sh
set -x

# Replace the statically built BUILT_NEXT_PUBLIC_WEBAPP_URL with run-time NEXT_PUBLIC_WEBAPP_URL
scripts/replace-placeholder.sh "$BUILT_NEXT_PUBLIC_WEBAPP_URL" "$NEXT_PUBLIC_WEBAPP_URL"

scripts/wait-for-it.sh ${DATABASE_HOST} -- echo "database is up"
npx prisma migrate deploy --schema /calcom/packages/prisma/schema.prisma
npx ts-node --transpile-only /calcom/scripts/seed-app-store.ts

# Start API v1 on port 3002 in background (if built)
if [ -d "/calcom/apps/api/v1/.next" ]; then
  echo "Starting API v1 on port 3002..."
  cd /calcom/apps/api/v1 && npx next start -p 3002 &
  cd /calcom
fi

# Start web app on port 3000
yarn start

