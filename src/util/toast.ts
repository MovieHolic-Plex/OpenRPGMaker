// util/toast.ts
// 간단한 토스트 알림. 성공/에러 메시지를 화면 하단에 잠깐 표시.

let toastEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(message: string, kind: "info" | "ok" | "error" = "info"): void {
  // Node 단위 테스트(document 없음)에서는 조용히 무시 — 알림은 브라우저 전용.
  if (typeof document === "undefined") return;
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
