import { ToolError } from "@/editor/tools/types";

import {
  rejectUnknownKeys,
  requiredArray,
  requiredBoolean,
  requiredInteger,
  requiredString,
  requireRecord,
  type BoundaryRecord,
} from "./boundary";
import type {
  ActivityPersistence,
  CanonicalConstructionRoute,
  ConstructionCounts,
  ConstructionDiffTotals,
  ConstructionOutcome,
  ConstructionRouteChange,
  ConstructionTarget,
  ConstructionWriteEntrypoint,
  ProjectPersistence,
} from "./contracts";
import { canonicalRouteFor, constructionRouteEntry } from "./routeManifest";

const OUTCOME_KEYS = [
  "executionOk",
  "applied",
  "outcome",
  "requestedEntrypoint",
  "canonicalRoute",
  "selectedImplementation",
  "routeChanges",
  "activityPersistence",
  "projectPersistence",
  "target",
  "counts",
  "diff",
  "warnings",
] as const;

type OutcomeState =
  | { readonly executionOk: true; readonly applied: true; readonly outcome: "applied" | "partial" }
  | { readonly executionOk: false; readonly applied: false; readonly outcome: "blocked" | "failed" | "pending-approval" };

export function parseConstructionOutcome(value: unknown): ConstructionOutcome {
  const outcome = requireRecord(value, "constructionOutcome");
  rejectUnknownKeys(outcome, OUTCOME_KEYS, "constructionOutcome");
  const state = parseOutcomeState(outcome);
  const requestedRoute = constructionRouteEntry(requiredString(outcome, "requestedEntrypoint", "constructionOutcome"));
  if (requestedRoute === undefined) {
    throw new ToolError("constructionOutcome.requestedEntrypoint is not declared.", { code: "undeclared-route-change" });
  }
  const requestedEntrypoint = requestedRoute.name;
  const canonicalRoute = parseCanonicalRoute(outcome["canonicalRoute"]);
  const routeChanges = parseRouteChanges(requiredArray(outcome, "routeChanges", "constructionOutcome"));
  validateRoute(requestedEntrypoint, canonicalRoute, routeChanges);
  return {
    ...state,
    requestedEntrypoint,
    canonicalRoute,
    selectedImplementation: requiredString(outcome, "selectedImplementation", "constructionOutcome"),
    routeChanges,
    activityPersistence: parseActivityPersistence(outcome["activityPersistence"]),
    projectPersistence: parseProjectPersistence(outcome["projectPersistence"]),
    target: parseTarget(outcome["target"]),
    counts: parseCounts(outcome["counts"], !state.executionOk),
    diff: parseDiff(outcome["diff"]),
    warnings: parseWarnings(outcome["warnings"]),
  };
}

function parseOutcomeState(record: BoundaryRecord): OutcomeState {
  const executionOk = requiredBoolean(record, "executionOk", "constructionOutcome");
  const applied = requiredBoolean(record, "applied", "constructionOutcome");
  const outcome = requiredString(record, "outcome", "constructionOutcome");
  switch (outcome) {
    case "applied":
    case "partial":
      if (!executionOk || !applied) break;
      return { executionOk: true, applied: true, outcome };
    case "blocked":
    case "failed":
    case "pending-approval":
      if (executionOk || applied) break;
      return { executionOk: false, applied: false, outcome };
    default:
      break;
  }
  throw new ToolError("constructionOutcome state fields are inconsistent.", { code: "invalid-outcome" });
}

function parseCanonicalRoute(value: unknown): CanonicalConstructionRoute {
  if (value === "author_house" || value === "author_village") return value;
  throw new ToolError("constructionOutcome.canonicalRoute is invalid.", { code: "invalid-outcome" });
}

function parseRouteChanges(values: readonly unknown[]): readonly ConstructionRouteChange[] {
  return values.map((value, index) => {
    const scope = `constructionOutcome.routeChanges[${index}]`;
    const change = requireRecord(value, scope);
    rejectUnknownKeys(change, ["kind", "from", "to"], scope);
    if (change["kind"] !== "compatibility-alias") {
      throw new ToolError(`${scope}.kind must be compatibility-alias; fallbacks are forbidden.`, {
        code: "undeclared-route-change",
      });
    }
    const fromRoute = constructionRouteEntry(requiredString(change, "from", scope));
    if (fromRoute === undefined) {
      throw new ToolError(`${scope}.from is not declared.`, { code: "undeclared-route-change" });
    }
    return {
      kind: "compatibility-alias",
      from: fromRoute.name,
      to: parseCanonicalRoute(change["to"]),
    };
  });
}

function validateRoute(
  requestedEntrypoint: ConstructionWriteEntrypoint,
  canonicalRoute: CanonicalConstructionRoute,
  routeChanges: readonly ConstructionRouteChange[],
): void {
  const route = constructionRouteEntry(requestedEntrypoint);
  const expectedCanonical = canonicalRouteFor(requestedEntrypoint);
  if (route === undefined || expectedCanonical === undefined || expectedCanonical !== canonicalRoute) {
    throw new ToolError("constructionOutcome route is not declared in the migration manifest.", {
      code: "undeclared-route-change",
    });
  }
  if (route.supersededBy === null) {
    if (routeChanges.length === 0) return;
  } else if (
    routeChanges.length === 1
    && routeChanges[0]?.from === requestedEntrypoint
    && routeChanges[0]?.to === canonicalRoute
  ) {
    return;
  }
  throw new ToolError("constructionOutcome.routeChanges does not match the declared compatibility alias.", {
    code: "undeclared-route-change",
  });
}

