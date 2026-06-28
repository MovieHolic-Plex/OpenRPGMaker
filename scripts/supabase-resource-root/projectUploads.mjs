import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pngDimensions, safeFileName, sha256Buffer, tileSizeForKind } from "./catalog.mjs";
import { writeJson } from "./supabaseRest.mjs";

export async function applyRootUploads(currentJson, resources) {
  const next = structuredClone(currentJson);
  next.assets = typeof next.assets === "object" && next.assets !== null ? next.assets : {};
  next.assets.sprites = typeof next.assets.sprites === "object" && next.assets.sprites !== null ? next.assets.sprites : {};
  next.assets.uploaded = typeof next.assets.uploaded === "object" && next.assets.uploaded !== null ? next.assets.uploaded : {};
  next.resourceProfiles = Array.isArray(next.resourceProfiles) ? next.resourceProfiles : [];
  const profileIndex = new Map(next.resourceProfiles.map((profile, index) => [profile.assetId, index]));

  for (const resource of resources) {
    const buffer = await readFile(resource.promotedPath);
    const dimensions = pngDimensions(buffer);
    const sha256 = sha256Buffer(buffer);
    next.assets.uploaded[resource.resourceId] = uploadedAsset(resource, buffer, dimensions, sha256);
    const profile = resourceProfile(resource, dimensions);
    const existingIndex = profileIndex.get(resource.resourceId);
    if (existingIndex === undefined) {
      next.resourceProfiles.push(profile);
      profileIndex.set(resource.resourceId, next.resourceProfiles.length - 1);
    } else {
      next.resourceProfiles[existingIndex] = { ...next.resourceProfiles[existingIndex], ...profile };
    }
  }
  return next;
}

export async function verifyRootUploads(currentJson, resources, evidenceDir) {
  const cacheDir = path.join(evidenceDir, "supabase-resource-cache");
  await mkdir(cacheDir, { recursive: true });
  const uploaded = currentJson.assets?.uploaded ?? {};
  const verified = [];
  const missing = [];
  const mismatched = [];
  const localDeleteReady = [];

  for (const resource of resources) {
    const asset = uploaded[resource.resourceId];
    if (!asset?.dataUrl) {
      missing.push({ resourceId: resource.resourceId, promotedPath: resource.promotedPath });
      continue;
    }
    const remote = decodeDataUrl(asset.dataUrl);
    const localBuffer = await readFile(resource.promotedPath);
    const remoteSha256 = sha256Buffer(remote.buffer);
    const localSha256 = sha256Buffer(localBuffer);
    const cachePath = path.join(cacheDir, `${safeFileName(resource.resourceId)}.png`);
    await writeFile(cachePath, remote.buffer);
    if (remoteSha256 !== localSha256) {
      mismatched.push({ resourceId: resource.resourceId, remoteSha256, localSha256 });
      continue;
    }
    verified.push(verifiedResource(resource, remote, remoteSha256, cachePath));
    localDeleteReady.push(localDeleteReadyResource(resource, cachePath));
  }

  const localDeleteReadinessPath = path.join(evidenceDir, "local-delete-readiness.json");
  await writeJson(localDeleteReadinessPath, {
    warning: "No local files were deleted. These paths are prepared for later deletion only after user approval.",
    readyCount: localDeleteReady.length,
    resources: localDeleteReady,
  });

  return {
    generatedAt: new Date().toISOString(),
    expectedCount: resources.length,
    verifiedCount: verified.length,
    missing,
    mismatched,
    verified,
    localDeleteReadinessPath,
  };
}

function uploadedAsset(resource, buffer, dimensions, sha256) {
  return {
    id: resource.resourceId,
    name: resource.name,
    kind: resource.resourceKind,
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    meta: {
      width: dimensions.width,
      height: dimensions.height,
      sha256,
    },
  };
}

function resourceProfile(resource, dimensions) {
  return {
    kind: resource.resourceKind,
    name: resource.name,
    assetId: resource.resourceId,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
    ...tileSizeForKind(resource.resourceKind),
  };
}

function verifiedResource(resource, remote, sha256, cachePath) {
  return {
    resourceId: resource.resourceId,
    promotedPath: resource.promotedPath,
    contentType: remote.contentType,
    sha256,
    byteLength: remote.buffer.byteLength,
    cachePath,
  };
}

function localDeleteReadyResource(resource, cachePath) {
  return {
    resourceId: resource.resourceId,
    localPath: resource.promotedPath,
    replacement: "Supabase current_json.assets.uploaded dataUrl",
    verifiedCachePath: cachePath,
  };
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  const contentType = match?.[1];
  const base64 = match?.[2];
  if (!contentType || !base64) throw new Error("Uploaded asset dataUrl is not base64 image data");
  return { contentType, buffer: Buffer.from(base64, "base64") };
}
