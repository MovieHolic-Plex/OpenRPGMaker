// Vite 가 쪼갠 해시 청크(PlayScene-xxxx.js) 는 재배포 후 부모 번들이 옛 해시를
// 부르면 404 가 난다. `?t=` 캐시 버스트는 없는 파일을 살리지 못하므로, 새 HTML 을
// 받도록 페이지를 한 번만 새로고침한다. sessionStorage 표식이 있으면 루프를 멈춘다.
//
// Vite 공식 권고와 같은 사건: `window` 의 `vite:preloadError`.

export const STALE_MODULE_RELOAD_KEY = "oprn:stale-module-reload";

export type ModuleLoadRecoveryHooks = {
  readonly reload?: () => void;
  readonly storage?: Storage;
};

let installedListener: ((event: Event) => void) | null = null;

export function consumeStaleModuleReload(storage: Storage = defaultStorage()): boolean {
  return storage.getItem(STALE_MODULE_RELOAD_KEY) !== "1";
}

export function markStaleModuleReloaded(storage: Storage = defaultStorage()): void {
  storage.setItem(STALE_MODULE_RELOAD_KEY, "1");
}

export function clearStaleModuleReloadMark(storage: Storage = defaultStorage()): void {
  storage.removeItem(STALE_MODULE_RELOAD_KEY);
}

export function installVitePreloadRecovery(hooks: ModuleLoadRecoveryHooks = {}): void {
  if (typeof window === "undefined" || installedListener) return;
  const storage = hooks.storage ?? defaultStorage();
  const reload = hooks.reload ?? (() => window.location.reload());
  installedListener = (event: Event) => {
    if (!consumeStaleModuleReload(storage)) return;
    event.preventDefault();
    markStaleModuleReloaded(storage);
    reload();
  };
  window.addEventListener("vite:preloadError", installedListener);
}

export function uninstallVitePreloadRecoveryForTest(): void {
  if (typeof window !== "undefined" && installedListener) {
    window.removeEventListener("vite:preloadError", installedListener);
  }
  installedListener = null;
}

function defaultStorage(): Storage {
  return sessionStorage;
}
