// 『첫사랑』 맵 순회 — 각 맵으로 순간이동해 한 장씩 찍는다(조명·가구 배치 확인용).
// FL_FIXTURE, FL_VP(기본 960x540) 지원. 실행: node scripts/runtime-qa.mjs --scenario first-love-maps --out <dir>
import fs from "node:fs";

const FIXTURE = process.env.FL_FIXTURE ?? ".omo/runtime-qa/first-love/game.json";
const [vw, vh] = (process.env.FL_VP ?? "960x540").split("x").map(Number);
const project = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const MAPS = (process.env.FL_MAPS ?? "fl_platform_am,fl_platform_pm,fl_street,fl_street_pm,fl_office,fl_office_pm,fl_office_fri,fl_rooftop,fl_konbini,fl_broadcast").split(",");

/** 맵 안 첫 번째 통행 가능 칸을 못 찾으니, 시작 이벤트 중 하나 옆에서 선다 — 없으면 맵 중앙. */
function spot(mapId) {
  const m = project.maps[mapId];
  const ev = m.events.find((e) => e.x > 0 && e.y > 0);
  return ev ? { x: ev.x, y: Math.min(m.height - 2, ev.y + 1) } : { x: Math.floor(m.width / 2), y: Math.floor(m.height / 2) };
}

export default {
  id: "first-love-maps",
  projectFixture: FIXTURE,
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 120000 }, { kind: "hold", dir: null, ms: 1500 }], shot: true },
    { id: "start", note: "시작", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='cinematic-sequence']\") && !document.querySelector(\"[data-testid='title-screen']\") && !!window.__oprnDebug?.readState?.().currentMapId", maxPresses: 20, settleMs: 1500 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 800 },
    ], shot: false },
    ...MAPS.map((mapId) => {
      const s = spot(mapId);
      return { id: `map-${mapId.replace(/_/g, "-")}`, note: mapId, ops: [{ kind: "teleport", mapId, x: s.x, y: s.y }, { kind: "hold", dir: null, ms: 1400 }], shot: true };
    }),
  ],
};
