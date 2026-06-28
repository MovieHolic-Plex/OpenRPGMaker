import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export const DEFAULT_EVIDENCE_DIR = "output/evidence/supabase-root-cache";
export const DEFAULT_PROJECT_ID = "rpg-zzu-house-template-gallery";

const GENERATED_PLAN_PATH = "src/assets/rm2k3GeneratedAssetPlan.json";

const BUILTIN_ROOT_FILES = [
  {
    resourceId: "hero",
    name: "Hero 01 Battle Alias",
    resourceKind: "battleCharset",
    promotedPath: "public/assets/generated/rm2k3/hero-01-battle.png",
  },
  {
    resourceId: "rpg-zzu-title-blue",
    name: "RPG Zzu Blue Title",
    resourceKind: "title",
    promotedPath: "public/assets/generated/title/default-title-blue.png",
  },
  {
    resourceId: "generated-enemy-ontology-8da61312",
    name: "Ontology Enemy",
    resourceKind: "monster",
    promotedPath: "public/assets/generated/rm2k3/monster-ontology-8da61312.png",
  },
  {
    resourceId: "generated-enemy-sylph-hornet",
    name: "Sylph Hornet",
    resourceKind: "monster",
    promotedPath: "public/assets/generated/rm2k3/sylph-hornet-transparent.png",
  },
];

export async function rootResourceFiles() {
  const plan = JSON.parse(await readFile(GENERATED_PLAN_PATH, "utf8"));
  const entries = new Map();
  for (const builtin of BUILTIN_ROOT_FILES) entries.set(builtin.resourceId, builtin);
  for (const asset of plan.assets ?? []) {
    if (asset.status !== "promoted" || typeof asset.promotedPath !== "string") continue;
    entries.set(asset.resourceId, {
      resourceId: asset.resourceId,
      name: asset.id,
      resourceKind: asset.resourceKind,
      promotedPath: asset.promotedPath,
    });
  }
  const existing = [];
  const missing = [];
  for (const entry of entries.values()) {
    if (existsSync(entry.promotedPath)) existing.push(entry);
    else missing.push(entry);
  }
  if (missing.length > 0) {
    throw new Error(`Promoted resource file(s) are missing: ${missing.map((entry) => entry.promotedPath).join(", ")}`);
  }
  return existing;
}

export function pngDimensions(buffer) {
  if (buffer.byteLength < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Expected a PNG file");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function tileSizeForKind(kind) {
  if (kind === "charset") return { tileWidth: 24, tileHeight: 32 };
  if (kind === "faceset") return { tileWidth: 48, tileHeight: 48 };
  if (kind === "battleCharset") return { tileWidth: 48, tileHeight: 48 };
  return {};
}

export function safeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}
