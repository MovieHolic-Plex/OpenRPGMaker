// 실물 게임 전투 시나리오(whole-game-battle-*) 공용 비트·조건.

/** 필드가 조작 가능한가 — 대사창·건너뛰기 안내·메뉴·전투·전투 전환 덮개(복귀 암전)가 없고 런타임 상태가 읽힌다. pressUntilJs 의 fn 문자열. */
export const fieldReady = `() => {
  const s = window.__oprnDebug?.readState?.();
  if (!s?.currentMapId) return false;
  if (document.querySelector("[data-testid='dialogue-box'], [data-testid='battle-scene'], [data-testid='main-menu'], [data-testid='dialogue-choice-frame'], [data-testid='battle-transition-overlay'], .battle-return-settle")) return false;
  return !/건너뛰기/.test(document.body.innerText);
}`;

/** 필드가 조작 가능하거나, 컷신 건너뛰기 안내가 떠 있다(그때는 Esc 두 번으로 넘긴다). */
export const fieldReadyOrSkippable = `() => /건너뛰기/.test(document.body.innerText) || (${fieldReady})()`;

/** 타이틀 → 새 게임 → 오프닝을 넘겨 첫 필드. 건너뛰기 안내가 뜨면 Escape 로 넘기고, 대사는 Enter 로 넘긴다. */
export function wholeGameOpening() {
  return [
    { id: "title", note: "타이틀", expect: { testidPresent: ["title-screen"] }, shot: true },
    {
      id: "field-start",
      note: "새 게임 → 오프닝을 넘긴 첫 필드",
      ops: [
        // 타이틀 입력이 늦게 열리는 판(부하·큰 게임)에서 첫 Enter 가 씹힌다 — 필드 상태가 읽힐 때까지 누른다.
        { kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 },
        { kind: "seed", seed: 1 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReadyOrSkippable, maxPresses: 60, settleMs: 700 },
        { kind: "pressUntilJs", key: "Escape", times: 2, fn: `() => !/건너뛰기/.test(document.body.innerText)`, maxPresses: 6, settleMs: 900 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 60, settleMs: 700 },
      ],
      shot: true,
    },
  ];
}

/** 전투 연출이 도는 중 — 명령을 확정한 직후의 한 장을 찍을 때. */
export const battleBusy = `() => document.querySelector("[data-testid='battle-scene']")?.dataset.battleSequenceBusy === "true"`;

const PUSH_KEY = { right: "ArrowRight", left: "ArrowLeft", up: "ArrowUp", down: "ArrowDown" };

/**
 * 접촉 발동 필드 적 두 마리로 승리·패배를 다 본다.
 *   win/lose: { mapId, x, y, push, label } — (x,y) 는 적 옆 칸, push 는 적 쪽 방향. 적이 오가도 계속 밀면 닿는다.
 * 패배 쪽은 체력 1(e2eVitals 훅 — 시나리오 query 에 e2eVitals:"1")로 방어만 해 게임 오버 화면까지 간다.
 */
export function fieldFoeBattleBeats({ win, lose }) {
  return [
    {
      id: "approach",
      note: `${win.label} 옆 칸으로`,
      ops: [
        { kind: "teleport", mapId: win.mapId, x: win.x, y: win.y },
        { kind: "waitForPosition", mapId: win.mapId, x: win.x, y: win.y },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
      ],
      shot: true,
    },
    {
      id: "battle-enter",
      note: "적 쪽으로 밀어 접촉 → 전투 화면(명령 대기)",
      ops: [
        { kind: "pressUntil", key: PUSH_KEY[win.push], testid: "battle-scene", state: "present", maxPresses: 40, timeoutMs: 1200 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      expect: { testidPresent: ["battle-scene"], battlerGeometry: { minEnemies: 1 } },
      shot: true,
    },
    {
      id: "battle-attack-fx",
      note: "공격 명령 → 연출 도중",
      ops: [
        { kind: "click", testid: "actor-command-attack" },
        { kind: "pressUntilJs", key: "Enter", fn: battleBusy, maxPresses: 4, settleMs: 250 },
      ],
      shot: true,
    },
    {
      id: "battle-victory",
      note: "결과 창(승리)",
      ops: [
        { kind: "battle", fallback: "attack", timeoutMs: 150000 },
        { kind: "waitFor", testid: "battle-result-confirm", state: "present", timeoutMs: 20000 },
        // 결과 창은 미끄러져 들어온다 — 다 들어와 불투명해진 뒤 찍는다.
        { kind: "waitForVisible", testid: "battle-result-panel", minAlpha: 0.99, timeoutMs: 20000 },
        // 보상 줄은 하나씩 떠오른다 — 마지막 줄까지.
        { kind: "waitForVisible", testid: "battle-result-panel", descendant: ".battle-result-reward-row:last-child[data-revealed='true']", minAlpha: 0.99, timeoutMs: 20000 },
      ],
      shot: true,
    },
    {
      id: "back-to-field",
      note: "결과를 닫고 필드로 — 돌아온 카메라·위치",
      ops: [
        { kind: "battle", untilEnd: true, resultHoldMs: 300, timeoutMs: 60000 },
        { kind: "waitFor", testid: "battle-scene", state: "absent", timeoutMs: 30000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
      ],
      shot: true,
    },
    {
      id: "defeat-enter",
      note: `체력 1 로 ${lose.label} 에 접촉`,
      ops: [
        { kind: "teleport", mapId: lose.mapId, x: lose.x, y: lose.y },
        { kind: "waitForPosition", mapId: lose.mapId, x: lose.x, y: lose.y },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
        { kind: "setVitals", hp: 1, mp: 0 },
        { kind: "pressUntil", key: PUSH_KEY[lose.push], testid: "battle-scene", state: "present", maxPresses: 40, timeoutMs: 1200 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      shot: true,
    },
    {
      id: "defeat",
      note: "방어만 하다 쓰러짐 → 게임 오버 화면",
      ops: [
        { kind: "battle", fallback: "defend", untilEnd: true, resultHoldMs: 300, timeoutMs: 180000 },
        { kind: "waitFor", testid: "game-over-screen", state: "present", timeoutMs: 30000 },
        // 패배 덮개가 걷히고 게임 오버 그림이 다 그려진 뒤.
        { kind: "waitFor", testid: "battle-transition-overlay", state: "absent", timeoutMs: 30000 },
        // 게임 오버는 검게 내려앉은 뒤 그림·글·선택지가 떠오른다 — 선택지까지 다 보일 때 찍는다.
        { kind: "waitForVisible", testid: "game-over-screen", descendant: ".game-over-choice", minAlpha: 0.99, timeoutMs: 30000 },
      ],
      shot: true,
    },
  ];
}
