#!/bin/sh
set -e

echo "Starting FerretDB (PostgreSQL backend: Neon)..."
ferretdb \
  --listen-addr=127.0.0.1:27017 \
  --postgresql-url="$FERRETDB_POSTGRESQL_URL" \
  --no-auth \
  &

# Wait for FerretDB to initialise
sleep 3

echo "Starting Node.js server..."
exec node server.js
