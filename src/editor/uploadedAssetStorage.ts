import { dataUrlExtension, dataUrlMime, decodeDataUrlBytes } from "@/project/persistence/core/dataUrl";
import type { ProjectRepository } from "@/project/persistence/types";
import type { UploadedAsset } from "@/project/types";

export type UploadedAssetImportInput = {
  readonly repository: ProjectRepository;
  readonly id: string;
  readonly name: string;
  readonly kind: UploadedAsset["kind"];
  readonly dataUrl: string;
  readonly meta: UploadedAsset["meta"];
  readonly mime?: string;
  readonly extension?: string;
};

/**
 * 업로드가 자산을 어디에 두는지는 어댑터가 정한다 — 파일 저장이 있으면 ref 를, 없으면 dataUrl 을
 * 문서에 넣는다. 호출부는 두 모드를 알 필요가 없다.
 */
export async function uploadedAssetForImport(input: UploadedAssetImportInput): Promise<UploadedAsset> {
  if (!input.repository.supportsAssetRefs) {
    return { id: input.id, name: input.name, kind: input.kind, dataUrl: input.dataUrl, meta: input.meta };
  }
  const mime = input.mime ?? dataUrlMime(input.dataUrl) ?? "application/octet-stream";
  const stored = await input.repository.assets.put(decodeDataUrlBytes(input.dataUrl), {
    mime,
    extension: input.extension ?? dataUrlExtension(input.dataUrl, mime),
    originalName: input.name,
    kind: input.kind,
  });
  return { id: input.id, name: input.name, kind: input.kind, ref: stored.ref, meta: input.meta };
}