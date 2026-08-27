import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export const DEFAULT_EVIDENCE_DIR = "output/evidence/supabase-root-cache";
export const DEFAULT_PROJECT_ID = "rpg-zzu-house-template-gallery";

const GENERATED_PLAN_PATH = "src/assets/oprnGeneratedAssetPlan.json";

export const RESOURCE_SLICING = {
  chipset: {
    kind: "grid",
    unit: "tile",
    cellWidth: 16,
    cellHeight: 16,
    columns: 30,
    rows: 16,
    count: 480,
    sheetWidth: 480,
    sheetHeight: 256,
    subcell: { unit: "quarter-tile", cellWidth: 8, cellHeight: 8 },
  },
  charset: {
    kind: "grid",
    unit: "charset-frame",
    cellWidth: 24,
    cellHeight: 32,
    columns: 12,
    rows: 8,
    count: 96,
    sheetWidth: 288,
    sheetHeight: 256,
  },
  battle: { kind: "whole-image", unit: "image" },
  battleCharset: {
    kind: "grid",
    unit: "battle-character",
    cellWidth: 48,
    cellHeight: 48,
  },
  battleWeapon: {
    kind: "grid",
    unit: "battle-weapon",
    cellWidth: 64,
    cellHeight: 64,
    columns: 3,
    rows: 8,
    count: 24,
    sheetWidth: 192,
    sheetHeight: 512,
  },
  backdrop: { kind: "whole-image", unit: "image" },
  gameOver: { kind: "whole-image", unit: "image" },
  monster: { kind: "whole-image", unit: "image" },
  // 얼굴은 한 칸 = 한 파일이다(48×48 단일 이미지). 4×4 시트 격자는 폐기됐다 —
  // src/assets/resourceSlicing.ts 와 같은 값을 유지해야 한다.
  faceset: { kind: "whole-image", unit: "image" },
  picture: { kind: "whole-image", unit: "image" },
  system: { kind: "whole-image", unit: "image" },
  system2: { kind: "whole-image", unit: "image" },
  title: { kind: "whole-image", unit: "image" },
  music: { kind: "audio", unit: "audio" },
  sound: { kind: "audio", unit: "audio" },
};

const BUILTIN_ROOT_FILES = [
  {
    resourceId: "hero",
    name: "Hero 01 Battle Alias",
    resourceKind: "battleCharset",
    promotedPath: "public/assets/generated/starter/hero-01-battle.png",
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
    promotedPath: "public/assets/generated/starter/monster-ontology-8da61312.png",
  },
  {
    resourceId: "generated-enemy-sylph-hornet",
    name: "Sylph Hornet",
    resourceKind: "monster",
    promotedPath: "public/assets/generated/starter/sylph-hornet-transparent.png",
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
  const slicing = RESOURCE_SLICING[kind];
  if (slicing?.kind === "grid") return { tileWidth: slicing.cellWidth, tileHeight: slicing.cellHeight };
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
