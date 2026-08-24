import { isPassable } from "@/project/collision";
import { calendarDayKey, daysPerSeasonOf, SEASONS, type GameTime } from "@/project/gameTime";
import { isItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { placeableDropItemId, placeableKey, type PlaceableObjectState } from "@/project/placeables";
import { changeItemsAtomically, type PlaySession } from "@/project/session";
import type { ForageAreaDefinition, ForageEntryDefinition, Project } from "@/project/types";
import { deterministicRng } from "@/util/rng";

export type ForageAdvanceResult =
  | { readonly ok: true; readonly dayKey: string; readonly spawned: number; readonly removed: number }
  | { readonly ok: false; readonly reason: "disabled" | "invalid-date" | "already-advanced" | "stale-day" | "invalid-state" };
export type ForageCollectResult =
  | { readonly ok: true; readonly itemId: string }
  | { readonly ok: false; readonly reason: "disabled" | "missing" | "stale" | "inventory" | "collection" | "xp" };

export function advanceSeasonalForage(project: Project, session: PlaySession, date: GameTime): ForageAdvanceResult {
  const config = project.system.seasonalForage;
  if (!config?.enabled) return { ok: false, reason: "disabled" };
  if (!validDate(date)) return { ok: false, reason: "invalid-date" };
  const dayKey = calendarDayKey(date);
  if (session.forageLastAdvancedDayKey === dayKey) return { ok: false, reason: "already-advanced" };
  if (session.forageLastAdvancedDayKey && dayOrdinal(project, session.forageLastAdvancedDayKey) >= dayOrdinal(project, dayKey)) {
    return { ok: false, reason: "stale-day" };
  }
  if (config.areas.some((area) => !validArea(project, area))) return { ok: false, reason: "invalid-state" };
  const draft = structuredClone(session);
  draft.placeables ??= {};
  let removed = 0;
  for (const [key, placeable] of Object.entries(draft.placeables)) {
    if (!placeable.forageSpawn) continue;
    const area = config.areas.find((entry) => entry.id === placeable.forageSpawn!.areaId);
    const entry = area?.entries.find((candidate) => candidate.id === placeable.forageSpawn!.entryId);
    const spawned = parseDayKey(placeable.forageSpawn.spawnedDayKey);
    const expired = !spawned || date.season !== spawned.season
      || dayOrdinal(project, dayKey) - dayOrdinal(project, placeable.forageSpawn.spawnedDayKey) >= (area?.despawnAfterDays ?? 0);
    if (!area || !entry || expired) { delete draft.placeables[key]; removed += 1; }
  }
  let spawned = 0;
  for (const area of [...config.areas].sort((a, b) => a.id.localeCompare(b.id))) {
    const interval = area.spawnEveryDays ?? 1;
    if ((dayOrdinal(project, dayKey) - 1) % interval !== 0) continue;
    const active = Object.values(draft.placeables).filter((entry) => entry.forageSpawn?.areaId === area.id).length;
    let remaining = Math.min(area.dailySpawnCount, Math.max(0, area.maxActive - active));
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    const map = project.maps[area.mapId]!;
    for (let y = area.area.y; y < area.area.y + area.area.h; y += 1) for (let x = area.area.x; x < area.area.x + area.area.w; x += 1) {
      if (draft.placeables[placeableKey(area.mapId, x, y)] || !isPassable(project, map, x, y)) continue;
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

export function collectForageAt(project: Project, session: PlaySession, mapId: string, x: number, y: number): ForageCollectResult {
  if (!project.system.seasonalForage?.enabled) return { ok: false, reason: "disabled" };
  const object = session.placeables?.[placeableKey(mapId, x, y)];
  if (!object?.forageSpawn || object.kind !== "forage") return { ok: false, reason: "missing" };
  const area = project.system.seasonalForage.areas.find((entry) => entry.id === object.forageSpawn!.areaId);
  const entry = area?.entries.find((candidate) => candidate.id === object.forageSpawn!.entryId);
  const itemId = object.itemId;
  if (!area || !entry || area.mapId !== mapId || !itemId || !project.database.items.some((item) => item.id === itemId)) return { ok: false, reason: "stale" };
  const current = session.inventory[itemId] ?? 0;
  if (!isItemQuantity(current) || current >= ITEM_QUANTITY_MAX) return { ok: false, reason: "inventory" };
  const draft = structuredClone(session);
  if (!changeItemsAtomically(draft, [{ itemId, op: "+=", amount: 1 }])) return { ok: false, reason: "inventory" };
  const skill = project.database.lifeSkills?.find((candidate) => candidate.skillType === "foraging");
  if (skill && !awardLifeSkillXp(project, draft, skill.id, 1).ok) return { ok: false, reason: "xp" };
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
  return Boolean(map && area.area.x >= 0 && area.area.y >= 0 && area.area.w > 0 && area.area.h > 0
    && area.area.x + area.area.w <= map.width && area.area.y + area.area.h <= map.height
    && Number.isSafeInteger(area.dailySpawnCount) && Number.isSafeInteger(area.maxActive));
}
function validDate(date: GameTime): boolean { return Number.isSafeInteger(date.year) && date.year > 0 && Number.isSafeInteger(date.day) && date.day > 0 && SEASONS.includes(date.season); }
function parseDayKey(value: string): { year: number; season: (typeof SEASONS)[number]; day: number } | undefined {
  const match = /^(\d+):(spring|summer|fall|winter):(\d+)$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]); const day = Number(match[3]); const season = match[2] as (typeof SEASONS)[number];
  return Number.isSafeInteger(year) && year > 0 && Number.isSafeInteger(day) && day > 0 ? { year, season, day } : undefined;
}
function dayOrdinal(project: Project, value: string): number {
  const date = parseDayKey(value); if (!date) return Number.POSITIVE_INFINITY;
  const length = daysPerSeasonOf(project);
  return ((date.year - 1) * 4 + SEASONS.indexOf(date.season)) * length + date.day;
}
function replace(target: PlaySession, source: PlaySession): void { Object.assign(target, source); }
