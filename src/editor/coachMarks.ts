// editor/coachMarks.ts
// 기본 모드 첫 방문 코치마크 3점 — 레일 → 캔버스 → AI 패널.
// 에디터에 온보딩 장치가 전무해 초보가 첫 화면에서 막히는 문제(기본 모드 UX 감사)의 최소 대응.
// localStorage 플래그로 1회만 노출하고, 건너뛰기/완주/전문가 전환 모두 '본 것'으로 처리한다.
import { shouldSuppressCoachMarksForWelcomeIntent } from "@/editor/aiBootIntent";
import { getEditorChrome } from "@/editor/editorUiMode";
import { TOOL_LABEL } from "@/editor/uiCopy";
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
    text: `${TOOL_LABEL.paint}와 ${TOOL_LABEL.erase}를 써요. 아이콘에 마우스를 올리면 같은 이름이 보입니다.`,
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
    title: "조수",
    text: "원하는 걸 그냥 한국어로 부탁하세요. Ctrl+K로 명령·맵·스킬을 검색할 수 있어요. 위쪽 초보/표준/전문가에서 화면 밀도를 바꿀 수 있어요.",
    anchorTestId: "ai-input",
    side: "left",
  },
] as const;

const CARD_WIDTH = 280;
const MARGIN = 12;

// 열려 있는 모달/팝오버 표면. 코치 카드는 이 위에 겹치면 안 된다 — 실측(2026-08-30 영역 작업 UI
// 감사): 표준 모드 웰컴 카드가 영역 작업 팝오버의 좌표 칩·타일셋 칩과 "적용 여부를 선택하세요"
// 줄을 덮었다. 배치 로직은 AI 채팅 패널 하나만 회피했고 모달의 존재 자체를 몰랐다.
// 이 저장소의 모달은 모두 `*-backdrop` 클래스를 쓴다 — 속성 선택자로 한 번에 잡는다.
// 앞의 명시 클래스들은 fakeDom(테스트 DOM)이 `[class*=]` 를 모르기 때문에 함께 둔다.
const MODAL_SURFACE_SELECTOR = [
  ".region-task-backdrop",
  ".database-modal-backdrop",
  ".event-editor-modal-backdrop",
  ".command-palette-backdrop",
  '[class*="backdrop"]',
  "dialog[open]",
].join(", ");

/**
 * 지금 화면에 실측 크기를 가진 모달 표면이 있는가.
 * 실측이 불가능한 환경(fakeDom 테스트)에서는 false — 기존 노출 동작을 그대로 둔다.
 */
function hasOpenModalSurface(): boolean {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return false;
  let surfaces: readonly Element[];
  try {
    surfaces = Array.from(document.querySelectorAll(MODAL_SURFACE_SELECTOR));
  } catch {
    return false;
  }
  return surfaces.some((surface) => {
    // 미리 만들어 숨겨 둔 자료집 창(`is-parked`, visibility:hidden)은 크기가 있어도 열린 모달이 아니다.
    if (surface.classList?.contains("is-parked")) return false;
    const rect = (surface as HTMLElement).getBoundingClientRect?.();
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  });
}

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
  // 모달이 떠 있으면 그 표면이 주인이다. 보지 않은 것으로 남겨 다음 부팅에 다시 시도한다.
  if (hasOpenModalSurface()) return;
  const store = resolveStorage(storage);
  if (alreadySeen(store, COACH_MARKS_SEEN_KEY)) return;
  renderStep(0, store);
}

// 안내는 화면에 실제로 있는 이름만 쓴다. "감독" 은 이 저장소에서 사람(사용자)을 뜻하는 말이고
// 왼쪽 패널의 접근성 이름은 "조수" 다 — 안내가 없는 이름을 가리키면 어디를 보라는 말인지 알 수 없다.
export const STANDARD_WELCOME_BODY =
  "왼쪽 조수 패널에 한 줄로 부탁하면 맵이 바뀝니다. 직접 칠하고 싶을 때만 가운데 타일 도구를 쓰면 됩니다.";

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
    const glass = document.querySelector<HTMLElement>(".ai-chat-panel.chat-dock-glass:not(.is-collapsed)");
    const glassRight = glass?.getBoundingClientRect().right ?? 0;
    const preferredLeft = glassRight > region.left ? glassRight + 12 : region.left + 12;
    const left = Math.min(Math.max(preferredLeft, MARGIN), Math.max(MARGIN, viewportWidth - width - MARGIN));
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
  // 모달·팝오버가 열려 있으면 띄우지 않는다(카드가 그 본문을 덮었다). 보지 않은 것으로 남긴다.
  if (hasOpenModalSurface()) return;
  const store = resolveStorage(storage);
  if (alreadySeen(store, STANDARD_WELCOME_SEEN_KEY)) return;
  renderStandardWelcome(store);
}

/** 진행 중인 코치마크를 닫는다 (전문가 모드 전환·테스트 정리용). 본 것으로 기록하지는 않는다. */
export function dismissCoachMarks(): void {
  dismiss();
}
