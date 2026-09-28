import { heldToolItemId, resolveToolUseOnTile } from "@/project/toolActions";
import { spendEnergy } from "@/project/energy";
import { hasAuthoredToolActions } from "@/project/toolActions";
import { inBounds, isPassable } from "@/project/collision";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { resolveToolCapability } from "@/project/upgrades";
import {
  daysPerSeasonOf,
  SEASONS,
  type GameTime,
  type ResolvedTimeSystemConfig,
  type Season,
  type TimeSystemConfig,
} from "@/project/gameTime";
import { changeItem, type FarmPlotState, type PlaySession } from "@/project/session";
import type { CropRecord, GameMap, Project, Rect } from "@/project/types";
import { placeableDropItemId, placeableKey, removeObjectAt } from "@/project/placeables";

/** 손상된 세이브가 성장 루프를 붙잡지 못하도록 한 번에 적용할 성장 틱 상한. */
const MAX_FARM_SYNC_DAYS = 400;

export type FarmInteractionKind = "tilled" | "planted" | "watered" | "harvested" | "ignored";

/** 손에 든 아이템이 결정하는 행동. undefined 면 기존 캐스케이드(수확→경작→파종→물주기)를 쓴다. */
export type FarmIntent = "till" | "water" | "plant" | "harvest";

export type FarmIgnoreReason =
  | "not-farmable"
  | "missing-crop"
  | "missing-hoe"
  | "missing-seed"
  | "missing-watering-can"
  | "already-watered"
  | "missing-axe"
  | "missing-pickaxe"
  | "missing-placeable"
  | "plot-needs-clearing"
  | "plot-needs-tilling"
  | "wrong-tool-for-plot"
  | "out-of-season"
  | "nothing-to-harvest"
  | "inventory-full"
  | "insufficient-energy"
  | "invalid-life-skill";

/**
 * 320x240 논리 화면에 한 줄로 들어가야 하므로 문구는 짧게 유지한다.
 * not-farmable / missing-placeable 은 열린 세계에서 A 를 누를 때마다 발생하므로 반드시 침묵한다.
 */
const FARM_IGNORE_MESSAGES: Readonly<Record<FarmIgnoreReason, string | null>> = Object.freeze({
  "not-farmable": null,
  "missing-placeable": null,
  // 손상된 세이브(DB 에서 사라진 cropId)와 고사 작물은 다른 문제다. 둘 다 괭이질로 정리되므로
  // 안내는 실제로 통하는 행동을 가리켜야 한다.
  "missing-crop": "알 수 없는 작물입니다 · 괭이로 정리하세요",
  "plot-needs-clearing": "말라 죽은 작물입니다 · 괭이로 정리하세요",
  "plot-needs-tilling": "먼저 괭이로 밭을 갈아야 합니다",
  "missing-hoe": "괭이가 필요합니다",
  "missing-seed": "심을 씨앗이 없습니다",
  "missing-watering-can": "물뿌리개가 필요합니다",
  "already-watered": "이미 물을 주었습니다",
  "missing-axe": "도끼가 필요합니다",
  "missing-pickaxe": "곡괭이가 필요합니다",
  "wrong-tool-for-plot": "지금 든 도구로는 할 수 없습니다",
  // 계절은 농사 게임의 가장 큰 규칙이다. 이걸 도구 탓으로 돌리면 플레이어는 씨앗을 바꿔 보거나
  // 밭을 다시 갈아 보며 헤맨다 — 손에 든 것도 밭도 옳았기 때문이다.
  "out-of-season": "이 씨앗은 지금 철이 아닙니다",
  "nothing-to-harvest": "수확할 것이 없습니다",
  "inventory-full": "가방이 가득 찼습니다",
  "insufficient-energy": "기력이 부족합니다",
  "invalid-life-skill": "생활 기술 기록을 확인할 수 없습니다",
});

/** ignored 결과를 플레이어에게 보여줄 한국어 문구. 표시할 필요가 없는 사유는 null. */
export function farmIgnoreMessage(reason: string | undefined): string | null {
  if (!reason) return null;
  return FARM_IGNORE_MESSAGES[reason as FarmIgnoreReason] ?? null;
}

/**
 * 손에 든 아이템에서 의도를 유도한다. 손이 비면 undefined(= 기존 캐스케이드).
 * 도끼/곡괭이는 `tryPlaceableToolHarvest` 경로로 이미 동작하므로 의도를 만들지 않는다.
 */
