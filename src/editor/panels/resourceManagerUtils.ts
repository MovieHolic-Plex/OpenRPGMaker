import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { ResourceKind, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";

export function resourceKindFromUpload(kind: UploadedAsset["kind"]): ResourceKind | null {
  if (kind === "tileset") return "chipset";
  if (kind === "sprite") return "charset";
  return kind;
}

export function uploadedResourceKindLabel(asset: UploadedAsset): string {
  const kind = resourceKindFromUpload(asset.kind);
  return kind ? getResourceProfileSpec(kind).label : asset.kind;
}

export function makeResourcePreviewGrid(width: number, height: number, tileSize: number): HTMLElement {
  const grid = el("div", { class: "rm-tile-grid" });
  const count = width > 0 && height > 0 ? Math.min(16, (width / tileSize) * (height / tileSize)) : 4;
  for (let index = 0; index < count; index++) {
    grid.append(el("div", { class: "rm-tile-cell", text: String(index), dataset: { testid: `resource-tile-${index}` } }));
  }
  return grid;
}
