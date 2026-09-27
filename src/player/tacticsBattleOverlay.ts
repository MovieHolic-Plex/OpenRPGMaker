/**
 * 전술 전투(tacticsBattle) 키보드 오버레이. 규칙은 tacticsBattle.ts 상태기계가 전부 쥐고,
 * 여기서는 커서·선택 단계만 관리한다.
 *
 * 조작(파티 차례): 방향키 = 커서, 결정(Z/Enter/Space) = 유닛 고르기 → 이동할 칸 → 공격할 적(또는 제자리 결정 = 대기),
 * 취소(X/Esc) = 선택 취소. 적 차례는 자동으로 진행된다.
 */
import { directionForKey, isCancelKey, isConfirmKey } from "@/player/keyBindings";
import {
  adjacentFoes,
  reachableTiles,
  runEnemyTurn,
  tacticsAttack,
  tacticsMove,
  tacticsWait,
  unitAt,
  type TacticsState,
  type TacticsUnit,
} from "@/player/tacticsBattle";
import { el } from "@/util/dom";

export const TACTICS_OVERLAY_TESTID = "tactics-battle";

type Phase = { kind: "select" } | { kind: "move"; unitId: string } | { kind: "target"; unitId: string };

export interface TacticsController {
  readonly root: HTMLElement;
  readonly state: TacticsState;
  readonly cursor: { x: number; y: number };
  /** 키 하나를 처리한다(테스트·자동화가 DOM 없이도 부른다). */
  press(key: string): void;
  destroy(): void;
}

