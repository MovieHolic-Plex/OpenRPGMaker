// 컷신 그림의 화면 크기 — 업로드 meta 가 있으면 그것, 없으면 PNG 헤더(IHDR)에서 읽는다.
import type { Project } from "@/project/types";

export function pngSize(dataUrl: string): { width: number; height: number } | null {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  try {
    const bytes = Uint8Array.from(atob(base64.slice(0, 64)), (ch) => ch.charCodeAt(0));
    if (bytes.length < 24 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  } catch {
    return null;
  }
}

export function pictureSize(draft: Project, id: string, fallback: { width: number; height: number }): { width: number; height: number } {
  const asset = draft.assets.uploaded[id];
  const width = asset?.meta?.width;
  const height = asset?.meta?.height;
  if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) return { width, height };
  return (asset?.dataUrl ? pngSize(asset.dataUrl) : null) ?? fallback;
}
