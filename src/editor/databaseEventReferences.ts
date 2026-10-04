import type { GameEvent, PersistedGameEvent } from "@/project/types";

/** Working edits and the body that canonical saves retain both own references. */
export function eventReferenceMatches(event: GameEvent, matches: (body: PersistedGameEvent) => boolean): boolean {
  if (matches(event)) return true;
  const draft = event.draft;
  // New-draft baselines are not persisted. A remotely deleted original must not
  // be resurrected by saving, so it is not a canonical reference owner either.
  return draft?.kind === "edit"
    && draft.conflict?.kind !== "remote-delete"
    && draft.original !== undefined
    && matches(draft.original);
}
