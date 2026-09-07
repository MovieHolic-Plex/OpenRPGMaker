BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE ROLE spatial_project_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA rpg_zzu, extensions TO spatial_project_writer;
CREATE TABLE rpg_zzu.spatial_project_revisions (
  project_id text PRIMARY KEY REFERENCES rpg_zzu.projects(project_id),
  revision bigint NOT NULL CHECK (revision > 0),
  current_sha256 text NOT NULL CHECK (current_sha256 ~ '^[0-9a-f]{64}$')
);
-- Existing default privileges otherwise silently grant browser writes on this table.
REVOKE ALL ON rpg_zzu.spatial_project_revisions FROM PUBLIC, anon, authenticated, authenticator, service_role;
GRANT SELECT, INSERT, UPDATE ON rpg_zzu.spatial_project_revisions TO spatial_project_writer;
GRANT SELECT ON rpg_zzu.projects TO spatial_project_writer;
GRANT SELECT (project_id,map_id,map_json) ON rpg_zzu.maps TO spatial_project_writer;
GRANT SELECT (project_id) ON rpg_zzu.tilesets, rpg_zzu.terrain_templates TO spatial_project_writer;
GRANT INSERT (project_id,title,schema_version,current_json,current_sha256,map_count,tileset_count,terrain_template_count,updated_at),
 UPDATE (title,schema_version,current_json,current_sha256,map_count,tileset_count,terrain_template_count,updated_at)
 ON rpg_zzu.projects TO spatial_project_writer;
GRANT DELETE ON rpg_zzu.maps, rpg_zzu.tilesets, rpg_zzu.terrain_templates TO spatial_project_writer;
GRANT INSERT (project_id,map_id,name,width,height,tileset_id,lower_sha256,upper_sha256,lower_tile_count,upper_tile_count,map_json)
 ON rpg_zzu.maps TO spatial_project_writer;
GRANT INSERT (project_id,tileset_id,name,tile_count,tileset_json) ON rpg_zzu.tilesets TO spatial_project_writer;
GRANT INSERT (project_id,tileset_id,template_id,name,category,template_json) ON rpg_zzu.terrain_templates TO spatial_project_writer;

