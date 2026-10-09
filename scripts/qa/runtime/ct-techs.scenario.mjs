import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Chrono Trigger techs through the shipped player (player.html). The fixture authors the project only
// through runTool: combo X베기 (actor_hero + actor_mage), a circle-AoE 회오리참, TP rewards/thresholds.
// Damage is read from the enemy HUD reveal flag: battleFieldDom sets data-battle-hp-revealed="true"
// once an enemy's presented HP drops below max, so "false" on a spaced enemy proves the AoE missed it.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-techs-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-techs-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

const revealed = (testid, value) => ({ kind: "waitForAttr", testid, attr: "data-battle-hp-revealed", value, timeoutMs: 30_000 });
// 화면이 그리는 커서(data-battle-command-cursor)를 방향키로 옮긴다 — 이 스킨은 명령 그리드가 포인터를 가린다.
const cursorTo = (testid) => ({ kind: "pressUntil", key: "ArrowDown", testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });
const idle = { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-sequence-busy", value: "false", timeoutMs: 30_000 };

export default {
  id: "ct-techs",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "new game → skip opening → start south of the log blocker", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 12 },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
    ], expect: { testidAbsent: ["title-screen", "battle-scene"] } },
    { id: "battle", note: "talk to the blocker → strict battle vs three spaced logs", ops: [
      { kind: "face", dir: "up" },
      { kind: "action" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 16 },
      { kind: "waitFor", testid: "actor-command-skill", state: "present", timeoutMs: 40_000 },
      idle,
    ], expect: { testidPresent: ["battle-scene", "enemy-1", "enemy-2", "enemy-3"] }, shot: true },
    { id: "combo-listed", note: "크로's tech list shows the dual tech X베기 with partner 루카", ops: [
      cursorTo("actor-command-skill"),
      { kind: "key", key: "z" },
      { kind: "waitForVisible", testid: "actor-skill-skill_x_strike", timeoutMs: 10_000 },
    ], expect: {
      testidAbsent: ["actor-skill-skill_ct_tp_tech"],
      // 버튼 글자 = 이름(X베기) + 상세(MP n · 루카와 연계). 동료 이름이 보여야 연계기로 읽힌다.
      visibleText: { "actor-skill-skill_x_strike": "루카와 연계", "actor-skill-skill_ct_blast": "회오리참" },
    }, shot: true },
    { id: "combo-hit", note: "X베기 on log 1 — damages it and consumes 루카's turn (round resolves)", ops: [
      cursorTo("actor-skill-skill_x_strike"),
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      revealed("enemy-1", "true"),
      { kind: "waitFor", testid: "actor-command-skill", state: "present", timeoutMs: 40_000 },
      idle,
      revealed("enemy-2", "false"),
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
    { id: "aoe-hit", note: "회오리참 (circle r=60) on log 1 hits log 2 (40px) but not log 3 (~128px)", ops: [
      cursorTo("actor-command-skill"),
      { kind: "key", key: "z" },
      { kind: "waitForVisible", testid: "actor-skill-skill_ct_blast", timeoutMs: 10_000 },
      cursorTo("actor-skill-skill_ct_blast"),
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      // 루카 차례: 첫 행(공격) → 첫 적.
      cursorTo("actor-command-attack"),
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      revealed("enemy-2", "true"),
      { kind: "waitFor", testid: "actor-command-skill", state: "present", timeoutMs: 40_000 },
      idle,
      revealed("enemy-3", "false"),
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
  ],
};
