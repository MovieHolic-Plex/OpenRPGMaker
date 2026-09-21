/** Save the current reference map and author a distinct second castle on the original atlas. */
import { loadEnv } from "vite";
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildCourtyardCastle } from './lib/castle-courtyard.mts';
import { installCastleSurroundings, dressCastleSurroundings, HARBOR_TILESET_ID } from './lib/castle-surroundings.mts';
import { addCastleLife } from './lib/castle-life.mts';
import { createCastleTileset } from "../src/project/defaults/castleTileset";
import { CASTLE_TILESET_ID, CASTLE_TILESET_TEXTURE_KEY } from "../src/project/defaults/constants";

const PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID ?? loadEnv("development", process.cwd(), "").VITE_SUPABASE_PROJECT_ID ?? "";
const env = loadEnv("development", process.cwd(), "");
const baseUrl = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY ?? "";
const CURRENT_MAP_ID = "map_castle_reference_20260919";
const SAVED_MAP_ID = "map_castle_reference_saved_20260919";
const SECOND_CASTLE_ID = "map_castle_keep_3";
const WIDTH = 128;
const HEIGHT = 120;
if (!baseUrl || !key || !PROJECT_ID) throw new Error("Supabase URL/anon key/project id가 필요합니다.");

const readHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Accept-Profile": "rpg_zzu",
};
const writeHeaders = {
  ...readHeaders,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
  "Content-Profile": "rpg_zzu",
};

