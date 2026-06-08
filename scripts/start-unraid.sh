#!/bin/sh
set -e

echo "Starting VGC Shelf combined container..."

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

export NODE_ENV=production
export PORT="${API_PORT:-4000}"
export HOSTNAME="0.0.0.0"

echo "Running Prisma migrations..."
cd /app/backend
npx prisma migrate deploy

echo "Starting backend API on port ${PORT}..."
node dist/src/server.js &
BACKEND_PID=$!

echo "Starting frontend on port ${FRONTEND_PORT:-3000}..."
cd /app/frontend
PORT="${FRONTEND_PORT:-3000}" HOSTNAME="0.0.0.0" node server.js &
FRONTEND_PID=$!

shutdown() {
  echo "Stopping VGC Shelf..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap shutdown INT TERM

wait -n "$BACKEND_PID" "$FRONTEND_PID"
EXIT_CODE=$?

shutdown
exit "$EXIT_CODE"
