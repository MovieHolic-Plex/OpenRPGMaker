// 조수 실행 요청에 실을 스토어 정보(src/assetStore/storeAccess.ts).
// 데스크톱 다리가 있으면 설정된 주소를 쓰고, 웹 브라우저 실행에서는 공개 스토어 주소를 넘겨 워커(Bun)가 공개 음악·에셋을 읽을 수 있게 한다.
import { STORE_AUTO_INSTALL_KEY, type StoreRunHint } from "@/assetStore/storeAccess";
import { storeBridge } from "./storeBridge";

const DEFAULT_PUBLIC_STORE_URL = "https://store.openrpgmaker.com";

function fallbackBrowserStoreUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const proto = window.location?.protocol;
  if (proto !== "http:" && proto !== "https:") return undefined;
  let envUrl: string | undefined;
  try {
    envUrl = import.meta.env.VITE_STORE_URL?.trim();
  } catch {
    envUrl = undefined;
  }
  if (envUrl && /^(off|none|false|0)$/iu.test(envUrl)) return undefined;
  return envUrl && /^https?:\/\/[^\s]+$/u.test(envUrl) ? envUrl.replace(/\/+$/u, "") : DEFAULT_PUBLIC_STORE_URL;
}

/** 기본은 켜짐 — 사용자가 음악을 청하면 조수가 찾아 넣고 잇는다. 「넣기 전에 먼저 묻기」를 켠 사용자만 "0". */
export function storeAutoInstallEnabled(): boolean {
  try { return typeof localStorage === "undefined" || localStorage.getItem(STORE_AUTO_INSTALL_KEY) !== "0"; } catch { return true; }
}

export function setStoreAutoInstall(on: boolean): void {
  try { localStorage.setItem(STORE_AUTO_INSTALL_KEY, on ? "1" : "0"); } catch { /* 저장소 없음 */ }
}

/** 스토어 주소를 2초 안에 못 받으면 싣지 않는다 — 조수 실행을 스토어 때문에 늦추지 않는다. */
export async function storeRunHint(): Promise<StoreRunHint | undefined> {
  const bridge = storeBridge();
  if (!bridge) {
    const url = fallbackBrowserStoreUrl();
    return url ? { url, autoInstall: storeAutoInstallEnabled() } : undefined;
  }
  try {
    const status = await Promise.race([bridge.status(), new Promise<null>((done) => setTimeout(() => done(null), 2000))]);
    return status?.url ? { url: status.url, autoInstall: storeAutoInstallEnabled() } : undefined;
  } catch {
    return undefined;
  }
}
