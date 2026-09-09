#!/usr/bin/env bash
# Only creates a private, socket-only PostgreSQL cluster. Never consumes an admin URL.
set -euo pipefail
cd "$(dirname "$0")/../.."
repo=$PWD
task=task-30
if [[ "${1:-}" == task20 ]]; then
  task=task-20
  # Never inherit application credentials, proxy mode, or libpq connection defaults.
  for key in ${!VITE_SUPABASE_@} ${!SUPABASE_@} ${!PG@}; do unset "$key"; done
  # flock's supervising process owns the lock. Detached postgres must not inherit
  # its descriptor and retain the lock after an interrupted launcher has exited.
  for descriptor in /proc/$$/fd/*; do
    if [[ "$(readlink "$descriptor")" == /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock ]]; then
      fd=${descriptor##*/}
      exec {fd}<&-
    fi
  done
fi
mkdir -p "$repo/output/evidence/tile-to-world/$task"
evidence=$(mktemp -d "$repo/output/evidence/tile-to-world/$task/run.XXXXXX")
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
if [[ "${1:-}" == task20 ]]; then
  read -r server_pid < "$owned/data/postmaster.pid"
  for descriptor in /proc/"$server_pid"/fd/*; do
    target=$(readlink "$descriptor")
    printf '%s %s\n' "$descriptor" "$target" >> "$evidence/lock-inheritance.log"
    [[ "$target" != /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock ]]
  done
  psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260907000000_spatial_authoring_cas.sql > "$evidence/migration.log" 2>&1
  psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >> "$evidence/bootstrap.log" <<'SQL'
CREATE FUNCTION rpg_zzu.task20_session() RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$
 SELECT jsonb_build_object('pid',pg_backend_pid(),'caller',current_user,'session',session_user,
   'writerMember',pg_has_role(current_user,'spatial_project_writer','MEMBER'))
$$;
GRANT EXECUTE ON FUNCTION rpg_zzu.task20_session() TO anon;
SQL
  export SPATIAL_TEST_EVIDENCE="$evidence"
  git diff --exit-code -- src supabase > "$evidence/product-source-diff.log"
  git rev-parse HEAD HEAD:src HEAD:supabase/migrations > "$evidence/source-trees.txt"
  sha256sum scripts/qa/spatial-{db-*,http-*,postgrest.mts,persistence.mts,migration.mts,sql-local.sh,sql-lock-wait.mts} src/project/spatial/{persistence,persistenceHttp,saveRouting}.ts src/project/{store,supabaseProjectSync}.ts supabase/migrations/20260907000000_spatial_authoring_cas.sql > "$evidence/source-sha256.txt"
  bun build scripts/qa/spatial-db-proof.mts --target bun --outdir "$owned/build" > "$evidence/build.log" 2>&1
  bun scripts/qa/spatial-db-proof.mts "${2:-all}"
  exit 0
fi
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
