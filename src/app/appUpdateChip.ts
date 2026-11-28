// 앱 자동 업데이트 칩 및 수동 확인 컨트롤(렌더러).
// 메인은 electron/main/appUpdate.ts, 상태 모양은 electron/shared/appUpdate.ts.
//
// - 상단 칩(renderAppUpdateChip): 새 버전이 준비됐거나 내려받을 수 있을 때만 띄운다.
// - 수동 확인 컨트롤(renderAppUpdateControl) & 메뉴/명령(triggerAppUpdateCheck): 설정·도움말·메뉴·⌘K 에서
//   언제든지 최신 버전을 확인하고, 새 버전이 있으면 내려받기/재시작까지 바로 진행한다.
// 새 CSS 파일을 만들지 않는다 — 놓일 곳의 단추 클래스를 빌리고 강조색만 토큰 변수로 준다.
import {
  appUpdateButtonView,
  appUpdateChipText,
  shortVersion,
  type AppUpdateStatus,
} from "../../electron/shared/appUpdate";
import type { OprnUpdateBridge } from "@/project/persistence/electronRepository";
import { toast } from "@/util/toast";

export interface AppUpdateChipOptions {
  readonly className: string;
  /**
   * 다시 시작 전에 할 일 — 조수 대기와 저장. say 로 칩 글자를 바꾼다.
   * false 를 돌려주면(저장 실패) 다시 시작하지 않는다.
   */
  readonly beforeRestart?: (say: (text: string) => void) => Promise<boolean>;
}

export interface AppUpdateControlOptions {
  readonly buttonClassName?: string;
  readonly testIdPrefix?: string;
  readonly beforeRestart?: (say: (text: string) => void) => Promise<boolean>;
}

let latest: AppUpdateStatus | null = null;
let restartFlush: (() => Promise<boolean>) | null = null;
const listeners = new Set<(status: AppUpdateStatus) => void>();
let watching = false;
let installInFlight = false;

function bridge(): OprnUpdateBridge | null {
  return (typeof window !== "undefined" ? window.oprn?.update : undefined) ?? null;
}

function publish(status: AppUpdateStatus): void {
  latest = status;
  for (const listener of listeners) listener(status);
}

function watch(update: OprnUpdateBridge): void {
  if (watching) return;
  watching = true;
  update.onState((payload) => publish(payload as AppUpdateStatus));
  void update.status().then(publish, () => {});
  showAppUpdateWhatsNewOnce();
}

/** 편집기 문서가 창 닫기와 같은 저장(src/main.ts flushForClose)을 넘긴다. 시작 화면에는 저장할 것이 없다. */
export function provideAppUpdateRestartFlush(flush: () => Promise<boolean>): void {
  restartFlush = flush;
}

export function flushForAppUpdateRestart(): Promise<boolean> {
  return restartFlush ? restartFlush() : Promise.resolve(true);
}

async function runInstall(
  update: OprnUpdateBridge,
  beforeRestart: ((say: (text: string) => void) => Promise<boolean>) | undefined,
  say: (text: string) => void,
): Promise<void> {
  if (installInFlight) return;
  installInFlight = true;
  try {
    const ok = beforeRestart ? await beforeRestart(say) : true;
    if (!ok) throw new Error("저장하지 못해 다시 시작하지 않았어요. 저장 상태를 확인해 주세요.");
    say("다시 시작하는 중…");
    if (!(await update.install())) throw new Error("업데이트를 설치하지 못했어요.");
  } finally {
    installInFlight = false;
  }
}

export function appUpdateMenuLabel(): string {
  const state = latest?.state;
  if (!state) return "업데이트 확인";
  switch (state.kind) {
    case "ready": return `v${shortVersion(state.version)} 업데이트 · 다시 시작`;
    case "available": return `새 버전 v${shortVersion(state.version)} 내려받기`;
    case "downloading": return state.percent != null ? `업데이트 받는 중 (${Math.round(state.percent)}%)…` : "업데이트 받는 중…";
    case "checking": return "업데이트 확인 중…";
    default: return "업데이트 확인";
  }
}

