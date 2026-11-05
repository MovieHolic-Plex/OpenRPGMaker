// Planted-defect scoring. A plant counts as caught when a candidate points at the plant's location (its event, or
// for map-level plants a job on that map) with a check that can describe it. Caught before review = some candidate
// exists; caught after review = one of those candidates got verdict "real" from the reviewer.

const COMPATIBLE = {
  "garbled-text": ["C10", "C05", "C01", "C12", "C17"],
  "placeholder-text": ["C10", "C05", "C17", "C01"],
  "wrong-portrait": ["C04", "C05", "C06", "C16", "C03"],
  "soft-lock-loop": ["stuck", "endless-loop", "C08", "C11"],
  "out-of-bounds-transfer": ["bad-transfer", "stuck", "C15", "C11", "page-error", "session-fatal"],
  "long-shop-name": ["text-clipped", "offscreen-ui", "C01", "C14", "C12"],
  "broken-npc-sprite": ["missing-texture", "page-error", "console-error", "C04", "C03"],
  "void-tiles": ["C08", "C11", "C04", "missing-texture"],
};

export function measurePlants(truth, reviewed, jobs) {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const touches = (c, plant) => {
    if (plant.eventId && c.target?.eventId === plant.eventId) return true;
    if (plant.eventId && /\bev[_-]/.test(c.where ?? "") && (c.where ?? "").includes(plant.eventId)) return true;
    const jobsOf = (c.jobs ?? []).map((id) => jobById.get(id)).filter(Boolean);
    if (plant.eventId) return jobsOf.some((j) => j.target?.eventId === plant.eventId);
    return jobsOf.some((j) => j.target?.mapId === plant.mapId) || (c.target?.mapId === plant.mapId && !c.target?.eventId);
  };
  const plantRows = truth.map((plant) => {
    const matches = reviewed.filter((c) => touches(c, plant) && (COMPATIBLE[plant.type] ?? []).includes(c.check));
    const kept = matches.filter((c) => c.review?.verdict === "real");
    return { ...plant, candidates: matches.map((c) => ({ id: c.id, source: c.source, check: c.check, verdict: c.review?.verdict ?? null })), caughtBefore: matches.length > 0, caughtAfter: kept.length > 0, bySource: [...new Set(kept.map((c) => c.source))] };
  });
  const plantCandidateIds = new Set(plantRows.flatMap((p) => p.candidates.map((c) => c.id)));
  const other = reviewed.filter((c) => !plantCandidateIds.has(c.id));
  return {
    plants: plantRows,
    planted: truth.length,
    caughtBefore: plantRows.filter((p) => p.caughtBefore).length,
    caughtAfter: plantRows.filter((p) => p.caughtAfter).length,
    nonPlantCandidates: other.length,
    nonPlantKept: other.filter((c) => c.review?.verdict === "real").length,
    nonPlantKeptIds: other.filter((c) => c.review?.verdict === "real").map((c) => c.id),
  };
}
