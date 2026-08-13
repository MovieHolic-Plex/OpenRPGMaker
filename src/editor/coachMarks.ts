// editor/coachMarks.ts
// 기본 모드 첫 방문 코치마크 3점 — 레일 → 캔버스 → AI 패널.
// 에디터에 온보딩 장치가 전무해 초보가 첫 화면에서 막히는 문제(기본 모드 UX 감사)의 최소 대응.
// localStorage 플래그로 1회만 노출하고, 건너뛰기/완주/전문가 전환 모두 '본 것'으로 처리한다.
import { shouldSuppressCoachMarksForWelcomeIntent } from "@/editor/aiBootIntent";
import { getEditorUiMode } from "@/editor/editorUiMode";
import { el } from "@/util/dom";

export const COACH_MARKS_SEEN_KEY = "rpg-zzu:coachmarks-basic-v1";

export interface CoachMarkStep {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  /** 위치 기준 앵커. 없으면 화면 중앙 근처에 띄운다. */
  readonly anchorTestId: string;
  /** 앵커 기준 카드 배치 방향. */
  readonly side: "right" | "below" | "left";
}

export const BASIC_COACH_MARKS: readonly CoachMarkStep[] = [
  {
    id: "rail",
    title: "도구 레일",
    text: "브러시로 칠하고 지우개로 지워요. 아이콘에 마우스를 올리면 이름이 보입니다.",
    anchorTestId: "basic-left-rail",
    side: "right",
  },
  {
    id: "canvas",
    title: "맵 캔버스",
    text: "선택 도구(V)로 영역을 드래그하면 ✨ AI 작업 버튼이 떠요. 이벤트(NPC)는 더블클릭으로 편집합니다.",
    anchorTestId: "edit-canvas",
    side: "below",
  },
  {
    id: "ai",
    title: "AI 어시스턴트",
    text: "원하는 걸 그냥 한국어로 부탁하세요. Ctrl+K로 명령·맵·스킬을 검색할 수 있어요.",
    anchorTestId: "ai-input",
    side: "left",
  },
] as const;

const CARD_WIDTH = 280;
const MARGIN = 12;

type CoachMarkPositionInput = {
  readonly side: CoachMarkStep["side"];
  readonly anchor: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly width: number;
  };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly card: { readonly width: number; readonly height: number };
};

/** 앵커 rect와 뷰포트로 카드 좌표를 계산한다 (뷰포트 밖으로 나가지 않게 clamp). */
export function coachMarkPosition(
  { side, anchor, viewport, card }: CoachMarkPositionInput,
): { readonly left: number; readonly top: number } {
  let left: number;
  let top: number;
  if (side === "right") {
    left = anchor.right + MARGIN;
    top = anchor.top + MARGIN;
  } else if (side === "left") {
    left = anchor.left - card.width - MARGIN;
    top = anchor.top + MARGIN;
  } else {
    left = anchor.left + anchor.width / 2 - card.width / 2;
    top = anchor.top + MARGIN;
  }
  left = Math.max(MARGIN, Math.min(left, viewport.width - card.width - MARGIN));
  top = Math.max(MARGIN, Math.min(top, Math.max(MARGIN, viewport.height - card.height - MARGIN)));
  return { left, top };
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function alreadySeen(storage: Storage | null): boolean {
  try {
    return storage?.getItem(COACH_MARKS_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(storage: Storage | null): void {
  try {
    storage?.setItem(COACH_MARKS_SEEN_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

let activeHost: HTMLElement | null = null;

function dismiss(): void {
  activeHost?.remove();
  activeHost = null;
}

function renderStep(stepIndex: number, storage: Storage | null): void {
  dismiss();
  const step = BASIC_COACH_MARKS[stepIndex];
  if (!step) {
    markSeen(storage);
    return;
  }
  const anchor = document.querySelector<HTMLElement>(`[data-testid="${step.anchorTestId}"]`);
  const rect = anchor?.getBoundingClientRect?.();
  const viewport = {
    width: typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1280,
    height: typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800,
  };
  const isLast = stepIndex === BASIC_COACH_MARKS.length - 1;
  const card = el("div", {
    class: "coach-mark-card",
    attrs: {
      role: "dialog",
      "aria-label": `안내 ${stepIndex + 1}/${BASIC_COACH_MARKS.length}: ${step.title}`,
      style: `left:0;top:0;width:${CARD_WIDTH}px;visibility:hidden;`,
    },
    dataset: { testid: `coach-mark-${step.id}` },
    children: [
      el("div", { class: "coach-mark-head", text: `${step.title} · ${stepIndex + 1}/${BASIC_COACH_MARKS.length}` }),
      el("div", { class: "coach-mark-body", text: step.text }),
      el("div", {
        class: "coach-mark-actions",
        children: [
          el("button", {
            class: "coach-mark-skip",
            text: "건너뛰기",
            attrs: { type: "button" },
            dataset: { testid: "coach-mark-skip" },
            on: {
              click: () => {
                markSeen(storage);
                dismiss();
              },
            },
          }),
          el("button", {
            class: "coach-mark-next",
            text: isLast ? "시작하기" : "다음",
            attrs: { type: "button" },
            dataset: { testid: "coach-mark-next" },
            on: {
              click: () => {
                if (isLast) {
                  markSeen(storage);
                  dismiss();
                } else {
                  renderStep(stepIndex + 1, storage);
                }
              },
            },
          }),
        ],
      }),
    ],
  });
  activeHost = card;
  document.body.append(card);
  const cardRect = card.getBoundingClientRect();
  const cardSize = {
    width: cardRect.width || CARD_WIDTH,
    height: Math.max(cardRect.height, card.scrollHeight),
  };
  const position = rect && (rect.width > 0 || rect.height > 0)
    ? coachMarkPosition({ side: step.side, anchor: rect, viewport, card: cardSize })
    : {
        left: Math.max(MARGIN, viewport.width / 2 - cardSize.width / 2),
        top: Math.min(120, Math.max(MARGIN, viewport.height - cardSize.height - MARGIN)),
      };
  card.style.left = `${position.left}px`;
  card.style.top = `${position.top}px`;
  card.style.visibility = "visible";
}

/**
 * 기본 모드 + 첫 방문일 때만 코치마크를 시작한다. 에디터 렌더 후 호출.
 * 이미 진행 중이거나, 본 적이 있거나, 전문가 모드면 아무것도 하지 않는다.
 */
export function maybeStartBasicCoachMarks(storage?: Storage | null): void {
  if (typeof document === "undefined" || !document.body) return;
  if (activeHost) return;
  if (getEditorUiMode() !== "beginner") return;
  // Welcome intent boots win the surface — do not start coach marks (and do not mark seen).
  if (shouldSuppressCoachMarksForWelcomeIntent()) return;
  const store = resolveStorage(storage);
  if (alreadySeen(store)) return;
  renderStep(0, store);
}

/** 진행 중인 코치마크를 닫는다 (전문가 모드 전환·테스트 정리용). 본 것으로 기록하지는 않는다. */
export function dismissCoachMarks(): void {
  dismiss();
}
