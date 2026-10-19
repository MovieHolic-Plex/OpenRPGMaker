// src/editor/tools/puzzleStageScenery.ts
// 12종 JRPG 퍼즐 프리셋을 위한 대규모 다중 타일(4×3 성당 봉인벽, 5×3 화산 용암/가시 결계,
// 5×4 심연 협곡 돌다리, 5×3 갱도 낙석과 광차 선로, 5×3 해자/울타리 제단과 2×2 비밀 계단,
// 4×4 고대 보스 마법진과 3비석) Before/Solving/After 지형 시공 및 스냅샷 복구기.

import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { chestOpenCommands } from "@/editor/lootFeedback";
import { changeTileProblems } from "@/project/changeTileValidation";
import { isPassable } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { supportSurfaceOf } from "@/project/groundSupport";
import type {
  Command,
  Dir,
  EventPage,
  EventPageCondition,
  EventPageGraphic,
  GameEvent,
  GameMap,
  Project,
} from "@/project/types";
import { charsetGraphic } from "./eventCompile";
import { mainComponent, type Cell } from "./jrpgVolumeTools";
import type { PuzzlePresetId } from "./puzzleAuthoringTools";
import { buildPuzzleRoomStage, isPuzzleRoomPreset, type PuzzleRoomPresetId } from "./puzzleRoomScenery";

export interface MapTileSnapshot {
  readonly lowerTiles: number[];
  readonly upperTiles: number[];
  readonly lowerOverlayTiles?: number[];
  readonly upperOverlayTiles?: number[];
  readonly shadowBits?: number[];
}

export interface PuzzleStagePlan {
  readonly center: Cell;
  readonly origin: Cell;
  readonly cells: readonly Cell[];
  readonly changeTileCommands: readonly Command[];
  readonly stepChangeTileCommands: Readonly<Record<string, readonly Command[]>>;
  readonly extraEvents: ReadonlyArray<{ readonly event: GameEvent; readonly role: string }>;
  readonly snapshot: MapTileSnapshot;
  /** 맵 타일이 이미 퍼즐 기물(오르간·화로·발판·석판·비석·낙석)을 그리는 칸 — 그 칸의 퍼즐 이벤트는 투명 그래픽으로 둔다. */
  readonly tileDrawnCells?: readonly Cell[];
}

const FIXED_MOVEMENT: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

function objGraphic(sheet: "object1" | "object2", characterIndex: number, direction: Dir = "down"): EventPageGraphic {
  const base = charsetGraphic(`tex_easyrpg_charset_${sheet}`, characterIndex);
  return {
    ...base,
    direction,
    pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
  };
}

function makePage(opts: {
  readonly id: string;
  readonly name: string;
  readonly conditions?: readonly EventPageCondition[];
  readonly graphic: EventPageGraphic;
  readonly trigger?: "action" | "playerTouch" | "eventTouch" | "touch" | "auto" | "parallel";
  readonly priority?: EventPage["priority"];
  readonly overlapForbidden?: boolean;
  readonly commands: readonly Command[];
}): EventPage {
  const priority = opts.priority ?? "same";
  return {
    id: opts.id,
    name: opts.name,
    conditions: [...(opts.conditions ?? [])],
    graphic: opts.graphic,
    trigger: { kind: opts.trigger ?? "action" },
    priority,
    overlapForbidden: opts.overlapForbidden ?? (priority === "same"),
    animationType: "fixedGraphic",
    movement: FIXED_MOVEMENT,
    commands: [...opts.commands],
  };
}

function particles(preset: string, durationMs = 800): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === "Particle Effect");
  if (!entry) return { kind: "text", body: "" };
  return { kind: "m2Command", commandId: entry.id, fields: { preset, target: "player", durationMs, wait: false } };
}

export function captureMapTileSnapshot(map: GameMap): MapTileSnapshot {
  return {
    lowerTiles: [...map.lowerTiles],
    upperTiles: [...map.upperTiles],
    ...(map.lowerOverlayTiles ? { lowerOverlayTiles: [...map.lowerOverlayTiles] } : {}),
    ...(map.upperOverlayTiles ? { upperOverlayTiles: [...map.upperOverlayTiles] } : {}),
    ...(map.shadowBits ? { shadowBits: [...map.shadowBits] } : {}),
  };
}

export function restoreMapTileSnapshot(map: GameMap, snapshot: MapTileSnapshot): void {
  map.lowerTiles = [...snapshot.lowerTiles];
  map.upperTiles = [...snapshot.upperTiles];
  if (snapshot.lowerOverlayTiles) map.lowerOverlayTiles = [...snapshot.lowerOverlayTiles];
  else delete map.lowerOverlayTiles;
  if (snapshot.upperOverlayTiles) map.upperOverlayTiles = [...snapshot.upperOverlayTiles];
  else delete map.upperOverlayTiles;
  if (snapshot.shadowBits) map.shadowBits = [...snapshot.shadowBits];
  else delete map.shadowBits;
}

interface StageTilePalette {
  readonly baseFloor: number;
  readonly revealFloor: number;
  readonly accentFloor: number;
  readonly sealedLower: number;
  readonly chasmLower: number;
  readonly sealedUpper: number;
  readonly pillarTop: number;
  readonly pillarBottom: number;
  readonly lightTop: number;
  readonly lightBottom: number;
  readonly crystalUpper: number;
  readonly treasureUpper: number;
}

function findTileByPredicate(
  project: Project,
  map: GameMap,
  pred: (tile: number) => boolean,
  fallback: number,
): number {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) return fallback;
  for (let t = 0; t < ts.count; t += 1) {
    if (pred(t)) return t;
  }
  return fallback;
}

