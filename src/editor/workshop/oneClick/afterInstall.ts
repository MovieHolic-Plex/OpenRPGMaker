// src/editor/workshop/oneClick/afterInstall.ts
/**
 * 「한 번에 만들기」 묶음을 넣은 뒤 — 지형은 지금 맵 칩셋에 합치고(workshopTerrain), 캐릭터는 놓을 칩(업로드 시트·칸)을 적어 둔다.
 * 작업 줄(workshopQueue.install)이 묶음을 넣자마자 부른다. 되돌리기 한 번으로 합친 것만 뺀다.
 */
import type { StorePackManifest } from "@/assetStore/format";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { mergeTerrainIntoTileset, type MergedTerrain } from "@/project/workshopTerrain";
import { store } from "@/project/store";
import type { LocalPackAddResult } from "../genPackImport";
import { withInstallOwnership } from "../installOwnership";
import type { JobInstalled, WorkshopJob } from "../queue/jobModel";

type PackExtra = Pick<Extract<JobInstalled, { kind: "pack" }>, "terrain" | "characters">;

export async function afterPackInstalled(job: WorkshopJob, manifest: StorePackManifest, added: LocalPackAddResult): Promise<PackExtra> {
  const keys = Object.keys(manifest.content.assets);
  if (job.remote?.kind === "char-gen") {
    const characters = (manifest.content.characters ?? []).flatMap((c) => {
      const at = keys.indexOf(c.asset);
      const textureKey = at >= 0 ? added.assetIds[at] : undefined;
      return textureKey ? [{ textureKey, characterIndex: c.characterIndex, name: (c.label && !/^c\d+$/u.test(c.label) ? c.label : job.title).slice(0, 24) }] : [];
    });
    return { characters };
  }
  const target = job.remote?.kind === "tile-gen" ? job.remote.targetTilesetId : undefined;
  const sourceId = added.tilesetIds[0];
  if (!target || !sourceId) return {};
  let merged: MergedTerrain | null = null;
  withInstallOwnership([target], `공방 지형 합치기: ${job.title}`, () => {
    recordProjectSnapshot("공방 지형 칩셋에 합치기");
    store.update((draft) => { merged = mergeTerrainIntoTileset(draft, target, sourceId); }, { scope: "assets", origin: "human", label: `공방 지형 합치기: ${job.title}` });
  });
  const done = merged as MergedTerrain | null;
  if (!done) return {};
  return { terrain: { tilesetId: target, brushTile: done.brushTile, groupIds: done.groupIds } };
}
