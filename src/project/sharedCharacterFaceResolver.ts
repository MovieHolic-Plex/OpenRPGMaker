import { findCharsetAsset } from "@/assets/charsetCatalog";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { CharacterFace, CharacterGraphicsDocument } from "./characterGraphics";
import type { EventPageGraphic, FaceGraphic } from "./types";
import { defaultSharedCharacterGraphics, parseSharedCharacterGraphicsDocument, SHARED_CHARACTER_GRAPHICS_ENDPOINT } from "./sharedCharacterGraphicsSchema";

// Synchronous tool compilation consumes the last accepted host catalog. Headless callers
// start with the same reviewed catalog the host serves on a fresh installation.
let catalog = defaultSharedCharacterGraphics();

/** The accepted host catalog is also the source used by assistant search. */
export function sharedCharacterGraphicsCatalog(): Readonly<CharacterGraphicsDocument> {
  return catalog;
}

export function acceptSharedCharacterGraphics(value: unknown): void {
  catalog = parseSharedCharacterGraphicsDocument(value);
}

export async function refreshSharedCharacterGraphics(signal?: AbortSignal): Promise<void> {
  const response = await fetch(SHARED_CHARACTER_GRAPHICS_ENDPOINT, {
    cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("공용 캐릭터·얼굴 매핑을 불러오지 못했습니다. 다시 시도해 주세요.");
  }
  const result = await response.json();
  if (signal?.aborted) throw signal.reason;
  acceptSharedCharacterGraphics(result.document);
}

/** No index/age guessing: pending, no-face and absent rows deliberately have no portrait. */
export function sharedFaceForCharset(textureKey: string, characterIndex = 0): FaceGraphic | null {
  const canonical = findCharsetAsset(textureKey)?.textureKey ?? textureKey;
  const row = catalog.mappings.find(row => row.textureKey === canonical && row.characterIndex === characterIndex);
  return row?.status === "mapped" && row.faceResourceId
    ? { resourceId: row.faceResourceId, position: "left", flipHorizontally: false } : null;
}
export function sharedFaceIdForCharset(id: string, index = 0): string | undefined {
  return sharedFaceForCharset(id, index)?.resourceId;
}

/** Read-only shared row for the appearance slots. Returns the catalog row even when it is not mapped. */
export function sharedCharsetRow(textureKeyOrId: string, characterIndex = 0): CharacterGraphicsDocument["mappings"][number] | null {
  const canonical = findCharsetAsset(textureKeyOrId)?.textureKey ?? textureKeyOrId;
  return catalog.mappings.find((entry) => entry.textureKey === canonical && entry.characterIndex === characterIndex) ?? null;
}

/** Read-only shared face row for the appearance slots. Uploaded/AI faces are absent. */
export function sharedFaceRow(resourceId: string): CharacterFace | null {
  return catalog.faces.find((entry) => entry.resourceId === resourceId) ?? null;
}

/** Editor authoring and search must consult the same accepted host mapping. */
export function reconcileSharedFaceWithCharset(faceResourceId: string, idOrTextureKey: string, characterIndex = 0): {
  readonly faceResourceId: string | null; readonly warning?: string;
} {
  const row = sharedCharsetRow(idOrTextureKey, characterIndex);
  if (!row || !sharedFaceRow(faceResourceId)) return { faceResourceId };
  if (row.status === "mapped" && row.faceResourceId === faceResourceId) return { faceResourceId };
  const target = row.status === "mapped" ? row.faceResourceId : null;
  return {
    faceResourceId: target,
    warning: target
      ? `얼굴 ${faceResourceId} 는 걷기 그림 ${row.textureKey}#${characterIndex} 와 다른 인물이라 짝 얼굴 ${target} 로 바꿨습니다. 얼굴을 생략하면 짝이 자동으로 붙습니다.`
      : `걷기 그림 ${row.textureKey}#${characterIndex} 에는 맞는 얼굴이 없어 얼굴 ${faceResourceId} 를 붙이지 않았습니다. 얼굴이 꼭 필요하면 generate_character_appearance 로 이 인물의 얼굴을 만드세요.`,
  };
}

export function sharedFaceFromEventGraphic(graphic: EventPageGraphic): FaceGraphic | null {
  if (!graphic || graphic.transparent || graphic.sprite?.type !== "bundled") return null;
  try {
    return sharedFaceForCharset(graphic.sprite.id, decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex);
  } catch { return null; }
}
