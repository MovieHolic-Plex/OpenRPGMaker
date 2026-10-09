-- Given: a caller retains RPC EXECUTE but loses the existing root UPDATE entitlement.
REVOKE UPDATE ON rpg_zzu.projects FROM authenticated;
SET SESSION AUTHORIZATION authenticator;
SET ROLE authenticated;
-- When/Then: SECURITY DEFINER cannot manufacture the missing entitlement.
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('created','ignored',qa.canonical(),'update')$q$, '42501');
SELECT qa.reject($q$SELECT rpg_zzu.sync_spatial_mirrors('created','ignored')$q$, '42501');
RESET ROLE;
RESET SESSION AUTHORIZATION;
GRANT UPDATE ON rpg_zzu.projects TO authenticated;
-- Given: an unrelated role can use the schema but has no project rights.
CREATE ROLE qa_intruder NOLOGIN;
GRANT USAGE ON SCHEMA rpg_zzu, qa TO qa_intruder;
SET SESSION AUTHORIZATION qa_intruder;
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('intruder',NULL,qa.canonical(),'create')$q$, '42501');
SELECT qa.reject($q$SELECT rpg_zzu.spatial_check_caller('create')$q$, '42501');
SELECT qa.reject($q$SET ROLE spatial_project_writer$q$, '42501');
SELECT qa.reject($q$SET ROLE anon$q$, '42501');
RESET SESSION AUTHORIZATION;
-- Even an accidentally granted EXECUTE cannot bypass table privileges.
GRANT EXECUTE ON FUNCTION rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb) TO qa_intruder;
SET SESSION AUTHORIZATION qa_intruder;
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('intruder',NULL,qa.canonical(),'create')$q$, '42501');
RESET SESSION AUTHORIZATION;
REVOKE EXECUTE ON FUNCTION rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb) FROM qa_intruder;
-- Given: session_user is the browser itself, without an explicit SET ROLE.
SET SESSION AUTHORIZATION anon;
SELECT qa.assert(current_setting('role')='none' AND current_user='anon', 'direct browser session identity');
INSERT INTO qa.accepted VALUES ('direct-session',rpg_zzu.publish_spatial_project('direct-session',NULL,qa.canonical(),'create'));
RESET SESSION AUTHORIZATION;
-- Given: future RLS is enabled. Unknown policies must fail closed rather than broaden access.
ALTER TABLE rpg_zzu.projects ENABLE ROW LEVEL SECURITY;
SET ROLE anon;
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('rls',NULL,qa.canonical(),'create')$q$, '42501');
RESET ROLE;
ALTER TABLE rpg_zzu.projects DISABLE ROW LEVEL SECURITY;
-- Then: catalog evidence proves no browser can SET ROLE or modify the sticky registry.
SELECT qa.assert(NOT EXISTS(SELECT FROM pg_auth_members WHERE roleid='spatial_project_writer'::regrole), 'writer has no assignable memberships');
SELECT qa.assert(NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls,
 'writer role is non-login and unprivileged') FROM pg_roles WHERE rolname='spatial_project_writer';
SELECT qa.assert(NOT has_table_privilege(role,'rpg_zzu.spatial_project_revisions','SELECT,INSERT,UPDATE,DELETE'),
 'registry default grants revoked for '||role) FROM unnest(ARRAY['anon','authenticated','authenticator','service_role']) role;
SELECT qa.assert(NOT EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.pronamespace='rpg_zzu'::regnamespace AND p.proname IN ('spatial_check_caller','spatial_is_fenced','spatial_guard_write','publish_spatial_project','sync_spatial_mirrors') AND a.grantee=0), 'no PUBLIC function grants');
SELECT qa.assert(NOT has_table_privilege('spatial_project_writer','rpg_zzu.projects','DELETE')
 AND NOT has_column_privilege('spatial_project_writer','rpg_zzu.projects','project_id','UPDATE'), 'writer cannot delete or rename roots');
\pset format unaligned
\pset tuples_only on
\o output/evidence/tile-to-world/task-5/roles.json
SELECT jsonb_build_object('session_transition_tested',true,'checks','passed','roles',
 (SELECT jsonb_agg(jsonb_build_object('role',rolname,'login',rolcanlogin,'superuser',rolsuper,'create_role',rolcreaterole,'bypass_rls',rolbypassrls))
 FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','service_role','spatial_project_writer')),
 'writer_memberships',(SELECT count(*) FROM pg_auth_members WHERE roleid='spatial_project_writer'::regrole));
\o
\pset tuples_only off
\pset format aligned
SELECT qa.assert(NOT has_column_privilege('spatial_project_writer','rpg_zzu.maps','updated_at','INSERT')
 AND NOT has_column_privilege('spatial_project_writer','rpg_zzu.tilesets','updated_at','INSERT')
 AND NOT has_column_privilege('spatial_project_writer','rpg_zzu.terrain_templates','updated_at','INSERT'), 'writer cannot supply unused mirror timestamps');
-- Given: mirror corruption is a projection failure, not a rejected root publication.
SET ROLE anon;
INSERT INTO qa.accepted VALUES ('mirror-failure',rpg_zzu.publish_spatial_project('mirror-failure',NULL,
 jsonb_set(qa.canonical(),'{maps,m,width}','2'),'create'));
-- When: mirror constraints reject an invalid width/count projection.
SELECT qa.reject(format('SELECT rpg_zzu.sync_spatial_mirrors(%L,%L)','mirror-failure',receipt->>'sha256'),'23514') FROM qa.accepted WHERE id='mirror-failure';
-- Then: the separately accepted root remains available and no partial mirror rows survive.
SELECT qa.assert(current_json=a.receipt->'project' AND current_sha256=a.receipt->>'sha256','mirror failure cannot rollback accepted root')
 FROM rpg_zzu.projects p JOIN qa.accepted a ON a.id=p.project_id WHERE p.project_id='mirror-failure';
SELECT qa.assert(NOT EXISTS(SELECT FROM rpg_zzu.maps WHERE project_id='mirror-failure'),'failed projection is atomic');
RESET ROLE;
