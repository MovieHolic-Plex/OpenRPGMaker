/** Build one authored castle reference map from the bundled OpenGameArt atlas and persist it. */
import { loadEnv } from "vite";
import { createCastleTileset } from "../src/project/defaults/castleTileset";
import { CASTLE_TILESET_ID, CASTLE_TILESET_TEXTURE_KEY } from "../src/project/defaults/constants";

type Project = any;
const MAP_ID = "map_castle_reference_20260919";
const MAP_NAME = "성채 강변 · 참고 이미지 배치";
const WIDTH = 80;
const HEIGHT = 64;
const env = loadEnv("development", process.cwd(), "");
const baseUrl = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY ?? "";
const projectId = env.VITE_SUPABASE_PROJECT_ID ?? "";
if (!baseUrl || !key || !projectId) throw new Error("Supabase URL/anon key/project id가 필요합니다.");
const readHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Accept-Profile": "rpg_zzu",
};
const writeHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
  "Content-Profile": "rpg_zzu",
};

async function loadProject(): Promise<{ row: any; project: Project }> {
  const response = await fetch(
    `${baseUrl}/rest/v1/projects?select=current_json,current_sha256,title,schema_version,updated_at&project_id=eq.${encodeURIComponent(projectId)}`,
    { headers: readHeaders },
  );
  if (!response.ok) throw new Error(`Supabase load ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const rows = await response.json() as any[];
  if (!rows[0]?.current_json) throw new Error(`프로젝트를 찾지 못했습니다: ${projectId}`);
  return { row: rows[0], project: rows[0].current_json };
}

const tileXY = (sourceTile: number, subX: number, subY: number): number => {
  const sourceX = sourceTile % 16;
  const sourceY = Math.floor(sourceTile / 16);
  return (sourceY * 2 + subY) * 32 + sourceX * 2 + subX;
};
const stamp32 = (lower: number[], upper: number[], x: number, y: number, sourceTile: number, layer: "lower" | "upper" = "lower") => {
  const target = layer === "lower" ? lower : upper;
  for (let sy = 0; sy < 2; sy += 1) for (let sx = 0; sx < 2; sx += 1) target[(y + sy) * WIDTH + x + sx] = tileXY(sourceTile, sx, sy);
};
const fill32 = (lower: number[], sourceTile: number, x: number, y: number, w: number, h: number) => {
  for (let yy = y; yy < y + h; yy += 2) for (let xx = x; xx < x + w; xx += 2) stamp32(lower, [], xx, yy, sourceTile);
};
const rect32 = (lower: number[], sourceTile: number, x: number, y: number, w: number, h: number, upper: number[] | null = null) => {
  for (let yy = y; yy < y + h; yy += 2) for (let xx = x; xx < x + w; xx += 2) stamp32(lower, upper ?? [], xx, yy, sourceTile, upper ? "upper" : "lower");
};

const { row, project } = await loadProject();
if (!project.tilesets[CASTLE_TILESET_ID]) project.tilesets[CASTLE_TILESET_ID] = createCastleTileset();
const profiles = project.resourceProfiles ?? (project.resourceProfiles = []);
if (!profiles.some((profile: any) => profile.assetId === CASTLE_TILESET_TEXTURE_KEY)) {
  profiles.push({
    kind: "chipset",
    name: "성채 · OpenGameArt (CC-BY 3.0)",
    tileWidth: 16,
    tileHeight: 16,
    imageWidth: 512,
    imageHeight: 512,
    assetId: CASTLE_TILESET_TEXTURE_KEY,
  });
}

const lower = new Array<number>(WIDTH * HEIGHT).fill(0);
const upper = new Array<number>(WIDTH * HEIGHT).fill(-1);
// Castle2 source cells: 193/194 = grass, 192 = water, 48/49 = masonry, 23/24 = roof shingles,
// 20 = roof peak, 66 = arched gate.
const GRASS = 193;
const GRASS_ALT = 194;
const WATER = 192;
const WALL = 48;
const WALL_ALT = 49;
const ROOF = 23;
const ROOF_EDGE = 20;
const ROOF_EDGE_R = 24;
const GATE = 66;
const RIVER_X = 56;

fill32(lower, GRASS, 0, 0, WIDTH, HEIGHT);
// Right river, a narrow lake inlet, and a waterfall-like vertical segment.
fill32(lower, WATER, RIVER_X, 0, 24, HEIGHT);
fill32(lower, WATER, 44, 48, 12, 14);
for (let y = 2; y < 60; y += 2) stamp32(lower, [], 52, y, GRASS_ALT);
// Stone crossing into the castle; keep the water visible on both sides.
rect32(lower, WALL_ALT, 48, 28, 16, 6, upper);
rect32(lower, WALL_ALT, 48, 30, 16, 2, upper);
// Outer curtain wall around the central keep, with a south gate opening.
const left = 12, top = 8, right = 50, bottom = 52;
rect32(lower, WALL, left, top, right - left, 4, upper);
rect32(lower, WALL, left, bottom - 4, 14, 4, upper);
rect32(lower, WALL, 30, bottom - 4, right - 30, 4, upper);
rect32(lower, WALL, left, top, 4, bottom - top, upper);
rect32(lower, WALL, right - 4, top, 4, bottom - top, upper);
// Four corner towers use a denser masonry block and capped upper pieces.
for (const [x, y] of [[left, top], [right - 8, top], [left, bottom - 8], [right - 8, bottom - 8]]) {
  rect32(lower, WALL_ALT, x, y, 8, 8, upper);
  rect32(lower, ROOF, x, y - 2, 8, 4, upper);
}
// Main keep: roof deck, wall face, open arched entrance and courtyard grass.
rect32(lower, ROOF, 20, 14, 22, 8, upper);
rect32(lower, ROOF_EDGE, 20, 12, 4, 4, upper);
rect32(lower, ROOF_EDGE_R, 38, 12, 4, 4, upper);
rect32(lower, WALL, 20, 22, 22, 10, upper);
rect32(lower, GRASS_ALT, 22, 30, 18, 12);
stamp32(lower, upper, 30, 28, GATE, "upper");
// A central roofed hall and two side wings echo the reference composition.
rect32(lower, ROOF, 16, 38, 30, 6, upper);
rect32(lower, WALL_ALT, 16, 44, 30, 6, upper);
rect32(lower, GRASS_ALT, 20, 50, 22, 2);
// The central arched gate is the focal landmark; the surrounding stone and grass
// are intentionally left open so the map remains easy to continue painting.
// Small gardens and stone approach on the left edge, matching the reference's asymmetry.
fill32(lower, GRASS_ALT, 2, 10, 8, 20);
rect32(lower, WALL_ALT, 6, 24, 8, 6, upper);
rect32(lower, WALL_ALT, 6, 40, 8, 6, upper);
rect32(lower, WALL_ALT, 8, 46, 6, 4, upper);

const map = {
  id: MAP_ID,
  name: MAP_NAME,
  width: WIDTH,
  height: HEIGHT,
  tilesetId: CASTLE_TILESET_ID,
  tileSize: 16,
  lowerTiles: lower,
  upperTiles: upper,
  events: [],
};
project.maps[MAP_ID] = map;
if (!project.mapTree || !Array.isArray(project.mapTree.children)) project.mapTree = { mapId: project.startMapId ?? MAP_ID, children: [] };
if (!project.mapTree.children.some((child: any) => child.mapId === MAP_ID)) project.mapTree.children.push({ mapId: MAP_ID, children: [] });

const expectedSha256 = row.current_sha256;
if (!expectedSha256) throw new Error("현재 원격 revision SHA가 없습니다.");
const publish = await fetch(`${baseUrl}/rest/v1/rpc/publish_spatial_project`, {
  method: "POST",
  headers: writeHeaders,
  body: JSON.stringify({ p_project_id: projectId, p_expected_sha256: expectedSha256, p_project: project, p_operation: "update" }),
});
if (!publish.ok) throw new Error(`Supabase publication ${publish.status}: ${(await publish.text()).slice(0, 700)}`);
const publication = await publish.json() as any;
const acceptedSha256 = publication.sha256 ?? publication[0]?.sha256;
if (!acceptedSha256) throw new Error("publication RPC가 SHA를 반환하지 않았습니다.");
const mirror = await fetch(`${baseUrl}/rest/v1/rpc/sync_spatial_mirrors`, {
  method: "POST", headers: writeHeaders, body: JSON.stringify({ p_project_id: projectId, p_expected_sha256: acceptedSha256 }),
});
if (!mirror.ok) throw new Error(`Supabase mirror sync ${mirror.status}: ${(await mirror.text()).slice(0, 700)}`);
const verifyResponse = await fetch(`${baseUrl}/rest/v1/projects?select=current_json,current_sha256,map_count,tileset_count&project_id=eq.${encodeURIComponent(projectId)}`, { headers: readHeaders });
if (!verifyResponse.ok) throw new Error(`Supabase verify ${verifyResponse.status}: ${(await verifyResponse.text()).slice(0, 400)}`);
const verified = (await verifyResponse.json() as any[])[0];
const verifiedMap = verified?.current_json?.maps?.[MAP_ID];
if (!verifiedMap || verifiedMap.tilesetId !== CASTLE_TILESET_ID || verifiedMap.width !== WIDTH || verifiedMap.height !== HEIGHT) throw new Error("저장 후 성채 맵 재로드 검증 실패");
console.log(JSON.stringify({ projectId, mapId: MAP_ID, mapName: MAP_NAME, size: `${WIDTH}x${HEIGHT}`, mapCount: Object.keys(verified.current_json.maps).length, tilesetId: verifiedMap.tilesetId, sha256: verified.current_sha256, published: true, mirrorsSynced: true, saved: true, verified: true }, null, 2));
