#!/usr/bin/env bash
# Only creates a private, socket-only PostgreSQL cluster. Never consumes an admin URL.
set -euo pipefail
cd "$(dirname "$0")/../.."
repo=$PWD
mkdir -p "$repo/output/evidence/tile-to-world/task-30"
evidence=$(mktemp -d "$repo/output/evidence/tile-to-world/task-30/run.XXXXXX")
printf 'Evidence: %s\n' "$evidence"
export LC_ALL=C
owned=$(mktemp -d /tmp/spatial-sql-st_01a07acd.XXXXXX)
pg=/usr/lib/postgresql/16/bin
started=false
cleanup() {
  status=$?
  trap - EXIT
  if $started; then
    "$pg/pg_ctl" -D "$owned/data" -m immediate -w stop >> "$evidence/cluster.log" 2>&1 || exit 1
  fi
  if [[ -f "$owned/postgres.log" ]]; then cp "$owned/postgres.log" "$evidence/postgres.log"; fi
  rm -rf -- "$owned"
  printf 'Private socket-only cluster %s stopped; owned temporary directory removed.\nNo production connection or protected-row cleanup bypass used.\nRun exit: %s\n' "$owned" "$status" > "$evidence/cleanup.md"
  exit "$status"
}
# Teardown is registered before initdb/startup, including interrupted runs.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$pg/initdb" -D "$owned/data" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=reject > "$evidence/cluster.log" 2>&1
mkdir "$owned/socket"
printf '%s\n' 'log_lock_waits=on' "deadlock_timeout='50ms'" "log_line_prefix='[%p] '" >> "$owned/data/postgresql.conf"
started=true
"$pg/pg_ctl" -D "$owned/data" -l "$owned/postgres.log" -o "-k $owned/socket -c listen_addresses='' -c max_connections=12" -w start >> "$evidence/cluster.log" 2>&1
SPATIAL_TEST_DATABASE_URL="host=$owned/socket dbname=postgres user=$(id -un)"
export SPATIAL_TEST_DATABASE_URL
export SPATIAL_TEST_POSTGRES_LOG="$owned/postgres.log"
psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 > "$evidence/bootstrap.log" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
SQL
for migration in supabase/migrations/2026*.sql; do
  # Public benchmark RLS is unrelated; all applicable rpg_zzu migrations run unmodified.
  case "$migration" in
    *20260814000000*|*20260907000000*) continue ;;
  esac
  psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration" >> "$evidence/bootstrap.log" 2>&1
done
set +e
psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v red=1 -f test/integration/spatial-publication.sql > "$evidence/schema-red.log" 2>&1
red=$?
set -e
printf '\nexit=%s (expected 3)\n' "$red" >> "$evidence/schema-red.log"
[[ "$red" == 3 ]]
grep -q 'SPATIAL_OLD_WRITER_DATA_LOSS' "$evidence/schema-red.log"
if [[ "${1:-}" == red ]]; then exit 0; fi
psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260907000000_spatial_authoring_cas.sql > "$evidence/migration.log" 2>&1
# Unmodified SQL writes a relative task-5 roles receipt: sandbox that path, never overwrite history.
(
  cd "$owned"
  mkdir -p output/evidence/tile-to-world/task-5
  psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$repo/test/integration/spatial-publication.sql"
) > "$evidence/green.log" 2>&1
mv "$owned/output/evidence/tile-to-world/task-5/roles.json" "$evidence/roles.json"
[[ $(grep -c 'NOTICE:  PASS:' "$evidence/green.log") == 66 ]]
printf '\nexit=0 assertions=66\n' >> "$evidence/green.log"
set +e
bash scripts/qa/spatial-sql-echo-red.sh > "$evidence/red.log" 2>&1
echo_red=$?
set -e
printf '\nexit=%s (expected 1)\n' "$echo_red" >> "$evidence/red.log"
[[ "$echo_red" == 1 ]]
grep -q 'SPATIAL_ECHO_WITHOUT_OVERLAP' "$evidence/red.log"
bun scripts/qa/spatial-sql-races.mts > "$evidence/races.json"
printf 'SQL contract and five database-side races passed.\n'
