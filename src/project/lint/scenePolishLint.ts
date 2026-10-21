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
//  - scene-dialogue-context-mixed  sign·system·letter 밖의 특수 대화창 모양을 둘 이상 섞거나 말풍선을 쓴다
//  - scene-map-no-bgm              이야기가 들르는 맵에 BGM 이 없다(명시 «없음» 은 의도로 본다)
//  - scene-moving-vehicle          움직이는 교통(map.transit)·움직이는 탈것 이벤트
//  - scene-actors-stacked          한 페이지가 두 인물을 같은 칸에 세운다

import { nestedCommandLists } from "../authoredCommandIndex";
import type { Command, Dir, EventPage, GameEvent, GameMap, MoveCommand, Project, TilesetDef } from "../types";
import { isPassable } from "../collision";
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
    const goneSwitch = new Map<string, GameEvent>();
    for (const npc of map.events ?? []) {
      const pages = pagesOf(npc);
      if (pages.length < 2 || !visibleGraphic(pages[0])) continue;
      const gone = pages.slice(1).find((p) => !visibleGraphic(p) && (p.conditions ?? []).some((c) => c.kind === "switch") && (p.commands ?? []).length === 0);
      for (const c of gone?.conditions ?? []) if (c.kind === "switch") goneSwitch.set(c.switchId, npc);
    }
    type Stage = { black: boolean; joined: boolean; battle: boolean; talkedSinceBattle: boolean; lastRouteTo: string | null };
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
          if (target) st.lastRouteTo = target;
          if (m2Title(command) === "Erase Event") {
            const id = fieldStr(command, "eventId") || host.id;
            const npc = byId.get(id);
            if (npc && visibleGraphic(pagesOf(npc)[0]) && !excused(st) && !(st.lastRouteTo === id && routedToExit.has(id))) {
              report(npc, "Erase Event 로 제자리에서 지워진다");
            }
          }
          if (command.kind === "setSwitch" && command.value === true) {
            const npc = goneSwitch.get(command.switchId);
            if (npc && !routedToExit.has(npc.id) && !excused(st)) report(npc, "스위치로 투명한 «떠남» 페이지로 바뀌어 방 안에서 사라진다");
          }
          if (command.kind === "battleProcessing") {
            for (const branch of nestedCommandLists(command)) visitList(branch, { ...st, battle: true, talkedSinceBattle: false });
            st.battle = true; st.talkedSinceBattle = false;
            continue;
          }
          for (const branch of nestedCommandLists(command)) visitList(branch, st);
        }
      };
      visitList(commands, { black: false, joined: false, battle: false, talkedSinceBattle: false, lastRouteTo: null });
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
    for (const host of map.events ?? []) {
      for (const page of pagesOf(host)) {
        const pos = new Map<string, Cell>();
        let hit: { a: string; b: string; at: Cell } | null = null;
        for (const command of walk(page.commands)) {
          if (command.kind === "transfer") break; // 다른 맵으로 넘어가면 이 맵 무대는 끝.
          let moved: string | null = null;
          if (m2Title(command) === "Set Event Location" && (!fieldStr(command, "mapId") || fieldStr(command, "mapId") === map.id)) {
            const id = fieldStr(command, "target") || host.id;
            const x = fieldNum(command, "x"), y = fieldNum(command, "y");
            if (byId.has(id) && x !== null && y !== null) { pos.set(id, { x, y }); moved = id; }
          }
          const routeId = routeTarget(command, host);
          if (routeId && command.kind === "moveEvent" && byId.has(routeId)) {
            const start = pos.get(routeId) ?? byId.get(routeId)!;
            pos.set(routeId, simulateRoute(start, command.route?.moves, map).end);
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
  guard(checkMapBgm);
  guard(checkVehicles);
  guard(checkStacking);
  return issues;
}

function issueKey(issue: LintIssue): string {
  // 대화창 섞임은 프로젝트 하나에 한 건이라 개수·예시가 바뀌어도 같은 경고다.
  if (issue.code.startsWith("scene-dialogue-")) return `${issue.code}|${issue.message.startsWith("말풍선") ? "balloon" : "mix"}`;
  return `${issue.code}|${issue.mapId ?? ""}|${issue.eventId ?? ""}|${issue.x ?? ""}|${issue.y ?? ""}`;
}

/** 쓰기 도구 뒤: 이번 변경이 새로 만든 장면 경고만. 이미 있던 경고를 매 호출 되풀이하지 않는다. */
export function newScenePolishIssues(before: Project, after: Project): LintIssue[] {
  const old = new Set(lintScenePolish(before).map(issueKey));
  return lintScenePolish(after).filter((issue) => !old.has(issueKey(issue)));
}
