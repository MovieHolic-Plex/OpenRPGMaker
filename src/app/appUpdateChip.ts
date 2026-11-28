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
  releasePageUrl,
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

function buildUpdateIconSvg(kind: AppUpdateIndicatorView["kind"] | "check", sizePx = 16): SVGSVGElement {
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
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    pointerEvents: "none",
  });
  const paths = kind === "check"
    ? ["M3.5 8.5 6.6 11.6 12.6 4.8"]
    : kind === "ready"
      ? ["M8 11.2V3.3", "M4.6 6.7 8 3.3l3.4 3.4", "M3.8 13h8.4"]
      : ["M8 3v7.2", "M4.6 6.8 8 10.2l3.4-3.4", "M3.8 13h8.4"];
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function buildUpdateNoteListItem(line: string): HTMLLIElement {
  const item = document.createElement("li");
  Object.assign(item.style, {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "14.5px",
    lineHeight: "1.6",
    color: "var(--text-1, inherit)",
    wordBreak: "keep-all",
  });
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    width: "7px",
    height: "7px",
    borderRadius: "var(--radius-pill, 999px)",
    background: UPDATE_BADGE_BG,
    marginTop: "8px",
    flex: "0 0 auto",
  });
  const textSpan = document.createElement("span");
  textSpan.textContent = line;
  item.append(dot, textSpan);
  return item;
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
    width: "36px",
    minWidth: "36px",
    height: "36px",
    minHeight: "36px",
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
    width: "28px",
    height: "28px",
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
  type DialogRefs = {
    readonly backdrop: HTMLDivElement;
    readonly box: HTMLDivElement;
    readonly headIcon: HTMLSpanElement;
    readonly title: HTMLDivElement;
    readonly sub: HTMLSpanElement;
    readonly closeBtn: HTMLButtonElement;
    readonly progWrap: HTMLDivElement;
    readonly progFill: HTMLDivElement;
    readonly progPct: HTMLSpanElement;
    readonly notesList: HTMLUListElement;
    readonly notesEmpty: HTMLParagraphElement;
    readonly releaseLink: HTMLButtonElement;
    readonly statusLine: HTMLDivElement;
    readonly hint: HTMLSpanElement;
    readonly laterBtn: HTMLButtonElement;
    readonly primaryBtn: HTMLButtonElement;
    iconKind: AppUpdateIndicatorView["kind"] | null;
    notesKey: string | null;
  };
  let dialog: DialogRefs | null = null;

  const syncBadgeStyle = (): void => {
    if (!currentView) return;
    if (currentView.kind === "downloading") {
      badge.style.background = "var(--success-muted, rgba(24, 118, 79, 0.13))";
      badge.style.border = `1.75px solid ${UPDATE_BADGE_BG}`;
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

  const onDialogKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || busy || !dialog) return;
    event.preventDefault();
    event.stopPropagation();
    closeDialog(true);
  };

  function closeDialog(restoreFocus = false): void {
    if (!dialog) return;
    const hadFocusInside = dialog.backdrop.contains(document.activeElement);
    dialog.backdrop.remove();
    dialog = null;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onDialogKeyDown, true);
    if ((restoreFocus || hadFocusInside) && button.isConnected && !button.hidden) {
      button.focus();
    }
  }

  const startInstallFromDialog = (): void => {
    if (busy || currentView?.action !== "install") return;
    busy = true;
    busyStatusText = "업데이트를 준비하고 있어요…";
    button.disabled = true;
    syncBadgeStyle();
    syncDialogContents();
    const say = (text: string): void => {
      busyStatusText = text;
      currentTooltip = text;
      button.title = text;
      button.setAttribute("aria-label", text);
      syncDialogContents();
    };
    const { promise, joined } = runInstall(update, options.beforeRestart, say);
    void promise.catch((error: unknown) => {
      busy = false;
      busyStatusText = "";
      button.disabled = false;
      if (latest) paint(latest);
      else {
        syncBadgeStyle();
        syncDialogContents();
      }
      if (!joined) toast(error instanceof Error ? error.message : String(error), "error");
    });
  };

  function syncDialogContents(): void {
    if (!dialog || !currentView) return;
    const refs = dialog;
    const view = currentView;
    const currentVer = currentStatus?.currentVersion ? shortVersion(currentStatus.currentVersion) : null;
    const isDownloading = view.kind === "downloading";

    if (refs.iconKind !== view.kind) {
      refs.headIcon.replaceChildren(buildUpdateIconSvg(view.kind, 22));
      refs.iconKind = view.kind;
    }
    if (isDownloading) {
      refs.headIcon.style.background = "var(--success-muted, rgba(24, 118, 79, 0.13))";
      refs.headIcon.style.border = `2px solid ${UPDATE_BADGE_BG}`;
      refs.headIcon.style.color = UPDATE_BADGE_BG;
    } else {
      refs.headIcon.style.background = UPDATE_BADGE_BG;
      refs.headIcon.style.border = "0";
      refs.headIcon.style.color = "var(--on-accent, #ffffff)";
    }
    refs.title.textContent = isDownloading
      ? `v${view.version} 내려받는 중`
      : `v${view.version} 업데이트`;
    refs.sub.style.display = currentVer ? "inline-flex" : "none";
    refs.sub.textContent = currentVer ? `v${currentVer} → v${view.version}` : "";

    refs.closeBtn.disabled = busy;
    refs.closeBtn.style.cursor = busy ? "default" : "pointer";
    refs.closeBtn.style.opacity = busy ? "0.45" : "";

    refs.progWrap.style.display = isDownloading ? "flex" : "none";
    if (isDownloading) {
      refs.progFill.style.width = `${view.percent ?? 15}%`;
      refs.progPct.textContent = view.percent !== null ? `${view.percent}%` : "…";
    }

    // 변경 사항 목록은 내용이 바뀔 때만 갱신해 스크롤 위치와 포커스를 지킨다.
    const nextNotesKey = view.notes.join("\n");
    if (refs.notesKey !== nextNotesKey) {
      refs.notesKey = nextNotesKey;
      const prevScrollTop = refs.notesList.scrollTop;
      if (view.notes.length > 0) {
        refs.notesList.style.display = "flex";
        refs.notesEmpty.style.display = "none";
        refs.notesList.replaceChildren(...view.notes.map(buildUpdateNoteListItem));
        refs.notesList.scrollTop = prevScrollTop;
      } else {
        refs.notesList.style.display = "none";
        refs.notesList.replaceChildren();
        refs.notesEmpty.style.display = "block";
      }
    }

    refs.statusLine.style.display = busy && busyStatusText ? "block" : "none";
    refs.statusLine.textContent = busyStatusText;

    refs.hint.textContent = view.kind === "ready" ? "앱을 끌 때도 자동으로 적용돼요" : "";

    refs.laterBtn.textContent = view.kind === "ready" ? "나중에" : "닫기";
    refs.laterBtn.disabled = busy;
    refs.laterBtn.style.cursor = busy ? "default" : "pointer";
    refs.laterBtn.style.opacity = busy ? "0.5" : "";

    refs.primaryBtn.disabled = busy || isDownloading;
    refs.primaryBtn.textContent = busy
      ? "적용 중…"
      : view.kind === "ready"
        ? "저장 후 다시 시작"
        : view.kind === "available"
          ? "새 버전 내려받기"
          : view.percent !== null ? `내려받는 중 ${view.percent}%` : "내려받는 중…";
    refs.primaryBtn.style.background = isDownloading ? "var(--bg-inset, rgba(127, 127, 127, 0.2))" : UPDATE_BADGE_BG;
    refs.primaryBtn.style.color = isDownloading ? "var(--text-3, inherit)" : "var(--on-accent, #ffffff)";
    refs.primaryBtn.style.cursor = busy || isDownloading ? "default" : "pointer";
    refs.primaryBtn.style.opacity = busy ? "0.65" : "";
  }

  function openDialog(): void {
    if (!currentView || dialog) return;
    hideDelayedTooltip();

    const backdrop = document.createElement("div");
    backdrop.dataset.testid = "app-update-backdrop";
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      zIndex: "var(--z-app-modal, 2600)",
      display: "grid",
      placeItems: "center",
      padding: "24px",
      background: "var(--bg-scrim, rgba(15, 15, 15, 0.45))",
      backdropFilter: "blur(2px)",
      boxSizing: "border-box",
    });
    backdrop.style.setProperty("-webkit-app-region", "no-drag");
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop && !busy) closeDialog(true);
    });

    const box = document.createElement("div");
    box.dataset.testid = "app-update-popover";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "새 버전 업데이트");
    Object.assign(box.style, {
      width: "min(560px, calc(100vw - 48px))",
      maxHeight: "min(640px, calc(100vh - 64px))",
      display: "flex",
      flexDirection: "column",
      padding: "24px 28px",
      borderRadius: "var(--radius-4, 14px)",
      border: "1px solid var(--border-default, rgba(55, 53, 47, 0.16))",
      background: "var(--bg-overlay, #ffffff)",
      color: "var(--text-1, #1F1F1E)",
      boxShadow: "var(--shadow-modal, 0 8px 24px rgba(15, 15, 15, 0.12), 0 24px 64px rgba(15, 15, 15, 0.18))",
      font: "400 14.5px/1.55 var(--font-ui, system-ui, sans-serif)",
      textAlign: "left",
      boxSizing: "border-box",
      overflow: "hidden",
    });
    box.style.setProperty("-webkit-app-region", "no-drag");

    // 머리줄
    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "14px",
      marginBottom: "18px",
      flex: "0 0 auto",
    });
    const headLeft = document.createElement("div");
    Object.assign(headLeft.style, { display: "flex", alignItems: "center", gap: "14px", minWidth: "0" });

    const headIcon = document.createElement("span");
    headIcon.setAttribute("aria-hidden", "true");
    Object.assign(headIcon.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "42px",
      height: "42px",
      borderRadius: "var(--radius-pill, 999px)",
      flex: "0 0 auto",
      boxSizing: "border-box",
    });

    const titleWrap = document.createElement("div");
    Object.assign(titleWrap.style, { minWidth: "0", display: "flex", flexDirection: "column", gap: "5px" });
    const title = document.createElement("div");
    Object.assign(title.style, {
      fontSize: "19px",
      fontWeight: "700",
      lineHeight: "1.25",
      letterSpacing: "-0.01em",
      color: "var(--text-1, inherit)",
    });
    const sub = document.createElement("span");
    Object.assign(sub.style, {
      alignSelf: "flex-start",
      padding: "2px 9px",
      borderRadius: "var(--radius-pill, 999px)",
      background: "var(--bg-inset, rgba(127, 127, 127, 0.12))",
      color: "var(--text-2, inherit)",
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "12.5px",
      fontWeight: "500",
      lineHeight: "1.35",
    });
    titleWrap.append(title, sub);
    headLeft.append(headIcon, titleWrap);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.dataset.testid = "app-update-popover-close";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      width: "34px",
      height: "34px",
      padding: "0",
      border: "0",
      borderRadius: "var(--radius-2, 6px)",
      background: "transparent",
      color: "var(--text-3, inherit)",
      fontSize: "22px",
      lineHeight: "1",
      cursor: "pointer",
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    });
    closeBtn.addEventListener("click", () => { if (!busy) closeDialog(true); });
    head.append(headLeft, closeBtn);

    // 다운로드 진행 막대
    const progWrap = document.createElement("div");
    Object.assign(progWrap.style, { display: "none", alignItems: "center", gap: "12px", marginBottom: "16px", flex: "0 0 auto" });
    const track = document.createElement("div");
    Object.assign(track.style, {
      flex: "1 1 auto",
      height: "8px",
      borderRadius: "var(--radius-pill, 999px)",
      background: "var(--bg-inset, rgba(127, 127, 127, 0.2))",
      overflow: "hidden",
    });
    const progFill = document.createElement("div");
    Object.assign(progFill.style, {
      width: "0%",
      height: "100%",
      borderRadius: "var(--radius-pill, 999px)",
      background: UPDATE_BADGE_BG,
      transition: "width var(--transition-med, 160ms ease)",
    });
    track.append(progFill);
    const progPct = document.createElement("span");
    Object.assign(progPct.style, {
      fontSize: "13.5px",
      fontWeight: "600",
      fontFamily: "var(--font-mono, monospace)",
      color: "var(--text-2, inherit)",
      flex: "0 0 auto",
    });
    progWrap.append(track, progPct);

    // 변경 내역 영역
    const bodyBox = document.createElement("div");
    Object.assign(bodyBox.style, {
      flex: "1 1 auto",
      minHeight: "120px",
      display: "flex",
      flexDirection: "column",
      padding: "16px 18px",
      borderRadius: "var(--radius-3, 10px)",
      background: "var(--bg-surface, rgba(127, 127, 127, 0.06))",
      border: "1px solid var(--border-subtle, rgba(127, 127, 127, 0.14))",
      marginBottom: "18px",
      overflow: "hidden",
    });
    const notesHead = document.createElement("div");
    notesHead.textContent = "주요 변경 사항";
    Object.assign(notesHead.style, {
      fontSize: "13.5px",
      fontWeight: "600",
      color: "var(--text-2, inherit)",
      marginBottom: "10px",
      flex: "0 0 auto",
    });
    const notesList = document.createElement("ul");
    notesList.dataset.testid = "app-update-popover-notes";
    Object.assign(notesList.style, {
      margin: "0",
      padding: "0 4px 0 0",
      listStyle: "none",
      display: "none",
      flexDirection: "column",
      gap: "10px",
      flex: "1 1 auto",
      maxHeight: "300px",
      overflowY: "auto",
    });
    const notesEmpty = document.createElement("p");
    notesEmpty.dataset.testid = "app-update-popover-empty";
    notesEmpty.textContent = "요약된 변경 내역이 없어요. 아래 링크에서 전체 릴리스 노트를 확인할 수 있어요.";
    Object.assign(notesEmpty.style, {
      margin: "0",
      display: "none",
      fontSize: "14px",
      lineHeight: "1.6",
      color: "var(--text-2, inherit)",
    });
    const releaseLink = document.createElement("button");
    releaseLink.type = "button";
    releaseLink.dataset.testid = "app-update-popover-release-link";
    releaseLink.textContent = "전체 릴리스 노트 보기 ↗";
    Object.assign(releaseLink.style, {
      marginTop: "12px",
      padding: "0",
      border: "0",
      background: "transparent",
      color: "var(--accent, #1F6FC5)",
      fontSize: "13.5px",
      fontWeight: "500",
      cursor: "pointer",
      textAlign: "left",
      alignSelf: "flex-start",
      flex: "0 0 auto",
    });
    releaseLink.addEventListener("click", () => {
      if (currentView) window.open(currentView.releaseUrl, "_blank", "noopener");
    });
    bodyBox.append(notesHead, notesList, notesEmpty, releaseLink);

    const statusLine = document.createElement("div");
    Object.assign(statusLine.style, {
      display: "none",
      fontSize: "13.5px",
      fontWeight: "600",
      color: "var(--success, #18764F)",
      marginBottom: "14px",
      flex: "0 0 auto",
    });

    // 하단 행동 줄
    const foot = document.createElement("div");
    Object.assign(foot.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      flexWrap: "wrap",
      flex: "0 0 auto",
    });
    const hint = document.createElement("span");
    Object.assign(hint.style, {
      fontSize: "13px",
      color: "var(--text-3, inherit)",
    });
    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" });

    const laterBtn = document.createElement("button");
    laterBtn.type = "button";
    Object.assign(laterBtn.style, {
      height: "40px",
      padding: "0 18px",
      borderRadius: "var(--radius-2, 8px)",
      border: "1px solid var(--border-default, rgba(127, 127, 127, 0.3))",
      background: "transparent",
      color: "var(--text-2, inherit)",
      font: "600 14px/1 var(--font-ui, system-ui, sans-serif)",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    laterBtn.addEventListener("click", () => { if (!busy) closeDialog(true); });

    const primaryBtn = document.createElement("button");
    primaryBtn.type = "button";
    primaryBtn.dataset.testid = "app-update-popover-action";
    Object.assign(primaryBtn.style, {
      height: "40px",
      padding: "0 20px",
      borderRadius: "var(--radius-2, 8px)",
      border: "0",
      font: "600 14px/1 var(--font-ui, system-ui, sans-serif)",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    primaryBtn.addEventListener("click", () => {
      if (busy || !currentView) return;
      if (currentView.action === "install") {
        startInstallFromDialog();
        return;
      }
      if (currentView.action === "download") {
        closeDialog(true);
        void update.openDownload();
      }
    });
    actions.append(laterBtn, primaryBtn);
    foot.append(hint, actions);

    box.append(head, progWrap, bodyBox, statusLine, foot);
    backdrop.append(box);
    dialog = {
      backdrop,
      box,
      headIcon,
      title,
      sub,
      closeBtn,
      progWrap,
      progFill,
      progPct,
      notesList,
      notesEmpty,
      releaseLink,
      statusLine,
      hint,
      laterBtn,
      primaryBtn,
      iconKind: null,
      notesKey: null,
    };
    syncDialogContents();
    document.body.append(backdrop);
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onDialogKeyDown, true);
    (primaryBtn.disabled ? closeBtn : primaryBtn).focus();
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
      closeDialog(false);
      currentTooltip = "";
      button.title = "";
      button.removeAttribute("aria-label");
      return;
    }
    currentTooltip = view.tooltip;
    button.title = view.tooltip;
    button.setAttribute("aria-label", view.label);
    if (renderedIconKind !== view.kind) {
      badge.replaceChildren(buildUpdateIconSvg(view.kind, 16));
      renderedIconKind = view.kind;
    }
    syncBadgeStyle();
    if (dialog) syncDialogContents();
  };

  button.addEventListener("click", () => {
    if (!currentView) return;
    if (dialog) {
      if (!busy) closeDialog(true);
      return;
    }
    openDialog();
  });

  listeners.add(paint);
  if (latest) paint(latest);
  watch(update);
  return {
    element: button,
    dispose: () => {
      closeDialog(false);
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
      minHeight: "36px",
      padding: "0 16px",
      borderRadius: "var(--radius-s, 6px)",
      border: "1px solid var(--border-default, rgba(127,127,127,0.35))",
      background: "var(--bg-raised, transparent)",
      color: "var(--text-1, inherit)",
      font: "600 13.5px/1.3 var(--font-ui, system-ui, sans-serif)",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
  }
  button.dataset.testid = `${prefix}-check-button`;
  button.textContent = "업데이트 확인";

  const detail = document.createElement("span");
  detail.dataset.testid = `${prefix}-status`;
  Object.assign(detail.style, {
    fontSize: "13.5px",
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
  if (!update || typeof document === "undefined" || !document.body) return;
  void update.takeWhatsNew().then((news) => {
    if (!news || !document.body) return;
    const version = shortVersion(news.version);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const backdrop = document.createElement("div");
    backdrop.dataset.testid = "app-update-whats-new-backdrop";
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      zIndex: "var(--z-app-modal, 2600)",
      display: "grid",
      placeItems: "center",
      padding: "24px",
      background: "var(--bg-scrim, rgba(15, 15, 15, 0.45))",
      backdropFilter: "blur(2px)",
      boxSizing: "border-box",
    });
    backdrop.style.setProperty("-webkit-app-region", "no-drag");

    const close = (): void => {
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) close();
    });

    const box = document.createElement("div");
    box.dataset.testid = "app-update-whats-new";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", `v${version} 업데이트 완료`);
    Object.assign(box.style, {
      width: "min(520px, calc(100vw - 48px))",
      maxHeight: "min(600px, calc(100vh - 64px))",
      display: "flex",
      flexDirection: "column",
      padding: "24px 28px",
      borderRadius: "var(--radius-4, 14px)",
      border: "1px solid var(--border-default, rgba(55, 53, 47, 0.16))",
      background: "var(--bg-overlay, #ffffff)",
      color: "var(--text-1, #1F1F1E)",
      boxShadow: "var(--shadow-modal, 0 8px 24px rgba(15, 15, 15, 0.12), 0 24px 64px rgba(15, 15, 15, 0.18))",
      font: "400 14.5px/1.55 var(--font-ui, system-ui, sans-serif)",
      textAlign: "left",
      boxSizing: "border-box",
      overflow: "hidden",
    });
    box.style.setProperty("-webkit-app-region", "no-drag");

    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "14px",
      marginBottom: "18px",
    });
    const headLeft = document.createElement("div");
    Object.assign(headLeft.style, { display: "flex", alignItems: "center", gap: "14px" });
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    Object.assign(icon.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "42px",
      height: "42px",
      borderRadius: "var(--radius-pill, 999px)",
      background: UPDATE_BADGE_BG,
      color: "var(--on-accent, #ffffff)",
      flex: "0 0 auto",
    });
    icon.append(buildUpdateIconSvg("check", 22));
    const title = document.createElement("div");
    title.textContent = `v${version}으로 업데이트했어요`;
    Object.assign(title.style, {
      fontSize: "19px",
      fontWeight: "700",
      lineHeight: "1.25",
      letterSpacing: "-0.01em",
      color: "var(--text-1, inherit)",
    });
    headLeft.append(icon, title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      width: "34px",
      height: "34px",
      padding: "0",
      border: "0",
      borderRadius: "var(--radius-2, 6px)",
      background: "transparent",
      color: "var(--text-3, inherit)",
      fontSize: "22px",
      lineHeight: "1",
      cursor: "pointer",
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    });
    closeBtn.addEventListener("click", close);
    head.append(headLeft, closeBtn);

    const bodyBox = document.createElement("div");
    Object.assign(bodyBox.style, {
      flex: "1 1 auto",
      display: "flex",
      flexDirection: "column",
      padding: "16px 18px",
      borderRadius: "var(--radius-3, 10px)",
      background: "var(--bg-surface, rgba(127, 127, 127, 0.06))",
      border: "1px solid var(--border-subtle, rgba(127, 127, 127, 0.14))",
      marginBottom: "18px",
      overflow: "hidden",
    });
    const notesHead = document.createElement("div");
    notesHead.textContent = "이번에 바뀐 점";
    Object.assign(notesHead.style, {
      fontSize: "13.5px",
      fontWeight: "600",
      color: "var(--text-2, inherit)",
      marginBottom: "10px",
    });
    bodyBox.append(notesHead);

    if (news.lines.length > 0) {
      const list = document.createElement("ul");
      Object.assign(list.style, {
        margin: "0",
        padding: "0 4px 0 0",
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxHeight: "280px",
        overflowY: "auto",
      });
      for (const line of news.lines) list.append(buildUpdateNoteListItem(line));
      bodyBox.append(list);
    } else {
      const empty = document.createElement("p");
      empty.textContent = "최신 버전으로 업데이트가 완료됐어요.";
      Object.assign(empty.style, { margin: "0", fontSize: "14px", lineHeight: "1.6", color: "var(--text-2, inherit)" });
      bodyBox.append(empty);
    }

    const releaseLink = document.createElement("button");
    releaseLink.type = "button";
    releaseLink.textContent = "전체 릴리스 노트 보기 ↗";
    Object.assign(releaseLink.style, {
      marginTop: "12px",
      padding: "0",
      border: "0",
      background: "transparent",
      color: "var(--accent, #1F6FC5)",
      fontSize: "13.5px",
      fontWeight: "500",
      cursor: "pointer",
      textAlign: "left",
      alignSelf: "flex-start",
    });
    releaseLink.addEventListener("click", () => {
      window.open(releasePageUrl(news.version), "_blank", "noopener");
    });
    bodyBox.append(releaseLink);

    const foot = document.createElement("div");
    Object.assign(foot.style, { display: "flex", justifyContent: "flex-end" });
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.dataset.testid = "app-update-whats-new-ok";
    okBtn.textContent = "확인";
    Object.assign(okBtn.style, {
      height: "40px",
      padding: "0 22px",
      borderRadius: "var(--radius-2, 8px)",
      border: "0",
      background: UPDATE_BADGE_BG,
      color: "var(--on-accent, #ffffff)",
      font: "600 14px/1 var(--font-ui, system-ui, sans-serif)",
      cursor: "pointer",
    });
    okBtn.addEventListener("click", close);
    foot.append(okBtn);

    box.append(head, bodyBox, foot);
    backdrop.append(box);
    document.body.append(backdrop);
    document.addEventListener("keydown", onKeyDown, true);
    okBtn.focus();
  }, () => {});
}
