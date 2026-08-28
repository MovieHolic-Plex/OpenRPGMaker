// 마이그레이션이 만든 낱장 자산은 아직 시트 이미지를 물려받은 상태다(동기 단계라 픽셀을
// 자를 수 없다). 로드 직후 canvas 로 각 칸을 실제로 잘라 넣어 "한 장 = 한 얼굴"을 완성한다.
import { planFacesetSheetSplit, sliceFacesetSheetDataUrls } from "@/assets/facesetSheetSlicing";
import type { Project } from "@/project/types";

type RepairableFace = {
  readonly faceId: string;
  readonly sheetSourceId: string;
  readonly cell: number;
};

function listPendingFaces(project: Project): readonly RepairableFace[] {
  const pending: RepairableFace[] = [];
  for (const asset of Object.values(project.assets.uploaded)) {
    if (asset.kind !== "faceset") continue;
    const meta = asset.meta as { readonly sheetCell?: unknown; readonly sheetSourceId?: unknown } | undefined;
    const cell = typeof meta?.sheetCell === "number" ? meta.sheetCell : null;
    const sheetSourceId = typeof meta?.sheetSourceId === "string" ? meta.sheetSourceId : null;
    if (cell === null || sheetSourceId === null) continue;
    pending.push({ faceId: asset.id, sheetSourceId, cell });
  }
  return pending;
}

// 동기 사전 점검. 호출자가 이걸 먼저 봐서 await 자시합을 건너다— 생산 잠금:
// 로드 경로에 불필요한 await 를 넣으면 지속화 순서가 어긍나며
// storePersistence / storeFlushShaEvidence 의 순서 계약이 진다(실머 2026-08-27).
export function hasPendingFacesetSheetRepair(project: Project): boolean {
  return listPendingFaces(project).length > 0;
}

/**
 * 아직 시트 픽셀을 물고 있는 낱장 자산을 실제 48×48 그림으로 바꾼다.
 * canvas 가 없는 환경(테스트·노드)에서는 아무것도 하지 않고 false 를 돌려준다.
 */
export async function repairUploadedFacesetSheets(project: Project): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const pending = listPendingFaces(project);
  if (pending.length === 0) return false;

  const bySheet = new Map<string, RepairableFace[]>();
  for (const face of pending) {
    const group = bySheet.get(face.sheetSourceId) ?? [];
    group.push(face);
    bySheet.set(face.sheetSourceId, group);
  }

  let changed = false;
  for (const [, faces] of bySheet) {
    const sample = project.assets.uploaded[faces[0].faceId];
    if (sample === undefined) continue;
    const sheetDataUrl = sample.dataUrl;
    if (typeof sheetDataUrl !== "string" || sheetDataUrl === "") continue;
    const size = await imageSize(sheetDataUrl);
    const plan = size === null ? null : planFacesetSheetSplit(size.width, size.height);
    if (plan === null) {
      for (const face of faces) clearRepairMarker(project, face.faceId);
      changed = true;
      continue;
    }
    let slices: readonly string[];
    try {
      slices = await sliceFacesetSheetDataUrls(sheetDataUrl, plan);
    } catch {
      continue;
    }
    for (const face of faces) {
      const asset = project.assets.uploaded[face.faceId];
      const slice = slices[face.cell];
      if (asset === undefined || slice === undefined) continue;
      project.assets.uploaded[face.faceId] = {
        ...asset,
        dataUrl: slice,
        meta: { ...asset.meta, width: plan.cellSize, height: plan.cellSize },
      };
      clearRepairMarker(project, face.faceId);
      changed = true;
    }
  }
  return changed;
}

function clearRepairMarker(project: Project, faceId: string): void {
  const asset = project.assets.uploaded[faceId];
  if (asset === undefined) return;
  const meta = { ...(asset.meta as Record<string, unknown>) };
  delete meta.sheetCell;
  delete meta.sheetSourceId;
  project.assets.uploaded[faceId] = { ...asset, meta: meta as typeof asset.meta };
}

function imageSize(dataUrl: string): Promise<{ readonly width: number; readonly height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}
