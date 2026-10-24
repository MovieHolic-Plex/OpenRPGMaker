// player/dialogueBacklogView.ts
// 백로그 전체 화면 — 지난 대사를 스크롤로 다시 읽는다(2026-10-17, 미연시 시스템 UI 1단계).
// 대사창의 「백로그」 단추·L·휠 위, ESC 메뉴의 「백로그」 둘이 같은 화면을 연다. 화자 이름·본문·선택지로 고른 항목을 보인다.
// 키는 문서 캡처 단계에서 가로채 게임·대사창에 새지 않게 한다(Esc 가 컷신 건너뛰기·메뉴 토글로 번지면 안 된다).
import { installTapOrSwipeToClose } from "@/player/touchTap";
import { dialogueUiText } from "@/player/dialogueUiStrings";
import { isCancelKey, isConfirmKey, normalizeKey } from "@/player/keyBindings";
import type { AuthoredDialogueSystem, BacklogEntry } from "@/project/dialogueSystem";
import { el } from "@/util/dom";

type ViewState = { readonly root: HTMLElement; readonly list: HTMLElement; readonly onKey: (event: KeyboardEvent) => void; readonly onClose?: () => void };
let view: ViewState | undefined;
let closedAt = -Infinity;

/** 백로그를 닫은 지 ms 안인가(휠 관성으로 곧바로 다시 열리지 않게). */
export function backlogRecentlyClosed(ms: number): boolean {
  return Date.now() - closedAt < ms;
}

export function backlogViewIsOpen(): boolean {
  return view !== undefined;
}

export function closeBacklogView(): void {
  const current = view;
  if (!current) return;
  view = undefined;
  closedAt = Date.now();
  document.removeEventListener("keydown", current.onKey, true);
  current.root.remove();
  current.onClose?.();
}

/** 물리 키 L(자판 배열·한글 입력과 무관) 또는 PageUp 으로 열고 닫는다. */
export function isBacklogToggleKey(event: Pick<KeyboardEvent, "key" | "code">): boolean {
  return event.code === "KeyL" || event.key === "l" || event.key === "L" || event.key === "ㅣ";
}

type UiLanguageHost = Pick<AuthoredDialogueSystem, "language">;

function lineElement(entry: BacklogEntry, system: UiLanguageHost | undefined): HTMLElement {
  if (entry.kind === "choice") {
    const children: HTMLElement[] = [];
    if (entry.prompt) children.push(el("span", { class: "dialogue-backlog-prompt", text: entry.prompt }));
    children.push(el("span", { class: "dialogue-backlog-picked", children: [
      el("span", { class: "dialogue-backlog-mark", text: `▶ ${dialogueUiText(system, "backlog.choice")}`, attrs: { "aria-hidden": "true" } }),
      el("span", { class: "dialogue-backlog-text", text: entry.picked }),
    ] }));
    return el("li", { class: "dialogue-backlog-entry is-choice", dataset: { kind: "choice" }, children });
  }
  const item = el("li", {
    class: `dialogue-backlog-entry${entry.speaker ? "" : " no-speaker"}`,
    dataset: { kind: "line", ...(entry.context ? { context: entry.context } : {}) },
  });
  if (entry.speaker) {
    const name = el("strong", { class: "dialogue-backlog-speaker", text: entry.speaker });
    if (entry.color) name.style.color = entry.color;
    item.append(name);
  }
  item.append(el("span", { class: "dialogue-backlog-text", text: entry.text }));
  return item;
}

export function openBacklogView(options: {
  readonly host: HTMLElement;
  readonly entries: readonly BacklogEntry[];
  /** 글자 언어만 쓴다 — 백로그 시스템이 없는 게임의 회상 화면(엔딩 회상)도 같은 뷰를 쓴다. */
  readonly system: UiLanguageHost | undefined;
  /** 제목을 바꾼다(엔딩 회상). 생략 = 「백로그」. */
  readonly title?: string;
  readonly onClose?: () => void;
}): void {
  closeBacklogView();
  const { system } = options;
  const title = options.title ?? dialogueUiText(system, "backlog.title");
  const list = el("ol", { class: "dialogue-backlog-list", attrs: { tabindex: "0", "aria-label": title }, dataset: { testid: "dialogue-backlog-list" } });
  for (const entry of options.entries) list.append(lineElement(entry, system));
  if (options.entries.length === 0) list.append(el("li", { class: "dialogue-backlog-empty", text: dialogueUiText(system, "backlog.empty") }));
  const closeButton = el("button", {
    class: "dialogue-backlog-close", text: dialogueUiText(system, "backlog.close"),
    attrs: { type: "button" }, dataset: { testid: "dialogue-backlog-close" },
  });
  closeButton.addEventListener("click", (event) => { event.stopPropagation(); closeBacklogView(); });
  const root = el("div", {
    class: "dialogue-backlog",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": title },
    dataset: { testid: "dialogue-backlog", count: String(options.entries.length) },
    children: [
      el("div", { class: "dialogue-backlog-head", children: [
        el("strong", { class: "dialogue-backlog-title", text: title }),
        el("span", { class: "dialogue-backlog-count", text: dialogueUiText(system, "backlog.count", options.entries.length) }),
        el("span", { class: "dialogue-backlog-hint", text: dialogueUiText(system, "backlog.hint") }),
      ] }),
      list,
      closeButton,
    ],
  });
  const step = (): number => Math.max(24, Math.round(list.clientHeight * 0.8));
  const onKey = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
    const key = normalizeKey(event.key);
    const handled = isCancelKey(event.key) || isConfirmKey(event.key) || isBacklogToggleKey(event)
      || ["arrowup", "arrowdown", "pageup", "pagedown", "home", "end"].includes(key);
    // 백로그가 열려 있는 동안 다른 키는 게임에 닿지 않는다(삼킨다).
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!handled || event.repeat && (isCancelKey(event.key) || isConfirmKey(event.key) || isBacklogToggleKey(event))) return;
    if (isCancelKey(event.key) || isConfirmKey(event.key) || isBacklogToggleKey(event)) { closeBacklogView(); return; }
    if (key === "arrowup") list.scrollTop -= 24;
    else if (key === "arrowdown") list.scrollTop += 24;
    else if (key === "pageup") list.scrollTop -= step();
    else if (key === "pagedown") list.scrollTop += step();
    else if (key === "home") list.scrollTop = 0;
    else if (key === "end") list.scrollTop = list.scrollHeight;
  };
  document.addEventListener("keydown", onKey, true);
  installTapOrSwipeToClose(root, closeBacklogView);
  root.addEventListener("wheel", (event) => { event.stopPropagation(); }, { passive: true });
  options.host.append(root);
  view = { root, list, onKey, onClose: options.onClose };
  list.scrollTop = list.scrollHeight;
  list.focus({ preventScroll: true });
}
