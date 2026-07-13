/**
 * LLM 하네스 E2E 데모 — 에디터 어시스턴트가 쓰는 실제 도구 핸들러를 그대로 호출해
 * "요구사항 → 플랜 설계(LLM) → 세션 시공(층별) → 평가 → 배포"를 재현한다.
 *
 * 요구사항(가상 사용자): "석재 벽의 연금술사 집 — 공방(돌바닥)·서재·접객 홀 3방"
 * 실행: npx tsx scripts/demo-assistant-interior-build.mts [--save] [--seed N]
 * seed 미지정 시 매 실행 새 배치 판(시드는 출력됨 — 재현하려면 --seed로 다시 주입).
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { INTERIOR_ROOM_SESSION_TOOLS } from "../src/editor/tools/interiorRoomSession.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types";

function tool(name: string) {
  const def = INTERIOR_ROOM_SESSION_TOOLS.find((t) => t.name === name);
  if (!def) throw new Error(`tool 없음: ${name}`);
  return def;
}

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
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: "rpg-zzu-room-practice",
};
const project = (await loadProjectFromSupabase(config)) as Project | null;
if (!project) throw new Error("라이브 프로젝트 로드 실패");

// ── [LLM 역할] 요구사항 → 플랜 설계 ─────────────────────────────────────────
// "연금술사의 집": 공방은 화덕·솥 키트(kitchen 테마)+돌바닥, 서재는 서가+수정구,
// 접객 홀은 카운터+좌석. 석재 벽(stone-brick)으로 마감. 문법: 좌우 인접=1열 파티션,
// 상하 인접=3행 파티션, 수평 문은 파티션 트림 행 좌표.
const MAP_ID = "map_rp_ai_atelier_v1";
const seedIdx = process.argv.indexOf("--seed");
const seed = seedIdx >= 0 ? Number(process.argv[seedIdx + 1]) : Date.now() % 1_000_000;
console.log(`seed = ${seed} (재현: --seed ${seed})`);
const planArgs = {
  mapId: MAP_ID,
  name: "연습 · AI 시공: 연금술사의 집 (21×19)",
  width: 21,
  height: 19,
  rooms: [
    { id: "atelier", x: 3, y: 4, w: 6, h: 4, theme: "kitchen", floorTile: 12 }, // 공방 x3–8
    { id: "study", x: 10, y: 4, w: 8, h: 4, theme: "study" }, //                 서재 x10–17 (파티션 x9)
    { id: "hall", x: 3, y: 11, w: 15, h: 4, theme: "tavern" }, //                홀 y11–14 (수평 파티션 y8–10)
  ],
  innerDoors: [
    { x: 5, y: 8 }, //  공방 → 홀
    { x: 13, y: 8 }, // 서재 → 홀
    { x: 9, y: 5 }, //  공방 ↔ 서재 (수직 1칸)
  ],
  door: { x: 10, y: 14 },
  theme: "tavern",
  wallMaterial: "stone-brick",
  seed,
};

// ── 도구 호출 시퀀스(어시스턴트 동선 그대로) ─────────────────────────────────
console.log("== start_interior_room_session ==");
const started = tool("start_interior_room_session").run(project, planArgs);
console.log("  ", started.summary);
const sessionId = (started.data as { sessionId: string }).sessionId;

for (let i = 0; i < 6; i += 1) {
  const step = tool("advance_interior_room_build").run(project, { sessionId });
  const data = step.data as { layer?: string; ok?: boolean; warnings?: string[]; done?: boolean };
  console.log(`== advance [${data.layer ?? "done"}] ==  ${step.summary}`);
  if (data.warnings?.length) console.log("   warnings:", data.warnings.join(" | "));
  if (data.done || !data.layer) break;
}

// ── [LLM 역할] 공간 단위 하네싱: 홀 하나만 새 시드로 재시공(테마 유지) ──────
// '실내'는 상위 개념, 배치 결정은 공간(방·복도) 단위 — furnish_interior_space가 그 실행 도구.
console.log("== furnish_interior_space (hall 재추첨) ==");
const furnished = tool("furnish_interior_space").run(project, { sessionId, roomId: "hall", seed: seed + 1 });
console.log("  ", furnished.summary);

type Report = {
  ok: boolean;
  score: number;
  issues: string[];
  feedbackForLlm: string;
  metrics: { unreachableOpenCells: number };
};
function evaluate(attempt: number, silent = false): Report {
  const evaluated = tool("evaluate_interior_room").run(project!, { sessionId, attempt });
  const report = (evaluated.data as { report: Report }).report;
  if (!silent) {
    console.log(`== evaluate_interior_room (attempt ${attempt}) ==  ${evaluated.summary}`);
    console.log("   metrics:", JSON.stringify(report.metrics));
    if (!report.ok) console.log("   feedbackForLlm:", report.feedbackForLlm);
  }
  return report;
}

let report = evaluate(1);

// ── [LLM 자가 수정 루프] 사분면 공백 피드백 → 해당 사분면에 좌석군/적재물 추가 ──
if (!report.ok && report.issues.some((i) => i.startsWith("density"))) {
  const mapRef = project.maps[MAP_ID]!;
  const issue = report.issues.find((i) => i.startsWith("density"))!;
  const quadName = issue.includes("남동") ? "SE" : issue.includes("남서") ? "SW" : issue.includes("북동") ? "NE" : "NW";
  console.log(`== self-repair: ${quadName} 사분면에 벽 스냅 적재물 추가 (좌석 스팸 금지 — 어시스턴트의 place_props 역할) ==`);
  const FLOORS = new Set([72, 73, 102, 103, 12, 13, 42, 43, 139]);
  const empty = (x: number, y: number) =>
    FLOORS.has(mapRef.lowerTiles[y * mapRef.width + x]!) && (mapRef.upperTiles[y * mapRef.width + x] ?? -1) < 0;
  const isFloor = (x: number, y: number) => FLOORS.has(mapRef.lowerTiles[y * mapRef.width + x]!);
  const xr = quadName.includes("E") ? [Math.floor(mapRef.width / 2) + 1, mapRef.width - 2] : [2, Math.floor(mapRef.width / 2) - 1];
  const yr = quadName.includes("S") ? [Math.floor(mapRef.height / 2), mapRef.height - 2] : [2, Math.floor(mapRef.height / 2) - 1];
  const goods = [205, 55, 471, 350]; // 통·궤짝·자루·단지 — 벽에 붙는 자리만
  let placed = 0;
  for (let y = yr[0]!; y <= yr[1]! && placed < 4; y += 1) {
    for (let x = xr[0]!; x <= xr[1]! && placed < 4; x += 1) {
      if (x === planArgs.door.x || y === planArgs.door.y || !empty(x, y)) continue;
      // 벽 스냅: 상/좌/우 중 한 곳이 바닥이 아니어야(벽·파티션) 하고, 문 앞 축은 피한다.
      const wallAdjacent = !isFloor(x, y - 1) || !isFloor(x - 1, y) || !isFloor(x + 1, y);
      if (!wallAdjacent) continue;
      // 놓고-검증하고-되돌리기: 복도 착지 칸을 막아 도달 불가가 생기면 즉시 철회.
      const prev = mapRef.upperTiles[y * mapRef.width + x]!;
      mapRef.upperTiles[y * mapRef.width + x] = goods[placed % goods.length]!;
      if (evaluate(0, true).metrics.unreachableOpenCells > 0) {
        mapRef.upperTiles[y * mapRef.width + x] = prev;
        continue;
      }
      placed += 1;
    }
  }
  console.log(`   추가 배치 ${placed}건(적재물, 통행 검증 통과분만)`);
  report = evaluate(2);
}

// 맵 트리에 노드 추가
type TreeNode = { mapId: string; children: TreeNode[] };
const tree = project.mapTree as TreeNode;
if (!tree.children.some((c) => c.mapId === MAP_ID) && tree.mapId !== MAP_ID) {
  tree.children.push({ mapId: MAP_ID, children: [] });
}

// ── 렌더(검수용) ─────────────────────────────────────────────────────────────
const map = project.maps[MAP_ID]!;
const tileset = project.tilesets[map.tilesetId]!;
const T = 16;
const COLS = 30;
const scale = 3;
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));
const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 20; png.data[i + 1] = 18; png.data[i + 2] = 24; png.data[i + 3] = 255;
}
function blit(tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void {
  if (tile < 0) return;
  const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
  const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
  const sw = q?.sw ?? T;
  const sh = q?.sh ?? T;
  for (let y = 0; y < sh * scale; y += 1) {
    for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!;
      png.data[di + 1] = chip.data[si + 1]!;
      png.data[di + 2] = chip.data[si + 2]!;
      png.data[di + 3] = 255;
    }
  }
}
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const composition = chipsetQuarterComposition(map, tileset, x, y);
    if (composition) {
      blit(composition.underlayTile ?? map.lowerTiles[i]!, x * T * scale, y * T * scale);
      for (const src of composition.sources) {
        blit(src.tile, x * T * scale + src.offsetX * scale, y * T * scale + src.offsetY * scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, x * T * scale, y * T * scale);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, x * T * scale, y * T * scale);
  }
}
const outPng = path.resolve("output/docs/room-practice", `${MAP_ID}.png`);
fs.writeFileSync(outPng, PNG.sync.write(png));
console.log("rendered", outPng);

if (process.argv.includes("--save")) {
  if (!report.ok) {
    console.log(`저장 생략 — 평가 불합격(score ${report.score}): ${report.issues.join(" / ")}`);
  } else {
    const result = await saveProjectToSupabase(project, config);
    console.log(`Supabase 저장: ${result.kind} — projectId=${config.projectId}, map=${MAP_ID}`);
  }
}