-- The deployed project policy is table ACLs, not the unrelated DRAFT RLS policy.
-- Fail closed if that contract changes; do not execute definer writes across unknown RLS.
-- 'role' is PostgreSQL's access-controlled SET ROLE state, NOT a custom JWT/GUC claim.
CREATE FUNCTION rpg_zzu.spatial_check_caller(p_operation text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE caller name := coalesce(nullif(current_setting('role'), 'none'), session_user);
BEGIN
  IF NOT has_schema_privilege(caller, 'rpg_zzu', 'USAGE')
    OR NOT has_table_privilege(caller, 'rpg_zzu.projects', 'SELECT')
    OR NOT has_table_privilege(caller, 'rpg_zzu.projects', CASE WHEN p_operation='create' THEN 'INSERT' ELSE 'UPDATE' END)
    OR EXISTS (SELECT FROM pg_class WHERE oid='rpg_zzu.projects'::regclass AND relrowsecurity)
  THEN RAISE EXCEPTION 'Project publication access denied' USING ERRCODE='42501'; END IF;
  -- Repeatable-read could retain an old map-only snapshot after acquiring the parent lock.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Publication requires read committed isolation' USING ERRCODE='25001'; END IF;
END $$;

-- Invoker guards need only this read/lock capability, never registry write access.
-- Every mirror mutation takes the same parent lock as activation, before deciding.
CREATE FUNCTION rpg_zzu.spatial_is_fenced(p_project_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE root jsonb;
BEGIN
  SELECT p.current_json INTO root FROM rpg_zzu.projects p WHERE p.project_id=p_project_id FOR UPDATE;
  RETURN coalesce(root ? 'spatialAuthoring', false) OR EXISTS (
    SELECT FROM rpg_zzu.spatial_project_revisions r WHERE r.project_id=p_project_id);
END $$;
CREATE FUNCTION rpg_zzu.spatial_guard_write() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF current_user = 'spatial_project_writer' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND rpg_zzu.spatial_is_fenced(OLD.project_id) THEN
    RAISE EXCEPTION 'Spatial project requires publication RPC' USING ERRCODE='42501';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF rpg_zzu.spatial_is_fenced(NEW.project_id) THEN
      RAISE EXCEPTION 'Spatial project requires publication RPC' USING ERRCODE='42501';
    END IF;
    IF TG_TABLE_NAME='projects' AND to_jsonb(NEW)->'current_json' ? 'spatialAuthoring' THEN
      RAISE EXCEPTION 'Spatial activation requires publication RPC' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER spatial_root_fence BEFORE INSERT OR UPDATE OR DELETE ON rpg_zzu.projects
 FOR EACH ROW EXECUTE FUNCTION rpg_zzu.spatial_guard_write();
CREATE TRIGGER spatial_map_fence BEFORE INSERT OR UPDATE OR DELETE ON rpg_zzu.maps
 FOR EACH ROW EXECUTE FUNCTION rpg_zzu.spatial_guard_write();
CREATE TRIGGER spatial_tileset_fence BEFORE INSERT OR UPDATE OR DELETE ON rpg_zzu.tilesets
 FOR EACH ROW EXECUTE FUNCTION rpg_zzu.spatial_guard_write();
CREATE TRIGGER spatial_terrain_fence BEFORE INSERT OR UPDATE OR DELETE ON rpg_zzu.terrain_templates
 FOR EACH ROW EXECUTE FUNCTION rpg_zzu.spatial_guard_write();

-- The five inputs are the fixed public RPC protocol, not independent helper parameters.
-- p_legacy_baseline is the raw root with maps overlaid by map_id. SHA is separate.
CREATE FUNCTION rpg_zzu.publish_spatial_project(p_project_id text, p_expected_sha256 text,
 p_project jsonb, p_operation text, p_legacy_baseline jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  root rpg_zzu.projects; marker jsonb := p_project->'spatialAuthoring';
  baseline jsonb; accepted_sha text; accepted_revision bigint; terrain_count integer; key text;
BEGIN
  PERFORM rpg_zzu.spatial_check_caller(p_operation);
  IF p_operation IS NULL OR p_operation NOT IN ('create','update','activate')
    OR p_project_id IS NULL OR length(p_project_id)=0
    OR (p_operation='create' AND p_expected_sha256 IS NOT NULL)
    OR (p_operation<>'create' AND p_expected_sha256 IS NULL)
    OR ((p_operation='activate') <> (p_legacy_baseline IS NOT NULL))
  THEN RAISE EXCEPTION 'Invalid publication operation or baseline' USING ERRCODE='22023'; END IF;
  IF (p_project->'version' = '4'::jsonb AND marker->'version' = '1'::jsonb
    AND jsonb_typeof(p_project->'maps')='object' AND jsonb_typeof(p_project->'tilesets')='object'
    AND jsonb_typeof(p_project#>'{meta,title}')='string'
    AND jsonb_typeof(marker->'library')='object' AND jsonb_typeof(marker->'occurrences')='object'
    AND jsonb_typeof(marker->'rootOccurrenceIds')='array' AND jsonb_typeof(marker->'connections')='array'
    AND marker#>'{legacyImport,version}'='1'::jsonb AND jsonb_typeof(marker#>'{legacyImport,mapping}')='array'
    AND marker#>>'{legacyImport,backup,encoding}'='raw-json'
    AND jsonb_typeof(marker#>'{legacyImport,backup,json}')='string'
    AND jsonb_typeof(marker#>'{legacyImport,backup,sha256}')='string'
    AND marker#>>'{legacyImport,backup,sha256}' ~ '^[0-9a-f]{64}$'
    AND jsonb_typeof(marker#>'{legacyImport,sourceHash}')='string'
    AND marker#>>'{legacyImport,sourceHash}' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'Expected project v4 and spatial document v1' USING ERRCODE='22023'; END IF;
  FOREACH key IN ARRAY ARRAY['objects','spaces','places','regions','worlds'] LOOP
    IF jsonb_typeof(marker->'library'->key) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid spatial library collection' USING ERRCODE='22023'; END IF;
  END LOOP;
  accepted_sha := encode(extensions.digest(convert_to(p_project::text,'UTF8'),'sha256'),'hex');
  SELECT coalesce(sum(CASE WHEN jsonb_typeof(value->'terrainTemplates')='array'
    THEN jsonb_array_length(value->'terrainTemplates') ELSE 0 END),0) INTO terrain_count
    FROM jsonb_each(p_project->'tilesets');
  IF p_operation='create' THEN
    BEGIN
      INSERT INTO rpg_zzu.projects(project_id,title,schema_version,current_json,current_sha256,map_count,tileset_count,terrain_template_count)
      VALUES(p_project_id,p_project#>>'{meta,title}',4,p_project,accepted_sha,
        (SELECT count(*) FROM jsonb_object_keys(p_project->'maps')),
        (SELECT count(*) FROM jsonb_object_keys(p_project->'tilesets')),terrain_count);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Project already exists' USING ERRCODE='PT409';
    END;
    accepted_revision := 1;
    INSERT INTO rpg_zzu.spatial_project_revisions VALUES(p_project_id,accepted_revision,accepted_sha);
  ELSE
    SELECT p.* INTO root FROM rpg_zzu.projects p WHERE p.project_id=p_project_id FOR UPDATE;
    IF NOT FOUND OR root.current_sha256 IS DISTINCT FROM p_expected_sha256 THEN
      RAISE EXCEPTION 'Loaded root revision is stale' USING ERRCODE='PT409'; END IF;
    SELECT r.revision INTO accepted_revision FROM rpg_zzu.spatial_project_revisions r WHERE r.project_id=p_project_id;
    IF p_operation='activate' THEN
      IF accepted_revision IS NOT NULL OR root.current_json ? 'spatialAuthoring' THEN
        RAISE EXCEPTION 'Project is already spatial' USING ERRCODE='PT409'; END IF;
      baseline := root.current_json || jsonb_build_object('maps',coalesce(root.current_json->'maps','{}'::jsonb) ||
        coalesce((SELECT jsonb_object_agg(m.map_id,m.map_json) FROM rpg_zzu.maps m WHERE m.project_id=p_project_id),'{}'::jsonb));
      IF baseline IS DISTINCT FROM p_legacy_baseline THEN
        RAISE EXCEPTION 'Raw legacy baseline is stale' USING ERRCODE='PT409'; END IF;
      IF p_project - 'spatialAuthoring' IS DISTINCT FROM baseline THEN
        RAISE EXCEPTION 'Activation must preserve raw legacy payload' USING ERRCODE='22023'; END IF;
      accepted_revision := 1;
      INSERT INTO rpg_zzu.spatial_project_revisions VALUES(p_project_id,accepted_revision,accepted_sha);
    ELSE
      IF accepted_revision IS NULL OR root.current_json#>'{spatialAuthoring,version}' IS DISTINCT FROM '1'::jsonb
        OR root.schema_version<>4 THEN
        RAISE EXCEPTION 'Explicit activation required' USING ERRCODE='PT409'; END IF;
      accepted_revision := accepted_revision+1;
      UPDATE rpg_zzu.spatial_project_revisions SET revision=accepted_revision,current_sha256=accepted_sha WHERE project_id=p_project_id;
    END IF;
    UPDATE rpg_zzu.projects SET current_json=p_project,current_sha256=accepted_sha,title=p_project#>>'{meta,title}',
      schema_version=4,map_count=(SELECT count(*) FROM jsonb_object_keys(p_project->'maps')),
      tileset_count=(SELECT count(*) FROM jsonb_object_keys(p_project->'tilesets')),
      terrain_template_count=terrain_count,updated_at=now() WHERE project_id=p_project_id;
  END IF;
  RETURN jsonb_build_object('project_id',p_project_id,'revision',accepted_revision,'sha256',accepted_sha,'project',p_project);
END $$;

-- A separate transaction: projection errors cannot undo an already accepted root.
CREATE FUNCTION rpg_zzu.sync_spatial_mirrors(p_project_id text,p_expected_sha256 text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE root rpg_zzu.projects;
BEGIN
  PERFORM rpg_zzu.spatial_check_caller('update');
  SELECT p.* INTO root FROM rpg_zzu.projects p WHERE p.project_id=p_project_id FOR UPDATE;
  IF NOT FOUND OR p_expected_sha256 IS NULL OR root.current_sha256 IS DISTINCT FROM p_expected_sha256
    OR NOT EXISTS (SELECT FROM rpg_zzu.spatial_project_revisions r WHERE r.project_id=p_project_id AND r.current_sha256=p_expected_sha256)
    OR root.current_json#>'{spatialAuthoring,version}' IS DISTINCT FROM '1'::jsonb THEN
    RAISE EXCEPTION 'Accepted spatial revision is stale or missing' USING ERRCODE='PT409'; END IF;
  DELETE FROM rpg_zzu.maps WHERE project_id=p_project_id;
  DELETE FROM rpg_zzu.tilesets WHERE project_id=p_project_id;
  DELETE FROM rpg_zzu.terrain_templates WHERE project_id=p_project_id;
  INSERT INTO rpg_zzu.maps(project_id,map_id,name,width,height,tileset_id,lower_sha256,upper_sha256,lower_tile_count,upper_tile_count,map_json)
    SELECT p_project_id,key,value->>'name',(value->>'width')::integer,(value->>'height')::integer,value->>'tilesetId',
      encode(extensions.digest(convert_to((value->'lowerTiles')::text,'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to((value->'upperTiles')::text,'UTF8'),'sha256'),'hex'),
      jsonb_array_length(value->'lowerTiles'),jsonb_array_length(value->'upperTiles'),value
    FROM jsonb_each(root.current_json->'maps');
  INSERT INTO rpg_zzu.tilesets(project_id,tileset_id,name,tile_count,tileset_json)
    SELECT p_project_id,key,value->>'name',(value->>'count')::integer,value FROM jsonb_each(root.current_json->'tilesets');
  INSERT INTO rpg_zzu.terrain_templates(project_id,tileset_id,template_id,name,category,template_json)
    SELECT p_project_id,t.key,v->>'id',v->>'name',v->>'category',v FROM jsonb_each(root.current_json->'tilesets') t
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(t.value->'terrainTemplates','[]'::jsonb)) v;
  RETURN jsonb_build_object('project_id',p_project_id,'sha256',p_expected_sha256,'status','synced');
END $$;

ALTER FUNCTION rpg_zzu.spatial_check_caller(text) OWNER TO spatial_project_writer;
ALTER FUNCTION rpg_zzu.spatial_is_fenced(text) OWNER TO spatial_project_writer;
ALTER FUNCTION rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb) OWNER TO spatial_project_writer;
ALTER FUNCTION rpg_zzu.sync_spatial_mirrors(text,text) OWNER TO spatial_project_writer;
REVOKE ALL ON FUNCTION rpg_zzu.spatial_check_caller(text), rpg_zzu.spatial_is_fenced(text),
 rpg_zzu.spatial_guard_write(), rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb),
 rpg_zzu.sync_spatial_mirrors(text,text) FROM PUBLIC, anon, authenticated, authenticator, service_role;
GRANT EXECUTE ON FUNCTION rpg_zzu.spatial_is_fenced(text),
 rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb), rpg_zzu.sync_spatial_mirrors(text,text)
 TO anon, authenticated, authenticator, service_role;
COMMIT;