export function farmIntentForHand(project: Project, session: PlaySession): FarmIntent | undefined {
  // 보유하지 않은 잠재된 장착 id 는 빈 손(= 레거시 캐스케이드)으로 되돌린다 — 그러지 않으면
  // 마지막 씨앗을 심은 뒤 HUD 는 「빈 손」인데 의도만 plant 로 남아 화면과 조작이 갈라진다.
  const equipped = heldToolItemId(session);
  if (!equipped) return undefined;
  const item = project.database.items.find((entry) => entry.id === equipped);
  if (!item) return undefined;
  if (item.farmTool === "hoe") return "till";
  if (item.farmTool === "wateringCan") return "water";
  if (item.farmTool === "axe" || item.farmTool === "pickaxe") return undefined;
  if (item.type === "seed") return "plant";
  return undefined;
}

export type FarmInteractionResult = {
  readonly kind: FarmInteractionKind;
  readonly x: number;
  readonly y: number;
  readonly cropId?: string;
  readonly itemId?: string;
  readonly count?: number;
  readonly reason?: string;
  readonly source?: "crop" | "rock" | "tree";
  readonly energySpent?: number;
  readonly xpAwarded?: Readonly<Partial<Record<"farming" | "mining" | "foraging", number>>>;
  readonly affectedTiles?: readonly {
    readonly x: number;
    readonly y: number;
    readonly kind: Exclude<FarmInteractionKind, "ignored">;
  }[];
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
  y: number,
  intent?: FarmIntent
): FarmInteractionResult {
  if (!isIntegerTile(x, y) || !inBounds(map, x, y)) return ignored(x, y, "not-farmable");
  const tileX = Math.trunc(x);
  const tileY = Math.trunc(y);
  const heldItemId = heldToolItemId(session);
  const heldItem = heldItemId ? project.database.items.find((item) => item.id === heldItemId) : undefined;
  const capability = heldItem?.farmTool
    ? resolveToolCapability(project, heldItemId)
    : { areaWidth: 1, areaHeight: 1, energyMultiplier: 1 };
  const targets = capabilityTiles(map, tileX, tileY, capability.areaWidth, capability.areaHeight);
  // Read-only rejection before the transactional clone. Any possible harvest or authored
  // tool action keeps the original all-or-nothing path, including energy/XP rollback.
  const canInteract = targets.some(({ x: tx, y: ty }) => {
    const placeable = session.placeables?.[placeableKey(map.id, tx, ty)];
    return placeable?.kind === "tree" || placeable?.kind === "rock" || isTileFarmable(map, tx, ty)
      || resolveToolUseOnTile(project, session, map, tx, ty, "till")
      || resolveToolUseOnTile(project, session, map, tx, ty, "water")
      || resolveToolUseOnTile(project, session, map, tx, ty, "harvest");
  });
  if (!canInteract) return ignored(tileX, tileY, "not-farmable");
  const draft = structuredClone(session);
  const results = targets
    .map(({ x: targetX, y: targetY }) => interactWithFarmPlotSingle(project, draft, map, targetX, targetY, intent));
  const successful = results.filter(
    (result): result is FarmInteractionResult & { kind: Exclude<FarmInteractionKind, "ignored"> } => result.kind !== "ignored",
  );
  if (successful.length === 0) {
    return results.find((result) => result.x === tileX && result.y === tileY) ?? ignored(tileX, tileY, "not-farmable");
  }

  let energySpent = 0;
  if (project.system.energy) {
    energySpent = Math.max(1, Math.ceil(successful.length * capability.energyMultiplier));
    const energy = spendEnergy(project, draft, energySpent);
    if (!energy.ok) return ignored(tileX, tileY, "insufficient-energy");
  }

  const xpAwarded = awardInteractionXp(project, draft, successful);
  if (!xpAwarded) return ignored(tileX, tileY, "invalid-life-skill");
  Object.assign(session, draft);
  const primary = results.find((result) => result.x === tileX && result.y === tileY && result.kind !== "ignored") ?? successful[0]!;
  return {
    ...primary,
    energySpent,
    xpAwarded,
    affectedTiles: successful.map((result) => ({ x: result.x, y: result.y, kind: result.kind })),
  };
}