/** 오버레이를 만들어 host 에 붙이고, 결과가 나면 onEnd 를 한 번 부른다. */
export function mountTacticsBattle(
  host: HTMLElement,
  state: TacticsState,
  onEnd: (result: "victory" | "defeat") => void,
): TacticsController {
  const cursor = { x: 0, y: 0 };
  const first = state.units.find((unit) => unit.side === "party" && unit.hp > 0);
  if (first) { cursor.x = first.x; cursor.y = first.y; }
  let phase: Phase = { kind: "select" };
  let ended = false;

  const root = el("section", {
    class: "runtime-overlay runtime-tactics-overlay",
    dataset: { testid: TACTICS_OVERLAY_TESTID },
    attrs: { role: "application", "aria-label": "전술 전투", tabindex: "0" },
  });
  const status = el("div", { class: "runtime-tactics-status", dataset: { testid: "tactics-status" }, attrs: { "aria-live": "polite" } });
  const grid = el("div", { class: "runtime-tactics-grid", dataset: { testid: "tactics-grid" }, attrs: { role: "grid" } });
  grid.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
  const log = el("div", { class: "runtime-tactics-log", dataset: { testid: "tactics-log" } });
  const help = el("div", { class: "runtime-tactics-help", text: "방향키 이동 · 결정: 고르기/이동/공격 · 제자리 결정: 대기 · 취소: 되돌리기" });
  root.append(el("div", { class: "runtime-tactics-window", children: [status, grid, log, help] }));
  host.querySelector(`[data-testid='${TACTICS_OVERLAY_TESTID}']`)?.remove();
  host.append(root);

  const unitById = (id: string): TacticsUnit | undefined => state.units.find((unit) => unit.id === id);

  function render(): void {
    const selected = phase.kind === "select" ? undefined : unitById(phase.unitId);
    const reach = phase.kind === "move" && selected ? reachableTiles(state, selected) : [];
    const foes = phase.kind === "target" && selected ? adjacentFoes(state, selected) : [];
    grid.replaceChildren();
    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const unit = unitAt(state, x, y);
        const cell = el("div", {
          class: "runtime-tactics-cell",
          dataset: { testid: `tactics-cell-${x}-${y}` },
          attrs: { role: "gridcell" },
        });
        if (reach.some((tile) => tile.x === x && tile.y === y)) cell.classList.add("is-reach");
        if (foes.some((foe) => foe.x === x && foe.y === y)) cell.classList.add("is-target");
        if (cursor.x === x && cursor.y === y) { cell.classList.add("is-cursor"); cell.setAttribute("aria-selected", "true"); }
        if (unit) {
          cell.classList.add(unit.side === "party" ? "is-party" : "is-enemy");
          if (unit.acted) cell.classList.add("is-done");
          cell.dataset.unit = unit.id;
          cell.append(
            el("span", { class: "runtime-tactics-name", text: unit.name }),
            el("span", { class: "runtime-tactics-hp", text: `${unit.hp}/${unit.maxHp}` }),
          );
          cell.setAttribute("aria-label", `${unit.side === "party" ? "아군" : "적"} ${unit.name} HP ${unit.hp}`);
        }
        grid.append(cell);
      }
    }
    const turnText = state.result
      ? state.result === "victory" ? "승리" : "패배"
      : `${state.round}턴 · ${state.turn === "party" ? "아군 차례" : "적 차례"}`;
    const phaseText = phase.kind === "move" ? " · 이동할 칸" : phase.kind === "target" ? " · 공격할 적(제자리 결정 = 대기)" : "";
    status.textContent = turnText + (state.result ? "" : phaseText);
    root.dataset.turn = state.turn;
    root.dataset.phase = phase.kind;
    if (state.result) root.dataset.result = state.result;
    log.textContent = state.log.slice(-3).join("\n");
  }

  function finishIfOver(): boolean {
    if (!state.result || ended) return ended;
    ended = true;
    render();
    onEnd(state.result);
    return true;
  }

  function afterPartyAction(): void {
    phase = { kind: "select" };
    if (finishIfOver()) return;
    if (state.turn === "enemy") {
      runEnemyTurn(state);
      if (finishIfOver()) return;
    }
    const next = state.units.find((unit) => unit.side === "party" && unit.hp > 0 && !unit.acted);
    if (next) { cursor.x = next.x; cursor.y = next.y; }
  }

  function confirm(): void {
    if (state.result || state.turn !== "party") return;
    if (phase.kind === "select") {
      const unit = unitAt(state, cursor.x, cursor.y);
      if (unit && unit.side === "party" && !unit.acted) phase = unit.moved ? { kind: "target", unitId: unit.id } : { kind: "move", unitId: unit.id };
      return;
    }
    const unit = unitById(phase.unitId);
    if (!unit) { phase = { kind: "select" }; return; }
    if (phase.kind === "move") {
      if (cursor.x === unit.x && cursor.y === unit.y) { unit.moved = true; phase = { kind: "target", unitId: unit.id }; return; }
      if (tacticsMove(state, unit.id, cursor.x, cursor.y)) phase = { kind: "target", unitId: unit.id };
      return;
    }
    const target = unitAt(state, cursor.x, cursor.y);
    if (target && target.side === "enemy" && tacticsAttack(state, unit.id, target.id) !== undefined) { afterPartyAction(); return; }
    if (cursor.x === unit.x && cursor.y === unit.y && tacticsWait(state, unit.id)) afterPartyAction();
  }

  function press(key: string): void {
    if (ended) return;
    const dir = directionForKey(key);
    if (dir) {
      if (dir === "left") cursor.x = Math.max(0, cursor.x - 1);
      if (dir === "right") cursor.x = Math.min(state.width - 1, cursor.x + 1);
      if (dir === "up") cursor.y = Math.max(0, cursor.y - 1);
      if (dir === "down") cursor.y = Math.min(state.height - 1, cursor.y + 1);
    } else if (isConfirmKey(key)) {
      confirm();
    } else if (isCancelKey(key)) {
      if (phase.kind !== "select") {
        const unit = unitById(phase.unitId);
        if (unit) { cursor.x = unit.x; cursor.y = unit.y; }
        phase = { kind: "select" };
      }
    } else {
      return;
    }
    if (!ended) render();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!root.isConnected || event.repeat && !directionForKey(event.key)) return;
    if (!directionForKey(event.key) && !isConfirmKey(event.key) && !isCancelKey(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    press(event.key);
  };
  // 전역 필드 핸들러보다 먼저 받는다(캡처) — 방향키가 맵 위 주인공을 움직이지 않게.
  window.addEventListener("keydown", onKeyDown, true);

  render();
  if (state.result) queueMicrotask(() => finishIfOver());
  root.focus?.();
  return {
    root,
    state,
    cursor,
    press,
    destroy(): void {
      window.removeEventListener("keydown", onKeyDown, true);
      root.remove();
    },
  };
}
