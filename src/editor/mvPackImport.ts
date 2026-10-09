// 사용자가 RPG Maker MV/MZ 팩 시트 여러 장을 한꺼번에 올리면 알려진 프리셋과 맞춰 조수가 바로 깔 수 있는
// 타일셋 하나로 굽는다. 그림은 사용자 원본에서만 만든다 — 저장소의 프리셋에는 그림이 없다(재배포 금지 팩).
// 배경: openwiki/teaching-assistant-tilesets.md 「재배포 금지 서드파티 팩」.

import { MV_PACK_PRESETS } from "@/project/rpgmakerMv/packs";
import type { MvPackPreset } from "@/project/rpgmakerMv/packPreset";
import { buildMvPackTileset } from "@/project/rpgmakerMv/tilesetPreset";
import type { RgbaImage } from "@/project/rpgmakerMv/bake";
import { projectRepository } from "@/project/persistence/repository";
import { store } from "@/project/store";
import { uploadedAssetForImport } from "@/editor/uploadedAssetStorage";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

/** 이 파일 이름이 알려진 팩 시트인가 — 업로드 묶음을 팩 가져오기로 돌릴지 고른다. */
export function isKnownMvPackSheetName(name: string): boolean {
  return MV_PACK_PRESETS.some((preset) => preset.sheets.some((sheet) => sheet.file === name));
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decodePng(file: File): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("캔버스를 만들 수 없습니다.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: data.width, height: data.height, data: data.data };
}

function encodePng(image: RgbaImage): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("캔버스를 만들 수 없습니다.");
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
}

export interface MvPackMatch {
  readonly preset: MvPackPreset;
  readonly matched: number;
  readonly renamedOrEdited: readonly string[];
  readonly missing: readonly string[];
}

/** 올린 파일(이름·해시)과 가장 많이 맞는 프리셋. 절반 이상 맞아야 고른다. */
export function matchMvPackPreset(files: readonly { name: string; sha256: string }[]): MvPackMatch | null {
  let best: MvPackMatch | null = null;
  for (const preset of MV_PACK_PRESETS) {
    const byName = new Map(files.map((file) => [file.name, file.sha256]));
    const hashes = new Set(files.map((file) => file.sha256));
    let matched = 0;
    const renamedOrEdited: string[] = [];
    const missing: string[] = [];
    for (const sheet of preset.sheets) {
      if (hashes.has(sheet.sha256)) matched += 1;
      else if (byName.has(sheet.file)) renamedOrEdited.push(sheet.file);
      else missing.push(sheet.file);
    }
    if (matched + renamedOrEdited.length < Math.ceil(preset.sheets.length / 2)) continue;
    if (!best || matched > best.matched) best = { preset, matched, renamedOrEdited, missing };
  }
  return best;
}

/** 팩 시트 묶음 → 업로드 자산(구운 아틀라스) + 프리셋 타일셋. */
export async function importMvPackFiles(files: readonly File[]): Promise<void> {
  const read = await Promise.all(files.map(async (file) => ({ file, name: file.name, sha256: await sha256Hex(await file.arrayBuffer()) })));
  const match = matchMvPackPreset(read);
  if (!match) {
    toast("알려진 RPG Maker 팩 시트 묶음이 아닙니다 — 팩 폴더의 시트를 한꺼번에 올려 주세요.", "error");
    return;
  }
  const { preset } = match;
  toast(`${preset.name}: 시트 ${match.matched + match.renamedOrEdited.length}/${preset.sheets.length}장 인식 — 타일셋을 굽는 중…`, "ok");
  const sheets = new Map<string, RgbaImage>();
  for (const sheet of preset.sheets) {
    const entry = read.find((candidate) => candidate.sha256 === sheet.sha256) ?? read.find((candidate) => candidate.name === sheet.file);
    if (entry) sheets.set(sheet.file, await decodePng(entry.file));
  }
  const tilesetId = genId("ts");
  const assetId = genId("chipset_img");
  const built = buildMvPackTileset({ preset, sheets, tilesetId, assetId, encodePng });
  const asset = await uploadedAssetForImport({
    repository: projectRepository(),
    id: assetId,
    name: preset.name,
    kind: "chipset",
    dataUrl: encodePng(built.atlas),
    meta: { tileSize: 48, frames: built.tileset.count, frameWidth: 48, frameHeight: 48, width: built.atlas.width, height: built.atlas.height },
  });
  store.update((project) => {
    project.assets.uploaded[assetId] = asset;
    project.resourceProfiles.push({
      kind: "chipset", name: asset.name, tileWidth: 48, tileHeight: 48,
      imageWidth: built.atlas.width, imageHeight: built.atlas.height, assetId,
    });
    project.tilesets[tilesetId] = built.tileset;
  });
  const notes = [
    match.renamedOrEdited.length ? `판본이 다른 시트 ${match.renamedOrEdited.length}장(칸 이름이 어긋날 수 있음)` : "",
    match.missing.length ? `빠진 시트 ${match.missing.length}장(그 칸은 비어 있음)` : "",
  ].filter(Boolean).join(", ");
  toast(`타일셋 추가됨: ${preset.name} — 재료 ${built.tileset.autotileGroups?.length ?? 0}종·물체 ${built.tileset.structureKits?.length ?? 0}개. 크레딧: ${preset.credit}${notes ? ` (${notes})` : ""}`, "ok");
}
