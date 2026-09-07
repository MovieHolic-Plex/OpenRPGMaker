import type { MonsterMetadata, MonsterMetadataOverrides } from "./types/base";
import { assert, requireArray, requireRecord, requireString } from "./io/guards";

export const MONSTER_METADATA_FIELDS = ["name", "tags", "description"] as const;
export const MONSTER_METADATA_NAME_MAX_LENGTH = 120;
export const MONSTER_METADATA_DESCRIPTION_MAX_LENGTH = 4000;
export const MONSTER_METADATA_TAG_MAX_LENGTH = 64;
export const MONSTER_METADATA_TAGS_MAX_COUNT = 32;

/** Stored data is validated without normalization or catalog registration. */
export function validateMonsterMetadata(value: unknown): asserts value is MonsterMetadataOverrides | undefined {
  if (value === undefined) return;
  for (const [id, metadata] of Object.entries(requireRecord("monsterMetadata", value))) {
    const label = `monsterMetadata.${id}`;
    const entry = requireRecord(label, metadata);
    if (Object.hasOwn(entry, "name")) {
      const name = requireString(`${label}.name`, entry.name);
      assert(name.trim().length > 0 && name.length <= MONSTER_METADATA_NAME_MAX_LENGTH, `${label}.name: must be nonblank and <=120 UTF-16 units`);
    }
    if (Object.hasOwn(entry, "description")) {
      const description = requireString(`${label}.description`, entry.description);
      assert(description.length <= MONSTER_METADATA_DESCRIPTION_MAX_LENGTH, `${label}.description: exceeds 4000 UTF-16 units`);
    }
    if (Object.hasOwn(entry, "tags")) {
      const tags = requireArray(`${label}.tags`, entry.tags);
      assert(tags.length <= MONSTER_METADATA_TAGS_MAX_COUNT, `${label}.tags: exceeds 32 tags`);
      for (const tag of tags) {
        assert(requireString(`${label}.tags`, tag).length <= MONSTER_METADATA_TAG_MAX_LENGTH, `${label}.tags: exceeds 64 UTF-16 units`);
      }
    }
  }
}

/** New input boundary; omitted fields inherit, empty tags/description explicitly clear. */
export function setMonsterMetadataOverride(
  overrides: MonsterMetadataOverrides | undefined,
  resourceId: string,
  patch: unknown,
): MonsterMetadataOverrides {
  const input = requireRecord("monster metadata patch", patch);
  const normalized = {
    ...(Object.hasOwn(input, "name") ? { name: requireString("name", input.name).trim() } : {}),
    ...(Object.hasOwn(input, "description") ? { description: requireString("description", input.description).trim() } : {}),
    ...(Object.hasOwn(input, "tags") ? {
      tags: [...new Set(requireArray("tags", input.tags).map(tag => requireString("tag", tag).trim()).filter(Boolean))],
    } : {}),
  };
  validateMonsterMetadata({ [resourceId]: normalized });
  const previous = overrides && Object.hasOwn(overrides, resourceId) ? overrides[resourceId] : undefined;
  return { ...overrides, [resourceId]: { ...previous, ...normalized } };
}

export function resetMonsterMetadataOverride(
  overrides: MonsterMetadataOverrides | undefined,
  resourceId: string,
): MonsterMetadataOverrides | undefined {
  if (!overrides || !Object.hasOwn(overrides, resourceId)) return overrides;
  const result = { ...overrides };
  delete result[resourceId];
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Count changed resources, not changed fields, independent of record insertion order. */
export function countMonsterMetadataChanges(
  before: MonsterMetadataOverrides | undefined,
  after: MonsterMetadataOverrides | undefined,
): number {
  return [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(id => {
    const left = before && Object.hasOwn(before, id) ? before[id] : undefined;
    const right = after && Object.hasOwn(after, id) ? after[id] : undefined;
    return MONSTER_METADATA_FIELDS.some(field => JSON.stringify(left?.[field]) !== JSON.stringify(right?.[field]));
  }).length;
}

/** Apply only locally changed fields to latest; never normalize stored values. */
export function applyMonsterMetadataDelta(
  base: MonsterMetadataOverrides | undefined,
  local: MonsterMetadataOverrides | undefined,
  latest: MonsterMetadataOverrides | undefined,
): MonsterMetadataOverrides | undefined {
  let result = latest;
  for (const id of new Set([...Object.keys(base ?? {}), ...Object.keys(local ?? {})])) {
    const previous = base && Object.hasOwn(base, id) ? base[id] : undefined;
    const current = local && Object.hasOwn(local, id) ? local[id] : undefined;
    const changed = new Set<string>(MONSTER_METADATA_FIELDS.filter(field =>
      JSON.stringify(previous?.[field]) !== JSON.stringify(current?.[field])));
    if (changed.size === 0) continue;
    const remote = latest && Object.hasOwn(latest, id) ? latest[id] : undefined;
    const merged: Partial<MonsterMetadata> = Object.fromEntries([
      ...Object.entries(remote ?? {}).filter(([field]) => !changed.has(field)),
      ...Object.entries(current ?? {}).filter(([field]) => changed.has(field)),
    ]);
    result = Object.keys(merged).length > 0
      ? { ...result, [id]: merged }
      : resetMonsterMetadataOverride(result, id);
  }
  return result;
}
