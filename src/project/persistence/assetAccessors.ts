import { decodeDataUrlBytes, dataUrlMime } from "./core/dataUrl";
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
  return dataUrlMime(asset.dataUrl ?? "") ?? "";
}

export async function uploadedAssetBytes(asset: UploadedAsset): Promise<Uint8Array> {
  if (asset.ref) {
    if (!resolver) throw new Error(`asset ${asset.id} has no resolver for its ref`);
    return await resolver.bytes(asset.ref);
  }
  return decodeDataUrlBytes(asset.dataUrl ?? "");
}

export { dataUrlMime, decodeDataUrlBytes };