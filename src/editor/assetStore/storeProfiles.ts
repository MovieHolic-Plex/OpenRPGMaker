// src/editor/assetStore/storeProfiles.ts
/** 스토어에서 넣은 그림·소리를 자료집 리소스 목록(resourceProfiles)에 올린다. 순수 함수 — 조수 도구 run 에서도 쓴다. */
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { Project, ResourceKind } from "@/project/types";

const PROFILE_KINDS: ReadonlySet<string> = new Set(["chipset", "charset", "faceset", "battle", "battleCharset", "battleWeapon", "backdrop", "monster", "picture", "title", "gameOver", "system", "system2", "music", "sound"]);

export function addStoreProfiles(project: Project, assetIds: readonly string[]): void {
  const known = new Set(project.resourceProfiles.map((profile) => profile.assetId).filter(Boolean));
  for (const id of assetIds) {
    const asset = project.assets.uploaded[id];
    if (!asset || known.has(id) || !PROFILE_KINDS.has(asset.kind)) continue;
    const kind = asset.kind as ResourceKind;
    if (kind === "music" || kind === "sound") {
      project.resourceProfiles.push({ kind, name: asset.name, assetId: id });
      continue;
    }
    const spec = getResourceProfileSpec(kind);
    const tile = asset.meta.tileSize;
    project.resourceProfiles.push({
      kind,
      name: asset.name,
      assetId: id,
      tileWidth: kind === "chipset" && tile ? tile : spec.tileWidth,
      tileHeight: kind === "chipset" && tile ? tile : spec.tileHeight,
      ...(asset.meta.width ? { imageWidth: asset.meta.width } : {}),
      ...(asset.meta.height ? { imageHeight: asset.meta.height } : {}),
    });
  }
}