function interactWithFarmPlotSingle(
  project: Project,
  session: PlaySession,
  map: GameMap,
  x: number,
  y: number,
  intent?: FarmIntent
): FarmInteractionResult {
  const tileX = Math.trunc(x);
  const tileY = Math.trunc(y);

  if (!isPassable(project, map, tileX, tileY)) return ignored(tileX, tileY, "not-farmable");
  // Only the tree/rock being harvested is exempt from occupancy, not overlapping assets.
  const placeables = { ...session.placeables };
  const targetKey = placeableKey(map.id, tileX, tileY);
  const target = placeables[targetKey];
  if (target?.kind === "tree" || target?.kind === "rock") delete placeables[targetKey];
  // Exempt only this transaction's plot; neighboring plots still reserve space.
  const mapPlots = { ...session.farmPlots?.[map.id] };
  delete mapPlots[farmPlotKey(tileX, tileY)];
  const farmPlots = { ...session.farmPlots, [map.id]: mapPlots };
  if (!canOccupySpatialFootprint(project, { ...session, placeables, farmPlots },
    { mapId: map.id, x: tileX, y: tileY, orientation: "down" }, { width: 1, height: 1 })) {
    return ignored(tileX, tileY, "not-farmable");
  }
  // 도끼/곡괭이는 의도와 무관하게 항상 먼저 처리한다 (설치물 채집 경로).
  const placeableHit = tryPlaceableToolHarvest(project, session, map, tileX, tileY);
  if (placeableHit) return placeableHit;
  if (!isTileFarmable(map, tileX, tileY)
    && !(["till", "water", "harvest"] as const).some((action) =>
      resolveToolUseOnTile(project, session, map, tileX, tileY, action))) {
    return ignored(tileX, tileY, "not-farmable");
  }
  const plots = ensureMapPlots(session, map.id);
  const key = farmPlotKey(tileX, tileY);
  const existing = plots[key];

  // Resolve authored hand actions at the target tile; preserve the empty-hand cascade.
  const handUse = heldToolItemId(session) && hasAuthoredToolActions(project)
    ? resolveToolUseOnTile(project, session, map, tileX, tileY) : undefined;
  if (handUse?.action === "till" || handUse?.action === "water" || handUse?.action === "harvest") {
    return interactWithIntent(project, session, map, tileX, tileY, plots, key, existing, handUse.action);
  }
  if (intent) return interactWithIntent(project, session, map, tileX, tileY, plots, key, existing, intent);

  // 죽은 작물과 DB 에서 사라진 작물은 다른 분기보다 먼저 처리해야 밭이 영구히 잠기지 않는다.
  // 괭이질로 초기화한다.
  if (needsClearing(project, existing)) return tillPlot(project, session, map, plots, key, tileX, tileY);
  const harvested = tryHarvestPlot(project, session, map, plots, key, existing, tileX, tileY);
  if (harvested) return harvested;
  if (!existing?.tilled) return tillPlot(project, session, map, plots, key, tileX, tileY);
  if (!existing.cropId) {
    if (!isTileFarmable(map, tileX, tileY)) return ignored(tileX, tileY, "not-farmable");
    const crop = firstPlantableCrop(project, session, currentSeason(session));
    if (!crop) return ignored(tileX, tileY, "missing-seed");
    return plantPlot(session, plots, key, tileX, tileY, crop);
  }
  if (!existing.watered) return waterPlot(project, session, map, plots, key, existing, tileX, tileY);
  return ignored(tileX, tileY, "already-watered");
}

function capabilityTiles(
  map: GameMap,
  x: number,
  y: number,
  width: number,
  height: number,
): readonly { readonly x: number; readonly y: number }[] {
  const startX = Math.max(0, x - Math.floor(width / 2));
  const startY = Math.max(0, y - Math.floor(height / 2));
  const endX = Math.min(map.width, x - Math.floor(width / 2) + width);
  const endY = Math.min(map.height, y - Math.floor(height / 2) + height);
  const tiles: { x: number; y: number }[] = [];
  for (let targetY = startY; targetY < endY; targetY += 1) {
    for (let targetX = startX; targetX < endX; targetX += 1) tiles.push({ x: targetX, y: targetY });
  }
  return tiles;
}

