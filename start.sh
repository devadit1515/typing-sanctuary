#!/bin/sh
set -e

echo "Starting FerretDB (PostgreSQL backend: Neon)..."
ferretdb \
  --listen-addr=127.0.0.1:27017 \
  --postgresql-url="$FERRETDB_POSTGRESQL_URL" \
  &

echo "Waiting for FerretDB to accept connections on port 27017..."
i=0
while ! node -e "
  var n = require('net');
  var s = n.connect(27017, '127.0.0.1');
  s.setTimeout(1000);
  s.on('connect', function() { process.exit(0); });
  s.on('error', function() { process.exit(1); });
  s.on('timeout', function() { process.exit(1); });
" 2>/dev/null; do
  i=$((i + 1))
  if [ $i -ge 60 ]; then
    echo "ERROR: FerretDB did not become ready within 60 seconds"
    exit 1
  fi
  sleep 1
done

echo "FerretDB ready after ${i}s. Starting Node.js server..."
exec node server.js