function resolveGenericPalette(project: Project, map: GameMap): StageTilePalette {
  const ts = project.tilesets[map.tilesetId];
  const isPassLower = (t: number): boolean => {
    if (!ts || t < 0 || t >= ts.count) return false;
    const p = ts.passability[t];
    if (!p || !p.up || !p.down || !p.left || !p.right) return false;
    if ((ts.priority[t] ?? "lower") !== "lower") return false;
    if (supportSurfaceOf(ts, t) !== "ground") return false;
    const tags = ts.tileMeta?.[t]?.tags ?? [];
    return !tags.includes("water") && !tags.includes("wall");
  };
  const isBlockLower = (t: number): boolean => {
    if (!ts || t < 0 || t >= ts.count) return false;
    const p = ts.passability[t];
    return Boolean(p && !p.up && !p.down && !p.left && !p.right && (ts.priority[t] ?? "lower") === "lower");
  };
  const isBlockUpper = (t: number): boolean => {
    if (!ts || t < 0 || t >= ts.count) return false;
    const p = ts.passability[t];
    return Boolean(p && !p.up && !p.down && !p.left && !p.right && (ts.priority[t] ?? "lower") === "upper");
  };
  const isPassUpper = (t: number): boolean => {
    if (!ts || t < 0 || t >= ts.count) return false;
    const p = ts.passability[t];
    return Boolean(p && p.up && p.down && p.left && p.right && (ts.priority[t] ?? "lower") === "upper");
  };

  // Pick most frequent walkable ground tile on the map as baseFloor
  const freq = new Map<number, number>();
  for (const t of map.lowerTiles) {
    if (isPassLower(t)) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const baseFloor = sorted[0]?.[0] ?? findTileByPredicate(project, map, isPassLower, 0);
  const revealFloor =
    sorted.find(([t]) => t !== baseFloor)?.[0] ??
    findTileByPredicate(project, map, (t) => isPassLower(t) && t > baseFloor + 8, baseFloor);
  const accentFloor = findTileByPredicate(
    project,
    map,
    (t) => isPassLower(t) && t !== baseFloor && t !== revealFloor,
    revealFloor,
  );
  const sealedLower = findTileByPredicate(project, map, isBlockLower, baseFloor);
  const chasmLower = findTileByPredicate(project, map, (t) => isBlockLower(t) && t !== sealedLower, sealedLower);
  const sealedUpper = findTileByPredicate(project, map, isBlockUpper, -1);
  const pillarTop = findTileByPredicate(project, map, isPassUpper, -1);
  const pillarBottom = findTileByPredicate(project, map, (t) => isBlockUpper(t) && t !== sealedUpper, sealedUpper);
  const lightTop = findTileByPredicate(project, map, (t) => isPassUpper(t) && t !== pillarTop, pillarTop);
  const lightBottom = findTileByPredicate(
    project,
    map,
    (t) => isBlockUpper(t) && t !== sealedUpper && t !== pillarBottom,
    pillarBottom,
  );

  return {
    baseFloor,
    revealFloor,
    accentFloor,
    sealedLower,
    chasmLower,
    sealedUpper,
    pillarTop,
    pillarBottom,
    lightTop,
    lightBottom,
    crystalUpper: lightBottom,
    treasureUpper: pillarBottom,
  };
}

function setMapTileBefore(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  opts: {
    readonly lower?: number;
    readonly upper?: number;
    readonly lower2?: number;
    readonly clearOverlays?: boolean;
  },
): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  const idx = y * map.width + x;
  const ts = project.tilesets[map.tilesetId];
  const validTile = (t: number): boolean => Boolean(ts && t >= -1 && t < ts.count);

  if (opts.clearOverlays !== false) {
    if (map.lowerOverlayTiles && idx < map.lowerOverlayTiles.length) map.lowerOverlayTiles[idx] = -1;
    if (map.upperOverlayTiles && idx < map.upperOverlayTiles.length) map.upperOverlayTiles[idx] = -1;
    if (map.shadowBits && idx < map.shadowBits.length) map.shadowBits[idx] = 0;
  }
  if (opts.lower !== undefined && opts.lower >= 0 && validTile(opts.lower)) {
    map.lowerTiles[idx] = opts.lower;
  }
  if (opts.upper !== undefined && validTile(opts.upper)) {
    map.upperTiles[idx] = opts.upper;
  }
  if (opts.lower2 !== undefined && validTile(opts.lower2)) {
    if (!map.lowerOverlayTiles || map.lowerOverlayTiles.length !== map.width * map.height) {
      map.lowerOverlayTiles = Array.from({ length: map.width * map.height }, () => -1);
    }
    map.lowerOverlayTiles[idx] = opts.lower2;
  }
}

function pushVerifiedChangeTile(
  project: Project,
  map: GameMap,
  out: Command[],
  layer: "lower" | "lower2" | "upper" | "upper2",
  x: number,
  y: number,
  tile: number,
): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  const cmd: Command = {
    kind: "changeTile",
    mapId: map.id,
    layer,
    x,
    y,
    tile,
  };
  if (changeTileProblems(cmd, project).length === 0) {
    out.push(cmd);
  }
}

function setBeforeAndAfterTile(
  project: Project,
  map: GameMap,
  out: Command[],
  x: number,
  y: number,
  spec: {
    readonly beforeLower?: number;
    readonly beforeUpper?: number;
    readonly beforeLower2?: number;
    readonly afterLower?: number;
    readonly afterUpper?: number;
    readonly afterLower2?: number;
  },
): void {
  setMapTileBefore(project, map, x, y, {
    lower: spec.beforeLower,
    upper: spec.beforeUpper,
    lower2: spec.beforeLower2,
  });
  if (spec.afterLower !== undefined) {
    pushVerifiedChangeTile(project, map, out, "lower", x, y, spec.afterLower);
  }
  if (spec.afterLower2 !== undefined) {
    pushVerifiedChangeTile(project, map, out, "lower2", x, y, spec.afterLower2);
  }
  if (spec.afterUpper !== undefined) {
    pushVerifiedChangeTile(project, map, out, "upper", x, y, spec.afterUpper);
  }
}

function makeRevealedChestEvent(
  baseId: string,
  solveSwitchId: string,
  at: Cell,
  opts: {
    readonly name: string;
    readonly beforeGraphic?: EventPageGraphic;
    readonly beforeText: string;
    readonly afterText: string;
  },
): GameEvent {
  const evId = `ev_${baseId}_reward_chest`;
  const chestClosed = objGraphic("object1", 6, "down");
  return {
    id: evId,
    name: opts.name,
    x: at.x,
    y: at.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      makePage({
        id: `${evId}_sealed`,
        name: `${opts.name} (봉인 중)`,
        graphic: opts.beforeGraphic ?? objGraphic("object2", 2, "down"),
        priority: "below",
        overlapForbidden: false,
        commands: [{ kind: "text", body: opts.beforeText }],
      }),
      makePage({
        id: `${evId}_revealed`,
        name: `${opts.name} (출현)`,
        conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
        graphic: chestClosed,
        priority: "below",
        overlapForbidden: false,
        commands: [
          ...chestOpenCommands(evId, chestClosed),
          particles("sparkle", 750),
          { kind: "text", body: opts.afterText },
        ],
      }),
    ],
  };
}

function makeRevealedCrystalEvent(
  baseId: string,
  solveSwitchId: string,
  suffix: string,
  at: Cell,
  opts: {
    readonly name: string;
    readonly beforeGraphic?: EventPageGraphic;
    readonly beforeText: string;
    readonly afterText: string;
  },
): GameEvent {
  const evId = `ev_${baseId}_${suffix}`;
  return {
    id: evId,
    name: opts.name,
    x: at.x,
    y: at.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      makePage({
        id: `${evId}_sealed`,
        name: `${opts.name} (잠김)`,
        graphic: opts.beforeGraphic ?? objGraphic("object2", 2, "down"),
        priority: "below",
        overlapForbidden: false,
        commands: [{ kind: "text", body: opts.beforeText }],
      }),
      makePage({
        id: `${evId}_glowing`,
        name: `${opts.name} (발광)`,
        conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
        graphic: objGraphic("object2", 6, "up"),
        priority: "below",
        overlapForbidden: false,
        commands: [particles("sparkle", 700), { kind: "text", body: opts.afterText }],
      }),
    ],
  };
}

