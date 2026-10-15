import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// FF6 수정 A(2026-10-15) — 출하 플레이어(player.html)로 본다.
//   폭주(가우): 라운드 1 에 폭주 → 이후 메뉴 없이 자동 행동(MP 99 짜리 물어뜯기를 비용 없이)
//   스케치(렐름): 제국 병사의 선더를 그려 쓴다 — 특수 문장 「스케치: 선더!」
//   블리츠(로크): 대상을 고르면 입력 창(battle-input-prompt)이 떠 아래·오른쪽·왼쪽·확인을 누르면 위력 ×2
//   마석 AP(티나): 승리하면 결과 패널에 「티나 기술 습득 · 파이어」(AP 70 ≥ 필요 60)
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ff6-fix-a-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/ff6-fix-a-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }));

const scene = (attr, value, timeoutMs = 40_000) => ({ kind: "waitForAttr", testid: "battle-scene", attr, value, timeoutMs });
const idle = scene("data-battle-sequence-busy", "false");
const cursorTo = (testid, key = "ArrowDown") => ({ kind: "pressUntil", key, testid, state: "present", attr: "data-battle-command-cursor", value: "true", maxPresses: 8, timeoutMs: 1500 });
// 클래스에 기술이 하나뿐이면 목록 없이 바로 그 기술이 골라진다(폭주·스케치·블리츠 모두 1개).
const pickSkill = () => [
  { kind: "waitFor", testid: "actor-command-skill", state: "present", timeoutMs: 40_000 },
  idle,
  cursorTo("actor-command-skill", "ArrowRight"),
  { kind: "key", key: "z" },
];
const attack = [
  { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
  idle,
  cursorTo("actor-command-attack"),
  { kind: "key", key: "z" },
  { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
  { kind: "key", key: "z" },
];

export default {
  id: "ff6-fix-a",
  projectFixture: fixture,
  beats: [
    { id: "field", note: "새 게임 → 시작 맵", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 4 },
    ], expect: { testidAbsent: ["title-screen", "battle-scene"] } },
    { id: "battle-start", note: "병사와 전투 — 가우의 명령 차례", ops: [
      { kind: "face", dir: "up" },
      { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 10 },
      { kind: "waitFor", testid: "actor-command-skill", state: "present", timeoutMs: 40_000 },
    ], expect: { testidPresent: ["battle-scene", "enemy-1"] }, shot: true },
    { id: "rage", note: "가우: 폭주 — 몬스터 모습으로 자동 행동", ops: [
      ...pickSkill(),
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
    { id: "sketch", note: "렐름: 스케치 — 병사의 선더를 그려 쓴다", ops: [
      ...pickSkill(),
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      idle,
    ], expect: { testidPresent: ["battle-scene"] }, shot: true },
    { id: "blitz-input", note: "로크: 오라 캐논 — 입력 창이 뜬다", ops: [
      ...pickSkill(),
      { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10_000 },
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-input-prompt", state: "present", timeoutMs: 10_000 },
    ], expect: { testidPresent: ["battle-input-prompt", "battle-input-prompt-key-0"] }, shot: true },
    { id: "blitz-success", note: "아래·오른쪽·왼쪽·확인 → 입력 성공", ops: [
      { kind: "key", key: "ArrowDown" },
      { kind: "key", key: "ArrowRight" },
      { kind: "key", key: "ArrowLeft" },
      { kind: "key", key: "z" },
      { kind: "waitFor", testid: "battle-input-prompt", state: "absent", timeoutMs: 10_000 },
      idle,
    ], expect: { testidAbsent: ["battle-input-prompt"] }, shot: true },
    { id: "victory-ap", note: "티나가 마석을 낀 채 승리까지 — 결과 패널에 마석 AP 로 배운 기술", ops: [
      { kind: "repeatUntil", testid: "battle-result-panel", state: "present", maxRounds: 14, ops: attack },
      { kind: "waitForVisible", testid: "battle-result-panel", timeoutMs: 30_000 },
    ], expect: { testidPresent: ["battle-result-panel"], visibleText: { "battle-result-panel": "파이어" } }, shot: true },
  ],
};
