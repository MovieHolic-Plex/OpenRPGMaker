// editor/panels/aiSuggestionPeek.ts
// 캔버스 오른쪽 아래의 **느낌표 버튼** 하나 — 조수가 살펴본 것을 여기서만 보여준다.
//
// 왜 왼쪽 AI 패널에서 옮겼나 (2026-09-21 감독 지시):
//   진단 카드가 왼쪽 패널의 **빈 대화 첫 화면**을 차지하고 있었다. 그 자리는 "대화를 시작하는"
//   곳인데 대화와 무관한 진단 목록이 첫인상을 정했고, 대화를 시작하면 사라져서 「어디 있더라」가
//   됐다. 대기 화면 3분기(추천 함께/조수만/입력창만)도 그 첫 화면을 켜고 끄는 축이라
//   카드와 함께 걷었다. 이제 표면은 하나다: 오른쪽 아래 느낌표 버튼 → 팝오버.
//   대화 상태와 무관하게 늘 같은 자리다.
//
// 위치가 **캔버스 영역 안**인 이유: 오른쪽 아래는 팀 레일(84px, 「팀 작업 없음 / 팀 설정」)이
// 이미 쓰고 있다. `position: absolute` 로 canvas-area 안에 두면 레일이 시작되는 곳에서
// 자동으로 끝나 겹침 계산이 필요 없다(실측: 1440×1000 에서 레일 왼쪽 1357px, 버튼 1341px).
//
// 비모달이다. 투명 전면 레이어를 깔지 않는다 — 보이지 않는 레이어가 맵 클릭을 삼킨 P0 사고가
// 있었다(2026-08-19). 바깥 클릭·Escape 로 닫히고 포커스는 버튼으로 돌아간다.

import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

export interface AiSuggestionPeek {
  /** 캔버스 영역에 붙이는 루트(버튼 + 팝오버). */
  readonly root: HTMLElement;
  /** 추천 카드가 마운트되는 본문. 호출자가 자기 표면을 여기에 넣는다. */
  readonly body: HTMLElement;
  /** 배지 숫자. 0 이면 배지가 사라진다. */
  readonly setCount: (count: number) => void;
  readonly isOpen: () => boolean;
  readonly open: () => void;
  readonly close: () => void;
  readonly dispose: () => void;
}

export function createAiSuggestionPeek(): AiSuggestionPeek {
  const badge = el("span", { class: "ai-suggestion-peek-badge", attrs: { hidden: "" }, dataset: { testid: "ai-suggestion-peek-badge" } });
  const button = el("button", {
    class: "ai-suggestion-peek-button",
    attrs: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": "살펴볼 것", title: "살펴볼 것" },
    dataset: { testid: "ai-suggestion-peek" },
    children: [deckIcon("alert", { size: 22 }), badge],
  }) as HTMLButtonElement;
  const body = el("div", { class: "ai-suggestion-peek-body", dataset: { testid: "ai-suggestion-peek-body" } });
  const popover = el("section", {
    class: "ai-suggestion-peek-popover",
    attrs: { role: "dialog", "aria-label": "살펴볼 것", hidden: "" },
    dataset: { testid: "ai-suggestion-peek-popover" },
    children: [body],
  });
  const root = el("div", { class: "ai-suggestion-peek", dataset: { testid: "ai-suggestion-peek-root" }, children: [popover, button] });
  let open = false;
  let disposed = false;

  const sync = (): void => {
    popover.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("is-open", open);
    if (!open) return;
    // 팝오버 안에 포커스 가능한 것이 있으면 첫 항목으로 — 열자마자 Tab 이 팝오버 밖으로
    // 나가면 키보드 사용자에게는 「열렸는데 아무것도 없다」로 보인다.
    popover.querySelector<HTMLElement>("button, [href], [tabindex]")?.focus();
  };
  const setOpen = (next: boolean): void => {
    if (disposed || open === next) return;
    open = next;
    sync();
    if (!open && document.contains(button)) button.focus();
  };

  button.addEventListener("click", () => setOpen(!open));
  const onPointerDown = (event: PointerEvent): void => {
    if (!open) return;
    const target = event.target;
    if (target instanceof Node && root.contains(target)) return;
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (open && event.key === "Escape") setOpen(false);
  };
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
  }

  return {
    root,
    body,
    setCount: (count: number): void => {
      const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
      badge.textContent = safe > 0 ? String(safe) : "";
      badge.hidden = safe === 0;
      // 배지가 「새 소식」을 뜻하므로 버튼 자체도 그 사실을 말해야 한다 — 아이콘만 보고는
      // 「무엇이 몇 개」인지 알 수 없다.
      const label = safe > 0 ? `살펴볼 것 ${safe}개` : "살펴볼 것";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.classList.toggle("has-items", safe > 0);
    },
    isOpen: () => open,
    open: () => setOpen(true),
    close: () => setOpen(false),
    dispose: () => {
      disposed = true;
      open = false;
      if (typeof document === "undefined" || typeof document.removeEventListener !== "function") return;
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    },
  };
}
