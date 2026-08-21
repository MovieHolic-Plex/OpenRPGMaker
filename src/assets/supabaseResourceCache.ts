import type { Project, UploadedAsset } from "@/project/types";

export const SUPABASE_RESOURCE_CACHE_NAME = "oprn-supabase-resource-cache-v3";

export type SupabaseResourceCacheEntry = {
  readonly byteLength: number;
  readonly cacheUrl: string;
  readonly contentType: string;
  readonly resourceId: string;
};

export type SupabaseResourceCacheSkipReason = "cache-api-unavailable" | "not-base64-data-url";

export type SupabaseResourceCacheSkip = {
  readonly reason: SupabaseResourceCacheSkipReason;
  readonly resourceId: string;
};

export type SupabaseResourceCacheReport = {
  readonly cached: readonly SupabaseResourceCacheEntry[];
  readonly skipped: readonly SupabaseResourceCacheSkip[];
};

type ResourceCache = {
  readonly put: (request: RequestInfo | URL, response: Response) => Promise<void>;
};

type ResourceCacheStorage = {
  readonly open: (name: string) => Promise<ResourceCache>;
};

type CacheOptions = {
  readonly cacheStorage?: ResourceCacheStorage;
};

type ParsedDataUrl = {
  readonly bytes: Uint8Array;
  readonly contentType: string;
};

const BASE64_DATA_URL = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/;

export function supabaseResourceCacheRequestUrl(resourceId: string): string {
  return `/__oprn-cache__/resources/${encodeURIComponent(resourceId)}`;
}

export async function cacheSupabaseRootResources(
  project: Pick<Project, "assets">,
  options: CacheOptions = {},
): Promise<SupabaseResourceCacheReport> {
  const uploadedAssets = Object.values(project.assets.uploaded);
  const cacheStorage = options.cacheStorage ?? globalThis.caches;
  if (cacheStorage === undefined) {
    return {
      cached: [],
      skipped: uploadedAssets.map((asset) => ({ resourceId: asset.id, reason: "cache-api-unavailable" })),
    };
  }

  const cache = await cacheStorage.open(SUPABASE_RESOURCE_CACHE_NAME);
  const cached: SupabaseResourceCacheEntry[] = [];
  const skipped: SupabaseResourceCacheSkip[] = [];
  for (const asset of uploadedAssets) {
    const parsed = parseBase64DataUrl(asset.dataUrl);
    if (parsed === null) {
      skipped.push({ resourceId: asset.id, reason: "not-base64-data-url" });
      continue;
    }
    const cacheUrl = supabaseResourceCacheRequestUrl(asset.id);
    await cache.put(cacheUrl, responseForUploadedAsset(parsed));
    cached.push({
      resourceId: asset.id,
      cacheUrl,
      contentType: parsed.contentType,
      byteLength: parsed.bytes.byteLength,
    });
  }
  return { cached, skipped };
}

export function uploadedAssetIsSupabaseRooted(asset: UploadedAsset | undefined): asset is UploadedAsset {
  return asset !== undefined && parseBase64DataUrl(asset.dataUrl) !== null;
}

function parseBase64DataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = BASE64_DATA_URL.exec(dataUrl.trim());
  const contentType = match?.[1];
  const base64 = match?.[2];
  if (contentType === undefined || base64 === undefined) return null;
  return {
    contentType,
    bytes: decodeBase64Bytes(base64),
  };
}

function decodeBase64Bytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function responseForUploadedAsset(parsed: ParsedDataUrl): Response {
  const body = new Blob([arrayBufferFromBytes(parsed.bytes)], { type: parsed.contentType });
  return new Response(body, {
    headers: {
      "Content-Type": parsed.contentType,
      "X-RPG-ZZU-Resource-Root": "supabase-current-json-assets-uploaded",
    },
  });
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
