// 타일 이식 아틀라스를 워커(OffscreenCanvas)에서 굽는다 — 메인 스레드는 계획(칸 좌표)과 소스 그림 주소를 넘기고 결과 ImageBitmap 을 받기만 한다.
//
// 왜: 버들항(beodeul_city, 2048×4992, 이식 4,133칸)을 처음 쓰는 순간 메인 스레드 합성이 0.3~0.4초, 거기에
// Phaser addCanvas 가 캔버스 전체를 getImageData 로 읽어 0.3~0.6초를 더 막았다(2026-10-30 폴른 2막 B6 패배 → 요새,
// swiftshader 실측). 장소 이동의 검은 화면이 그만큼 길었다. 합성을 워커로 옮기면 페이드아웃이 도는 동안 굽고,
// 메인 스레드에는 텍스처 올리기만 남는다.
//
// 워커·OffscreenCanvas·createImageBitmap 중 하나라도 없거나(오래된 사파리, 샌드박스 iframe) 워커가 실패하면
// null 을 돌려주고, 부르는 쪽(tilesetImage.ts)은 예전처럼 메인 스레드에서 굽는다.
import { GRAFT_PLAN_STRIDE, type GraftedTilesetPlan } from "@/assets/tileGrafts";

type BakeSource = HTMLImageElement | HTMLCanvasElement;
type Reply = { readonly id: number; readonly bitmap?: ImageBitmap; readonly pixels?: Uint8ClampedArray; readonly error?: string };

/** 워커가 구운 아틀라스. pixels 는 요청했을 때만(줄 띠 나눠 올리기용, 비트맵과 같은 화소의 비곱셈 RGBA). */
export interface OffthreadBake { readonly bitmap: ImageBitmap; readonly pixels?: Uint8ClampedArray }

let worker: Worker | null = null;
let disabled = false;
let nextId = 1;
const waiting = new Map<number, (reply: Reply) => void>();
/** 같은 소스 그림(번들 칩셋 이미지·투명색 키 캔버스)은 한 번만 ImageBitmap 으로 만든다. */
const bitmaps = new WeakMap<BakeSource, Promise<ImageBitmap>>();

export function offthreadTilesetBakeAvailable(): boolean {
  return !disabled
    && typeof Worker === "function"
    && typeof OffscreenCanvas === "function"
    && typeof createImageBitmap === "function";
}

function disable(reason: unknown): void {
  if (!disabled) console.warn("[tileset-bake] 워커 합성을 끕니다 — 메인 스레드에서 굽습니다:", reason);
  disabled = true;
  worker?.terminate();
  worker = null;
  for (const [id, resolve] of waiting) resolve({ id, error: "disabled" });
  waiting.clear();
}

function bakeWorker(): Worker | null {
  if (worker || disabled) return worker;
  try {
    worker = new Worker(new URL("./tilesetBake.worker.ts", import.meta.url), { type: "module", name: "oprn-tileset-bake" });
  } catch (error) {
    disable(error);
    return null;
  }
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data;
    const resolve = waiting.get(reply.id);
    waiting.delete(reply.id);
    if (reply.error) console.warn("[tileset-bake] 워커 합성 실패:", reply.error);
    resolve?.(reply);
  };
  worker.onerror = (event) => { event.preventDefault?.(); disable(event.message || "worker error"); };
  worker.onmessageerror = () => disable("messageerror");
  return worker;
}

function bitmapOf(source: BakeSource): Promise<ImageBitmap> {
  let pending = bitmaps.get(source);
  if (!pending) {
    pending = createImageBitmap(source);
    bitmaps.set(source, pending);
  }
  return pending;
}

type SourceRef = { readonly url: string } | { readonly bitmap: ImageBitmap };

/**
 * 소스 그림 하나를 워커에 넘길 꼴. 그림 파일을 그대로 쓴 텍스처면 주소로 넘겨 워커가 받고 푼다(메인 스레드 몫 0) —
 * Phaser 는 그림을 blob 으로 받아 주소를 곧 버리므로 HTMLImageElement.src 는 쓸 수 없고, 실은 주소를 따로 받는다.
 * 주소가 없는 캔버스(투명색 키 처리본)는 메인 스레드에서 비트맵으로 복사해야 하므로 allowMainThreadCopy 일 때만.
 */
