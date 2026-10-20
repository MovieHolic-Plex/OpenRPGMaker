// modern-tiles.capture.mjs 가 쓰는 픽스처 — 현대 타일 개선판(2026-10-20, jp_city 물가·modern_city 바닥/지붕/가로수)의
// 장면 맵 JSON 들을 실제 번들 타일셋(createJpCityTileset·createModernCityTileset)과 함께 한 프로젝트로 묶는다.
//
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/modern-tiles-fixture.mts --out /tmp/mt.json a.map.json b.map.json …
//
// 맵 JSON 은 조수 도구(compose_jp_region·compose_modern_city_street)나 장면 스크립트가 만든 실물 맵 객체(id·width·height·tilesetId·층 배열).
// 출하 player.html 경로로 그리므로 편집기 셸·톱바를 거치지 않는다(AGENTS.md 「편집기 QA 와 런타임 QA 는 다른 도구」).
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";
import { createModernCityTileset } from "@/project/defaults/modernCity";

const BASE = "test/fixtures/projects/editor-authored-demo-v3.json";
let out: string | null = null;
let npcFile: string | null = null;
let defaultRes = false;
const maps: string[] = [];
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i]!;
  if (a === "--out") out = process.argv[++i] ?? null;
  else if (a === "--npcs") npcFile = process.argv[++i] ?? null;
  else if (a === "--default-res") defaultRes = true;
  else maps.push(a);
}
// --npcs {맵 id: [[x, y, "scarloxy1"|"scarloxy2"|"actor1", 캐릭터 번호], …]} — 실제 걷기 칩 NPC(아래 방향 가운데 프레임, 고정)를 세운다.
const SHEET_TEX: Record<string, string> = { scarloxy1: "tex_scarloxy_charset_people1", scarloxy2: "tex_scarloxy_charset_people2", actor1: "tex_easyrpg_charset_actor1" };
const npcs: Record<string, [number, number, string, number][]> = npcFile ? JSON.parse(readFileSync(npcFile, "utf8")) : {};
if (!out || maps.length === 0) throw new Error("사용법: tsx scripts/qa/runtime/modern-tiles-fixture.mts --out <경로.json> <맵.json>…");

const project = deserialize(readFileSync(BASE, "utf8"));
project.tilesets.jp_city = createJpCityTileset();
project.tilesets.modern_city = createModernCityTileset();
let maxW = 0, maxH = 0;
const ids: string[] = [];
for (const path of maps) {
  const m = JSON.parse(readFileSync(path, "utf8"));
  if (!m.id || !m.width || !m.height || !m.tilesetId) throw new Error(`${path}: 맵 객체가 아니다(id·width·height·tilesetId 필요)`);
  if (!project.tilesets[m.tilesetId]) throw new Error(`${path}: 타일셋 ${m.tilesetId} 이 픽스처에 없다`);
  m.events = (npcs[m.id] ?? []).map(([x, y, sheet, c], k) => ({
    id: `qa_npc_${k}`, x, y, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p", name: `qa ${sheet} ${c}`, conditions: [], trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
      graphic: { sprite: { type: "bundled", id: SHEET_TEX[sheet] }, direction: "down", pattern: (Math.floor(c / 4) * 4 + 2) * 12 + (c % 4) * 3 + 1 },
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }],
  }));
  project.maps[m.id] = m;
  project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: m.id, children: [] }] } as typeof project.mapTree;
  maxW = Math.max(maxW, m.width * (m.tileSize ?? 16));
  maxH = Math.max(maxH, m.height * (m.tileSize ?? 16));
  ids.push(m.id);
}
project.startMapId = ids[0]!;
project.startPos = { x: 0, y: 0 };
// 장면 전체가 1배로 한 화면에 들어가게 — 캡처 쪽이 카메라를 맵 가운데에 고정한다.
// --default-res 면 새 프로젝트 기본 화면(480×270, 줌 1)으로 주인공을 따라가며 찍는다.
project.system.playResolution = defaultRes ? { width: 480, height: 270 } : { width: Math.min(1536, maxW), height: Math.min(1152, maxH) };
(project.system as { cameraZoom?: number }).cameraZoom = 1;
writeFileSync(out, serializePretty(project), "utf8");
console.log(JSON.stringify({ out, maps: ids, playResolution: project.system.playResolution }));
