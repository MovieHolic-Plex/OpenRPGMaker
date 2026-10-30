// 타일 이식 합성 워커 — 메인 스레드를 막지 않고 큰 아틀라스(버들항 2048×4992, 이식 4천여 칸)를 굽는다.
// 계획(planGraftedTileset)의 순서를 그대로 따른다: 베이스를 (0,0)에 그리고, 칸마다 대상 칸을 지운 뒤 소스 칸을 그린다.
// 메인 스레드 판본은 tileGrafts.ts drawGraftedTilesetPlan — 둘을 바꿀 때는 같이 바꾼다.
// 소스 그림은 주소로 받아 여기서 받고 푼다(fetch → createImageBitmap) — 메인 스레드에서 큰 그림을 ImageBitmap 으로 만들면
// 그 자체가 수십~수백 ms 를 막았다(2026-10-30 실측). 캔버스 소스(투명색 키 처리본)만 메인 스레드가 비트맵으로 넘긴다.

type SourceRef = { readonly url: string } | { readonly bitmap: ImageBitmap };
interface BakeRequest {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  /** 베이스 크기를 모르고 세운 계획이면 true — 푼 베이스와 width/height 중 큰 쪽을 캔버스 크기로 쓴다. */
  readonly fitBase?: boolean;
  readonly base: SourceRef;
  readonly sources: readonly SourceRef[];
  readonly ops: Int32Array;
  /** 화소 바이트도 돌려준다 — 메인 스레드가 GPU 에 줄 띠씩 나눠 올린다(tilesetGpuStaging.ts). */
  readonly pixels?: boolean;
}

const STRIDE = 9;
/** 워커 전역(tsconfig 는 DOM lib 이라 webworker lib 와 섞지 않는다). */
const scope = self as unknown as { onmessage: ((event: MessageEvent<BakeRequest>) => void) | null; postMessage(message: unknown, transfer?: Transferable[]): void };
/** 같은 주소는 한 번만 받고 푼다(다음 굽기도 같은 칩셋 그림을 쓴다). */
const decoded = new Map<string, Promise<ImageBitmap>>();

function resolveSource(ref: SourceRef): Promise<ImageBitmap> {
  if ("bitmap" in ref) return Promise.resolve(ref.bitmap);
  let pending = decoded.get(ref.url);
  if (!pending) {
    pending = fetch(ref.url).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${ref.url}`);
      return response.blob();
    }).then((blob) => createImageBitmap(blob));
    pending.catch(() => decoded.delete(ref.url));
    decoded.set(ref.url, pending);
  }
  return pending;
}

scope.onmessage = (event: MessageEvent<BakeRequest>) => {
  const { id, width, height, ops } = event.data;
  void (async () => {
    try {
      const [base, ...sources] = await Promise.all([event.data.base, ...event.data.sources].map(resolveSource));
      const canvas = event.data.fitBase
        ? new OffscreenCanvas(Math.max(width, base!.width), Math.max(height, base!.height))
        : new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("OffscreenCanvas 2d 문맥이 없습니다");
      context.imageSmoothingEnabled = false;
      context.drawImage(base!, 0, 0);
      for (let at = 0; at < ops.length; at += STRIDE) {
        context.clearRect(ops[at + 5]!, ops[at + 6]!, ops[at + 7]!, ops[at + 8]!);
        context.drawImage(sources[ops[at]!]!, ops[at + 1]!, ops[at + 2]!, ops[at + 3]!, ops[at + 4]!, ops[at + 5]!, ops[at + 6]!, ops[at + 7]!, ops[at + 8]!);
      }
      // 바이트는 비트맵보다 먼저 읽는다(transferToImageBitmap 뒤 캔버스는 비워진다).
      const pixels = event.data.pixels ? context.getImageData(0, 0, canvas.width, canvas.height).data : undefined;
      const bitmap = canvas.transferToImageBitmap();
      scope.postMessage({ id, bitmap, pixels }, pixels ? [bitmap, pixels.buffer] : [bitmap]);
    } catch (error) {
      scope.postMessage({ id, error: String(error instanceof Error ? error.message : error) });
    }
  })();
};

export {};
