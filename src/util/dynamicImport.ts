// 실패한 동적 import 는 브라우저가 같은 specifier 의 거부를 페이지 수명 동안 캐시한다.
// Chrome 실측: `import("@/player/PlayScene")` 가 한 번 TypeError 나면 이후 같은
// 호출은 네트워크에 안 가고 즉시 같은 오류를 되돌려 준다. 복구 패널의 「다시 시도」가
// 그대로 startGame → import() 를 다시 부르면 영원히 같은 화면이 된다.
//
// 우회: 오류 메시지에서 URL 을 꺼내 `?t=` 를 붙인 새 specifier 로 다시 받는다.
// 파일이 살아 있으면(일시적 네트워크) 이걸로 충분하다. 해시가 바뀌어 404 면
// `src/app/moduleLoadRecovery.ts` 가 페이지를 한 번 새로고침한다.

export function isFailedDynamicImport(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return (
    message.includes("Failed to fetch dynamically imported module")
    || message.includes("error loading dynamically imported module")
    || (error.name === "TypeError" && message.includes("Importing a module script failed"))
  );
}

export function isEngineModuleLoadFailure(error: unknown): boolean {
  if (isFailedDynamicImport(error)) return true;
  if (!(error instanceof Error)) return false;
  return /Failed to load .*(phaser|PlayScene|EditScene)/i.test(error.message);
}

export function failedDynamicImportUrl(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(
    /(?:Failed to fetch dynamically imported module|error loading dynamically imported module):\s*(\S+)/,
  );
  const url = match?.[1]?.replace(/[)'".]+$/u, "");
  return url || undefined;
}

export function cacheBustModuleUrl(url: string, now: number = Date.now()): string {
  const absolute = /^https?:\/\//u.test(url);
  const parsed = new URL(url, "http://dynamic-import.local");
  parsed.searchParams.set("t", String(now));
  if (absolute) return parsed.toString();
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export type ImportWithRetryOptions<T> = {
  readonly retries?: number;
  readonly delayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly importUrl?: (url: string) => Promise<T>;
  readonly now?: () => number;
};

export async function importWithRetry<T>(
  importer: () => Promise<T>,
  options: ImportWithRetryOptions<T> = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 200;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  }));
  const now = options.now ?? Date.now;
  const importUrl = options.importUrl ?? defaultImportUrl<T>;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt === 0) return await importer();
      if (attempt > 1) await sleep(delayMs * (attempt - 1));
      const url = failedDynamicImportUrl(lastError);
      if (url) return await importUrl(cacheBustModuleUrl(url, now()));
      await sleep(delayMs);
      return await importer();
    } catch (error) {
      lastError = error;
      if (!isFailedDynamicImport(error)) throw error;
    }
  }
  throw lastError;
}

async function defaultImportUrl<T>(url: string): Promise<T> {
  return await import(/* @vite-ignore */ url) as T;
}
