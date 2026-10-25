// src/editor/assetStore/storeApply.ts
/**
 * 받은 스토어 상품을 지금 프로젝트에 넣는다. 그림·소리는 프로젝트 저장소(데스크톱은 assets/)에 먼저 넣고,
 * 문서에는 내용 주소와 출처(origin)만 남긴다. 같은 상품의 새 판본은 같은 id 를 덮어써 맵 참조가 유지된다.
 */
import type { StorePackManifest } from "@/assetStore/format";
import { subsetMusicManifest } from "@/assetStore/storeMusicPick";
import { applyPackToProject, packAssetTargets, type ApplyContext, type ApplyResult } from "@/assetStore/pack";
import { MIME_EXTENSIONS, sniffMime } from "@/assetStore/sniff";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { projectRepository } from "@/project/persistence/repository";
import { store } from "@/project/store";
import { canWriteTeamProject } from "@/project/teamAccess";
import type { Project, UploadedAsset } from "@/project/types";
import { storeBridge } from "./storeBridge";
import { addStoreProfiles } from "./storeProfiles";
import { captureStoreAdd, staleStoreAssetIds, storeAddKeys, undoStoreAdd, type StoreAddSnapshot } from "./storeUndo";

export interface AddResult extends ApplyResult {
  readonly title: string;
  readonly version: number;
  /** 「되돌리기」가 되살릴 넣기 직전 모습. */
  readonly snapshot: StoreAddSnapshot;
  /** 이번 판본에는 없고 옛 판본에서만 들어온 에셋 — 쓰는 곳이 없으면 정리할 수 있다. */
  readonly staleAssetIds: readonly string[];
}

/** 받은 판본과 프로젝트 저장소에 미리 넣어 둔 그림. 문서에 넣기(applyPreparedStoreItem)는 동기라 도구 run 안에서도 쓴다. */
export interface PreparedStoreItem {
  readonly manifest: StorePackManifest;
  readonly version: number;
  readonly context: ApplyContext;
}

/** 받기 → 깨진 팩인지 빈 문서로 먼저 넣어 보기 → 그림·소리를 프로젝트 저장소에 넣기. 문서는 아직 건드리지 않는다. */
export async function prepareStoreItem(slug: string, options: { readonly assetIds?: readonly string[] } = {}): Promise<PreparedStoreItem> {
  const bridge = storeBridge();
  if (!bridge) throw new Error("스토어는 데스크톱 앱에서만 쓸 수 있습니다.");
  // 아직 받지 않은 상품이면 받는다(스토어 창은 미리 받고 들어오고, 조수 도구는 여기서 받는다).
  if (!(await bridge.installed()).some((item) => item.slug === slug)) await bridge.install({ slug });
  const pkg = await bridge.package({ slug });
  // 음악 팩에서 곡만 고르면 그 곡만 넣는다(조수 음악 카드·store_install assetIds).
  const manifest = options.assetIds?.length ? subsetMusicManifest(pkg.manifest, options.assetIds) : pkg.manifest;
  return prepareManifestItem(manifest, {
    slug,
    version: pkg.version,
    author: pkg.author,
    storeUrl: pkg.storeUrl,
    itemUrl: pkg.itemUrl,
    blob: (sha: string): Uint8Array => {
      const bytes = pkg.blobs[sha];
      if (!bytes) throw new Error(`받은 팩에 파일이 빠졌습니다(${sha.slice(0, 12)}). 다시 받아 주세요.`);
      return bytes;
    },
  });
}

/**
 * 이미 손에 든 팩(매니페스트 + blob)을 넣을 준비를 한다. 스토어 상품과 공방이 가져온 생성기 묶음(genPackImport.ts)이 같이 쓴다.
 * 빈 문서(번들 타일셋 참조만 공유)로 먼저 넣어 본다 — 깨진 팩이면 실제 프로젝트도, 프로젝트 저장소(assets/)도 건드리지 않는다.
 */
