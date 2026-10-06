// src/editor/assetStore/storeApply.ts
/**
 * 받은 스토어 상품을 지금 프로젝트에 넣는다. 그림·소리는 프로젝트 저장소(데스크톱은 assets/)에 먼저 넣고,
 * 문서에는 내용 주소와 출처(origin)만 남긴다. 같은 상품의 새 판본은 같은 id 를 덮어써 맵 참조가 유지된다.
 */
import { applyPackToProject, packAssetTargets, type ApplyResult } from "@/assetStore/pack";
import { sniffMime, bytesToBase64 } from "@/assetStore/sniff";
import { uploadedAssetForImport } from "@/editor/uploadedAssetStorage";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { projectRepository } from "@/project/persistence/repository";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import { store } from "@/project/store";
import type { Project, ResourceKind, UploadedAsset } from "@/project/types";
import { storeBridge } from "./storeBridge";

const PROFILE_KINDS: ReadonlySet<string> = new Set(["chipset", "charset", "faceset", "battle", "battleCharset", "battleWeapon", "backdrop", "monster", "picture", "title", "gameOver", "system", "system2", "music", "sound"]);

function addProfiles(project: Project, assetIds: readonly string[]): void {
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

export interface AddResult extends ApplyResult { readonly title: string; readonly version: number }

export async function addStoreItemToProject(slug: string): Promise<AddResult> {
  const bridge = storeBridge();
  if (!bridge) throw new Error("스토어는 데스크톱 앱에서만 쓸 수 있습니다.");
  const pkg = await bridge.package({ slug });
  const blob = (sha: string): Uint8Array => {
    const bytes = pkg.blobs[sha];
    if (!bytes) throw new Error(`받은 팩에 파일이 빠졌습니다(${sha.slice(0, 12)}). 다시 받아 주세요.`);
    return bytes;
  };
  const context = { slug, version: pkg.version, author: pkg.author, storeUrl: pkg.storeUrl, itemUrl: pkg.itemUrl, blob };
  // 빈 문서로 먼저 넣어 본다 — 깨진 팩이면 여기서 멈추고 실제 프로젝트·저장소는 건드리지 않는다.
  applyPackToProject({ tilesets: {}, assets: { uploaded: {} } } as unknown as Project, pkg.manifest, context);
  const repository = projectRepository();
  const storedRefs = new Map<string, NonNullable<UploadedAsset["ref"]>>();
  if (repository.supportsAssetRefs) {
    for (const { id, asset } of packAssetTargets(pkg.manifest, slug)) {
      const bytes = blob(asset.blob);
      const mime = sniffMime(bytes) ?? asset.mime;
      const stored = await uploadedAssetForImport({ repository, id, name: asset.name, kind: asset.kind, dataUrl: `data:${mime};base64,${bytesToBase64(bytes)}`, meta: asset.meta, mime });
      if (stored.ref) storedRefs.set(id, stored.ref);
    }
  }
  let result: ApplyResult | null = null;
  recordProjectSnapshot("스토어 에셋 넣기");
  store.update((project) => {
    result = applyPackToProject(project, pkg.manifest, { ...context, storedRefs });
    addProfiles(project, result.assetIds);
  }, { scope: "assets", origin: "human", label: `스토어 에셋 넣기: ${pkg.manifest.title}` });
  if (!result) throw new Error("프로젝트에 넣지 못했습니다.");
  return { ...(result as ApplyResult), title: pkg.manifest.title, version: pkg.version };
}
