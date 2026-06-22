// player/dialogue.ts
// DOM 대사창/선택지 오버레이. 인터프리터의 text/choices 요청을 화면에 표시.
// 사용자 입력(클릭/엔터 → 진행, 선택지 클릭 → 인덱스)을 콜백으로 전달.

import { el, clearChildren } from "@/util/dom";

export interface DialogueUI {
  // 대사창 표시. advance() 호출 시 resolve되는 Promise를 반환.
  showText(speaker: string | undefined, body: string): Promise<void>;
  // 선택지 표시. 사용자가 고른 인덱스로 resolve.
  showChoices(
    prompt: string | undefined,
    options: { text: string }[]
  ): Promise<number>;
  // 숨김.
  hide(): void;
}

export function createDialogueUI(host: HTMLElement): DialogueUI {
  const overlay = el("div", { class: "dialogue-overlay" });
  host.append(overlay);

  function showText(
    speaker: string | undefined,
    body: string
  ): Promise<void> {
    clearChildren(overlay);
    return new Promise<void>((resolve) => {
      const box = el("div", { class: "dialogue-box", dataset: { testid: "dialogue-box" } });
      if (speaker) {
        box.append(el("div", { class: "speaker", text: speaker }));
      }
      const bodyEl = el("div", { class: "body" });
      box.append(bodyEl);
      const hint = el("div", {
        class: "continue-hint",
        text: "▼ 클릭/엔터",
      });
      box.append(hint);

      // 타이핑 효과.
      let i = 0;
      let typing = true;
      const full = body;
      const typeStep = () => {
        if (i < full.length) {
          bodyEl.textContent = full.slice(0, i + 1);
          i++;
          timer = window.setTimeout(typeStep, 24);
        } else {
          typing = false;
        }
      };
      let timer = window.setTimeout(typeStep, 24);

      const advance = () => {
        if (typing) {
          // 타이핑 스킵 → 전문 표시.
          clearTimeout(timer);
          bodyEl.textContent = full;
          typing = false;
          return;
        }
        cleanup();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          advance();
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        box.removeEventListener("click", advance);
        document.removeEventListener("keydown", onKey);
        clearChildren(overlay);
      };
      box.addEventListener("click", advance);
      document.addEventListener("keydown", onKey);

      overlay.append(box);
    });
  }

  function showChoices(
    prompt: string | undefined,
    options: { text: string }[]
  ): Promise<number> {
    return new Promise<number>((resolve) => {
      if (prompt) {
        const pbox = el("div", { class: "dialogue-box", dataset: { testid: "dialogue-box" } });
        pbox.append(el("div", { class: "body", text: prompt }));
        overlay.append(pbox);
      }

      const choicesEl = el("div", { class: "choices" });
      options.forEach((opt, idx) => {
        const btn = el("button", {
          class: "choice-btn",
          text: `▶ ${opt.text}`,
        });
        btn.addEventListener("click", () => {
          document.removeEventListener("keydown", onKey);
          clearChildren(overlay);
          resolve(idx);
        });
        choicesEl.append(btn);
      });

      // 키보드: 숫자 1~9로 선택.
      const onKey = (e: KeyboardEvent) => {
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >= 1 && n <= options.length) {
          document.removeEventListener("keydown", onKey);
          clearChildren(overlay);
          resolve(n - 1);
        }
      };
      document.addEventListener("keydown", onKey);

      overlay.append(choicesEl);
    });
  }

  function hide(): void {
    clearChildren(overlay);
  }

  return { showText, showChoices, hide };
}
