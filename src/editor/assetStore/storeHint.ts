// 조수 실행 요청에 실을 스토어 정보(src/assetStore/storeAccess.ts). 데스크톱 다리가 없으면 싣지 않는다.
import { STORE_AUTO_INSTALL_KEY, type StoreRunHint } from "@/assetStore/storeAccess";
import { storeBridge } from "./storeBridge";

export function storeAutoInstallEnabled(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(STORE_AUTO_INSTALL_KEY) === "1"; } catch { return false; }
}

export function setStoreAutoInstall(on: boolean): void {
  try { localStorage.setItem(STORE_AUTO_INSTALL_KEY, on ? "1" : "0"); } catch { /* 저장소 없음 */ }
}

/** 스토어 주소를 2초 안에 못 받으면 싣지 않는다 — 조수 실행을 스토어 때문에 늦추지 않는다. */
export async function storeRunHint(): Promise<StoreRunHint | undefined> {
  const bridge = storeBridge();
  if (!bridge) return undefined;
  try {
    const status = await Promise.race([bridge.status(), new Promise<null>((done) => setTimeout(() => done(null), 2000))]);
    return status?.url ? { url: status.url, autoInstall: storeAutoInstallEnabled() } : undefined;
  } catch {
    return undefined;
  }
}