function awardInteractionXp(
  project: Project,
  session: PlaySession,
  results: readonly FarmInteractionResult[],
): Readonly<Partial<Record<"farming" | "mining" | "foraging", number>>> | undefined {
  if (project.system.skillSystem?.enabled !== true) return {};
  const amounts = {
    farming: results.filter((result) => result.source === "crop").length * 10,
    mining: results.filter((result) => result.source === "rock").length * 10,
    foraging: results.filter((result) => result.source === "tree").length * 10,
  } as const;
  const awarded: Partial<Record<"farming" | "mining" | "foraging", number>> = {};
  for (const skillType of ["farming", "mining", "foraging"] as const) {
    const amount = amounts[skillType];
    if (amount === 0) continue;
    const skill = project.database.lifeSkills?.find((entry) => entry.skillType === skillType);
    if (!skill) continue;
    const result = awardLifeSkillXp(project, session, skill.id, amount);
    if (!result.ok) return undefined;
    awarded[skillType] = amount;
  }
  return awarded;
}

/** 손에 든 아이템이 정한 단일 행동만 시도한다. 실패는 반드시 사유가 있는 ignored 로 돌려준다. */
function interactWithIntent(
  project: Project,
  session: PlaySession,
  map: GameMap,
  tileX: number,
  tileY: number,
  plots: Record<string, FarmPlotState>,
  key: string,
  existing: FarmPlotState | undefined,
  intent: FarmIntent
): FarmInteractionResult {
  // 괭이질로만 정리되는 밭(고사 작물 / DB 에 없는 cropId)은 어떤 의도보다 먼저 판정한다.
  if (needsClearing(project, existing)) {
    if (intent === "till") return tillPlot(project, session, map, plots, key, tileX, tileY);
    return ignored(tileX, tileY, existing?.dead ? "plot-needs-clearing" : "missing-crop");
  }
  // Legacy harvest ignores hand intent; an authored harvest rule must still authorize it.
  const harvested = tryHarvestPlot(project, session, map, plots, key, existing, tileX, tileY);
  if (harvested) return harvested;

  switch (intent) {
    case "harvest":
      return ignored(tileX, tileY, "nothing-to-harvest");
    case "till":
      if (!existing?.tilled) return tillPlot(project, session, map, plots, key, tileX, tileY);
      return ignored(tileX, tileY, "wrong-tool-for-plot");
    case "plant": {
      if (!isTileFarmable(map, tileX, tileY)) return ignored(tileX, tileY, "not-farmable");
      // 괭이를 가지고 있어도 갈지 않은 밭에는 심을 수 없다 — 도구가 없다는 안내는 거짓이다.
      if (!existing?.tilled) return ignored(tileX, tileY, "plot-needs-tilling");
      if (existing.cropId) return ignored(tileX, tileY, "wrong-tool-for-plot");
      const crop = handSeedCrop(project, session);
      if (crop === "out-of-season") return ignored(tileX, tileY, "out-of-season");
      if (!crop) return ignored(tileX, tileY, "missing-seed");
      return plantPlot(session, plots, key, tileX, tileY, crop);
    }
    case "water":
      if (!existing?.cropId) return ignored(tileX, tileY, "wrong-tool-for-plot");
      if (existing.watered) return ignored(tileX, tileY, "already-watered");
      return waterPlot(project, session, map, plots, key, existing, tileX, tileY);
  }
}

/**
 * 손에 든 씨앗이 지정하는 작물. 손에 씨앗이 없으면 기존 `firstPlantableCrop` 로 되돌아간다.
 * (씨앗을 들면 DB 행 순서가 아니라 플레이어의 선택이 심을 작물을 결정해야 한다.)
 */
function handSeedCrop(project: Project, session: PlaySession): CropRecord | "out-of-season" | undefined {
  const equipped = heldToolItemId(session);
  const handItem = equipped ? project.database.items.find((entry) => entry.id === equipped) : undefined;
  if (!handItem || handItem.type !== "seed") return firstPlantableCrop(project, session, currentSeason(session));
  const crop = (project.database.crops ?? []).find((entry) => entry.seedItemId === handItem.id);
  if (!crop) return undefined;
  if (!crop.seasons.includes(currentSeason(session))) return "out-of-season";
  return crop;
}

