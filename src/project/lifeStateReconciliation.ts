import type { PlaySession } from "./session";
import type { Project } from "./types";
import { isLifeRecoveryJson, isLifeRecoveryState, moveLifeRecoverySource, type LifeRecoverySource } from "./lifeRecovery";
import { absoluteGameMinutes } from "./makers";
import { resolveTimeSystem } from "./gameTime";
import { resolveSellPrice } from "./upgrades";
import { parseFarmAnimalStateRecord, restoreFarmAnimalStates } from "./p1FoundationRecords";
import { restoreSpatialPlacementRecords } from "./spatialPlacementRestore";
import { parseFarmBuildingPlacementRecord, parseHomeDecorationPlacementRecord } from "@/player/saveSlotSpatialValidation";
import { isMakerInstancesRecord, isRecord } from "@/player/saveSlotValidation";

export class LifeReconciliationError extends Error {
  readonly name = "LifeReconciliationError";
  constructor(readonly sourceKind: string, readonly sourceId: string, readonly reason: string) {
    super(`Life recovery ${sourceKind}/${sourceId}: ${reason}`);
  }
}

type LifeSourceKind = LifeRecoverySource["sourceKind"];
type ParsedLifeState = Pick<PlaySession, "lifeRecovery" | "shippingQueue" | "bundleContributions" | "makerInstances" | "farmAnimals" | "farmBuildingPlacements" | "homeDecorationPlacements">;

/** Boundary quarantine: retain the complete unproven record, never infer a payable amount. */
export function preserveUnresolvedLifeSource(
  state: Pick<PlaySession, "lifeRecovery">,
  source: Pick<LifeRecoverySource, "sourceKind" | "sourceId" | "reason">,
  original: unknown,
): void {
  const recovery = state.lifeRecovery ?? { nextSequence: 1, claims: {} };
  if (!isLifeRecoveryState(recovery) || !isLifeRecoveryJson(original)) throw new LifeReconciliationError(source.sourceKind, source.sourceId, "invalid-state");
  const id = `recovery:${recovery.nextSequence}`;
  const next = {
    nextSequence: recovery.nextSequence + 1,
    claims: { ...recovery.claims, [id]: { id, ...source, items: [], unresolved: { record: structuredClone(original), detail: source.reason } } },
  };
  if (!isLifeRecoveryState(next)) throw new LifeReconciliationError(source.sourceKind, source.sourceId, "capacity");
  state.lifeRecovery = next;
}

/** Parse before any lossy codec. Unknown legacy shapes are owners of unresolved evidence. */
export function parseLifeState(raw: Partial<Record<LifeSourceKind | "lifeRecovery", unknown>>): ParsedLifeState {
  if (raw.lifeRecovery !== undefined && !isLifeRecoveryState(raw.lifeRecovery)) throw new LifeReconciliationError("lifeRecovery", "claims", "invalid-state");
  const result: ParsedLifeState = { lifeRecovery: structuredClone(raw.lifeRecovery) };
  const fields = ["shippingQueue", "bundleContributions", "makerInstances", "farmAnimals", "farmBuildingPlacements", "homeDecorationPlacements"] as const;
  for (const field of fields) {
    const values = raw[field];
    if (values === undefined) continue;
    if (!isRecord(values)) throw new LifeReconciliationError(field, field, "invalid-source");
    // Explicit empty collections must not resurrect authored starting assets.
    Object.assign(result, { [field]: {} });
    for (const [id, original] of Object.entries(values)) {
      if (!id.trim()) throw new LifeReconciliationError(field, id, "invalid-source");
      const reject = () => { throw new LifeReconciliationError(field, id, "invalid-count"); };
      let accepted = false;
      switch (field) {
        case "shippingQueue":
          if (typeof original === "number") {
            if (!Number.isSafeInteger(original) || original < 0) reject();
            if (original > 0) result.shippingQueue = { ...result.shippingQueue, [id]: original };
            accepted = true;
          }
          break;
        case "bundleContributions":
          if (isRecord(original) && Object.values(original).every((count) => typeof count === "number")) {
            const amounts: Record<string, number> = {};
            for (const [itemId, count] of Object.entries(original)) {
              if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) reject();
              else if (count > 0) amounts[itemId] = count;
            }
            result.bundleContributions = { ...result.bundleContributions, [id]: amounts };
            accepted = true;
          }
          break;
        case "makerInstances": {
          const candidate = { [id]: original };
          if (isMakerInstancesRecord(candidate)) {
            result.makerInstances = { ...result.makerInstances, ...structuredClone(candidate) };
            accepted = true;
          } else if (isRecord(original) && original.contract !== undefined) reject();
          break;
        }
        case "farmAnimals": {
          const parsed = parseFarmAnimalStateRecord({ [id]: original })?.[id];
          if (parsed && isRecord(original)) { result.farmAnimals = { ...result.farmAnimals, [id]: { ...structuredClone(original), ...parsed } }; accepted = true; }
          break;
        }
        case "farmBuildingPlacements": {
          const parsed = parseFarmBuildingPlacementRecord({ [id]: original })?.[id];
          if (parsed && isRecord(original)) { result.farmBuildingPlacements = { ...result.farmBuildingPlacements, [id]: { ...structuredClone(original), ...parsed } }; accepted = true; }
          break;
        }
        case "homeDecorationPlacements": {
          const parsed = parseHomeDecorationPlacementRecord({ [id]: original })?.[id];
          if (parsed && isRecord(original)) { result.homeDecorationPlacements = { ...result.homeDecorationPlacements, [id]: { ...structuredClone(original), ...parsed } }; accepted = true; }
          break;
        }
        default: { const exhaustive: never = field; return exhaustive; }
      }
      if (!accepted) preserveUnresolvedLifeSource(result, { sourceKind: field, sourceId: id, reason: "unrecognized-legacy-record" }, original);
    }
  }
  return result;
}