async function loadProject(): Promise<{ row: any; project: any }> {
  const response = await fetch(`${baseUrl}/rest/v1/projects?select=current_json,current_sha256,title&project_id=eq.${encodeURIComponent(PROJECT_ID)}`, { headers: readHeaders });
  if (!response.ok) throw new Error(`Supabase load ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const rows = await response.json() as any[];
  if (!rows[0]?.current_json) throw new Error(`프로젝트를 찾지 못했습니다: ${PROJECT_ID}`);
  return { row: rows[0], project: rows[0].current_json };
}

const { row, project } = await loadProject();
if (!project.tilesets[CASTLE_TILESET_ID]) project.tilesets[CASTLE_TILESET_ID] = createCastleTileset();
const profiles = project.resourceProfiles ?? (project.resourceProfiles = []);
if (!profiles.some((profile: any) => profile.assetId === CASTLE_TILESET_TEXTURE_KEY)) {
  profiles.push({ kind: "chipset", name: "성채 · OpenGameArt (CC-BY 3.0)", assetId: CASTLE_TILESET_TEXTURE_KEY, tileWidth: 16, tileHeight: 16, imageWidth: 512, imageHeight: 512 });
}

const currentMap = project.maps[CURRENT_MAP_ID];
if (!currentMap) throw new Error(`${CURRENT_MAP_ID} 맵을 찾지 못했습니다.`);
const protectedMaps = Object.fromEntries(Object.entries(project.maps).filter(([id])=>id!==SECOND_CASTLE_ID).map(([id,map])=>[id,JSON.stringify(map)]));
if (!project.maps[SAVED_MAP_ID]) {
const savedCurrent = structuredClone(currentMap);
savedCurrent.id = SAVED_MAP_ID;
savedCurrent.name = "성채 강변 · 현재 맵 저장본";
savedCurrent.layoutPlan = {
  ...(savedCurrent.layoutPlan ?? {}),
  kind: "castle-reference-saved-copy",
  notes: "두 번째 성채 저작 전에 보존한 현재 비교 맵의 복사본.",
};
project.maps[SAVED_MAP_ID] = savedCurrent;
}

const { map: secondMap, placements } = buildCourtyardCastle();
installCastleSurroundings(project);
dressCastleSurroundings(secondMap as any, placements);
addCastleLife(secondMap as any);
project.maps[SECOND_CASTLE_ID] = secondMap;
if (!project.mapTree || !Array.isArray(project.mapTree.children)) project.mapTree = { mapId: project.startMapId ?? SECOND_CASTLE_ID, children: [] };
for (const mapId of [SAVED_MAP_ID, SECOND_CASTLE_ID]) {
  if (!project.mapTree.children.some((child: any) => child.mapId === mapId)) project.mapTree.children.push({ mapId, children: [] });
}

fs.mkdirSync('/tmp/rpg-zzu-castle', { recursive: true });
fs.writeFileSync('/tmp/rpg-zzu-castle/courtyard-preview-project.json', JSON.stringify(project));
fs.writeFileSync('/tmp/rpg-zzu-castle/courtyard-parts.json', JSON.stringify(placements, null, 2));
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({preview:true,mapId:SECOND_CASTLE_ID,size:[WIDTH,HEIGHT],parts:placements.length}));
  process.exit(0);
}
const expectedSha256 = row.current_sha256;
const publish = await fetch(`${baseUrl}/rest/v1/rpc/publish_spatial_project`, {
  method: "POST",
  headers: writeHeaders,
  body: JSON.stringify({ p_project_id: PROJECT_ID, p_expected_sha256: expectedSha256, p_project: project, p_operation: "update" }),
});
if (!publish.ok) throw new Error(`Supabase publication ${publish.status}: ${(await publish.text()).slice(0, 1200)}`);
const publication = await publish.json() as any;
const acceptedSha256 = publication.sha256 ?? publication[0]?.sha256;
if (!acceptedSha256) throw new Error("publication RPC가 SHA를 반환하지 않았습니다.");
const mirror = await fetch(`${baseUrl}/rest/v1/rpc/sync_spatial_mirrors`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ p_project_id: PROJECT_ID, p_expected_sha256: acceptedSha256 }) });
if (!mirror.ok) throw new Error(`Supabase mirror sync ${mirror.status}: ${(await mirror.text()).slice(0, 1200)}`);
const verifyResponse = await fetch(`${baseUrl}/rest/v1/projects?select=current_json,current_sha256,map_count,tileset_count&project_id=eq.${encodeURIComponent(PROJECT_ID)}`, { headers: readHeaders });
if (!verifyResponse.ok) throw new Error(`Supabase verify ${verifyResponse.status}: ${(await verifyResponse.text()).slice(0, 500)}`);
const verified = (await verifyResponse.json() as any[])[0];
const verifiedSaved = verified.current_json.maps[SAVED_MAP_ID];
const verifiedSecond = verified.current_json.maps[SECOND_CASTLE_ID];
if (!verifiedSaved || verifiedSaved.tilesetId !== currentMap.tilesetId || verifiedSaved.width !== currentMap.width || verifiedSaved.height !== currentMap.height) throw new Error("현재 맵 저장본 재로드 검증 실패");
if (!verifiedSecond || verifiedSecond.tilesetId !== HARBOR_TILESET_ID || verifiedSecond.width !== WIDTH || verifiedSecond.height !== HEIGHT || verifiedSecond.locations.length < 5) throw new Error("두 번째 성채 재로드 검증 실패");
assert.deepEqual(verifiedSecond, secondMap, 'Saved map must survive reload without changes');
assert.deepEqual(verified.current_json.tilesets[HARBOR_TILESET_ID],project.tilesets[HARBOR_TILESET_ID]);
assert.deepEqual(verified.current_json.assets.uploaded.castle_courtyard_harbor_atlas,project.assets.uploaded.castle_courtyard_harbor_atlas);
for (const [id,json] of Object.entries(protectedMaps)) assert.deepEqual(verified.current_json.maps[id], JSON.parse(json), 'Protected map '+id);
fs.writeFileSync('/tmp/rpg-zzu-castle/courtyard-reloaded-project.json', JSON.stringify(verified.current_json));
fs.writeFileSync('/tmp/rpg-zzu-castle/courtyard-save-proof.json', JSON.stringify({projectId:PROJECT_ID,mapId:SECOND_CASTLE_ID,sha256:verified.current_sha256,saved:true,reloaded:true,protectedMapsUnchanged:Object.keys(protectedMaps).length},null,2));
console.log(JSON.stringify({ projectId: PROJECT_ID, savedCurrentMapId: SAVED_MAP_ID, savedCurrentMapSize: `${verifiedSaved.width}x${verifiedSaved.height}`, secondCastleMapId: SECOND_CASTLE_ID, secondCastleMapName: verifiedSecond.name, secondCastleSize: `${WIDTH}x${HEIGHT}`, tilesetId: verifiedSecond.tilesetId, mapCount: Object.keys(verified.current_json.maps).length, tilesetCount: Object.keys(verified.current_json.tilesets).length, sha256: verified.current_sha256, published: true, mirrorsSynced: true, saved: true, reloaded: true, verified: true }, null, 2));
