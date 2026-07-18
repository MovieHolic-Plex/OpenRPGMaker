// util/toast.ts
// 간단한 토스트 알림. 성공/에러 메시지를 화면 하단에 잠깐 표시.
// 선택적 action 버튼(예: 삭제 직후 복구)을 붙일 수 있다.

export type ToastKind = "info" | "ok" | "error";

export type ToastAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly testid?: string;
};

export type ToastOptions = {
  readonly kind?: ToastKind;
  readonly durationMs?: number;
  readonly action?: ToastAction;
};

let toastEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(
  message: string,
  kindOrOptions: ToastKind | ToastOptions = "info"
): void {
  // Node 단위 테스트(document 없음)에서는 조용히 무시 — 알림은 브라우저 전용.
  if (typeof document === "undefined" || !document.body) return;

  const options: ToastOptions =
    typeof kindOrOptions === "string" ? { kind: kindOrOptions } : kindOrOptions;
  const kind: ToastKind = options.kind ?? "info";
  const durationMs = options.durationMs ?? (kind === "error" ? 4000 : options.action ? 6000 : 2000);

  // fakeDom reinstall / body 교체 후 고아 노드를 붙잡지 않도록 현재 body 소속 여부 확인.
  if (!toastEl || toastEl.parentNode !== document.body) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.dataset.testid = "toast";
    document.body.append(toastEl);
  }

  toastEl.replaceChildren();
  const messageEl = document.createElement("span");
  messageEl.className = "toast-message";
  messageEl.textContent = message;
  toastEl.append(messageEl);

  if (options.action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = options.action.label;
    button.dataset.testid = options.action.testid ?? "toast-action";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.action?.onClick();
      hideToast();
    });
    toastEl.append(button);
  }

  toastEl.className = `toast ${kind} show${options.action ? " has-action" : ""}`;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideToast();
  }, durationMs);
}

function hideToast(): void {
  if (toastEl) toastEl.classList.remove("show");
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}
