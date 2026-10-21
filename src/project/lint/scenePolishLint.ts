// project/lint/scenePolishLint.ts
// 장면 다듬기 검사 — 세 데모(「첫사랑」·Fallen Star·Astra Horizon)를 사람이 손으로 고친 결함 중 기계로 잡히는 것.
// 규칙과 이유의 정본은 assistant-skills/game-scene-polish/SKILL.md (조수는 read_assistant_skill 로 읽는다).
// 순수 함수. 전부 warning — 커밋을 막지 않는다. run_lint 는 전체를, 쓰기 도구는 «이번 변경이 새로 만든» 것만 받는다(newScenePolishIssues).
//
//  - scene-transfer-off-door       문형 이동 이벤트가 문·계단 그림 칸도, 맵 가장자리도, 자기 그림도 아니다(건물 정면 앞 보도 칸 포함)
//  - scene-transfer-pair           착지 칸이 돌아오는 문 앞(체비쇼프 1칸 안)이 아니다 / 착지 방향이 문을 향한다
//  - scene-transfer-facing         transfer 에 도착 방향이 없다
//  - scene-stair-direction         내려가는 계단 그림이 위층으로(또는 반대로) 이어진다
//  - scene-npc-vanish              NPC 가 출구까지 걷지 않고 제자리에서 사라진다(Erase Event·투명 «떠남» 페이지·경로 속 불투명도 0)
//  - scene-dialogue-position-mixed 대사 위치(top·center·bottom·auto)가 한 게임 안에서 섞였다
//  - scene-dialogue-position-jump  이어지는 두 대사(사이에 창을 닫는 명령 없이)가 서로 다른 자리를 못박아 창이 위↔아래로 뛴다
//  - scene-dialogue-context-mixed  sign·system·letter 밖의 특수 대화창 모양을 둘 이상 섞거나 말풍선을 쓴다
//  - scene-map-no-bgm              이야기가 들르는 맵에 BGM 이 없다(명시 «없음» 은 의도로 본다)
//  - scene-moving-vehicle          움직이는 교통(map.transit)·움직이는 탈것 이벤트
//  - scene-actors-stacked          한 페이지가 두 인물을 같은 칸에 세운다
//  - scene-hang-on-floor           벽 걸이(액자·별자리표·시계…) 키트가 바닥 칸에 서 있다
//  - scene-ceiling-tile            천장 구역(방 밖·벽면도 벽 윗면도 아닌 칸)에 천장이 아닌 칸이 있다 — 바닥·소품이 얹혔거나, 방 밖에 고립 통행 바닥이 깔렸다

import { nestedCommandLists } from "../authoredCommandIndex";
import type { Command, Dir, EventPage, GameEvent, GameMap, MoveCommand, Project, TilesetDef } from "../types";
import { isPassable } from "../collision";
import handInteriorSpec from "@/assets/handInteriorSpec.json";
import type { LintIssue } from "./projectLint";

type Cell = { x: number; y: number };

const DOOR_WORDS = /(?<![창주])문(?![양자서장제구화턱])|door|입구|출입|출구|현관|계단|stair|엘리베이터|승강기|에스컬레이터|escalator|elevator|lift|사다리|ladder|개찰|portal|포털|게이트|gate|구멍|hole|셔터|맨홀|manhole|동굴 입/iu;
const STAIR_DOWN = /내려가|아래로|하강|down|下り|구멍|hole/iu;
const STAIR_UP = /올라가|위로|상승|\bup\b|上り/iu;
const VEHICLE_WORDS = /자동차|승용차|택시|버스|트럭|오토바이|스쿠터|자전거|전차|열차|기차|\bcar\b|taxi|\bbus\b|truck|motorbike|motorcycle|scooter|bicycle|\bbike\b|train|tram/iu;
/** 문형 이동 페이지에 같이 있어도 되는 명령(소리·기다림·화면 효과·스위치). 대사·선택지가 있으면 이야기 장면 전환이다. */
const DOOR_PAGE_EXTRA: ReadonlySet<Command["kind"]> = new Set(["transfer", "playAudio", "stopAudio", "wait", "m2Command", "setSwitch", "setSelfSwitch", "setVariable"]);
const SPECIAL_CONTEXT_OK: ReadonlySet<string> = new Set(["sign", "system", "letter"]);

// ---------------------------------------------------------------------------- 공용

function* walk(commands: readonly Command[] | undefined): Generator<Command> {
  for (const command of commands ?? []) {
    if (!command || typeof command !== "object") continue;
    yield command;
    for (const branch of nestedCommandLists(command)) yield* walk(branch);
  }
}

function pagesOf(event: GameEvent): readonly EventPage[] {
  return event.pages ?? [];
}

function visibleGraphic(page: EventPage | undefined): boolean {
  const g = page?.graphic;
  if (!g || g.transparent) return false;
  return Boolean(g.sprite || g.appearanceId);
}

function onEdge(map: GameMap, x: number, y: number): boolean {
  return x <= 0 || y <= 0 || x >= map.width - 1 || y >= map.height - 1;
}

/**
 * 가장자리 출구: 맨 끝 칸이거나, 끝에서 2칸 안이고 끝까지 걸을 수 있는 칸이 곧게 이어진다
 * (필드 길 출구는 보통 끝에서 한두 칸 안쪽에 둔다 — Astra 숲·초원). 작은 실내의 벽 앞 칸은 아니다.
 */
function isEdgeExit(project: Project, map: GameMap, x: number, y: number): boolean {
  if (onEdge(map, x, y)) return true;
  for (const d of Object.values(STEP)) {
    let cx = x, cy = y;
    for (let i = 0; i < 2; i++) {
      cx += d.x; cy += d.y;
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height || !isPassable(project, map, cx, cy)) break;
      if (onEdge(map, cx, cy)) return true;
    }
  }
  return false;
}

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const STEP: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function dirFromTo(from: Cell, to: Cell): Dir | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  return dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
}

function m2Title(command: Command): string {
  if (command.kind !== "m2Command") return "";
  const id = command.commandId;
  if (id === "m2-086-erase-event") return "Erase Event";
  if (id === "m2-040-set-event-location") return "Set Event Location";
  return typeof (command as { title?: unknown }).title === "string" ? String((command as { title?: unknown }).title) : "";
}

