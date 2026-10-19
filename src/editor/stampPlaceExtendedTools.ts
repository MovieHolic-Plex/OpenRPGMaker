// src/editor/stampPlaceExtendedTools.ts
// 바로 깔기(Fast-Path) 확장 22종 도구 결정론 시공기 (Priority 1·2·3)
// - Group 1 (지형·도하): place_bridge, carve_waterfall_pond, carve_lake_island, retheme_season_biome
// - Group 2 (지구·인프라): build_market_bazaar, build_harbor_dock, build_farm_ranch, build_rail_crossing
// - Group 3 (작동하는 마을 시설): place_inn, place_church_healer, place_guild_board, place_travel_portal
// - Group 4 (필드 조우·기믹): place_roaming_enemies, place_switch_and_gate, place_camp_rest, place_mimic_and_sparkles
// - Group 5 (스마트 배치·일괄 편집): repeat_line_or_grid, mirror_region, enclose_with_wall, auto_connect_roads
// - Group 6 (생동감·군중·날씨 조명): populate_crowd, set_mood_weather

import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { PlacedMapObjectSummary, StampPlanFacts, StampRect, StampStep, StampTool } from "@/ai/stampPlanner";
import { charsetGraphic } from "@/editor/tools/eventCompile";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { captureStructureTiles, makeStructurePlacement } from "@/project/structurePlacements";
import type {
  Command,
  Dir,
  EventPage,
  EventPageCondition,
  EventPageGraphic,
  GameEvent,
  GameMap,
  Project,
  TilesetDef,
} from "@/project/types";

export const EXTENDED_STAMP_TOOLS: ReadonlySet<StampTool> = new Set<StampTool>([
  "place_bridge",
  "carve_waterfall_pond",
  "carve_lake_island",
  "retheme_season_biome",
  "build_market_bazaar",
  "build_harbor_dock",
  "build_farm_ranch",
  "build_rail_crossing",
  "place_inn",
  "place_church_healer",
  "place_guild_board",
  "place_travel_portal",
  "place_roaming_enemies",
  "place_switch_and_gate",
  "place_camp_rest",
  "place_mimic_and_sparkles",
  "repeat_line_or_grid",
  "mirror_region",
  "enclose_with_wall",
  "auto_connect_roads",
  "populate_crowd",
  "set_mood_weather",
]);

export interface ExtendedTilePatch {
  readonly x: number;
  readonly y: number;
  readonly lower?: number;
  readonly upper?: number;
}

export interface ExtendedStampContext {
  readonly project: Project;
  readonly previewMap: GameMap;
  readonly tileset: TilesetDef;
  readonly facts: StampPlanFacts;
  readonly variation: number;
  readonly stampKitDirect: (
    kitId: string,
    ox: number,
    oy: number,
    label?: string,
    note?: string,
    group?: string,
  ) => StampStep[];
  readonly applyRoadAutotile: (
    roadMask: Uint8Array,
    isProtectedCell: (x: number, y: number) => boolean,
    label: string,
  ) => StampStep[];
  readonly queueTilePatch: (patches: readonly ExtendedTilePatch[]) => void;
  readonly queueEventUpsert: (event: GameEvent) => void;
  readonly queueSwitchEnsure: (switchId: string, name: string) => void;
  readonly detectObjects: (map: GameMap, tileset: TilesetDef | undefined) => PlacedMapObjectSummary[];
}

const FIXED_MOVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

function objCharsetGraphic(sheet: "object1" | "object2" | "monster1", characterIndex: number, direction: Dir = "down"): EventPageGraphic {
  const base = charsetGraphic(`tex_easyrpg_charset_${sheet}`, characterIndex);
  return {
    ...base,
    direction,
    pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
  };
}

function makeNativePage(opts: {
  readonly id: string;
  readonly name: string;
  readonly conditions?: readonly EventPageCondition[];
  readonly graphic: EventPageGraphic;
  readonly trigger?: "action" | "playerTouch" | "eventTouch" | "touch" | "auto" | "parallel";
  readonly priority?: EventPage["priority"];
  readonly overlapForbidden?: boolean;
  readonly movement?: EventPage["movement"];
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
    animationType: (opts.movement?.type ?? "fixed") === "fixed" ? "fixedGraphic" : "normal",
    movement: opts.movement ?? FIXED_MOVE,
    commands: [...opts.commands],
  };
}

function makeAnchorPaintStep(
  ctx: ExtendedStampContext,
  patches: readonly ExtendedTilePatch[],
  label: string,
  note?: string,
): StampStep[] {
  if (patches.length === 0) return [];
  ctx.queueTilePatch(patches);
  for (const p of patches) {
    if (p.x < 0 || p.y < 0 || p.x >= ctx.previewMap.width || p.y >= ctx.previewMap.height) continue;
    const idx = p.y * ctx.previewMap.width + p.x;
    if (p.lower !== undefined) ctx.previewMap.lowerTiles[idx] = p.lower;
    if (p.upper !== undefined) ctx.previewMap.upperTiles[idx] = p.upper;
  }
  const first = patches[0]!;
  const anchorTile = first.lower !== undefined && first.lower >= 0
    ? first.lower
    : (ctx.previewMap.lowerTiles[first.y * ctx.previewMap.width + first.x] ?? 737);
  return [
    {
      tool: "paint_tiles",
      label,
      ...(note ? { note } : {}),
      args: {
        mapId: ctx.facts.mapId,
        layer: "lower",
        mode: "cells",
        tile: anchorTile,
        cells: [{ x: first.x, y: first.y }],
      },
    },
  ];
}

function computeWaterAutotilePatches(
  waterMask: Uint8Array,
  W: number,
  H: number,
  tileset: TilesetDef,
): ExtendedTilePatch[] {
  const canalGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_canal_lake_47");
  const bits: readonly [number, number, number][] = [
    [0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8],
    [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128],
  ];
  const patches: ExtendedTilePatch[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!waterMask[y * W + x]) continue;
      let m = 0;
      for (const [dx, dy, bit] of bits) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || waterMask[ny * W + nx] === 1) m |= bit;
      }
      const tile = canalGroup?.variantMap?.[String(m)] ?? 23152;
      patches.push({ x, y, lower: tile, upper: -1 });
    }
  }
  return patches;
}

export function collectOverlappingPropClearPatches(
  ctx: Pick<ExtendedStampContext, "previewMap" | "tileset" | "detectObjects">,
  rect: StampRect,
  margin: number,
  houseCells: ReadonlySet<string>,
): ExtendedTilePatch[] {
  const { previewMap, tileset } = ctx;
  const W = previewMap.width;
  const H = previewMap.height;
  const x0 = Math.max(0, rect.x - margin);
  const y0 = Math.max(0, rect.y - margin);
  const x1 = Math.min(W - 1, rect.x + rect.w - 1 + margin);
  const y1 = Math.min(H - 1, rect.y + rect.h - 1 + margin);
  const clearSet = new Set<number>();

  const protectedBuildingCells = new Set<string>(houseCells);
  const detected = ctx.detectObjects(previewMap, tileset);
  for (const obj of detected) {
    const isBuilding =
      obj.kind === "structure" ||
      /집|주택|민가|오두막|여관|상점|가게|성|성채|회관|신전|성당|house|inn|shop|castle|hall|temple/iu.test(
        `${obj.coreName} ${obj.name} ${obj.kitId ?? ""}`,
      );
    if (isBuilding) {
      for (let y = Math.max(0, obj.y); y < Math.min(H, obj.y + obj.h); y++) {
        for (let x = Math.max(0, obj.x); x < Math.min(W, obj.x + obj.w); x++) {
          protectedBuildingCells.add(`${x},${y}`);
        }
      }
      continue;
    }
    const ox1 = obj.x + obj.w - 1;
    const oy1 = obj.y + obj.h - 1;
    if (ox1 < x0 || obj.x > x1 || oy1 < y0 || obj.y > y1) continue;
    for (let y = Math.max(0, obj.y); y <= Math.min(H - 1, oy1); y++) {
      for (let x = Math.max(0, obj.x); x <= Math.min(W - 1, ox1); x++) {
        if (!protectedBuildingCells.has(`${x},${y}`)) clearSet.add(y * W + x);
      }
    }
  }

  const queue: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (protectedBuildingCells.has(`${x},${y}`)) continue;
      const cellIdx = y * W + x;
      if ((previewMap.upperTiles[cellIdx] ?? -1) >= 0 && !clearSet.has(cellIdx)) {
        clearSet.add(cellIdx);
        queue.push({ x, y });
      }
    }
  }
  const maxExpandPad = 4;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < Math.max(0, x0 - maxExpandPad) || ny < Math.max(0, y0 - maxExpandPad) || nx > Math.min(W - 1, x1 + maxExpandPad) || ny > Math.min(H - 1, y1 + maxExpandPad)) {
          continue;
        }
        if (protectedBuildingCells.has(`${nx},${ny}`)) continue;
        const nIdx = ny * W + nx;
        if (clearSet.has(nIdx)) continue;
        const ut = previewMap.upperTiles[nIdx] ?? -1;
        if (ut < 0 || ut === 2652 || ut === 28289 || ut === 2418) continue;
        clearSet.add(nIdx);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  const patches: ExtendedTilePatch[] = [];
  for (const cellIdx of clearSet) {
    const x = cellIdx % W;
    const y = Math.floor(cellIdx / W);
    previewMap.upperTiles[cellIdx] = -1;
    patches.push({ x, y, upper: -1 });
  }
  return patches;
}

function buildRoadMaskWithBranch(
  previewMap: GameMap,
  tileset: TilesetDef,
  branchCells: readonly { x: number; y: number }[],
  doorSet?: ReadonlySet<string>,
): { readonly patches: ExtendedTilePatch[] } {
  const W = previewMap.width;
  const H = previewMap.height;
  const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
  if (!roadGroup) return { patches: [] };
  const roadSet = new Set<number>(roadGroup.memberTileIds);
  const roadMask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (roadSet.has(previewMap.lowerTiles[y * W + x] ?? -1)) roadMask[y * W + x] = 1;
    }
  }
  let minX = W;
  let maxX = -1;
  let minY = H;
  let maxY = -1;
  for (const c of branchCells) {
    if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) continue;
    roadMask[c.y * W + c.x] = 1;
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  if (maxX < minX) return { patches: [] };
  const bits: readonly [number, number, number][] = [
    [0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8],
    [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128],
  ];
  const patches: ExtendedTilePatch[] = [];
  for (let y = Math.max(0, minY - 1); y <= Math.min(H - 1, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(W - 1, maxX + 1); x++) {
      if (!roadMask[y * W + x]) continue;
      let m = 0;
      for (const [dx, dy, bit] of bits) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
          m |= bit;
          continue;
        }
        const nLower = previewMap.lowerTiles[ny * W + nx] ?? -1;
        if (roadMask[ny * W + nx] === 1 || doorSet?.has(`${nx},${ny}`) || nLower === 1509 || nLower === 25851) {
          m |= bit;
        }
      }
      const tile = roadGroup.variantMap[String(m)] ?? roadGroup.memberTileIds[0] ?? 1008;
      patches.push({ x, y, lower: tile });
    }
  }
  return { patches };
}

