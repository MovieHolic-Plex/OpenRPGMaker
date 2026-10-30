// 추격 «닿으면 무조건 전투» 런타임 게이트 — 출하 플레이어 경로(2026-10-30 추격 AI 개편).
// 1) 시야 2칸 슬라임이 동쪽 4칸: 서 있으면 못 알아채고, 두 칸 걸으면 발소리(영리함 3칸)로 알아채 곧장 달려와 닿는다 → 전투.
//    주인공은 걷기를 멈추고 서 있다 — 서 있는 주인공에게도 닿으면 전투가 열린다.
// 2) 대각 옆: 서 있는 슬라임의 대각 옆 칸에 주인공을 세운다 — 아무도 걷지 않아도 닿았으니 전투.
// 3) 레버: 7칸 떨어진 슬라임이 레버 소리를 듣고 와서 뒤지다 곁의 주인공에 닿는다 → 전투.
// 전투는 매번 battle-scene 이 실제로 열렸는지로 판정한다(체크포인트가 「잠깐 서 있었다」로 통과하지 않게).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/chase-contact-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
const json = execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/chase-contact-fixture.mts"], { maxBuffer: 200 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
writeFileSync(fixture, json);
const project = JSON.parse(String(json));
const START = project.startMapId;
const { x: SX, y: SY } = project.startPos;
const HEAR = "ev_cc_hear";
const HOME = { bodyRect: { left: SX + 4, right: SX + 4, top: SY, bottom: SY } };

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const cursorTo = (testid) => ({ kind: "pressUntil", key: "ArrowDown", testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });
const winBattle = [
  { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
  scene("data-battle-sequence-busy", "false"),
  cursorTo("actor-command-attack"),
  { kind: "key", key: "z" },
  { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
  { kind: "key", key: "z" },
  { kind: "pressUntil", key: "z", testid: "battle-scene", state: "absent", maxPresses: 30, timeoutMs: 60_000 },
  { kind: "hold", dir: null, ms: 2500 },
];

export default {
  id: "chase-contact",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "새 게임: 시야 2칸 슬라임이 동쪽 4칸에 서 있다", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 40, timeoutMs: 60_000 },
      { kind: "waitForRuntime" },
      { kind: "waitFor", testid: "cinematic-sequence", state: "absent", timeoutMs: 30_000 },
      { kind: "seed", seed: 1 },
      { kind: "hold", dir: null, ms: 3500 },
    ], expect: { mapId: START, x: SX, y: SY, testidAbsent: ["title-screen", "battle-scene"] }, shot: true },
    { id: "still-unheard", note: "서 있으면 4칸 밖 슬라임은 못 알아챈다(시야 2칸·곁 느낌 1칸) — 제자리", ops: [
      { kind: "hold", dir: null, ms: 1500 },
    ], expect: { mapId: START, x: SX, y: SY, eventRects: { [HEAR]: HOME }, testidAbsent: ["battle-scene"] }, shot: true },
    { id: "footsteps-heard-touch-battle", note: "두 칸 걸어 다가간 뒤 선다 — 발소리를 들은 슬라임이 곧장 달려와 닿고, 서 있는 주인공에게 전투가 열린다", ops: [
      { kind: "dir", dir: "right" },
      { kind: "waitForPosition", mapId: START, x: SX + 1, y: SY, timeoutMs: 20_000 },
      { kind: "dir", dir: null },
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 20_000 },
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
    { id: "win-1", note: "한 방에 쓰러뜨린다", ops: winBattle, expect: { battleResult: "victory", testidAbsent: ["battle-scene"] }, shot: false },
    { id: "diagonal-still-battle", note: "둘째 맵: 서 있는 슬라임(10,7)의 대각 옆(9,8)에 선다 — 아무도 걷지 않아도 닿았으니 전투", ops: [
      { kind: "teleport", mapId: "map_cc_diag", x: 9, y: 8 },
      { kind: "waitForPosition", mapId: "map_cc_diag", x: 9, y: 8 },
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 20_000 },
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
    { id: "win-2", note: "한 방에 쓰러뜨린다", ops: winBattle, expect: { battleResult: "victory", testidAbsent: ["battle-scene"] }, shot: false },
    { id: "lever-noise-battle", note: "셋째 맵: 레버(6,7) 왼쪽에 서서 당긴다 — 7칸 동쪽 슬라임이 소리를 듣고 와서 뒤지다 곁의 주인공에 닿는다", ops: [
      { kind: "teleport", mapId: "map_cc_lever", x: 5, y: 7 },
      { kind: "waitForPosition", mapId: "map_cc_lever", x: 5, y: 7 },
      { kind: "hold", dir: null, ms: 1800 },
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 25_000 },
    ], expect: { testidPresent: ["battle-scene"], switches: { sw_cc_lever: true } }, shot: true },
  ],
};
