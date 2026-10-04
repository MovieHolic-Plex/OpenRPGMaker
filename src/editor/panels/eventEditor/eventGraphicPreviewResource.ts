import { findCharsetAsset, projectCharsetAssets, type CharsetPickerAsset } from "@/assets/charsetCatalog";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { CC0_ICON_ASSETS, resolveCc0IconAssetUrl } from "@/assets/cc0IconAssets";
import { eventSpriteFrameForDirection, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { resolveEventAppearanceGraphic } from "@/project/characterAppearances";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import { uploadedSpriteFrame, uploadedSpriteGeometry } from "@/project/uploadedSpriteGeometry";
import type { EventPageGraphic, Project } from "@/project/types";

export type EventGraphicPreviewResource =
  | { readonly kind: "charset"; readonly asset: CharsetPickerAsset; readonly frameIndex: number }
  | {
    readonly kind: "sprite";
    readonly path: string;
    readonly frameIndex: number;
    readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    readonly sheet: { readonly width: number; readonly height: number };
    readonly fitSize?: number;
  };

/** Use the map's resource lookup; only charset sheets use RM2000 frame slicing. */
export function eventGraphicPreviewResource(project: Project, authored: EventPageGraphic): EventGraphicPreviewResource | null {
  const graphic = resolveEventAppearanceGraphic(project, authored);
  const id = graphic.sprite?.id;
  if (!id) return null;
  const texture = resolveEventSpriteTexture(project, id, graphic.pattern);
  if (!texture) return null;
  const def = project.assets.sprites[id];
  const imageId = def?.image.id ?? texture.texture;
  const charset = projectCharsetAssets(project).find(asset => asset.textureKey === imageId)
    ?? findCharsetAsset(imageId);
  if (charset) {
    const defaultFrame = charsetFrameIndex({ characterIndex: 0, direction: graphic.direction ?? "down", pattern: 1 });
    const frame = eventSpriteFrameForDirection({ ...texture, charset: true, frame: graphic.pattern ?? defaultFrame }, graphic.direction);
    return { kind: "charset", asset: charset, frameIndex: typeof frame === "number" ? frame : defaultFrame };
  }
  const uploaded = project.assets.uploaded[imageId];
  if (uploaded?.kind === "sprite") {
    const sheet = uploadedSpriteGeometry(uploaded);
    const frameIndex = graphic.pattern ?? 0;
    const frame = uploadedSpriteFrame(uploaded, frameIndex);
    const path = uploadedAssetUrl(uploaded);
    return sheet && frame && path ? { kind: "sprite", path, sheet, frame, frameIndex } : null;
  }
  const icon = !def && CC0_ICON_ASSETS.find(asset => asset.id === id);
  const path = icon && resolveCc0IconAssetUrl(id);
  if (icon && path) {
    const sheet = { width: icon.imageWidth, height: icon.imageHeight };
    return { kind: "sprite", path, sheet, frame: { x: 0, y: 0, ...sheet }, frameIndex: 0, fitSize: texture.fitSize };
  }
  return null;
}
