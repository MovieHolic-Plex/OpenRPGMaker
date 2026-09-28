// 실행: node scripts/runtime-qa.mjs --scenario retro2003 --out .omo/runtime-qa/retro2003
// DOM/CSS 연속 프레임은 retro2003-frames.probe.mjs가 실시간으로 별도 촬영한다.
import { battleScenario } from "./battle.scenario.mjs";
import { createRetro2003Fixture } from "./retro2003-fixture.mjs";

const fixture = createRetro2003Fixture();
const intro = battleScenario.beats.find((beat) => beat.id === "battle-intro");
export default {
  id: "retro2003",
  projectFixture: fixture.path,
  beats: [
    ...battleScenario.beats.slice(0, 3),
    {
      ...intro,
      // 인트로와 명령 대기를 분리해 각 상태의 화면을 남긴다.
      ops: intro.ops.filter((op) => op.testid !== "actor-command-attack"),
    },
    {
      id: "battle-command",
      note: "측면 레트로 스킨의 시간 게이지와 명령 대기",
      ops: [
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
        { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-sequence-busy", value: "false" },
        { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-skin", value: "retro2003" },
        { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-flow", value: "gauge" },
      ],
      expect: { testidPresent: ["battle-scene", "actor-command-attack"], battlerGeometry: { minEnemies: 3 } },
      shot: true,
    },
    {
      id: "battle-attack",
      note: "공격 대상 선택 후 확정 — 연속 동작은 별도 프레임 프로브에서 기록",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
        { kind: "key", key: "z" },
      ],
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
    {
      id: "battle-result",
      note: "현재 키 계약 F로 자동 전투 → 결과와 승리 포즈",
      ops: [
        { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-sequence-busy", value: "false" },
        { kind: "key", key: "f" },
        { kind: "waitFor", testid: "battle-result-panel", state: "present", timeoutMs: 120000 },
        { kind: "waitForAttr", testid: "battle-result-panel", attr: "data-battle-result", value: "victory" },
      ],
      expect: { testidPresent: ["battle-result-panel", "battle-actor-sprites"] },
      shot: true,
    },
  ],
};
