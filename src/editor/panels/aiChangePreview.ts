// 변경 미리보기 — 조수 채팅의 주인공은 "무엇이 바뀌었나"다.
// 인라인 변경 카드(작게 두 장)와 넓은 비교 뷰어(패널 폭 상한을 벗어난 오버레이)를 만든다.
// 캔버스 렌더는 주입형(renderShot) — 테스트 DOM 은 canvas.getContext()가 null 이라
// 기본 렌더러(renderRegionSnapshot)를 그대로 쓸 수 없다. 스타일은 CSS 파티션 담당.
import { computeMapTileChangeBounds } from "@/editor/panels/aiProposalCard";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { ChangeSummary } from "@/editor/tools/types";
import type { GameMap, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";

const CHANGE_BOUNDS_PAD = 3;
const CARD_SHOT_WIDTH = 320;
const WIDE_SHOT_WIDTH = 900;
const FALLBACK_TEXT = "미리보기 불가";

export interface ChangePreviewShot {
  readonly kind: "before" | "after";
  readonly project: Project;
}

export type ChangeShotRenderer = (
  project: Project,
  map: GameMap,
  region: RegionRect,
  targetWidth: number,
) => Promise<HTMLCanvasElement>;

export interface ChangePreviewInput {
  readonly before: Project;
  readonly after: Project;
  readonly mapId: MapId;
  readonly title: string;
  readonly detail?: string;
  readonly chips?: readonly string[];
  readonly onUndo?: () => void;
  readonly renderShot?: ChangeShotRenderer;
}

const defaultRenderShot: ChangeShotRenderer = (project, map, region, targetWidth) =>
  renderRegionSnapshot(project, map, region, { targetWidth });

/** 변경 영역 — 타일/이벤트 diff bbox(+pad), 없으면 맵 전체, 맵 자체가 없으면 null. */
export function changePreviewRegion(before: Project, after: Project, mapId: MapId): RegionRect | null {
  const bounds = computeMapTileChangeBounds(before, after, mapId, CHANGE_BOUNDS_PAD);
  if (bounds) return { x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h };
  const map = after.maps[mapId] ?? before.maps[mapId];
  if (!map) return null;
  return { x: 0, y: 0, width: map.width, height: map.height };
}

type ChipRule = readonly [keyof ChangeSummary, (count: number) => string];

// 순서 고정 — 사용자가 매번 같은 자리에서 같은 정보를 읽게 한다.
const CHIP_RULES: readonly ChipRule[] = [
  ["tilesChanged", (n) => `타일 ${n}`],
  ["eventsAdded", (n) => `이벤트 +${n}`],
  ["eventsModified", (n) => `이벤트 수정 ${n}`],
  ["eventsRemoved", (n) => `이벤트 삭제 ${n}`],
  ["mapsAdded", (n) => `맵 +${n}`],
  ["mapsRemoved", (n) => `맵 삭제 ${n}`],
  ["mapPropertiesChanged", (n) => `맵 속성 ${n}`],
  ["audioDescriptionsChanged", (n) => `오디오 설명 ${n}`],
  ["dbRecordsChanged", (n) => `DB ${n}`],
  ["tilesetsChanged", (n) => `타일셋 ${n}`],
  ["switchesAdded", (n) => `스위치 +${n}`],
  ["variablesAdded", (n) => `변수 +${n}`],
  ["worldEntitiesAdded", (n) => `세계관 +${n}`],
  ["worldEntitiesModified", (n) => `세계관 수정 ${n}`],
  ["palettePresetsAdded", (n) => `팔레트 +${n}`],
  ["palettePresetsModified", (n) => `팔레트 수정 ${n}`],
  ["endingsChanged", (n) => `엔딩 ${n}`],
];

/** 0 이 아닌 항목만 사람 말로. */
export function changePreviewChips(diff: ChangeSummary): string[] {
  const chips: string[] = [];
  for (const [field, label] of CHIP_RULES) {
    const value = diff[field];
    if (typeof value === "number" && value !== 0) chips.push(label(value));
  }
  return chips;
}

function shotFallback(): HTMLElement {
  return el("span", { class: "ai-change-shot-fallback", text: FALLBACK_TEXT });
}

/** 컨테이너에 캔버스를 비동기로 붙인다. 실패하면 폴백 문구 — 예외는 밖으로 새지 않는다. */
function attachShot(
  container: HTMLElement,
  project: Project,
  mapId: MapId,
  region: RegionRect | null,
  targetWidth: number,
  renderShot: ChangeShotRenderer,
): void {
  const map = project.maps[mapId];
  if (!map || !region) {
    container.append(shotFallback());
    return;
  }
  void renderShot(project, map, region, targetWidth).then(
    (canvas) => {
      container.append(canvas);
    },
    () => {
      container.append(shotFallback());
    },
  );
}

function shotFigure(
  kind: "before" | "after",
  testid: string,
  extraClass?: string,
): { readonly figure: HTMLElement; readonly canvasHost: HTMLElement } {
  const canvasHost = el("div", {
    class: extraClass ? `ai-change-shot-canvas ${extraClass}` : "ai-change-shot-canvas",
    dataset: { testid },
  });
  const figure = el("figure", {
    class: "ai-change-shot",
    dataset: { kind },
    children: [
      // DESIGN.md: 타일을 바꾸는 카드는 항상 「지금 / 적용 후」 쌍이다(승인 카드 시절 어휘를 그대로 쓴다).
      el("figcaption", { class: "ai-change-shot-label", text: kind === "before" ? "지금" : "적용 후" }),
      canvasHost,
    ],
  });
  return { figure, canvasHost };
}

function chipRow(chips: readonly string[]): HTMLElement {
  return el("div", {
    class: "ai-change-chips",
    children: chips.map((chip) => el("span", { class: "ai-change-chip", text: chip })),
  });
}

/** 인라인 변경 카드. 동기 반환 — 캔버스는 렌더러가 resolve 될 때 붙는다. */
export function renderChangePreviewCard(input: ChangePreviewInput): HTMLElement {
  const renderShot = input.renderShot ?? defaultRenderShot;
  const region = changePreviewRegion(input.before, input.after, input.mapId);
  const before = shotFigure("before", "ai-change-shot-before");
  const after = shotFigure("after", "ai-change-shot-after");
  const expand = el("button", {
    class: "ai-change-expand",
    text: "넓게 보기",
    attrs: { type: "button", title: "변경을 넓은 화면으로 비교합니다" },
    dataset: { testid: "ai-change-expand" },
    on: { click: () => void openWideChangeViewer(input) },
  });
  const children: HTMLElement[] = [
    el("header", {
      class: "ai-change-card-head",
      children: [
        // 카드가 붙는 시점에 변경은 이미 적용돼 있다 — 배지가 사실을 말한다(「변경」 은 상태가 아니었다).
        el("span", { class: "ai-change-badge", text: "적용됨" }),
        el("h4", { class: "ai-change-title", text: input.title }),
        expand,
      ],
    }),
    chipRow(input.chips ?? []),
    el("div", {
      class: "ai-change-pair",
      dataset: { testid: "ai-change-pair" },
      children: [before.figure, el("span", { class: "ai-change-arrow", text: "→" }), after.figure],
    }),
  ];
  if (input.detail) children.push(el("div", { class: "ai-change-detail", text: input.detail }));
  if (input.onUndo) {
    const onUndo = input.onUndo;
    children.push(
      el("footer", {
        class: "ai-change-card-actions",
        children: [
          el("button", {
            class: "ai-change-undo",
            text: "되돌리기",
            attrs: { type: "button", title: "이 변경을 되돌립니다" },
            dataset: { testid: "ai-change-undo" },
            on: { click: () => onUndo() },
          }),
        ],
      }),
    );
  }
  const root = el("section", { class: "ai-change-card", dataset: { testid: "ai-change-card" }, children });
  attachShot(before.canvasHost, input.before, input.mapId, region, CARD_SHOT_WIDTH, renderShot);
  attachShot(after.canvasHost, input.after, input.mapId, region, CARD_SHOT_WIDTH, renderShot);
  return root;
}

function modeButton(mode: "side" | "overlay", label: string, onPick: (mode: "side" | "overlay") => void): HTMLElement {
  return el("button", {
    class: `ai-change-wide-mode is-${mode}`,
    text: label,
    attrs: { type: "button" },
    dataset: { testid: `ai-change-wide-mode-${mode}` },
    on: { click: () => onPick(mode) },
  });
}

/** 넓은 비교 뷰어 — body 오버레이. 나란히 / 겹쳐 보기 두 모드. */
export function openWideChangeViewer(input: ChangePreviewInput): { readonly root: HTMLElement; readonly close: () => void } {
  const renderShot = input.renderShot ?? defaultRenderShot;
  const region = changePreviewRegion(input.before, input.after, input.mapId);
  const before = shotFigure("before", "ai-change-wide-shot-before", "ai-change-wide-shot");
  const after = shotFigure("after", "ai-change-wide-shot-after", "ai-change-wide-shot");

  const body = el("div", {
    class: "ai-change-wide-body",
    dataset: { mode: "side" },
    children: [before.figure, after.figure],
  });
  const setMode = (mode: "side" | "overlay"): void => {
    body.dataset.mode = mode;
  };
  const slider = el("input", {
    class: "ai-change-wide-slider",
    attrs: { type: "range", min: "0", max: "100", "aria-label": "이후 노출 비율" },
    value: 100,
    dataset: { testid: "ai-change-wide-slider" },
    on: {
      input: () => {
        const percent = Math.min(100, Math.max(0, Number(slider.value) || 0));
        after.canvasHost.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      },
    },
  });
  after.canvasHost.style.clipPath = "inset(0 0% 0 0)";

  const close = (): void => {
    document.removeEventListener("keydown", onKeydown);
    root.removeEventListener("click", onBackdropClick);
    root.remove();
  };
  const onKeydown = (event: Event): void => {
    if ((event as KeyboardEvent).key === "Escape") close();
  };
  const onBackdropClick = (event: Event): void => {
    if (event.target === root) close();
  };

  const head = el("header", {
    class: "ai-change-wide-head",
    children: [
      el("h3", { class: "ai-change-wide-title", text: input.title }),
      chipRow(input.chips ?? []),
      el("div", {
        class: "ai-change-wide-modes",
        children: [modeButton("side", "나란히", setMode), modeButton("overlay", "겹쳐 보기", setMode), slider],
      }),
      el("button", {
        class: "ai-change-wide-close",
        text: "닫기",
        attrs: { type: "button", "aria-label": "비교 닫기" },
        dataset: { testid: "ai-change-wide-close" },
        on: { click: () => close() },
      }),
    ],
  });
  const root = el("div", {
    class: "ai-change-wide",
    attrs: { role: "dialog", "aria-modal": "true" },
    dataset: { testid: "ai-change-wide" },
    children: [head, body],
  });
  root.addEventListener("click", onBackdropClick);
  document.addEventListener("keydown", onKeydown);
  document.body.append(root);
  attachShot(before.canvasHost, input.before, input.mapId, region, WIDE_SHOT_WIDTH, renderShot);
  attachShot(after.canvasHost, input.after, input.mapId, region, WIDE_SHOT_WIDTH, renderShot);
  return { root, close };
}
