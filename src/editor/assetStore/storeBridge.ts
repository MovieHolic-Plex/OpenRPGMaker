// src/editor/assetStore/storeBridge.ts
/** 데스크톱 스토어 다리 접근과 오류 풀기, 미리보기 그림 주소(blob: URL) 캐시. */
import type { OprnStoreBridge } from "@/assetStore/bridgeTypes";

export function storeBridge(): OprnStoreBridge | null {
  return typeof window === "undefined" ? null : window.oprn?.store ?? null;
}

export interface StoreFailure { readonly message: string; readonly status: number; readonly details: readonly string[] }

/** IPC 오류는 "Error invoking remote method '…': Error: {json}" 꼴로 온다. 메인이 넣은 JSON 을 꺼낸다. */
export function storeFailure(error: unknown): StoreFailure {
  const text = error instanceof Error ? error.message : String(error);
  const start = text.indexOf("{");
  if (start >= 0) {
    try {
      const parsed = JSON.parse(text.slice(start)) as Partial<StoreFailure>;
      if (typeof parsed.message === "string") return { message: parsed.message, status: Number(parsed.status ?? 0), details: Array.isArray(parsed.details) ? parsed.details.map(String) : [] };
    } catch { /* JSON 이 아니면 원문 */ }
  }
  return { message: text.replace(/^Error invoking remote method '[^']+': (Error: )?/, ""), status: 0, details: [] };
}

const urls = new Map<string, Promise<string>>();

/** 스토어 blob 을 렌더러에서 보여 줄 주소. 메인이 해시를 확인한 바이트로 blob: URL 을 만든다(CSP img-src blob: 허용). */
export function storeBlobUrl(sha256: string): Promise<string> {
  let url = urls.get(sha256);
  if (!url) {
    const bridge = storeBridge();
    url = bridge
      ? bridge.blob({ sha256 }).then((bytes) => URL.createObjectURL(new Blob([bytes as BlobPart])))
      : Promise.reject(new Error("스토어는 데스크톱 앱에서만 열 수 있습니다."));
    url.catch(() => urls.delete(sha256));
    urls.set(sha256, url);
  }
  return url;
}

/** 이미지 요소에 스토어 blob 을 비동기로 채운다. 실패하면 대체 표시를 남긴다. */
export function fillStoreImage(img: HTMLImageElement, sha256: string | null): HTMLImageElement {
  if (!sha256) { img.dataset.empty = "1"; return img; }
  void storeBlobUrl(sha256).then((url) => { img.src = url; }).catch(() => { img.dataset.failed = "1"; });
  return img;
}
