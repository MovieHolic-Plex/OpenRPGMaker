// start/firstRun/referenceImage.ts
// 첫 화면 참고 그림을 긴 변 768px 로 줄여 data URL 로 만든다. 시작 화면 → 편집기 인계가 sessionStorage 라 작게 둔다.
import { MAX_USER_IMAGE_URL_CHARS } from "@/ai/piAgent/userImages";

const LONG_SIDE = 768;
const TARGET_CHARS = 300_000;

export async function shrinkReferenceImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("캔버스를 열 수 없습니다.");
    // 투명한 그림은 JPEG 에서 검게 바뀐다 — 흰 바탕을 깐다.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.86, 0.72, 0.58, 0.45]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= TARGET_CHARS) return url;
    }
    const last = canvas.toDataURL("image/jpeg", 0.35);
    if (last.length > MAX_USER_IMAGE_URL_CHARS) throw new Error("그림이 너무 큽니다.");
    return last;
  } finally {
    bitmap.close();
  }
}
