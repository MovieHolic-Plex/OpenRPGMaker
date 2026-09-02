// 정면 전투(rm2000) 화면 투어 — **엄격 턴제(strict)** 변형.
//
// battle-rm2000-tour 와 같은 전투를 `system.battleFlow: "strict"` 픽스처로 돈다. 두 가지를 더 본다:
//   1. 엄격 턴제의 진행 칩("명령 1/1") 이 명령 카드 윗변에 앉는다.
//   2. 라운드마다 적도 행동하므로 **아군이 맞는 장면**을 찍을 수 있다 — 정면 스킨은 아군 스프라이트가
//      없어 파티 카드 행이 곧 아군의 몸이다(행 흔들림·붉은 기운 + HP 수치 위 피해 팝업).
//      ATB 에서는 주인공이 슬라임보다 빨라 슬라임이 행동하기 전에 이겨 버린다(실측).
//
//   node scripts/runtime-qa.mjs --scenario battle-rm2000-tour-strict --out verify-shots/rm2000-tour-strict
import base from "./battle-rm2000-tour.scenario.mjs";

const actorHitBeat = {
  id: "actor-hit",
  note: "적 턴 — 주인공이 맞는 순간(파티 행 팝업 + 흔들림). 결정키로 라운드를 굴리다 주인공 대상 팝업이 뜨면 멈춘다",
  ops: [
    { kind: "pressUntil", key: "z", testid: "battle-damage-popup", state: "present", attr: "data-target-id", value: "actor_hero", maxPresses: 60, timeoutMs: 1500 },
  ],
  expect: { testidPresent: ["battle-damage-popup", "battle-party"] },
  shot: true,
};

const resultIndex = base.beats.findIndex((beat) => beat.id === "result");

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleRm2000TourStrictScenario = {
  ...base,
  id: "battle-rm2000-tour-strict",
  projectFixture: "test/fixtures/projects/battle-v3-strict.json",
  beats: [...base.beats.slice(0, resultIndex), actorHitBeat, ...base.beats.slice(resultIndex)],
};

export default battleRm2000TourStrictScenario;