/** 메뉴·⌘K 등에서 수동으로 업데이트를 확인하거나 준비된 업데이트를 바로 실행한다. */
export async function triggerAppUpdateCheck(options: {
  readonly beforeRestart?: (say: (text: string) => void) => Promise<boolean>;
} = {}): Promise<void> {
  const update = bridge();
  if (!update) {
    toast("웹 버전은 새로고침하면 최신 버전으로 열려요.", "ok");
    return;
  }
  watch(update);
  const current = latest ?? await update.status().catch(() => null);
  if (current) publish(current);
  const state = current?.state;
  if (state?.kind === "ready") {
    try {
      await runInstall(update, options.beforeRestart, (text) => toast(text, "ok"));
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "error");
    }
    return;
  }
  if (state?.kind === "available") {
    await update.openDownload();
    return;
  }
  if (state?.kind === "downloading") {
    toast(`v${shortVersion(state.version)} 을 내려받고 있어요.`, "ok");
    return;
  }
  if (state?.kind === "checking") {
    toast("이미 업데이트를 확인하고 있어요.", "ok");
    return;
  }
  toast("업데이트를 확인하고 있어요…", "ok");
  try {
    const next = await update.check();
    publish(next);
    switch (next.state.kind) {
      case "up-to-date":
        toast(`최신 버전이에요 (v${shortVersion(next.currentVersion)})`, "ok");
        break;
      case "downloading":
        toast(`새 버전 v${shortVersion(next.state.version)} 을 내려받고 있어요.`, "ok");
        break;
      case "ready":
        toast(`v${shortVersion(next.state.version)} 준비됨 · 다시 시작하면 바로 적용돼요.`, "ok");
        break;
      case "available":
        toast(`새 버전 v${shortVersion(next.state.version)} 이 있어요. 상단 단추에서 내려받으세요.`, "ok");
        break;
      case "error":
        toast(next.state.message, "error");
        break;
      default:
        break;
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : "업데이트를 확인하지 못했어요.", "error");
  }
}

export function renderAppUpdateChip(options: AppUpdateChipOptions): { readonly element: HTMLButtonElement; dispose(): void } | null {
  const update = bridge();
  if (!update) return null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = options.className;
  button.dataset.testid = "app-update-chip";
  button.hidden = true;
  button.style.color = "var(--accent)";
  button.style.fontWeight = "600";
  button.style.whiteSpace = "nowrap";
  let busy = false;

  const paint = (status: AppUpdateStatus): void => {
    if (busy) return;
    const text = status.enabled || status.state.kind === "ready" || status.state.kind === "available"
      ? appUpdateChipText(status.state)
      : null;
    button.hidden = text === null;
    // 빌린 단추 클래스(ln-btn·studio-tool-button)의 display 가 [hidden] 을 이겨, 숨긴 칩이 빈 파란 네모로 남았다(2026-11-26 실측).
    button.style.display = text === null ? "none" : "";
    button.textContent = text ?? "";
    button.title = status.state.kind === "ready"
      ? `저장하고 다시 시작하면 v${shortVersion(status.state.version)} 으로 바뀌어요. 그냥 두면 앱을 끌 때 바뀌어요.`
      : status.state.kind === "available" ? `v${shortVersion(status.state.version)} 을 내려받아요` : "";
    button.dataset.updateState = status.state.kind;
  };

  button.addEventListener("click", () => {
    const state = latest?.state;
    if (!state || busy) return;
    if (state.kind === "available") {
      void update.openDownload();
      return;
    }
    if (state.kind !== "ready") return;
    busy = true;
    button.disabled = true;
    const say = (text: string): void => { button.textContent = text; };
    void runInstall(update, options.beforeRestart, say).catch((error: unknown) => {
      busy = false;
      button.disabled = false;
      if (latest) paint(latest);
      toast(error instanceof Error ? error.message : String(error), "error");
    });
  });

  listeners.add(paint);
  if (latest) paint(latest);
  watch(update);
  return { element: button, dispose: () => { listeners.delete(paint); } };
}

