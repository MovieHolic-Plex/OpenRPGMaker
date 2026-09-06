import { getAudioDescriptionOverride } from "./audioDescriptions";
import type { AudioDescriptionOverrides } from "./types";

/** Count state changes, including explicit clears and resets, by kind and raw ID. */
export function countAudioDescriptionChanges(
  before: AudioDescriptionOverrides | undefined,
  after: AudioDescriptionOverrides | undefined,
): number {
  let changed = 0;
  for (const kind of ["music", "sound"] as const) {
    const ids = new Set([
      ...Object.keys(before?.[kind] ?? {}),
      ...Object.keys(after?.[kind] ?? {}),
    ]);
    for (const resourceId of ids) {
      const resource = { kind, resourceId };
      if (getAudioDescriptionOverride(before, resource) !== getAudioDescriptionOverride(after, resource)) {
        changed += 1;
      }
    }
  }
  return changed;
}
