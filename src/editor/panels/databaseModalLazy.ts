import type { DatabaseTab } from "@/editor/panels/database";
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { uiLabel } from "@/editor/uiCopy";
import { el } from "@/util/dom";

/**
 * 자료집 본문은 수 MB 편집 표면이다. 편집기 첫 화면 그래프에는 넣지 않는다.
 * 대신 편집기 메뉴가 올라오면 바로 미리 읽는다. 클릭 때는 이미 있는 본문을 연다.
 * 아직 못 읽었으면 창부터 띄우고, 실패는 삼키지 않는다.
 */

type DatabaseModalModule = typeof import("@/editor/panels/databaseModal");
type OpenOptions = { readonly onClose: () => void };
type OpenRequest = { readonly serial: number; readonly tab?: DatabaseTab; readonly options?: OpenOptions };

let modulePromise: Promise<DatabaseModalModule> | null = null;
let readyModule: DatabaseModalModule | null = null;
let prefetchScheduled = false;
let shell: HTMLElement | null = null;
let shellToken = 0;
let shellKeyListener: ((event: KeyboardEvent) => void) | null = null;
let requestSerial = 0;
let pending: OpenRequest | null = null;

function loadDatabaseModal(): Promise<DatabaseModalModule> {
  if (readyModule) return Promise.resolve(readyModule);
  if (!modulePromise) {
    modulePromise = import("@/editor/panels/databaseModal").then((mod) => {
      readyModule = mod;
      // 창을 여는 중이면 그 경로가 본문을 그린다. 아닐 때만 미리 그린다.
      if (!pending) mod.prewarmDatabaseModal();
      return mod;
    }).catch((error: unknown) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

function runningUnderTest(): boolean {
  const env = import.meta.env as { readonly VITEST?: boolean; readonly MODE?: string };
  return env.VITEST === true || env.MODE === "test";
}

/** 편집기 메뉴가 잡히면 바로 읽기 시작한다. idle 까지 미루면 클릭이 먼저다. */
export function scheduleDatabaseModalPrefetch(): void {
  if (prefetchScheduled || modulePromise || readyModule) return;
  if (runningUnderTest()) return;
  if (typeof window === "undefined") return;
  prefetchScheduled = true;
  const start = (): void => {
    void loadDatabaseModal().catch(() => {
      // 미리 읽기 실패는 클릭 때 다시 시도한다. loadDatabaseModal 이 약속을 비워 둔다.
    });
  };
  // 지금 프레임의 첫 그림은 넘기고, 그 다음부터는 기다리지 않는다.
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(start);
  else setTimeout(start, 0);
}

scheduleDatabaseModalPrefetch();

function databaseLabel(): string {
  return uiLabel("database");
}

function dismissShell(token: number): void {
  if (token !== shellToken) return;
  shellToken += 1;
  if (shellKeyListener) document.removeEventListener("keydown", shellKeyListener, true);
  shellKeyListener = null;
  shell?.remove();
  shell = null;
  pending = null;
}

function mountOpeningShell(): number {
  if (shell?.isConnected) return shellToken;
  const token = ++shellToken;
  const label = databaseLabel();
  const status = el("p", {
    text: "자료집을 여는 중…",
    dataset: { testid: "database-modal-opening-status" },
  });
  const close = el("button", {
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "database-modal-opening-close" },
    on: { click: () => dismissShell(token) },
  }) as HTMLButtonElement;
  const panel = el("section", {
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-busy": "true",
      "aria-label": label,
      style: [
        "background:#fff",
        "color:#0f172a",
        "border-radius:12px",
        "padding:28px 32px",
        "min-width:min(420px, calc(100vw - 48px))",
        "box-shadow:0 18px 50px rgba(15,23,42,.18)",
        "display:grid",
        "gap:12px",
        "justify-items:start",
      ].join(";"),
    },
    children: [
      el("h2", { text: label, attrs: { style: "margin:0;font-size:18px;font-weight:650" } }),
      status,
      close,
    ],
  });
  const backdrop = el("div", {
    attrs: {
      role: "presentation",
      style: "position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(24,22,18,.18);padding:16px",
    },
    dataset: { testid: "database-modal-opening" },
    children: [panel],
  });
  shellKeyListener = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || token !== shellToken) return;
    event.preventDefault();
    event.stopPropagation();
    dismissShell(token);
  };
  document.addEventListener("keydown", shellKeyListener, true);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) dismissShell(token);
  });
  document.body.append(backdrop);
  close.focus();
  shell = backdrop;
  return token;
}

function showOpeningFailure(token: number): void {
  if (token !== shellToken || !shell?.isConnected) return;
  const status = shell.querySelector<HTMLElement>("[data-testid='database-modal-opening-status']");
  if (status) status.textContent = "자료집을 열지 못했습니다. 다시 시도해 주세요.";
  const panel = shell.querySelector("section");
  if (!panel || panel.querySelector("[data-testid='database-modal-opening-retry']")) return;
  panel.setAttribute("aria-busy", "false");
  const request = pending;
  panel.append(el("button", {
    text: "다시 열기",
    attrs: { type: "button" },
    dataset: { testid: "database-modal-opening-retry" },
    on: {
      click: () => {
        dismissShell(token);
        openDatabaseModalLazy(request?.tab, request?.options);
      },
    },
  }));
}

function finishOpen(token: number, serial: number, mod: DatabaseModalModule): void {
  setTimeout(() => {
    const current = pending;
    if (!current || token !== shellToken || serial !== current.serial) return;
    try {
      mod.openDatabaseModal(current.tab, current.options);
      dismissShell(token);
    } catch {
      showOpeningFailure(token);
    }
  }, 0);
}

export function openDatabaseModalLazy(
  initialTab?: DatabaseTab,
  options?: OpenOptions,
): void {
  const serial = ++requestSerial;
  pending = { serial, tab: initialTab, options };
  void preloadRuntimeStyles();
  // 미리 읽어 둔 본문은 껍데기 없이 바로 연다.
  if (readyModule) {
    try {
      readyModule.openDatabaseModal(initialTab, options);
      pending = null;
    } catch {
      showOpeningFailure(mountOpeningShell());
    }
    return;
  }
  // 이미 열린 자료집은 본문만 갈아탄다. 여는 중 껍데기를 겹치지 않는다.
  if (document.querySelector("[data-testid='database-modal']")) {
    void loadDatabaseModal().then((mod) => {
      if (serial !== pending?.serial) return;
      mod.openDatabaseModal(initialTab, options);
      pending = null;
    }).catch(() => {
      showOpeningFailure(mountOpeningShell());
    });
    return;
  }
  const token = mountOpeningShell();
  void loadDatabaseModal().then((mod) => {
    finishOpen(token, serial, mod);
  }).catch(() => {
    showOpeningFailure(token);
  });
}
