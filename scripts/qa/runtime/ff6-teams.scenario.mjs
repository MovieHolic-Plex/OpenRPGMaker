import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// FF6 수정 A(PR3) — 팀 교대 전투를 출하 플레이어(player.html)로 본다.
//   가우 팀(가우·렐름)만 싸우고, 명령 메뉴에 「로크 팀 교대」 버튼이 있다. 누르면 로크 팀(로크·티나)이 들어온다.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ff6-teams-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/ff6-teams-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const idle = scene("data-battle-sequence-busy", "false");

export default {
  id: "ff6-teams",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "새 게임 → 시작 맵", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 4 },
    ], expect: { testidAbsent: ["title-screen", "battle-scene"] } },
    { id: "team-a-fights", note: "병사와 전투 — 가우 팀만 선다, 교대 버튼이 있다", ops: [
      { kind: "face", dir: "up" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 10 },
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
      idle,
    ], expect: { testidPresent: ["battle-scene", "actor-team-swap-team_b"], testidAbsent: ["actor-team-swap-team_a"] }, shot: true },
    { id: "swap", note: "로크 팀 교대 → 로크·티나가 들어온다", ops: [
      { kind: "key", key: "ArrowDown" },
      { kind: "key", key: "ArrowDown" },
      { kind: "pressUntil", key: "ArrowRight", testid: "actor-team-swap-team_b", state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 2, timeoutMs: 1500 },
      { kind: "key", key: "z" },
      idle,
      { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
      idle,
    ], expect: { testidPresent: ["battle-scene", "actor-team-swap-team_a"], testidAbsent: ["actor-team-swap-team_b"] }, shot: true },
  ],
};
