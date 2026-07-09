// editor/ui/modal.ts
// 커스텀 인앱 모달 (2026-07-07 타일 시공 흐름 재설계 §2.4 — G5).
// 네이티브 window.confirm/alert 대체: 스타일된 오버레이 + 제목/본문/확인·취소 + testid.
// 헤드리스(Playwright/Node — window 또는 document 없음)에서는 기존 window.confirm 부재
// 규약을 승계해 자동 통과한다(confirm → true, alert → 즉시 resolve).

import { el } from "@/util/dom";

export interface ConfirmOptions {
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  // 파괴적 확정(삭제 등) — 확인 버튼을 위험색으로 표시한다.
  readonly danger?: boolean;
}

export interface AlertOptions {
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel?: string;
}

function domAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function" &&
    Boolean(document.body)
  );
}

interface ModalButton {
  readonly label: string;
  readonly value: boolean;
  readonly testid: string;
  readonly danger?: boolean;
}

function openModal(kind: "confirm" | "alert", title: string | undefined, message: string, buttons: readonly ModalButton[], onDone: (value: boolean) => void): void {
  const overlay = el("div", {
    class: "app-modal-overlay",
    dataset: { testid: `app-${kind}-modal` },
  });
  let settled = false;
  const done = (value: boolean): void => {
    if (settled) return;
    settled = true;
    overlay.remove();
    document.removeEventListener?.("keydown", onKey);
    onDone(value);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") done(false);
  };
  const actionButtons = buttons.map((button) =>
    el("button", {
      class: `app-modal-button${button.danger ? " is-danger" : ""}${button.value ? " is-confirm" : ""}`,
      text: button.label,
      attrs: { type: "button" },
      dataset: { testid: button.testid },
      on: { click: () => done(button.value) },
    })
  );
  const card = el("div", {
    class: "app-modal-card",
    attrs: { role: kind === "confirm" ? "alertdialog" : "alert", "aria-modal": "true" },
    children: [
      ...(title ? [el("div", { class: "app-modal-title", text: title })] : []),
      el("div", { class: "app-modal-message", text: message }),
      el("div", { class: "app-modal-actions", children: actionButtons }),
    ],
  });
  overlay.append(card);
  // 오버레이(바깥) 클릭 = 취소. 카드 클릭은 전파를 막는다.
  card.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", () => done(false));
  document.addEventListener?.("keydown", onKey);
  document.body.append(overlay);
  actionButtons[actionButtons.length - 1]?.focus?.();
}

// 확인/취소 모달. resolve(true)=확인, resolve(false)=취소(Esc/바깥 클릭 포함).
export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (!domAvailable()) return Promise.resolve(true);
  return new Promise((resolve) => {
    openModal(
      "confirm",
      opts.title,
      opts.message,
      [
        { label: opts.cancelLabel ?? "취소", value: false, testid: "app-modal-cancel" },
        { label: opts.confirmLabel ?? "확인", value: true, testid: "app-modal-confirm", danger: opts.danger },
      ],
      resolve
    );
  });
}

// 알림 모달(확인 버튼 하나).
export function showAlert(opts: AlertOptions): Promise<void> {
  if (!domAvailable()) return Promise.resolve();
  return new Promise((resolve) => {
    openModal("alert", opts.title, opts.message, [{ label: opts.confirmLabel ?? "확인", value: true, testid: "app-modal-confirm" }], () => resolve());
  });
}
