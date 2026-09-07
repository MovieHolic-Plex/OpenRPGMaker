#!/usr/bin/env bash
# Given: a real duplicate-create contender held after the old pre-query echo.
set -euo pipefail
connection=${SPATIAL_TEST_DATABASE_URL:?}
[[ "$connection" =~ ^host=/tmp/spatial-sql-st_01a07acd\.[A-Za-z0-9]+/socket\ dbname=postgres\ user=[a-z_][a-z0-9_-]*$ ]]
owned=${connection#host=}
owned=${owned%%/socket *}
gate="$owned/echo-gate"
mkfifo "$gate" "$owned/holder-in" "$owned/holder-out" "$owned/contender-in" "$owned/contender-out"
exec 3<>"$owned/holder-in" 4<>"$owned/holder-out" 5<>"$owned/contender-in" 6<>"$owned/contender-out" 7<>"$gate"
psql "$connection" -XAtq -v ON_ERROR_STOP=1 <&3 >&4 &
holder_process=$!
psql "$connection" -XAtq -v ON_ERROR_STOP=1 <&5 >&6 &
contender_process=$!
children_active=true
cleanup() {
  status=$1
  trap - EXIT
  if $children_active; then
    printf 'released\n' >&7
    kill "$holder_process" "$contender_process" || printf 'Owned psql child already exited during failure cleanup.\n' >&2
    wait "$holder_process" "$contender_process" || printf 'Owned psql cleanup returned nonzero after failed test (original exit %s).\n' "$status" >&2
  fi
  exit "$status"
}
trap 'cleanup "$?"' EXIT
printf '%s\n' 'SELECT pg_backend_pid();' >&3
IFS= read -r -t 15 holder <&4
printf '%s\n' 'SELECT pg_backend_pid();' >&5
IFS= read -r -t 15 contender <&6
printf '%s\n' "SET SESSION AUTHORIZATION authenticator; SET ROLE anon; BEGIN; SELECT rpg_zzu.publish_spatial_project('echo-red-create',NULL,qa.canonical(),'create');" '\echo HOLDER_READY' >&3
IFS= read -r -t 15 receipt <&4
IFS= read -r -t 15 ready <&4
[[ "$ready" == HOLDER_READY && "$receipt" == *echo-red-create* ]]
# When: psql emits exactly the old signal, then its shell gate forbids SQL submission.
printf '%s\n' 'SET SESSION AUTHORIZATION authenticator; SET ROLE anon;' '\echo CREATE_STARTED' "\\! read released < '$gate'" "SELECT qa.reject(\$q\$SELECT rpg_zzu.publish_spatial_project('echo-red-create',NULL,qa.canonical(),'create')\$q\$,'PT409');" '\echo CONTENDER_DONE' >&5
IFS= read -r -t 15 started <&6
[[ "$started" == CREATE_STARTED ]]
overlap=$(psql "$connection" -XAtq -v ON_ERROR_STOP=1 -c "SELECT $holder=ANY(pg_blocking_pids($contender));")
psql "$connection" -XAtq -v ON_ERROR_STOP=1 -c "SELECT jsonb_build_object('holder_pid',$holder,'contender_pid',$contender,'holder_state',h.state,'contender_state',c.state,'blockers',pg_blocking_pids(c.pid),'order',ARRAY['holder_open','echo_received','live_snapshot_before_release']) FROM pg_stat_activity h,pg_stat_activity c WHERE h.pid=$holder AND c.pid=$contender;"
printf '%s\n' 'COMMIT;' '\echo HOLDER_COMMITTED' >&3
IFS= read -r -t 15 committed <&4
[[ "$committed" == HOLDER_COMMITTED ]]
printf 'released\n' >&7
IFS= read -r -t 15 result <&6
IFS= read -r -t 15 completed <&6
[[ "$completed" == CONTENDER_DONE && -z "$result" ]]
printf '%s\n' '\q' >&3
printf '%s\n' '\q' >&5
wait "$holder_process" "$contender_process"
children_active=false
# Then: the original PT409 outcome passed, but the claimed overlap must fail.
printf 'order=holder_commit_ack,gate_release,same_statement_PT409\nold_outcome=passed/PT409 overlap=%s\n' "$overlap"
if [[ "$overlap" != t ]]; then
  printf 'SPATIAL_ECHO_WITHOUT_OVERLAP: pre-query echo allowed sequential success\n' >&2
  cleanup 1
fi
printf 'Expected the controlled old schedule to lack overlap\n' >&2
cleanup 2