export function expandExtendedSpatialStep(
  step: StampStep,
  ctx: ExtendedStampContext,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[] } {
  const { previewMap, tileset, facts } = ctx;
  const W = previewMap.width;
  const H = previewMap.height;
  const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x: number, y: number): number => y * W + x;
  const houseCells = new Set<string>(protectedHouseCells(previewMap).map((c) => `${c.x},${c.y}`));
  const area = (step.args.area as StampRect | undefined) ?? (step.args.rect as StampRect | undefined) ?? facts.target;
  const cx = area.x + Math.floor(area.w / 2);
  const cy = area.y + Math.floor(area.h / 2);
  const out: StampStep[] = [];
  const dropped: string[] = [];

  switch (step.tool) {
    // ── 1. place_bridge (다리·수문 횡단교 + 양안 진입로) ──────────────────────
    case "place_bridge": {
      const style = (step.args.style as "stone" | "wood" | "sluice" | undefined) ?? "stone";
      // 영역 내 물줄기 방향 감지 (수평 강이면 남북 다리, 수직 강이면 동서 다리)
      let waterHoriz = 0;
      let waterVert = 0;
      let hasWater = false;
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (facts.isWaterCell?.(x, y)) {
            hasWater = true;
            if (Math.abs(y - cy) <= 2) waterHoriz++;
            if (Math.abs(x - cx) <= 2) waterVert++;
          }
        }
      }
      const riverHoriz = step.args.direction === "vertical"
        ? true
        : step.args.direction === "horizontal"
          ? false
          : hasWater
            ? waterHoriz >= waterVert
            : area.w >= area.h;

      const patches: ExtendedTilePatch[] = [];
      // 물이 아직 없으면 다리 아래로 물줄기를 먼저 내어 다리가 실제로 물을 건너게 한다
      if (!hasWater) {
        const waterMask = new Uint8Array(W * H);
        if (riverHoriz) {
          const wy0 = Math.max(0, Math.min(H - 4, cy - 1));
          for (let x = area.x; x < area.x + area.w; x++) {
            for (let dy = 0; dy < 3; dy++) {
              if (!houseCells.has(`${x},${wy0 + dy}`)) waterMask[idx(x, wy0 + dy)] = 1;
            }
          }
        } else {
          const wx0 = Math.max(0, Math.min(W - 4, cx - 1));
          for (let y = area.y; y < area.y + area.h; y++) {
            for (let dx = 0; dx < 4; dx++) {
              if (!houseCells.has(`${wx0 + dx},${y}`)) waterMask[idx(wx0 + dx, y)] = 1;
            }
          }
        }
        patches.push(...computeWaterAutotilePatches(waterMask, W, H, tileset));
      }

      const branchRoad: { x: number; y: number }[] = [];
      if (riverHoriz) {
        const bx = Math.max(0, Math.min(W - 4, cx - 1));
        const by = Math.max(0, Math.min(H - 6, cy - 2));
        for (let y = Math.max(0, by - 2); y <= Math.min(H - 1, by + 6); y++) {
          for (let x = bx; x < Math.min(W, bx + 3); x++) {
            if (!facts.isWaterCell?.(x, y)) branchRoad.push({ x, y });
          }
        }
        const roadPatch = buildRoadMaskWithBranch(previewMap, tileset, branchRoad);
        patches.push(...roadPatch.patches);
        out.push(...makeAnchorPaintStep(ctx, patches, step.label, "물줄기 횡단 다리 및 양안 포석 진입로"));
        if (style === "sluice") {
          out.push(...ctx.stampKitDirect("bd-pick-riverside-mill-sluice-gate", bx, by + 1));
        } else {
          out.push(...ctx.stampKitDirect("bd-pick-volcano-cave-bridge", bx, by));
        }
        if (bx - 2 >= 0 && by - 1 >= 0) out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", bx - 1, by - 1));
        if (bx + 3 < W && by + 4 < H) out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", bx + 3, by + 4));
      } else {
        const bx = Math.max(0, Math.min(W - 5, cx - 2));
        const by = Math.max(0, Math.min(H - 4, cy - 2));
        for (let x = Math.max(0, bx - 2); x <= Math.min(W - 1, bx + 6); x++) {
          for (let y = by + 1; y <= Math.min(H - 1, by + 2); y++) {
            if (!facts.isWaterCell?.(x, y)) branchRoad.push({ x, y });
          }
        }
        const roadPatch = buildRoadMaskWithBranch(previewMap, tileset, branchRoad);
        patches.push(...roadPatch.patches);
        out.push(...makeAnchorPaintStep(ctx, patches, step.label, "물줄기 횡단 다리 및 양안 포석 진입로"));
        const kitId = style === "wood"
          ? "bd-pick-riverside-mill-plank-footbridge"
          : style === "sluice"
            ? "bd-pick-riverside-mill-sluice-gate"
            : "bd-pick-mountain-pass-stone-bridge";
        out.push(...ctx.stampKitDirect(kitId, bx, by));
      }
      return { steps: out, dropped };
    }

    // ── 2. carve_waterfall_pond (북쪽 암벽 폭포 + 폭포수 연못 + 수변 바위·나무) ──
    case "carve_waterfall_pond": {
      const wfKit = (tileset.structureKits ?? []).find((k) => k.id === "bd-waterfall-drop")
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-waterfall-wall");
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, area, 0, houseCells),
      ];
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (inb(x, y) && !houseCells.has(`${x},${y}`)) {
            patches.push({ x, y, upper: -1 });
          }
        }
      }
      const wfW = wfKit ? Math.min(wfKit.width, area.w) : Math.min(10, area.w);
      const wfH = wfKit ? Math.min(wfKit.height, Math.max(4, Math.floor(area.h * 0.55))) : 5;
      const wfX = Math.max(0, Math.min(W - wfW, cx - Math.floor(wfW / 2)));
      const wfY = Math.max(0, area.y);
      const srcOffsetX = wfKit ? Math.max(0, Math.floor((wfKit.width - wfW) / 2)) : 0;

      // 남쪽 폭포수 연못(splash pond) 오토타일 마스크 생성
      const waterMask = new Uint8Array(W * H);
      const pondY0 = Math.min(H - 3, wfY + wfH - 1);
      const pondY1 = Math.min(H - 1, area.y + area.h - 1);
      const pondRx = Math.max(3, Math.floor(area.w * 0.42));
      const pondCy = Math.floor((pondY0 + pondY1) / 2);
      const pondRy = Math.max(2, Math.ceil((pondY1 - pondY0 + 1) / 2));
      for (let y = pondY0; y <= pondY1; y++) {
        for (let x = Math.max(0, cx - pondRx); x <= Math.min(W - 1, cx + pondRx); x++) {
          const nx = (x - cx) / Math.max(1, pondRx);
          const ny = (y - pondCy) / Math.max(1, pondRy);
          if (nx * nx + ny * ny <= 1.08 && !houseCells.has(`${x},${y}`)) {
            waterMask[idx(x, y)] = 1;
          }
        }
      }
      patches.push(...computeWaterAutotilePatches(waterMask, W, H, tileset));

      // 북쪽 암벽 폭포 키트 스탬프
      if (wfKit) {
        for (let dy = 0; dy < wfH; dy++) {
          const row = wfKit.rows[dy];
          if (!row) continue;
          for (let dx = 0; dx < wfW; dx++) {
            const x = wfX + dx;
            const y = wfY + dy;
            if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
            const lt = row.tiles[srcOffsetX + dx] ?? -1;
            const ut = row.upperTiles?.[srcOffsetX + dx] ?? -1;
            if (lt >= 0 || ut >= 0) {
              patches.push({
                x,
                y,
                ...(lt >= 0 ? { lower: lt } : {}),
                ...(ut >= 0 ? { upper: ut } : { upper: -1 }),
              });
            }
          }
        }
      }

      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "북쪽 절벽 폭포 낙차 + 폭포수 연못 + 수변 조경"));
      // 연못 징검돌·수변 바위·나무 배치
      if (inb(cx, pondY1)) {
        out.push(...ctx.stampKitDirect("bd-pick-deep-forest-path-stones-a", cx, pondY1));
      }
      if (inb(cx - 1, pondY1)) {
        out.push(...ctx.stampKitDirect("bd-pick-deep-forest-path-stones-b", cx - 1, pondY1));
      }
      if (area.x + 1 < wfX && inb(area.x + 1, pondY0)) {
        out.push(...ctx.stampKitDirect("bd-tree-f4f319", area.x + 1, Math.max(0, pondY0 - 1)));
      }
      if (wfX + wfW + 1 < area.x + area.w - 1 && inb(wfX + wfW, pondY0)) {
        out.push(...ctx.stampKitDirect("bd-pick-mountain-pass-boulder-m", wfX + wfW, pondY0));
      }
      return { steps: out, dropped };
    }

    // ── 3. carve_lake_island (호수 위 작은 섬 + 사당/정자/석상 + 징검돌 다리) ──
    case "carve_lake_island": {
      const centerpiece = (step.args.centerpiece as "shrine" | "pavilion" | "statue" | undefined) ?? "shrine";
      const waterMask = new Uint8Array(W * H);
      const rx = Math.max(4, Math.floor((area.w - 2) / 2));
      const ry = Math.max(3, Math.floor((area.h - 2) / 2));
      const irx = Math.max(2, Math.floor(rx * 0.45));
      const iry = Math.max(2, Math.floor(ry * 0.45));

      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
          const dx = (x - cx) / Math.max(1, rx);
          const dy = (y - cy) / Math.max(1, ry);
          const idxIsl = (x - cx) / Math.max(1, irx);
          const idyIsl = (y - cy) / Math.max(1, iry);
          // 남쪽 중앙 1~2칸 폭 진입로는 징검돌/다리 다리목으로 남겨 둔다
          const isCauseway = y >= cy + iry && Math.abs(x - cx) <= 0;
          if (dx * dx + dy * dy <= 1.05 && idxIsl * idxIsl + idyIsl * idyIsl > 1.0 && !isCauseway) {
            waterMask[idx(x, y)] = 1;
          }
        }
      }

      const patches: ExtendedTilePatch[] = [];
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (inb(x, y) && !houseCells.has(`${x},${y}`)) {
            patches.push({ x, y, lower: 737, upper: -1 });
          }
        }
      }
      patches.push(...computeWaterAutotilePatches(waterMask, W, H, tileset));
      // 섬 중앙 바닥을 신전 트래버틴/판석으로 품격 있게 포장
      for (let y = cy - iry + 1; y <= cy + iry - 1; y++) {
        for (let x = cx - irx + 1; x <= cx + irx - 1; x++) {
          if (inb(x, y) && !waterMask[idx(x, y)]) {
            patches.push({ x, y, lower: 1509, upper: -1 });
          }
        }
      }
      // 남쪽 호숫가와 섬을 잇는 돌다리/징검돌 길
      for (let y = cy + iry; y < area.y + area.h; y++) {
        if (inb(cx, y)) {
          patches.push({ x: cx, y, lower: 1509, upper: -1 });
        }
      }

      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "호수 및 중앙 섬·진입 징검돌 다리 시공"));
      if (centerpiece === "pavilion") {
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-roof-baldachin", Math.max(0, cx - 2), Math.max(0, cy - 2)));
      } else if (centerpiece === "statue") {
        out.push(...ctx.stampKitDirect("bd-prop-statue_sage", Math.max(0, cx - 1), Math.max(0, cy - 2)));
      } else {
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-roof-hip-shrine", Math.max(0, cx - 1), Math.max(0, cy - 1)));
      }
      for (let y = cy + iry; y < Math.min(H - 1, area.y + area.h - 1); y += 2) {
        out.push(...ctx.stampKitDirect("bd-pick-deep-forest-path-stones-a", cx, y));
      }
      return { steps: out, dropped };
    }

    // ── 4. retheme_season_biome (설원·가을 단풍·고대 폐허·화산 지대 리테마) ──
    case "retheme_season_biome": {
      const theme = (step.args.theme as "winter_snow" | "autumn" | "ruins" | "volcanic" | undefined) ?? "winter_snow";
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, area, 0, houseCells),
      ];
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
      const roadSet = new Set<number>(roadGroup?.memberTileIds ?? []);

      if (theme === "winter_snow") {
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
            const curLower = previewMap.lowerTiles[idx(x, y)] ?? 737;
            const isRoad = roadSet.has(curLower) || curLower === 1509;
            patches.push({
              x,
              y,
              lower: isRoad ? 25859 : 25839,
              ...(previewMap.upperTiles[idx(x, y)] >= 0 ? { upper: -1 } : {}),
            });
          }
        }
        out.push(...makeAnchorPaintStep(ctx, patches, step.label, "설원 눈 바닥·다져진 눈길 리테마"));
        out.push(...ctx.stampKitDirect("bd-pick-snowfield-pine", Math.max(0, area.x + 1), Math.max(0, area.y + 1)));
        if (area.w >= 8) {
          out.push(...ctx.stampKitDirect("bd-pick-snowfield-pine", Math.max(0, area.x + area.w - 3), Math.max(0, area.y + 1)));
        }
        out.push(...ctx.stampKitDirect("bd-pick-snowfield-snowman", Math.max(0, cx - 1), Math.max(0, cy)));
        if (area.w >= 10 && area.h >= 6) {
          out.push(...ctx.stampKitDirect("bd-pick-snowfield-bonfire", Math.max(0, cx + 2), Math.max(0, cy + 1)));
          out.push(...ctx.stampKitDirect("bd-pick-snowfield-lamp", Math.max(0, cx - 3), Math.max(0, cy - 1)));
        }
        out.push({
          tool: "set_scene_mood",
          label: "설원 눈 내리는 날씨",
          args: { mapId: facts.mapId, weather: { kind: "snow", intensity: 0.65 }, applyMode: "map" },
        });
      } else if (theme === "autumn") {
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
            const curLower = previewMap.lowerTiles[idx(x, y)] ?? 737;
            if (!roadSet.has(curLower) && curLower !== 1509) {
              patches.push({ x, y, lower: (x + y) % 3 === 0 ? 2502 : 737, upper: -1 });
            }
          }
        }
        out.push(...makeAnchorPaintStep(ctx, patches, step.label, "가을 황금 들녘·단풍나무 조경"));
        out.push(...ctx.stampKitDirect("bd-tree-f4f319", Math.max(0, area.x + 1), Math.max(0, area.y + 1)));
        out.push(...ctx.stampKitDirect("bd-tree-e9d9b3", Math.max(0, area.x + area.w - 3), Math.max(0, area.y + 1)));
        out.push(...ctx.stampKitDirect("bd-pick-riverside-mill-wheat-stooks-a", Math.max(0, cx - 2), Math.max(0, cy)));
        out.push(...ctx.stampKitDirect("bd-pick-riverside-mill-haystack", Math.max(0, cx + 1), Math.max(0, cy)));
      } else if (theme === "ruins") {
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
            patches.push({
              x,
              y,
              lower: (x + y) % 2 === 0 ? 26815 : 26816,
              upper: -1,
            });
          }
        }
        out.push(...makeAnchorPaintStep(ctx, patches, step.label, "고대 신전 폐허 석재 바닥·무너진 기둥 시공"));
        if (area.w >= 6 && area.h >= 5) {
          out.push(...ctx.stampKitDirect("bd-pick-deep-forest-path-ruin-gate", Math.max(0, cx - 2), Math.max(0, area.y + 1)));
        }
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-column-temple-broken", Math.max(0, area.x + 1), Math.max(0, cy)));
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-fallen-column-temple", Math.max(0, area.x + area.w - 3), Math.max(0, cy + 1)));
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-ruined-wall-2", Math.max(0, area.x + 2), Math.max(0, area.y + area.h - 3)));
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-rubble-temple", Math.max(0, cx + 2), Math.max(0, cy + 2)));
      } else {
        // volcanic
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
            const isLava = Math.abs(y - cy) <= 0 && x > area.x + 1 && x < area.x + area.w - 2;
            patches.push({
              x,
              y,
              lower: isLava ? 27292 : 25288,
              upper: -1,
            });
          }
        }
        out.push(...makeAnchorPaintStep(ctx, patches, step.label, "화산 재·용암 균열·흑요석 결정 시공"));
        out.push(...ctx.stampKitDirect("bd-pick-volcano-cave-brazier", Math.max(0, cx - 2), Math.max(0, area.y + 1)));
        out.push(...ctx.stampKitDirect("bd-pick-volcano-cave-brazier", Math.max(0, cx + 2), Math.max(0, area.y + 1)));
        out.push(...ctx.stampKitDirect("bd-pick-volcano-cave-spike-tall", Math.max(0, area.x + 1), Math.max(0, cy - 1)));
        out.push(...ctx.stampKitDirect("bd-pick-volcano-cave-fire-crystal", Math.max(0, area.x + area.w - 2), Math.max(0, cy + 1)));
        out.push(...ctx.stampKitDirect("bd-pick-volcano-cave-ember-a", Math.max(0, cx), Math.max(0, cy + 2)));
      }
      return { steps: out, dropped };
    }

    // ── 5. build_market_bazaar (포석 장터 광장 + 4~6종 노점/배너/수레 + 상인/손님 NPC) ──
    case "build_market_bazaar": {
      const roadCells: { x: number; y: number }[] = [];
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, area, 2, houseCells),
      ];
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
          patches.push({ x, y, upper: -1 });
          if (x >= area.x + 1 && x < area.x + area.w - 1 && y >= area.y && y < area.y + area.h - 1) {
            roadCells.push({ x, y });
          }
        }
      }
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, roadCells).patches);
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "포석 장터 광장 및 다중 노점·길드 깃발 시공"));

      const topY = Math.max(0, area.y + 1);
      const botY = Math.max(topY + 4, Math.min(H - 4, area.y + area.h - 4));
      out.push(...ctx.stampKitDirect("bd-pick-walled-market-banner-red", Math.max(0, area.x + 1), topY));
      out.push(...ctx.stampKitDirect("bd-prop-stall_cheese_meat", Math.max(0, area.x + 2), topY));
      if (area.w >= 9) {
        out.push(...ctx.stampKitDirect("bd-prop-stall_herb_flower", Math.max(0, cx - 1), topY));
      }
      if (area.w >= 12) {
        out.push(...ctx.stampKitDirect("bd-prop-stall_jug_bottle", Math.max(0, area.x + area.w - 4), topY));
        out.push(...ctx.stampKitDirect("bd-pick-walled-market-banner-teal", Math.max(0, area.x + area.w - 2), topY));
      }
      if (area.h >= 8) {
        out.push(...ctx.stampKitDirect("bd-prop-stall_veg", Math.max(0, area.x + 2), botY));
        out.push(...ctx.stampKitDirect("bd-prop-flower_cart", Math.max(0, cx + 1), botY + 1));
        out.push(...ctx.stampKitDirect("bd-prop-goods_pile", Math.max(0, area.x + area.w - 4), botY + 1));
      }

      const merchantX = Math.max(0, Math.min(W - 1, area.x + 3));
      const merchantY = Math.min(H - 1, topY + 4);
      out.push({
        tool: "make_villager",
        label: "장터 만물상인 NPC",
        args: {
          mapId: facts.mapId,
          name: "장터 만물상인",
          home: { x: merchantX, y: merchantY },
          graphic: { query: "merchant" },
          movement: "fixed",
          pages: [
            {
              lines: [
                "장터 만물상인: 골라 골라! 버들항 장터에 갓 들어온 약초와 식량, 모험 도구가 한가득이오!",
              ],
            },
          ],
          shop: {
            stock: [
              { itemId: "item_potion" },
              { itemId: "item_hi_potion" },
              { itemId: "item_antidote" },
              { itemId: "item_ether" },
            ],
          },
        },
      });
      out.push({
        tool: "place_npc",
        label: "장터 구경꾼 NPC",
        args: {
          mapId: facts.mapId,
          x: Math.min(W - 1, cx + 1),
          y: Math.min(H - 1, topY + 4),
          name: "장터 손님",
          graphic: { query: "villager" },
          movement: "random",
          pages: [
            {
              lines: [
                "장터 손님: 오늘 장터에 물건이 정말 다양하게 나왔네요! 향긋한 치즈랑 약초 냄새가 일품이에요.",
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 6. build_harbor_dock (석조 부두 안벽 + 나무 잔교 + 정박 선박 + 화물·선원 NPC) ──
    case "build_harbor_dock": {
      const waterMask = new Uint8Array(W * H);
      const splitY = area.y + Math.max(3, Math.floor(area.h * 0.45));
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, area, 2, houseCells),
      ];
      const quayCells: { x: number; y: number }[] = [];

      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
          patches.push({ x, y, upper: -1 });
          if (y < splitY) {
            quayCells.push({ x, y });
          } else {
            waterMask[idx(x, y)] = 1;
          }
        }
      }
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, quayCells).patches);
      patches.push(...computeWaterAutotilePatches(waterMask, W, H, tileset));

      // 중앙 나무 잔교(pier) 널빤지 바닥 (물 위로 뻗어 나감)
      const pierX = Math.max(0, Math.min(W - 3, cx - 1));
      for (let y = splitY; y < Math.min(H - 1, area.y + area.h - 1); y++) {
        for (let dx = 0; dx < 2; dx++) {
          if (inb(pierX + dx, y)) {
            patches.push({ x: pierX + dx, y, lower: 25851, upper: -1 });
          }
        }
      }
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "석조 부두 안벽·나무 잔교·수역 시공"));

      // 정박 어선·나룻배 및 항구 화물·닻·그물·가로등 배치
      if (pierX + 3 < area.x + area.w - 2 && splitY + 1 < H - 2) {
        out.push(...ctx.stampKitDirect("bd-pick-swamp-stilt-fishing-boat", pierX + 3, splitY + 1));
      }
      if (pierX - 3 >= area.x && splitY + 1 < H - 1) {
        out.push(...ctx.stampKitDirect("bd-pick-sea-cave-boat", pierX - 3, splitY + 1));
      }
      out.push(...ctx.stampKitDirect("bd-prop-anchor_display", Math.max(0, area.x + 1), Math.max(0, area.y + 1)));
      out.push(...ctx.stampKitDirect("bd-prop-fish_crates", Math.max(0, area.x + 4), Math.max(0, area.y + 1)));
      out.push(...ctx.stampKitDirect("bd-prop-mooring_bollard", Math.max(0, pierX - 1), Math.max(0, splitY - 1)));
      out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", Math.max(0, pierX + 2), Math.max(0, Math.max(0, splitY - 3))));
      if (area.w >= 11) {
        out.push(...ctx.stampKitDirect("bd-prop-net_rack", Math.max(0, area.x + area.w - 3), Math.max(0, area.y + 1)));
      }

      out.push({
        tool: "place_npc",
        label: "항구 선원 NPC",
        args: {
          mapId: facts.mapId,
          x: Math.max(0, pierX),
          y: Math.max(0, splitY - 1),
          name: "노련한 뱃사람",
          graphic: { query: "sailor" },
          movement: "fixed",
          pages: [
            {
              lines: [
                "노련한 뱃사람: 오늘 바닷바람이 순해서 출항하기 딱 좋은 날이구먼!",
                "노련한 뱃사람: 잔교 끝에 매어 둔 고깃배에 방금 건져 올린 싱싱한 생선이 가득하오.",
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 7. build_farm_ranch (울타리 농장 밭 이랑 + 헛간/닭장/우물/허수아비 + 가축·농부 NPC) ──
    case "build_farm_ranch": {
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, area, 2, houseCells),
      ];
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
          patches.push({ x, y, lower: 737, upper: -1 });
        }
      }
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "목장 울타리·경작지 이랑·헛간·가축 시공"));

      // 좌측 울타리 밭 / 경작지 플롯
      if (area.w >= 11 && area.h >= 7) {
        out.push(...ctx.stampKitDirect("bd-farm-fenced-plot", area.x + 1, area.y + 1));
        out.push(...ctx.stampKitDirect("bd-farm-plot-wheat", Math.min(W - 4, area.x + 9), area.y + 1));
        if (area.h >= 8) {
          out.push(...ctx.stampKitDirect("bd-farm-coop", Math.min(W - 3, area.x + 9), Math.min(H - 3, area.y + 5)));
        }
      } else {
        out.push(...ctx.stampKitDirect("bd-farm-plot-wheat", area.x + 1, area.y + 1));
        out.push(...ctx.stampKitDirect("bd-farm-plot-tomato", Math.min(W - 4, cx), area.y + 1));
      }
      if (area.w >= 12) {
        out.push(...ctx.stampKitDirect("bd-pick-riverside-mill-scarecrow", Math.min(W - 2, area.x + area.w - 3), area.y + 1));
        out.push(...ctx.stampKitDirect("bd-pick-coast-cliff-road-sheep-a", Math.min(W - 1, area.x + area.w - 2), Math.min(H - 1, cy + 1)));
        out.push(...ctx.stampKitDirect("bd-pick-coast-cliff-road-sheep-b", Math.min(W - 1, area.x + area.w - 3), Math.min(H - 1, cy + 2)));
      }

      out.push({
        tool: "place_npc",
        label: "농장주 NPC",
        args: {
          mapId: facts.mapId,
          x: Math.min(W - 1, area.x + 4),
          y: Math.min(H - 1, area.y + area.h - 1),
          name: "부지런한 농부",
          graphic: { query: "villager" },
          movement: "random",
          pages: [
            {
              lines: [
                "부지런한 농부: 올해는 햇살이 좋아서 밀이랑 배추, 토마토가 무럭무럭 자라고 있어요!",
                "부지런한 농부: 울타리 옆 목초지에서 양들도 평화롭게 풀을 뜯고 있답니다.",
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 8. build_rail_crossing (동서 철길 선로 + 남북 도로 건널목 + 간이역 승강장 + 광차/열차) ──
    case "build_rail_crossing": {
      const patches: ExtendedTilePatch[] = [];
      const roadCells: { x: number; y: number }[] = [];
      const trackY = Math.max(area.y + 2, Math.min(area.y + area.h - 3, cy));

      // 남북 도로 건널목
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let dx = -1; dx <= 0; dx++) {
          const rx = cx + dx;
          if (inb(rx, y) && !houseCells.has(`${rx},${y}`)) {
            roadCells.push({ x: rx, y });
          }
        }
      }
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, roadCells).patches);

      // 동서 철도 자갈 노반 + 침목 선로 (trackY - 1 .. trackY)
      for (let x = area.x; x < area.x + area.w; x++) {
        if (!inb(x, trackY) || houseCells.has(`${x},${trackY}`)) continue;
        const isCrossing = x === cx - 1 || x === cx;
        patches.push({
          x,
          y: trackY,
          lower: isCrossing ? 1509 : (x % 2 === 0 ? 25851 : 25288),
          upper: -1,
        });
        if (inb(x, trackY - 1) && !houseCells.has(`${x},${trackY - 1}`)) {
          patches.push({
            x,
            y: trackY - 1,
            lower: isCrossing ? 1509 : 25291,
            upper: -1,
          });
        }
      }
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "동서 철도 침목 선로·남북 건널목·간이역 승강장 시공"));

      // 선로 양끝 버퍼(선로 끝 막이) + 선로 위 광차/열차 + 건널목 등기둥 + 간이역 초소
      out.push(...ctx.stampKitDirect("bd-pick-mining-valley-buffer", area.x, trackY));
      out.push(...ctx.stampKitDirect("bd-pick-mining-valley-buffer", Math.min(W - 1, area.x + area.w - 1), trackY));
      if (area.x + 2 < cx - 2) {
        out.push(...ctx.stampKitDirect("bd-pick-mining-valley-cart-h", area.x + 2, Math.max(0, trackY - 1)));
      }
      if (cx + 2 < area.x + area.w - 3) {
        out.push(...ctx.stampKitDirect("bd-pick-mining-valley-cart-h", cx + 2, Math.max(0, trackY - 1)));
      }
      if (trackY - 4 >= area.y) {
        out.push(...ctx.stampKitDirect("bd-pick-walled-market-toll-booth", Math.max(0, cx + 2), Math.max(0, trackY - 4)));
      }
      if (cx - 3 >= area.x && trackY + 1 < H - 2) {
        out.push(...ctx.stampKitDirect("bd-pick-mining-valley-lamp", cx - 3, trackY + 1));
      }
      out.push({
        tool: "place_npc",
        label: "건널목 역무원 NPC",
        args: {
          mapId: facts.mapId,
          x: Math.min(W - 1, cx + 1),
          y: Math.min(H - 1, trackY + 1),
          name: "건널목 역무원",
          graphic: { query: "guard" },
          movement: "fixed",
          pages: [
            {
              lines: [
                "건널목 역무원: 땡땡땡! 광산 철도 열차와 화물 광차가 지나가는 건널목입니다. 좌우를 살피고 건너세요!",
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 9. place_inn (여관 건물 + 간판/주막 탁자 + 숙박·회복 여관 주인 NPC) ──
    case "place_inn": {
      const price = typeof step.args.price === "number" ? step.args.price : 20;
      const name = typeof step.args.name === "string" ? step.args.name : "여관 주인";
      const greeting = typeof step.args.greeting === "string" ? step.args.greeting : `어서 오세요! 따스한 벽난로와 침대가 있는 버들항 여관입니다. 하룻밤 숙박은 ${price}G 입니다.`;
      const innKit = (area.w >= 9 && area.h >= 9
        ? (tileset.structureKits ?? []).find((k) => k.id === "bd-house-inn")
        : undefined)
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-house-h109_0")
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-house-h103_1");

      const patches: ExtendedTilePatch[] = [];
      const innX = Math.max(0, Math.min(W - (innKit?.width ?? 5), area.x + 1));
      const innY = Math.max(0, Math.min(H - (innKit?.height ?? 6) - 2, area.y + 1));
      const innW = innKit?.width ?? 5;
      const innH = innKit?.height ?? 6;
      const clearRect: StampRect = { x: innX, y: innY, w: innW, h: innH };
      patches.push(...collectOverlappingPropClearPatches(ctx, clearRect, 2, houseCells));
      if (innKit) {
        const before = captureStructureTiles(previewMap, clearRect);
        for (let dy = 0; dy < innKit.height; dy++) {
          const row = innKit.rows[dy];
          if (!row) continue;
          for (let dx = 0; dx < innKit.width; dx++) {
            const x = innX + dx;
            const y = innY + dy;
            if (!inb(x, y)) continue;
            const lt = row.tiles[dx] ?? -1;
            const ut = row.upperTiles?.[dx] ?? -1;
            patches.push({
              x,
              y,
              lower: lt >= 0 ? lt : 737,
              upper: ut >= 0 ? ut : -1,
            });
          }
        }
        previewMap.structurePlacements = [
          ...(previewMap.structurePlacements ?? []),
          makeStructurePlacement(previewMap, {
            id: `inn_${innX}_${innY}`,
            kitId: innKit.id,
            rect: clearRect,
            before,
          }),
        ];
      }
      const doorPart = innKit?.parts?.find((p) => p.kind === "entrance");
      const doorX = innX + (doorPart ? doorPart.dx : Math.floor(innW / 2));
      const doorY = innY + (doorPart ? doorPart.dy + doorPart.h - 1 : innH - 1);
      const doorFrontY = Math.min(H - 1, innY + innH);
      const apronMaxX = Math.min(W, area.x + area.w, innX + innW + 2);
      const apronCells: { x: number; y: number }[] = [];
      for (let y = doorFrontY; y <= Math.min(H - 1, doorFrontY + 1); y++) {
        for (let x = innX; x < apronMaxX; x++) {
          apronCells.push({ x, y });
          patches.push({ x, y, upper: -1 });
        }
      }
      const innDoorSet = new Set<string>([`${doorX},${doorY}`, `${doorX + 1},${doorY}`]);
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, apronCells, innDoorSet).patches);
      out.push(...makeAnchorPaintStep(ctx, patches, `${name} 여관 건물과 앞마당 시공`, `숙박 요금 ${price}G · 전원 HP/MP 완전 회복`));

      const sideX = innX + innW + 1 <= area.x + area.w - 2 ? innX + innW + 1 : innX + innW;
      if (sideX + 1 < W && sideX + 1 < area.x + area.w) {
        out.push(...ctx.stampKitDirect("bd-prop-table_mugs", sideX, Math.max(0, doorFrontY - 2)));
        out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", sideX, Math.max(0, innY + 1)));
      }
      out.push({
        tool: "place_npc",
        label: `${name}(숙박·파티 회복)`,
        note: `요금 ${price}G · 숙박 시 화면 암전 후 파티 전원 HP/MP 완전 회복`,
        args: {
          mapId: facts.mapId,
          x: doorX,
          y: doorFrontY,
          name,
          graphic: { query: "여관 주인" },
          movement: "fixed",
          pages: [
            {
              lines: [greeting],
              commands: [{ kind: "inn", price, note: greeting }],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 10. place_church_healer (성당/예배당 + 현자 석상 + 치유·세이브 사제 NPC) ──
    case "place_church_healer": {
      const chapelKit = (tileset.structureKits ?? []).find((k) => k.id === "bd-house-rv-r6-10")
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-house-village-church")
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-pick-vineyard-temple-stone")
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-pick-temple-ruins-roof-naiskos-pediment");
      const chW = chapelKit?.width ?? 7;
      const chH = chapelKit?.height ?? 7;
      const chX = Math.max(0, Math.min(W - chW, area.x + 1));
      const chY = Math.max(0, Math.min(H - chH - 2, area.y));
      const chapelRect: StampRect = { x: chX, y: chY, w: chW, h: chH };
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, chapelRect, 2, houseCells),
      ];

      if (chapelKit) {
        const before = captureStructureTiles(previewMap, chapelRect);
        for (let dy = 0; dy < chapelKit.height; dy++) {
          const row = chapelKit.rows[dy];
          if (!row) continue;
          for (let dx = 0; dx < chapelKit.width; dx++) {
            const x = chX + dx;
            const y = chY + dy;
            if (!inb(x, y)) continue;
            const lt = row.tiles[dx] ?? -1;
            const ut = row.upperTiles?.[dx] ?? -1;
            patches.push({
              x,
              y,
              ...(lt >= 0 ? { lower: lt } : { lower: 737 }),
              upper: ut >= 0 ? ut : -1,
            });
          }
        }
        previewMap.structurePlacements = [
          ...(previewMap.structurePlacements ?? []),
          makeStructurePlacement(previewMap, {
            id: `chapel_${chX}_${chY}`,
            kitId: chapelKit.id,
            rect: chapelRect,
            before,
          }),
        ];
      }
      const chapelEntrance = chapelKit?.parts?.find((part) => part.kind === "entrance");
      const priestX = chX + (chapelEntrance ? chapelEntrance.dx : Math.floor(chW / 2));
      const frontY = Math.min(H - 1, chY + chH);
      const roadCells: { x: number; y: number }[] = [];
      for (let y = frontY; y <= Math.min(H - 1, frontY + 1); y++) {
        for (let x = chX; x < Math.min(W, area.x + area.w, chX + chW + 3); x++) {
          roadCells.push({ x, y });
          patches.push({ x, y, upper: -1 });
        }
      }
      const chapelDoorSet = new Set<string>([`${priestX},${frontY - 1}`, `${priestX + 1},${frontY - 1}`]);
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, roadCells, chapelDoorSet).patches);
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "성당 예배당·성녀 석상·치유 및 저장 사제 시공"));

      const statueX = Math.min(W - 2, chX + chW + 1);
      if (statueX + 1 < W && statueX < area.x + area.w && chY + 2 < H - 4) {
        out.push(...ctx.stampKitDirect("bd-prop-statue_sage", statueX, chY + 2));
      }
      out.push({
        tool: "place_npc",
        label: "치유 사제 NPC (전원 회복·저장)",
        args: {
          mapId: facts.mapId,
          x: priestX,
          y: frontY,
          name: "치유 사제 엘레나",
          graphic: { query: "priest" },
          movement: "fixed",
          pages: [
            {
              lines: [
                "치유 사제 엘레나: 길 잃은 여행자여, 빛의 성소에 오신 것을 환영합니다.",
              ],
              choices: [
                {
                  text: "치유의 기도를 받는다 (파티 전원 HP/MP 회복)",
                  commands: [
                    { kind: "recoverAll", actorId: "" },
                    { kind: "text", body: "치유 사제 엘레나: 은총의 빛이 그대와 동료들의 상처를 모두 치유하였습니다." },
                  ],
                },
                {
                  text: "여정의 기록을 남긴다 (세이브)",
                  commands: [
                    { kind: "checkpointSave" },
                    { kind: "openSaveMenu" },
                  ],
                },
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 11. place_guild_board (모험가 길드 + 3분기 선택지 의뢰 게시판 + 접수원 NPC) ──
    case "place_guild_board": {
      const guildKit = (tileset.structureKits ?? []).find((k) => k.id === "bd-pick-mining-valley-hall")
        ?? (tileset.structureKits ?? []).find((k) => k.id === "bd-house-h101_0");
      const gW = guildKit?.width ?? 7;
      const gH = guildKit?.height ?? 7;
      const gx = Math.max(0, Math.min(W - gW, area.x + 1));
      const gy = Math.max(0, Math.min(H - gH - 2, area.y));
      const guildRect: StampRect = { x: gx, y: gy, w: gW, h: gH };
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, guildRect, 2, houseCells),
      ];

      if (guildKit) {
        const before = captureStructureTiles(previewMap, guildRect);
        for (let dy = 0; dy < guildKit.height; dy++) {
          const row = guildKit.rows[dy];
          if (!row) continue;
          for (let dx = 0; dx < guildKit.width; dx++) {
            const x = gx + dx;
            const y = gy + dy;
            if (!inb(x, y)) continue;
            const lt = row.tiles[dx] ?? -1;
            const ut = row.upperTiles?.[dx] ?? -1;
            patches.push({
              x,
              y,
              ...(lt >= 0 ? { lower: lt } : { lower: 737 }),
              upper: ut >= 0 ? ut : -1,
            });
          }
        }
        previewMap.structurePlacements = [
          ...(previewMap.structurePlacements ?? []),
          makeStructurePlacement(previewMap, {
            id: `guild_${gx}_${gy}`,
            kitId: guildKit.id,
            rect: guildRect,
            before,
          }),
        ];
      }
      const guildDoorX = gx + Math.floor(gW / 2);
      const frontY = Math.min(H - 1, gy + gH);
      const roadCells: { x: number; y: number }[] = [];
      for (let y = frontY; y <= Math.min(H - 1, frontY + 1); y++) {
        for (let x = gx; x < Math.min(W, area.x + area.w, gx + gW + 3); x++) {
          roadCells.push({ x, y });
          patches.push({ x, y, upper: -1 });
        }
      }
      const guildDoorSet = new Set<string>([`${guildDoorX},${frontY - 1}`, `${guildDoorX + 1},${frontY - 1}`]);
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, roadCells, guildDoorSet).patches);
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, "모험가 길드 회관·길드 깃발·3분기 의뢰 게시판 시공"));

      const bannerX = gx - 1;
      if (bannerX >= area.x && bannerX >= 0) {
        out.push(...ctx.stampKitDirect("bd-pick-walled-market-banner-red", bannerX, Math.max(0, gy + 2)));
      }

      const boardX = Math.min(W - 1, area.x + area.w - 1, gx + gW + 1);
      const boardY = Math.min(H - 1, frontY - 1);
      out.push({
        tool: "place_npc",
        label: "모험가 길드 의뢰 게시판 (3분기 선택지)",
        args: {
          mapId: facts.mapId,
          x: boardX,
          y: boardY,
          name: "길드 의뢰 게시판",
          graphic: { textureKey: "tex_easyrpg_charset_object1", characterIndex: 0 },
          movement: "fixed",
          pages: [
            {
              lines: ["【버들항 모험가 길드 공식 의뢰 및 소문 게시판】"],
              choices: [
                {
                  text: "① [토벌 의뢰] 남부 가도 배회 몬스터 소탕 (보상 150G)",
                  commands: [
                    { kind: "text", body: "「최근 남부 숲길에 야생 슬라임과 고블린이 출몰하여 행상인을 위협하고 있음. 처치 시 길드에서 150G 지급.」" },
                  ],
                },
                {
                  text: "② [탐사 의뢰] 고대 신전 폐허의 잠긴 철문과 레버 조사",
                  commands: [
                    { kind: "text", body: "「동쪽 유적지의 강철 성문은 근처 레버 장치를 당기면 열린다는 보고가 있음. 탐사대원 모집 중.」" },
                  ],
                },
                {
                  text: "③ [마을 소문] 폭포수 연못과 호수 섬 사당의 전설",
                  commands: [
                    { kind: "text", body: "「호수 한가운데 작은 섬 사당에서 기도를 올리면 축복을 받는다는 오랜 전설이 전해진다.」" },
                  ],
                },
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 12. place_travel_portal (역마차 정류장 / 고대 전이 마법진 + 이동 선택지 이벤트) ──
    case "place_travel_portal": {
      const kind = step.args.kind === "portal" ? "portal" : "carriage";
      const patches: ExtendedTilePatch[] = [
        ...collectOverlappingPropClearPatches(ctx, area, 2, houseCells),
      ];
      const roadCells: { x: number; y: number }[] = [];
      for (let y = area.y + 1; y < area.y + area.h; y++) {
        for (let x = area.x + 1; x < area.x + area.w - 1; x++) {
          if (inb(x, y) && !houseCells.has(`${x},${y}`)) {
            roadCells.push({ x, y });
            patches.push({ x, y, upper: -1 });
          }
        }
      }
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, roadCells).patches);
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, kind === "portal" ? "고대 모자이크 전이 마법진 및 오벨리스크 시공" : "역마차 정류장·마구간 말뚝·마부 NPC 시공"));

      const destX = Math.max(2, Math.min(W - 3, 4));
      const destY = Math.max(2, Math.min(H - 3, 9));
      if (kind === "portal") {
        out.push(...ctx.stampKitDirect("bd-pick-temple-ruins-mosaic-medallion-5x5", Math.max(0, cx - 2), Math.max(0, cy - 2)));
        out.push(...ctx.stampKitDirect("bd-pick-wizard-tower-moon-obelisk", Math.max(0, cx - 3), Math.max(0, cy - 2)));
        out.push(...ctx.stampKitDirect("bd-pick-wizard-tower-moon-obelisk", Math.min(W - 1, cx + 3), Math.max(0, cy - 2)));
        out.push({
          tool: "place_npc",
          label: "고대 전이 마법진 이벤트 (transfer)",
          args: {
            mapId: facts.mapId,
            x: cx,
            y: cy,
            name: "전이 마법진",
            graphic: { textureKey: "tex_easyrpg_charset_object2", characterIndex: 6 },
            movement: "fixed",
            pages: [
              {
                lines: ["푸른 마력이 공명하는 고대 전이 마법진이다."],
                choices: [
                  {
                    text: "마법진을 작동해 마을 입구로 순간이동한다",
                    commands: [
                      { kind: "transfer", mapId: facts.mapId, x: destX, y: destY, direction: "down", fade: "white" },
                    ],
                  },
                  {
                    text: "물러선다",
                    commands: [{ kind: "text", body: "마법진에서 한 걸음 물러섰다." }],
                  },
                ],
              },
            ],
          },
        });
      } else {
        out.push(...ctx.stampKitDirect("bd-pick-walled-market-wagon", Math.max(0, cx - 2), Math.max(0, cy - 1)));
        out.push(...ctx.stampKitDirect("bd-pick-walled-market-hitching-rail", Math.max(0, cx + 2), Math.max(0, cy - 1)));
        out.push(...ctx.stampKitDirect("bd-out-signpost", Math.max(0, cx - 3), Math.max(0, cy)));
        out.push({
          tool: "place_npc",
          label: "역마차 마부 NPC (이동 선택지)",
          args: {
            mapId: facts.mapId,
            x: cx,
            y: Math.min(H - 1, cy + 2),
            name: "역마차 마부",
            graphic: { query: "villager" },
            movement: "fixed",
            pages: [
              {
                lines: ["역마차 마부: 이랴! 버들항 역마차 정류장입니다. 마차를 타고 이동하시겠습니까?"],
                choices: [
                  {
                    text: "마을 서쪽 입구로 이동한다",
                    commands: [
                      { kind: "transfer", mapId: facts.mapId, x: destX, y: destY, direction: "down", fade: "black" },
                    ],
                  },
                  {
                    text: "아직 출발하지 않는다",
                    commands: [{ kind: "text", body: "역마차 마부: 준비되시면 언제든 말씀만 하십시오!" }],
                  },
                ],
              },
            ],
          },
        });
      }
      return { steps: out, dropped };
    }

    // ── 13. place_roaming_enemies (배회/추격 심볼 인카운터 몬스터 1~4마리) ──────
    case "place_roaming_enemies": {
      const count = Math.max(1, Math.min(4, Number(step.args.count) || 3));
      const movementType = step.args.movement === "random" ? "random" : "approach";
      const troopId = facts.placement?.encounterTroops?.[0]?.id
        ?? ctx.project.database.troops?.[0]?.id
        ?? "troop_slime";
      const monsterNames = ["배회하는 슬라임", "그림자 고블린", "야생 늑대", "해골 척후병"];

      for (let i = 0; i < count; i++) {
        const mx = Math.max(1, Math.min(W - 2, area.x + 2 + Math.floor(((i + 0.5) * Math.max(2, area.w - 4)) / count)));
        const my = Math.max(1, Math.min(H - 2, cy + (i % 2 === 0 ? -1 : 1)));
        const evId = `ev_roaming_enemy_${facts.mapId}_${mx}_${my}_${i}`;
        const mName = monsterNames[i % monsterNames.length]!;
        const mGraphic = objCharsetGraphic("monster1", i % 8, "down");

        out.push({
          tool: "place_npc",
          label: `${mName} 심볼 인카운터 (${mx},${my})`,
          args: {
            mapId: facts.mapId,
            id: evId,
            x: mx,
            y: my,
            name: mName,
            graphic: { textureKey: "tex_easyrpg_charset_monster1", characterIndex: i % 8 },
            movement: movementType,
            pages: [{ lines: [`${mName}: 크르르…!`] }],
          },
        });

        ctx.queueEventUpsert({
          id: evId,
          name: mName,
          x: mx,
          y: my,
          trigger: { kind: "eventTouch" },
          commands: [],
          pages: [
            makeNativePage({
              id: `${evId}_p1`,
              name: "심볼 인카운터 (배회·접촉 전투)",
              graphic: mGraphic,
              trigger: "eventTouch",
              priority: "same",
              movement: { type: movementType, speed: 3, frequency: 4 },
              commands: [
                { kind: "text", body: `${mName}이(가) 기척을 느끼고 덤벼들었다!` },
                { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
                { kind: "setSelfSwitch", key: "A", value: true },
              ],
            }),
            makeNativePage({
              id: `${evId}_p2`,
              name: "전투 승리 후 소멸",
              conditions: [{ kind: "selfSwitch", key: "A", value: true }],
              graphic: { transparent: true },
              trigger: "parallel",
              priority: "below",
              overlapForbidden: false,
              commands: [],
            }),
          ],
        });
      }
      return { steps: out, dropped };
    }

    // ── 14. place_switch_and_gate (레버 스위치 + 연동 개방되는 강철 성문) ──────
    case "place_switch_and_gate": {
      const gateX = cx;
      const gateY = cy;
      const leverX = Math.max(1, gateX - 2);
      const preferNorthLever = step.args.leverSide === "north" || (gateY + 1 < H && (previewMap.upperTiles[idx(leverX, gateY + 1)] ?? -1) >= 0);
      const leverY = preferNorthLever ? Math.max(1, gateY - 1) : Math.min(H - 2, gateY + 1);
      const switchId = `sw_fastpath_gate_${facts.mapId}_${gateX}_${gateY}`;
      ctx.queueSwitchEnsure(switchId, `철문 개폐 스위치 (${gateX},${gateY})`);

      // 철문 좌우에 석조 차단 담장 배치
      const patches: ExtendedTilePatch[] = [];
      for (let dx = -3; dx <= 3; dx++) {
        const wx = gateX + dx;
        if (!inb(wx, gateY) || houseCells.has(`${wx},${gateY}`)) continue;
        if (dx === 0) {
          patches.push({ x: wx, y: gateY, lower: 1509, upper: -1 });
        }
      }
      if (patches.length > 0) {
        out.push(...makeAnchorPaintStep(ctx, patches, "철문 관문 바닥 판석", "레버-철문 스위치 배선"));
      }
      if (gateX - 2 >= 0) out.push(...ctx.stampKitDirect("bd-pick-mountain-pass-wall-seg", gateX - 2, Math.max(0, gateY - 1)));
      if (gateX + 1 < W - 1) out.push(...ctx.stampKitDirect("bd-pick-mountain-pass-wall-seg", gateX + 1, Math.max(0, gateY - 1)));

      const leverId = `ev_lever_${facts.mapId}_${leverX}_${leverY}`;
      const gateId = `ev_gate_${facts.mapId}_${gateX}_${gateY}`;
      const leverDown = objCharsetGraphic("object2", 0, "down");
      const leverUp = objCharsetGraphic("object2", 0, "up");
      const gateClosed = objCharsetGraphic("object1", 3, "down");
      const gateOpen = objCharsetGraphic("object1", 3, "up");

      out.push({
        tool: "place_npc",
        label: `철문 개폐 레버 (${leverX},${leverY})`,
        args: {
          mapId: facts.mapId,
          id: leverId,
          x: leverX,
          y: leverY,
          name: "철문 개폐 레버",
          graphic: { textureKey: "tex_easyrpg_charset_object2", characterIndex: 0 },
          movement: "fixed",
          pages: [{ lines: ["철문을 여는 레버 장치다."] }],
        },
      });
      out.push({
        tool: "place_npc",
        label: `연동 강철 성문 (${gateX},${gateY})`,
        args: {
          mapId: facts.mapId,
          id: gateId,
          x: gateX,
          y: gateY,
          name: "강철 성문",
          graphic: { textureKey: "tex_easyrpg_charset_object1", characterIndex: 3 },
          movement: "fixed",
          pages: [{ lines: ["굳게 닫힌 강철 성문이다."] }],
        },
      });

      ctx.queueEventUpsert({
        id: leverId,
        name: "철문 개폐 레버",
        x: leverX,
        y: leverY,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          makeNativePage({
            id: `${leverId}_p1`,
            name: "레버 (작동 전)",
            graphic: leverDown,
            commands: [
              { kind: "text", body: "묵직한 철제 레버다. 당기면 옆의 강철 성문이 열릴 것 같다." },
              {
                kind: "choices",
                prompt: "레버를 당길까?",
                options: [
                  {
                    text: "힘껏 당긴다",
                    branch: [
                      { kind: "setSwitch", switchId, value: true },
                      { kind: "text", body: "철컥! 톱니가 맞물리며 강철 성문이 활짝 열렸다!" },
                    ],
                  },
                  {
                    text: "그대로 둔다",
                    branch: [],
                  },
                ],
                cancelBehavior: "choice2",
              },
            ],
          }),
          makeNativePage({
            id: `${leverId}_p2`,
            name: "레버 (작동 완료)",
            conditions: [{ kind: "switch", switchId, value: true }],
            graphic: leverUp,
            commands: [{ kind: "text", body: "레버가 당겨져 강철 성문이 열려 있다." }],
          }),
        ],
      });

      ctx.queueEventUpsert({
        id: gateId,
        name: "강철 성문",
        x: gateX,
        y: gateY,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          makeNativePage({
            id: `${gateId}_closed`,
            name: "강철 성문 (닫힘)",
            graphic: gateClosed,
            priority: "same",
            overlapForbidden: true,
            commands: [{ kind: "text", body: "굳게 잠긴 강철 성문이다. 왼쪽의 레버를 당겨야 열린다." }],
          }),
          makeNativePage({
            id: `${gateId}_open`,
            name: "강철 성문 (열림 — 통행 가능)",
            conditions: [{ kind: "switch", switchId, value: true }],
            graphic: gateOpen,
            priority: "below",
            overlapForbidden: false,
            commands: [{ kind: "text", body: "강철 성문이 열려 있어 자유롭게 지나갈 수 있다." }],
          }),
        ],
      });
      return { steps: out, dropped };
    }

    // ── 15. place_camp_rest (야영 천막 + 모닥불 + 통나무 벤치 + 휴식/회복/저장 이벤트) ──
    case "place_camp_rest": {
      out.push(...ctx.stampKitDirect("bd-pick-desert-oasis-tent", Math.max(0, cx - 2), Math.max(0, area.y + 1), "모험가 야영 천막"));
      out.push(...ctx.stampKitDirect("bd-prop-bench_wood", Math.max(0, cx - 3), Math.min(H - 1, cy + 1)));
      out.push(...ctx.stampKitDirect("bd-out-woodpile", Math.min(W - 2, cx + 2), Math.min(H - 1, cy + 1)));

      const fireX = cx;
      const fireY = Math.min(H - 1, cy + 1);
      out.push({
        tool: "place_npc",
        label: "야영지 모닥불 (휴식·회복·세이브)",
        args: {
          mapId: facts.mapId,
          x: fireX,
          y: fireY,
          name: "따뜻한 야영 모닥불",
          graphic: { textureKey: "tex_easyrpg_charset_object2", characterIndex: 1 },
          movement: "fixed",
          pages: [
            {
              lines: ["장작이 타오르는 따뜻한 야영지 모닥불이다."],
              choices: [
                {
                  text: "모닥불 곁에서 휴식하며 저장한다 (HP/MP 완전 회복)",
                  commands: [
                    { kind: "recoverAll", actorId: "" },
                    { kind: "checkpointSave" },
                    { kind: "text", body: "모닥불의 온기 속에서 피로를 모두 풀고 여정을 기록했습니다!" },
                    { kind: "openSaveMenu" },
                  ],
                },
                {
                  text: "불꽃만 바라본다",
                  commands: [{ kind: "text", body: "타닥타닥 타오르는 불꽃이 마음을 차분하게 해 준다." }],
                },
              ],
            },
          ],
        },
      });
      return { steps: out, dropped };
    }

    // ── 16. place_mimic_and_sparkles (보물상자 + 미믹 함정 상자 + 반짝이는 바닥 유실물) ──
    case "place_mimic_and_sparkles": {
      const troopId = facts.placement?.encounterTroops?.[0]?.id
        ?? ctx.project.database.troops?.[0]?.id
        ?? "troop_slime";
      const chestX = Math.max(1, cx - 2);
      const chestY = cy;
      const mimicX = Math.min(W - 2, cx + 1);
      const mimicY = cy;
      const sparkX = cx;
      const sparkY = Math.min(H - 2, cy + 2);

      out.push({
        tool: "place_chest",
        label: "보물상자 (80G)",
        args: { mapId: facts.mapId, x: chestX, y: chestY, contents: { gold: 80 } },
      });

      const mimicId = `ev_mimic_${facts.mapId}_${mimicX}_${mimicY}`;
      const sparkId = `ev_sparkle_${facts.mapId}_${sparkX}_${sparkY}`;
      out.push({
        tool: "place_npc",
        label: `미믹 함정 상자 (${mimicX},${mimicY})`,
        args: {
          mapId: facts.mapId,
          id: mimicId,
          x: mimicX,
          y: mimicY,
          name: "수상한 보물상자 (미믹)",
          graphic: { textureKey: "tex_easyrpg_charset_object1", characterIndex: 2 },
          movement: "fixed",
          pages: [{ lines: ["보물상자인 줄 알았더니 미믹이 덮쳐왔다!"] }],
        },
      });
      out.push({
        tool: "place_npc",
        label: `반짝이는 바닥 유실물 (${sparkX},${sparkY})`,
        args: {
          mapId: facts.mapId,
          id: sparkId,
          x: sparkX,
          y: sparkY,
          name: "반짝이는 유실물",
          graphic: { textureKey: "tex_easyrpg_charset_object2", characterIndex: 6 },
          movement: "fixed",
          pages: [{ lines: ["바닥에서 반짝이는 회복약과 금화를 주웠다!"] }],
        },
      });

      ctx.queueEventUpsert({
        id: mimicId,
        name: "수상한 보물상자 (미믹)",
        x: mimicX,
        y: mimicY,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          makeNativePage({
            id: `${mimicId}_p1`,
            name: "미믹 (개봉 전)",
            graphic: objCharsetGraphic("object1", 2, "down"),
            commands: [
              { kind: "text", body: "앗! 보물상자가 날카로운 이빨을 드러내며 덮쳐왔다!" },
              { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
              { kind: "changeGold", op: "+=", amount: 120 },
              { kind: "text", body: "미믹을 물리치고 상자 안의 전리품 120G를 손에 넣었다!" },
              { kind: "setSelfSwitch", key: "A", value: true },
            ],
          }),
          makeNativePage({
            id: `${mimicId}_p2`,
            name: "미믹 (처치 완료)",
            conditions: [{ kind: "selfSwitch", key: "A", value: true }],
            graphic: objCharsetGraphic("object1", 2, "up"),
            commands: [{ kind: "text", body: "미믹을 물리친 빈 상자다." }],
          }),
        ],
      });

      ctx.queueEventUpsert({
        id: sparkId,
        name: "반짝이는 바닥 유실물",
        x: sparkX,
        y: sparkY,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          makeNativePage({
            id: `${sparkId}_p1`,
            name: "반짝이는 유실물",
            graphic: objCharsetGraphic("object2", 6, "down"),
            commands: [
              { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 },
              { kind: "changeGold", op: "+=", amount: 35 },
              { kind: "text", body: "풀숲 바닥에서 반짝이는 물약 1개와 35G를 발견했다!" },
              { kind: "setSelfSwitch", key: "A", value: true },
            ],
          }),
          makeNativePage({
            id: `${sparkId}_p2`,
            name: "습득 완료",
            conditions: [{ kind: "selfSwitch", key: "A", value: true }],
            graphic: { transparent: true },
            priority: "below",
            overlapForbidden: false,
            commands: [],
          }),
        ],
      });
      return { steps: out, dropped };
    }

    // ── 17. repeat_line_or_grid (기물 일렬/격자 반복 배치) ─────────────────────
    case "repeat_line_or_grid": {
      const query = String(step.args.query ?? "가로등");
      const kitId = /벤치|의자/u.test(query)
        ? "bd-prop-bench_wood"
        : /석상|동상/u.test(query)
          ? "bd-prop-statue_sage"
          : /기둥|원주/u.test(query)
            ? "bd-prop-column_monument"
            : /나무|가로수/u.test(query)
              ? "bd-tree-f4f319"
              : /깃발|배너/u.test(query)
                ? "bd-pick-walled-market-banner-red"
                : /화분|꽃/u.test(query)
                  ? "bd-prop-planter_round"
                  : "bd-prop-lamp_crook";
      const kit = (tileset.structureKits ?? []).find((k) => k.id === kitId);
      const kw = kit?.width ?? 1;
      const kh = kit?.height ?? 3;
      const cols = Math.max(1, Math.min(6, Number(step.args.cols) || Number(step.args.count) || Math.max(3, Math.floor(area.w / (kw + 2)))));
      const rows = Math.max(1, Math.min(4, Number(step.args.rows) || ( area.h >= kh * 2 + 2 && /격자|양쪽|열주|2열/u.test(`${query} ${facts.text}`) ? 2 : 1)));
      const stepX = cols > 1 ? Math.max(kw + 1, Math.floor((area.w - kw) / (cols - 1))) : 0;
      const stepY = rows > 1 ? Math.max(kh + 1, Math.floor((area.h - kh) / (rows - 1))) : 0;

      let first = true;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = Math.min(W - kw, area.x + c * stepX);
          const py = Math.min(H - kh, area.y + r * stepY);
          out.push(...ctx.stampKitDirect(kitId, px, py, first ? step.label : ""));
          first = false;
        }
      }
      return { steps: out, dropped };
    }

    // ── 18. mirror_region (선택 영역 좌우/상하 대칭 복사) ──────────────────────
    case "mirror_region": {
      const axis = step.args.axis === "vertical" ? "vertical" : "horizontal";
      const patches: ExtendedTilePatch[] = [];

      if (axis === "horizontal") {
        // 좌반부와 우반부 중 상부 타일이 더 많은 쪽을 원본으로 삼아 반대편으로 대칭 복사
        const halfW = Math.floor(area.w / 2);
        let leftUpper = 0;
        let rightUpper = 0;
        for (let dy = 0; dy < area.h; dy++) {
          for (let dx = 0; dx < halfW; dx++) {
            if ((previewMap.upperTiles[idx(area.x + dx, area.y + dy)] ?? -1) >= 0) leftUpper++;
            if ((previewMap.upperTiles[idx(area.x + area.w - 1 - dx, area.y + dy)] ?? -1) >= 0) rightUpper++;
          }
        }
        // 영역이 비어 있으면 좌측에 먼저 가로등·화단·기둥 샘플을 세운 뒤 우측으로 대칭 복제
        if (leftUpper === 0 && rightUpper === 0) {
          out.push(...ctx.stampKitDirect("bd-prop-column_monument", area.x + 1, area.y + 1));
          out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", area.x + 3, area.y + 2));
        }
        const fromLeft = leftUpper >= rightUpper;
        for (let dy = 0; dy < area.h; dy++) {
          const y = area.y + dy;
          for (let dx = 0; dx < halfW; dx++) {
            const lx = area.x + dx;
            const rx = area.x + area.w - 1 - dx;
            const srcX = fromLeft ? lx : rx;
            const dstX = fromLeft ? rx : lx;
            if (!inb(srcX, y) || !inb(dstX, y)) continue;
            const lt = previewMap.lowerTiles[idx(srcX, y)] ?? 737;
            const ut = previewMap.upperTiles[idx(srcX, y)] ?? -1;
            patches.push({ x: dstX, y, lower: lt, upper: ut });
          }
        }
      } else {
        const halfH = Math.floor(area.h / 2);
        for (let dy = 0; dy < halfH; dy++) {
          const ty = area.y + dy;
          const by = area.y + area.h - 1 - dy;
          for (let dx = 0; dx < area.w; dx++) {
            const x = area.x + dx;
            if (!inb(x, ty) || !inb(x, by)) continue;
            const lt = previewMap.lowerTiles[idx(x, ty)] ?? 737;
            const ut = previewMap.upperTiles[idx(x, ty)] ?? -1;
            patches.push({ x, y: by, lower: lt, upper: ut });
          }
        }
      }
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, `${axis === "horizontal" ? "좌우" : "상하"} 대칭 복사 완료`));
      return { steps: out, dropped };
    }

    // ── 19. enclose_with_wall (사각형 둘레 성벽/울타리/생울타리 포위 + 중앙 출입문) ──
    case "enclose_with_wall": {
      const style = (step.args.style as "stone" | "fence" | "hedge" | undefined) ?? "stone";
      const gateSide = (step.args.gateSide as "south" | "north" | "east" | "west" | undefined) ?? "south";
      const x0 = area.x;
      const y0 = area.y;
      const x1 = area.x + area.w - 1;
      const y1 = area.y + area.h - 1;
      const patches: ExtendedTilePatch[] = [];

      // 성벽/울타리/생울타리 대표 타일 ID
      const wallUpperTile = style === "fence" ? 28289 : style === "hedge" ? 2418 : 2652;
      const isGateOpening = (x: number, y: number): boolean => {
        if (gateSide === "south" && y === y1 && Math.abs(x - cx) <= 1) return true;
        if (gateSide === "north" && y === y0 && Math.abs(x - cx) <= 1) return true;
        if (gateSide === "east" && x === x1 && Math.abs(y - cy) <= 1) return true;
        if (gateSide === "west" && x === x0 && Math.abs(y - cy) <= 1) return true;
        return false;
      };

      // 담장 테두리에 걸치는 기존 소품/나무 제거 (반쪽 잘림 원천 차단)
      for (const obj of ctx.detectObjects(previewMap, tileset)) {
        if (obj.kind === "structure") continue;
        if (/집|주택|민가|오두막|여관|상점|가게|성|성채|회관|신전|성당|house|inn|shop|castle|hall|temple/iu.test(`${obj.coreName} ${obj.name} ${obj.kitId ?? ""}`)) {
          continue;
        }
        let touchesBorder = false;
        for (let oy = obj.y; oy < obj.y + obj.h && !touchesBorder; oy++) {
          for (let ox = obj.x; ox < obj.x + obj.w; ox++) {
            if ((ox === x0 || ox === x1) && oy >= y0 && oy <= y1) { touchesBorder = true; break; }
            if ((oy === y0 || oy === y1) && ox >= x0 && ox <= x1) { touchesBorder = true; break; }
          }
        }
        if (touchesBorder) {
          for (let oy = Math.max(0, obj.y); oy < Math.min(H, obj.y + obj.h); oy++) {
            for (let ox = Math.max(0, obj.x); ox < Math.min(W, obj.x + obj.w); ox++) {
              if (!houseCells.has(`${ox},${oy}`)) {
                previewMap.upperTiles[idx(ox, oy)] = -1;
                patches.push({ x: ox, y: oy, upper: -1 });
              }
            }
          }
        }
      }

      const gateRoadCells: { x: number; y: number }[] = [];
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
          const onBorder = x === x0 || x === x1 || y === y0 || y === y1;
          if (!onBorder) continue;
          if (isGateOpening(x, y)) {
            gateRoadCells.push({ x, y });
            patches.push({ x, y, lower: 1509, upper: -1 });
          } else {
            patches.push({ x, y, upper: wallUpperTile });
          }
        }
      }
      patches.push(...buildRoadMaskWithBranch(previewMap, tileset, gateRoadCells).patches);
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, `${style === "fence" ? "나무 울타리" : style === "hedge" ? "산울타리" : "석조 담장"} 둘레 포위 및 ${gateSide} 출입구 개방`));

      if (gateSide === "south" && y1 - 2 >= 0) {
        if (cx - 2 >= x0) out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", cx - 2, Math.max(0, y1 - 2)));
        if (cx + 2 <= x1) out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", cx + 2, Math.max(0, y1 - 2)));
      }
      return { steps: out, dropped };
    }

    // ── 20. auto_connect_roads (건물 문·성문 탐지 → 메인 도로망 자동 연결 + 가로등) ──
    case "auto_connect_roads": {
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
      const roadSet = new Set<number>(roadGroup?.memberTileIds ?? []);
      const isRoadLike = (t: number): boolean => roadSet.has(t) || t === 1509;

      // 1) 모든 건물·성채·상점·성당·길드 출입구 문 좌표(doorX, doorY)와 문턱(doorX, frontY) 수집 및 건물 보호 셀 등록
      const placed = ctx.detectObjects(previewMap, tileset).filter((o) => o.kind === "structure" || o.kind === "kit");
      const protectedCells = new Set<string>(houseCells);
      const doorPoints: { doorX: number; doorY: number; x: number; y: number }[] = [];
      const doorCellSet = new Set<string>();
      const seenDoorKeys = new Set<string>();

      for (const obj of placed) {
        const isBuilding =
          obj.kind === "structure" ||
          /집|주택|민가|오두막|여관|상점|가게|성|성채|회관|신전|성당|예배당|house|inn|shop|castle|hall|temple|church/iu.test(
            `${obj.coreName} ${obj.name} ${obj.kitId ?? ""}`,
          );
        if (!isBuilding) continue;
        for (let y = Math.max(0, obj.y); y < Math.min(H, obj.y + obj.h); y++) {
          for (let x = Math.max(0, obj.x); x < Math.min(W, obj.x + obj.w); x++) {
            protectedCells.add(`${x},${y}`);
          }
        }
        const kit = obj.kitId ? (tileset.structureKits ?? []).find((k) => k.id === obj.kitId) : undefined;
        const entrance = kit?.parts?.find((part) => part.kind === "entrance");
        const doorX = obj.x + (entrance ? entrance.dx : Math.floor(obj.w / 2));
        const doorY = obj.y + (entrance ? entrance.dy + entrance.h - 1 : obj.h - 1);
        const frontY = Math.min(H - 1, obj.y + obj.h);
        const key = `${doorX},${frontY}`;
        if (seenDoorKeys.has(key)) continue;
        seenDoorKeys.add(key);
        doorPoints.push({ doorX, doorY, x: doorX, y: frontY });
        doorCellSet.add(`${doorX},${doorY}`);
        doorCellSet.add(`${doorX + 1},${doorY}`);
      }
      // 성채 광장(3221) 및 항구 부두·장터 포석 지구와도 간선도로가 이어지도록 대표 진입점 추가
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const lt = previewMap.lowerTiles[idx(x, y)] ?? -1;
          if (lt === 3221 && (previewMap.lowerTiles[idx(x, y + 1)] ?? -1) !== 3221 && (previewMap.upperTiles[idx(x, y)] ?? -1) < 0) {
            const key = `${x},${y + 1}`;
            if (!seenDoorKeys.has(key)) {
              seenDoorKeys.add(key);
              doorPoints.push({ doorX: x, doorY: y, x, y: Math.min(H - 1, y + 1) });
              doorCellSet.add(`${x},${y}`);
            }
          }
        }
      }
      if (doorPoints.length === 0) {
        const fallbackY = Math.max(0, area.y + 2);
        doorPoints.push({ doorX: cx, doorY: Math.max(0, fallbackY - 1), x: cx, y: fallbackY });
      }

      // 2) 메인 간선 도로(spine) 탐색 및 확장:
      //    개별 건물 앞마당(apron)에만 그치지 않고, 모든 출입구를 하나로 잇는 기준 가로 간선도로(spineY)를 확보한다.
      const doorFrontSet = new Set<string>();
      for (const d of doorPoints) {
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = -3; dx <= 4; dx++) {
            doorFrontSet.add(`${d.x + dx},${d.y + dy}`);
          }
        }
      }
      let bestSpineY = -1;
      let bestSpineCount = 0;
      for (let y = 0; y < H - 1; y++) {
        let rowCount = 0;
        for (let x = 0; x < W; x++) {
          if (isRoadLike(previewMap.lowerTiles[idx(x, y)] ?? -1) && !doorFrontSet.has(`${x},${y}`)) {
            rowCount++;
          }
        }
        if (rowCount > bestSpineCount) {
          bestSpineCount = rowCount;
          bestSpineY = y;
        }
      }
      if (bestSpineY < 0) {
        // 기준 간선도로가 건물 앞마당과 겹치거나 없으면 가장 긴 기존 도로 행 또는 첫 건물 문턱 아래 행을 선택
        for (let y = 0; y < H - 1; y++) {
          let rowCount = 0;
          for (let x = 0; x < W; x++) {
            if (isRoadLike(previewMap.lowerTiles[idx(x, y)] ?? -1)) rowCount++;
          }
          if (rowCount > bestSpineCount) {
            bestSpineCount = rowCount;
            bestSpineY = y;
          }
        }
      }
      if (bestSpineY < 0) {
        bestSpineY = Math.min(H - 2, doorPoints[0]!.y + 1);
      }

      const branchCells: { x: number; y: number }[] = [];
      const clearPatches: ExtendedTilePatch[] = [];
      const connectedSpine: { x: number; y: number }[] = [];
      const connectedSet = new Set<string>();
      const addSpineCell = (x: number, y: number): void => {
        if (!inb(x, y) || protectedCells.has(`${x},${y}`) || facts.isWaterCell?.(x, y)) return;
        branchCells.push({ x, y });
        const k = `${x},${y}`;
        if (!connectedSet.has(k)) {
          connectedSet.add(k);
          connectedSpine.push({ x, y });
        }
      };

      // 기존 간선도로 행(bestSpineY)을 모든 건물 출입구 X 범위까지 수평 연장하여 끊김 없는 메인 도로 구축
      let minSpanX = Math.max(1, area.x);
      let maxSpanX = Math.min(W - 2, area.x + area.w - 1);
      for (const d of doorPoints) {
        if (d.x < minSpanX) minSpanX = d.x;
        if (d.x + 1 > maxSpanX) maxSpanX = Math.min(W - 1, d.x + 1);
      }
      for (let x = 0; x < W; x++) {
        if (isRoadLike(previewMap.lowerTiles[idx(x, bestSpineY)] ?? -1)) {
          if (x < minSpanX) minSpanX = x;
          if (x > maxSpanX) maxSpanX = x;
        }
      }
      for (let x = minSpanX; x <= maxSpanX; x++) {
        addSpineCell(x, bestSpineY);
        if (bestSpineY + 1 < H) addSpineCell(x, bestSpineY + 1);
      }

      // 3) 각 건물 출입구 문턱(door.x, door.y)에서 간선도로까지 2칸 폭 포석 길로 빈틈없이 직결
      const sortedDoors = [...doorPoints].sort((a, b) => Math.abs(a.y - bestSpineY) - Math.abs(b.y - bestSpineY) || a.x - b.x);
      for (const door of sortedDoors) {
        // 문 바로 앞 마당(door.x - 1 .. door.x + 1, door.y .. door.y + 1)의 상부 장애물 제거 및 포석 포장
        for (let ty = door.y; ty <= Math.min(H - 1, door.y + 1); ty++) {
          for (let tx = Math.max(0, door.x - 1); tx <= Math.min(W - 1, door.x + 1); tx++) {
            if (protectedCells.has(`${tx},${ty}`) || facts.isWaterCell?.(tx, ty)) continue;
            if (tx === door.x || tx === door.x + 1) {
              branchCells.push({ x: tx, y: ty });
              if ((previewMap.upperTiles[idx(tx, ty)] ?? -1) >= 0) {
                previewMap.upperTiles[idx(tx, ty)] = -1;
                clearPatches.push({ x: tx, y: ty, upper: -1 });
              }
            }
          }
        }

        let best = connectedSpine[0] ?? { x: door.x, y: bestSpineY };
        let bestD = Infinity;
        for (const r of connectedSpine) {
          const d = Math.abs(r.x - door.x) + Math.abs(r.y - door.y);
          if (d < bestD) {
            bestD = d;
            best = r;
          }
        }
        const yMin = Math.min(door.y, best.y);
        const yMax = Math.max(door.y, best.y);
        for (let y = yMin; y <= yMax; y++) {
          for (const rx of [door.x, Math.min(W - 1, door.x + 1)]) {
            if (!protectedCells.has(`${rx},${y}`) && !facts.isWaterCell?.(rx, y)) {
              addSpineCell(rx, y);
              if ((previewMap.upperTiles[idx(rx, y)] ?? -1) >= 0) {
                previewMap.upperTiles[idx(rx, y)] = -1;
                clearPatches.push({ x: rx, y: y, upper: -1 });
              }
            }
          }
        }
        const xMin = Math.min(door.x, best.x);
        const xMax = Math.max(door.x, best.x);
        for (let x = xMin; x <= xMax; x++) {
          for (const ry of [best.y, Math.min(H - 1, best.y + 1)]) {
            if (!protectedCells.has(`${x},${ry}`) && !facts.isWaterCell?.(x, ry)) {
              addSpineCell(x, ry);
            }
          }
        }
      }

      const patches = [
        ...clearPatches,
        ...buildRoadMaskWithBranch(previewMap, tileset, branchCells, doorCellSet).patches,
      ];
      out.push(...makeAnchorPaintStep(ctx, patches, step.label, `건물 출입구 ${doorPoints.length}곳 도로망 오토타일 자동 연결`));
      if (doorPoints[0] && doorPoints[0].x + 2 < W && doorPoints[0].y - 1 >= 0) {
        const lx = doorPoints[0].x + 2;
        const ly = Math.max(0, doorPoints[0].y - 1);
        if (!houseCells.has(`${lx},${ly}`) && (previewMap.upperTiles[idx(lx, ly)] ?? -1) < 0) {
          out.push(...ctx.stampKitDirect("bd-prop-lamp_crook", lx, ly));
        }
      }
      return { steps: out, dropped };
    }

    // ── 21. populate_crowd (다중 주민·경비·아이·강아지 군중 스폰) ──────────────
    case "populate_crowd": {
      const count = Math.max(3, Math.min(8, Number(step.args.count) || 5));
      const cast: readonly { name: string; role: string; move: "fixed" | "random"; line: string }[] = [
        { name: "순찰 경비병", role: "guard", move: "fixed", line: "순찰 경비병: 오늘 광장에 사람이 참 많군! 소매치기 조심하시오." },
        { name: "산책하는 청년", role: "villager", move: "random", line: "산책하는 청년: 거리가 활기차서 걷기만 해도 기분이 좋아지네요!" },
        { name: "장바구니 든 아낙", role: "woman", move: "random", line: "장바구니 든 아낙: 오늘 저녁 반찬거리는 장터에서 다 샀답니다." },
        { name: "뛰어노는 아이", role: "child", move: "random", line: "뛰어노는 아이: 와아! 술래잡기하자, 나 잡아 봐라!" },
        { name: "마을 원로", role: "old man", move: "fixed", line: "마을 원로: 허허, 우리 버들항이 이렇게 북적이는 걸 보니 참으로 흐뭇하구먼." },
        { name: "거리의 음유시인", role: "villager", move: "fixed", line: "거리의 음유시인: ♪ 푸른 물결 넘실대는 버들항의 노래를 들어 보시오~" },
        { name: "여행 온 모험가", role: "warrior", move: "random", line: "여행 온 모험가: 여관에서 푹 쉬었더니 컨디션이 최고야!" },
        { name: "순한 마을 강아지", role: "dog", move: "random", line: "순한 마을 강아지: 멍멍! (반갑게 꼬리를 흔든다.)" },
      ];

      const occupiedCells = new Set<string>(houseCells);
      for (const ev of previewMap.events) {
        occupiedCells.add(`${ev.x},${ev.y}`);
      }
      const isWalkableCrowdCell = (x: number, y: number): boolean => {
        if (!inb(x, y) || occupiedCells.has(`${x},${y}`)) return false;
        if ((previewMap.upperTiles[idx(x, y)] ?? -1) >= 0) return false;
        if (y > 0 && (previewMap.upperTiles[idx(x, y - 1)] ?? -1) >= 0) return false;
        if (facts.isWaterCell?.(x, y)) return false;
        return true;
      };

      for (let i = 0; i < count; i++) {
        const entry = cast[i % cast.length]!;
        let nx = Math.max(1, Math.min(W - 2, area.x + 1 + ((i * 3 + 1) % Math.max(2, area.w - 2))));
        let ny = Math.max(1, Math.min(H - 2, area.y + 1 + (Math.floor(i / 2) * 2) % Math.max(2, area.h - 2)));
        if (!isWalkableCrowdCell(nx, ny)) {
          let found = false;
          for (let r = 1; r <= 6 && !found; r++) {
            for (let dy = -r; dy <= r && !found; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                const tx = nx + dx;
                const ty = ny + dy;
                if (tx >= area.x && tx < area.x + area.w && ty >= area.y && ty < area.y + area.h && isWalkableCrowdCell(tx, ty)) {
                  nx = tx;
                  ny = ty;
                  found = true;
                  break;
                }
              }
            }
          }
        }
        occupiedCells.add(`${nx},${ny}`);
        occupiedCells.add(`${nx + 1},${ny}`);
        occupiedCells.add(`${nx - 1},${ny}`);
        out.push({
          tool: "place_npc",
          label: `${entry.name} NPC`,
          args: {
            mapId: facts.mapId,
            x: nx,
            y: ny,
            name: entry.name,
            graphic: { query: entry.role },
            movement: entry.move,
            pages: [{ lines: [entry.line] }],
          },
        });
      }
      return { steps: out, dropped };
    }

    // ── 22. set_mood_weather (날씨 + 석양/야경/새벽 조명 틴트 + 가로등/화로 배치) ──
    case "set_mood_weather": {
      const weatherRaw = (step.args.weather as "rain" | "snow" | "fog" | "storm" | "clear" | undefined) ?? "rain";
      const preset = (step.args.preset as "sunset" | "night" | "dawn" | "day" | undefined) ?? "sunset";
      const weatherKind = weatherRaw === "clear" ? "none" : weatherRaw;
      const lightingByPreset: Record<"sunset" | "night" | "dawn" | "day", { ambient: number; color: string }> = {
        sunset: { ambient: 0.72, color: "#ff8844" },
        night: { ambient: 0.48, color: "#1c2d5a" },
        dawn: { ambient: 0.78, color: "#88bbff" },
        day: { ambient: 0.95, color: "#ffffff" },
      };
      const tint = lightingByPreset[preset];

      const protectedCells = new Set<string>(houseCells);
      for (const obj of ctx.detectObjects(previewMap, tileset)) {
        const isBuilding =
          obj.kind === "structure" ||
          /집|주택|민가|오두막|여관|상점|가게|성|성채|회관|신전|성당|예배당|house|inn|shop|castle|hall|temple|church/iu.test(
            `${obj.coreName} ${obj.name} ${obj.kitId ?? ""}`,
          );
        if (!isBuilding) continue;
        for (let y = Math.max(0, obj.y - 1); y < Math.min(H, obj.y + obj.h + 1); y++) {
          for (let x = Math.max(0, obj.x - 1); x < Math.min(W, obj.x + obj.w + 1); x++) {
            protectedCells.add(`${x},${y}`);
          }
        }
      }
      const findOpenPropSpot = (prefX: number, prefY: number, kh: number): { x: number; y: number } | null => {
        for (let r = 0; r <= 8; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const tx = prefX + dx;
              const ty = prefY + dy;
              if (tx < area.x || ty < area.y || tx >= area.x + area.w || ty + kh > area.y + area.h) continue;
              let ok = true;
              for (let ky = 0; ky < kh; ky++) {
                if (!inb(tx, ty + ky) || protectedCells.has(`${tx},${ty + ky}`) || facts.isWaterCell?.(tx, ty + ky) || (previewMap.upperTiles[idx(tx, ty + ky)] ?? -1) >= 0) {
                  ok = false;
                  break;
                }
              }
              if (ok) return { x: tx, y: ty };
            }
          }
        }
        return null;
      };

      if (step.args.withLights !== false) {
        const lampSpot = findOpenPropSpot(Math.max(0, cx - 3), Math.max(0, cy - 1), 3);
        if (lampSpot) {
          out.push(...ctx.stampKitDirect("bd-prop-lamp_double", lampSpot.x, lampSpot.y, `${preset} 조명 가로등과 화로`));
        }
        const brazierSpot = findOpenPropSpot(Math.min(W - 1, cx + 2), Math.max(0, cy), 2);
        if (brazierSpot) {
          out.push(...ctx.stampKitDirect("bd-pick-mountain-pass-brazier", brazierSpot.x, brazierSpot.y));
        }
      }
      out.push({
        tool: "set_scene_mood",
        label: step.label,
        args: {
          mapId: facts.mapId,
          weather: { kind: weatherKind, intensity: 0.65 },
          lighting: {
            ambient: tint.ambient,
            color: tint.color,
            sources: [{ id: "mood_player_glow", at: "player", radius: 5, intensity: 0.9 }],
          },
          applyMode: "map",
        },
      });
      return { steps: out, dropped };
    }

    default:
      return { steps: [step], dropped: [] };
  }
}
