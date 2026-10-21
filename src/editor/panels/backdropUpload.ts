// 맵 배경 탭의 「내 그림 올리기」 — 자원 관리자를 열지 않고 그 자리에서 배경 그림을 가져온다.
//
// 2026-10-21 감사: 맵 배경 그림 고르기 창에는 올리기 단추가 없었다. 자원 관리자를 따로 열어 「전투 배경」 분류에
// 넣어야 했는데, 맵 배경이 그 분류를 쓴다는 것을 첫 사용자는 알 수 없다. 저장 경로·검사는 자원 관리자와 같다
// (`resourceManager.importImageResource` 의 그림 갈래와 같은 함수들).

import { genId } from "@/util/id";
import { projectRepository } from "@/project/persistence/repository";
import { getResourceProfileSpec, validateResourceDimensions } from "@/project/resourceProfiles";
import { store } from "@/project/store";
import { uploadedAssetForImport } from "@/editor/uploadedAssetStorage";
import {
  IMAGE_IMPORT_ACCEPT,
  decideImageDataUrl,
  decideImageImport,
  formatImageImportDimensionError,
  prepareImportedImageDataUrl,
} from "./resourceManagerImageImport";

export type ImportedBackdrop = { readonly id: string; readonly width: number; readonly height: number };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

/** 파일 하나를 배경(backdrop) 자원으로 가져온다. 실패하면 사람에게 보일 문장으로 던진다. */
export async function importBackdropFile(file: File): Promise<ImportedBackdrop> {
  const decision = decideImageImport({ fileName: file.name, mimeType: file.type, sizeBytes: file.size });
  if (!decision.ok) throw new Error(decision.message);
  const rawDataUrl = await readFileAsDataUrl(file);
  const urlDecision = decideImageDataUrl(rawDataUrl, { format: decision.format, normalizeToPng: decision.normalizeToPng });
  if (!urlDecision.ok) throw new Error(urlDecision.message);
  const { dataUrl, width, height } = await prepareImportedImageDataUrl(rawDataUrl, decision.normalizeToPng || urlDecision.normalizeToPng);
  const checked = validateResourceDimensions("backdrop", width, height);
  if (!checked.ok) throw new Error(formatImageImportDimensionError(checked.message, width, height));
  const spec = getResourceProfileSpec("backdrop");
  const id = genId("backdrop_img");
  const asset = await uploadedAssetForImport({
    repository: projectRepository(),
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    kind: "backdrop",
    dataUrl,
    meta: { tileSize: spec.tileWidth, frames: checked.tileCount, frameWidth: spec.tileWidth, frameHeight: spec.tileHeight, width, height },
  });
  store.update((project) => {
    project.assets.uploaded[id] = asset;
    project.resourceProfiles.push({
      kind: "backdrop", name: asset.name, tileWidth: spec.tileWidth, tileHeight: spec.tileHeight,
      imageWidth: width, imageHeight: height, assetId: id,
    });
  });
  return { id, width, height };
}

/** 파일 고르기 창을 열고 고른 파일을 가져온다. 취소하면 null. */
export function pickBackdropFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMAGE_IMPORT_ACCEPT;
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    }, { once: true });
    input.addEventListener("cancel", () => { resolve(null); input.remove(); }, { once: true });
    document.body.append(input);
    input.click();
  });
}
