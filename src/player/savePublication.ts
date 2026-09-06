import { isPublicationId, PublicationError, type Publication } from "../project/publication";

export interface SaveIdentity {
  readonly gameId: string;
  readonly saveCompatibilityId: string;
}
let activePublication: Publication | undefined;

export function setSavePublication(publication: Publication | undefined): void {
  activePublication = publication;
}

export function publicationSaveKey(slot: number | "auto", identity = activePublication): string | undefined {
  return identity && `oprn:game:${identity.gameId}:lineage:${identity.saveCompatibilityId}:save-slot:v6:${slot}`;
}

export function isSaveIdentity(value: unknown): value is SaveIdentity {
  return typeof value === "object" && value !== null
    && "gameId" in value && isPublicationId(value.gameId)
    && "saveCompatibilityId" in value && isPublicationId(value.saveCompatibilityId);
}

export function saveIdentity(publication: Publication): SaveIdentity {
  return { gameId: publication.gameId, saveCompatibilityId: publication.saveCompatibilityId };
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
  if (saveIdentityBlocker(publication, identity)) throw new PublicationError("save-incompatible");
}
