// 캔버스 → PNG data URL 을 메인 스레드를 막지 않고 만든다.
//
// `canvas.toDataURL("image/png")` 는 동기 인코딩이다 — 큰 시트(이식 칸 합성 2048×7664 등)는 한 번에 약 1s 메인 스레드를 막았다
// (2026-11-26 데스크톱 부팅 프로필: 편집기 첫 화면 뒤 멈춤). `toBlob` 은 같은 인코더로 같은 바이트를 비동기로 만들고, data URL 은
// FileReader 가 그 바이트로 만든다 — 결과 글은 `toDataURL` 과 같다. `toBlob` 이 없거나 실패하면 예전처럼 `toDataURL` 을 쓴다.

export interface CanvasPng {
  readonly dataUrl: string;
  /** 같은 PNG 바이트. 미리보기 blob: 주소를 data URL 을 다시 풀지 않고 만든다. 대비책 경로에서는 null. */
  readonly blob: Blob | null;
}

type PngCanvas = Pick<HTMLCanvasElement, "toDataURL"> & { toBlob?: HTMLCanvasElement["toBlob"] };

export async function canvasPng(canvas: PngCanvas): Promise<CanvasPng> {
  const blob = typeof canvas.toBlob === "function" && typeof FileReader !== "undefined"
    ? await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob!((made) => resolve(made), "image/png");
      } catch {
        resolve(null);
      }
    })
    : null;
  if (blob) {
    const dataUrl = await blobDataUrl(blob);
    if (dataUrl !== null) return { dataUrl, blob };
  }
  return { dataUrl: canvas.toDataURL("image/png"), blob: null };
}

export async function canvasPngDataUrl(canvas: PngCanvas): Promise<string> {
  return (await canvasPng(canvas)).dataUrl;
}

function blobDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