export async function prepareManifestItem(
  manifest: StorePackManifest,
  meta: Pick<ApplyContext, "slug" | "version" | "author" | "storeUrl" | "itemUrl" | "blob">,
): Promise<PreparedStoreItem> {
  const { slug, blob } = meta;
  const repository = projectRepository();
  const storedRefs = new Map<string, NonNullable<UploadedAsset["ref"]>>();
  const restoredDataUrls = new Map<string, string>();
  const context: ApplyContext = { ...meta, storedRefs, restoredDataUrls };
  // 복원한 dataUrl 은 캐시해 재사용한다.
  const currentTilesets = store.getCurrent().tilesets;
  const probeTilesets: Record<string, Project["tilesets"][string]> = {};
  for (const id of Object.keys(manifest.content.tilesets)) {
    const existing = Object.hasOwn(currentTilesets, id) ? currentTilesets[id] : undefined;
    if (existing) probeTilesets[id] = existing;
  }
  // 미리 돌려 보기용 빈 문서 — applyPackToProject 가 건드리는 칸(캐릭터 칸 설명·캐릭터 외형 포함)을 다 둔다.
  // database 를 빼면 짝 초상이 든 캐릭터 팩(char-gen 묶음 등)이 「characterAppearances」 읽기에서 죽는다(2026-10-21 실측).
  applyPackToProject({
    tilesets: probeTilesets, assets: { uploaded: {} }, charsetLabels: [], database: { characterAppearances: [] },
  } as unknown as Project, manifest, context);
  if (repository.supportsAssetRefs) {
    for (const { id, asset } of packAssetTargets(manifest, slug)) {
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
  return { manifest, version: meta.version, context };
}
/** 준비한 판본을 문서에 넣는다(동기). 패널은 store.update 안에서, 조수 도구는 draft 에서 부른다. */
export function applyPreparedStoreItem(project: Project, prepared: PreparedStoreItem): ApplyResult {
  const result = applyPackToProject(project, prepared.manifest, prepared.context);
  addStoreProfiles(project, result.assetIds);
  return result;
}

export async function addStoreItemToProject(slug: string, options: { readonly assetIds?: readonly string[] } = {}): Promise<AddResult> {
  // 보기 전용 팀 세션에서는 store.update 가 조용히 무시된다 — 빈 되돌리기 기록을 남기기 전에 막는다.
  if (!canWriteTeamProject()) throw new Error("읽기 전용 프로젝트라 넣을 수 없습니다.");
  const prepared = await prepareStoreItem(slug, options);
  const out: { result?: ApplyResult; snapshot?: StoreAddSnapshot } = {};
  recordProjectSnapshot("스토어 에셋 넣기");
  store.update((project) => {
    out.snapshot = captureStoreAdd(project, storeAddKeys(prepared.manifest, slug));
    out.result = applyPreparedStoreItem(project, prepared);
  }, { scope: "assets", origin: "human", label: `스토어 에셋 넣기: ${prepared.manifest.title}` });
  const { result, snapshot } = out;
  if (!result || !snapshot) throw new Error("프로젝트에 넣지 못했습니다.");
  return {
    ...result,
    title: prepared.manifest.title,
    version: prepared.version,
    snapshot,
    staleAssetIds: staleStoreAssetIds(store.getCurrent(), slug, result.assetIds),
  };
}

/** 스토어 창의 「되돌리기」 — 넣기 직전 모습으로. 맵이 이미 쓰고 있으면 바꾸지 않고 쓰는 곳을 돌려준다. */
export function undoStoreItemAdd(title: string, snapshot: StoreAddSnapshot): { ok: true } | { ok: false; usedBy: string[] } {
  const check = undoStoreAdd(structuredClone(store.getCurrent()), snapshot);
  if (!check.ok) return check;
  recordProjectSnapshot("스토어 에셋 되돌리기");
  store.update((project) => { undoStoreAdd(project, snapshot); }, { scope: "assets", origin: "human", label: `스토어 에셋 되돌리기: ${title}` });
  return { ok: true };
}

/** 「이 프로젝트」 탭의 빼기·옛 판본 정리. 같은 판정을 복제본에 먼저 돌려 쓰는 곳이 있으면 문서를 건드리지 않는다. */
export function editStoreItemInProject(label: string, edit: (project: Project) => { ok: true; removed: number } | { ok: false; usedBy: string[] }): { ok: true; removed: number } | { ok: false; usedBy: string[] } {
  const check = edit(structuredClone(store.getCurrent()));
  if (!check.ok) return check;
  recordProjectSnapshot(label);
  store.update((project) => { edit(project); }, { scope: "assets", origin: "human", label });
  return check;
}