function tryHarvestPlot(
  project: Project,
  session: PlaySession,
  map: GameMap,
  plots: Record<string, FarmPlotState>,
  key: string,
  existing: FarmPlotState | undefined,
  tileX: number,
  tileY: number
): FarmInteractionResult | undefined {
  if (!existing?.cropId) return undefined;
  // 고사/DB 미등록 작물은 호출자가 `needsClearing` 으로 먼저 걸러낸다 — 여기선 정상 작물만 본다.
  const crop = cropById(project, existing.cropId);
  if (!crop || existing.dead || !isCropReady(crop, existing)) return undefined;
  if (project.system.toolActions?.some((rule) => rule.action === "harvest")) {
    if (!resolveToolUseOnTile(project, session, map, tileX, tileY, "harvest")) {
      return ignored(tileX, tileY, "wrong-tool-for-plot");
    }
  } else if (!isTileFarmable(map, tileX, tileY)) {
    return ignored(tileX, tileY, "not-farmable");
  }
  const count = Math.max(0, Math.trunc(crop.harvestCount ?? 1));
  if (!changeItem(session, crop.harvestItemId, "+=", count)) return ignored(tileX, tileY, "inventory-full");
  plots[key] = harvestNextPlotState(crop, existing);
  return { kind: "harvested", x: tileX, y: tileY, cropId: crop.id, itemId: crop.harvestItemId, count, source: "crop" };
}

function tillPlot(
  project: Project,
  session: PlaySession,
  map: GameMap,
  plots: Record<string, FarmPlotState>,
  key: string,
  tileX: number,
  tileY: number
): FarmInteractionResult {
  const till = resolveToolUseOnTile(project, session, map, tileX, tileY, "till");
  if (!till) return ignored(tileX, tileY, "missing-hoe");
  plots[key] = { tilled: true, watered: false };
  return { kind: "tilled", x: tileX, y: tileY, itemId: till.itemId };
}

