import type { ActivityEntry, ActivityTrace } from "@/ai/activityTrace";

export const majorActivityKinds = new Set(["tool", "agent_spawn", "agent_done", "review", "status", "error"]);
// Entries are immutable reducer snapshots. Main/member views share this one pass;
// weak keys release the index with the snapshot instead of retaining old runs.
const indices = new WeakMap<readonly ActivityEntry[], {
  byActor: Map<string, ActivityEntry[]>;
  mediaByActor: Map<string, NonNullable<ActivityEntry["visuals"]>>;
  latestMedia: ActivityEntry["visuals"];
  phases: Map<string | undefined, string>;
  saves: Map<string | undefined, string>;
}>();
export function activityEntryIndex(trace: ActivityTrace) {
  let index = indices.get(trace.entries);
  if (index) return index;
  index = { byActor: new Map(), mediaByActor: new Map(), latestMedia: undefined, phases: new Map(), saves: new Map() };
  for (const entry of trace.entries) {
    let bucket = index.byActor.get(entry.actor);
    if (!bucket) { bucket = []; index.byActor.set(entry.actor, bucket); }
    bucket.push(entry);
    if (majorActivityKinds.has(entry.kind)) {
      const target = entry.name === "run.phase" ? index.phases : entry.name.startsWith("save.") ? index.saves : undefined;
      if (target) { target.set(undefined, entry.id); target.set(entry.actor, entry.id); }
    }
    if (entry.visuals?.length) {
      index.mediaByActor.set(entry.actor, entry.visuals);
      index.latestMedia = entry.visuals;
    }
  }
  indices.set(trace.entries, index);
  return index;
}
