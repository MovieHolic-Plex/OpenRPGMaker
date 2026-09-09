/**
 * 여관 1층 맵(map_inn_ground_v1)을 라이브 Supabase 프로젝트에 주입한다.
 * - 입력: output/docs/interior-room-v1/map_inn_ground_v1.json (build-inn-interior-map.mts 산출물)
 * - 저장: saveProjectMapPatchToSupabase — 변경 맵만 패치(전체 덮어쓰기 아님), 충돌 감지 포함.
 * - 이미 같은 맵 ID가 있으면 중단(--force로 덮어쓰기).
 * 실행: npx tsx scripts/save-inn-map-to-supabase.mts [--force]
 */
import fs from "node:fs";
import {
  loadProjectSnapshotFromSupabase,
  saveProjectMapPatchToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapTreeNode } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(".env.local에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 필요합니다");
}
const config = {
  url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};
const force = process.argv.includes("--force");
const jsonFlagIndex = process.argv.indexOf("--json");
const mapPath = jsonFlagIndex >= 0 && process.argv[jsonFlagIndex + 1]
  ? process.argv[jsonFlagIndex + 1]!
  : "output/docs/interior-room-v1/map_inn_ground_v1.json";
const innMap = JSON.parse(fs.readFileSync(mapPath, "utf8")) as GameMap;
console.log(`맵 로드: ${innMap.id} (${innMap.width}×${innMap.height}, tileset=${innMap.tilesetId})`);

const snapshot = await loadProjectSnapshotFromSupabase(config);
if (!snapshot) throw new Error(`Supabase 프로젝트 로드 실패: ${config.projectId}`);
const project = snapshot.project;
console.log(`프로젝트 로드: ${config.projectId} — 기존 맵 ${Object.keys(project.maps).length}개`);

if (!project.tilesets[innMap.tilesetId]) {
  throw new Error(`라이브 프로젝트에 타일셋 ${innMap.tilesetId}이 없습니다 — 에디터에서 한 번 로드해 번들 타일셋을 시드한 뒤 다시 실행하세요`);
}
if (project.maps[innMap.id] && !force) {
  throw new Error(`맵 ${innMap.id}이 이미 존재합니다 — 덮어쓰려면 --force`);
}

const baseProject = structuredClone(project);
project.maps[innMap.id] = innMap;

function treeHas(node: MapTreeNode, mapId: string): boolean {
  return node.mapId === mapId || node.children.some((child) => treeHas(child, mapId));
}
if (!treeHas(project.mapTree, innMap.id)) {
  project.mapTree = {
    ...project.mapTree,
    children: [...project.mapTree.children, { mapId: innMap.id, children: [] }],
  };
  console.log("맵 트리 루트에 노드 추가");
}

const result = await saveProjectMapPatchToSupabase(
  { baseProject, project, changedMapIds: [innMap.id], authority: snapshot.authority },
  config,
);
if (result.kind === "conflict") {
  console.error("저장 충돌:", result.conflicts);
  process.exitCode = 1;
} else if (result.kind === "not-configured") {
  console.error("Supabase 설정 없음");
  process.exitCode = 1;
} else {
  const savedMaps = result.project ? Object.keys(result.project.maps).length : "?";
  console.log(`저장 완료 (${result.kind}) — 저장 후 맵 ${savedMaps}개. 에디터를 새로고침하면 맵 트리에 '${innMap.name}'이 보입니다.`);
}
