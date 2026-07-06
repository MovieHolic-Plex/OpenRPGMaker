import { el } from "@/util/dom";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command, Dir, MoveCommand } from "@/project/types";

type Pt = { x: number; y: number };
const SVG_NS = "http://www.w3.org/2000/svg";

// 이동 경로 설정(moveEvent) 프리뷰: 대상 카드 + 격자 위 궤적선 + 이동명령 테이프 + 옵션 배지.
export function previewMoveRoute(cmd: Extract<Command, { kind: "moveEvent" }>): HTMLElement {
  const root = el("div", { class: "ecp-move", dataset: { testid: "ecp-move-preview" } });
  root.append(
    el("div", {
      class: "ecp-move-target",
      children: [
        el("span", { class: "ecp-move-target-label", text: "대상" }),
        el("span", { class: "ecp-move-target-name", text: targetName(cmd.eventId) }),
      ],
    })
  );
  const points = tracePath(cmd.route.moves);
  if (points.length >= 2 && svgSupported()) {
    root.append(renderTrajectory(points));
  } else {
    root.append(el("div", { class: "ecp-move-nogrid", text: points.length >= 2 ? "이동 궤적" : "이동 궤적 없음 (제자리/상대 이동)" }));
  }
  root.append(renderTape(cmd.route.moves));
  const badges = el("div", { class: "ecp-move-badges" });
  if (cmd.route.repeat) badges.append(badge("반복"));
  if (cmd.route.wait) badges.append(badge("완료까지 대기"));
  if (cmd.route.skippable) badges.append(badge("불가 시 건너뜀"));
  if (badges.childNodes.length > 0) root.append(badges);
  return root;
}

function targetName(eventId: string): string {
  if (eventId === PLAYER_MOVE_TARGET) return "주인공";
  return eventId || "이 이벤트";
}

// 위치 이동 명령만 좌표로 누적(상대/무작위/전진 등 비결정 명령은 궤적에서 제외).
function tracePath(moves: readonly MoveCommand[]): Pt[] {
  const points: Pt[] = [{ x: 0, y: 0 }];
  let cur: Pt = { x: 0, y: 0 };
  for (const move of moves) {
    const next = step(cur, move);
    if (next) {
      cur = next;
      points.push(next);
    }
  }
  return points;
}

function step(cur: Pt, move: MoveCommand): Pt | null {
  switch (move.kind) {
    case "move":
      return applyDir(cur, move.dir);
    case "moveDiagonal":
      return { x: cur.x + (move.horizontal === "right" ? 1 : -1), y: cur.y + (move.vertical === "down" ? 1 : -1) };
    case "jump":
      return { x: cur.x + move.dx, y: cur.y + move.dy };
    default:
      return null;
  }
}

function applyDir(cur: Pt, dir: Dir): Pt {
  switch (dir) {
    case "up":
      return { x: cur.x, y: cur.y - 1 };
    case "down":
      return { x: cur.x, y: cur.y + 1 };
    case "left":
      return { x: cur.x - 1, y: cur.y };
    case "right":
      return { x: cur.x + 1, y: cur.y };
  }
}

function renderTrajectory(points: Pt[]): HTMLElement {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const cell = 18;
  const pad = 12;
  const width = cols * cell + pad * 2;
  const height = rows * cell + pad * 2;
  const cx = (x: number) => pad + (x - minX) * cell + cell / 2;
  const cy = (y: number) => pad + (y - minY) * cell + cell / 2;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "ecp-move-grid" });
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  for (let gx = 0; gx < cols; gx += 1) {
    for (let gy = 0; gy < rows; gy += 1) {
      svg.append(svgEl("circle", { cx: String(pad + gx * cell + cell / 2), cy: String(pad + gy * cell + cell / 2), r: "1.3", class: "ecp-grid-dot" }));
    }
  }
  svg.append(svgEl("polyline", { points: points.map((p) => `${cx(p.x)},${cy(p.y)}`).join(" "), class: "ecp-move-line" }));
  points.forEach((p, index) => {
    svg.append(
      svgEl("circle", {
        cx: String(cx(p.x)),
        cy: String(cy(p.y)),
        r: index === 0 ? "5" : "3.5",
        class: index === 0 ? "ecp-move-start" : "ecp-move-step",
      })
    );
  });
  const box = el("div", { class: "ecp-move-grid-box" });
  box.append(svg);
  return box;
}

function renderTape(moves: readonly MoveCommand[]): HTMLElement {
  const tape = el("div", { class: "ecp-move-tape", dataset: { testid: "ecp-move-tape" } });
  if (moves.length === 0) {
    tape.append(el("span", { class: "ecp-move-chip empty", text: "이동 명령 없음" }));
    return tape;
  }
  for (const move of moves) tape.append(el("span", { class: "ecp-move-chip", text: chipLabel(move) }));
  return tape;
}

function chipLabel(move: MoveCommand): string {
  switch (move.kind) {
    case "move":
      return dirArrow(move.dir);
    case "moveDiagonal":
      return diagArrow(move.horizontal, move.vertical);
    case "moveRandom":
      return "랜덤";
    case "moveTowardPlayer":
      return "접근";
    case "moveAwayFromPlayer":
      return "회피";
    case "stepForward":
      return "전진";
    case "jump":
      return `점프(${move.dx},${move.dy})`;
    case "land":
      return "착지";
    case "turn":
      return `↻${dirArrow(move.dir)}`;
    case "turnRelative":
      return turnRelLabel(move.turn);
    case "turnRandom":
      return "↻무작위";
    case "turnTowardPlayer":
      return "↻접근";
    case "turnAwayFromPlayer":
      return "↻회피";
    case "setDirectionFix":
      return `방향고정 ${onOff(move.enabled)}`;
    case "setThrough":
      return `통과 ${onOff(move.enabled)}`;
    case "setAnimation":
      return `애니 ${onOff(move.enabled)}`;
    case "changeOpacity":
      return `투명도 ${signed(move.delta)}`;
    case "setSwitch":
      return `스위치 ${move.value ? "ON" : "OFF"}`;
    case "changeSpeed":
      return `속도 ${signed(move.delta)}`;
    case "changeFrequency":
      return `빈도 ${signed(move.delta)}`;
    case "changeGraphic":
      return "그래픽";
    case "npcTransfer":
      return "순간이동";
    case "playSe":
      return "효과음";
    case "wait":
      return "대기";
  }
}

function dirArrow(dir: Dir): string {
  switch (dir) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "left":
      return "←";
    case "right":
      return "→";
  }
}

function diagArrow(horizontal: "left" | "right", vertical: "up" | "down"): string {
  if (vertical === "up") return horizontal === "left" ? "↖" : "↗";
  return horizontal === "left" ? "↙" : "↘";
}

function turnRelLabel(turn: "right90" | "left90" | "turn180" | "leftOrRight90"): string {
  switch (turn) {
    case "right90":
      return "↻우90";
    case "left90":
      return "↻좌90";
    case "turn180":
      return "↻180";
    case "leftOrRight90":
      return "↻좌우90";
  }
}

function onOff(enabled: boolean): string {
  return enabled ? "ON" : "OFF";
}

function signed(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}

function badge(text: string): HTMLElement {
  return el("span", { class: "ecp-move-badge", text });
}

// SVG 궤적은 createElementNS 가 있는 환경(실제 브라우저)에서만. 노드 환경(fakeDom 테스트)은
// 테이프/뱃지로 폴백한다.
function svgSupported(): boolean {
  return typeof document !== "undefined" && typeof document.createElementNS === "function";
}

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
