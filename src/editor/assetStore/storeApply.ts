// src/editor/assetStore/storeApply.ts
/**
 * 받은 스토어 상품을 지금 프로젝트에 넣는다. 그림·소리는 프로젝트 저장소(데스크톱은 assets/)에 먼저 넣고,
 * 문서에는 내용 주소와 출처(origin)만 남긴다. 같은 상품의 새 판본은 같은 id 를 덮어써 맵 참조가 유지된다.
 */
import type { StorePackManifest } from "@/assetStore/format";
import { applyPackToProject, packAssetTargets, type ApplyContext, type ApplyResult } from "@/assetStore/pack";
import { MIME_EXTENSIONS, sniffMime } from "@/assetStore/sniff";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { projectRepository } from "@/project/persistence/repository";
import { store } from "@/project/store";
import type { Project, UploadedAsset } from "@/project/types";
import { storeBridge } from "./storeBridge";
import { addStoreProfiles } from "./storeProfiles";

export interface AddResult extends ApplyResult { readonly title: string; readonly version: number }

/** 받은 판본과 프로젝트 저장소에 미리 넣어 둔 그림. 문서에 넣기(applyPreparedStoreItem)는 동기라 도구 run 안에서도 쓴다. */
export interface PreparedStoreItem {
  readonly manifest: StorePackManifest;
  readonly version: number;
  readonly context: ApplyContext;
}

/** 받기 → 깨진 팩인지 빈 문서로 먼저 넣어 보기 → 그림·소리를 프로젝트 저장소에 넣기. 문서는 아직 건드리지 않는다. */
export async function prepareStoreItem(slug: string): Promise<PreparedStoreItem> {
  const bridge = storeBridge();
  if (!bridge) throw new Error("스토어는 데스크톱 앱에서만 쓸 수 있습니다.");
  // 아직 받지 않은 상품이면 받는다(스토어 창은 미리 받고 들어오고, 조수 도구는 여기서 받는다).
  if (!(await bridge.installed()).some((item) => item.slug === slug)) await bridge.install({ slug });
  const pkg = await bridge.package({ slug });
  const blob = (sha: string): Uint8Array => {
    const bytes = pkg.blobs[sha];
    if (!bytes) throw new Error(`받은 팩에 파일이 빠졌습니다(${sha.slice(0, 12)}). 다시 받아 주세요.`);
    return bytes;
  };
  const repository = projectRepository();
  const storedRefs = new Map<string, NonNullable<UploadedAsset["ref"]>>();
  if (repository.supportsAssetRefs) {
    for (const { id, asset } of packAssetTargets(pkg.manifest, slug)) {
      const bytes = blob(asset.blob);
      const mime = sniffMime(bytes);
      if (!mime || mime !== asset.mime) throw new Error(`${asset.name}: 받은 파일 형식이 팩 설명과 다릅니다.`);
      const stored = await repository.assets.put(bytes, {
        mime,
        extension: MIME_EXTENSIONS[mime] ?? "bin",
        originalName: asset.name,
        kind: asset.kind,
      });
      if (stored.ref) storedRefs.set(id, stored.ref);
    }
  }
  const restoredDataUrls = new Map<string, string>();
  const context: ApplyContext = {
    slug,
    version: pkg.version,
    author: pkg.author,
    storeUrl: pkg.storeUrl,
    itemUrl: pkg.itemUrl,
    blob,
    storedRefs,
    restoredDataUrls,
  };
  // 빈 문서(번들 타일셋 참조만 공유)로 먼저 넣어 본다 — 깨진 팩이면 실제 프로젝트는 건드리지 않고, 복원한 dataUrl 은 캐시해 재사용한다.
  const currentTilesets = store.getCurrent().tilesets;
  const probeTilesets: Record<string, Project["tilesets"][string]> = {};
  for (const id of Object.keys(pkg.manifest.content.tilesets)) {
    const existing = Object.hasOwn(currentTilesets, id) ? currentTilesets[id] : undefined;
    if (existing) probeTilesets[id] = existing;
  }
  applyPackToProject({ tilesets: probeTilesets, assets: { uploaded: {} } } as unknown as Project, pkg.manifest, context);
  return { manifest: pkg.manifest, version: pkg.version, context };
}
/** 준비한 판본을 문서에 넣는다(동기). 패널은 store.update 안에서, 조수 도구는 draft 에서 부른다. */
export function applyPreparedStoreItem(project: Project, prepared: PreparedStoreItem): ApplyResult {
  const result = applyPackToProject(project, prepared.manifest, prepared.context);
  addStoreProfiles(project, result.assetIds);
  return result;
}

export async function addStoreItemToProject(slug: string): Promise<AddResult> {
  const prepared = await prepareStoreItem(slug);
  let result: ApplyResult | null = null;
  recordProjectSnapshot("스토어 에셋 넣기");
  store.update((project) => {
    result = applyPreparedStoreItem(project, prepared);
  }, { scope: "assets", origin: "human", label: `스토어 에셋 넣기: ${prepared.manifest.title}` });
  if (!result) throw new Error("프로젝트에 넣지 못했습니다.");
  return { ...(result as ApplyResult), title: prepared.manifest.title, version: prepared.version };
}
