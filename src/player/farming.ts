import { resolveToolUseOnTile } from "@/project/toolActions";
import type { GameTime, Season } from "@/project/gameTime";
import { changeItem, type FarmPlotState, type PlaySession } from "@/project/session";
import type { CropRecord, GameMap, Project, Rect } from "@/project/types";
import { placeableDropItemId, placeableKey, removeObjectAt } from "@/project/placeables";

export type FarmInteractionKind = "tilled" | "planted" | "watered" | "harvested" | "ignored";

export type FarmInteractionResult = {
  readonly kind: FarmInteractionKind;
  readonly x: number;
  readonly y: number;
  readonly cropId?: string;
  readonly itemId?: string;
  readonly count?: number;
  readonly reason?: string;
};

export function farmPlotKey(x: number, y: number): string {
  return `${Math.trunc(x)},${Math.trunc(y)}`;
}

export function farmPlotAt(session: Pick<PlaySession, "farmPlots">, mapId: string, x: number, y: number): FarmPlotState | undefined {
  return session.farmPlots?.[mapId]?.[farmPlotKey(x, y)];
}

export function cropStageAt(session: Pick<PlaySession, "farmPlots">, mapId: string, x: number, y: number): number | undefined {
  return farmPlotAt(session, mapId, x, y)?.stage;
}

