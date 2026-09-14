// 변경 미리보기 — 조수 채팅의 주인공은 "무엇이 바뀌었나"다.
// 인라인 변경 카드(작게 두 장)와 넓은 비교 뷰어(패널 폭 상한을 벗어난 오버레이)를 만든다.
// 캔버스 렌더는 주입형(renderShot) — 테스트 DOM 은 canvas.getContext()가 null 이라
// 기본 렌더러(renderRegionSnapshot)를 그대로 쓸 수 없다. 스타일은 CSS 파티션 담당.
//
// 카드는 두 상태를 같은 DOM 으로 그린다: 「적용 전」(Pi 검토 대기)과 「적용됨」(영수증).
// 그리고 **지도 그림이 말할 수 없는 변경**은 그림 대신 사실을 말한다 — 두 캔버스는 타일과
// 이벤트 좌표만 그리므로, 그 밖의 변경은 같은 그림 두 장이 되어 "아무 일도 없었다"로 읽혔다.
import { computeMapTileChangeBounds } from "@/editor/panels/aiProposalCard";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { ChangeSummary } from "@/editor/tools/types";
import type { ChangeLedger, ChangeLedgerEntry } from "@/project/changeLedger";
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
  /** 카드가 말하는 사실 — 「적용 전」(검토 대기) / 「적용됨」(영수증). 기본은 영수증. */
  readonly state?: "proposed" | "applied";
  readonly renderShot?: ChangeShotRenderer;
  /**
   * 항목별 before → after 명세. 큰 위임의 검토는 이걸로 한다 — 칩 한 줄은 요약이지 명세가 아니다.
   * 없으면(변경 0건) 내역 구획을 그리지 않는다.
   */
  readonly ledger?: ChangeLedger;
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

/**
 * 두 패널이 **같은 그림이 되는가** — 그러면 「지금 / 적용 후」 두 장은 아무것도 말하지 않는다.
 *
 * 판정은 렌더 입력을 전부 덮는다(`renderRegionSnapshot`: 맵 크기·타일 크기·타일셋 정의·타일
 * 배열·이벤트 좌표). 타일/이벤트만 보는 `computeMapTileChangeBounds` 를 술어로 쓰지 않는 이유:
 * 그 함수는 타일셋 교체·타일 크기 변경을 보지 못해, 그림이 실제로 달라진 경우까지 접어 버린다.
 */
