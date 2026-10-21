// src/editor/workshop/genPackImport.ts
/**
 * 생성기(char-gen·object-gen)가 사용자 컴퓨터에서 만든 묶음 폴더(`oprn-store-pack/1`: manifest.json + blobs/<sha256>)를
 * 이 프로젝트에 넣는다. 스토어 넣기와 같은 길(applyPackToProject)을 쓰되 출처는 `local:<생성기>` 로 남긴다.
 * - blob 은 sha256 을 다시 재서 맞는 것만 쓴다(스토어는 메인 프로세스가 재지만 여기는 사용자가 고른 파일이다).
 * - 출처가 local: 인 에셋은 스토어 올리기에서 막힌다(storePublishBlockReason) — 공용에 올리는 길은 생성기 자신의
 *   검사(3/4 관문 포함)를 거친 submit 이다.
 */
import { STORE_PACK_SCHEMA, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { sniffMime } from "@/assetStore/sniff";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { applyPreparedStoreItem, prepareManifestItem } from "@/editor/assetStore/storeApply";
import { store } from "@/project/store";
import { canWriteTeamProject } from "@/project/teamAccess";
import type { GeneratorId } from "./generators";
import { withInstallOwnership } from "./installOwnership";

/** 출처 store 값 앞머리 — 스토어에서 받은 것과 구별한다. */
export const LOCAL_PACK_STORE_PREFIX = "local:";

export interface LocalPack {
  readonly manifest: StorePackManifest;
  readonly blobs: ReadonlyMap<string, Uint8Array>;
  /** 고른 폴더 이름(화면 표시용) */
  readonly folder: string;
}

export interface LocalPackPreview {
  readonly name: string;
  readonly kind: string;
  readonly url: string;
}

const hex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

function relativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

/** 고른 파일들(폴더 통째 또는 manifest.json + blob 파일들)에서 묶음을 읽는다. 문제가 있으면 사람이 읽는 말로 던진다. */
export async function readLocalPack(files: readonly File[]): Promise<LocalPack> {
  if (files.length === 0) throw new Error("고른 파일이 없어요.");
  // 가장 얕은 manifest.json 이 묶음의 머리다(묶음 폴더 안에 다른 폴더가 있어도 헷갈리지 않게).
  const manifests = files.filter((file) => file.name === "manifest.json").sort((a, b) => relativePath(a).split("/").length - relativePath(b).split("/").length);
  const head = manifests[0];
  if (!head) throw new Error("manifest.json 이 없어요. 생성기가 만든 묶음 폴더를 통째로 골라 주세요.");
  let raw: unknown;
  try {
    raw = JSON.parse(await head.text());
  } catch {
    throw new Error("manifest.json 을 읽지 못했어요.");
  }
  if ((raw as { schema?: unknown } | null)?.schema !== STORE_PACK_SCHEMA) throw new Error("OPRN 묶음이 아니에요(manifest.json 의 형식이 달라요).");
  const checked = validateManifest(raw);
  if (!checked.ok) throw new Error(`묶음이 올바르지 않아요: ${checked.errors.slice(0, 3).join(" / ")}`);
  const manifest = checked.value;
  const wanted = new Set(manifest.blobs.map((blob) => blob.sha256));
  // blob 파일 이름은 sha256(확장자가 붙어 있어도 된다). 이름이 아니라 내용 해시로 확인한다.
  const blobs = new Map<string, Uint8Array>();
  for (const file of files) {
    const stem = file.name.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
    if (!wanted.has(stem) || blobs.has(stem)) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
    if (digest !== stem) throw new Error(`${file.name}: 파일 내용이 이름(해시)과 달라요. 묶음을 다시 만들어 주세요.`);
    blobs.set(stem, bytes);
  }
  const missing = [...wanted].filter((sha) => !blobs.has(sha));
  if (missing.length) throw new Error(`묶음에 그림 파일 ${missing.length}개가 빠졌어요(blobs 폴더까지 함께 골라 주세요).`);
  const folder = relativePath(head).split("/").slice(-2, -1)[0] ?? manifest.title;
  return { manifest, blobs, folder };
}

/** 묶음 안 그림을 미리 보기 주소로. 다 쓰면 revokeLocalPackPreviews 로 놓아준다. */
export function localPackPreviews(pack: LocalPack): LocalPackPreview[] {
  const out: LocalPackPreview[] = [];
  for (const asset of Object.values(pack.manifest.content.assets)) {
    const bytes = pack.blobs.get(asset.blob);
    const mime = bytes ? sniffMime(bytes) : null;
    if (!bytes || !mime || !mime.startsWith("image/")) continue;
    // Uint8Array 를 그대로 Blob 에 넣는다(TS 의 ArrayBufferLike 좁힘 때문에 사본).
    out.push({ name: asset.name, kind: asset.kind, url: URL.createObjectURL(new Blob([bytes.slice()], { type: mime })) });
  }
  return out;
}

export function revokeLocalPackPreviews(previews: readonly LocalPackPreview[]): void {
  for (const preview of previews) URL.revokeObjectURL(preview.url);
}

/** 같은 묶음을 다시 넣으면 같은 id 를 덮어쓰도록 manifest 내용으로 slug 를 정한다. */
async function localSlug(generator: GeneratorId, manifest: StorePackManifest): Promise<string> {
  const digest = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(manifest.blobs.map((b) => b.sha256).sort()))));
  return `local-${generator}-${digest.slice(0, 12)}`;
}

export interface LocalPackAddResult {
  readonly title: string;
  readonly assetIds: readonly string[];
  readonly tilesetIds: readonly string[];
  readonly replaced: boolean;
}

/** 묶음을 이 프로젝트에 넣는다. 되돌리기 한 번으로 뺀다. */
export async function addLocalPackToProject(pack: LocalPack, generator: GeneratorId): Promise<LocalPackAddResult> {
  if (!canWriteTeamProject()) throw new Error("읽기 전용 프로젝트라 넣을 수 없어요.");
  const slug = await localSlug(generator, pack.manifest);
  const prepared = await prepareManifestItem(pack.manifest, {
    slug,
    version: 1,
    author: `${generator} (내 컴퓨터)`,
    storeUrl: `${LOCAL_PACK_STORE_PREFIX}${generator}`,
    itemUrl: "",
    blob: (sha) => {
      const bytes = pack.blobs.get(sha);
      if (!bytes) throw new Error(`묶음에 파일이 빠졌어요(${sha.slice(0, 12)}).`);
      return bytes;
    },
  });
  let result: ReturnType<typeof applyPreparedStoreItem> | null = null;
  // 새 칩셋·에셋이라 쓰는 맵이 없다 — 조수가 하나라도 돌면 기다린다(WorkshopInstallBusy, installOwnership.ts).
  withInstallOwnership([], `생성기 묶음 넣기: ${pack.manifest.title}`, () => {
    recordProjectSnapshot("생성기 묶음 넣기");
    store.update((project) => {
      result = applyPreparedStoreItem(project, prepared);
    }, { scope: "assets", origin: "human", label: `생성기 묶음 넣기: ${pack.manifest.title}` });
  });
  const done = result as ReturnType<typeof applyPreparedStoreItem> | null;
  if (!done) throw new Error("프로젝트에 넣지 못했어요.");
  return { title: pack.manifest.title, assetIds: done.assetIds, tilesetIds: done.tilesetIds, replaced: done.replaced };
}
