#!/usr/bin/env bash
# 로컬 postgres 에 마이그레이션을 순서대로 적용하고 anon 권한을 실측한다.
set -euo pipefail
REPO=/home/main/z-project/rpg-zzu-ai-log-rls
M=$REPO/legacyDb/migrations
CN=ulw-rls-pg
PGPASS=ulwproof

docker rm -f "$CN" >/dev/null 2>&1 || true
docker run -d --name "$CN" -e POSTGRES_PASSWORD="$PGPASS" -p 55433:5432 postgres:15-alpine >/dev/null
until docker exec "$CN" pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done
echo "READY container=$CN"

q() { docker exec -i -e PGPASSWORD="$PGPASS" "$CN" psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
apply() { echo "--- apply $1"; q -q < "$M/$1"; }

q -q <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role authenticator noinherit login password 'authpass';
create role service_role nologin;
grant anon, authenticated to authenticator;
create schema if not exists rpg_zzu;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL

apply 20260625000000_rpg_zzu_sync.sql
apply 20260701000000_map_edit_locks.sql
apply 20260706000000_commit_identity.sql
apply 20260709000000_ai_activity_logs.sql
apply 20260713000000_ai_conversations_user_skills.sql

echo "=== BEFORE: anon DELETE privileges"
q -At -c "select table_name, has_table_privilege('anon', 'rpg_zzu.'||table_name, 'DELETE') as anon_delete from (values ('ai_activity_logs'),('ai_conversations'),('ai_analysis_runs'),('user_skills'),('maps')) as t(table_name);"

apply 20260827000000_ai_log_anon_delete_revoke.sql

echo "=== AFTER: anon DELETE privileges"
q -At -c "select table_name, has_table_privilege('anon', 'rpg_zzu.'||table_name, 'DELETE') as anon_delete from (values ('ai_activity_logs'),('ai_conversations'),('ai_analysis_runs'),('user_skills'),('maps')) as t(table_name);"

echo "=== seed one project + rows as owner"
q -q <<'SQL'
insert into rpg_zzu.projects (project_id, title, schema_version, current_json, current_sha256, map_count, tileset_count, terrain_template_count)
values ('proof-project', 'proof', 1, '{"meta":{"title":"proof"}}'::jsonb, repeat('a', 64), 0, 0, 0)
on conflict (project_id) do nothing;
SQL

echo "=== anon session: INSERT / SELECT / UPDATE / DELETE"
q -q -c "set role anon;" -c "
insert into rpg_zzu.ai_activity_logs (log_id, project_id, channel, instruction, payload_json)
values ('11111111-1111-4111-8111-111111111111', 'proof-project', 'chat', 'proof', '{}'::jsonb)
on conflict (log_id) do update set instruction = excluded.instruction;" && echo "anon INSERT+UPSERT ai_activity_logs: OK"
q -At -c "set role anon;" -c "select count(*) from rpg_zzu.ai_activity_logs where project_id='proof-project';" | sed 's/^/anon SELECT ai_activity_logs rows: /'
q -q -c "set role anon;" -c "
insert into rpg_zzu.ai_conversations (conversation_id, project_id, title, model, entries_json, saved_at)
values ('proof-conv', 'proof-project', 't', 'm', '[]'::jsonb, now())
on conflict (conversation_id) do update set title = excluded.title;" && echo "anon INSERT+UPSERT ai_conversations: OK"
q -q -c "set role anon;" -c "
insert into rpg_zzu.user_skills (skill_id, project_id, name, template)
values ('proof-skill', 'proof-project', 'n', 't')
on conflict (project_id, skill_id) do update set name = excluded.name;" && echo "anon INSERT+UPSERT user_skills: OK"

echo "--- anon DELETE ai_activity_logs (기대: permission denied)"
if q -q -c "set role anon;" -c "delete from rpg_zzu.ai_activity_logs where project_id='proof-project';" 2>&1 | tee /tmp/ulw-del-activity.txt; then
  echo "UNEXPECTED: anon deleted ai_activity_logs"; else echo "EXPECTED FAIL: $(tr -d '\n' < /tmp/ulw-del-activity.txt)"; fi
echo "--- anon DELETE ai_conversations (기대: permission denied)"
if q -q -c "set role anon;" -c "delete from rpg_zzu.ai_conversations where project_id='proof-project';" 2>&1 | tee /tmp/ulw-del-conv.txt; then
  echo "UNEXPECTED: anon deleted ai_conversations"; else echo "EXPECTED FAIL: $(tr -d '\n' < /tmp/ulw-del-conv.txt)"; fi
echo "--- anon DELETE user_skills (기대: 성공 — UI 삭제 경로 유지)"
q -q -c "set role anon;" -c "delete from rpg_zzu.user_skills where project_id='proof-project' and skill_id='proof-skill';" && echo "anon DELETE user_skills: OK"

echo "=== rows survive after denied deletes"
q -At -c "select 'activity='||count(*) from rpg_zzu.ai_activity_logs where project_id='proof-project';"
q -At -c "select 'conversation='||count(*) from rpg_zzu.ai_conversations where project_id='proof-project';"

echo "=== grant catalog (applier 가 읽는 뷰)"
q -At -c "select table_name||'/'||privilege_type from information_schema.role_table_grants where table_schema='rpg_zzu' and grantee='anon' and table_name in ('ai_activity_logs','ai_conversations','ai_analysis_runs') order by 1;"

echo "=== apply completed Phase8 RLS draft"
apply DRAFT_20260706_auth_rls.sql
q -At -c "select relname||' rls='||relrowsecurity from pg_class where relnamespace='rpg_zzu'::regnamespace and relname in ('ai_activity_logs','ai_conversations','user_skills') order by 1;"
q -At -c "select tablename||' policies='||count(*) from pg_policies where schemaname='rpg_zzu' and tablename in ('ai_activity_logs','ai_conversations','user_skills') group by tablename order by 1;"
q -At -c "select 'anon_any_grant='||count(*) from information_schema.role_table_grants where table_schema='rpg_zzu' and grantee='anon';"
echo "PROOF DONE"