export function changePreviewPanesMatch(before: Project, after: Project, mapId: MapId): boolean {
  const base = before.maps[mapId];
  const next = after.maps[mapId];
  if (!base || !next) return false; // 한쪽에 없으면 그림이 다르다(새 맵·지워진 맵)
  if (base.width !== next.width || base.height !== next.height || base.tileSize !== next.tileSize) return false;
  if (JSON.stringify(before.tilesets[base.tilesetId]) !== JSON.stringify(after.tilesets[next.tilesetId])) return false;
  const eventPositions = (map: GameMap): string =>
    JSON.stringify((map.events ?? []).map((event) => [event.id, event.x, event.y]));
  return JSON.stringify(base.lowerTiles) === JSON.stringify(next.lowerTiles)
    && JSON.stringify(base.upperTiles) === JSON.stringify(next.upperTiles)
    && eventPositions(base) === eventPositions(next);
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
  ["monsterMetadataChanged", (n) => `몬스터 소재 ${n}`],
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

// 개수가 아니라 «일어났다» 만 말하는 축. 낱말은 aiProposalSummary 의 합계 줄과 같게 쓴다 —
// 같은 사실을 두 어휘로 부르면 사용자가 둘을 다른 일로 읽는다.
const FLAG_CHIP_RULES: readonly (readonly [keyof ChangeSummary, string])[] = [
  ["sessionChanged", "세션"],
  ["systemChanged", "시스템"],
];

/** 0 이 아닌 항목만 사람 말로. 카운터 → 불리언 순서로 붙는다. */
export function changePreviewChips(diff: ChangeSummary): string[] {
  const chips: string[] = [];
  for (const [field, label] of CHIP_RULES) {
    const value = diff[field];
    if (typeof value === "number" && value !== 0) chips.push(label(value));
  }
  for (const [field, label] of FLAG_CHIP_RULES) {
    if (diff[field] === true) chips.push(label);
  }
  return chips;
}

/**
 * 카드의 칩 한 줄 = 요약 카운터 + **카운터 밖 영역 이름**(`changedAreaLabels`).
 *
 * 왜 합치는 자리가 여기 하나인가: 카운터 목록은 손으로 관리돼 새 Project 필드에서 뒤처진다.
 * 퀘스트·스토리 플래그·캐릭터·맵 연결만 바뀐 턴은 `changePreviewChips` 가 빈 배열을 내고,
 * 검토 카드는 "적용/버리기" 만 남았다 — 그게 "부탁했는데 무엇이 바뀌는지 안 보인다" 였다.
 * 요약 타입(`ChangeSummary`)에 필드를 더하지 않는 이유: `isPositiveTileOnlyDiff` 같은 안전
 * 판정이 **모르는 키를 만나면 거짓**을 내므로, 영수증 어휘를 자료형에 넣으면 자동 적용이
 * 조용히 멈춘다(실측: proposalSafety 의 KNOWN_DIFF_KEYS).
 */
export function changeChipsWithAreas(diff: ChangeSummary | undefined, areas: readonly string[]): string[] {
  const chips = diff ? changePreviewChips(diff) : [];
  for (const area of areas) if (!chips.includes(area)) chips.push(area);
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

/**
 * 그림으로 말할 수 없는 변경 — 두 장을 나란히 두면 "아무 일도 없었다"로 읽힌다.
 * 여기서는 사실을 말하고, 무엇이 바뀌었는지는 칩·설명이 나른다.
 */
function wordDiffNote(chips: readonly string[]): HTMLElement {
  return el("p", {
    class: "ai-change-word-diff",
    dataset: { testid: "ai-change-word-diff" },
    text: chips.length > 0
      ? "이번 변경은 지도 그림에 나타나지 않습니다 — 아래 변경 내역을 확인하세요."
      : "이번 변경은 지도 그림에 나타나지 않습니다.",
  });
}

function ledgerRow(entry: ChangeLedgerEntry): HTMLElement {
  const verb = entry.change === "added" ? "추가" : entry.change === "removed" ? "삭제" : "변경";
  const values = entry.detail ?? [];
  return el("li", {
    class: `ai-change-ledger-row is-${entry.change}`,
    dataset: { area: entry.area, change: entry.change },
    children: [
      el("div", {
        class: "ai-change-ledger-line",
        children: [
          el("span", { class: "ai-change-ledger-area", text: entry.area }),
          el("span", { class: "ai-change-ledger-label", text: entry.label }),
          el("span", { class: "ai-change-ledger-verb", text: verb }),
          ...(entry.before !== undefined || entry.after !== undefined
            ? [el("span", {
              class: "ai-change-ledger-values",
              children: [
                el("span", { class: "ai-change-ledger-before", text: entry.before ?? "없음" }),
                el("span", { class: "ai-change-ledger-arrow", text: "→" }),
                el("span", { class: "ai-change-ledger-after", text: entry.after ?? "없음" }),
              ],
            })]
            : []),
        ],
      }),
      ...(values.length > 0
        ? [el("ul", { class: "ai-change-ledger-detail", children: values.map((line) => el("li", { text: line })) })]
        : []),
    ],
  });
}

/**
 * 변경 내역 — 항목별 before → after. 기본은 **펼침**이고 목록만 스크롤한다:
 * 접힌 채로 두면 "무엇이 바뀌었나" 를 보려고 한 번 더 눌러야 한다(그게 원래 불평이었다).
 */
function ledgerSection(ledger: ChangeLedger): HTMLElement | null {
  if (ledger.entries.length === 0) return null;
  const truncated = ledger.total > ledger.entries.length;
  const section = el("section", {
    class: "ai-change-ledger",
    dataset: { testid: "ai-change-ledger" },
    children: [],
  });
  const toggle = el("button", {
    class: "ai-change-ledger-toggle",
    text: "접기",
    attrs: { type: "button", "aria-expanded": "true", title: "변경 내역을 접습니다" },
    dataset: { testid: "ai-change-ledger-toggle" },
    on: {
      click: () => {
        const collapsed = section.dataset.collapsed !== "true";
        section.dataset.collapsed = collapsed ? "true" : "false";
        toggle.textContent = collapsed ? "펼치기" : "접기";
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      },
    },
  });
  section.append(
    el("header", {
      class: "ai-change-ledger-head",
      children: [
        el("span", { class: "ai-change-ledger-title", text: "변경 내역" }),
        el("span", {
          class: "ai-change-ledger-count",
          text: truncated ? `${ledger.entries.length}/${ledger.total}건` : `${ledger.total}건`,
          dataset: { testid: "ai-change-ledger-count" },
        }),
        ...(truncated
          ? [el("span", { class: "ai-change-ledger-note", text: "나머지는 넓게 보기에서" })]
          : []),
        toggle,
      ],
    }),
    el("ul", { class: "ai-change-ledger-list", children: ledger.entries.map(ledgerRow) }),
  );
  return section;
}

/** 인라인 변경 카드. 동기 반환 — 캔버스는 렌더러가 resolve 될 때 붙는다. */
export function renderChangePreviewCard(input: ChangePreviewInput): HTMLElement {
  const renderShot = input.renderShot ?? defaultRenderShot;
  const chips = input.chips ?? [];
  // 같은 그림 두 장은 비교가 아니다 — 그때는 그림 대신 사실을 말한다.
  const panesMatch = changePreviewPanesMatch(input.before, input.after, input.mapId);
  const region = panesMatch ? null : changePreviewRegion(input.before, input.after, input.mapId);
  const before = shotFigure("before", "ai-change-shot-before");
  const after = shotFigure("after", "ai-change-shot-after");
  const children: HTMLElement[] = [
    el("header", {
      class: "ai-change-card-head",
      children: [
        // 배지는 카드가 붙는 시점의 사실을 말한다 — 검토 대기(적용 전)와 영수증(적용됨).
        el("span", { class: "ai-change-badge", text: input.state === "proposed" ? "적용 전" : "적용됨" }),
        el("h4", { class: "ai-change-title", text: input.title }),
        ...(panesMatch
          ? []
          : [el("button", {
            class: "ai-change-expand",
            text: "넓게 보기",
            attrs: { type: "button", title: "변경을 넓은 화면으로 비교합니다" },
            dataset: { testid: "ai-change-expand" },
            on: { click: () => void openWideChangeViewer(input) },
          })]),
      ],
    }),
    chipRow(chips),
    ...(panesMatch
      ? [wordDiffNote(chips)]
      : [el("div", {
        class: "ai-change-pair",
        dataset: { testid: "ai-change-pair" },
        children: [before.figure, el("span", { class: "ai-change-arrow", text: "→" }), after.figure],
      })]),
  ];
  // 명세는 그림 뒤에 온다 — 그림은 「어디가」, 내역은 「무엇이 어떻게」. 큰 위임은 후자가 본문이다.
  const ledger = input.ledger ? ledgerSection(input.ledger) : null;
  if (ledger) children.push(ledger);
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
  const root = el("section", {
    class: "ai-change-card",
    dataset: { testid: "ai-change-card", state: input.state ?? "applied" },
    children,
  });
  if (!panesMatch) {
    attachShot(before.canvasHost, input.before, input.mapId, region, CARD_SHOT_WIDTH, renderShot);
    attachShot(after.canvasHost, input.after, input.mapId, region, CARD_SHOT_WIDTH, renderShot);
  }
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
  const panesMatch = changePreviewPanesMatch(input.before, input.after, input.mapId);
  const region = panesMatch ? null : changePreviewRegion(input.before, input.after, input.mapId);
  const before = shotFigure("before", "ai-change-wide-shot-before", "ai-change-wide-shot");
  const after = shotFigure("after", "ai-change-wide-shot-after", "ai-change-wide-shot");

  const body: HTMLElement = panesMatch
    ? wordDiffNote(input.chips ?? [])
    : el("div", {
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
      ...(panesMatch
        ? []
        : [el("div", {
          class: "ai-change-wide-modes",
          children: [modeButton("side", "나란히", setMode), modeButton("overlay", "겹쳐 보기", setMode), slider],
        })]),
      el("button", {
        class: "ai-change-wide-close",
        text: "닫기",
        attrs: { type: "button", "aria-label": "비교 닫기" },
        dataset: { testid: "ai-change-wide-close" },
        on: { click: () => close() },
      }),
    ],
  });
  // 넓게 보기는 명세를 **자르지 않고** 담는 자리다 — 잘린 항목은 여기서 전부 읽힌다.
  const ledger = input.ledger ? ledgerSection(input.ledger) : null;
  const root = el("div", {
    class: "ai-change-wide",
    attrs: { role: "dialog", "aria-modal": "true" },
    dataset: { testid: "ai-change-wide" },
    children: [head, body, ...(ledger ? [ledger] : [])],
  });
  root.addEventListener("click", onBackdropClick);
  document.addEventListener("keydown", onKeydown);
  document.body.append(root);
  if (!panesMatch) {
    attachShot(before.canvasHost, input.before, input.mapId, region, WIDE_SHOT_WIDTH, renderShot);
    attachShot(after.canvasHost, input.after, input.mapId, region, WIDE_SHOT_WIDTH, renderShot);
  }
  return { root, close };
}
