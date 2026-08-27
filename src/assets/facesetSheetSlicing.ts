// 저자가 4x4 얼굴 시트를 가져와도 터미널 스크립트를 시키지 않고 앱이 낱장으로 쪼갠다.
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";

export type FacesetSheetSplitPlan = {
  readonly columns: number;
  readonly rows: number;
  readonly count: number;
  readonly cellSize: number;
};

/** 48 의 배수 정사각형이고 48 보다 크면 시트다. 그 밖은 null — 쪼갤 것이 없다. */
export function planFacesetSheetSplit(width: number, height: number): FacesetSheetSplitPlan | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= FACE_IMAGE_SIZE || height <= FACE_IMAGE_SIZE) return null;
  if (width !== height) return null;
  if (width % FACE_IMAGE_SIZE !== 0) return null;
  const columns = width / FACE_IMAGE_SIZE;
  const rows = height / FACE_IMAGE_SIZE;
  return { columns, rows, count: columns * rows, cellSize: FACE_IMAGE_SIZE };
}

export function faceCellSuffix(index: number): string {
  return String(index).padStart(2, "0");
}

/** 업로드 시트의 낱장 id 규약. 이미 낱장 접미사가 붙어 있으면 그대로 둔다(재진입 안전). */
export function faceIdForUploadedSheetCell(sheetResourceId: string, cell: number): string {
  if (/-\d\d$/.test(sheetResourceId)) return sheetResourceId;
  return `${sheetResourceId}-${faceCellSuffix(cell)}`;
}

/** 브라우저 전용(canvas 필요). 반환 순서는 시트 칸 번호와 같다. */
export async function sliceFacesetSheetDataUrls(
  dataUrl: string,
  plan: FacesetSheetSplitPlan
): Promise<readonly string[]> {
  const image = await loadImage(dataUrl);
  const slices: string[] = [];
  for (let row = 0; row < plan.rows; row += 1) {
    for (let column = 0; column < plan.columns; column += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = plan.cellSize;
      canvas.height = plan.cellSize;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("canvas 2d 컨텍스트를 만들 수 없습니다.");
      context.imageSmoothingEnabled = false;
      context.drawImage(
        image,
        column * plan.cellSize,
        row * plan.cellSize,
        plan.cellSize,
        plan.cellSize,
        0,
        0,
        plan.cellSize,
        plan.cellSize
      );
      slices.push(canvas.toDataURL("image/png"));
    }
  }
  return slices;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("얼굴 시트 이미지를 읽을 수 없습니다."));
    image.src = dataUrl;
  });
}
