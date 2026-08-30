// editor/ui/aiGateModal.ts
// 차단 게이트 경고 모달. AI 변경이 적용 직전에 반려됐을 때 **사유 전량 + 다음 행동**을 띄운다.
//
// 왜 토스트/버블이 아니라 모달인가 — 무결성 커밋 게이트는 통지가 토스트 하나뿐이라, 사라지면
// "AI 가 아무것도 안 했다" 와 구분이 되지 않았다(ai/aiGateNotice.ts 머리말). 적용이 0건으로
// 끝난 사실은 사용자가 반드시 읽어야 하므로 초점을 가져가는 표면에 올린다.
//
// 기존 app-modal 프리미티브(editor/ui/modal.ts)를 쓰지 않는 이유: showAlert 는 본문이 문자열
// 하나라 사유 목록·다음 행동·접히는 원문을 구분해 담을 수 없다. 스타일 클래스(.app-modal-*)는
// 그대로 재사용해 새 CSS 를 최소로 유지한다.

import { aiGateNoticeToPlainText, type AiGateNotice } from "@/ai/aiGateNotice";
import { el } from "@/util/dom";
import { registerModal, unregisterModal } from "./modalStack";

const MODAL_TESTID = "ai-gate-modal";

let modalId = 0;

/**
 * document 만 본다(window 는 보지 않는다) — fakeDom 테스트 환경에는 window 전역이 없고,
 * 이 모달은 그 환경에서도 렌더돼야 검증할 수 있다.
 */
function domReady(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.createElement === "function" &&
    Boolean(document.body)
  );
}

function isAttached(element: Element): boolean {
  if (typeof document === "undefined") return false;
  if (typeof document.contains === "function") return document.contains(element);
  return Boolean(document.body?.contains(element));
}

function restoreOpener(opener: Element | null): void {
  if (!(opener instanceof HTMLElement) || !isAttached(opener)) return;
  if (typeof opener.focus === "function") opener.focus();
}

function bulletList(tag: "ul" | "ol", testid: string, items: readonly string[]): HTMLElement {
  return el(tag, {
    class: "ai-gate-list",
    dataset: { testid },
    children: items.map((item) => el("li", { class: "ai-gate-list-item", text: item })),
  });
}

/**
 * 게이트 경고를 띄운다. 이미 떠 있으면 새 것으로 교체한다 — 한 턴에 게이트가 둘 걸려도
 * 모달이 쌓이면 사용자는 뒤엣것만 닫고 앞엣것을 못 읽는다.
 */
export function showAiGateNotice(notice: AiGateNotice): HTMLElement | null {
  if (!domReady()) return null;
  document.querySelector(`[data-testid="${MODAL_TESTID}"]`)?.remove();

  modalId += 1;
  const titleId = `ai-gate-title-${modalId}`;
  const headlineId = `ai-gate-headline-${modalId}`;
  const opener = document.activeElement;

  const overlay = el("div", {
    class: "app-modal-overlay ai-gate-overlay",
    dataset: { testid: MODAL_TESTID, gateKind: notice.kind },
  });

  let settled = false;
  const close = (): void => {
    if (settled) return;
    settled = true;
    unregisterModal(overlay);
    overlay.remove();
    restoreOpener(opener);
  };

  const closeButton = el("button", {
    class: "app-modal-button is-confirm",
    text: "확인",
    attrs: { type: "button" },
    dataset: { testid: "ai-gate-modal-close" },
    on: { click: () => close() },
  });

  const copyButton = el("button", {
    class: "app-modal-button",
    text: "사유 복사",
    attrs: { type: "button", title: "게이트 사유를 클립보드에 복사합니다" },
    dataset: { testid: "ai-gate-modal-copy" },
    on: {
      click: () => {
        const text = aiGateNoticeToPlainText(notice);
        // 클립보드가 없는 환경(비보안 컨텍스트·헤드리스)에서 예외로 모달을 죽이지 않는다.
        void globalThis.navigator?.clipboard?.writeText?.(text)?.catch?.(() => undefined);
        copyButton.textContent = "복사했어요";
      },
    },
  });

  const children: HTMLElement[] = [
    el("div", { class: "app-modal-title", text: notice.title, attrs: { id: titleId } }),
    el("div", { class: "app-modal-message", text: notice.headline, attrs: { id: headlineId } }),
    el("h3", { class: "ai-gate-section-title", text: "막힌 이유" }),
    bulletList("ul", "ai-gate-modal-reasons", notice.reasons),
  ];
  if (notice.nextSteps.length > 0) {
    children.push(
      el("h3", { class: "ai-gate-section-title", text: "이렇게 해 보세요" }),
      bulletList("ol", "ai-gate-modal-steps", notice.nextSteps),
    );
  }
  if (notice.detail && notice.detail !== notice.reasons[0]) {
    children.push(
      el("details", {
        class: "ai-gate-detail",
        dataset: { testid: "ai-gate-modal-detail" },
        children: [
          el("summary", { class: "ai-gate-detail-summary", text: "원문 보기" }),
          el("pre", { class: "ai-gate-detail-body", text: notice.detail }),
        ],
      }),
    );
  }
  children.push(el("div", { class: "app-modal-actions", children: [copyButton, closeButton] }));

  const card = el("div", {
    class: "app-modal-card ai-gate-card",
    attrs: {
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      "aria-describedby": headlineId,
    },
    children,
  });

  card.addEventListener("click", (event) => event.stopPropagation());
  overlay.addEventListener("click", () => close());
  overlay.append(card);
  document.body.append(overlay);
  registerModal(overlay, close);
  if (typeof closeButton.focus === "function") closeButton.focus();
  return overlay;
}
