#!/usr/bin/env bash
# Runs the whole backend locally without Docker or a Supabase account:
# PostgreSQL (your own server) + PostgREST + a tiny auth gateway.
#
#   brew install postgresql@16 postgrest      # once
#   scripts/dev/local-stack.sh                # prints the env vars to put in .env.local
#
# DEV ONLY: see scripts/dev/mock-supabase.mjs.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="${ZAN_DEV_DB:-zan_dev}"
export DATABASE_URL="postgres:///$DB"
export JWT_SECRET="${JWT_SECRET:-zan-local-dev-secret-at-least-32-characters-long}"

command -v postgrest >/dev/null || { echo "postgrest not found: brew install postgrest, or download a release from github.com/PostgREST/postgrest" >&2; exit 1; }
# A downloaded release binary is linked against Homebrew's libpq. If that is not installed,
# point LIBPQ_DIR at any libpq 5 (e.g. /opt/homebrew/opt/postgresql@16/lib). It is set here, not
# by the caller, because macOS strips DYLD_* variables when they pass through /usr/bin/env.
LIBPQ_DIR="${LIBPQ_DIR:-}"

if ! psql -X -q -d postgres -tAc "select 1 from pg_database where datname = '$DB'" | grep -q 1; then
  echo "creating database $DB"
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database \"$DB\""
  psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    if [[ "$f" == *pgroonga* ]]; then echo "skip $f"; continue; fi
    echo "apply $f"
    psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
  done
fi

CONF="$(mktemp -t zan-postgrest.XXXXXX)"
cat > "$CONF" <<CONF
db-uri = "$DATABASE_URL"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
CONF

DYLD_LIBRARY_PATH="$LIBPQ_DIR" postgrest "$CONF" &
POSTGREST_PID=$!
trap 'kill $POSTGREST_PID 2>/dev/null; rm -f "$CONF"' EXIT
sleep 1
exec node scripts/dev/mock-supabase.mjs
