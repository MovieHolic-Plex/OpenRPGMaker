#!/usr/bin/env node
// output/evidence/ai-three-map-rpg/project-after.json 을 Supabase 로 되돌린다.
// 재실행이 열등한 결과로 원격을 덮었을 때 쓴다.
//
//   node scripts/restore-three-map-rpg.mjs <project-after.json>
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const SRC = process.argv[2] ?? "output/evidence/ai-three-map-rpg/project-after.json";
const PROJECT_ID = "rpg-zzu-three-map-rpg";

if (!existsSync(SRC)) {
  console.error(`missing ${SRC}`);
  process.exit(2);
}

const env = {};
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Supabase env missing");
  process.exit(2);
}

const project = JSON.parse(readFileSync(SRC, "utf8"));
const mapIds = Object.keys(project.maps);
const transfers = Object.values(project.maps).flatMap((m) =>
  (m.events ?? []).flatMap((e) => (e.pages ?? []).flatMap((p) => (p.commands ?? []).filter((c) => c.kind === "transfer"))),
);
console.log(`[src] maps=${mapIds.length} transfers=${transfers.length} ids=${mapIds.join(",")}`);
if (mapIds.length < 3 || transfers.length < 2) {
  console.error("source artifact is itself incomplete — refusing to restore");
  process.exit(1);
}

const json = JSON.stringify(project);
const sha = createHash("sha256").update(json).digest("hex");
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  "Content-Profile": "rpg_zzu",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

const row = {
  project_id: PROJECT_ID,
  title: project.meta?.title ?? PROJECT_ID,
  schema_version: project.version ?? 3,
  current_json: project,
  current_sha256: sha,
  map_count: mapIds.length,
  tileset_count: Object.keys(project.tilesets ?? {}).length,
  terrain_template_count: (project.terrainTemplates ?? []).length,
  updated_at: new Date().toISOString(),
};

const res = await fetch(`${url}/rest/v1/projects?on_conflict=project_id`, {
  method: "POST",
  headers,
  body: JSON.stringify([row]),
});
console.log("[projects upsert]", res.status, res.status < 300 ? "ok" : await res.text());
if (res.status >= 300) process.exit(1);

// maps 자식 테이블: 이전 실행이 남긴 행을 지우고 이 프로젝트의 맵만 다시 넣는다.
const del = await fetch(`${url}/rest/v1/maps?project_id=eq.${PROJECT_ID}`, {
  method: "DELETE",
  headers,
});
console.log("[maps delete]", del.status);

const mapRows = mapIds.map((mapId) => {
  const map = project.maps[mapId];
  const lower = map.lowerTiles ?? [];
  const upper = map.upperTiles ?? [];
  return {
    project_id: PROJECT_ID,
    map_id: mapId,
    name: map.name,
    width: map.width,
    height: map.height,
    tileset_id: map.tilesetId,
    lower_sha256: createHash("sha256").update(JSON.stringify(lower)).digest("hex"),
    upper_sha256: createHash("sha256").update(JSON.stringify(upper)).digest("hex"),
    lower_tile_count: lower.length,
    upper_tile_count: upper.length,
    map_json: map,
  };
});
const ins = await fetch(`${url}/rest/v1/maps?on_conflict=project_id,map_id`, {
  method: "POST",
  headers,
  body: JSON.stringify(mapRows),
});
console.log("[maps upsert]", ins.status, ins.status < 300 ? "ok" : await ins.text());
if (ins.status >= 300) process.exit(1);

// 재로드 검증
const verify = await fetch(
  `${url}/rest/v1/projects?project_id=eq.${PROJECT_ID}&select=project_id,title,map_count,current_sha256`,
  { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Accept-Profile": "rpg_zzu" } },
);
const rows = await verify.json();
console.log("[verify]", JSON.stringify(rows));
if (rows[0]?.current_sha256 !== sha) {
  console.error("sha mismatch after restore");
  process.exit(1);
}
console.log("[ok] restored", { projectId: PROJECT_ID, maps: mapIds.length, transfers: transfers.length });
