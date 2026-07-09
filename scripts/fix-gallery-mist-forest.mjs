// Fix 안개 숲 in Supabase project rpg-zzu-house-template-gallery:
// - remove outer WALL frame
// - replace 1-cell lower TREE scrap (290 etc.) with grass + multi-cell upper trees
import { createHash } from "node:crypto";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const baseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
const projectId = "rpg-zzu-house-template-gallery";
const SCHEMA = "rpg_zzu";

if (!baseUrl || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const readHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Accept-Profile": SCHEMA,
};
const writeHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
  "Content-Profile": SCHEMA,
};

const GRASS = 240;
const WALL = 306;
const PATH = 360;
const EMPTY = -1;
const CONIFER = [
  [260],
  [290],
];
const BIG_TREE = [
  [262, 263],
  [292, 293],
];
const SCRAP_LOWER = new Set([259, 260, 262, 263, 289, 290, 292, 293]);

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const loadRes = await fetch(
  `${baseUrl}/rest/v1/projects?select=current_json,current_sha256,title,schema_version&project_id=eq.${encodeURIComponent(projectId)}`,
  { headers: readHeaders },
);
if (!loadRes.ok) {
  console.error("load failed", loadRes.status, await loadRes.text());
  process.exit(1);
}
const rows = await loadRes.json();
if (!rows[0]) {
  console.error("project not found");
  process.exit(1);
}

const project = rows[0].current_json;
const prevSha = rows[0].current_sha256;
const map = project.maps?.map_mist_forest;
if (!map) {
  console.error("map_mist_forest missing", Object.keys(project.maps || {}));
  process.exit(1);
}

function idx(x, y) {
  return y * map.width + x;
}
function inB(x, y) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}
function lo(x, y) {
  return map.lowerTiles[idx(x, y)];
}
function up(x, y) {
  return map.upperTiles[idx(x, y)];
}
function setLo(x, y, t) {
  if (inB(x, y)) map.lowerTiles[idx(x, y)] = t;
}
function setUp(x, y, t) {
  if (inB(x, y)) map.upperTiles[idx(x, y)] = t;
}

let wallsCleared = 0;
for (let x = 0; x < map.width; x++) {
  if (lo(x, 0) === WALL) {
    setLo(x, 0, GRASS);
    wallsCleared++;
  }
  if (lo(x, map.height - 1) === WALL) {
    setLo(x, map.height - 1, GRASS);
    wallsCleared++;
  }
}
for (let y = 0; y < map.height; y++) {
  if (lo(0, y) === WALL) {
    setLo(0, y, GRASS);
    wallsCleared++;
  }
  if (lo(map.width - 1, y) === WALL) {
    setLo(map.width - 1, y, GRASS);
    wallsCleared++;
  }
}

let treesCleared = 0;
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    if (SCRAP_LOWER.has(lo(x, y))) {
      setLo(x, y, GRASS);
      treesCleared++;
    }
    if (SCRAP_LOWER.has(up(x, y))) setUp(x, y, EMPTY);
  }
}

function isPlantable(x, y) {
  if (!inB(x, y)) return false;
  const l = lo(x, y);
  if (l === PATH || l === WALL || l === 120) return false;
  if (up(x, y) !== EMPTY) return false;
  return l === GRASS || l === 241 || l === 270 || l === 271 || l === 300 || l === 301;
}
function canStamp(ox, oy, pattern) {
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      if (pattern[y][x] < 0) continue;
      if (!isPlantable(ox + x, oy + y)) return false;
    }
  }
  return true;
}
function stamp(ox, oy, pattern) {
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      const t = pattern[y][x];
      if (t >= 0) setUp(ox + x, oy + y, t);
    }
  }
}
function seed(x, y) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

let planted = 0;
for (let y = 2; y < map.height - 3; y++) {
  for (let x = 2; x < map.width - 3; x++) {
    const s = seed(x, y);
    if (s % 79 === 0 && canStamp(x, y, BIG_TREE)) {
      stamp(x, y, BIG_TREE);
      planted++;
    } else if (s % 53 === 0 && canStamp(x, y, CONIFER)) {
      stamp(x, y, CONIFER);
      planted++;
    }
  }
}

let borderWall = 0;
let lo290 = 0;
let upperTree = 0;
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const l = lo(x, y);
    const u = up(x, y);
    if ((y === 0 || y === map.height - 1 || x === 0 || x === map.width - 1) && l === WALL) borderWall++;
    if (l === 290) lo290++;
    if ([260, 262, 263, 290, 292, 293].includes(u)) upperTree++;
  }
}

const serialized = JSON.stringify(project);
const payload = {
  project_id: projectId,
  title: project.meta?.title || rows[0].title || projectId,
  schema_version: project.version ?? rows[0].schema_version ?? 3,
  current_json: project,
  current_sha256: sha256Hex(serialized),
  map_count: Object.keys(project.maps).length,
  tileset_count: Object.keys(project.tilesets || {}).length,
  terrain_template_count: 0,
};

const saveRes = await fetch(`${baseUrl}/rest/v1/projects?on_conflict=project_id`, {
  method: "POST",
  headers: writeHeaders,
  body: JSON.stringify(payload),
});
const saveText = await saveRes.text();
if (!saveRes.ok) {
  console.error("save failed", saveRes.status, saveText.slice(0, 800));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      projectId,
      map: map.name,
      prevSha,
      newSha: payload.current_sha256,
      wallsCleared,
      treesCleared,
      planted,
      verify: { borderWall, lo290, upperTree },
    },
    null,
    2,
  ),
);
