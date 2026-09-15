import { setInstalledBgmFiles } from "@/assets/installedBgm";

/** 설치가 끝나 리소스 목록을 다시 만들어야 할 때 window 에 실린다. */
export const BGM_INSTALLED_EVENT = "oprn:bgm-installed";

const STATUS_URL = "/api/bgm/status";
const INSTALL_URL = "/api/bgm/install";
const POLL_INTERVAL_MS = 1000;

export type BgmInstallStatus = {
  readonly expected: number;
  readonly installed: readonly string[];
  readonly installing: boolean;
  readonly stagedBytes: number;
  readonly archiveBytes: number;
  readonly remoteAllowed: boolean;
  readonly error: string | null;
};

/** 정적 배포는 SPA 폴백 HTML 을 200 으로 준다 — 상태 코드로는 엔드포인트 유무를 알 수 없다. */
function isJson(response: Response): boolean {
  return response.headers.get("content-type")?.includes("application/json") ?? false;
}

/**
 * 엔드포인트가 없거나(정적 배포) 네트워크가 끊기면 null. 호출부는 배너를 그리지 않는다 —
 * 설치할 수단이 없는 곳에서 설치 버튼을 보여주는 게 더 나쁘다.
 */
export async function fetchBgmStatus(): Promise<BgmInstallStatus | null> {
  try {
    const response = await fetch(STATUS_URL, { headers: { Accept: "application/json" } });
    if (!response.ok || !isJson(response)) return null;
    return await response.json() as BgmInstallStatus;
  } catch { return null; }
}

async function errorFrom(response: Response): Promise<string> {
  if (!isJson(response)) return `BGM 설치 요청이 실패했습니다 (HTTP ${response.status}).`;
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" ? body.error : `BGM 설치 요청이 실패했습니다 (HTTP ${response.status}).`;
  } catch { return `BGM 설치 요청이 실패했습니다 (HTTP ${response.status}).`; }
}

export async function startBgmInstall(): Promise<{ readonly ok: boolean; readonly error: string | null }> {
  try {
    const response = await fetch(INSTALL_URL, { method: "POST", headers: { Accept: "application/json" } });
    if (!response.ok) return { ok: false, error: await errorFrom(response) };
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function cancelBgmInstall(): Promise<void> {
  try { await fetch(INSTALL_URL, { method: "DELETE", headers: { Accept: "application/json" } }); }
  catch { /* 취소 실패는 조용히 넘긴다 — 다음 폴링이 실제 상태를 다시 알려준다. */ }
}

/**
 * 설치 판정을 갱신한다. 설치가 끝난 순간에만 이벤트를 낸다 — 목록 재생성은
 * 진행 중에 반복할 이유가 없다.
 */
export function applyBgmStatus(status: BgmInstallStatus): void {
  setInstalledBgmFiles(status.installed);
  if (!status.installing) window.dispatchEvent(new CustomEvent(BGM_INSTALLED_EVENT, { detail: status }));
}

/** 설치가 끝날 때까지 폴링한다. 반환값을 부르면 중간에 그만둔다. */
export function watchBgmInstall(onStatus: (status: BgmInstallStatus) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async (): Promise<void> => {
    const status = await fetchBgmStatus();
    if (stopped) return;
    if (status === null) { stopped = true; return; }
    applyBgmStatus(status);
    onStatus(status);
    if (status.installing) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    else stopped = true;
  };
  void tick();
  return () => { stopped = true; if (timer !== undefined) clearTimeout(timer); };
}
