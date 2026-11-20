import "@/styles/small-task.css";
import { editorState } from "@/editor/editorState";
import { showConfirm } from "@/editor/ui/modal";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { dbTarget, mapTarget, SmallTaskError, type SmallTaskCollection, type SmallTaskTarget } from "./target";

const hint = "무엇을 고칠지 먼저 고르세요";
function example(target: SmallTaskTarget | null): string {
  if (!target) return hint;
  if (target.kind === "map") return "이 마을에 밤에만 나오는 상인 추가";
  if (target.kind === "event") return target.isNpc ? "상점 주인 대사를 오사카 사투리로" : "보물상자에 포션 3개";
  return target.collection === "items" ? "포션 가격을 80으로" : "이름을 더 짧게 바꿔 줘";
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
  const box = el("section", { class: "small-task", attrs: { role: "dialog", "aria-label": "작은 일", popover: "manual" } });
  const title = el("strong", { text: target?.label ?? hint });
  const input = el("input", { attrs: { type: "text", placeholder: example(target), "aria-label": "한 줄 요청", autocomplete: "off" } });
  const send = el("button", { text: "실행", attrs: { type: "submit" } });
  const form = el("form", { children: [input, send] });
  const status = el("div", { class: "small-task-status", attrs: { role: "status", "aria-live": "polite" } });
  const closeButton = el("button", { text: "닫기", attrs: { type: "button" } });
  box.append(el("header", { children: [title, closeButton] }), form, status);
  const dialog = anchor.closest('[role="dialog"]');
  (dialog ?? document.body).append(box);
  box.showPopover();
  const place = () => {
    const r = anchor.getBoundingClientRect();
    if (!anchor.isConnected) return;
    box.style.left = `${Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left))}px`;
    box.style.top = `${Math.max(8, Math.min(innerHeight - box.offsetHeight - 8, r.bottom + 6))}px`;
  };
  place();
  window.addEventListener("resize", place, { signal: owner.signal });
  const close = () => {
    if (owner.signal.aborted) return;
    owner.abort();
    unregisterModal(box);
    unsubscribe();
    box.remove();
    dismiss = undefined;
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
  };
  document.addEventListener("pointerdown", event => {
    if (!input.disabled && form.isConnected && event.target instanceof Node && !box.contains(event.target)) close();
  }, { capture: true, signal: owner.signal });
  registerModal(box, close);
  const unsubscribe = store.subscribe((_project, change) => { if (change.projectSwitch) close(); });
  if (dialog?.parentNode) {
    const observer = new MutationObserver(() => { if (!box.isConnected) close(); });
    observer.observe(dialog.parentNode, { childList: true });
    owner.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
  }
  dismiss = close;
  closeButton.onclick = close;
  input.disabled = !target;
  send.disabled = true;
  if (target) input.focus();
  else closeButton.focus();
  input.addEventListener("input", () => { send.disabled = !target || !input.value.trim(); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && e.isComposing) e.preventDefault(); });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!target || send.disabled || owner.signal.aborted) return;
    const request = input.value.trim();
    const live = store.getCurrent();
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
      const after = await runSmallTask(before, target, request, owner.signal);
      owner.signal.throwIfAborted();
      if (!box.isConnected) { close(); return; }
      const summary = plainSummary(before, after);
      const receipt = commitSmallTask(live, before, after, target);
      if (receipt) {
        form.remove();
        title.textContent = summary.headline;
        const undo = el("button", { text: "되돌리기", attrs: { type: "button" } });
        undo.onclick = async () => {
          undo.disabled = true;
          // 기본 확인 창이 팝오버보다 앞에서 키보드와 포인터를 받게 한다.
          const done = await receipt.undo(async () => {
            box.hidePopover();
            try {
              return await showConfirm({ title: "뒤에 고친 내용이 있어요", message: "이 작업 뒤의 편집도 함께 되돌릴까요?",
                confirmLabel: "함께 되돌리기", cancelLabel: "유지하기" });
            } finally { if (box.isConnected) box.showPopover(); }
          });
          if (done) status.replaceChildren("되돌렸어요.");
          else { undo.disabled = false; status.querySelector("small")?.remove(); status.append(el("small", { text: "현재 편집을 유지했어요." })); }
        };
        const details = summary.lines.filter(line => line !== summary.headline);
        status.replaceChildren(...(details.length ? [el("ul", { children: details.map(text => el("li", { text })) })] : []), undo);
        undo.focus();
        place();
      } else status.textContent = "바뀐 내용이 없어요.";
    } catch (error) {
      if (!owner.signal.aborted) {
        // 전송·도구 예외는 요청 본문, 내부 id 등을 포함할 수 있다.
        status.textContent = error instanceof SmallTaskError ? error.message : "작업을 마치지 못했어요. AI 연결을 확인하고 다시 시도해 주세요.";
      }
    } finally {
      if (!owner.signal.aborted) {
        status.classList.remove("is-working");
        closeButton.textContent = "닫기";
        send.disabled = input.disabled = false;
      }
    }
  });
}
