import { inBounds } from "@/project/collision";
import { calendarDayKey, daysPerSeasonOf, SEASONS, type GameTime } from "@/project/gameTime";
import { isItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { placeableDropItemId, placeableKey, type PlaceableObjectState } from "@/project/placeables";
import { changeItemsAtomically, type PlaySession } from "@/project/session";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import type { ForageAreaDefinition, ForageEntryDefinition, Project } from "@/project/types";
import { deterministicRng } from "@/util/rng";

export type ForageAdvanceResult =
  | { readonly ok: true; readonly dayKey: string; readonly spawned: number; readonly removed: number }
  | { readonly ok: false; readonly reason: "disabled" | "invalid-date" | "already-advanced" | "stale-day" | "invalid-state" };
export type ForageCollectResult =
  | { readonly ok: true; readonly itemId: string }
  | { readonly ok: false; readonly reason: "disabled" | "missing" | "stale" | "expired" | "inventory" | "collection" | "xp" };

export function advanceSeasonalForage(project: Project, session: PlaySession, date: GameTime): ForageAdvanceResult {
  const config = project.system.seasonalForage;
  if (!config?.enabled) return { ok: false, reason: "disabled" };
  if (!validDate(project, date)) return { ok: false, reason: "invalid-date" };
  const dayKey = calendarDayKey(date);
  if (session.forageLastAdvancedDayKey === dayKey) return { ok: false, reason: "already-advanced" };
  const ordinal = dayOrdinal(project, date);
  if (session.forageLastAdvancedDayKey) {
    const previous = parseDayKey(project, session.forageLastAdvancedDayKey);
    if (!previous || dayOrdinal(project, previous) >= ordinal) return { ok: false, reason: "stale-day" };
  }
  if (config.areas.some((area) => !validArea(project, area))) return { ok: false, reason: "invalid-state" };
  const draft = structuredClone(session);
  draft.placeables ??= {};
  let removed = 0;
  for (const [key, placeable] of Object.entries(draft.placeables)) {
    if (!placeable.forageSpawn) continue;
    const area = config.areas.find((entry) => entry.id === placeable.forageSpawn!.areaId);
    const entry = area?.entries.find((candidate) => candidate.id === placeable.forageSpawn!.entryId);
    const spawned = parseDayKey(project, placeable.forageSpawn.spawnedDayKey);
    const expired = !spawned || date.season !== spawned.season
      || ordinal - dayOrdinal(project, spawned) >= (area?.despawnAfterDays ?? 0);
    if (!area || !entry || expired) { delete draft.placeables[key]; removed += 1; }
  }
  let spawned = 0;
  for (const area of [...config.areas].sort((a, b) => a.id.localeCompare(b.id))) {
    const interval = area.spawnEveryDays ?? 1;
    if ((ordinal - 1n) % BigInt(interval) !== 0n) continue;
    const active = Object.values(draft.placeables).filter((entry) => entry.forageSpawn?.areaId === area.id).length;
    let remaining = Math.min(area.dailySpawnCount, Math.max(0, area.maxActive - active));
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    for (let y = area.area.y; y < area.area.y + area.area.h; y += 1) for (let x = area.area.x; x < area.area.x + area.area.w; x += 1) {
      if (!canOccupySpatialFootprint(project, draft, {
        mapId: area.mapId,
        x,
        y,
        orientation: "down",
      }, { width: 1, height: 1 })) continue;
      candidates.push({ x, y, score: deterministicRng(draft.rng?.seed ?? 1, "forage-cell", dayKey, area.id, x, y)() });
    }
    candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
    for (const point of candidates) {
      if (remaining <= 0) break;
      const entry = selectEntry(area.entries, draft.rng?.seed ?? 1, dayKey, area.id, point.x, point.y);
      const itemId = entry && placeableDropItemId(entry, date.season);
      if (!entry || !itemId || !project.database.items.some((item) => item.id === itemId)) continue;
      const placed: PlaceableObjectState = {
        id: `forage:${area.id}:${dayKey}:${point.x},${point.y}`,
        mapId: area.mapId,
        x: point.x,
        y: point.y,
        kind: "forage",
        itemId,
        forageSpawn: { areaId: area.id, entryId: entry.id, spawnedDayKey: dayKey },
      };
      draft.placeables[placeableKey(area.mapId, point.x, point.y)] = placed;
      spawned += 1;
      remaining -= 1;
    }
  }
  draft.forageLastAdvancedDayKey = dayKey;
  replace(session, draft);
  return { ok: true, dayKey, spawned, removed };
}

/** Read-only target check shared by collection and the overlay. */
export function resolveForageAt(project: Project, session: Pick<PlaySession, "placeables" | "gameTime">, mapId: string, x: number, y: number): ForageCollectResult {
  if (!project.system.seasonalForage?.enabled) return { ok: false, reason: "disabled" };
  const map = project.maps[mapId];
  if (!map || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !inBounds(map, x, y)) return { ok: false, reason: "stale" };
  const object = session.placeables?.[placeableKey(mapId, x, y)];
  if (!object?.forageSpawn || object.kind !== "forage") return { ok: false, reason: "missing" };
  const area = project.system.seasonalForage.areas.find((entry) => entry.id === object.forageSpawn!.areaId);
  const entry = area?.entries.find((candidate) => candidate.id === object.forageSpawn!.entryId);
  const itemId = object.itemId;
  const spawned = parseDayKey(project, object.forageSpawn.spawnedDayKey);
  const expectedItemId = entry && spawned ? placeableDropItemId(entry, spawned.season) : undefined;
  if (!area || !entry || object.mapId !== mapId || object.x !== x || object.y !== y
    || area.mapId !== mapId || !pointInArea(area, x, y) || !itemId
    || itemId !== expectedItemId || !project.database.items.some((item) => item.id === itemId)) {
    return { ok: false, reason: "stale" };
  }
  const date = session.gameTime;
  if (!spawned || !date || !validDate(project, date)) return { ok: false, reason: "stale" };
  const age = dayOrdinal(project, date) - dayOrdinal(project, spawned);
  if (age < 0n || date.season !== spawned.season || age >= area.despawnAfterDays) return { ok: false, reason: "expired" };
  return { ok: true, itemId };
}

export function collectForageAt(project: Project, session: PlaySession, mapId: string, x: number, y: number): ForageCollectResult {
  const target = resolveForageAt(project, session, mapId, x, y);
  if (!target.ok) return target;
  const { itemId } = target;
  const current = session.inventory[itemId] ?? 0;
  if (!isItemQuantity(current) || current >= ITEM_QUANTITY_MAX) return { ok: false, reason: "inventory" };
  const draft = structuredClone(session);
  if (!changeItemsAtomically(draft, [{ itemId, op: "+=", amount: 1 }])) return { ok: false, reason: "inventory" };
  const skill = project.database.lifeSkills?.find((candidate) => candidate.skillType === "foraging");
  if (project.system.skillSystem?.enabled === true && skill && !awardLifeSkillXp(project, draft, skill.id, 1).ok) return { ok: false, reason: "xp" };
  delete draft.placeables?.[placeableKey(mapId, x, y)];
  replace(session, draft);
  return { ok: true, itemId };
}

function selectEntry(entries: readonly ForageEntryDefinition[], seed: number, dayKey: string, areaId: string, x: number, y: number): ForageEntryDefinition | undefined {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isSafeInteger(total) || total <= 0) return undefined;
  let roll = deterministicRng(seed, "forage-entry", dayKey, areaId, x, y)() * total;
  return entries.find((entry) => ((roll -= entry.weight) < 0)) ?? entries[entries.length - 1];
}
function validArea(project: Project, area: ForageAreaDefinition): boolean {
  const map = project.maps[area.mapId];
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const seenEntryIds = new Set<string>();
  return Boolean(map && area.area.x >= 0 && area.area.y >= 0 && area.area.w > 0 && area.area.h > 0
    && area.area.x + area.area.w <= map.width && area.area.y + area.area.h <= map.height
    && Number.isSafeInteger(area.dailySpawnCount) && area.dailySpawnCount >= 0
    && Number.isSafeInteger(area.maxActive) && area.maxActive >= 0
    && (area.spawnEveryDays === undefined || (Number.isSafeInteger(area.spawnEveryDays) && area.spawnEveryDays > 0))
    && Number.isSafeInteger(area.despawnAfterDays) && area.despawnAfterDays > 0
    && Array.isArray(area.entries) && area.entries.length > 0
    && area.entries.every((entry) => {
      if (!entry.id.trim() || seenEntryIds.has(entry.id) || !Number.isSafeInteger(entry.weight) || entry.weight <= 0) return false;
      seenEntryIds.add(entry.id);
      const drops = [entry.itemId, ...Object.values(entry.seasonalDrops ?? {})].filter((id): id is string => typeof id === "string");
      return drops.length > 0 && drops.every((id) => itemIds.has(id));
    }));
}
function validDate(project: Project, date: GameTime): boolean {
  return Number.isSafeInteger(date.year) && date.year > 0 && Number.isSafeInteger(date.day)
    && date.day > 0 && date.day <= daysPerSeasonOf(project) && SEASONS.includes(date.season);
}
function parseDayKey(project: Project, value: string): { year: number; season: (typeof SEASONS)[number]; day: number } | undefined {
  const match = /^(\d+):(spring|summer|fall|winter):(\d+)$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]); const day = Number(match[3]); const season = match[2] as (typeof SEASONS)[number];
  return Number.isSafeInteger(year) && year > 0 && Number.isSafeInteger(day)
    && day > 0 && day <= daysPerSeasonOf(project) ? { year, season, day } : undefined;
}
/** Valid safe-integer years can have unsafe absolute day numbers. Keep arithmetic exact,
 * including cadence and cursor ordering; bigint never enters persisted session state. */
function dayOrdinal(project: Project, date: Pick<GameTime, "year" | "season" | "day">): bigint {
  const length = BigInt(daysPerSeasonOf(project));
  return ((BigInt(date.year) - 1n) * 4n + BigInt(SEASONS.indexOf(date.season))) * length + BigInt(date.day);
}
function pointInArea(area: ForageAreaDefinition, x: number, y: number): boolean {
  return x >= area.area.x && y >= area.area.y && x < area.area.x + area.area.w && y < area.area.y + area.area.h;
}
function replace(target: PlaySession, source: PlaySession): void { Object.assign(target, source); }
