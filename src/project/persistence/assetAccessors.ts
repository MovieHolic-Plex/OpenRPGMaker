import type { UploadedAsset, UploadedAssetRef } from "../types";

export type UploadedAssetResolver = {
  readonly url: (ref: UploadedAssetRef) => string;
  readonly bytes: (ref: UploadedAssetRef) => Promise<Uint8Array>;
};

let resolver: UploadedAssetResolver | null = null;

export function setUploadedAssetResolver(next: UploadedAssetResolver | null): void {
  resolver = next;
}

export function uploadedAssetUrl(asset: UploadedAsset): string {
  if (asset.ref) return resolver ? resolver.url(asset.ref) : "";
  return asset.dataUrl ?? "";
}

export function uploadedAssetMime(asset: UploadedAsset): string {
  if (asset.ref) return asset.ref.mime;
  return uploadedAssetDataUrlMime(asset.dataUrl ?? "") ?? "";
}

export async function uploadedAssetBytes(asset: UploadedAsset): Promise<Uint8Array> {
  if (asset.ref) {
    if (!resolver) throw new Error(`asset ${asset.id} has no resolver for its ref`);
    return await resolver.bytes(asset.ref);
  }
  return decodeDataUrlBytes(asset.dataUrl ?? "");
}

export function uploadedAssetDataUrlMime(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl.trim());
  return match?.[1] ?? null;
}

export function decodeDataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return new Uint8Array();
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!header.includes(";base64")) return new TextEncoder().encode(decodeURIComponent(payload));
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}