function parseTarget(value: unknown): ConstructionTarget {
  const target = requireRecord(value, "constructionOutcome.target");
  rejectUnknownKeys(target, ["kind", "mapId"], "constructionOutcome.target");
  const kind = target["kind"];
  if (kind !== "existing" && kind !== "new") {
    throw new ToolError("constructionOutcome.target.kind is invalid.", { code: "invalid-outcome" });
  }
  return { kind, mapId: requiredString(target, "mapId", "constructionOutcome.target") };
}

function parseCounts(value: unknown, allowZeroRequested: boolean): ConstructionCounts {
  const counts = requireRecord(value, "constructionOutcome.counts");
  rejectUnknownKeys(counts, ["requested", "actual"], "constructionOutcome.counts");
  const requested = requiredInteger(counts, "requested", "constructionOutcome.counts");
  const actual = requiredInteger(counts, "actual", "constructionOutcome.counts");
  if (requested < (allowZeroRequested ? 0 : 1) || actual < 0) {
    throw new ToolError("constructionOutcome counts must be non-negative; successful outcomes require a positive requested count.", {
      code: "invalid-outcome",
    });
  }
  return { requested, actual };
}

function parseDiff(value: unknown): ConstructionDiffTotals {
  const diff = requireRecord(value, "constructionOutcome.diff");
  const integerKeys = [
    "tilesChanged", "eventsAdded", "eventsModified", "eventsRemoved", "mapsAdded", "mapsRemoved",
    "dbRecordsChanged", "tilesetsChanged", "switchesAdded", "variablesAdded", "worldEntitiesAdded",
    "worldEntitiesModified", "palettePresetsAdded", "palettePresetsModified", "endingsChanged", "mapPropertiesChanged",
    "audioDescriptionsChanged", "monsterMetadataChanged",
  ] as const;
  rejectUnknownKeys(diff, [...integerKeys, "sessionChanged", "systemChanged"], "constructionOutcome.diff");
  return {
    tilesChanged: nonNegativeInteger(diff, "tilesChanged", "constructionOutcome.diff"),
    eventsAdded: nonNegativeInteger(diff, "eventsAdded", "constructionOutcome.diff"),
    eventsModified: nonNegativeInteger(diff, "eventsModified", "constructionOutcome.diff"),
    eventsRemoved: nonNegativeInteger(diff, "eventsRemoved", "constructionOutcome.diff"),
    mapsAdded: nonNegativeInteger(diff, "mapsAdded", "constructionOutcome.diff"),
    mapsRemoved: nonNegativeInteger(diff, "mapsRemoved", "constructionOutcome.diff"),
    dbRecordsChanged: nonNegativeInteger(diff, "dbRecordsChanged", "constructionOutcome.diff"),
    tilesetsChanged: nonNegativeInteger(diff, "tilesetsChanged", "constructionOutcome.diff"),
    switchesAdded: nonNegativeInteger(diff, "switchesAdded", "constructionOutcome.diff"),
    variablesAdded: nonNegativeInteger(diff, "variablesAdded", "constructionOutcome.diff"),
    worldEntitiesAdded: nonNegativeInteger(diff, "worldEntitiesAdded", "constructionOutcome.diff"),
    worldEntitiesModified: nonNegativeInteger(diff, "worldEntitiesModified", "constructionOutcome.diff"),
    palettePresetsAdded: nonNegativeInteger(diff, "palettePresetsAdded", "constructionOutcome.diff"),
    palettePresetsModified: nonNegativeInteger(diff, "palettePresetsModified", "constructionOutcome.diff"),
    endingsChanged: nonNegativeInteger(diff, "endingsChanged", "constructionOutcome.diff"),
    mapPropertiesChanged: Object.prototype.hasOwnProperty.call(diff, "mapPropertiesChanged")
      ? nonNegativeInteger(diff, "mapPropertiesChanged", "constructionOutcome.diff")
      : 0,
    audioDescriptionsChanged: Object.hasOwn(diff, "audioDescriptionsChanged")
      ? nonNegativeInteger(diff, "audioDescriptionsChanged", "constructionOutcome.diff")
      : 0,
    monsterMetadataChanged: Object.hasOwn(diff, "monsterMetadataChanged")
      ? nonNegativeInteger(diff, "monsterMetadataChanged", "constructionOutcome.diff")
      : 0,
    sessionChanged: requiredBoolean(diff, "sessionChanged", "constructionOutcome.diff"),
    systemChanged: requiredBoolean(diff, "systemChanged", "constructionOutcome.diff"),
  };
}

function nonNegativeInteger(record: BoundaryRecord, key: string, scope: string): number {
  const value = requiredInteger(record, key, scope);
  if (value < 0) {
    throw new ToolError(`${scope}.${key} must be non-negative.`, { code: "invalid-outcome" });
  }
  return value;
}

function parseWarnings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ToolError("constructionOutcome.warnings must be an array.", { code: "invalid-outcome" });
  }
  return value.map((warning, index) => {
    if (typeof warning !== "string") {
      throw new ToolError(`constructionOutcome.warnings[${index}] must be a string.`, { code: "invalid-outcome" });
    }
    return warning;
  });
}

function parseActivityPersistence(value: unknown): ActivityPersistence {
  switch (value) {
    case "not-recorded":
    case "local":
    case "project-store":
    case "both":
    case "failed-remote":
      return value;
    default:
      throw new ToolError("constructionOutcome.activityPersistence is invalid.", { code: "invalid-outcome" });
  }
}

function parseProjectPersistence(value: unknown): ProjectPersistence {
  switch (value) {
    case "not-requested":
    case "pending":
    case "local":
    case "project-store":
    case "both":
    case "failed":
      return value;
    default:
      throw new ToolError("constructionOutcome.projectPersistence is invalid.", { code: "invalid-outcome" });
  }
}
