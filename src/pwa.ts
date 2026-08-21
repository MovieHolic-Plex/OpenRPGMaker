const SERVICE_WORKER_URL = "/sw.js";
const ENABLE_PWA_SEARCH_PARAM = "enablePwa";

export function registerPwa(): void {
  if (!shouldRegisterPwa()) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener(
    "load",
    () => {
      void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" }).catch((error: unknown) => {
        console.warn("PWA service worker registration failed", error);
      });
    },
    { once: true },
  );
}

function shouldRegisterPwa(): boolean {
  return import.meta.env.PROD || new URLSearchParams(window.location.search).has(ENABLE_PWA_SEARCH_PARAM);
}
