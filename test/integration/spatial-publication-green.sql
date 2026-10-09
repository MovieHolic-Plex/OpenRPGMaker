\ir spatial-publication-fixtures.sql
-- Given: PostgREST's non-inheriting login session transitions to a browser role.
SET SESSION AUTHORIZATION authenticator;
SET ROLE anon;
SELECT qa.assert(session_user = 'authenticator' AND current_user = 'anon', 'real PostgREST role transition');
-- When: create publishes an empty, valid spatial authority.
INSERT INTO qa.accepted VALUES ('created', rpg_zzu.publish_spatial_project('created', NULL, qa.canonical(), 'create'));
-- Then: the server computes its SHA and initializes the sticky revision.
SELECT qa.assert(receipt->>'project_id' = 'created' AND (receipt->>'revision')::bigint = 1
 AND length(receipt->>'sha256') = 64 AND receipt->'project' = qa.canonical(), 'insert-only accepted receipt') FROM qa.accepted WHERE id='created';
SELECT qa.assert(map_count=1 AND tileset_count=1 AND terrain_template_count=1,'root metadata reflects accepted payload') FROM rpg_zzu.projects WHERE project_id='created';
SELECT qa.assert(current_sha256=encode(sha256(convert_to(qa.canonical()::text,'UTF8')),'hex'),'server SHA uses accepted JSONB') FROM rpg_zzu.projects WHERE project_id='created';
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('created', NULL, qa.canonical(), 'create')$q$, 'PT409');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad', 'unexpected', qa.canonical(), 'create')$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad', NULL, qa.canonical(), 'unknown')$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad', NULL, qa.canonical(), 'create', '{}')$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad', NULL, jsonb_set(qa.canonical(),'{spatialAuthoring,version}','2'), 'create')$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad', NULL, qa.legacy() || '{"spatialAuthoring":null}', 'create')$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad', NULL, qa.canonical() - 'spatialAuthoring', 'create')$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad',NULL,jsonb_set(qa.canonical(),'{spatialAuthoring,legacyImport,sourceHash}','"invalid"'),'create')$q$,'22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('bad',NULL,jsonb_set(qa.canonical(),'{spatialAuthoring,legacyImport,backup,sha256}','"invalid"'),'create')$q$,'22023');
-- Given: repeatable-read snapshots can hide committed map-only edits after a parent lock.
BEGIN ISOLATION LEVEL REPEATABLE READ;
-- When/Then: publication refuses that isolation instead of accepting a stale raw overlay.
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('isolation',NULL,qa.canonical(),'create')$q$,'25001');
ROLLBACK;
-- Given: two clients retain the same loaded SHA; A changes a distinct value.
INSERT INTO qa.accepted
 SELECT 'updated', rpg_zzu.publish_spatial_project('created', receipt->>'sha256',
   jsonb_set(qa.canonical(),'{meta,title}','"accepted A"'), 'update') FROM qa.accepted WHERE id='created';
-- When: stale B tries to update using the original token.
SELECT qa.reject(format('SELECT rpg_zzu.publish_spatial_project(%L,%L,qa.canonical(),%L)',
 'created', receipt->>'sha256', 'update'), 'PT409') FROM qa.accepted WHERE id='created';
-- Then: no root or revision changed because of B.
SELECT qa.assert(p.current_json = a.receipt->'project' AND p.current_sha256 = a.receipt->>'sha256'
 AND (a.receipt->>'revision')::bigint = 2, 'stale client leaves accepted A intact')
 FROM rpg_zzu.projects p JOIN qa.accepted a ON a.id='updated' WHERE p.project_id='created';
-- Each When below is rejected independently at the real direct SQL surface.
SELECT qa.reject($q$UPDATE rpg_zzu.projects SET current_json=qa.legacy() WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$UPDATE rpg_zzu.projects SET project_id='renamed' WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$INSERT INTO rpg_zzu.projects SELECT 'created','QA',4,qa.legacy(),'bad',1,1,0,now() ON CONFLICT(project_id) DO UPDATE SET current_json=excluded.current_json$q$, '42501');
SELECT qa.reject($q$INSERT INTO rpg_zzu.projects SELECT 'direct-marker','QA',4,qa.canonical(),'bad',1,1,0,now()$q$, '42501');
SELECT qa.reject($q$UPDATE rpg_zzu.projects SET current_json=qa.canonical() WHERE project_id='legacy'$q$, '42501');
SELECT qa.reject($q$SET ROLE spatial_project_writer$q$, '42501');
SELECT qa.reject($q$SELECT set_config('role','spatial_project_writer',false)$q$, '42501');
SELECT qa.reject($q$UPDATE rpg_zzu.spatial_project_revisions SET revision=0$q$, '42501');
SELECT qa.reject($q$DELETE FROM rpg_zzu.spatial_project_revisions$q$, '42501');
-- When: separate projection uses A's accepted SHA, never a caller map body.
SELECT rpg_zzu.sync_spatial_mirrors('created', receipt->>'sha256') FROM qa.accepted WHERE id='updated';
SELECT qa.assert(m.map_json=p.current_json->'maps'->'m', 'mirror is accepted root projection')
 FROM rpg_zzu.maps m JOIN rpg_zzu.projects p USING(project_id) WHERE project_id='created';
