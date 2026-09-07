-- Disposable database fixtures only. Never installed by the product migration.
CREATE SCHEMA qa;
GRANT USAGE ON SCHEMA qa TO anon, authenticated, authenticator, service_role;
CREATE FUNCTION qa.assert(ok boolean, behavior text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', behavior; END IF;
 RAISE NOTICE 'PASS: %', behavior;
END $$;
CREATE FUNCTION qa.reject(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual = RETURNED_SQLSTATE;
 END;
 PERFORM qa.assert(actual = expected, format('rejection %s for %s (actual %s)', expected, statement, actual));
END $$;
CREATE FUNCTION qa.legacy() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT '{"version":4,"meta":{"title":"raw title"},"maps":{"m":{"id":"m","name":"raw root","width":1,"height":1,"tilesetId":"t","lowerTiles":[0],"upperTiles":[0],"events":[{"commands":[{"code":"shop","goods":[]}]}]}},"tilesets":{"t":{"id":"t","name":"raw tileset","count":1,"terrainTemplates":[{"id":"retired","name":"raw retired"}]}},"scratchConceptBundles":[],"unknownRaw":{"keep":true}}'::jsonb
$$;
CREATE FUNCTION qa.document(raw jsonb DEFAULT qa.legacy()) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT '{"version":1,"library":{"objects":{},"spaces":{},"places":{},"regions":{},"worlds":{}},"occurrences":{},"rootOccurrenceIds":[],"connections":[]}'::jsonb ||
  jsonb_build_object('legacyImport',jsonb_build_object('version',1,'sourceHash',digest,'mapping','[]'::jsonb,
   'backup',jsonb_build_object('encoding','raw-json','json',raw::text,'sha256',digest)))
 FROM (SELECT encode(sha256(convert_to(raw::text,'UTF8')),'hex') AS digest) archive
$$;
CREATE FUNCTION qa.canonical() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT qa.legacy() || jsonb_build_object('spatialAuthoring', qa.document())
$$;
CREATE FUNCTION qa.raw_snapshot(id text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT p.current_json || jsonb_build_object('maps', p.current_json->'maps' ||
   coalesce((SELECT jsonb_object_agg(m.map_id,m.map_json) FROM rpg_zzu.maps m WHERE m.project_id=id),'{}'))
 FROM rpg_zzu.projects p WHERE p.project_id=id
$$;
-- Given fixtures use the actual pre-existing browser insert surface.
SET ROLE anon;
INSERT INTO rpg_zzu.projects
 SELECT id, 'QA', 4, qa.legacy(), 'raw-sha', 1, 1, 1, now()
 FROM unnest(ARRAY['legacy','activate','race-activation-first','race-writer-first','race-root-first']) id;
INSERT INTO rpg_zzu.maps
 SELECT project_id, 'm', 'overlay', 1, 1, 't', 'lower', 'upper', 1, 1,
   jsonb_set(qa.legacy()->'maps'->'m','{name}','"raw overlay"'), now()
 FROM rpg_zzu.projects;
RESET ROLE;
CREATE TABLE qa.accepted (id text PRIMARY KEY, receipt jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE ON qa.accepted TO anon, authenticated, authenticator, service_role;
