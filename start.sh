#!/bin/sh
set -e

echo "Starting FerretDB (PostgreSQL backend: Neon)..."
ferretdb \
  --listen-addr=127.0.0.1:27017 \
  --postgresql-url="$FERRETDB_POSTGRESQL_URL" \
  &

# Wait for FerretDB to initialise
sleep 8

echo "Starting Node.js server..."
exec node server.js
