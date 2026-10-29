// 실물 게임 이야기 시나리오(whole-game-joseon·magic) 공용 비트 — 오프닝 장면, 대화(흉상·이름표), 맵 이동·실내 출입, 엔딩.
import { fieldReady, fieldReadyOrSkippable } from "./wholeGameBattleCommon.mjs";

const ARROW = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const mapIs = (mapId) => `() => window.__oprnDebug?.readState?.().currentMapId === ${JSON.stringify(mapId)}`;

/** 타이틀 → 새 게임 → 오프닝 첫 장면 → 둘째 장면. 오프닝은 Enter 로 넘기지 않고 장면이 바뀔 때까지 기다린다. */
export function openingBeats() {
  return [
    { id: "title", note: "타이틀", expect: { testidPresent: ["title-screen"] }, shot: true },
    {
      id: "opening-1",
      note: "새 게임 → 오프닝 첫 장면",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: `() => !!document.querySelector("[data-testid='cinematic-sequence']") || Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 },
        { kind: "waitForVisible", testid: "cinematic-sequence", minAlpha: 0.99, timeoutMs: 20000 },
      ],
      shot: true,
    },
    {
      id: "opening-2",
      note: "오프닝 다음 장면(Enter 한 번)",
      ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 2500 }],
      shot: true,
    },
  ];
}

/** 오프닝을 끝까지 넘기고, 첫 대사(컷신)가 뜨면 찍은 뒤 필드까지. firstDialogue 가 false 면 대사 비트 없이 필드로. */
export function toFieldBeats({ firstDialogue = true } = {}) {
  const skip = [
    { kind: "pressUntilJs", key: "Enter", fn: `() => !!document.querySelector("[data-testid='dialogue-box']") || (${fieldReadyOrSkippable})()`, maxPresses: 60, settleMs: 900 },
  ];
  return [
    ...(firstDialogue ? [{
      id: "first-dialogue",
      note: "오프닝 뒤 첫 대사(흉상·이름표)",
      ops: [...skip, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 30000 }, { kind: "hold", dir: null, ms: 1500 }],
      shot: true,
    }] : []),
    {
      id: "field-start",
      note: "첫 필드(조작 가능)",
      ops: [
        { kind: "seed", seed: 1 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReadyOrSkippable, maxPresses: 80, settleMs: 700 },
        { kind: "pressUntilJs", key: "Escape", times: 2, fn: `() => !/건너뛰기/.test(document.body.innerText)`, maxPresses: 6, settleMs: 900 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 80, settleMs: 700 },
      ],
      shot: true,
    },
  ];
}

/** NPC 곁 칸에서 얼굴을 돌려 조사 → 대사창(흉상·이름표)이 다 보일 때 한 장. 끝나면 다음 비트가 대사를 닫는다. */
export function talkBeat({ id, note, mapId, at, face }) {
  return {
    id, note,
    ops: [
      { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 },
      { kind: "teleport", mapId, x: at.x, y: at.y },
      { kind: "waitForPosition", mapId, x: at.x, y: at.y },
      { kind: "face", dir: face },
      { kind: "action" },
      { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 },
      { kind: "hold", dir: null, ms: 1500 },
    ],
    shot: true,
  };
}

/** 문·계단 앞 칸에서 그쪽으로 걸어 맵을 옮긴다 — 도착 맵이 조작 가능해지고 암전이 걷힌 뒤 한 장(검은 화면·카메라 튐). */
export function transferBeat({ id, note, mapId, from, push, to }) {
  return {
    id, note,
    ops: [
      { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 },
      { kind: "teleport", mapId, x: from.x, y: from.y },
      { kind: "waitForPosition", mapId, x: from.x, y: from.y },
      { kind: "pressUntilJs", key: ARROW[push], fn: mapIs(to), maxPresses: 12, settleMs: 500 },
      { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 20, settleMs: 700 },
      { kind: "hold", dir: null, ms: 1500 },
    ],
    shot: true,
  };
}
