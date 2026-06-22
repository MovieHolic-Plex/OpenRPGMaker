// util/toast.ts
// 간단한 토스트 알림. 성공/에러 메시지를 화면 하단에 잠깐 표시.

let toastEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(message: string, kind: "info" | "ok" | "error" = "info"): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.dataset.testid = "toast";
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.className = `toast ${kind} show`;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (toastEl) toastEl.classList.remove("show");
  }, kind === "error" ? 4000 : 2000);
}
