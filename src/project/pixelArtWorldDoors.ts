import catalog from '@/assets/pixelArtWorldDoors.json';
import type { Command, EventPageGraphic, TilesetDef } from './types';
export type PixelArtWorldDoorPack = (typeof catalog)[number];
export type PixelArtWorldDoorVariant = PixelArtWorldDoorPack['variants'][number];
export const PIXEL_ART_WORLD_DOORS: readonly PixelArtWorldDoorPack[] = catalog;
export function canAttachPixelArtWorldDoorReferences(target: TilesetDef, pack: PixelArtWorldDoorPack): boolean {
  return target.tileSize === 32 && !target.id.startsWith('shared_') && !target.referenceSourceTilesetId
    && (target.referenceDocuments?.length ?? 0) < 32 && !target.referenceDocuments?.some(c => c.id === pack.id);
}
/** One-shot graphic commands only. Passage, page switches and transfer are authored separately. */
export function pixelArtWorldDoorCommands(variant: PixelArtWorldDoorVariant, eventId = '', closing = false): Command[] {
  return (closing ? variant.closingFrames : variant.openingFrames).flatMap(pattern => [
    { kind: 'setEventGraphicPattern' as const, eventId, pattern }, { kind: 'wait' as const, ms: variant.frameTimingMs },
  ]);
}
export function pixelArtWorldDoorGraphic(assetId: string, variant: PixelArtWorldDoorVariant): EventPageGraphic {
  return { sprite: { type: 'uploaded', id: assetId }, pattern: variant.openingFrames[0], scale: 1, scaleMode: 'manual' };
}