export function isTileFarmable(map: GameMap, x: number, y: number): boolean {
  if (!isIntegerTile(x, y) || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return (map.farmableArea ?? []).some((rect) => rectContainsTile(rect, x, y));
}

export function interactWithFarmPlot(
  project: Project,
  session: PlaySession,
  map: GameMap,
  x: number,
  y: number
): FarmInteractionResult {
  const tileX = Math.trunc(x);
  const tileY = Math.trunc(y);

  const placeableHit = tryPlaceableToolHarvest(project, session, map, tileX, tileY);
  if (placeableHit) return placeableHit;

  if (!isTileFarmable(map, tileX, tileY)) return ignored(tileX, tileY, "not-farmable");
  const plots = ensureMapPlots(session, map.id);
  const key = farmPlotKey(tileX, tileY);
  const existing = plots[key];
  if (existing?.cropId) {
    const crop = cropById(project, existing.cropId);
    if (!crop) return ignored(tileX, tileY, "missing-crop");
    if (!existing.dead && isCropReady(crop, existing)) {
      const count = Math.max(1, Math.trunc(crop.harvestCount || 1));
      changeItem(session, crop.harvestItemId, "+=", count);
      plots[key] = harvestNextPlotState(crop, existing);
      return { kind: "harvested", x: tileX, y: tileY, cropId: crop.id, itemId: crop.harvestItemId, count };
    }
  }
  if (!existing?.tilled) {
    const till = resolveToolUseOnTile(project, session, map, tileX, tileY, "till");
    if (!till) return ignored(tileX, tileY, "missing-hoe");
    plots[key] = { tilled: true, watered: false };
    return { kind: "tilled", x: tileX, y: tileY, itemId: till.itemId };
  }
  if (!existing.cropId) {
    const crop = firstPlantableCrop(project, session, currentSeason(session));
    if (!crop) return ignored(tileX, tileY, "missing-seed");
    changeItem(session, crop.seedItemId, "-=", 1);
    plots[key] = {
      tilled: true,
      watered: false,
      cropId: crop.id,
      plantedDay: plantedDay(session.gameTime),
      stage: 0,
      dead: false,
      growthDays: 0,
    };
    return { kind: "planted", x: tileX, y: tileY, cropId: crop.id, itemId: crop.seedItemId, count: 1 };
  }
  if (existing.dead) return ignored(tileX, tileY, "dead-crop");
  if (!existing.watered) {
    const water = resolveToolUseOnTile(project, session, map, tileX, tileY, "water");
    if (!water) return ignored(tileX, tileY, "missing-watering-can");
    plots[key] = { ...existing, watered: true };
    return { kind: "watered", x: tileX, y: tileY, cropId: existing.cropId, itemId: water.itemId };
  }
  return ignored(tileX, tileY, "already-watered");
}

function tryPlaceableToolHarvest(
  project: Project,
  session: PlaySession,
  map: GameMap,
  tileX: number,
  tileY: number
): FarmInteractionResult | undefined {
  const key = placeableKey(map.id, tileX, tileY);
  const placeable = session.placeables?.[key];
  if (!placeable) return undefined;
  const preferred =
    placeable.kind === "tree" ? "chop" : placeable.kind === "rock" ? "mine" : undefined;
  if (!preferred) return undefined;
  const use = resolveToolUseOnTile(project, session, map, tileX, tileY, preferred);
  if (!use) return ignored(tileX, tileY, preferred === "chop" ? "missing-axe" : "missing-pickaxe");
  // 계절별 채집물(seasonalDrops)이 저작돼 있으면 현재 계절의 산출을 우선한다.
  const dropId = placeableDropItemId(placeable, currentSeason(session));
  const removed = removeObjectAt(session, map.id, tileX, tileY);
  if (!removed) return ignored(tileX, tileY, "missing-placeable");
  if (dropId) changeItem(session, dropId, "+=", 1);
  return {
    kind: "harvested",
    x: tileX,
    y: tileY,
    itemId: dropId,
    count: dropId ? 1 : 0,
    reason: use.ruleId,
  };
}

export function advanceFarmPlotsForDay(
  project: Project,
  session: PlaySession,
  days = 1,
  season: Season = currentSeason(session)
): void {
  const count = Math.max(0, Math.trunc(days));
  for (let index = 0; index < count; index += 1) advanceFarmPlotsOneDay(project, session, season);
}

export function cropReady(project: Project, plot: FarmPlotState | undefined): boolean {
  if (!plot?.cropId || plot.dead) return false;
  const crop = cropById(project, plot.cropId);
  return crop ? isCropReady(crop, plot) : false;
}

export function cropStageForGrowthDays(crop: CropRecord, growthDays: number): number {
  let remaining = Math.max(0, Math.trunc(growthDays));
  let stage = 0;
  for (const segment of crop.stages) {
    const days = Math.max(1, Math.trunc(segment.days));
    if (remaining < days) return stage;
    remaining -= days;
    stage += 1;
  }
  return crop.stages.length;
}

function advanceFarmPlotsOneDay(project: Project, session: PlaySession, season: Season): void {
  const maps = session.farmPlots ?? {};
  for (const [mapId, plots] of Object.entries(maps)) {
    const nextPlots: Record<string, FarmPlotState> = {};
    for (const [key, plot] of Object.entries(plots)) {
      const crop = plot.cropId ? cropById(project, plot.cropId) : undefined;
      if (!crop) {
        nextPlots[key] = plot.watered ? { ...plot, watered: false } : plot;
        continue;
      }
      if (!crop.seasons.includes(season)) {
        nextPlots[key] = { ...plot, watered: false, dead: true };
        continue;
      }
      if (plot.dead || !plot.watered) {
        nextPlots[key] = plot.watered ? { ...plot, watered: false } : plot;
        continue;
      }
      const growthDays = Math.max(0, Math.trunc(plot.growthDays ?? 0)) + 1;
      nextPlots[key] = {
        ...plot,
        watered: false,
        dead: false,
        growthDays,
        stage: cropStageForGrowthDays(crop, growthDays),
      };
    }
    maps[mapId] = nextPlots;
  }
  session.farmPlots = maps;
}

function harvestNextPlotState(crop: CropRecord, plot: FarmPlotState): FarmPlotState {
  if (!crop.regrow) {
    return { tilled: true, watered: false };
  }
  const total = totalGrowthDays(crop);
  const growthDays = Math.max(0, total - Math.max(1, Math.trunc(crop.regrow.days)));
  return {
    ...plot,
    tilled: true,
    watered: false,
    dead: false,
    cropId: crop.id,
    growthDays,
    stage: cropStageForGrowthDays(crop, growthDays),
  };
}

function isCropReady(crop: CropRecord, plot: FarmPlotState): boolean {
  return (plot.stage ?? 0) >= crop.stages.length || (plot.growthDays ?? 0) >= totalGrowthDays(crop);
}

function totalGrowthDays(crop: CropRecord): number {
  return crop.stages.reduce((sum, stage) => sum + Math.max(1, Math.trunc(stage.days)), 0);
}

function firstPlantableCrop(project: Project, session: PlaySession, season: Season): CropRecord | undefined {
  return (project.database.crops ?? []).find((crop) =>
    crop.seasons.includes(season) && (session.inventory[crop.seedItemId] ?? 0) > 0
  );
}

function cropById(project: Project, cropId: string): CropRecord | undefined {
  return (project.database.crops ?? []).find((crop) => crop.id === cropId);
}

function ensureMapPlots(session: PlaySession, mapId: string): Record<string, FarmPlotState> {
  session.farmPlots ??= {};
  session.farmPlots[mapId] ??= {};
  return session.farmPlots[mapId];
}

function currentSeason(session: Pick<PlaySession, "gameTime">): Season {
  return session.gameTime?.season ?? "spring";
}

function plantedDay(time: GameTime | undefined): FarmPlotState["plantedDay"] {
  return {
    day: time?.day ?? 1,
    season: time?.season ?? "spring",
    year: time?.year ?? 1,
  };
}

function rectContainsTile(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

function isIntegerTile(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y);
}

function ignored(x: number, y: number, reason: string): FarmInteractionResult {
  return { kind: "ignored", x, y, reason };
}