/** 설정·도움말 등 상시 노출 영역의 「업데이트 확인」 단추 + 상태 문구. 데스크톱 앱에서만 그린다. */
export function renderAppUpdateControl(options: AppUpdateControlOptions = {}): { readonly element: HTMLElement; dispose(): void } | null {
  const update = bridge();
  if (!update) return null;
  const prefix = options.testIdPrefix ?? "app-update";
  const row = document.createElement("div");
  row.dataset.testid = `${prefix}-control`;
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "6px",
  });

  const button = document.createElement("button");
  button.type = "button";
  if (options.buttonClassName) {
    button.className = options.buttonClassName;
  } else {
    Object.assign(button.style, {
      padding: "5px 11px",
      borderRadius: "var(--radius-s, 6px)",
      border: "1px solid var(--border-default, rgba(127,127,127,0.35))",
      background: "var(--bg-raised, transparent)",
      color: "var(--text-1, inherit)",
      font: "600 12px/1.3 var(--font-ui, system-ui, sans-serif)",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
  }
  button.dataset.testid = `${prefix}-check-button`;
  button.textContent = "업데이트 확인";

  const detail = document.createElement("span");
  detail.dataset.testid = `${prefix}-status`;
  Object.assign(detail.style, {
    fontSize: "12px",
    color: "var(--text-2, inherit)",
  });

  row.append(button, detail);

  let busy = false;
  let currentAction: "check" | "install" | "download" | "none" = "check";

  const paint = (status: AppUpdateStatus): void => {
    if (busy) return;
    const view = appUpdateButtonView(status);
    currentAction = view.action;
    button.textContent = view.label;
    button.disabled = view.disabled;
    button.style.opacity = view.disabled ? "0.65" : "";
    button.style.cursor = view.disabled ? "default" : "pointer";
    if (!options.buttonClassName) {
      const highlight = view.action === "install" || view.action === "download";
      button.style.borderColor = highlight ? "var(--accent)" : "var(--border-default, rgba(127,127,127,0.35))";
      button.style.color = highlight ? "var(--accent)" : "var(--text-1, inherit)";
    }
    detail.textContent = view.detail;
    detail.style.color = status.state.kind === "error" ? "var(--danger, #dc2626)" : "var(--text-2, inherit)";
    row.dataset.updateState = status.state.kind;
  };

  button.addEventListener("click", () => {
    if (busy || button.disabled) return;
    if (currentAction === "download") {
      void update.openDownload();
      return;
    }
    if (currentAction === "install") {
      busy = true;
      button.disabled = true;
      const say = (text: string): void => {
        button.textContent = text;
        detail.textContent = text;
      };
      void runInstall(update, options.beforeRestart, say).catch((error: unknown) => {
        busy = false;
        button.disabled = false;
        if (latest) paint(latest);
        toast(error instanceof Error ? error.message : String(error), "error");
      });
      return;
    }
    if (currentAction === "check") {
      button.disabled = true;
      button.textContent = "확인 중…";
      detail.textContent = "최신 버전을 확인하고 있어요.";
      void update.check().then((next) => {
        publish(next);
      }, (error: unknown) => {
        const message = error instanceof Error ? error.message : "업데이트를 확인하지 못했어요.";
        detail.textContent = message;
        detail.style.color = "var(--danger, #dc2626)";
        button.disabled = false;
        button.textContent = "다시 확인";
      });
    }
  });

  listeners.add(paint);
  if (latest) paint(latest);
  watch(update);
  return { element: row, dispose: () => { listeners.delete(paint); } };
}

/** 업데이트 뒤 처음 켜졌으면 바뀐 점을 한 번 보인다. 메인이 한 번만 내주므로 두 문서가 불러도 한 번이다. */
export function showAppUpdateWhatsNewOnce(): void {
  const update = bridge();
  if (!update) return;
  void update.takeWhatsNew().then((news) => {
    if (!news) return;
    const head = `v${shortVersion(news.version)} 으로 업데이트했어요`;
    const message = news.lines.length > 0 ? `${head} · ${news.lines.join(" · ")}` : head;
    toast(message, { kind: "ok", durationMs: 9000 });
  }, () => {});
}
