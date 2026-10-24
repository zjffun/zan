#!/usr/bin/env bash
# Applies the migrations to a throw-away PostgreSQL database (with a Supabase
# stub) and runs the SQL tests in supabase/tests/. Needs a reachable server:
#   PGHOST / PGPORT / PGUSER (defaults to your local socket + current user).
set -euo pipefail
cd "$(dirname "$0")/.."

DB="zan_test_$$"
psql_admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }
psql_db()    { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

cleanup() { psql_admin -c "drop database if exists \"$DB\"" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_admin -c "create database \"$DB\"" >/dev/null

psql_db -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  # 0002 needs the PGroonga extension, which plain PostgreSQL does not ship.
  if [[ "$f" == *pgroonga* && -z "${WITH_PGROONGA:-}" ]]; then
    echo "skip   $f (set WITH_PGROONGA=1 on a server that has PGroonga)"
    continue
  fi
  echo "apply  $f"
  psql_db -o /dev/null -f "$f"
done
for f in supabase/tests/[1-9]*.sql; do
  echo "test   $f"
  psql_db -o /dev/null -f "$f"
done
echo "ok"
