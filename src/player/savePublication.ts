import { isPublicationId, PublicationError, type Publication } from "../project/publication";

export interface SaveIdentity {
  readonly gameId: string;
  readonly saveCompatibilityId: string;
  /** Host/listing authority, never copied from authored publication metadata. */
  readonly isolationScope?: string;
}
let activePublication: Publication | undefined;
let activeIsolationScope: string | undefined;

export function setSavePublication(publication: Publication | undefined, isolationScope?: string): void {
  activePublication = publication;
  activeIsolationScope = publication ? isolationScope : undefined;
}

export function publicationSaveKey(slot: number | "auto", identity = activePublication): string | undefined {
  const prefix = activeIsolationScope === undefined ? "oprn" : `oprn:community:${encodeURIComponent(activeIsolationScope)}`;
  return identity && `${prefix}:game:${identity.gameId}:lineage:${identity.saveCompatibilityId}:save-slot:v6:${slot}`;
}

export function isSaveIdentity(value: unknown): value is SaveIdentity {
  return typeof value === "object" && value !== null
    && "gameId" in value && isPublicationId(value.gameId)
    && "saveCompatibilityId" in value && isPublicationId(value.saveCompatibilityId)
    && (!("isolationScope" in value) || (typeof value.isolationScope === "string" && value.isolationScope.length > 0));
}

export function saveIdentity(publication: Publication): SaveIdentity {
  return { gameId: publication.gameId, saveCompatibilityId: publication.saveCompatibilityId,
    ...(activeIsolationScope === undefined ? {} : { isolationScope: activeIsolationScope }) };
}

export function saveScopeBlocker(identity: SaveIdentity | undefined): string | null {
  return identity?.isolationScope === activeIsolationScope ? null : "다른 게시물의 저장입니다. 저장 파일을 직접 선택해 복사해 주세요";
}

/** Check before reading bytes. Accepted lineage metadata authorizes only local discovery. */
export function isLocalSaveSourceKey(key: string, publication: Publication, adoptLegacy: boolean): boolean {
  if (adoptLegacy && activeIsolationScope === undefined && !key.startsWith("oprn:community:")) return true;
  return [publication.saveCompatibilityId, ...publication.acceptedSaveCompatibilityIds].some(lineage =>
    [1, 2, 3, "auto" as const].some(slot => key === publicationSaveKey(slot, { ...publication, saveCompatibilityId: lineage })));
}

export function saveIdentityBlocker(publication: Publication | undefined, identity: SaveIdentity | undefined): string | null {
  if (!publication && !identity) return null;
  if (!publication || !identity || publication.gameId !== identity.gameId
    || (publication.saveCompatibilityId !== identity.saveCompatibilityId
      && !publication.acceptedSaveCompatibilityIds.includes(identity.saveCompatibilityId))) {
    return "이 게임에서 허용하지 않은 저장 데이터입니다";
  }
  return null;
}

export function requireSaveIdentity(publication: Publication | undefined, identity: SaveIdentity | undefined): void {
  if (saveIdentityBlocker(publication, identity) || saveScopeBlocker(identity)) throw new PublicationError("save-incompatible");
}
