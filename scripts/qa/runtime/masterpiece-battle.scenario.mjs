import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// 명작 공백 전투 규칙(2026-09-27) — 출하 플레이어(player.html)로 본다.
// 증거:
//   battle-scene[data-battle-formation]           — "preemptive" (선제 공격 배너가 개시 대사에 붙었다, #3)
//   battle-limit-gauge-<actor> / battle-resource2-gauge-<actor> — 켠 전투의 배우 행에 리미트·기력 게이지(#9 #21)
//   battle-party-gauge                            — 파티 공용 연계 게이지(#16)
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/masterpiece-battle-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/masterpiece-battle-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const idle = scene("data-battle-sequence-busy", "false");
const attack = [
  { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
  idle,
  { kind: "pressUntil", key: "ArrowDown", testid: "actor-command-attack", state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 },
  { kind: "key", key: "z" },
  { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
  { kind: "key", key: "z" },
];

export default {
  id: "masterpiece-battle",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "새 게임 → 필드", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 7 },
    ], expect: { testidAbsent: ["title-screen", "battle-scene"] } },
    { id: "preemptive", note: "슬라임 조사 → 선제 공격 개시(배너)", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 30_000 },
      scene("data-battle-formation", "preemptive", 20_000),
      { kind: "waitForVisible", testid: "battle-message-window", timeoutMs: 20_000 },
    ], expect: { testidPresent: ["battle-scene"], visibleText: { "battle-message-window": "선제 공격" } }, shot: true },
    { id: "gauges", note: "명령 창 — 배우 행의 리미트·기력 게이지와 파티 연계 게이지", ops: [
      { kind: "pressUntil", key: "z", testid: "actor-command-attack", state: "present", maxPresses: 10, timeoutMs: 2_000 },
    ], expect: { testidPresent: [
      "battle-limit-gauge-actor_hero", "battle-resource2-gauge-actor_hero",
      "battle-limit-gauge-actor_mage", "battle-party-gauge",
    ] }, shot: true },
    { id: "gauges-filled", note: "두 번 공격 → 명중이 게이지를 채운다", ops: [
      ...attack,
      idle,
      ...attack,
      idle,
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
    ], expect: { testidPresent: ["battle-party-gauge", "battle-limit-gauge-actor_hero"] }, shot: true },
  ],
};
