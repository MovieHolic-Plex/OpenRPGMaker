\set ON_ERROR_STOP on
-- This executable test entry point must not create fixtures on a deployed database.
DO $$ BEGIN
 IF current_setting('unix_socket_directories') !~ '^/tmp/spatial-sql-st_01a07acd\.[A-Za-z0-9]+/socket$'
   OR inet_server_addr() IS NOT NULL THEN
  RAISE EXCEPTION 'Spatial SQL tests require their task-owned private socket cluster' USING ERRCODE='42501';
 END IF;
END $$;
-- Given: the unchanged deployed schema and a stale browser snapshot.
\if :{?red}
BEGIN;
SET LOCAL ROLE anon;
INSERT INTO rpg_zzu.projects VALUES
 ('qa-red', 'QA', 4, '{"version":4,"meta":{"title":"QA"},"maps":{},"tilesets":{}}', 'old', 0, 0, 0, now());
UPDATE rpg_zzu.projects SET current_json = current_json || '{"spatialAuthoring":{"version":1},"authored":"A"}' WHERE project_id = 'qa-red';
-- When: an old browser unconditionally publishes its loaded root.
UPDATE rpg_zzu.projects SET current_json = '{"version":4,"meta":{"title":"QA"},"maps":{},"tilesets":{}}', current_sha256 = 'stale-B' WHERE project_id = 'qa-red';
-- Then: preservation must fail before the fence migration exists.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM rpg_zzu.projects WHERE project_id = 'qa-red' AND current_json ? 'spatialAuthoring') THEN
   RAISE EXCEPTION 'SPATIAL_OLD_WRITER_DATA_LOSS: stale B erased accepted spatial authority' USING ERRCODE = 'P0001';
 END IF;
END $$;
ROLLBACK;
\else
\ir spatial-publication-green.sql
\endif
