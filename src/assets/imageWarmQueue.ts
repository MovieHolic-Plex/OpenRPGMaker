// 브라우저 HTTP 캐시 + 디코드까지 미리 끝내는 공용 이미지 워밍 큐.
//
// 왜 공용인가: 플레이 진입 워밍(bundledAssetWarmup)과 편집기 다이얼로그 워밍
// (editorAssetWarmup)이 같은 함정 셋을 공유한다.
//   1. 한 번에 수백 장을 걸면 dev 서버(HTTP/1.1) 연결 6개가 막혀 정작 사용자가 지금 보는
//      그림이 큐 뒤로 밀린다 → 동시 요청 수를 묶는다.
//   2. happy-dom 등 테스트 환경에서는 onload/onerror 가 영원히 오지 않는다 → 상한을 둔다.
//   3. 같은 URL 을 두 소비자가 요청한다(플레이 워밍과 편집기 워밍은 캐릭셋을 공유한다)
//      → URL 단위로 in-flight 를 공유한다.
//
// 이 큐는 받은 그림을 보관하지 않는다. 살아 있는 Image 참조로 메모리 캐시를 잡아도 이득이
// 없었다(실측: 참조를 유지해도 피커가 같은 URL 을 200 으로 다시 내려받았다 — dev 서버가
// public/ 을 `Cache-Control: no-cache` 로 내보낸다). 수십 MB 짜리 디코드 버펌를 들고 있을
// 이유가 없어서 받기만 하고 놓는다. 색키 처리를 거치는 캐릭셋은 editorAssetWarmup 이 JS 캐시
// (`transparentColorKeyDataUrl`) 를 녹이는 쪽으로 다룬다.

const DEFAULT_CONCURRENCY = 6;
const LOAD_TIMEOUT_MS = 2_000;

const inFlight = new Map<string, Promise<void>>();
const pendingLoads: Array<{
  readonly task: () => Promise<void>;
  readonly resolve: () => void;
}> = [];
let activeLoadCount = 0;

export type WarmImageOptions = {
  readonly priority?: "low" | "auto";
};

export type WarmImageQueueOptions = WarmImageOptions & {
  readonly concurrency?: number;
};

export function imageWarmSupported(): boolean {
  return typeof window !== "undefined" && typeof Image !== "undefined";
}

// 워밍은 최적화이므로 실패가 호출자를 깨서는 안 된다 — reject 하지 않고 resolve 한다.
export function warmImageUrl(url: string, options: WarmImageOptions = {}): Promise<void> {
  const normalizedUrl = normalizeWarmUrl(url);
  const existing = inFlight.get(normalizedUrl);
  if (existing !== undefined) return existing;
  if (!imageWarmSupported()) return Promise.resolve();
  const promise = runImageWarmTask(() => loadImage(normalizedUrl, options));
  inFlight.set(normalizedUrl, promise);
  return promise;
}

export async function warmImageUrls(
  urls: readonly string[],
  options: WarmImageQueueOptions = {}
): Promise<void> {
  const concurrency = Math.min(
    DEFAULT_CONCURRENCY,
    Math.max(1, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY))
  );
  const queue = [...urls];
  const workerCount = Math.min(concurrency, queue.length);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) return;
      await warmImageUrl(next, options);
    }
  });
  await Promise.all(workers);
}

export function resetImageWarmCache(): void {
  inFlight.clear();
}

export function imageWarmCount(): number {
  return inFlight.size;
}

// Phaser scene.load 와 같은 URL 공간(Vite public/ 루트 기준 절대경로)이어야 HTTP 캐시가 맞는다.
export function normalizeWarmUrl(url: string): string {
  if (url.startsWith("/") || /^(?:https?:|data:|blob:)/i.test(url)) return url;
  return `/${url}`;
}

// 그림을 직접 반환해야 하는 색키 워밍도 같은 슬롯을 쓰도록 작업 단위 진입점을 둔다.
export function runImageWarmTask(task: () => Promise<void>): Promise<void> {
  const promise = new Promise<void>((resolve) => {
    pendingLoads.push({ task, resolve });
  });
  drainScheduledLoads();
  return promise;
}

function drainScheduledLoads(): void {
  while (activeLoadCount < DEFAULT_CONCURRENCY) {
    const next = pendingLoads.shift();
    if (next === undefined) return;
    activeLoadCount += 1;
    void next.task().then(
      () => finishScheduledLoad(next.resolve),
      () => finishScheduledLoad(next.resolve)
    );
  }
}

function finishScheduledLoad(resolve: () => void): void {
  activeLoadCount -= 1;
  resolve();
  drainScheduledLoads();
}

function loadImage(url: string, options: WarmImageOptions): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
      resolve();
    };
    timeout = globalThis.setTimeout(finish, LOAD_TIMEOUT_MS);
    try {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = options.priority === "low" ? "low" : "auto";
      image.onload = () => void decodeThenFinish(image, finish);
      image.onerror = finish;
      image.src = url;
      // 이미 캐시된 경우 complete 가 동기 true 일 수 있다 — onload 가 오지 않는다.
      if (image.complete) void decodeThenFinish(image, finish);
    } catch {
      finish();
    }
  });
}

// 디코드까지 끝내면 다이얼로그가 열릴 때 첫 페인트가 지연되지 않는다.
// decode 는 환경(happy-dom)에 없을 수 있고, 취소된 이미지에서는 reject 한다 — 둘 다 무해하다.
async function decodeThenFinish(image: HTMLImageElement, finish: () => void): Promise<void> {
  try {
    await image.decode?.();
  } catch {
    // 디코드 실패는 워밍 실패일 뿐이다. 실제 렌더 시점에 브라우저가 다시 시도한다.
  }
  finish();
}