SELECT qa.reject(format('SELECT rpg_zzu.sync_spatial_mirrors(%L,%L)', 'created', receipt->>'sha256'), 'PT409') FROM qa.accepted WHERE id='created';
SELECT qa.reject($q$UPDATE rpg_zzu.maps SET map_json='{}' WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$DELETE FROM rpg_zzu.maps WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$UPDATE rpg_zzu.maps SET project_id='legacy' WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$UPDATE rpg_zzu.maps SET project_id='created',map_id='moved' WHERE project_id='legacy'$q$, '42501');
SELECT qa.reject($q$INSERT INTO rpg_zzu.maps SELECT 'created','m','bad',1,1,'t','bad','bad',1,1,'{}',now() ON CONFLICT(project_id,map_id) DO UPDATE SET map_json=excluded.map_json$q$, '42501');
SELECT qa.reject($q$DELETE FROM rpg_zzu.tilesets WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$UPDATE rpg_zzu.tilesets SET tileset_json='{}' WHERE project_id='created'$q$, '42501');
-- Given: raw root map differs from raw overlay, including unnormalized shop commands.
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('activate','raw-sha',qa.canonical(),'activate',qa.legacy())$q$, 'PT409');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('activate','raw-sha',qa.canonical(),'activate',qa.raw_snapshot('activate'))$q$, '22023');
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('activate','raw-sha',qa.canonical(),'activate')$q$, '22023');
INSERT INTO qa.accepted VALUES ('activation-baseline',qa.raw_snapshot('activate'));
-- When: explicit conversion adds only new spatial authority to the untouched baseline.
INSERT INTO qa.accepted VALUES ('activated', rpg_zzu.publish_spatial_project('activate','raw-sha',
 qa.raw_snapshot('activate') || jsonb_build_object('spatialAuthoring',qa.document(qa.raw_snapshot('activate'))), 'activate', qa.raw_snapshot('activate')));
-- Then: raw unknown fields, retired catalog and legacy event bytes remain semantic equals.
SELECT qa.assert((receipt->'project') - 'spatialAuthoring' = (SELECT receipt FROM qa.accepted WHERE id='activation-baseline'), 'activation preserves entire raw payload') FROM qa.accepted WHERE id='activated';
SELECT qa.assert(receipt#>>'{project,maps,m,name}'='raw overlay'
 AND NOT (receipt#>'{project,maps,m,events,0,commands,0}' ? 'branchOnTransaction')
 AND receipt#>'{project,tilesets,t,terrainTemplates}'='[{"id":"retired","name":"raw retired"}]', 'raw overlay wins without normalization or retired-field loss') FROM qa.accepted WHERE id='activated';
-- When: legacy projects remain on their existing write surface.
UPDATE rpg_zzu.projects SET title='legacy edit' WHERE project_id='legacy';
UPDATE rpg_zzu.maps SET name='legacy edit' WHERE project_id='legacy';
SELECT qa.assert(title='legacy edit','legitimate unfenced root write') FROM rpg_zzu.projects WHERE project_id='legacy';
SELECT qa.assert(name='legacy edit','legitimate unfenced mirror write') FROM rpg_zzu.maps WHERE project_id='legacy';
RESET ROLE;
SET ROLE authenticated;
SELECT qa.reject($q$DELETE FROM rpg_zzu.projects WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$INSERT INTO rpg_zzu.terrain_templates VALUES('created','t','bad','bad',NULL,'{}',now())$q$, '42501');
RESET ROLE;
RESET SESSION AUTHORIZATION;
-- Given: marker erasure by a privileged maintenance actor must not remove the fence.
GRANT USAGE ON SCHEMA qa TO spatial_project_writer;
GRANT SELECT ON qa.accepted TO spatial_project_writer;
SET ROLE spatial_project_writer;
UPDATE rpg_zzu.projects SET current_json=current_json-'spatialAuthoring' WHERE project_id='created';
RESET ROLE;
SET ROLE authenticated;
SELECT qa.reject($q$UPDATE rpg_zzu.projects SET title='bypass' WHERE project_id='created'$q$, '42501');
SELECT qa.reject($q$DELETE FROM rpg_zzu.projects WHERE project_id='created'$q$, '42501');
RESET ROLE;
SET ROLE spatial_project_writer;
UPDATE rpg_zzu.projects p SET current_json=a.receipt->'project' FROM qa.accepted a WHERE a.id='updated' AND p.project_id='created';
RESET ROLE;
\ir spatial-publication-roles.sql
