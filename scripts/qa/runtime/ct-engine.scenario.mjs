import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Chrono Trigger battle engine through the shipped player (player.html). The fixture authors the project only
// through runTool: gauge flow + Active ATB (speed 1) + field backdrop, a physical-counter enemy, an auto-revive
// accessory, and a troop page that moves the enemy with m2-218-move-enemy.
// Evidence is read from DOM attributes the battle scene writes as the presentation reaches the screen:
//   battle-scene[data-battle-enemy-acted-during-menu]  — an enemy acted while the command menu stayed open
//   battle-scene[data-battle-counter-seen]            — a counter entry was played
//   battle-scene[data-battle-revive-seen]             — the auto-revive entry was played
//   enemy-1 --battle-node-x/y                          — rendered position after moveEnemy (30,30 → 9.375%/12.5%)
//   battle-actor-actor_hero[data-battle-pose]          — "victory" after winning
//   battle-actor-actor_hero[data-battle-pose-frame]    — "victory" (sheet cell drawn, not the idle fallback)
//   battle-backdrop[data-backdrop-source]              — "field" snapshot backdrop
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-engine-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-engine-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const cursorTo = (testid) => ({ kind: "pressUntil", key: "ArrowDown", testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });
const idle = scene("data-battle-sequence-busy", "false");
const attack = [
  { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
  idle,
  cursorTo("actor-command-attack"),
  { kind: "key", key: "z" },
  { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
  { kind: "key", key: "z" },
];

export default {
  id: "ct-engine",
  projectFixture: fixture,
  // setVitals(__oprnSetActorVitals) 훅은 e2eVitals=1 일 때만 설치된다.
  query: { e2eVitals: "1" },
  beats: [
    { id: "field", note: "new game → skip opening → hero HP 1 so the first counter is lethal", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 12 },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "setVitals", hp: 1, mp: 0 },
    ], expect: { testidAbsent: ["title-screen", "battle-scene"] } },
    { id: "battle-field-backdrop", note: "talk to the blocker → battle whose backdrop is the field snapshot", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 16 },
      { kind: "waitForAttr", testid: "battle-backdrop", attr: "data-backdrop-source", value: "field", timeoutMs: 20_000 },
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
    ], expect: { testidPresent: ["battle-scene", "enemy-1", "battle-backdrop"] }, shot: true },
    { id: "active-atb", note: "leave the command menu open — the enemy still acts (Active ATB)", ops: [
      scene("data-battle-atb-mode", "active", 5_000),
      scene("data-battle-enemy-acted-during-menu", "true", 60_000),
      idle,
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
    ], expect: { testidPresent: ["actor-command-attack"] }, shot: true },
    { id: "counter-revive", note: "attack → physical counter kills the 1-HP hero → phoenix plume revives", ops: [
      ...attack,
      scene("data-battle-counter-seen", "true"),
      scene("data-battle-revive-seen", "true"),
      idle,
    ], expect: { testidPresent: ["battle-scene", "battle-actor-actor_hero"] }, shot: true },
    { id: "enemy-moved", note: "turn-1 troop page moveEnemy(30,30): rendered node sits at the new coordinates", ops: [
      { kind: "waitForStyleVar", testid: "enemy-1", prop: "--battle-node-x", value: "9.375%", timeoutMs: 60_000 },
      { kind: "waitForStyleVar", testid: "enemy-1", prop: "--battle-node-y", value: "12.5%", timeoutMs: 5_000 },
    ], expect: { testidPresent: ["enemy-1"] }, shot: true },
    { id: "victory-pose", note: "keep attacking until the enemy falls — the living hero shows the victory pose", ops: [
      { kind: "repeatUntil", testid: "battle-result-panel", state: "present", maxRounds: 12, ops: attack },
      { kind: "waitForAttr", testid: "battle-actor-actor_hero", attr: "data-battle-pose", value: "victory", timeoutMs: 30_000 },
      // 승리 칸 그림이 있어 idle 폴백이 아니라 victory 칸을 쓴다(battleFieldDom.victoryFrameFor).
      { kind: "waitForAttr", testid: "battle-actor-actor_hero", attr: "data-battle-pose-frame", value: "victory", timeoutMs: 10_000 },
    ], expect: { testidPresent: ["battle-result-panel"] }, shot: true },
  ],
};
