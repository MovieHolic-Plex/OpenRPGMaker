import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Hand interior v5 stair redraw (2026-10-22): walk UP and DOWN each redrawn stair in the shipped player and arrive on the
// other floor in front of the paired stair, facing away from it (south).
//   QA_RECORD_VIDEO=<dir> node scripts/runtime-qa.mjs --scenario v5-stairs --netns
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/v5-stairs-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/v5-stairs-fixture.mts"], {
  maxBuffer: 200 * 1024 * 1024,
}));
const walk = (mapId, dir, x, y, steps) => [
  { kind: "playerRoute", moves: Array.from({ length: steps }, () => ({ kind: "move", dir })) },
  { kind: "waitForPosition", mapId, x, y, timeoutMs: 15000 },
];
export default {
  id: "v5-stairs",
  projectFixture: fixture,
  beats: [
    { id: "manor-1f-front", note: "저택 1층 — 올라가는 나무 계단 앞 칸 (12,4) 으로 걸어가 북쪽을 본다", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "hold", dir: null, ms: 1500 },
      ...walk("hand-manor-1f", "up", 12, 4, 3),
      { kind: "hold", dir: null, ms: 700 },
    ], expect: { mapId: "hand-manor-1f", x: 12, y: 4 }, shot: true },
    { id: "manor-up", note: "계단으로 올라 2층 내려가는 계단통 앞 (12,5) 에 남쪽을 보고 선다", ops: [
      ...walk("hand-manor-2f", "up", 12, 5, 1),
      { kind: "hold", dir: null, ms: 1500 },
    ], expect: { mapId: "hand-manor-2f", x: 12, y: 5 }, shot: true },
    { id: "manor-down", note: "2층 계단통으로 내려가 1층 계단 앞 (12,4) 에 남쪽을 보고 선다", ops: [
      ...walk("hand-manor-1f", "up", 12, 4, 1),
      { kind: "hold", dir: null, ms: 1500 },
    ], expect: { mapId: "hand-manor-1f", x: 12, y: 4 }, shot: true },
    { id: "dungeon-up", note: "지하 감옥 — 올라가는 돌 계단 앞 (2,4) 에서 올라 위층 내려가는 계단 앞 (8,8) 에 남쪽을 보고 선다", ops: [
      { kind: "teleport", mapId: "hand-dungeon", x: 2, y: 5 },
      { kind: "hold", dir: null, ms: 1000 },
      ...walk("hand-dungeon", "up", 2, 4, 1),
      { kind: "hold", dir: null, ms: 600 },
      ...walk("qa-cellar-top", "up", 8, 8, 1),
      { kind: "hold", dir: null, ms: 1500 },
    ], expect: { mapId: "qa-cellar-top", x: 8, y: 8 }, shot: true },
    { id: "cellar-down", note: "바닥 구멍 내려가는 계단으로 내려가 지하 감옥 돌 계단 앞 (2,4) 에 남쪽을 보고 선다", ops: [
      ...walk("hand-dungeon", "up", 2, 4, 1),
      { kind: "hold", dir: null, ms: 1800 },
    ], expect: { mapId: "hand-dungeon", x: 2, y: 4 }, shot: true },
  ],
};