function fieldStr(command: Command, key: string): string {
  if (command.kind !== "m2Command") return "";
  const v = (command.fields as Record<string, unknown> | undefined)?.[key];
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function fieldNum(command: Command, key: string): number | null {
  if (command.kind !== "m2Command") return null;
  const v = Number((command.fields as Record<string, unknown> | undefined)?.[key]);
  return Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------- 문·계단 타일

type TileMetaLike = { label?: string; tags?: readonly string[]; description?: string };
type DoorSets = { door: Set<number>; down: Set<number>; up: Set<number> };
/** 쓰기 도구마다 초안이 타일셋을 복제하므로 객체가 아니라 id·크기로 기억한다(이름표·키트가 바뀌면 크기도 바뀐다). */
const doorTileCache = new Map<string, DoorSets>();

function doorCacheKey(tileset: TilesetDef): string {
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  const metaSize = Array.isArray(meta) ? meta.length : meta && typeof meta === "object" ? Object.keys(meta).length : 0;
  const kits = (tileset as { structureKits?: readonly unknown[] }).structureKits?.length ?? 0;
  return `${tileset.id}|${metaSize}|${kits}`;
}

function metaAt(tileset: TilesetDef, tile: number): TileMetaLike | undefined {
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  if (!meta) return undefined;
  if (Array.isArray(meta)) return meta[tile] as TileMetaLike | undefined;
  return (meta as Record<string, TileMetaLike>)[String(tile)];
}

/** 이 타일셋에서 문·계단·출구로 읽히는 칸 번호. 이름표 낱말 + 건물 키트의 entrance 부품 칸. */
function doorTiles(tileset: TilesetDef | undefined): DoorSets {
  const empty = { door: new Set<number>(), down: new Set<number>(), up: new Set<number>() };
  if (!tileset) return empty;
  const key = doorCacheKey(tileset);
  const cached = doorTileCache.get(key);
  if (cached) return cached;
  const out = { door: new Set<number>(), down: new Set<number>(), up: new Set<number>() };
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  const entries: Array<[number, TileMetaLike]> = Array.isArray(meta)
    ? meta.map((m, i) => [i, m as TileMetaLike])
    : meta && typeof meta === "object" ? Object.entries(meta as Record<string, TileMetaLike>).map(([k, m]) => [Number(k), m]) : [];
  for (const [tile, m] of entries) {
    if (!m || typeof m !== "object") continue;
    const text = `${m.label ?? ""} ${(m.tags ?? []).join(" ")}`;
    if (!DOOR_WORDS.test(text)) continue;
    out.door.add(tile);
    if (/계단|stair|escalator|에스컬레이터|구멍|hole|사다리|ladder/iu.test(text)) {
      if (STAIR_DOWN.test(m.label ?? "")) out.down.add(tile);
      else if (STAIR_UP.test(m.label ?? "")) out.up.add(tile);
    }
  }
  for (const raw of (tileset as { structureKits?: readonly unknown[] }).structureKits ?? []) {
    const kit = raw as { rows?: Array<{ tiles?: number[]; upperTiles?: number[] }>; parts?: Array<{ kind?: string; dx?: number; dy?: number; w?: number; h?: number }> };
    for (const part of kit.parts ?? []) {
      if (part?.kind !== "entrance" || typeof part.dx !== "number" || typeof part.dy !== "number") continue;
      for (let y = part.dy; y < part.dy + (part.h ?? 1); y++) {
        for (let x = part.dx; x < part.dx + (part.w ?? 1); x++) {
          const row = kit.rows?.[y];
          for (const t of [row?.tiles?.[x], row?.upperTiles?.[x]]) {
            if (typeof t !== "number" || t < 0) continue;
            // 키트 문 부품 칸이라도 풀밭·포석 같은 바닥 타일은 문 그림이 아니다(다른 곳에도 깔린다).
            const m = metaAt(tileset, t) as (TileMetaLike & { role?: string; passage?: string }) | undefined;
            if (m && (m.role === "terrain" || m.role === "empty" || (m.passage && m.passage !== "solid" && m.role !== "building" && m.role !== "prop"))) continue;
            out.door.add(t);
          }
        }
      }
    }
  }
  if (doorTileCache.size > 64) doorTileCache.clear();
  doorTileCache.set(key, out);
  return out;
}

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;

function tilesAt(map: GameMap, x: number, y: number): number[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const i = y * map.width + x;
  const out: number[] = [];
  for (const key of LAYERS) {
    const arr = (map as unknown as Record<string, unknown>)[key];
    if (Array.isArray(arr)) { const t = arr[i]; if (typeof t === "number" && t >= 0) out.push(t); }
  }
  return out;
}

function cellIs(project: Project, map: GameMap, x: number, y: number, kind: "door" | "down" | "up"): boolean {
  const set = doorTiles(project.tilesets[map.tilesetId])[kind];
  return set.size > 0 && tilesAt(map, x, y).some((t) => set.has(t));
}

/** 문·계단·엘리베이터 그림 칸인가(이름표 낱말 + 건물 키트 entrance 부품). create_transfer_pair 가 트리거를 문 칸에 둘 때 쓴다. */
export function isDoorArtCell(project: Project, map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height && cellIs(project, map, x, y, "door");
}

// ---------------------------------------------------------------------------- 이동(transfer)

interface Gate {
  readonly map: GameMap;
  readonly event: GameEvent;
  readonly page: EventPage;
  readonly transfer: Extract<Command, { kind: "transfer" }>;
  /** 플레이어가 걸어 들어가 발동하는 문형(밟기·조사 + 이동만). 이야기 장면 전환은 false. */
  readonly doorLike: boolean;
}

function collectGates(project: Project): Gate[] {
  const gates: Gate[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const page of pagesOf(event)) {
        const top = page.commands ?? [];
        const transfer = top.find((c): c is Extract<Command, { kind: "transfer" }> => c?.kind === "transfer");
        if (!transfer) continue;
        const trig = page.trigger?.kind;
        const doorLike = (trig === "playerTouch" || trig === "eventTouch" || trig === "action")
          && top.every((c) => DOOR_PAGE_EXTRA.has(c.kind));
        gates.push({ map, event, page, transfer, doorLike });
      }
    }
  }
  return gates;
}

