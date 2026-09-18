import { findCharsetAsset } from "@/assets/charsetCatalog";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { EventPageGraphic, FaceGraphic } from "./types";
import { defaultSharedCharacterGraphics, parseSharedCharacterGraphicsDocument, SHARED_CHARACTER_GRAPHICS_ENDPOINT } from "./sharedCharacterGraphicsSchema";

// Synchronous tool compilation consumes the last accepted host catalog. Headless callers
// start with the same reviewed catalog the host serves on a fresh installation.
let catalog = defaultSharedCharacterGraphics();

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

export function sharedFaceFromEventGraphic(graphic: EventPageGraphic): FaceGraphic | null {
  if (!graphic || graphic.transparent || graphic.sprite?.type !== "bundled") return null;
  try {
    return sharedFaceForCharset(graphic.sprite.id, decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex);
  } catch { return null; }
}