function plantPlot(
  session: PlaySession,
  plots: Record<string, FarmPlotState>,
  key: string,
  tileX: number,
  tileY: number,
  crop: CropRecord
): FarmInteractionResult {
  if (!changeItem(session, crop.seedItemId, "-=", 1)) return ignored(tileX, tileY, "missing-seed");
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

function waterPlot(
  project: Project,
  session: PlaySession,
  map: GameMap,
  plots: Record<string, FarmPlotState>,
  key: string,
  existing: FarmPlotState,
  tileX: number,
  tileY: number
): FarmInteractionResult {
  const water = resolveToolUseOnTile(project, session, map, tileX, tileY, "water");
  if (!water) return ignored(tileX, tileY, "missing-watering-can");
  plots[key] = { ...existing, watered: true };
  return { kind: "watered", x: tileX, y: tileY, cropId: existing.cropId, itemId: water.itemId };
}

function tryPlaceableToolHarvest(
  project: Project,
  session: PlaySession,
  map: GameMap,
  tileX: number,
  tileY: number
): FarmInteractionResult | undefined {
  if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return undefined;
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
  if (dropId && !changeItem(session, dropId, "+=", 1)) return ignored(tileX, tileY, "inventory-full");
  const removed = removeObjectAt(session, map.id, tileX, tileY);
  if (!removed) return ignored(tileX, tileY, "missing-placeable");
  return {
    kind: "harvested",
    x: tileX,
    y: tileY,
    itemId: dropId,
    count: dropId ? 1 : 0,
    reason: use.ruleId,
    source: placeable.kind === "tree" ? "tree" : "rock",
  };
}

/**
 * 이 함수는 달력과 무관한 추가 성장이며 커서를 옮기지 않는다.
 * (authored `advanceCropGrowth` 는 session.gameTime 을 건드리지 않으므로 커서를 밀면
 *  다음 실제 날짜 롤오버가 elapsed <= 0 이 되어 자연 성장 하루를 삼킨다.)
 */
export function advanceFarmPlotsForDay(
  project: Project,
  session: PlaySession,
  days = 1,
  season: Season = currentSeason(session)
): void {
  const count = Math.max(0, Math.trunc(days));
  for (let index = 0; index < count; index += 1) advanceFarmPlotsOneDay(project, session, season);
}

/**
 * 달력 날짜 차이만큼 성장 틱을 적용한다. 잠을 자지 않고 자정을 넘겨도 작물이 자라야 하므로
 * 성장은 수면 이벤트가 아니라 날짜 델타의 함수다. session.gameTime 을 쓰는 모든 경로에서 호출한다.
 */
export function syncFarmPlotsToDate(
  project: Project,
  session: PlaySession,
  system?: ResolvedTimeSystemConfig | TimeSystemConfig
): void {
  const time = session.gameTime;
  if (!time) return;
  const target = farmPlotDateOf(time);
  const cursor = session.farmPlotsAdvancedThrough;
  // 커서가 없는 기존 세이브는 현재 날짜로만 맞춘다(로드 직후 며칠을 몰아서 성장시키지 않는다).
  if (!cursor) {
    session.farmPlotsAdvancedThrough = target;
    return;
  }
  const daysPerSeason = daysPerSeasonOf(system ?? project);
  const targetIndex = calendarDayIndex(target, daysPerSeason);
  const elapsed = targetIndex - calendarDayIndex(cursor, daysPerSeason);
  if (elapsed <= 0) {
    session.farmPlotsAdvancedThrough = target;
    return;
  }
  // 손상된 세이브가 루프를 붙잡지 못하도록 틱 수에 상한을 둔다.
  const ticks = Math.min(elapsed, MAX_FARM_SYNC_DAYS);
  for (let index = ticks - 1; index >= 0; index -= 1) {
    // 계절 경계를 넘는 틱은 넘어간 쪽 계절로 판정해야 제철 외 고사가 제대로 발동한다.
    advanceFarmPlotsOneDay(project, session, seasonAtDayIndex(targetIndex - index, daysPerSeason));
  }
  session.farmPlotsAdvancedThrough = target;
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

/** Regrowth projects onto the existing stages without letting initial growth shorten its timer. */
export function cropStageForPlot(crop: CropRecord, plot: FarmPlotState): number {
  if (plot.regrowDaysRemaining === undefined) return plot.stage ?? 0;
  return cropStageForGrowthDays(crop, totalGrowthDays(crop) - plot.regrowDaysRemaining);
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
      const regrowDaysRemaining = plot.regrowDaysRemaining === undefined
        ? undefined : Math.max(0, plot.regrowDaysRemaining - 1);
      const growthDays = regrowDaysRemaining === undefined
        ? Math.max(0, Math.trunc(plot.growthDays ?? 0)) + 1
        : Math.max(0, totalGrowthDays(crop) - regrowDaysRemaining);
      nextPlots[key] = {
        ...plot,
        watered: false,
        dead: false,
        ...(regrowDaysRemaining === undefined ? {} : { regrowDaysRemaining }),
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
  const regrowDaysRemaining = Math.max(1, Math.trunc(crop.regrow.days));
  const growthDays = Math.max(0, totalGrowthDays(crop) - regrowDaysRemaining);
  return {
    ...plot,
    tilled: true,
    watered: false,
    dead: false,
    cropId: crop.id,
    regrowDaysRemaining,
    growthDays,
    stage: cropStageForGrowthDays(crop, growthDays),
  };
}

function isCropReady(crop: CropRecord, plot: FarmPlotState): boolean {
  if (plot.regrowDaysRemaining !== undefined) return plot.regrowDaysRemaining === 0;
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

/** 괭이질로 초기화해야만 다시 쓸 수 있는 밭. 고사 작물 + DB 에서 사라진 작물(손상 세이브). */
function needsClearing(project: Project, plot: FarmPlotState | undefined): boolean {
  if (!plot) return false;
  if (plot.dead === true) return true;
  const cropId = plot.cropId;
  return cropId !== undefined && !cropById(project, cropId);
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

type FarmPlotDate = NonNullable<PlaySession["farmPlotsAdvancedThrough"]>;

function farmPlotDateOf(time: GameTime): FarmPlotDate {
  return { day: time.day, season: time.season, year: time.year };
}

/** 연/계절/일을 단일 정수로 접은 값. 날짜 델타와 각 틱의 계절을 여기서 파생한다. */
function calendarDayIndex(date: FarmPlotDate, daysPerSeason: number): number {
  const seasonIndex = Math.max(0, SEASONS.indexOf(date.season));
  const seasons = (Math.max(1, Math.trunc(date.year)) - 1) * SEASONS.length + seasonIndex;
  // 더 긴 계절에서 저장된 커서가 짧아진 계절 길이를 넘어 음수 elapsed 를 만들지 않도록 일자를 조인다.
  const day = Math.min(Math.max(1, daysPerSeason), Math.max(1, Math.trunc(date.day)));
  return seasons * daysPerSeason + (day - 1);
}


function seasonAtDayIndex(index: number, daysPerSeason: number): Season {
  const seasons = Math.floor(Math.max(0, index) / daysPerSeason);
  return SEASONS[seasons % SEASONS.length] ?? "spring";
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
