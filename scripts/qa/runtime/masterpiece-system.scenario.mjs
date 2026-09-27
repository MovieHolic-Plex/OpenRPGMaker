import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// 명작 공백 시스템·연출(2026-09-27) — 출하 플레이어(player.html)로 본다.
// 증거:
//   title-screen[data-screen=difficulty] + difficulty-option-hard  — 새 게임 난이도 선택(#19)
//   runtime-screen-filter[data-filter]                             — 흑백 필터(#37, Tint Screen grayscale)
//   battle-scene[data-battle-rolling-hp]                           — 롤링 HP 켠 전투(#15)
//   battle-backdrop[data-backdrop-motion]                          — 스크롤·물결·색 순환 배경(#15)
//   enemy-1[data-battle-hp-revealed]                               — 라이브라가 피해 없이 HP 를 드러낸다(#20 #10)
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/masterpiece-system-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/masterpiece-system-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

const cursorTo = (testid) => ({ kind: "pressUntil", key: "ArrowDown", testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });
const idle = { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-sequence-busy", value: "false", timeoutMs: 30_000 };

export default {
  id: "masterpiece-system",
  projectFixture: fixture,
  beats: [
    { id: "difficulty-picker", note: "새 게임 → 난이도 선택 창(쉬움·어려움)", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForAttr", testid: "title-screen", attr: "data-screen", value: "difficulty", timeoutMs: 20_000 },
      { kind: "waitForVisible", testid: "player-difficulty-window", timeoutMs: 10_000 },
    ], expect: { testidPresent: ["difficulty-option-easy", "difficulty-option-hard"], visibleText: { "player-difficulty-window": "어려움" } }, shot: true },
    { id: "field-hard", note: "어려움 고르고 시작", ops: [
      { kind: "key", key: "ArrowDown" },
      { kind: "key", key: "Enter" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 3 },
    ], expect: { testidAbsent: ["title-screen"] } },
    { id: "grayscale", note: "기억 조사 → 흑백 필터가 대사까지 바랜다", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "waitFor", testid: "runtime-screen-filter", state: "present", timeoutMs: 10_000 },
      { kind: "waitForVisible", testid: "dialogue-box", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
    ], expect: { testidPresent: ["runtime-screen-filter", "dialogue-box"] }, shot: true },
    { id: "battle-motion", note: "대사 넘김 → 롤링 HP 전투, 움직이는 배경", ops: [
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 8 },
      { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-rolling-hp", value: "true", timeoutMs: 20_000 },
      { kind: "waitForAttr", testid: "battle-backdrop", attr: "data-backdrop-motion", value: "scroll wave palette", timeoutMs: 20_000 },
      { kind: "waitFor", testid: "actor-command-skill", state: "present", timeoutMs: 40_000 },
      idle,
    ], expect: { testidPresent: ["battle-scene", "battle-backdrop", "enemy-1"] }, shot: true },
    { id: "libra", note: "라이브라 → 피해 없이 적 HP 바가 드러난다", ops: [
      { kind: "waitForAttr", testid: "enemy-1", attr: "data-battle-hp-revealed", value: "false", timeoutMs: 10_000 },
      cursorTo("actor-command-skill"),
      { kind: "key", key: "z" },
      { kind: "waitForVisible", testid: "actor-skill-skill_libra", timeoutMs: 10_000 },
      cursorTo("actor-skill-skill_libra"),
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      { kind: "waitForAttr", testid: "enemy-1", attr: "data-battle-hp-revealed", value: "true", timeoutMs: 30_000 },
    ], expect: { testidPresent: ["enemy-1"] }, shot: true },
  ],
};
