import { AI_RUNTIME_UNAVAILABLE_SUMMARY, describeAiFailure, isAiRuntimeUnavailable } from "@/editor/panels/assistantErrorDetail";
import { editorState } from "@/editor/editorState";
import { showConfirm } from "@/editor/ui/modal";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { createLogger } from "@/util/logger";
import { readSmallTaskPreviewPreference } from "./previewPreference";
import { dbTarget, mapTarget, SmallTaskError, type SmallTaskCollection, type SmallTaskTarget } from "./target";

const log = createLogger("small-task");
const hint = "무엇을 고칠지 먼저 고르세요";
function example(target: SmallTaskTarget | null): string {
  if (!target) return hint;
  if (target.kind === "map") return "이 마을에 밤에만 나오는 상인 추가";
  if (target.kind === "event") return target.isNpc ? "상점 주인 대사를 오사카 사투리로" : "보물상자에 포션 3개";
  return target.collection === "items" ? "포션 가격을 80으로" : "이름을 더 짧게 바꿔 줘";
}

export function smallTaskErrorMessage(error: unknown): string {
  if (error instanceof SmallTaskError) return error.message;
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  const reason = error instanceof Error ? error.message : String(error);
  // 409(heavy-missing 재시도) 뒤의 500 은 Bun 이 없어 워커가 못 뜬 것이다. 본문에 「로그인」이 있어도 로그인 만료가 아니다.
  if (isAiRuntimeUnavailable(reason)) return AI_RUNTIME_UNAVAILABLE_SUMMARY;
  const { kind } = describeAiFailure(reason);
  const http = typeof status === "number" ? status : undefined;
  if (http === 401 || http === 403 || (http !== 404 && http !== 409 && http !== 500 && kind === "auth")) {
    return "AI 로그인이 만료됐거나 연결되지 않았어요. 설정에서 다시 로그인해 주세요.";
  }
  if (status === 0 || kind === "network") return "인터넷 연결을 확인하고 다시 시도해 주세요.";
  return "AI가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}

export function canvasSmallTask(): HTMLElement {
  return smallTaskButton(() => {
    const state = editorState.get();
    return mapTarget(store.getCurrent(), state.currentMapId, state.layer === "event" ? state.selectedEventId : null,
      state.layer === "event" ? state.selectedEventPageId : null);
  });
}
export function eventSmallTask(mapId: string, eventId: string): HTMLElement {
  return smallTaskButton(() => mapTarget(store.getCurrent(), mapId, eventId, editorState.get().selectedEventPageId));
}
export function recordSmallTask(collection: SmallTaskCollection, id: string): HTMLElement {
  return smallTaskButton(() => dbTarget(store.getCurrent(), collection, id));
}

let dismiss: (() => void) | undefined;
function smallTaskButton(readTarget: () => SmallTaskTarget | null): HTMLButtonElement {
  const button = el("button", { class: "small-task-trigger", dataset: { testid: "small-task-open" }, text: "이걸로 작업", attrs: { type: "button", "aria-haspopup": "dialog" } });
  button.addEventListener("click", () => openCapsule(button, readTarget()));
  return button;
}

function openCapsule(anchor: HTMLButtonElement, target: SmallTaskTarget | null): void {
  dismiss?.();
  const owner = new AbortController();
  const dialog = anchor.closest('[role="dialog"]');
  const eventHeader = anchor.closest(".event-editor-modal-header");
  const box = el("section", {
    class: eventHeader ? "small-task event-editor-small-task" : "small-task",
    dataset: { ownsCtrlEnter: "" },
    attrs: { role: "dialog", "aria-label": "작은 일", ...(eventHeader ? {} : { popover: "manual" }) },
  });
  const targetLabel = target?.label ?? hint;
  const title = el("strong", { text: targetLabel });
  const input = el("input", { attrs: { type: "text", placeholder: example(target), "aria-label": "한 줄 요청", autocomplete: "off" } });
  const send = el("button", { text: "실행", attrs: { type: "submit" } });
  const form = el("form", { children: [input, send] });
  const status = el("div", { class: "small-task-status", attrs: { role: "status", "aria-live": "polite" } });
  const closeButton = el("button", { text: "닫기", attrs: { type: "button" } });
  box.append(el("header", { children: [title, closeButton] }), form, status);
  const toolbar = anchor.closest(".canvas-toolbar");
  if (eventHeader) eventHeader.after(box);
  else {
    (dialog ?? document.body).append(box);
    box.showPopover();
  }
  const place = () => {
    if (!anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    if (eventHeader && dialog) {
      const bounds = dialog.getBoundingClientRect();
      box.style.marginLeft = `${Math.max(8, Math.min(bounds.width - box.offsetWidth - 8, r.left - bounds.left))}px`;
      return;
    }
    box.style.left = `${Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left))}px`;
    box.style.top = `${Math.max(8, Math.min(innerHeight - box.offsetHeight - 8, r.bottom + 6))}px`;
  };
  place();
  window.addEventListener("resize", place, { signal: owner.signal });
  dialog?.addEventListener("scroll", place, { capture: true, signal: owner.signal });
  if (typeof ResizeObserver !== "undefined") {
    const resize = new ResizeObserver(place);
    resize.observe(box);
    if (eventHeader) resize.observe(eventHeader);
    owner.signal.addEventListener("abort", () => resize.disconnect(), { once: true });
  }
  const close = (restoreFocus = true) => {
    if (owner.signal.aborted) return;
    owner.abort();
    unregisterModal(box);
    unsubscribe();
    box.remove();
    dismiss = undefined;
    if (!restoreFocus) return;
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
    else if (toolbar) {
      const host = toolbar.isConnected ? toolbar : document.querySelector(".canvas-toolbar");
      host?.querySelector<HTMLElement>('[data-testid="small-task-open"]')?.focus({ preventScroll: true });
    }
  };
  let confirmingUndo = false;
  document.addEventListener("click", event => {
    if (!confirmingUndo && !status.classList.contains("is-working") && event.target instanceof Node && !box.contains(event.target)) {
      // Let the outside control receive the same gesture that dismissed the card.
      close(false);
    }
  }, { capture: true, signal: owner.signal });
  registerModal(box, close);
  const unsubscribe = store.subscribe((_project, change) => { if (change.projectSwitch) close(); });
  if (dialog) {
    const observer = new MutationObserver(() => { if (!box.isConnected) close(); });
    // The host may remove the window or any of its overlay wrappers.
    for (let parent = dialog.parentNode; parent; parent = parent.parentNode) {
      observer.observe(parent, { childList: true });
    }
    owner.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
  }
  dismiss = close;
  closeButton.onclick = () => close();
  input.disabled = !target;
  send.disabled = true;
  if (target) input.focus();
  else closeButton.focus();
  input.addEventListener("input", () => { send.disabled = !target || !input.value.trim(); });
  input.addEventListener("keydown", e => {
    // 이 칸은 Ctrl/Cmd+Enter 만 가진다. Ctrl/Cmd+S 는 편집기 「적용」이다.
    // 캡슐이 맨 위일 때만 처리한다. 그 위에 다른 창이 있으면 그 창의 단축키를 건드리지 않는다.
    if (
      (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s"
      && !e.isComposing && !e.defaultPrevented && isTopModal(box)
    ) {
      const apply = box.closest('[data-testid="event-editor-modal"]')
        ?.querySelector<HTMLButtonElement>('[data-testid="event-editor-apply"]');
      if (apply && !apply.disabled) {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
        apply.click();
        return;
      }
    }
    if (e.key !== "Enter") return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.isComposing && !send.disabled) form.requestSubmit(send);
    } else if (e.isComposing) {
      e.preventDefault();
    }
  });
  function confirmPreview(summary: { headline: string; lines: string[] }): Promise<boolean> {
    title.setAttribute("data-i18n-skip", "");
    title.textContent = summary.headline;
    form.hidden = true;
    closeButton.textContent = "닫기";
    status.classList.remove("is-working");
    const cancel = el("button", { text: "취소", attrs: { type: "button" } });
    const apply = el("button", { class: "small-task-apply", text: "적용", attrs: { type: "button" } });
    const actions = el("div", { class: "small-task-preview-actions", children: [cancel, apply] });
    status.replaceChildren(el("ul", { children: summary.lines.map(text => el("li", { text, attrs: { "data-i18n-skip": "" } })) }), actions);
    place();
    return new Promise(resolve => {
      const finish = (approved: boolean) => {
        unregisterModal(actions);
        owner.signal.removeEventListener("abort", discard);
        resolve(approved);
      };
      const discard = () => finish(false);
      cancel.onclick = discard;
      apply.onclick = () => finish(true);
      // Escape discards this preview layer first and leaves the request box open.
      registerModal(actions, discard);
      owner.signal.addEventListener("abort", discard, { once: true });
      cancel.focus();
    });
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!target || send.disabled || owner.signal.aborted) return;
    const request = input.value.trim();
    const live = store.getCurrent();
    const shouldPreview = readSmallTaskPreviewPreference();
    send.disabled = input.disabled = true;
    closeButton.textContent = "취소";
    status.textContent = "작업 중…";
    status.classList.add("is-working");
    try {
      const [{ runSmallTask }, { smallTaskBase, commitSmallTask }, { plainSummary }] = await Promise.all([
        import("./run"), import("./history"), import("./plainSummary"),
      ]);
      owner.signal.throwIfAborted();
      const before = smallTaskBase(live, target);
      const after = await runSmallTask(before, target, request, owner.signal, live);
      owner.signal.throwIfAborted();
      if (!box.isConnected) { close(); return; }
      const summary = plainSummary(before, after);
      if (shouldPreview) {
        if (!summary.lines.length) {
          status.textContent = "바뀐 내용이 없어요.";
          return;
        }
        const approved = await confirmPreview(summary);
        owner.signal.throwIfAborted();
        if (!approved) {
          status.textContent = "취소했어요.";
          return;
        }
      }
      const receipt = commitSmallTask(live, before, after, target);
      if (receipt) {
        form.remove();
        title.textContent = summary.headline;
        title.setAttribute("data-i18n-skip", "");
        const undo = el("button", { text: "되돌리기", attrs: { type: "button" } });
        undo.onclick = async () => {
          undo.disabled = true;
          let message = "현재 편집을 유지했어요.";
          // 기본 확인 창이 팝오버보다 앞에서 키보드와 포인터를 받게 한다.
          const done = await receipt.undo(async () => {
            confirmingUndo = true;
            if (!eventHeader) box.hidePopover();
            try {
              return await showConfirm({ title: "뒤에 고친 내용이 있어요", message: "이 작업 뒤의 편집도 함께 되돌릴까요?",
                confirmLabel: "함께 되돌리기", cancelLabel: "유지하기" });
            } finally {
              confirmingUndo = false;
              if (!eventHeader && box.isConnected) box.showPopover();
            }
          }, () => {
            message = "이 이벤트를 작업 뒤에 직접 고쳐서 되돌리지 않았어요. 창에서 먼저 저장하거나 취소해 주세요.";
          });
          if (done) status.replaceChildren("되돌렸어요.");
          else { undo.disabled = false; status.querySelector("small")?.remove(); status.append(el("small", { text: message })); }
        };
        const details = summary.lines.length === 1 ? [] : summary.lines;
        status.replaceChildren(...(details.length ? [el("ul", { children: details.map(text => el("li", { text, attrs: { "data-i18n-skip": "" } })) })] : []), undo);
        undo.focus();
        place();
      } else status.textContent = "바뀐 내용이 없어요.";
    } catch (error) {
      if (!owner.signal.aborted) {
        log.error("Request failed", error);
        status.textContent = smallTaskErrorMessage(error);
      }
    } finally {
      if (!owner.signal.aborted) {
        status.classList.remove("is-working");
        closeButton.textContent = "닫기";
        input.disabled = false;
        send.disabled = !input.value.trim();
        if (form.hidden && form.isConnected) {
          title.removeAttribute("data-i18n-skip");
          title.textContent = targetLabel;
          form.hidden = false;
          input.focus();
          place();
        }
      }
    }
  });
}