function findStageCenter(
  project: Project,
  map: GameMap,
  requestedAnchor: Cell | undefined,
  landings: ReadonlySet<string>,
): Cell | undefined {
  if (map.events.length > 0 && (map.width < 24 || map.height < 20)) return undefined;

  const occupied = new Set<string>(landings);
  for (const ev of map.events ?? []) {
    occupied.add(`${ev.x},${ev.y}`);
  }
  if (project.startMapId === map.id) {
    occupied.add(`${project.startPos.x},${project.startPos.y}`);
  }

  const anchor = requestedAnchor ?? {
    x: Math.round(map.width / 2),
    y: Math.round(map.height / 2),
  };

  const candidates: Array<{ readonly x: number; readonly y: number; readonly score: number }> = [];
  const minX = 5;
  const maxX = map.width - 6;
  const minY = 5;
  const maxY = map.height - 5;

  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      let conflict = false;
      let blockedCount = 0;
      for (let y = cy - 4; y <= cy + 3 && !conflict; y += 1) {
        for (let x = cx - 4; x <= cx + 4 && !conflict; x += 1) {
          if (occupied.has(`${x},${y}`)) conflict = true;
          if (!isPassable(project, map, x, y)) blockedCount += 1;
        }
      }
      if (conflict) continue;
      const d = Math.abs(cx - anchor.x) + Math.abs(cy - anchor.y) + (map.events.length > 0 ? blockedCount * 0.4 : 0);
      candidates.push({ x: cx, y: cy, score: d });
    }
  }
  candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : undefined;
}

function paveStageFoundationAndConnectOrigin(
  project: Project,
  map: GameMap,
  center: Cell,
  baseFloor: number,
  landings: ReadonlySet<string>,
): Cell {
  const occupied = new Set<string>(landings);
  for (const ev of map.events ?? []) {
    occupied.add(`${ev.x},${ev.y}`);
  }

  // Clear upper obstacles across the 9×8 stage [cx-4..cx+4] × [cy-4..cy+3];
  // only replace lowerTiles on cells whose current lowerTile is impassable so the map's native ground pattern stays seamless.
  const ts = project.tilesets[map.tilesetId];
  const isWalkableLower = (t: number): boolean => {
    if (!ts || t < 0 || t >= ts.count) return false;
    const p = ts.passability[t];
    return Boolean(p && p.up && p.down && p.left && p.right);
  };
  for (let y = center.y - 4; y <= center.y + 3; y += 1) {
    for (let x = center.x - 4; x <= center.x + 4; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const curLower = map.lowerTiles[y * map.width + x] ?? -1;
      setMapTileBefore(project, map, x, y, {
        ...(isWalkableLower(curLower) ? {} : { lower: baseFloor }),
        upper: -1,
        clearOverlays: true,
      });
    }
  }
  // Ensure connection from (center.x, center.y + 2) to existing main walkable component
  const main = mainComponent(project, map);
  const southHub = { x: center.x, y: center.y + 2 };
  if (!main.has(`${southHub.x},${southHub.y}`) && main.size > 0) {
    let nearest: Cell | undefined;
    let bestD = Infinity;
    for (const k of main) {
      const [mx, my] = k.split(",").map(Number);
      if (mx === undefined || my === undefined) continue;
      const d = Math.abs(mx - southHub.x) + Math.abs(my - southHub.y);
      if (d < bestD) {
        bestD = d;
        nearest = { x: mx, y: my };
      }
    }
    if (nearest) {
      let curX = southHub.x;
      let curY = southHub.y;
      while (curX !== nearest.x) {
        if (!occupied.has(`${curX},${curY}`)) {
          setMapTileBefore(project, map, curX, curY, { lower: baseFloor, upper: -1 });
        }
        curX += curX < nearest.x ? 1 : -1;
      }
      while (curY !== nearest.y) {
        if (!occupied.has(`${curX},${curY}`)) {
          setMapTileBefore(project, map, curX, curY, { lower: baseFloor, upper: -1 });
        }
        curY += curY < nearest.y ? 1 : -1;
      }
    }
  }

  // Pick origin at (center.x, center.y + 2) if startMapId !== map.id, else startPos
  if (project.startMapId === map.id && isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return project.startPos;
  }
  return southHub;
}

/** 20×15 무대 방이 해결 뒤 내놓는 보상 한 점. kind 가 chest 가 아니면 성유물 수정의 id 접미사다. */
const ROOM_REWARDS: Record<PuzzleRoomPresetId, { readonly kind: string; readonly name: string; readonly role: string; readonly beforeText: string; readonly afterText: string }> = {
  cathedral_organ_tuning: {
    kind: "chest",
    name: "성소 황금 보물상자",
    role: "개방된 성소 황금 보물상자",
    beforeText: "오르간 옆 성가대석 바닥이 비어 있다.",
    afterText: "지하 계단이 열리며 나타난 「성소 황금 보물상자」를 열었다!",
  },
  brazier_ignition_order: {
    kind: "chest",
    name: "화산 수호자의 보물상자",
    role: "출현하는 수호자 보물상자",
    beforeText: "그을린 돌바닥에 무언가 놓였던 자국이 있다.",
    afterText: "세 화로의 성화로 봉인문이 열리며 나타난 「화산 수호자의 보물상자」를 열었다!",
  },
  statue_pressure_plates: {
    kind: "chest",
    name: "제단 황금 보물상자",
    role: "돌다리 개방 보물상자",
    beforeText: "심연 건너편 둑이다. 다리가 없으면 닿을 수 없다.",
    afterText: "솟아오른 돌다리를 건너 「제단 황금 보물상자」를 열었다!",
  },
  dynamite_rock_blast: {
    kind: "chest",
    name: "광맥 황금 보물상자",
    role: "폭파 후 드러난 보물상자",
    beforeText: "흙바닥에 광석 부스러기가 흩어져 있다.",
    afterText: "낙석을 폭파하자 드러난 「광맥 황금 보물상자」를 열었다!",
  },
  riddle_mimic_chests: {
    kind: "sacred_relic",
    name: "출현한 고대 성유물",
    role: "출현한 발광 성유물",
    beforeText: "사암 바닥에 고대 문양이 새겨져 있다.",
    afterText: "진실의 상자가 열리며 비밀 계단 옆에 「고대 성유물」이 떠올랐다!",
  },
  boss_seal_monoliths: {
    kind: "chest",
    name: "성역 봉인 보물상자",
    role: "마법진 출현 보물상자",
    beforeText: "룬이 새겨진 석판 바닥이다.",
    afterText: "세 비석이 깨어나 결계가 걷히며 나타난 「성역 봉인 보물상자」를 열었다!",
  },
  rolling_boulder_chasm: {
    kind: "chest",
    name: "구렁 돌다리 보물상자",
    role: "바위 착지 출현 보물상자",
    beforeText: "심연 구렁 남쪽 벼랑 옆의 평평한 돌바닥이다.",
    afterText: "거대 바위가 심연 구렁을 메우며 나타난 「구렁 돌다리 보물상자」를 열었다!",
  },
  mirror_beam_refraction: {
    kind: "chest",
    name: "태양광 성소 보물상자",
    role: "빛줄기 공명 출현 보물상자",
    beforeText: "대리석 바닥에 황금빛 성소 문양이 새겨져 있다.",
    afterText: "굴절된 태양 빛줄기가 암흑 봉인을 깨뜨리며 나타난 「태양광 성소 보물상자」를 열었다!",
  },
  minecart_track_switch: {
    kind: "chest",
    name: "광산 금고 황금 보물상자",
    role: "광차 돌파 출현 보물상자",
    beforeText: "선로 옆 흙바닥에 광석 부스러기가 흩어져 있다.",
    afterText: "광차가 낙석 바리케이드를 돌파하며 드러난 「광산 금고 황금 보물상자」를 열었다!",
  },
  elemental_pedestal_swap: {
    kind: "chest",
    name: "사원소 대성소 보물상자",
    role: "사원소 공명 출현 보물상자",
    beforeText: "사원소 룬이 교차하는 엘프 석판 바닥이다.",
    afterText: "화·빙·풍·지 네 제단이 공명하며 나타난 「사원소 대성소 보물상자」를 열었다!",
  },
};

