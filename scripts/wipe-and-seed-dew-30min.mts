/**
 * 맵 전부 삭제 → 100×100 빈 골격만 남기고 Supabase 업서트.
 * project id: rpg-zzu-dew-30min
 */
import fs from "node:fs";
import { createBlankProject } from "../src/project/defaults/defaultProject.ts";
import { createBlankMap, singleNodeTree } from "../src/project/defaults/defaultMaps.ts";
import { defaultTitleScreenSettings } from "../src/project/defaults/defaultDatabase.ts";
import { ensureSwitchVariableSlots } from "../src/project/defaults/defaultProject.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

export const DEW_30_PROJECT_ID = "rpg-zzu-dew-30min";
const MAP_ID = "map_dew_market_100";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: DEW_30_PROJECT_ID,
};

const project = createBlankProject();
const map = createBlankMap("이슬 장터 마을", 100, 100);
map.id = MAP_ID;
project.maps = { [MAP_ID]: map };
project.mapTree = { mapId: MAP_ID, children: [] };
project.startMapId = MAP_ID;
project.startPos = { x: 50, y: 50 };
project.meta = { ...project.meta, title: "이슬 장터 — 30분", author: "OPRN" };
project.system = {
  ...project.system,
  titleScreen: {
    ...(project.system.titleScreen ?? defaultTitleScreenSettings()),
    title: "이슬 장터",
    menuLabels: { newGame: "여정을 시작", continueGame: "이어 하기", quit: "그만두기" },
  },
};
// 퀘스트 스위치 이름 예약
const names: Record<string, string> = {
  sw_0001: "Q1 약초 의뢰 수락",
  sw_0002: "Q1 약초 완료",
  sw_0003: "Q2 광산 의뢰 수락",
  sw_0004: "Q2 열쇠 획득",
  sw_0005: "Q3 종탑 의뢰 수락",
  sw_0006: "Q3 종탑 클리어",
};
ensureSwitchVariableSlots(project);
for (const s of project.switches) {
  if (names[s.id]) s.name = names[s.id]!;
}
const v = project.variables.find((x) => x.id === "var_0001");
if (v) v.name = "회수한 달빛 약초";

console.log("wipe-seed →", DEW_30_PROJECT_ID, "100x100");
const saved = await saveProjectToSupabase(project, config);
console.log("saved", saved);
const verify = await loadProjectFromSupabase(config);
const m = verify?.maps[MAP_ID];
console.log("verify", {
  title: verify?.meta?.title,
  maps: verify ? Object.keys(verify.maps).length : 0,
  size: m ? `${m.width}x${m.height}` : null,
  events: m?.events?.length ?? null,
});
if (!m || m.width !== 100 || m.height !== 100) process.exit(1);
console.log("OK seed ready");
