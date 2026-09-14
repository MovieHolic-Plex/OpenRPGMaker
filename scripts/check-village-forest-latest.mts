import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { configFromEnv } from './supabase-resource-root/supabaseRest.mjs';
import { loadProjectForPersistenceProof } from '../src/project/supabaseProjectSync';
const expected=JSON.parse(fs.readFileSync('output/evidence/village-forest/reloaded-project.json','utf8'));
const current=await loadProjectForPersistenceProof(await configFromEnv());assert.ok(current);
const mapId='spatial-geography:30:small-village:example:20260913';
const proof={projectId:'rpg-zzu-house-template-gallery',canonicalSHA256:current.sha256,mapId,
 villageMapMatches:isDeepStrictEqual(expected.maps[mapId],current.project.maps[mapId]),
 changedMaps:[...new Set([...Object.keys(expected.maps),...Object.keys(current.project.maps)])].filter(id=>!isDeepStrictEqual(expected.maps[id],current.project.maps[id])),
 changedTopLevelKeys:[...new Set([...Object.keys(expected),...Object.keys(current.project)])].filter(k=>!isDeepStrictEqual(expected[k],current.project[k])),
 checkedAt:new Date().toISOString()};
fs.writeFileSync('output/evidence/village-forest/latest-remote.json',JSON.stringify(current.project));
fs.writeFileSync('.omo/evidence/village-forest/latest-remote-check.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
assert.ok(proof.villageMapMatches);
