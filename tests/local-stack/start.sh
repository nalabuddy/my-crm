#!/usr/bin/env bash
# Local Supabase-compatible stack for the logged-in browser tests. Needs: Postgres 16 running, a PostgREST binary.
# Usage: PGRST_BIN=/path/to/postgrest bash tests/local-stack/start.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PGRST_JWT_SECRET="${PGRST_JWT_SECRET:-local-test-jwt-secret-at-least-32-characters-long}"
export PGRST_SERVER_PORT=3001
DB=crm_e2e
pg_lsclusters | grep -q online || { pg_ctlcluster 16 main start; sleep 3; }
PSQL="su postgres -c"
$PSQL "psql -q -c 'drop database if exists $DB' -c 'create database $DB'"
cat "$ROOT/tests/local-stack/stub.sql" "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/seed.sql" | $PSQL "psql -q -v ON_ERROR_STOP=1 -d $DB"
export PGRST_DB_URI="postgres://authenticator:pw@127.0.0.1:5432/$DB" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon
"${PGRST_BIN:?set PGRST_BIN}" > /tmp/postgrest.log 2>&1 &
node "$ROOT/tests/local-stack/gateway.mjs" > /tmp/gateway.log 2>&1 &
sleep 3; echo "stack up: gateway :54321 -> PostgREST :3001 -> Postgres/$DB"