export function buildDramaticPuzzleStage(
  project: Project,
  map: GameMap,
  presetId: PuzzlePresetId,
  baseId: string,
  solveSwitchId: string,
  requestedAnchor: Cell | undefined,
  landings: ReadonlySet<string>,
): PuzzleStagePlan | undefined {
  if (isPuzzleRoomPreset(presetId)) {
    const snapshot = captureMapTileSnapshot(map);
    const room = buildPuzzleRoomStage(project, map, presetId, requestedAnchor, landings);
    if (room) {
      const reward = ROOM_REWARDS[presetId];
      const event =
        reward.kind === "chest"
          ? makeRevealedChestEvent(baseId, solveSwitchId, room.reward, { ...reward, beforeGraphic: { transparent: true } })
          : makeRevealedCrystalEvent(baseId, solveSwitchId, reward.kind, room.reward, { ...reward, beforeGraphic: { transparent: true } });
      return {
        center: room.center,
        origin: room.origin,
        cells: room.cells,
        changeTileCommands: room.changeTileCommands,
        stepChangeTileCommands: room.stepChangeTileCommands,
        extraEvents: [{ event, role: reward.role }],
        // 수수께끼 방의 세 상자와 광산 보급함은 방 타일에 없으니 상자 스프라이트를 그대로 쓴다.
        tileDrawnCells:
          presetId === "riddle_mimic_chests"
            ? room.cells.slice(0, 1)
            : presetId === "dynamite_rock_blast"
              ? room.cells.slice(1)
              : room.cells,
        snapshot,
      };
    }
  }
  const center = findStageCenter(project, map, requestedAnchor, landings);
  if (!center) return undefined;

  const snapshot = captureMapTileSnapshot(map);
  const pal = resolveGenericPalette(project, map);
  const tsId = map.tilesetId;
  const cx = center.x;
  const cy = center.y;

  const baseFloor =
    tsId === "atlas_biome_interior"
      ? presetId === "dynamite_rock_blast"
        ? 326
        : pal.baseFloor
      : tsId === "prehistoric"
        ? 9
        : tsId === "gothic_manor"
          ? pal.baseFloor
          : tsId === "snow_north"
            ? pal.baseFloor
            : tsId === "sky_island"
              ? pal.baseFloor
              : pal.baseFloor;
  const origin = paveStageFoundationAndConnectOrigin(project, map, center, baseFloor, landings);
  const changeTileCommands: Command[] = [];
  const stepChangeTileCommands: Record<string, Command[]> = {};
  const extraEvents: Array<{ readonly event: GameEvent; readonly role: string }> = [];

  if (presetId === "cathedral_organ_tuning") {
    const isInterior = tsId === "atlas_biome_interior";
    // Southern carpet approach (y = cy + 1 .. cy + 3) leading up to the sealed stone wall
    if (isInterior) {
      for (let y = cy + 1; y <= cy + 3; y += 1) {
        setMapTileBefore(project, map, cx - 1, y, { lower: 1190, lower2: 5462, upper: -1 });
        setMapTileBefore(project, map, cx, y, { lower: 1190, lower2: 5466, upper: -1 });
        setMapTileBefore(project, map, cx + 1, y, { lower: 1190, lower2: 5487, upper: -1 });
      }
      // 2×3 Pipe Organ on the west (x = cx - 3 .. cx - 2, y = cy - 2 .. cy)
      const organRows: ReadonlyArray<readonly [number, number]> = [
        [3643, 3644],
        [3645, 3646],
        [3647, 3648],
      ];
      for (let ry = 0; ry < 3; ry += 1) {
        const pair = organRows[ry]!;
        setMapTileBefore(project, map, cx - 3, cy - 2 + ry, { lower: 726, upper: pair[0] });
        setMapTileBefore(project, map, cx - 2, cy - 2 + ry, { lower: 727, upper: pair[1] });
      }
      // 2×2 Choir Constellation Score Stand on the east (x = cx + 3 .. cx + 4, y = cy - 1 .. cy)
      setMapTileBefore(project, map, cx + 3, cy - 1, { lower: 726, upper: 3704 });
      setMapTileBefore(project, map, cx + 4, cy - 1, { lower: 727, upper: 3705 });
      setMapTileBefore(project, map, cx + 3, cy, { lower: 728, upper: 3706 });
      setMapTileBefore(project, map, cx + 4, cy, { lower: 729, upper: 3707 });
    }

    // 4×3 Solid Stone Wall / Sealed Sanctum Archway (x = cx - 1 .. cx + 2, y = cy - 3 .. cy - 1)
    // + Northern Altar Row (y = cy - 4) + Front Threshold Row (y = cy)
    for (let y = cy - 4; y <= cy; y += 1) {
      for (let x = cx - 1; x <= cx + 2; x += 1) {
        const col = x - (cx - 1); // 0..3
        const isCenterCorridor = col === 1 || col === 2;
        if (isInterior) {
          const beforeLower =
            y === cy
              ? 582
              : y === cy - 2
                ? 3114 + col
                : 3182 + col;
          const beforeUpper =
            y === cy
              ? -1
              : y === cy - 4
                ? 5708
                : y === cy - 3
                  ? isCenterCorridor
                    ? 5708
                    : 4170
                  : y === cy - 2
                    ? isCenterCorridor
                      ? 6421
                      : 4171
                    : isCenterCorridor
                      ? 6422
                      : 4172;

          const afterLower = 726 + col;
          const afterLower2 =
            y >= cy - 3 && isCenterCorridor
              ? col === 1
                ? 5462
                : 5487
              : y === cy - 4 && isCenterCorridor
                ? 3708
                : undefined;
          const afterUpper =
            y === cy - 4
              ? col === 0 || col === 3
                ? 3660 // 좌우 황금 촛대 상단
                : col === 1
                  ? 3712 // 성소 황금 보물 더미 좌
                  : 3713 // 성소 황금 보물 더미 우
              : y === cy - 3
                ? col === 0
                  ? 3672 // 좌측 황금 촛대 하단
                  : col === 3
                    ? 6484 // 성소 발광 크리스탈 상단
                    : -1 // 황금 카펫 회랑 개방!
                : y === cy - 2
                  ? col === 0
                    ? 4164 // 성소 대리석 황금 기둥 좌상
                    : col === 3
                      ? 6485 // 성소 발광 크리스탈 중단
                      : -1 // 황금 카펫 회랑 개방!
                  : y === cy - 1
                    ? col === 0
                      ? 4165 // 성소 대리석 황금 기둥 좌중
                      : col === 3
                        ? 6486 // 성소 발광 크리스탈 하단
                        : -1 // 황금 카펫 회랑 개방!
                    : -1;
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            ...(afterLower2 !== undefined ? { afterLower2 } : {}),
            afterUpper,
          });
        } else {
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower: y === cy ? pal.baseFloor : pal.sealedLower,
            beforeUpper: y === cy ? -1 : pal.sealedUpper,
            afterLower: isCenterCorridor ? pal.revealFloor : pal.accentFloor,
            afterUpper: isCenterCorridor ? -1 : y === cy - 2 ? pal.lightBottom : -1,
          });
        }
      }
    }

    extraEvents.push(
      {
        event: makeRevealedChestEvent(baseId, solveSwitchId, { x: cx + 1, y: cy }, {
          name: "성소 황금 보물상자",
          beforeText: "두꺼운 성당 석벽 너머에 황금빛 보물상자가 봉인되어 있다.",
          afterText: "열린 황금 카펫 성소 회랑에서 「성소 황금 보물상자」를 열었다!",
        }),
        role: "개방된 성소 황금 보물상자",
      },
      {
        event: makeRevealedCrystalEvent(baseId, solveSwitchId, "sanctum_crystal", { x: cx - 1, y: cy }, {
          name: "성소 공명 크리스탈",
          beforeText: "오르간의 별빛 화음이 닿으면 깨어날 성소 크리스탈 좌대다.",
          afterText: "성소 아치문이 열리며 푸른 성좌의 크리스탈이 찬란한 빛을 뿜어내고 있다!",
        }),
        role: "성소 발광 크리스탈",
      },
    );

    const cOrgan: Cell = { x: cx - 2, y: cy + 1 };
    const cScore: Cell = { x: cx + 3, y: cy + 1 };
    const cStair: Cell = { x: cx, y: cy };
    return {
      center,
      origin,
      cells: [cOrgan, cScore, cStair],
      changeTileCommands,
      stepChangeTileCommands,
      extraEvents,
      snapshot,
    };
  }

  if (presetId === "brazier_ignition_order") {
    const isPrehistoric = tsId === "prehistoric";
    // 5×3 Lava Chasm + 5×2 Dark Magic Flame/Spike Barrier (x = cx - 2 .. cx + 2, y = cy - 3 .. cy - 1)
    for (let y = cy - 3; y <= cy - 1; y += 1) {
      for (let x = cx - 2; x <= cx + 2; x += 1) {
        const col = x - (cx - 2); // 0..4
        const isBridgeDeck = col >= 1 && col <= 3;
        if (isPrehistoric) {
          const beforeLower = (x + y) % 3 === 0 ? 18 : (x + y) % 3 === 1 ? 19 : 20; // 끓어오르는 용암 해자 (3프레임)
          const beforeUpper =
            y === cy - 3
              ? col % 2 === 0
                ? 528 // 머리뼈 장대 상단
                : 449 // 용암 바위 첨탑 상단
              : y === cy - 2
                ? col % 2 === 0
                  ? 529 // 머리뼈 장대 하단
                  : 450 // 용암 바위 첨탑 하단
                : col % 2 === 0
                  ? 571 // 거품 끓는 타르/검은 화염 웅덩이
                  : 450; // 용암 바위 가시
          const afterLower = isBridgeDeck ? 611 : 10;
          const afterUpper = isBridgeDeck
            ? -1
            : y === cy - 3
              ? 470 // 횃불 말뚝 불꽃 상단
              : y === cy - 2
                ? 473 // 횃불 말뚝 기둥 하단
                : 455; // 타오르는 화로 불꽃
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            afterUpper,
          });
        } else {
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower: pal.chasmLower,
            beforeUpper: y >= cy - 2 ? pal.sealedUpper : -1,
            afterLower: isBridgeDeck ? pal.revealFloor : pal.accentFloor,
            afterUpper: isBridgeDeck ? -1 : pal.lightBottom,
          });
        }
      }
    }

    // 3 Unlit Brazier Pedestals in front of the barrier -> Ignite with animated fire (455) on each step!
    const basinCells: readonly [Cell, Cell, Cell] = [
      { x: cx - 2, y: cy },
      { x: cx - 1, y: cy },
      { x: cx + 2, y: cy },
    ];
    for (let i = 0; i < 3; i += 1) {
      const bCell = basinCells[i]!;
      const stepCmds: Command[] = [];
      setMapTileBefore(project, map, bCell.x, bCell.y, {
        lower: isPrehistoric ? 9 : pal.accentFloor,
        upper: isPrehistoric ? 531 : pal.pillarBottom,
      });
      pushVerifiedChangeTile(project, map, stepCmds, "lower", bCell.x, bCell.y, isPrehistoric ? 10 : pal.revealFloor);
      pushVerifiedChangeTile(project, map, stepCmds, "upper", bCell.x, bCell.y, isPrehistoric ? 455 : pal.lightBottom);
      stepChangeTileCommands[`brazier_${i + 1}`] = stepCmds;
      changeTileCommands.push(...stepCmds);
    }

    extraEvents.push({
      event: makeRevealedChestEvent(baseId, solveSwitchId, { x: cx + 1, y: cy }, {
        name: "화산 수호자의 보물상자",
        beforeText: "검은 화염 가시 결계가 사라지면 수호자의 보물상자가 나타날 자리다.",
        afterText: "세 화로의 성화로 열린 대리석 다리 위에서 「화산 수호자의 보물상자」를 열었다!",
      }),
      role: "출현하는 수호자 보물상자",
    });

    const cB1: Cell = { x: cx - 2, y: cy + 1 };
    const cB2: Cell = { x: cx, y: cy + 1 };
    const cB3: Cell = { x: cx + 2, y: cy + 1 };
    const cSeal: Cell = { x: cx, y: cy };
    return {
      center,
      origin,
      cells: [cB1, cB2, cB3, cSeal],
      changeTileCommands,
      stepChangeTileCommands,
      extraEvents,
      snapshot,
    };
  }

  if (presetId === "statue_pressure_plates") {
    const isGothic = tsId === "gothic_manor";
    if (isGothic) {
      // Twin Gargoyle Statues flanking the southern platform
      setMapTileBefore(project, map, cx - 3, cy - 1, { lower: pal.baseFloor, upper: 815 });
      setMapTileBefore(project, map, cx - 3, cy, { lower: pal.baseFloor, upper: 816 });
      setMapTileBefore(project, map, cx + 3, cy - 1, { lower: pal.baseFloor, upper: 815 });
      setMapTileBefore(project, map, cx + 3, cy, { lower: pal.baseFloor, upper: 816 });
    }

    // 5×4 Black Abyss Chasm (x = cx - 2 .. cx + 2, y = cy - 4 .. cy - 1, 20 tiles!)
    // -> Full 3×4 Stone Bridge (x = cx - 1 .. cx + 1, y = cy - 4 .. cy - 1) + 2×4 Railings & Lantern Pillars (cx - 2, cx + 2)
    for (let y = cy - 4; y <= cy - 1; y += 1) {
      for (let x = cx - 2; x <= cx + 2; x += 1) {
        const col = x - (cx - 2); // 0..4
        const isBridge = col >= 1 && col <= 3;
        if (isGothic) {
          const beforeLower = 1411; // 칠흑 심연 낭떠러지 (이웃 255 순수 암흑 심연)
          const beforeUpper = y === cy - 1 ? 1464 : -1; // 심연 가장자리 차단 철책
          const afterLower = col === 1 ? 855 : col === 2 ? 1046 : col === 3 ? 856 : pal.baseFloor;
          const afterUpper = isBridge
            ? -1
            : y === cy - 4
              ? 785 // 고딕 등불 돌기둥 상단
              : y === cy - 3
                ? 786 // 고딕 등불 돌기둥 하단
                : y === cy - 2
                  ? 1098 // 깜빡이는 황금 촛대 난간 상단
                  : 1101; // 깜빡이는 황금 촛대 난간 하단

          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            afterUpper,
          });
        } else {
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower: pal.chasmLower,
            beforeUpper: pal.sealedUpper,
            afterLower: isBridge ? pal.revealFloor : pal.accentFloor,
            afterUpper: isBridge ? -1 : pal.lightBottom,
          });
        }
      }
    }

    // Bridgehead threshold at y = cy (x = cx - 1 .. cx + 1)
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      setBeforeAndAfterTile(project, map, changeTileCommands, x, cy, {
        beforeLower: isGothic ? pal.baseFloor : pal.baseFloor,
        beforeUpper: -1,
        afterLower: isGothic ? 1047 : pal.revealFloor,
        afterUpper: -1,
      });
    }

    // Step 1 partial bridge & pushed statue when Plate 1 is pressed
    const plate1Cmds: Command[] = [];
    setMapTileBefore(project, map, cx - 2, cy, { lower: isGothic ? 1046 : pal.accentFloor, upper: -1 });
    pushVerifiedChangeTile(project, map, plate1Cmds, "lower", cx - 2, cy, isGothic ? 855 : pal.revealFloor);
    pushVerifiedChangeTile(project, map, plate1Cmds, "upper", cx - 2, cy, isGothic ? 816 : pal.pillarBottom);
    pushVerifiedChangeTile(project, map, plate1Cmds, "lower", cx, cy - 1, isGothic ? 855 : pal.revealFloor);
    pushVerifiedChangeTile(project, map, plate1Cmds, "upper", cx, cy - 1, -1);
    pushVerifiedChangeTile(project, map, plate1Cmds, "lower", cx, cy - 2, isGothic ? 855 : pal.revealFloor);
    pushVerifiedChangeTile(project, map, plate1Cmds, "upper", cx, cy - 2, -1);
    stepChangeTileCommands.plate_1 = plate1Cmds;

    // Plate 2 statue pedestal at (cx + 2, cy)
    setMapTileBefore(project, map, cx + 2, cy, { lower: isGothic ? 1046 : pal.accentFloor, upper: -1 });
    pushVerifiedChangeTile(project, map, changeTileCommands, "lower", cx + 2, cy, isGothic ? 855 : pal.revealFloor);
    pushVerifiedChangeTile(project, map, changeTileCommands, "upper", cx + 2, cy, isGothic ? 816 : pal.pillarBottom);
    changeTileCommands.push(...plate1Cmds);

    extraEvents.push({
      event: makeRevealedChestEvent(baseId, solveSwitchId, { x: cx + 1, y: cy }, {
        name: "제단 황금 보물상자",
        beforeText: "심연의 협곡 위로 돌다리가 솟아오르면 건너편 성소의 보물이 나타난다.",
        afterText: "협곡 위로 솟아오른 3×4 돌다리 입구에서 「제단 황금 보물상자」를 열었다!",
      }),
      role: "돌다리 개방 보물상자",
    });

    const cP1: Cell = { x: cx - 2, y: cy + 1 };
    const cP2: Cell = { x: cx + 2, y: cy + 1 };
    const cGate: Cell = { x: cx, y: cy };
    return {
      center,
      origin,
      cells: [cP1, cP2, cGate],
      changeTileCommands,
      stepChangeTileCommands,
      extraEvents,
      snapshot,
    };
  }

  if (presetId === "dynamite_rock_blast") {
    const isSnow = tsId === "snow_north";
    const isInterior = tsId === "atlas_biome_interior";

    // Southern railway stub (x = cx, y = cy + 1 .. cy + 2) leading up to the collapsed boulder pile
    for (let y = cy + 1; y <= cy + 2; y += 1) {
      if (isSnow) {
        setMapTileBefore(project, map, cx, y, { lower: 17, upper: -1 });
      } else if (isInterior) {
        setMapTileBefore(project, map, cx, y, { lower: 1254, lower2: 5527, upper: -1 });
      }
    }

    // 5×3 Massive Pile of Boulders & Collapsed Rock (x = cx - 2 .. cx + 2, y = cy - 3 .. cy - 1, 15 tiles!)
    // + Northern Tunnel Exit (y = cy - 4) + Front Blast Row (y = cy)
    for (let y = cy - 4; y <= cy; y += 1) {
      for (let x = cx - 2; x <= cx + 2; x += 1) {
        const col = x - (cx - 2); // 0..4
        const isTrackCenter = col === 2;
        const isTunnelWalkway = col >= 1 && col <= 3;

        if (isSnow) {
          const isBoulderBlock = y >= cy - 3 && y <= cy - 1;
          const beforeLower = isBoulderBlock ? ((x + y) % 2 === 0 ? 570 : 571) : 561;
          const beforeUpper = !isBoulderBlock
            ? -1
            : y === cy - 3
              ? col % 2 === 0
                ? 438
                : 439
              : y === cy - 2
                ? col % 2 === 0
                  ? 440
                  : 441
                : col === 2
                  ? 446
                  : 437;

          const afterLower = isTrackCenter ? 17 : isTunnelWalkway ? 8 : 19;
          const afterUpper = isTunnelWalkway
            ? y === cy - 4 && col === 1
              ? 489 // 광차/짐 썰매 좌
              : y === cy - 4 && col === 3
                ? 490 // 광차/짐 썰매 우
                : -1
            : y === cy - 3
              ? 464 // 타오르는 쇠 화로 상단
              : y === cy - 2
                ? 467 // 타오르는 쇠 화로 하단
                : y === cy - 1
                  ? 664 // 푸른 얼음/마석 결정 광맥
                  : -1;

          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            afterUpper,
          });
        } else if (isInterior) {
          const isBoulderBlock = y >= cy - 3 && y <= cy - 1;
          const beforeLower = isBoulderBlock ? (col % 2 === 0 ? 3166 : 3178) : 326;
          const beforeUpper = !isBoulderBlock ? -1 : 6474;
          const afterLower = isTrackCenter ? 5695 : 1254;
          const afterUpper = isTunnelWalkway
            ? y === cy - 4 && isTrackCenter
              ? 4250
              : -1
            : y === cy - 3
              ? 4212
              : y === cy - 2
                ? 6453
                : y === cy - 1
                  ? 4251
                  : -1;

          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            afterUpper,
          });
        } else {
          const isBoulderBlock = y >= cy - 3 && y <= cy - 1;
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower: isBoulderBlock ? pal.sealedLower : pal.baseFloor,
            beforeUpper: isBoulderBlock ? pal.sealedUpper : -1,
            afterLower: isTrackCenter ? pal.revealFloor : pal.accentFloor,
            afterUpper: isTunnelWalkway ? -1 : pal.lightBottom,
          });
        }
      }
    }

    // Visible Dynamite Barrel placed right beside the boulder pile at (cx - 1, cy)
    const barrelId = `ev_${baseId}_barrel`;
    const barrelEvent: GameEvent = {
      id: barrelId,
      name: "설치된 화약통",
      x: cx - 1,
      y: cy,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        makePage({
          id: `${barrelId}_ready`,
          name: "화약통 (대기)",
          graphic: objGraphic("object2", 1, "down"),
          priority: "below",
          overlapForbidden: false,
          commands: [{ kind: "text", body: "암반 균열 바로 옆에 도화선이 달린 화약통이 놓여 있다. 보급 상자에서 다이너마이트를 꺼내 점화하자!" }],
        }),
        makePage({
          id: `${barrelId}_detonated`,
          name: "화약통 (폭파 후)",
          conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
          graphic: objGraphic("object2", 6, "up"),
          priority: "below",
          overlapForbidden: false,
          commands: [{ kind: "text", body: "폭파된 암반 자리에서 푸른 마석 광맥이 빛나고 있다!" }],
        }),
      ],
    };

    extraEvents.push(
      { event: barrelEvent, role: "암반 옆 다이너마이트 화약통" },
      {
        event: makeRevealedChestEvent(baseId, solveSwitchId, { x: cx + 1, y: cy }, {
          name: "광맥 황금 보물상자",
          beforeGraphic: objGraphic("object2", 5, "down"),
          beforeText: "무너진 낙석 바위 더미 아래에 무언가 묻혀 있다. 다이너마이트로 폭파해야 한다.",
          afterText: "낙석이 폭파되고 뚫린 광차 선로 옆에서 「광맥 황금 보물상자」를 열었다!",
        }),
        role: "폭파 후 드러난 보물상자",
      },
    );

    const cSupply: Cell = { x: cx - 2, y: cy + 1 };
    const cBoulder: Cell = { x: cx, y: cy };
    return {
      center,
      origin,
      cells: [cSupply, cBoulder],
      changeTileCommands,
      stepChangeTileCommands,
      extraEvents,
      snapshot,
    };
  }

  if (presetId === "riddle_mimic_chests") {
    const isInterior = tsId === "atlas_biome_interior";
    if (isInterior) {
      // Arcane Tome Stand beside the Riddle Stone Tablet on the east (x = cx + 3 .. cx + 4, y = cy - 1 .. cy)
      setMapTileBefore(project, map, cx + 3, cy - 1, { lower: 726, upper: 3704 });
      setMapTileBefore(project, map, cx + 4, cy - 1, { lower: 727, upper: 3705 });
      setMapTileBefore(project, map, cx + 3, cy, { lower: 728, upper: 3706 });
      setMapTileBefore(project, map, cx + 4, cy, { lower: 729, upper: 3707 });
    }

    // 5×3 Locked Pedestal surrounded by Iron Grate Moat & Security Fence (x = cx - 2 .. cx + 2, y = cy - 3 .. cy - 1)
    // + 2×2 Secret Descending Stairway in the floor (x = cx - 1 .. cx, y = cy .. cy + 1)
    for (let y = cy - 3; y <= cy + 1; y += 1) {
      for (let x = cx - 2; x <= cx + 2; x += 1) {
        const col = x - (cx - 2); // 0..4
        const isOuterMoat = col === 0 || col === 4 || y === cy - 3;
        const isSecretStairTop = y === cy && (x === cx - 1 || x === cx);
        const isSecretStairBottom = y === cy + 1 && (x === cx - 1 || x === cx);

        if (isInterior) {
          const beforeLower =
            y >= cy
              ? pal.baseFloor
              : isOuterMoat
                ? 906 // 쇠 격자 해자 바닥
                : 582; // 잠긴 감옥 돌 제단
          const beforeUpper =
            y >= cy - 1
              ? -1
              : y === cy - 3
                ? col === 0 || col === 4
                  ? 5708
                  : col === 2
                    ? 6421
                    : 5736 // 잠긴 철창과 보안 울타리
                : col === 0 || col === 4
                  ? 5745 // 좌우 보안 울타리
                  : col === 2
                    ? 6422
                    : 5736;

          const afterLower = isSecretStairTop
            ? x === cx - 1
              ? 3960 // 2×2 내려가는 비밀 계단 (0,0)
              : 3961 // 2×2 내려가는 비밀 계단 (1,0)
            : isSecretStairBottom
              ? x === cx - 1
                ? 3962 // 2×2 내려가는 비밀 계단 (0,1)
                : 3963 // 2×2 내려가는 비밀 계단 (1,1)
              : 726 + (col % 4); // 금줄 드워프 판석
          const afterLower2 =
            (y === cy - 2 || y === cy - 1) && col >= 1 && col <= 3
              ? col === 1
                ? 5462
                : col === 2
                  ? 5466
                  : 5487 // 3칸 진홍 황금 카펫 제단
              : undefined;
          const afterUpper =
            isSecretStairTop || isSecretStairBottom
              ? -1
              : y === cy - 3
                ? col === 0 || col === 4
                  ? 3660 // 황금 촛대 상단
                  : col === 1
                    ? 3712 // 황금 보물 더미 좌
                    : col === 2
                      ? 3713 // 황금 보물 더미 우
                      : 6453 // 발광 마나 결정
                : y === cy - 2 && (col === 0 || col === 4)
                  ? 3672 // 황금 촛대 하단
                  : -1;

          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            ...(afterLower2 !== undefined ? { afterLower2 } : {}),
            afterUpper,
          });
        } else {
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower: isOuterMoat && y < cy ? pal.chasmLower : pal.baseFloor,
            beforeUpper: y <= cy - 2 ? pal.sealedUpper : -1,
            afterLower: isSecretStairTop || isSecretStairBottom ? pal.accentFloor : pal.revealFloor,
            afterUpper: isSecretStairTop || isSecretStairBottom ? pal.pillarTop : -1,
          });
        }
      }
    }

    extraEvents.push({
      event: makeRevealedCrystalEvent(baseId, solveSwitchId, "sacred_relic", { x: cx + 1, y: cy }, {
        name: "출현한 고대 성유물",
        beforeText: "진실의 상자를 열면 비밀 계단과 함께 성유물이 떠오를 문양이다.",
        afterText: "진실의 상자가 열리며 2×2 지하 비밀 계단 옆에 찬란한 「고대 성유물」이 모습을 드러냈다!",
      }),
      role: "출현한 발광 성유물",
    });

    const cTablet: Cell = { x: cx + 2, y: cy + 1 };
    const cDecoy1: Cell = { x: cx - 1, y: cy - 1 };
    const cDecoy2: Cell = { x: cx + 1, y: cy - 1 };
    const cTrue: Cell = { x: cx, y: cy - 1 };
    return {
      center,
      origin,
      cells: [cTablet, cDecoy1, cDecoy2, cTrue],
      changeTileCommands,
      stepChangeTileCommands,
      extraEvents,
      snapshot,
    };
  }

  if (presetId === "boss_seal_monoliths") {
    const isSky = tsId === "sky_island";

    // Northern Sanctuary Gate Bridge (x = cx - 1 .. cx + 2, y = cy - 4)
    for (let x = cx - 1; x <= cx + 2; x += 1) {
      const col = x - (cx - 1);
      if (isSky) {
        setBeforeAndAfterTile(project, map, changeTileCommands, x, cy - 4, {
          beforeLower: 1, // 하늘 심연 단절
          beforeUpper: -1,
          afterLower: col === 0 ? 106 : col === 3 ? 107 : 105, // 돌다리 상판 개방!
          afterUpper: -1,
        });
      } else {
        setBeforeAndAfterTile(project, map, changeTileCommands, x, cy - 4, {
          beforeLower: pal.chasmLower,
          beforeUpper: pal.sealedUpper,
          afterLower: pal.revealFloor,
          afterUpper: -1,
        });
      }
    }

    // 4×4 Sealed Boss Portal Ring (x = cx - 1 .. cx + 2, y = cy - 3 .. cy, 16 tiles!)
    for (let y = cy - 3; y <= cy; y += 1) {
      for (let x = cx - 1; x <= cx + 2; x += 1) {
        const col = x - (cx - 1); // 0..3
        const row = y - (cy - 3); // 0..3
        const isInnerCore = (col === 1 || col === 2) && (row === 1 || row === 2);

        if (isSky) {
          const beforeLower = isInnerCore ? 21 : 529; // 심연 코어 + 암석 봉인 링
          const beforeUpper = isInnerCore
            ? row === 1
              ? 406 // 봉인된 자수정 상단
              : 407 // 봉인된 자수정 하단
            : row === 0
              ? col === 0 || col === 2
                ? 416
                : 417 // 봉인 결계 기둥
              : row === 1
                ? 508 // 어두운 봉인 비석 상단
                : row === 2
                  ? 509 // 어두운 봉인 비석 하단
                  : col === 0 || col === 3
                    ? 400 // 봉인 암석
                    : -1;

          const afterLower = isInnerCore ? 531 : 33; // 별 무늬 보스 포털 코어 + 반짝이는 구름 마법진!
          const afterUpper =
            row === 0
              ? col <= 2
                ? 580 + col // 3×2 수정 신전 제단 상단 (580, 581, 582)
                : 506 // 천사 날개 석상 상단
              : row === 1
                ? col <= 2
                  ? 583 + col // 3×2 수정 신전 제단 하단 (583, 584, 585)
                  : 507 // 천사 날개 석상 하단
                : row === 2
                  ? col === 0 || col === 3
                    ? 408 // 부유 발광 수정 상단
                    : -1
                  : col === 0 || col === 3
                    ? 409 // 부유 발광 수정 하단
                    : -1;

          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower,
            beforeUpper,
            afterLower,
            afterUpper,
          });
        } else {
          setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
            beforeLower: isInnerCore ? pal.chasmLower : pal.sealedLower,
            beforeUpper: row < 3 ? pal.sealedUpper : -1,
            afterLower: isInnerCore ? pal.accentFloor : pal.revealFloor,
            afterUpper: row === 0 ? pal.lightBottom : -1,
          });
        }
      }
    }

    // 3 Dormant Monolith Pillars around the 4×4 ring -> Transform into glowing floating crystals on each step!
    const monoPillars: readonly [Cell, Cell, Cell] = [
      { x: cx - 2, y: cy - 2 },
      { x: cx + 3, y: cy - 2 },
      { x: cx - 3, y: cy + 1 },
    ];
    for (let i = 0; i < 3; i += 1) {
      const pCell = monoPillars[i]!;
      const stepCmds: Command[] = [];
      setMapTileBefore(project, map, pCell.x, pCell.y, {
        lower: isSky ? 529 : pal.sealedLower,
        upper: isSky ? 509 : pal.pillarBottom,
      });
      pushVerifiedChangeTile(project, map, stepCmds, "lower", pCell.x, pCell.y, isSky ? 33 : pal.revealFloor);
      pushVerifiedChangeTile(project, map, stepCmds, "upper", pCell.x, pCell.y, isSky ? 408 : pal.lightTop);
      stepChangeTileCommands[`monolith_${i + 1}`] = stepCmds;
      changeTileCommands.push(...stepCmds);
    }

    extraEvents.push({
      event: makeRevealedChestEvent(baseId, solveSwitchId, { x: cx + 1, y: cy + 1 }, {
        name: "성역 봉인 보물상자",
        beforeText: "태양·달·별 3비석이 모두 깨어나면 4×4 마법진과 함께 열릴 성역 보물 자리다.",
        afterText: "찬란하게 개방된 4×4 보스 마법진 앞에서 「성역 봉인 보물상자」를 열었다!",
      }),
      role: "마법진 출현 보물상자",
    });

    const cM1: Cell = { x: cx - 2, y: cy - 1 };
    const cM2: Cell = { x: cx + 3, y: cy - 1 };
    const cM3: Cell = { x: cx - 2, y: cy + 1 };
    const cBossGate: Cell = { x: cx, y: cy };
    return {
      center,
      origin,
      cells: [cM1, cM2, cM3, cBossGate],
      changeTileCommands,
      stepChangeTileCommands,
      extraEvents,
      snapshot,
    };
  }

  // Remaining 6 presets in PUZZLE_PRESET_CATALOG: stamp a 5×3 multi-tile barrier/bridge/corridor (15 tiles)
  for (let y = cy - 3; y <= cy - 1; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      const isCenter = x >= cx - 1 && x <= cx + 1;
      setBeforeAndAfterTile(project, map, changeTileCommands, x, y, {
        beforeLower: isCenter ? pal.chasmLower : pal.sealedLower,
        beforeUpper: pal.sealedUpper,
        afterLower: isCenter ? pal.revealFloor : pal.accentFloor,
        afterUpper: isCenter ? -1 : pal.lightBottom,
      });
    }
  }

  const defaultCells: readonly Cell[] = [
    { x: cx - 2, y: cy + 1 },
    { x: cx, y: cy },
    { x: cx + 2, y: cy + 1 },
    { x: cx + 1, y: cy },
  ];
  return {
    center,
    origin,
    cells: defaultCells,
    changeTileCommands,
    stepChangeTileCommands,
    extraEvents,
    snapshot,
  };
}
