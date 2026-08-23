// editor/coachMarks.ts
// 기본 모드 첫 방문 코치마크 3점 — 레일 → 캔버스 → AI 패널.
// 에디터에 온보딩 장치가 전무해 초보가 첫 화면에서 막히는 문제(기본 모드 UX 감사)의 최소 대응.
// localStorage 플래그로 1회만 노출하고, 건너뛰기/완주/전문가 전환 모두 '본 것'으로 처리한다.
import { shouldSuppressCoachMarksForWelcomeIntent } from "@/editor/aiBootIntent";
import { getEditorChrome } from "@/editor/editorUiMode";
import { el } from "@/util/dom";

export const COACH_MARKS_SEEN_KEY = "oprn:coachmarks-basic-v1";
// 표준 모드 첫 방문 웰컴 카드 전용 키 — 초보 코치마크 키와 분리.
export const STANDARD_WELCOME_SEEN_KEY = "oprn:standard-welcome-seen";

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
    text: "맵을 드래그해 영역을 고르면 꾸미기 버튼이 떠요. 사람(NPC)은 더블클릭으로 편집합니다.",
    anchorTestId: "edit-canvas",
    side: "below",
  },
  {
    id: "ai",
    title: "감독",
    text: "원하는 걸 그냥 한국어로 부탁하세요. Ctrl+K로 명령·맵·스킬을 검색할 수 있어요. 위쪽 초보/표준/전문가에서 화면 밀도를 바꿀 수 있어요.",
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

function alreadySeen(storage: Storage | null, key: string): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markSeen(storage: Storage | null, key: string): void {
  try {
    storage?.setItem(key, "1");
  } catch {
    /* private mode / quota */
  }
}

let activeHost: HTMLElement | null = null;

function dismiss(): void {
  activeHost?.remove();
  activeHost = null;
}

function resolveStepAnchor(step: CoachMarkStep): DOMRect | undefined {
  const anchorTestIds = step.id === "ai"
    ? ["ai-input", "ai-command-bar", "ai-collapsed-restore"]
    : [step.anchorTestId];
  for (const testId of anchorTestIds) {
    const rect = document
      .querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      ?.getBoundingClientRect?.();
    if (rect && rect.width > 0) return rect;
  }
  return undefined;
}

function renderStep(stepIndex: number, storage: Storage | null): void {
  dismiss();
  const step = BASIC_COACH_MARKS[stepIndex];
  if (!step) {
    markSeen(storage, COACH_MARKS_SEEN_KEY);
    return;
  }
  const rect = resolveStepAnchor(step);
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
                markSeen(storage, COACH_MARKS_SEEN_KEY);
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
                  markSeen(storage, COACH_MARKS_SEEN_KEY);
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
  const position = rect
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
  if (!getEditorChrome().coachMarks) return;
  // Welcome intent boots win the surface — do not start coach marks (and do not mark seen).
  if (shouldSuppressCoachMarksForWelcomeIntent()) return;
  const store = resolveStorage(storage);
  if (alreadySeen(store, COACH_MARKS_SEEN_KEY)) return;
  renderStep(0, store);
}

export const STANDARD_WELCOME_BODY =
  "왼쪽 감독에게 한 줄로 부탁하면 맵이 바뀝니다. 타일로 직접 칠하고 싶을 때만 가운데 열을 쓰면 됩니다.";

function placeWelcomeOnCanvas(card: HTMLElement): void {
  const viewportWidth = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800;
  const cardRect = card.getBoundingClientRect();
  const width = cardRect.width || CARD_WIDTH;
  const height = Math.max(cardRect.height, card.scrollHeight);
  const canvas =
    document.querySelector<HTMLElement>(".canvas-area") ??
    document.querySelector<HTMLElement>("[data-testid='edit-canvas']");
  const region = canvas?.getBoundingClientRect();
  if (region && region.width > 80 && region.height > 80) {
    const left = Math.min(Math.max(region.left + 12, MARGIN), Math.max(MARGIN, viewportWidth - width - MARGIN));
    const top = Math.min(Math.max(region.top + 12, MARGIN), Math.max(MARGIN, viewportHeight - height - MARGIN));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    return;
  }
  card.style.left = `${Math.max(MARGIN, viewportWidth - width - 24)}px`;
  card.style.top = `${Math.max(MARGIN, 72)}px`;
}

/** 표준 모드 첫 방문 웰컴 카드. 타일 그림판이 아니라 캔버스 열에 붙인다. */
function renderStandardWelcome(storage: Storage | null): void {
  dismiss();
  const card = el("div", {
    class: "coach-mark-card",
    attrs: {
      role: "dialog",
      "aria-label": "표준 모드 시작 안내",
      style: `left:0;top:0;width:${CARD_WIDTH}px;visibility:hidden;`,
    },
    dataset: { testid: "standard-welcome-card" },
    children: [
      el("div", { class: "coach-mark-head", text: "표준 모드" }),
      el("div", { class: "coach-mark-body", text: STANDARD_WELCOME_BODY }),
      el("div", {
        class: "coach-mark-actions",
        children: [
          el("button", {
            class: "coach-mark-next",
            text: "시작",
            attrs: { type: "button" },
            dataset: { testid: "standard-welcome-start" },
            on: {
              click: () => {
                markSeen(storage, STANDARD_WELCOME_SEEN_KEY);
                dismiss();
              },
            },
          }),
        ],
      }),
    ],
  });
  activeHost = card;
  document.body.append(card);
  placeWelcomeOnCanvas(card);
  card.style.visibility = "visible";
}

/**
 * 표준 모드 첫 방문 웰컴 카드를 시작한다. 에디터 렌더 후 호출.
 * 이미 진행 중이거나, 본 적이 있거나, 표준 모드가 아니거나, welcome intent 부팅 중이면 아무것도 하지 않는다.
 * activeHost 단일 소유자라 초보 코치마크와 동시에 뜨지 않는다.
 */
export function maybeStartStandardWelcomeCard(storage?: Storage | null): void {
  if (typeof document === "undefined" || !document.body) return;
  if (activeHost) return;
  if (!getEditorChrome().standardWelcome) return;
  // Welcome intent boots win the surface — do not start (and do not mark seen).
  if (shouldSuppressCoachMarksForWelcomeIntent()) return;
  const store = resolveStorage(storage);
  if (alreadySeen(store, STANDARD_WELCOME_SEEN_KEY)) return;
  renderStandardWelcome(store);
}

/** 진행 중인 코치마크를 닫는다 (전문가 모드 전환·테스트 정리용). 본 것으로 기록하지는 않는다. */
export function dismissCoachMarks(): void {
  dismiss();
}
