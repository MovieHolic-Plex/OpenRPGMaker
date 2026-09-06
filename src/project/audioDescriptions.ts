import type { AudioDescriptionOverrides, AudioResourceKind } from "./types/base";
import { assert, requireRecord, requireString } from "./io/guards";

export const AUDIO_DESCRIPTION_MAX_LENGTH = 4000;

/** Identity is the resource kind plus its raw ID, never a search-result prefix. */
export interface AudioResourceRef {
  readonly kind: AudioResourceKind;
  readonly resourceId: string;
}

/** Validate stored strings without normalizing them or consulting a catalog. */
export function validateAudioDescriptions(value: unknown): asserts value is AudioDescriptionOverrides | undefined {
  if (value === undefined) return;
  const overrides = requireRecord("audioDescriptions", value);
  for (const [kind, partition] of Object.entries(overrides)) {
    assert(kind === "music" || kind === "sound", `audioDescriptions.${kind}: unsupported audio resource kind`);
    const descriptions = requireRecord(`audioDescriptions.${kind}`, partition);
    for (const [resourceId, description] of Object.entries(descriptions)) {
      const label = `audioDescriptions.${kind}.${resourceId}`;
      requireAudioDescription(label, requireString(label, description));
    }
  }
}

function requireAudioDescription(label: string, description: string): string {
  assert(description.length <= AUDIO_DESCRIPTION_MAX_LENGTH, `${label}: exceeds ${AUDIO_DESCRIPTION_MAX_LENGTH} UTF-16 code units`);
  return description;
}

export function getAudioDescriptionOverride(
  overrides: AudioDescriptionOverrides | undefined,
  resource: AudioResourceRef,
): string | undefined {
  const partition = overrides?.[resource.kind];
  return partition !== undefined && Object.hasOwn(partition, resource.resourceId)
    ? partition[resource.resourceId]
    : undefined;
}

/** Pure write boundary: trim new input, preserve siblings, and retain explicit clears. */
export function setAudioDescriptionOverride(
  overrides: AudioDescriptionOverrides | undefined,
  resource: AudioResourceRef,
  input: unknown,
): AudioDescriptionOverrides {
  const description = requireAudioDescription("description", requireString("description", input).trim());
  return {
    ...overrides,
    [resource.kind]: { ...overrides?.[resource.kind], [resource.resourceId]: description },
  };
}

/** Pure reset: remove only this own key; an empty result restores field absence. */
export function resetAudioDescriptionOverride(
  overrides: AudioDescriptionOverrides | undefined,
  resource: AudioResourceRef,
): AudioDescriptionOverrides | undefined {
  if (getAudioDescriptionOverride(overrides, resource) === undefined) return overrides;
  const partition = { ...overrides?.[resource.kind] };
  delete partition[resource.resourceId];
  const result = { ...overrides };
  if (Object.keys(partition).length > 0) result[resource.kind] = partition;
  else delete result[resource.kind];
  return Object.keys(result).length > 0 ? result : undefined;
}
