// 필드 위 전투(system.battlePresentation "onField") 런타임 게이트.
// 심볼에 말을 걸면 전환 없이 그 자리에서 전투가 열리고, 적은 심볼 발밑·아군은 주인공/동료 발밑에 선다(±1칸).
// 이기면 심볼은 지워지고 주인공은 같은 칸에 그대로 있다.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-onfield-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
const json = execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-onfield-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 });
writeFileSync(fixture, json);
const project = JSON.parse(String(json));
const START = project.startMapId;
const { x: SX, y: SY } = project.startPos;
const BAT = "ev_onfield_bat";

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const cursorTo = (testid) => ({ kind: "pressUntil", key: "ArrowDown", testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });

export default {
  id: "ct-onfield",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "new game: hero + companion on the field, bat symbol three tiles north", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 12 },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "waitForFollowers", count: 1 },
    ], expect: { mapId: START, x: SX, y: SY, followerSpriteCount: 1, testidAbsent: ["title-screen", "battle-scene"] }, shot: true },
    { id: "approach", note: "walk up two tiles to stand right under the symbol, then record field sprite screen positions", ops: [
      { kind: "key", key: "ArrowUp" },
      { kind: "waitForPosition", mapId: START, x: SX, y: SY - 1 },
      { kind: "key", key: "ArrowUp" },
      { kind: "waitForPosition", mapId: START, x: SX, y: SY - 2 },
      { kind: "face", dir: "up" },
      { kind: "hold", ms: 400 },
      { kind: "captureFieldAnchors", eventId: BAT },
    ], expect: { mapId: START, x: SX, y: SY - 2 } },
    { id: "battle-on-field", note: "talk to the symbol: battle opens in place (no transition overlay), battlers stand where the field sprites were", ops: [
      { kind: "action" },
      // 블로커 인트로 대사("적이 앞을 가로막았다!")를 넘긴다.
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 16 },
      scene("data-battle-presentation", "onField", 10_000),
      { kind: "waitFor", testid: "battle-onfield-backdrop", state: "present", timeoutMs: 10_000 },
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
    ], expect: {
      testidPresent: ["battle-scene", "enemy-1", "battle-onfield-backdrop"],
      testidAbsent: ["battle-transition-overlay"],
      onFieldPlacement: { enemyTestid: "enemy-1", actorTestids: ["battle-actor-actor_hero", "battle-actor-actor_guardian"], maxTiles: 1 },
    }, shot: true },
    { id: "victory-returns-in-place", note: "one attack defeats the bat; the battle closes without a transition and the hero is on the same tile", ops: [
      scene("data-battle-sequence-busy", "false"),
      cursorTo("actor-command-attack"),
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "absent", maxPresses: 30, timeoutMs: 60_000 },
      { kind: "waitForFollowers", count: 1 },
    ], expect: { mapId: START, x: SX, y: SY - 2, battleResult: "victory", followerSpriteCount: 1, testidAbsent: ["battle-scene", "battle-transition-overlay"] }, shot: true },
  ],
};
