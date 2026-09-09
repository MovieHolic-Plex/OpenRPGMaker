/** Opt-in authoring identity. Parsing never generates IDs or selects an engine. */
export interface Publication {
  readonly gameId: string;
  readonly versionLabel: string;
  readonly runtimeTarget: string;
  readonly saveCompatibilityId: string;
  readonly acceptedSaveCompatibilityIds: readonly string[];
}

export class PublicationError extends Error {
  constructor(readonly code: "invalid-publication" | "runtime-unavailable" | "save-incompatible") {
    super(code);
    this.name = "PublicationError";
  }
}

export function isPublicationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export function parsePublication(value: unknown): Publication {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("gameId" in value) || !isPublicationId(value.gameId)
    || !("saveCompatibilityId" in value) || !isPublicationId(value.saveCompatibilityId)
    || !("runtimeTarget" in value) || typeof value.runtimeTarget !== "string" || !/^[a-f0-9]{64}$/.test(value.runtimeTarget)
    || !("versionLabel" in value) || typeof value.versionLabel !== "string" || !value.versionLabel.trim() || value.versionLabel.length > 80
    || !("acceptedSaveCompatibilityIds" in value) || !Array.isArray(value.acceptedSaveCompatibilityIds)
    || value.acceptedSaveCompatibilityIds.length > 64 || !value.acceptedSaveCompatibilityIds.every(isPublicationId)
    || new Set(value.acceptedSaveCompatibilityIds).size !== value.acceptedSaveCompatibilityIds.length
    || value.acceptedSaveCompatibilityIds.includes(value.saveCompatibilityId)) {
    throw new PublicationError("invalid-publication");
  }
  return {
    gameId: value.gameId, versionLabel: value.versionLabel, runtimeTarget: value.runtimeTarget,
    saveCompatibilityId: value.saveCompatibilityId,
    acceptedSaveCompatibilityIds: [...value.acceptedSaveCompatibilityIds],
  };
}

export function preparePublication(runtimeTarget: string): Publication {
  return parsePublication({ gameId: crypto.randomUUID(), versionLabel: "1.0", runtimeTarget,
    saveCompatibilityId: crypto.randomUUID(), acceptedSaveCompatibilityIds: [] });
}

export function forkPublication(publication: Publication): Publication {
  return preparePublication(publication.runtimeTarget);
}

export function upgradePublication(publication: Publication, runtimeTarget: string): Publication {
  return parsePublication({ ...publication, runtimeTarget,
    saveCompatibilityId: crypto.randomUUID(), acceptedSaveCompatibilityIds: [] });
}
