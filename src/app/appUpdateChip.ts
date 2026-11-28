// 앱 자동 업데이트 아이콘 및 수동 확인 컨트롤(렌더러).
// 메인은 electron/main/appUpdate.ts, 상태 모양은 electron/shared/appUpdate.ts.
//
// - 상단 오른쪽 녹색 아이콘(renderAppUpdateChip): 새 버전이 있거나 내려받는 중·준비됐을 때만 띄운다.
// - 수동 확인 컨트롤(renderAppUpdateControl) & 메뉴/명령(triggerAppUpdateCheck): 설정·도움말·메뉴·⌘K 에서
//   언제든지 최신 버전을 확인하고, 새 버전이 있으면 내려받기/재시작까지 바로 진행한다.
// 새 CSS 파일을 만들지 않는다 — 놓일 곳의 단추 클래스를 빌리고 녹색 상태 토큰 변수로 그린다.
import {
  appUpdateButtonView,
  appUpdateIndicatorView,
  shortVersion,
  type AppUpdateIndicatorView,
  type AppUpdateStatus,
} from "../../electron/shared/appUpdate";
import { attachDelayedTooltip, hideDelayedTooltip } from "@/editor/delayedTooltip";
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
let activeInstallPromise: Promise<void> | null = null;

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

function runInstall(
  update: OprnUpdateBridge,
  beforeRestart: ((say: (text: string) => void) => Promise<boolean>) | undefined,
  say: (text: string) => void,
): { readonly promise: Promise<void>; readonly joined: boolean } {
  if (activeInstallPromise) {
    return { promise: activeInstallPromise, joined: true };
  }
  const task = (async () => {
    const ok = beforeRestart ? await beforeRestart(say) : true;
    if (!ok) throw new Error("저장하지 못해 다시 시작하지 않았어요. 저장 상태를 확인해 주세요.");
    say("다시 시작하는 중…");
    if (!(await update.install())) throw new Error("업데이트를 설치하지 못했어요.");
  })().finally(() => {
    if (activeInstallPromise === task) activeInstallPromise = null;
  });
  activeInstallPromise = task;
  return { promise: task, joined: false };
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
    const { promise, joined } = runInstall(update, options.beforeRestart, (text) => toast(text, "ok"));
    try {
      await promise;
    } catch (error) {
      if (!joined) toast(error instanceof Error ? error.message : String(error), "error");
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
        toast(`v${shortVersion(next.state.version)} 준비됨 · 오른쪽 상단 녹색 아이콘을 눌러 다시 시작할 수 있어요.`, "ok");
        break;
      case "available":
        toast(`새 버전 v${shortVersion(next.state.version)} 이 있어요. 오른쪽 상단 녹색 아이콘에서 내려받으세요.`, "ok");
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

const SVG_NS = "http://www.w3.org/2000/svg";
const UPDATE_BADGE_BG = "color-mix(in srgb, var(--success, #18764F) 65%, var(--success-indicator, #34C759))";

function buildUpdateIconSvg(kind: AppUpdateIndicatorView["kind"]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  Object.assign(svg.style, {
    display: "block",
    width: "14px",
    height: "14px",
    pointerEvents: "none",
  });
  const paths = kind === "ready"
    ? ["M8 11.2V3.3", "M4.6 6.7 8 3.3l3.4 3.4", "M3.8 13h8.4"]
    : ["M8 3v7.2", "M4.6 6.8 8 10.2l3.4-3.4", "M3.8 13h8.4"];
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export function renderAppUpdateChip(options: AppUpdateChipOptions): { readonly element: HTMLButtonElement; dispose(): void } | null {
  const updateBridge = bridge();
  if (!updateBridge) return null;
  const update: OprnUpdateBridge = updateBridge;
  const button = document.createElement("button");
  button.type = "button";
  if (options.className) button.className = options.className;
  button.dataset.testid = "app-update-chip";
  button.dataset.delayedTooltipAttached = "1";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.hidden = true;
  Object.assign(button.style, {
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    width: "32px",
    minWidth: "32px",
    height: "32px",
    minHeight: "32px",
    padding: "0",
    margin: "0",
    border: "0",
    borderRadius: "var(--radius-2, 6px)",
    ...(options.className ? {} : { background: "transparent" }),
    cursor: "pointer",
    position: "relative",
    boxSizing: "border-box",
  });

  const badge = document.createElement("span");
  badge.setAttribute("aria-hidden", "true");
  Object.assign(badge.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "var(--radius-pill, 999px)",
    boxSizing: "border-box",
    transition: "transform var(--transition-fast, 120ms ease), box-shadow var(--transition-fast, 120ms ease), opacity var(--transition-fast, 120ms ease)",
    pointerEvents: "none",
  });
  button.append(badge);

  let busy = false;
  let busyStatusText = "";
  let hovered = false;
  let currentView: AppUpdateIndicatorView | null = null;
  let currentStatus: AppUpdateStatus | null = null;
  let currentTooltip = "";
  let renderedIconKind: AppUpdateIndicatorView["kind"] | null = null;
  let popover: HTMLDivElement | null = null;

  const syncBadgeStyle = (): void => {
    if (!currentView) return;
    if (currentView.kind === "downloading") {
      badge.style.background = "var(--success-muted, rgba(24, 118, 79, 0.13))";
      badge.style.border = `1.5px solid ${UPDATE_BADGE_BG}`;
      badge.style.color = UPDATE_BADGE_BG;
      badge.style.boxShadow = hovered
        ? "0 0 0 3px var(--success-muted, rgba(24, 118, 79, 0.13))"
        : "none";
    } else {
      badge.style.background = UPDATE_BADGE_BG;
      badge.style.border = "0";
      badge.style.color = "var(--on-accent, #ffffff)";
      badge.style.boxShadow = hovered
        ? "0 0 0 4px var(--success-muted, rgba(24, 118, 79, 0.13))"
        : "0 0 0 2px var(--success-muted, rgba(24, 118, 79, 0.13))";
    }
    badge.style.transform = hovered && !busy ? "scale(1.06)" : "";
    badge.style.opacity = busy ? "0.65" : "";
  };

  const setHovered = (next: boolean): void => {
    hovered = next;
    syncBadgeStyle();
  };
  button.addEventListener("pointerenter", () => setHovered(true));
  button.addEventListener("pointerleave", () => setHovered(false));
  button.addEventListener("focus", () => setHovered(true));
  button.addEventListener("blur", () => setHovered(false));

  const disposeTooltip = attachDelayedTooltip(button, {
    get label() { return currentTooltip; },
  });

  const positionPopover = (): void => {
    if (!popover) return;
    const rect = button.getBoundingClientRect();
    const top = Math.max(12, Math.round(rect.bottom + 8));
    const right = Math.max(12, Math.round(window.innerWidth - rect.right));
    popover.style.top = `${top}px`;
    popover.style.right = `${right}px`;
  };

  const onOutsidePointerDown = (event: PointerEvent): void => {
    if (busy || !popover) return;
    const target = event.target as Node | null;
    if (target && (popover.contains(target) || button.contains(target))) return;
    closePopover();
  };

  const onPopoverKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || busy || !popover) return;
    event.preventDefault();
    event.stopPropagation();
    closePopover();
    button.focus();
  };

  function closePopover(): void {
    if (!popover) return;
    popover.remove();
    popover = null;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    document.removeEventListener("keydown", onPopoverKeyDown, true);
    window.removeEventListener("resize", positionPopover);
  }

  const startInstallFromPopover = (): void => {
    if (busy || currentView?.action !== "install") return;
    busy = true;
    busyStatusText = "업데이트를 준비하고 있어요…";
    button.disabled = true;
    syncBadgeStyle();
    renderPopoverContents();
    const say = (text: string): void => {
      busyStatusText = text;
      currentTooltip = text;
      button.title = text;
      button.setAttribute("aria-label", text);
      renderPopoverContents();
    };
    const { promise, joined } = runInstall(update, options.beforeRestart, say);
    void promise.catch((error: unknown) => {
      busy = false;
      busyStatusText = "";
      button.disabled = false;
      if (latest) paint(latest);
      else {
        syncBadgeStyle();
        renderPopoverContents();
      }
      if (!joined) toast(error instanceof Error ? error.message : String(error), "error");
    });
  };

  function renderPopoverContents(): void {
    if (!popover || !currentView) return;
    const view = currentView;
    const currentVer = currentStatus?.currentVersion ? shortVersion(currentStatus.currentVersion) : null;
    popover.replaceChildren();

    // 머리줄 — 아이콘 · 버전 제목 · 닫기
    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
      marginBottom: "10px",
    });

    const headLeft = document.createElement("div");
    Object.assign(headLeft.style, { display: "flex", alignItems: "center", gap: "9px", minWidth: "0" });

    const headIcon = document.createElement("span");
    headIcon.setAttribute("aria-hidden", "true");
    Object.assign(headIcon.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "26px",
      height: "26px",
      borderRadius: "var(--radius-pill, 999px)",
      flex: "0 0 auto",
      ...(view.kind === "downloading"
        ? {
            background: "var(--success-muted, rgba(24, 118, 79, 0.13))",
            border: `1.5px solid ${UPDATE_BADGE_BG}`,
            color: UPDATE_BADGE_BG,
          }
        : {
            background: UPDATE_BADGE_BG,
            color: "var(--on-accent, #ffffff)",
          }),
    });
    headIcon.append(buildUpdateIconSvg(view.kind));

    const titleWrap = document.createElement("div");
    Object.assign(titleWrap.style, { minWidth: "0" });
    const title = document.createElement("div");
    title.textContent = view.kind === "downloading"
      ? `v${view.version} 내려받는 중`
      : `v${view.version} 업데이트`;
    Object.assign(title.style, {
      fontSize: "13.5px",
      fontWeight: "600",
      lineHeight: "1.25",
      color: "var(--text-1, inherit)",
    });
    titleWrap.append(title);

    if (currentVer) {
      const sub = document.createElement("div");
      sub.textContent = `v${currentVer} → v${view.version}`;
      Object.assign(sub.style, {
        fontSize: "11.5px",
        color: "var(--text-3, inherit)",
        marginTop: "2px",
      });
      titleWrap.append(sub);
    }
    headLeft.append(headIcon, titleWrap);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.dataset.testid = "app-update-popover-close";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.textContent = "×";
    closeBtn.disabled = busy;
    Object.assign(closeBtn.style, {
      width: "26px",
      height: "26px",
      padding: "0",
      border: "0",
      borderRadius: "var(--radius-2, 6px)",
      background: "transparent",
      color: "var(--text-3, inherit)",
      fontSize: "17px",
      lineHeight: "1",
      cursor: busy ? "default" : "pointer",
      opacity: busy ? "0.45" : "",
      flex: "0 0 auto",
    });
    closeBtn.addEventListener("click", () => { if (!busy) closePopover(); });
    head.append(headLeft, closeBtn);
    popover.append(head);

    // 다운로드 진행 막대
    if (view.kind === "downloading") {
      const progWrap = document.createElement("div");
      Object.assign(progWrap.style, { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" });
      const track = document.createElement("div");
      Object.assign(track.style, {
        flex: "1 1 auto",
        height: "6px",
        borderRadius: "var(--radius-pill, 999px)",
        background: "var(--bg-inset, rgba(127, 127, 127, 0.2))",
        overflow: "hidden",
      });
      const fill = document.createElement("div");
      const pct = view.percent ?? 15;
      Object.assign(fill.style, {
        width: `${pct}%`,
        height: "100%",
        borderRadius: "var(--radius-pill, 999px)",
        background: UPDATE_BADGE_BG,
        transition: "width var(--transition-med, 160ms ease)",
      });
      track.append(fill);
      const pctText = document.createElement("span");
      pctText.textContent = view.percent !== null ? `${view.percent}%` : "…";
      Object.assign(pctText.style, {
        fontSize: "11.5px",
        fontWeight: "600",
        color: "var(--text-2, inherit)",
        flex: "0 0 auto",
      });
      progWrap.append(track, pctText);
      popover.append(progWrap);
    }

    // 변경 내역 영역
    const bodyBox = document.createElement("div");
    Object.assign(bodyBox.style, {
      padding: "10px 12px",
      borderRadius: "var(--radius-2, 6px)",
      background: "var(--bg-surface, rgba(127, 127, 127, 0.06))",
      border: "1px solid var(--border-subtle, rgba(127, 127, 127, 0.14))",
      marginBottom: "12px",
    });

    const notesHead = document.createElement("div");
    notesHead.textContent = "주요 변경 사항";
    Object.assign(notesHead.style, {
      fontSize: "11.5px",
      fontWeight: "600",
      color: "var(--text-2, inherit)",
      marginBottom: "6px",
    });
    bodyBox.append(notesHead);

    if (view.notes.length > 0) {
      const list = document.createElement("ul");
      list.dataset.testid = "app-update-popover-notes";
      Object.assign(list.style, {
        margin: "0",
        padding: "0",
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        maxHeight: "180px",
        overflowY: "auto",
      });
      for (const line of view.notes) {
        const item = document.createElement("li");
        Object.assign(item.style, {
          display: "flex",
          alignItems: "flex-start",
          gap: "7px",
          fontSize: "12.5px",
          lineHeight: "1.42",
          color: "var(--text-1, inherit)",
          wordBreak: "keep-all",
        });
        const dot = document.createElement("span");
        dot.setAttribute("aria-hidden", "true");
        Object.assign(dot.style, {
          width: "5px",
          height: "5px",
          borderRadius: "var(--radius-pill, 999px)",
          background: UPDATE_BADGE_BG,
          marginTop: "6px",
          flex: "0 0 auto",
        });
        const textSpan = document.createElement("span");
        textSpan.textContent = line;
        item.append(dot, textSpan);
        list.append(item);
      }
      bodyBox.append(list);
    } else {
      const empty = document.createElement("p");
      empty.dataset.testid = "app-update-popover-empty";
      empty.textContent = "요약된 변경 내역이 없어요. 아래 링크에서 전체 릴리스 노트를 볼 수 있어요.";
      Object.assign(empty.style, {
        margin: "0",
        fontSize: "12px",
        lineHeight: "1.45",
        color: "var(--text-2, inherit)",
      });
      bodyBox.append(empty);
    }

    const releaseLink = document.createElement("button");
    releaseLink.type = "button";
    releaseLink.dataset.testid = "app-update-popover-release-link";
    releaseLink.textContent = "전체 릴리스 노트 보기 ↗";
    Object.assign(releaseLink.style, {
      marginTop: "8px",
      padding: "0",
      border: "0",
      background: "transparent",
      color: "var(--accent, #1F6FC5)",
      fontSize: "12px",
      fontWeight: "500",
      cursor: "pointer",
      textAlign: "left",
    });
    releaseLink.addEventListener("click", () => {
      window.open(view.releaseUrl, "_blank", "noopener");
    });
    bodyBox.append(releaseLink);
    popover.append(bodyBox);

    if (busy && busyStatusText) {
      const statusLine = document.createElement("div");
      statusLine.textContent = busyStatusText;
      Object.assign(statusLine.style, {
        fontSize: "12px",
        fontWeight: "500",
        color: "var(--success, #18764F)",
        marginBottom: "10px",
      });
      popover.append(statusLine);
    }

    // 하단 행동 줄
    const foot = document.createElement("div");
    Object.assign(foot.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    });

    const hint = document.createElement("span");
    hint.textContent = view.kind === "ready" ? "앱을 끌 때도 자동 적용" : "";
    Object.assign(hint.style, {
      fontSize: "11.5px",
      color: "var(--text-3, inherit)",
    });

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" });

    const laterBtn = document.createElement("button");
    laterBtn.type = "button";
    laterBtn.textContent = view.kind === "ready" ? "나중에" : "닫기";
    laterBtn.disabled = busy;
    Object.assign(laterBtn.style, {
      height: "30px",
      padding: "0 11px",
      borderRadius: "var(--radius-2, 6px)",
      border: "1px solid var(--border-default, rgba(127, 127, 127, 0.3))",
      background: "transparent",
      color: "var(--text-2, inherit)",
      font: "500 12px/1 var(--font-ui, system-ui, sans-serif)",
      cursor: busy ? "default" : "pointer",
      opacity: busy ? "0.5" : "",
      whiteSpace: "nowrap",
    });
    laterBtn.addEventListener("click", () => { if (!busy) closePopover(); });
    actions.append(laterBtn);

    const primaryBtn = document.createElement("button");
    primaryBtn.type = "button";
    primaryBtn.dataset.testid = "app-update-popover-action";
    const isDownloading = view.kind === "downloading";
    primaryBtn.disabled = busy || isDownloading;
    primaryBtn.textContent = busy
      ? "적용 중…"
      : view.kind === "ready"
        ? "저장 후 다시 시작"
        : view.kind === "available"
          ? "새 버전 내려받기"
          : view.percent !== null ? `내려받는 중 ${view.percent}%` : "내려받는 중…";
    Object.assign(primaryBtn.style, {
      height: "30px",
      padding: "0 12px",
      borderRadius: "var(--radius-2, 6px)",
      border: "0",
      background: isDownloading ? "var(--bg-inset, rgba(127, 127, 127, 0.2))" : UPDATE_BADGE_BG,
      color: isDownloading ? "var(--text-3, inherit)" : "var(--on-accent, #ffffff)",
      font: "600 12px/1 var(--font-ui, system-ui, sans-serif)",
      cursor: busy || isDownloading ? "default" : "pointer",
      opacity: busy ? "0.65" : "",
      whiteSpace: "nowrap",
    });
    primaryBtn.addEventListener("click", () => {
      if (busy) return;
      if (view.action === "install") {
        startInstallFromPopover();
        return;
      }
      if (view.action === "download") {
        closePopover();
        void update.openDownload();
      }
    });
    actions.append(primaryBtn);

    foot.append(hint, actions);
    popover.append(foot);
  }

  function openPopover(): void {
    if (!currentView || popover) return;
    hideDelayedTooltip();
    const box = document.createElement("div");
    box.dataset.testid = "app-update-popover";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "새 버전 업데이트");
    Object.assign(box.style, {
      position: "fixed",
      zIndex: "var(--z-popover-top, 1201)",
      width: "min(344px, calc(100vw - 24px))",
      padding: "14px 16px",
      borderRadius: "var(--radius-3, 10px)",
      border: "1px solid var(--border-default, rgba(55, 53, 47, 0.16))",
      background: "var(--bg-overlay, #ffffff)",
      color: "var(--text-1, #1F1F1E)",
      boxShadow: "var(--shadow-pop, 0 4px 12px rgba(15, 15, 15, 0.08), 0 12px 32px rgba(15, 15, 15, 0.10))",
      font: "400 13px/1.45 var(--font-ui, system-ui, sans-serif)",
      textAlign: "left",
      boxSizing: "border-box",
    });
    box.style.setProperty("-webkit-app-region", "no-drag");
    popover = box;
    renderPopoverContents();
    document.body.append(box);
    positionPopover();
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    document.addEventListener("keydown", onPopoverKeyDown, true);
    window.addEventListener("resize", positionPopover);
  }

  const paint = (status: AppUpdateStatus): void => {
    currentStatus = status;
    if (busy) return;
    const view = appUpdateIndicatorView(status.state);
    currentView = view;
    const visible = view !== null;
    button.hidden = !visible;
    // 빌린 단추 클래스의 display 가 [hidden] 을 이겨 빈 칸으로 남지 않게 명시적으로 제어한다.
    button.style.display = visible ? "inline-flex" : "none";
    button.dataset.updateState = status.state.kind;
    if (!view) {
      closePopover();
      currentTooltip = "";
      button.title = "";
      button.removeAttribute("aria-label");
      return;
    }
    currentTooltip = view.tooltip;
    button.title = view.tooltip;
    button.setAttribute("aria-label", view.label);
    if (renderedIconKind !== view.kind) {
      badge.replaceChildren(buildUpdateIconSvg(view.kind));
      renderedIconKind = view.kind;
    }
    syncBadgeStyle();
    if (popover) renderPopoverContents();
  };

  button.addEventListener("click", () => {
    if (!currentView) return;
    if (popover) {
      if (!busy) closePopover();
      return;
    }
    openPopover();
  });

  listeners.add(paint);
  if (latest) paint(latest);
  watch(update);
  return {
    element: button,
    dispose: () => {
      closePopover();
      listeners.delete(paint);
      disposeTooltip();
    },
  };
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
      const { promise, joined } = runInstall(update, options.beforeRestart, say);
      void promise.catch((error: unknown) => {
        busy = false;
        button.disabled = false;
        if (latest) paint(latest);
        if (!joined) toast(error instanceof Error ? error.message : String(error), "error");
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
