#!/usr/bin/env bash
# Task37 owns a disposable database; task20 harness and evidence remain untouched.
set -euo pipefail
cd "$(dirname "$0")/../.."
repo=$PWD
for key in ${!VITE_SUPABASE_@} ${!SUPABASE_@} ${!PG@}; do unset "$key"; done
# The supervising flock retains the shared lock, never the detached postmaster.
for descriptor in /proc/$$/fd/*; do
  if [[ "$(readlink "$descriptor")" == /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock ]]; then
    fd=${descriptor##*/}
    exec {fd}<&-
  fi
done
: "${SPATIAL_TEST_POSTGREST_BIN:?Explicit verified PostgREST executable required}"
printf '036738687f9814a9db5f3d78afa6e614bcf20c66add04455e34ea494784db7b3  %s\n' "$SPATIAL_TEST_POSTGREST_BIN" | sha256sum --check
mkdir -p "$repo/output/evidence/tile-to-world/task-37"
evidence=$(mktemp -d "$repo/output/evidence/tile-to-world/task-37/run.XXXXXX")
printf 'Evidence: %s\n' "$evidence"
owned=$(mktemp -d /tmp/spatial-sql-st_01a07acd.XXXXXX)
pg=/usr/lib/postgresql/16/bin
export LC_ALL=C
started=false
cleanup() {
  status=$?
  trap - EXIT
  if $started; then "$pg/pg_ctl" -D "$owned/data" -m immediate -w stop >> "$evidence/cluster.log" 2>&1 || exit 1; fi
  if [[ -f "$owned/postgres.log" ]]; then cp "$owned/postgres.log" "$evidence/postgres.log"; fi
  rm -rf -- "$owned"
  printf 'Owned cluster: %s\nPostgreSQL stopped; cluster, roles and bundle removed.\nShared PostgREST binary retained for parent Q7-Q9.\nRemote database connections: 0\nRun exit: %s\n' "$owned" "$status" > "$evidence/cleanup.md"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$pg/initdb" -D "$owned/data" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=reject > "$evidence/cluster.log" 2>&1
mkdir "$owned/socket"
started=true
"$pg/pg_ctl" -D "$owned/data" -l "$owned/postgres.log" -o "-k $owned/socket -c listen_addresses='' -c max_connections=12" -w start >> "$evidence/cluster.log" 2>&1
read -r server_pid < "$owned/data/postmaster.pid"
for descriptor in /proc/"$server_pid"/fd/*; do
  target=$(readlink "$descriptor")
  printf '%s %s\n' "$descriptor" "$target" >> "$evidence/lock-inheritance.log"
  [[ "$target" != /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock ]]
done
export SPATIAL_TEST_DATABASE_URL="host=$owned/socket dbname=postgres user=$(id -un)"
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
  # Same applicable product migrations as task20, including unchanged anon tightening.
  case "$migration" in *20260814000000*) continue ;; esac
  psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration" >> "$evidence/bootstrap.log" 2>&1
done
# Reuse task20's real invoker identity probe, not a privileged writer or result emulator.
psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >> "$evidence/bootstrap.log" <<'SQL'
CREATE FUNCTION rpg_zzu.task20_session() RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$
 SELECT jsonb_build_object('pid',pg_backend_pid(),'caller',current_user,'session',session_user,
   'writerMember',pg_has_role(current_user,'spatial_project_writer','MEMBER'))
$$;
GRANT EXECUTE ON FUNCTION rpg_zzu.task20_session() TO anon;
SQL
git diff --exit-code -- supabase > "$evidence/migrations-unchanged.log"
git diff -- src/project/supabaseProjectSync.ts > "$evidence/product-source.diff"
git rev-parse HEAD HEAD:supabase/migrations > "$evidence/source-trees.txt"
sha256sum src/project/{supabaseProjectSync,projectCommitLog,store}.ts scripts/qa/spatial-{audit-append.mts,audit-local.sh,postgrest.mts,db-session.mts} supabase/migrations/2026*.sql > "$evidence/source-sha256.txt"
export SPATIAL_TEST_EVIDENCE="$evidence"
bun build --no-env-file scripts/qa/spatial-audit-append.mts --target bun --outdir "$owned/build" > "$evidence/build.log" 2>&1
bun --no-env-file scripts/qa/spatial-audit-append.mts