/** Pure reconciliation: only this returned draft owns conversions; input and inventory never change. */
export function reconcileLifeState(project: Project, input: PlaySession): PlaySession {
  const draft = { ...structuredClone(input), ...parseLifeState(input) };
  const move = (source: LifeRecoverySource) => {
    const result = moveLifeRecoverySource(project, draft, source);
    if (!result.ok) throw new LifeReconciliationError(source.sourceKind, source.sourceId, result.reason);
  };
  // Persistent plots/placeables/chests are already restored by the caller, before spatial checks.
  const spatial = restoreSpatialPlacementRecords(project, draft, draft);
  for (const sourceKind of ["farmBuildingPlacements", "homeDecorationPlacements"] as const) {
    for (const sourceId of Object.keys(draft[sourceKind] ?? {})) {
      if (!Object.hasOwn(spatial[sourceKind] ?? {}, sourceId)) move({ sourceKind, sourceId, reason: "incompatible-placement", unresolvedOnly: true });
    }
  }
  // Linked housing is derived here when introduced; no optional housing fields are invented now.
  const species = new Set((project.database.farmAnimalSpecies ?? []).map((entry) => entry.id));
  for (const [sourceId, animal] of Object.entries(draft.farmAnimals ?? {})) {
    if (!species.has(animal.speciesId)) move({ sourceKind: "farmAnimals", sourceId, reason: "removed-species", unresolvedOnly: true });
  }
  const animals = restoreFarmAnimalStates(project.session.farmAnimals, draft.farmAnimals, species, project.system.farmAnimalBuildings);
  for (const sourceId of Object.keys(draft.farmAnimals ?? {})) {
    if (!Object.hasOwn(animals ?? {}, sourceId)) move({ sourceKind: "farmAnimals", sourceId, reason: "animal-runtime-limit", unresolvedOnly: true });
  }
  draft.farmAnimals = animals;
  const known = new Set(project.database.items.map((item) => item.id));
  for (const sourceId of Object.keys(draft.shippingQueue ?? {})) {
    if (project.system.shipping?.enabled !== true || !known.has(sourceId) || resolveSellPrice(project, sourceId) === undefined
      || (project.system.shipping.allowedItemIds !== undefined && !project.system.shipping.allowedItemIds.includes(sourceId))) {
      move({ sourceKind: "shippingQueue", sourceId, reason: "ineligible-shipping" });
    }
  }
  const tombstones = [...new Set([...(draft.completedBundleIds ?? []), ...(draft.bundleRewardAppliedIds ?? [])])];
  draft.completedBundleIds = tombstones;
  draft.bundleRewardAppliedIds = [...tombstones];
  for (const [sourceId, amounts] of Object.entries(draft.bundleContributions ?? {})) {
    if (tombstones.includes(sourceId)) continue;
    const bundle = project.system.bundles?.find((entry) => entry.id === sourceId);
    const retained: Record<string, number> = {};
    const excess: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(amounts)) {
      const required = known.has(itemId) ? bundle?.requirements.find((entry) => entry.itemId === itemId)?.count ?? 0 : 0;
      if (!Number.isSafeInteger(required) || required < 0) throw new LifeReconciliationError("bundleContributions", sourceId, "invalid-requirement");
      const keep = Math.min(count, required);
      if (keep > 0) retained[itemId] = keep;
      if (count > keep) excess[itemId] = count - keep;
    }
    if (Object.keys(excess).length) {
      // This draft temporarily gives the existing source only its excess; conversion plus retained progress commit together.
      draft.bundleContributions = { ...draft.bundleContributions, [sourceId]: excess };
      move({ sourceKind: "bundleContributions", sourceId, reason: "excess-contribution" });
    }
    if (Object.keys(retained).length) draft.bundleContributions = { ...draft.bundleContributions, [sourceId]: retained };
  }
  const time = resolveTimeSystem(project);
  for (const [sourceId, job] of Object.entries(draft.makerInstances ?? {})) {
    const basis = job.contract?.timeBasis;
    const changedClock = basis && (!time || basis.dayStartHour !== time.dayStartHour || basis.dayEndHour !== time.dayEndHour || basis.daysPerSeason !== time.daysPerSeason);
    if (project.system.makers?.some((maker) => maker.id === job.makerId) && !changedClock) continue;
    if (job.status === "idle") { delete draft.makerInstances?.[sourceId]; continue; }
    let absoluteMinute: number | undefined;
    if (input.gameTime) {
      try { absoluteMinute = absoluteGameMinutes(input.gameTime, basis ? { enabled: true, ...basis } : project.system.timeSystem); }
      catch (error) {
        if (!(error instanceof RangeError)) throw error;
        throw new LifeReconciliationError("makerInstances", sourceId, "invalid-time");
      }
    }
    move({ sourceKind: "makerInstances", sourceId, reason: changedClock ? "changed-time-basis" : "removed-maker", absoluteMinute, unresolvedOnly: absoluteMinute === undefined });
  }
  return draft;
}