function mapFloor(map: GameMap | undefined): number | null {
  const name = `${map?.name ?? ""} ${map?.id ?? ""}`;
  if (/옥상|rooftop|\broof\b/iu.test(name)) return 1000;
  const under = name.match(/지하\s*(\d+)?|\bB(\d)\b|basement/iu);
  if (under) return -Number(under[1] ?? under[2] ?? 1);
  const floor = name.match(/(\d+)\s*(?:층|F\b|f\b)/u);
  return floor ? Number(floor[1]) : null;
}

function checkTransfers(project: Project, issues: LintIssue[], gates: readonly Gate[]): void {
  const seenFacing = new Set<string>();
  for (const gate of gates) {
    const { map, event, transfer } = gate;
    const where = `${map.id} ${event.id}(${event.x},${event.y})`;
    if (!transfer.direction && !seenFacing.has(`${map.id}|${event.id}`)) {
      seenFacing.add(`${map.id}|${event.id}`);
      issues.push({
        severity: "warning", code: "scene-transfer-facing", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
        message: `이동 ${where} → ${transfer.mapId}(${transfer.x},${transfer.y}) 에 도착 방향이 없다 — 문을 등지는 쪽을 direction 으로 준다(문이 착지 칸 위면 "down", 아래면 "up").`,
      });
    }
    if (!gate.doorLike) continue;

    // 1) 트리거 자리: 문·계단 그림 칸, 맵 가장자리, 자기 그림이 있는 문 이벤트.
    const onDoor = cellIs(project, map, event.x, event.y, "door");
    const ownArt = visibleGraphic(gate.page);
    const near = onDoor || ownArt || onEdge(map, event.x, event.y) ? undefined : (Object.values(STEP) as Cell[])
      .map((d) => ({ x: event.x + d.x, y: event.y + d.y }))
      .find((c) => cellIs(project, map, c.x, c.y, "door"));
    if (near) {
      // 문 그림이 바로 옆인데 트리거가 바닥 칸이다 — 가장자리 근처여도 «문 앞 보도에서 들어감» 이다.
      issues.push({
        severity: "warning", code: "scene-transfer-off-door", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
        message: `이동 ${where} 가 문 그림 칸 옆(${near.x},${near.y})의 바닥에서 발동한다 — 건물 앞 보도·문 앞 칸을 밟자마자 들어가 보인다. 트리거를 문 칸 (${near.x},${near.y}) 으로 옮기고(막힌 칸이면 priority:"same" 부딪힘 발동), 바깥 착지는 그 문 바로 앞 칸으로.`,
      });
    } else if (!onDoor && !ownArt && !isEdgeExit(project, map, event.x, event.y)) {
      issues.push({
        severity: "warning", code: "scene-transfer-off-door", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
        message: `이동 ${where} 가 문·계단·엘리베이터 그림도 맵 가장자리도 아닌 맨바닥에 있다 — 문 그림(place_door)이나 계단을 그 칸에 두거나, 출구를 가장자리 길 끝으로 옮긴다.`,
      });
    }

    // 2) 계단 방향.
    const target = project.maps[transfer.mapId];
    const from = mapFloor(map), to = mapFloor(target);
    if (from !== null && to !== null && from !== to) {
      const goingUp = to > from;
      const wrong = goingUp ? cellIs(project, map, event.x, event.y, "down") && !cellIs(project, map, event.x, event.y, "up")
        : cellIs(project, map, event.x, event.y, "up") && !cellIs(project, map, event.x, event.y, "down");
      if (wrong) {
        issues.push({
          severity: "warning", code: "scene-stair-direction", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
          message: `계단 ${where} 의 그림은 ${goingUp ? "내려가는" : "올라가는"} 계단인데 ${target?.name ?? transfer.mapId}(${goingUp ? "위층" : "아래층"})로 이어진다 — 칸 이름표를 읽고 ${goingUp ? "올라가는" : "내려가는"} 계단 그림으로 바꾼다.`,
        });
      }
    }

    // 3) 왕복 짝: 착지 칸이 돌아오는 문 앞인가, 문을 등지는가.
    if (!target) continue;
    const returns = gates.filter((g) => g.doorLike && g.map.id === target.id && g.transfer.mapId === map.id);
    if (returns.length === 0) continue;
    const landing = { x: transfer.x, y: transfer.y };
    const nearest = returns.reduce((best, g) => (chebyshev(g.event, landing) < chebyshev(best.event, landing) ? g : best));
    const d = chebyshev(nearest.event, landing);
    if (d > 1) {
      issues.push({
        severity: "warning", code: "scene-transfer-pair", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
        message: `이동 ${where} 의 착지 ${target.id}(${landing.x},${landing.y}) 가 돌아오는 문 ${nearest.event.id}(${nearest.event.x},${nearest.event.y}) 에서 ${d}칸 떨어져 있다 — 착지는 그 문 바로 앞 칸이어야 한다(create_transfer_pair 로 짝을 다시 짓거나 좌표를 고친다).`,
      });
    } else if (transfer.direction) {
      const away = dirFromTo(nearest.event, landing);
      if (away && transfer.direction !== away) {
        issues.push({
          severity: "warning", code: "scene-transfer-pair", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
          message: `이동 ${where} 의 도착 방향 "${transfer.direction}" 이 문을 등지지 않는다 — 돌아오는 문 (${nearest.event.x},${nearest.event.y}) 에서 착지 칸으로 향하는 "${away}" 로 바꾼다.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------- NPC 퇴장

function simulateRoute(start: Cell, moves: readonly MoveCommand[] | undefined, map: GameMap): { end: Cell; fades: boolean } {
  let cur = { ...start };
  let fades = false;
  for (const m of moves ?? []) {
    if (!m || typeof m !== "object") continue;
    if (m.kind === "move") cur = { x: cur.x + STEP[m.dir].x, y: cur.y + STEP[m.dir].y };
    else if (m.kind === "moveDiagonal") cur = { x: cur.x + (m.horizontal === "left" ? -1 : 1), y: cur.y + (m.vertical === "up" ? -1 : 1) };
    else if (m.kind === "jump") cur = { x: cur.x + (m.dx || 0), y: cur.y + (m.dy || 0) };
    else if (m.kind === "changeOpacity" && m.delta <= -200) fades = true;
    else if (m.kind === "npcTransfer") return { end: cur, fades: true };
  }
  cur = { x: Math.max(0, Math.min(map.width - 1, cur.x)), y: Math.max(0, Math.min(map.height - 1, cur.y)) };
  return { end: cur, fades };
}

function exitCells(project: Project, map: GameMap, gates: readonly Gate[]): (c: Cell) => boolean {
  const mapGates = gates.filter((g) => g.map.id === map.id).map((g) => ({ x: g.event.x, y: g.event.y }));
  return (c) => isEdgeExit(project, map, c.x, c.y)
    || mapGates.some((g) => chebyshev(g, c) <= 1)
    || [c, ...Object.values(STEP).map((d) => ({ x: c.x + d.x, y: c.y + d.y }))].some((n) => cellIs(project, map, n.x, n.y, "door"));
}

/** 이 이벤트를 가리키는 moveEvent 인가(""=자기 자신은 호스트 이벤트일 때). */
function routeTarget(command: Command, host: GameEvent | undefined): string | null {
  if (command.kind !== "moveEvent") return null;
  const id = command.eventId?.trim?.() ?? "";
  if (id === "@player") return null;
  return id === "" ? host?.id ?? null : id;
}

/**
 * 스위치를 켜면 사라지는 인물(스위치 id → 이벤트 id). 두 꼴:
 *  ① 첫 페이지가 보이고, 뒤 페이지 중 그 스위치 조건의 투명 «떠남» 페이지가 있다(strict 면 명령 없는 페이지만).
 *  ② 보이는 페이지 모두가 «스위치 S 꺼짐» 조건 — S 를 켜면 맞는 페이지가 없어 사라진다.
 */
function switchesThatHide(map: GameMap, strict: boolean): Map<string, GameEvent[]> {
  const out = new Map<string, GameEvent[]>();
  const add = (id: string, npc: GameEvent): void => { const list = out.get(id) ?? []; if (!list.includes(npc)) list.push(npc); out.set(id, list); };
  for (const npc of map.events ?? []) {
    const pages = pagesOf(npc);
    if (!visibleGraphic(pages[0])) continue;
    for (const p of pages.slice(1)) {
      if (visibleGraphic(p) || (strict && (p.commands ?? []).length > 0)) continue;
      for (const c of p.conditions ?? []) if (c.kind === "switch" && (c as { value?: boolean }).value !== false) add(c.switchId, npc);
    }
    const shown = pages.filter((p) => visibleGraphic(p));
    const offSwitches = (p: EventPage): string[] => (p.conditions ?? []).filter((c) => c.kind === "switch" && (c as { value?: boolean }).value === false).map((c) => (c as { switchId: string }).switchId);
    for (const id of offSwitches(shown[0]!)) if (shown.every((p) => offSwitches(p).includes(id))) add(id, npc);
  }
  return out;
}

function checkNpcVanish(project: Project, issues: LintIssue[], gates: readonly Gate[]): void {
  for (const map of Object.values(project.maps)) {
    const isExit = exitCells(project, map, gates);
    const byId = new Map((map.events ?? []).map((e) => [e.id, e] as const));
    const routedToExit = new Set<string>();
    const reported = new Set<string>();
    const report = (event: GameEvent, why: string): void => {
      if (reported.has(event.id)) return;
      reported.add(event.id);
      issues.push({
        severity: "warning", code: "scene-npc-vanish", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
        message: `NPC ${event.name || event.id}(${map.id}) 가 ${why} — moveEvent 경로로 문·계단·가장자리 출구 앞까지 걸어가 그쪽을 본 뒤 지운다(경로 끝에서 스위치를 켜 빈 페이지로). 화면이 검을 때 사라지는 것은 괜찮다.`,
      });
    };
    // 1) 경로 끝이 출구인 NPC 를 모은다. 경로 안에서 불투명도 0 이면 그 자리에서 사라지는 것이다.
    const lists: Array<{ host: GameEvent; commands: readonly Command[] }> = [];
    for (const host of map.events ?? []) for (const page of pagesOf(host)) lists.push({ host, commands: page.commands ?? [] });
    for (const { host, commands } of lists) {
      for (const command of walk(commands)) {
        const id = routeTarget(command, host);
        const npc = id ? byId.get(id) : undefined;
        if (!npc || command.kind !== "moveEvent") continue;
        const { end, fades } = simulateRoute(npc, command.route?.moves, map);
        if (isExit(end)) routedToExit.add(npc.id);
        else if (fades) report(npc, `경로 끝 (${end.x},${end.y}) 에서 불투명도를 0 으로 내려 출구가 아닌 자리에서 사라진다`);
      }
    }
    // 2) 지우기(Erase Event)와 «떠남» 스위치를 켜는 자리를 이야기 순서대로 훑는다.
    //    제자리 사라짐으로 치지 않는 때: 화면이 검다 · 동료로 합류했다 · 전투 직후 대사 없이(쓰러진 필드 적).
    const goneSwitch = switchesThatHide(map, true);
    type Stage = { black: boolean; joined: boolean; battle: boolean; talkedSinceBattle: boolean; lastRouteTo: string | null; lastRouteWaits: boolean };
    const excused = (st: Stage): boolean => st.black || st.joined || (st.battle && !st.talkedSinceBattle);
    for (const { host, commands } of lists) {
      const visitList = (list: readonly Command[], inherited: Stage): void => {
        const st: Stage = { ...inherited };
        for (const command of list) {
          if (command.kind === "transfer") return; // 다른 맵으로 넘어가면 이 맵 무대는 끝.
          if (command.kind === "m2Command") {
            const key = `${command.commandId} ${fieldStr(command, "effect")}`;
            if (/fade-?out|hide-screen|m2-044/iu.test(key)) st.black = true;
            if (/fade-?in|show-screen|m2-045/iu.test(key)) st.black = false;
          }
          if ((command.kind === "changeParty" && command.action === "add") || command.kind === "addFollower") st.joined = true;
          if (command.kind === "text" && st.battle) st.talkedSinceBattle = true;
          const target = routeTarget(command, host);
          if (target) { st.lastRouteTo = target; st.lastRouteWaits = command.kind === "moveEvent" && command.route?.wait === true; }
          // 걸어 나가는 경로를 기다리지 않으면 다음 명령(지우기·떠남 스위치)이 걷기 시작과 함께 실행된다(r2 npc-walk-out).
          const leavesWithoutWaiting = (id: string): boolean => st.lastRouteTo === id && routedToExit.has(id) && !st.lastRouteWaits;
          if (command.kind === "setSelfSwitch" && command.value === true) {
            const key = (command as { key?: string }).key;
            const hides = pagesOf(host).some((p) => !visibleGraphic(p) && (p.conditions ?? []).some((c) => c.kind === "selfSwitch" && (c as { key?: string }).key === key && (c as { value?: boolean }).value !== false));
            if (hides && visibleGraphic(pagesOf(host)[0])) {
              if (leavesWithoutWaiting(host.id)) report(host, "출구로 가는 moveEvent 가 route.wait:true 없이 끝나, 걷기 시작하자마자 셀프 스위치가 켜져 투명 페이지로 사라진다 — route 안에 wait:true 를 넣는다");
              else if (!(st.lastRouteTo === host.id && routedToExit.has(host.id)) && !excused(st)) report(host, "셀프 스위치로 투명 페이지가 켜져 제자리에서 사라진다");
            }
          }
          if (m2Title(command) === "Erase Event") {
            const id = fieldStr(command, "eventId") || host.id;
            const npc = byId.get(id);
            if (npc && visibleGraphic(pagesOf(npc)[0]) && leavesWithoutWaiting(id)) {
              report(npc, "출구로 가는 moveEvent 가 route.wait:true 없이 끝나, 걷기 시작하자마자 Erase Event 로 지워진다 — route 안에 wait:true 를 넣는다");
            } else if (npc && visibleGraphic(pagesOf(npc)[0]) && !excused(st) && !(st.lastRouteTo === id && routedToExit.has(id))) {
              report(npc, "Erase Event 로 제자리에서 지워진다");
            }
          }
          if (command.kind === "setSwitch" && command.value === true) {
            for (const npc of goneSwitch.get(command.switchId) ?? []) {
              if (!routedToExit.has(npc.id) && !excused(st)) report(npc, "스위치로 보이는 페이지가 꺼져 방 안에서 사라진다");
            }
          }
          if (command.kind === "battleProcessing") {
            for (const branch of nestedCommandLists(command)) visitList(branch, { ...st, battle: true, talkedSinceBattle: false });
            st.battle = true; st.talkedSinceBattle = false;
            continue;
          }
          for (const branch of nestedCommandLists(command)) visitList(branch, st);
        }
      };
      visitList(commands, { black: false, joined: false, battle: false, talkedSinceBattle: false, lastRouteTo: null, lastRouteWaits: false });
    }
  }
}

// ---------------------------------------------------------------------------- 대화창

function checkDialogue(project: Project, issues: LintIssue[]): void {
  const positions = new Map<string, { count: number; where: string }>();
  const contexts = new Map<string, { count: number; where: string }>();
  const containers = new Map<string, { count: number; where: string }>();
  const bump = (bag: Map<string, { count: number; where: string }>, key: string, where: string): void => {
    const cur = bag.get(key);
    if (cur) cur.count += 1; else bag.set(key, { count: 1, where });
  };
  const scan = (commands: readonly Command[] | undefined, where: string): void => {
    for (const command of walk(commands)) {
      if (command.kind === "displayTextSettings") {
        bump(positions, command.preventObscuringPlayer && command.position === "bottom" ? "auto" : String(command.position), `${where} 문장 표시 설정`);
      }
      if (command.kind !== "text") continue;
      const ctx = command.context?.trim();
      if (ctx && !SPECIAL_CONTEXT_OK.has(ctx)) bump(contexts, ctx, where);
      const container = command.container?.trim();
      if (container && container !== "box") bump(containers, container, where);
      if (command.position && !(ctx && SPECIAL_CONTEXT_OK.has(ctx))) bump(positions, command.position, where);
    }
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of pagesOf(event)) scan(page.commands, `${map.id} ${event.id}`);
  for (const common of project.commonEvents ?? []) scan(common.commands, `공통 이벤트 ${common.id}`);
  const list = (bag: Map<string, { count: number; where: string }>): string => [...bag].map(([k, v]) => `${k} ${v.count}곳(예: ${v.where})`).join(", ");
  if (positions.size > 1) {
    issues.push({
      severity: "warning", code: "scene-dialogue-position-mixed",
      message: `대화창 위치가 섞였다: ${list(positions)} — 창이 위아래로 튄다. 한 위치(보통 bottom)로 맞추고, 시작 장면 첫 대사 전에 displayTextSettings{position:"bottom",preventObscuringPlayer:false} 를 둔다.`,
    });
  }
  if (contexts.size > 1) {
    issues.push({
      severity: "warning", code: "scene-dialogue-context-mixed",
      message: `특수 대화창 모양을 여러 가지 섞어 쓴다: ${list(contexts)} — 한 장면만 다른 테두리·띠가 된다. 창 모양은 하나로, 내레이션은 이름·얼굴 없는 같은 창(또는 narration 하나)으로, 특수 모양은 sign·system·letter 에만.`,
    });
  }
  if (containers.size > 0) {
    issues.push({
      severity: "warning", code: "scene-dialogue-context-mixed",
      message: `말풍선 그릇을 쓴다: ${list(containers)} — 장르가 말풍선을 원하지 않으면 대사는 아래 대화창(container 생략)으로. 감정은 흉상 표정과 대사로.`,
    });
  }
}

/** 대사 사이에 있어도 창이 닫히지 않는 명령 — 이 명령들만 끼면 두 대사는 같은 창 세션이다. */
const DIALOGUE_NEUTRAL: ReadonlySet<Command["kind"]> = new Set(["changeFace", "setSwitch", "setSelfSwitch", "setVariable", "playAudio", "stopAudio", "displayTextSettings", "label"]);

/**
 * 고정 틀(2026-10-22): 런타임은 열린 대화 세션의 창 자리·높이를 지킨다(주인공 가림 피하기도 세션 첫 창에서 한 번만).
 * 그래도 **저자가 줄마다 못박은 자리**는 따른다 — 이어지는 두 줄이 서로 다른 자리(top↔bottom, center)를 적으면 창이 뛴다.
 * 조수가 「이 줄만 위로」를 습관처럼 붙여 대화 도중 창이 오르내린 데모 결함을 잡는다. 이벤트 페이지마다 첫 한 곳만 알린다.
 */
function checkDialoguePositionJump(project: Project, issues: LintIssue[]): void {
  type Pos = "top" | "center" | "bottom" | "auto";
  const lineOf = (command: Command): boolean =>
    command.kind === "text" && !(command.context && SPECIAL_CONTEXT_OK.has(command.context.trim())) && (!command.container || command.container === "box");
  const scanList = (list: readonly Command[] | undefined, start: Pos, report: (from: Pos, to: Pos) => boolean): boolean => {
    let session: Pos = start;
    let previous: Pos | undefined;
    for (const command of list ?? []) {
      if (!command || typeof command !== "object") continue;
      if (command.kind === "displayTextSettings") {
        session = command.preventObscuringPlayer ? "auto" : command.position;
        continue;
      }
      if (lineOf(command) && command.kind === "text") {
        const pos: Pos = command.position && command.position !== "auto" ? command.position : command.position === "auto" ? "auto" : session;
        // auto 는 세션 자리를 물려받는다(대개 bottom). 못박은 top·center 와 auto 사이, 또는 서로 다른 두 못박음만 뛴다고 본다.
        const jumps = previous !== undefined && previous !== pos
          && !((previous === "auto" && pos === "bottom") || (previous === "bottom" && pos === "auto"));
        if (jumps && report(previous!, pos)) return true;
        previous = pos;
        continue;
      }
      if (command.kind === "choices") {
        // 선택지는 바로 앞 대사 상자 자리에 선다 — 자리를 바꾸지 않는다. 가지 안의 첫 줄은 그 자리에서 이어진다.
        for (const option of command.options ?? []) if (scanBranch(option.branch, previous ?? session, session, report)) return true;
        continue;
      }
      if (DIALOGUE_NEUTRAL.has(command.kind)) continue;
      // 창을 닫는 명령(기다림·이동·화면 효과·전투…) — 새 세션이다. 가지는 따로 훑는다.
      previous = undefined;
      for (const branch of nestedCommandLists(command)) if (scanList(branch, session, report)) return true;
    }
    return false;
  };
  const scanBranch = (list: readonly Command[] | undefined, previous: Pos, session: Pos, report: (from: Pos, to: Pos) => boolean): boolean => {
    const first = (list ?? []).find((command) => lineOf(command));
    if (first && first.kind === "text") {
      const pos: Pos = first.position && first.position !== "auto" ? first.position : first.position === "auto" ? "auto" : session;
      const jumps = previous !== pos && !((previous === "auto" && pos === "bottom") || (previous === "bottom" && pos === "auto"));
      if (jumps && report(previous, pos)) return true;
    }
    return scanList(list, session, report);
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const page of pagesOf(event)) {
        scanList(page.commands, "auto", (from, to) => {
          issues.push({
            severity: "warning", code: "scene-dialogue-position-jump", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
            message: `이어지는 대사가 창 자리를 ${from} → ${to} 로 바꾼다 — 대화 도중 창이 뛴다. 엔진은 열린 창의 자리·높이를 지키지만 줄에 못박은 position 은 따른다. 의도가 아니면 그 줄의 position 을 지우고(문장 표시 설정 한 곳으로), 정말 옮길 장면이면 사이에 화면 전환·기다림을 둔다.`,
          });
          return true;
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------- 맵 음악

function playsBgm(commands: readonly Command[] | undefined): boolean {
  for (const command of walk(commands)) {
    if (command.kind === "playAudio" && ((command as { channel?: string }).channel === "bgm" || (command.loop && (command as { channel?: string }).channel === undefined))) return true;
    if (command.kind === "m2Command" && /play-bgm|play-memorized-bgm/u.test(command.commandId)) return true;
  }
  return false;
}

function checkMapBgm(project: Project, issues: LintIssue[], gates: readonly Gate[]): void {
  const visited = new Set<string>();
  if (project.startMapId) visited.add(project.startMapId);
  for (const gate of gates) visited.add(gate.transfer.mapId);
  // 이 맵으로 오는 이동 바로 앞에서 BGM 을 트는 경우(장면 전환 이벤트).
  const bgmBeforeTransfer = new Set<string>();
  const scanArrivals = (commands: readonly Command[] | undefined): void => {
    let played = false;
    for (const command of commands ?? []) {
      if (playsBgm([command])) played = true;
      if (command.kind === "transfer" && played) bgmBeforeTransfer.add(command.mapId);
      for (const branch of nestedCommandLists(command)) scanArrivals(branch);
    }
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of pagesOf(event)) scanArrivals(page.commands);
  for (const id of visited) {
    const map = project.maps[id];
    if (!map) continue;
    const mode = map.bgm?.mode;
    if (mode === "none" || (mode === "custom" && map.bgm?.resourceId)) continue;
    const autoPlays = (map.events ?? []).some((e) => pagesOf(e).some((p) => (p.trigger?.kind === "auto" || p.trigger?.kind === "parallel") && playsBgm(p.commands)));
    if (autoPlays || bgmBeforeTransfer.has(id)) continue;
    issues.push({
      severity: "warning", code: "scene-map-no-bgm", mapId: id,
      message: `맵 ${map.name || id} 에 BGM 이 없다 — 앞 맵 곡이 이어지거나 침묵한다. recommend_bgm 으로 장면에 맞는 곡을 골라 set_map_properties({mapId:"${id}",bgm:{mode:"custom",resourceId}}) 로 정한다. 일부러 조용한 맵이면 bgm.mode "none".`,
    });
  }
}

// ---------------------------------------------------------------------------- 탈것

function checkVehicles(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    const routes = (map.transit?.routes ?? []).filter((r) => r.enabled !== false && (r.vehicles?.length ?? 0) > 0);
    if (routes.length > 0) {
      issues.push({
        severity: "warning", code: "scene-moving-vehicle", mapId: map.id,
        message: `맵 ${map.name || map.id} 에 움직이는 교통 ${routes.length}노선(${routes.map((r) => r.kind).join("·")}) — 조용한 이야기 장면을 깬다. 교통이 장면의 요점이 아니면 set_map_transit 으로 지운다(세워 둔 차는 타일로 충분).`,
      });
    }
    for (const event of map.events ?? []) {
      const page = pagesOf(event)[0];
      if (!page || !VEHICLE_WORDS.test(event.name ?? "")) continue;
      const type = page.movement?.type;
      if (type && type !== "fixed") {
        issues.push({
          severity: "warning", code: "scene-moving-vehicle", mapId: map.id, eventId: event.id, x: event.x, y: event.y,
          message: `탈것 이벤트 ${event.name}(${event.x},${event.y}) 가 움직인다(${type}) — 교통이 요점이 아니면 movement "fixed" 로 세우거나 지운다.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------- 같은 칸에 선 인물

function checkStacking(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    const byId = new Map((map.events ?? []).map((e) => [e.id, e] as const));
    const hiddenBySwitch = switchesThatHide(map, false); // 스위치를 켜면 그 순간 무대에서 내려간다.
    for (const host of map.events ?? []) {
      for (const page of pagesOf(host)) {
        // 명령 순서대로 «지금 보이는» 인물의 칸만 둔다. 같은 출구 칸이라도 앞 인물이 사라진 뒤 도착하면 겹침이 아니다.
        const pos = new Map<string, Cell>();
        let hit: { a: string; b: string; at: Cell } | null = null;
        for (const command of walk(page.commands)) {
          if (command.kind === "transfer") break; // 다른 맵으로 넘어가면 이 맵 무대는 끝.
          let moved: string | null = null;
          if (m2Title(command) === "Erase Event") { pos.delete(fieldStr(command, "eventId") || host.id); continue; }
          if (command.kind === "setSwitch" && command.value === true) {
            for (const npc of hiddenBySwitch.get(command.switchId) ?? []) pos.delete(npc.id);
            continue;
          }
          if (m2Title(command) === "Set Event Location" && (!fieldStr(command, "mapId") || fieldStr(command, "mapId") === map.id)) {
            const id = fieldStr(command, "target") || host.id;
            const x = fieldNum(command, "x"), y = fieldNum(command, "y");
            if (byId.has(id) && x !== null && y !== null) { pos.set(id, { x, y }); moved = id; }
          }
          const routeId = routeTarget(command, host);
          if (routeId && command.kind === "moveEvent" && byId.has(routeId)) {
            const start = pos.get(routeId) ?? byId.get(routeId)!;
            const route = simulateRoute(start, command.route?.moves, map);
            if (route.fades) { pos.delete(routeId); continue; } // 경로 끝에서 투명해져 무대를 떠난다.
            pos.set(routeId, route.end);
            moved = routeId;
          }
          if (!moved) continue;
          const cell = pos.get(moved)!;
          for (const [other, at] of pos) {
            if (other !== moved && at.x === cell.x && at.y === cell.y) { hit = { a: moved, b: other, at: cell }; break; }
          }
          if (hit) break;
        }
        if (hit) {
          issues.push({
            severity: "warning", code: "scene-actors-stacked", mapId: map.id, eventId: host.id, x: hit.at.x, y: hit.at.y,
            message: `이벤트 ${host.id} 의 장면이 ${hit.a} 와 ${hit.b} 를 같은 칸 (${hit.at.x},${hit.at.y}) 에 세운다 — 인물은 서로 다른 빈 칸에, 두 열·2칸 간격으로 벌려 세운다. 말 거는 주인공은 한 칸 물러선다.`,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------- 벽 걸이가 바닥에

/** 손 도트 실내 걸이(kind hang) 물건 id — 칩셋 키트 id 는 "hand-interior:<id>". */
const HANG_OBJECTS: ReadonlySet<string> = new Set(
  Object.entries((handInteriorSpec as { objects: Record<string, { kind?: string }> }).objects)
    .filter(([, o]) => o.kind === "hang").map(([id]) => id),
);
const hangTileCache = new Map<string, Map<number, string>>();

function hangTiles(tileset: TilesetDef | undefined): Map<number, string> {
  const kits = (tileset as { structureKits?: Array<{ id: string; name?: string; rows?: Array<{ upperTiles?: number[] }> }> } | undefined)?.structureKits ?? [];
  const key = `${tileset?.id}|${kits.length}`;
  let out = hangTileCache.get(key);
  if (out) return out;
  out = new Map();
  for (const kit of kits) {
    if (!kit.id.startsWith("hand-interior:") || !HANG_OBJECTS.has(kit.id.slice("hand-interior:".length))) continue;
    for (const row of kit.rows ?? []) for (const tile of row.upperTiles ?? []) if (tile >= 0) out.set(tile, kit.name ?? kit.id);
  }
  if (hangTileCache.size > 32) hangTileCache.clear();
  hangTileCache.set(key, out);
  return out;
}

/** 걸이 그림은 벽면(막힌 칸) 위에만 — 걸을 수 있는 바닥 칸에 있으면 깃발처럼 홀로 선다(Fallen fs_observatory 별자리표). */
function checkHangOnFloor(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    const tiles = hangTiles(project.tilesets[map.tilesetId]);
    if (tiles.size === 0) continue;
    const seen = new Set<string>();
    for (const layer of ["upperTiles", "upperOverlayTiles"] as const) {
      const grid = (map as unknown as Record<string, number[] | undefined>)[layer];
      if (!grid) continue;
      for (let i = 0; i < grid.length; i += 1) {
        const name = tiles.get(grid[i]!);
        if (!name) continue;
        const x = i % map.width, y = Math.floor(i / map.width);
        if (!isPassable(project, map, x, y) || seen.has(name)) continue;
        seen.add(name);
        issues.push({
          severity: "warning", code: "scene-hang-on-floor", mapId: map.id, x, y,
          message: `맵 ${map.name || map.id} 의 벽 걸이 ${name} 가 바닥 칸 (${x},${y}) 에 있다 — 깃발처럼 홀로 선다. 걸이는 벽면 두 줄(천장 띠 바로 아래) 윗줄에 건다.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------- 천장 구역에 천장 아닌 칸

const CEILING_WORDS = /천장|ceiling|공허|\bvoid\b/iu;
const ceilingTileCache = new Map<string, Set<number>>();

/** 이 타일셋에서 천장·공허(막힌 칸)로 이름 붙은 칸 번호. */
function ceilingTiles(tileset: TilesetDef | undefined): Set<number> {
  if (!tileset) return new Set();
  const key = doorCacheKey(tileset);
  let out = ceilingTileCache.get(key);
  if (out) return out;
  out = new Set();
  const meta = (tileset as { tileMeta?: unknown }).tileMeta;
  const entries: Array<[number, (TileMetaLike & { passage?: string }) | undefined]> = Array.isArray(meta)
    ? meta.map((m, i) => [i, m as TileMetaLike])
    : meta && typeof meta === "object" ? Object.entries(meta as Record<string, TileMetaLike>).map(([k, m]) => [Number(k), m]) : [];
  for (const [tile, m] of entries) {
    if (!m || typeof m !== "object" || (m.passage && m.passage !== "solid")) continue;
    if (CEILING_WORDS.test(`${m.label ?? ""} ${(m.tags ?? []).join(" ")}`)) out.add(tile);
  }
  if (ceilingTileCache.size > 64) ceilingTileCache.clear();
  ceilingTileCache.set(key, out);
  return out;
}

/**
 * 천장 구역 = 방 안(걸을 수 있는 칸)도, 벽면·벽 윗면도 아닌 칸. 여기는 모든 층이 어두운 천장으로 보여야 한다.
 * ① 아래층이 천장 칸인데 어느 층이든 천장이 아닌 칸(바닥·소품·벽면 조각)이 얹혔다.
 * ② 천장 칸에 닿은 고립 통행 성분(이벤트도 시작 칸도 없음) — 방 밖에 바닥 값 칸을 깔아 천장 띠가 회색 바닥으로 읽힌다(Fallen fs_vault 암반).
 */
function checkCeilingTiles(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    const ceil = ceilingTiles(project.tilesets[map.tilesetId]);
    if (ceil.size === 0) continue;
    const W = map.width, H = map.height, n = W * H;
    const grids = LAYERS.map((k) => (map as unknown as Record<string, number[] | undefined>)[k]);
    const lower = grids[0];
    if (!lower) continue;
    const isCeilCell = (i: number): boolean => ceil.has(lower[i] ?? -1);
    if (!lower.some((t) => ceil.has(t))) continue;
    // ① 얹힌 칸
    let first = -1, count = 0;
    const ids = new Set<number>();
    for (let i = 0; i < n; i += 1) {
      if (!isCeilCell(i)) continue;
      for (const g of grids) {
        const t = g?.[i] ?? -1;
        if (t >= 0 && !ceil.has(t)) { if (first < 0) first = i; count += 1; ids.add(t); break; }
      }
    }
    // ② 고립 통행 성분
    // 아래층 칸 자체의 통행만 본다 — 가구에 둘러싸인 방 안 칸은 아래층으로는 방 바닥과 이어져 있다.
    const passTable = (project.tilesets[map.tilesetId] as { passability?: unknown } | undefined)?.passability as
      Record<number, { up?: boolean; down?: boolean; left?: boolean; right?: boolean } | undefined> | undefined;
    const pass = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      const p = passTable?.[lower[i] ?? -1];
      pass[i] = p && (p.up || p.down || p.left || p.right) ? 1 : 0;
    }
    const anchors = new Set<number>((map.events ?? []).map((e) => e.y * W + e.x));
    if (project.startMapId === map.id && project.startPos) anchors.add(project.startPos.y * W + project.startPos.x);
    const seen = new Uint8Array(n);
    const comps: number[][] = [];
    for (let s = 0; s < n; s += 1) {
      if (!pass[s] || seen[s]) continue;
      const stack = [s]; seen[s] = 1; const cells: number[] = [];
      while (stack.length) {
        const i = stack.pop()!; cells.push(i);
        const x = i % W, y = Math.floor(i / W);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          const j = ny * W + nx;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && pass[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
      comps.push(cells);
    }
    const main = comps.reduce((a, c) => (c.length > a.length ? c : a), [] as number[]);
    let orphanCells = 0, orphanFirst = -1;
    for (const c of comps) {
      if (c === main || c.some((i) => anchors.has(i))) continue;
      const touchesCeiling = c.some((i) => {
        const x = i % W, y = Math.floor(i / W);
        return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < W && ny! < H && isCeilCell(ny! * W + nx!));
      });
      if (!touchesCeiling) continue;
      orphanCells += c.length;
      if (orphanFirst < 0) orphanFirst = c[0]!;
    }
    if (count === 0 && orphanCells === 0) continue;
    const at = first >= 0 ? first : orphanFirst;
    const parts: string[] = [];
    if (count > 0) parts.push(`천장 칸 ${count}곳에 천장이 아닌 칸(${[...ids].slice(0, 6).join(", ")}${ids.size > 6 ? "…" : ""})이 얹혔다`);
    if (orphanCells > 0) parts.push(`방 밖 천장 띠에 걸을 수 있는 바닥 칸 ${orphanCells}곳이 고립되어 깔렸다`);
    issues.push({
      severity: "warning", code: "scene-ceiling-tile", mapId: map.id, x: at % W, y: Math.floor(at / W),
      message: `맵 ${map.name || map.id} 의 천장 구역(방 밖, 벽면·벽 윗면이 아닌 칸) — ${parts.join(" · ")}. 1배 화면에서 방 사이가 회색 바닥 띠로 읽힌다. 그 칸의 모든 층을 지우고 어두운 천장 칸만 남긴다(바위 덩어리·바닥 값 칸으로 허공을 채우지 않는다).`,
    });
  }
}

// ---------------------------------------------------------------------------- 진입점

export function lintScenePolish(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  let gates: Gate[] = [];
  try { gates = collectGates(project); } catch { /* 이상한 저장본 — 이동 검사만 건너뛴다 */ }
  const guard = (fn: (p: Project, out: LintIssue[], g: readonly Gate[]) => void): void => {
    try { fn(project, issues, gates); } catch { /* 검사 하나가 이상한 저장본에 넘어져도 나머지는 돈다 */ }
  };
  guard(checkTransfers);
  guard(checkNpcVanish);
  guard(checkDialogue);
  guard(checkDialoguePositionJump);
  guard(checkMapBgm);
  guard(checkVehicles);
  guard(checkStacking);
  guard(checkHangOnFloor);
  guard(checkCeilingTiles);
  return issues;
}

function issueKey(issue: LintIssue): string {
  // 대화창 섞임은 프로젝트 하나에 한 건이라 개수·예시가 바뀌어도 같은 경고다.
  if (issue.code.startsWith("scene-dialogue-") && issue.code !== "scene-dialogue-position-jump") return `${issue.code}|${issue.message.startsWith("말풍선") ? "balloon" : "mix"}`;
  return `${issue.code}|${issue.mapId ?? ""}|${issue.eventId ?? ""}|${issue.x ?? ""}|${issue.y ?? ""}`;
}

/** 쓰기 도구 뒤: 이번 변경이 새로 만든 장면 경고만. 이미 있던 경고를 매 호출 되풀이하지 않는다. */
export function newScenePolishIssues(before: Project, after: Project): LintIssue[] {
  const old = new Set(lintScenePolish(before).map(issueKey));
  return lintScenePolish(after).filter((issue) => !old.has(issueKey(issue)));
}
