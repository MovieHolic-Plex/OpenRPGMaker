import { sha256HexBytes } from "@/util/sha256";
import type { UploadedAssetRef } from "../types";
import { encodeDataUrlBytes } from "./core/dataUrl";
import type { AssetPutInput, AssetPutResult } from "./types";

export type MemoryAssetStore = {
  readonly supportsAssetRefs: false;
  readonly assets: {
    put(bytes: Uint8Array, meta: AssetPutInput): Promise<AssetPutResult>;
    url(sha256: string): string;
    list(): Promise<readonly UploadedAssetRef[]>;
    pruneUnused(referenced: readonly string[]): Promise<readonly string[]>;
  };
};

/** 자산 저장소. 파일이 없으면 문서에 넣을 데이터 URL 로 돌려준다(웹 모드 동작 보존). */
export function createMemoryAssetStore(): MemoryAssetStore {
  const meta = new Map<string, UploadedAssetRef>();
  const bytes = new Map<string, Uint8Array>();
  return {
    supportsAssetRefs: false,
    assets: {
      async put(input: Uint8Array, putMeta: AssetPutInput): Promise<AssetPutResult> {
        const sha256 = await sha256HexBytes(input);
        const ref: UploadedAssetRef = {
          sha256,
          mime: putMeta.mime,
          bytes: input.byteLength,
          extension: putMeta.extension,
        };
        meta.set(sha256, ref);
        bytes.set(sha256, input.slice());
        return { ref, dataUrl: encodeDataUrlBytes(input, putMeta.mime) };
      },
      url(sha256: string): string {
        const stored = bytes.get(sha256);
        const storedMeta = meta.get(sha256);
        return stored && storedMeta ? encodeDataUrlBytes(stored, storedMeta.mime) : "";
      },
      async list(): Promise<readonly UploadedAssetRef[]> {
        return [...meta.values()];
      },
      async pruneUnused(referenced: readonly string[]): Promise<readonly string[]> {
        const keep = new Set(referenced);
        const removed: string[] = [];
        for (const sha256 of [...meta.keys()]) {
          if (keep.has(sha256)) continue;
          meta.delete(sha256);
          bytes.delete(sha256);
          removed.push(sha256);
        }
        return removed;
      },
    },
  };
}