async function sourceRef(source: BakeSource, url: string | null, allowMainThreadCopy: boolean): Promise<SourceRef | null> {
  // 캔버스는 이미 처리된 그림(투명색 키 등)이라 파일과 픽셀이 다르다 — 주소로 넘기지 않는다.
  if (url && typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) return { url };
  if (!allowMainThreadCopy) return null;
  return { bitmap: await bitmapOf(source) };
}

export interface OffthreadBakeOptions {
  /**
   * 미리 굽기: 계획 세우기를 이만큼(ms)마다 끊고 nextSlice 를 기다린다. 큰 캔버스를 메인 스레드에서 비트맵으로
   * 복사해야 하는 소스(투명색 키 캔버스)가 있으면 굽지 않는다 — 그 복사가 한 번에 상한을 넘는다.
   */
  readonly sliceBudgetMs?: number;
  readonly nextSlice?: () => Promise<void>;
  /** 화소 바이트도 받는다(GPU 에 띠씩 나눠 올릴 때). */
  readonly wantPixels?: boolean;
}

function post(target: Worker, message: object): Promise<Reply> {
  const id = nextId++;
  return new Promise<Reply>((resolve) => {
    waiting.set(id, resolve);
    target.postMessage({ id, ...message });
  });
}

/**
 * 계획(조각)을 세우고 워커에서 굽는다. 쓸 수 없거나 실패하면 null(메인 스레드 굽기로 대신한다).
 * sourceUrl: 그림판 키 → 그 텍스처를 실은 그림 파일의 절대 주소(파일 그대로일 때만, 아니면 null).
 */
export async function bakeGraftPlanOffthread(
  steps: Generator<void, GraftedTilesetPlan<BakeSource | string>, void>,
  baseKey: string,
  sourceUrl: (textureKey: string) => string | null,
  options: OffthreadBakeOptions = {},
): Promise<OffthreadBake | null> {
  if (!offthreadTilesetBakeAvailable()) return null;
  const budget = options.sliceBudgetMs;
  let sliceStart = performance.now();
  let plan: GraftedTilesetPlan<BakeSource | string>;
  for (let step = steps.next(); ; step = steps.next()) {
    if (step.done) { plan = step.value; break; }
    if (budget !== undefined && options.nextSlice && performance.now() - sliceStart >= budget) {
      await options.nextSlice();
      sliceStart = performance.now();
    }
  }
  if (plan.ops.length % GRAFT_PLAN_STRIDE !== 0) return null;
  const urgent = budget === undefined;
  const pictures = [plan.base, ...plan.sources];
  const keys = [baseKey, ...plan.sourceKeys];
  // 그림판 키만으로 세운 계획(그림이 아직 없다)은 주소로만 넘긴다.
  const fromKeys = typeof plan.base === "string";
  const refsFor = async (useUrls: boolean): Promise<SourceRef[] | null> => {
    const refs = await Promise.all(pictures.map((picture, index) => {
      if (typeof picture === "string") {
        const url = sourceUrl(picture);
        return Promise.resolve(url ? { url } : null);
      }
      return sourceRef(picture, useUrls ? sourceUrl(keys[index]!) : null, urgent);
    }));
    return refs.some((ref) => ref === null) ? null : refs as SourceRef[];
  };
  try {
    for (const useUrls of urgent && !fromKeys ? [true, false] : [true]) {
      const refs = await refsFor(useUrls);
      if (!refs) return null;
      const target = bakeWorker();
      if (!target) return null;
      const [base, ...sources] = refs;
      const reply = await post(target, { width: plan.width, height: plan.height, fitBase: fromKeys, base, sources, ops: plan.ops, pixels: options.wantPixels === true });
      if (reply.bitmap) return reply.pixels ? { bitmap: reply.bitmap, pixels: reply.pixels } : { bitmap: reply.bitmap };
      // 주소 받기가 막힌 환경(파일 주소·가로챈 요청)이면, 장소 이동이 기다리는 굽기는 메인 스레드 비트맵으로 한 번 더.
    }
  } catch (error) {
    disable(error);
  }
  return null;
}
