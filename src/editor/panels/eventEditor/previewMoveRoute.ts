import { el } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { drawTransferMapPreview } from "./transferMapPreview";
import type { Command, Dir, GameMap, MoveCommand } from "@/project/types";

type Pt = { x: number; y: number };
const SVG_NS = "http://www.w3.org/2000/svg";

// 이동 경로 설정(moveEvent) 프리뷰: 대상 카드 + 격자 위 궤적선 + 이동명령 테이프 + 옵션 배지.
// [P2] 편집 중인 이벤트를 특정할 수 있으면 실제 맵 캔버스 위에 경로 화살표 오버레이도 그린다.
export function previewMoveRoute(cmd: Extract<Command, { kind: "moveEvent" }>): HTMLElement {
  const root = el("div", { class: "ecp-move", dataset: { testid: "ecp-move-preview" } });
  root.append(
    el("div", {
      class: "ecp-move-target",
      children: [
        el("span", { class: "ecp-move-target-label", text: "누구에게" }),
        el("span", { class: "ecp-move-target-name", text: targetName(cmd.eventId) }),
      ],
    })
  );
  const points = tracePath(cmd.route.moves);
  // 빈 경로도 시작점 격자를 그려 "미리보기 불가"처럼 보이지 않게 한다.
  if (svgSupported()) {
    root.append(renderTrajectory(points));
  } else {
    root.append(el("div", {
      class: "ecp-move-nogrid",
      text: points.length >= 2 ? "이동 궤적" : "시작점 (명령 추가 시 궤적 표시)",
    }));
  }
  const mapOverlay = points.length >= 2 ? renderMapTrajectoryOverlay(cmd, points) : null;
  if (mapOverlay) root.append(mapOverlay);
  root.append(renderTape(cmd.route.moves));
  const badges = el("div", { class: "ecp-move-badges" });
  if (cmd.route.repeat) badges.append(badge("반복"));
  if (cmd.route.wait) badges.append(badge("완료까지 대기"));
  if (cmd.route.skippable) badges.append(badge("불가 시 건너뜀"));
  if (badges.childNodes.length > 0) root.append(badges);
  return root;
}

// [P2] 실제 맵 크롭 위 경로 오버레이. 편집 중 이벤트(모달 dataset 우선, editorState 폴백)의
// 위치에서 시작하는 절대 궤적을 폴리라인 + 종점 화살촉으로 그린다.
function renderMapTrajectoryOverlay(
  cmd: Extract<Command, { kind: "moveEvent" }>,
  points: readonly Pt[]
): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("canvas");
  if (typeof probe.getContext !== "function") return null;
  const context = editingEventContext(cmd.eventId);
  if (!context) return null;
  const { map, mapId, eventX, eventY } = context;
  const project = store.getCurrent();
  const zoom = Math.max(0.15, Math.min(2, 220 / Math.max(1, map.width * map.tileSize)));
  const wrap = el("div", { class: "ecp-move-map-overlay", dataset: { testid: "ecp-move-map-overlay" } });
  probe.className = "ecp-move-map-canvas";
  wrap.append(probe);
  wrap.append(el("div", { class: "ecp-map-caption", text: `맵 위 경로 — 시작 (${eventX}, ${eventY})` }));
  drawTransferMapPreview({
    canvas: probe,
    project,
    mapId,
    selection: { x: eventX, y: eventY, zoom },
    isCurrent: () => probe.isConnected,
  })
    .then(() => drawRouteOnMap(probe, map, eventX, eventY, points))
    .catch(() => {
      /* 타일셋 로드 실패 등 — 오버레이 생략 */
    });
  return wrap;
}

function editingEventContext(
  routeEventId: string
): { readonly map: GameMap; readonly mapId: string; readonly eventX: number; readonly eventY: number } | null {
  const project = store.getCurrent();
  const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
  const mapId = modal?.dataset.mapId ?? editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return null;
  const targetEventId =
    routeEventId && routeEventId !== PLAYER_MOVE_TARGET
      ? routeEventId
      : modal?.dataset.eventId ?? editorState.get().selectedEventId ?? "";
  const event = map.events.find((entry) => entry.id === targetEventId);
  if (!event) return null;
  return { map, mapId, eventX: event.x, eventY: event.y };
}

function drawRouteOnMap(canvas: HTMLCanvasElement, map: GameMap, startX: number, startY: number, points: readonly Pt[]): void {
  const context = canvas.getContext("2d");
  if (!context || points.length < 2) return;
  const tile = map.tileSize;
  const centers = points.map((point) => ({
    x: (startX + point.x) * tile + tile / 2,
    y: (startY + point.y) * tile + tile / 2,
  }));
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "rgba(17, 24, 39, 0.85)";
  context.lineWidth = Math.max(3, tile * 0.3);
  strokePolyline(context, centers);
  context.strokeStyle = "#ffd34d";
  context.lineWidth = Math.max(1.5, tile * 0.16);
  strokePolyline(context, centers);
  drawArrowHead(context, centers, Math.max(4, tile * 0.4));
  context.restore();
}

function strokePolyline(context: CanvasRenderingContext2D, centers: readonly Pt[]): void {
  context.beginPath();
  centers.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
}

function drawArrowHead(context: CanvasRenderingContext2D, centers: readonly Pt[], size: number): void {
  const last = centers[centers.length - 1];
  const prev = centers[centers.length - 2];
  if (!last || !prev) return;
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  context.fillStyle = "#ffd34d";
  context.beginPath();
  context.moveTo(last.x, last.y);
  context.lineTo(last.x - size * Math.cos(angle - Math.PI / 6), last.y - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(last.x - size * Math.cos(angle + Math.PI / 6), last.y - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
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
  // 빈/단일 점이어도 최소 3×3 격자를 유지해 시작 위치가 보이게 한다.
  const minX = Math.min(-1, ...xs);
  const maxX = Math.max(1, ...xs);
  const minY = Math.min(-1, ...ys);
  const maxY = Math.max(1, ...ys);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const cell = 18;
  const pad = 12;
  const width = cols * cell + pad * 2;
  const height = rows * cell + pad * 2;
  const cx = (x: number) => pad + (x - minX) * cell + cell / 2;
  const cy = (y: number) => pad + (y - minY) * cell + cell / 2;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "ecp-move-grid" });
  svg.setAttribute("width", String(Math.max(width, 72)));
  svg.setAttribute("height", String(Math.max(height, 72)));
  for (let gx = 0; gx < cols; gx += 1) {
    for (let gy = 0; gy < rows; gy += 1) {
      svg.append(svgEl("circle", {
        cx: String(pad + gx * cell + cell / 2),
        cy: String(pad + gy * cell + cell / 2),
        r: "1.3",
        class: "ecp-grid-dot",
      }));
    }
  }
  if (points.length >= 2) {
    svg.append(svgEl("polyline", {
      points: points.map((p) => `${cx(p.x)},${cy(p.y)}`).join(" "),
      class: "ecp-move-line",
    }));
  }
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
  const caption = points.length >= 2
    ? `궤적 ${points.length - 1}칸`
    : "시작점 · 오른쪽에서 이동 명령을 추가하세요";
  const box = el("div", {
    class: "ecp-move-grid-box",
    dataset: { testid: "ecp-move-grid-box" },
  });
  box.append(svg);
  box.append(el("div", { class: "ecp-move-grid-caption", text: caption }));
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
