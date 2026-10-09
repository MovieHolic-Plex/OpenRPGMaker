export const SPATIAL_PRESENTATION_KINDS = [
  "tileset-kit",
  "tileset-room",
  "tileset-bundle",
  "library-object",
  "library-space",
  "library-place",
  "library-region",
  "library-world",
  "house-template",
  "house-preset",
] as const;

export type SpatialPresentationKind = (typeof SPATIAL_PRESENTATION_KINDS)[number];

export function spatialPresentationId(
  kind: SpatialPresentationKind,
  source: string,
  localId: string,
): string {
  return `${kind}/${encodeURIComponent(source)}/${encodeURIComponent(localId)}`;
}

export function spatialCardDomSelector(id: string): string {
  return `[data-card-id=${JSON.stringify(id)}]`;
}
