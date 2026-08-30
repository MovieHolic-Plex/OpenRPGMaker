// 맵 목록 옆에 붙는 상세 칸 — "고른 맵이 무슨 맵인가"를 한 화면에 펼친다.
//
// 왜: 초보 모드 맵 플라이아웃은 340px 한 칸이었고 행 메타가 `13×10 · 1이벤트 · 문2` 뿐이라
// 같은 규격의 집 내부 10장이 전부 같은 글자였다(실측). 행을 늘려도 340px 안에서는 잘린다
// (map-panel.modern.css §초보 플라이아웃의 1fr 트랙 93.59px 기록 참고). 그래서 목록은
// 이름 위주로 두고 정보는 이 칸으로 옮긴다.
//
// 계약: 순수 모델(project/mapInspection.ts)이 값을 만들고 여기서는 그리기만 한다. 동작은
// 전부 호출자(mapList.ts)가 주입한다 — 이 파일이 actions.ts 를 직접 부르면 mapList ↔
// inspector 순환 import 가 생긴다.
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import type { MapDiagnostic, MapInspection } from "@/project/mapInspection";
import { el } from "@/util/dom";

/** 미리보기가 쓸 수 있는 최대 CSS 픽셀 상자. 상세 칸 폭에서 여백을 뺀 값 — CSS 와 같이 움직인다. */
const PREVIEW_MAX_WIDTH = 300;
/** 150 은 "정사각형 맵을 알아볼 수 있는 최소" 와 "이벤트·연결·진단이 접히지 않는 최대"의
 *  교점이다 — 200 으로 두면 정사각형 맵에서 상세 절반이 스크롤 아래로 내려갔다(실측). */
const PREVIEW_MAX_HEIGHT = 150;

/**
 * 캔버스를 맵 비율에 맞춘다. 고정 300×176 상자에 100×100 맵을 넣으면 캔버스 안에
 * 좌우 62px 씩 검은 여백이 생겼다(실측) — 렌더러가 비율을 지키며 레터박스를 칠하기
 * 때문이다. 캔버스 자체를 비율대로 만들면 여백이 캔버스 밖(패널 배경)으로 나가
 * 액자처럼 읽힌다.
 */
function previewSize(mapWidth: number, mapHeight: number): { readonly width: number; readonly height: number } {
  const w = Math.max(1, mapWidth);
  const h = Math.max(1, mapHeight);
  const scale = Math.min(PREVIEW_MAX_WIDTH / w, PREVIEW_MAX_HEIGHT / h);
  return {
    height: Math.max(48, Math.min(PREVIEW_MAX_HEIGHT, Math.round(h * scale))),
    width: Math.max(64, Math.min(PREVIEW_MAX_WIDTH, Math.round(w * scale))),
  };
}

export type MapInspectorAction = {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  /** 강조 버튼(맵 설정처럼 이 칸의 주 동작) 하나만 true. */
  readonly primary?: boolean;
  readonly run: () => void;
};

export type MapInspectorView =
  | { readonly kind: "map"; readonly inspection: MapInspection; readonly actions: readonly MapInspectorAction[] }
  /** 분류 폴더를 골랐거나 아직 아무 맵도 안 골랐을 때. 빈 칸을 남기지 않고 이유를 적는다. */
  | { readonly kind: "empty"; readonly text: string };

export function renderMapInspector(view: MapInspectorView): HTMLElement {
  const pane = el("div", {
    class: "map-inspector",
    attrs: { "aria-label": "맵 상세", role: "group" },
    dataset: { testid: "map-inspector", inspectorKind: view.kind },
  });
  if (view.kind === "empty") {
    pane.append(el("p", { class: "map-inspector-empty", text: view.text, dataset: { testid: "map-inspector-empty" } }));
    return pane;
  }

  const { actions, inspection } = view;
  // 스크롤은 이 안쪽만 한다 — 동작 버튼이 스크롤 영역에 있으면 맵 하나만 골라도
  // 「맵 설정」이 접힌 아래로 내려가 보이지 않는다(실측).
  const scroll = el("div", { class: "map-inspector-scroll", dataset: { testid: "map-inspector-scroll" } });
  scroll.append(makeHead(inspection));
  scroll.append(makeStatList(inspection));
  // 경고가 있으면 맨 위로 올린다. 손을 써야 하는 유일한 정보라 접힌 아래에 두면 못 본다.
  const hasFindings = inspection.diagnostics.length > 0;
  if (hasFindings) scroll.append(makeDiagnosticSection(inspection.diagnostics));
  scroll.append(makeEventSection(inspection));
  scroll.append(makeLinkSection(inspection));
  scroll.append(makeEncounterSection(inspection));
  if (inspection.options.length > 0) scroll.append(makeOptionSection(inspection));
  if (!hasFindings) scroll.append(makeDiagnosticSection(inspection.diagnostics));
  pane.append(scroll);
  pane.append(makeActionRow(actions));
  return pane;
}

function makeHead(inspection: MapInspection): HTMLElement {
  const title = el("div", {
    class: "map-inspector-title",
    children: [
      el("span", {
        class: "map-inspector-name",
        text: inspection.name,
        attrs: { title: inspection.name },
        dataset: { testid: "map-inspector-name" },
      }),
      ...(inspection.isStart
        ? [el("span", { class: "map-inspector-badge is-start", text: "시작 맵", dataset: { testid: "map-inspector-start-badge" } })]
        : []),
    ],
  });
  const size = previewSize(inspection.width, inspection.height);
  const canvas = createMapThumbnail(inspection.mapId, {
    className: "map-inspector-preview-canvas",
    height: size.height,
    testId: "map-inspector-preview",
    width: size.width,
  });
  // 백킹은 2배로 잡혀 있다(mapThumbnail) — CSS 크기를 못 박아야 1:1 로 안 보인다.
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  return el("div", {
    class: "map-inspector-head",
    children: [el("div", { class: "map-inspector-preview", children: [canvas] }), title],
  });
}

function makeStatList(inspection: MapInspection): HTMLElement {
  const rows: readonly (readonly [string, string, string])[] = [
    ["size", "크기", `${inspection.width}×${inspection.height} · ${inspection.tileCount.toLocaleString("ko-KR")}칸`],
    ["tileset", "타일셋", inspection.tilesetName ?? "없음"],
    ["bgm", "BGM", inspection.bgmLabel],
    ["parent", "상위 맵", inspection.parentName ?? "루트"],
    ["children", "하위 맵", inspection.childCount > 0 ? `${inspection.childCount}개` : "없음"],
  ];
  return el("dl", {
    class: "map-inspector-stats",
    dataset: { testid: "map-inspector-stats" },
    children: rows.flatMap(([key, label, value]) => [
      el("dt", { text: label }),
      el("dd", { text: value, attrs: { title: value }, dataset: { testid: `map-inspector-stat-${key}` } }),
    ]),
  });
}

function makeEventSection(inspection: MapInspection): HTMLElement {
  const { events } = inspection;
  const chips: readonly (readonly [string, string, number])[] = [
    ["npc", "NPC", events.npc],
    ["door", "이동문", events.door],
    ["chest", "보물상자", events.chest],
    ["shop", "상점·여관", events.shop],
    ["other", "기타", events.other],
  ];
  return makeSection({
    body: el("div", {
      class: "map-inspector-chips",
      children: chips.map(([key, label, count]) => el("span", {
        class: "map-inspector-chip" + (count === 0 ? " is-zero" : ""),
        dataset: { testid: `map-inspector-event-${key}` },
        children: [
          el("span", { class: "map-inspector-chip-label", text: label }),
          el("span", { class: "map-inspector-chip-count", text: String(count) }),
        ],
      })),
    }),
    count: `${events.total}개`,
    testId: "map-inspector-events",
    title: "이벤트",
  });
}

function makeLinkSection(inspection: MapInspection): HTMLElement {
  const { links } = inspection;
  const chips: readonly (readonly [string, string, number])[] = [
    ["outgoing", "나가는 이동", links.outgoingTransfers],
    ["incoming", "들어오는 이동", links.incomingTransfers],
    ["connection", "맵 연결", links.connections],
  ];
  return makeSection({
    body: el("div", {
      class: "map-inspector-chips",
      children: chips.map(([key, label, count]) => el("span", {
        class: "map-inspector-chip" + (count === 0 ? " is-zero" : ""),
        dataset: { testid: `map-inspector-link-${key}` },
        children: [
          el("span", { class: "map-inspector-chip-label", text: label }),
          el("span", { class: "map-inspector-chip-count", text: String(count) }),
        ],
      })),
    }),
    count: links.playLinkCount === 0 ? "고립" : `${links.playLinkCount}개`,
    countWarning: links.playLinkCount === 0,
    testId: "map-inspector-links",
    title: "연결",
  });
}

function makeEncounterSection(inspection: MapInspection): HTMLElement {
  const { encounter } = inspection;
  const detail = encounter.rate === 0
    ? "조우율 0 — 랜덤 전투가 발생하지 않습니다."
    : `조우율 ${encounter.rate} · 적 그룹 ${encounter.troopCount}개 · 인카운터 표 ${encounter.tableCount}줄`;
  return makeSection({
    body: el("p", { class: "map-inspector-line", text: detail, dataset: { testid: "map-inspector-encounter-detail" } }),
    count: encounter.enabled ? (encounter.actionCombat ? "액션" : "켜짐") : "꺼짐",
    testId: "map-inspector-encounter",
    title: "인카운터",
  });
}

function makeOptionSection(inspection: MapInspection): HTMLElement {
  return makeSection({
    body: el("div", {
      class: "map-inspector-chips",
      children: inspection.options.map((flag) => el("span", {
        class: "map-inspector-chip is-flag",
        text: flag.label,
        dataset: { testid: `map-inspector-option-${flag.id}` },
      })),
    }),
    count: `${inspection.options.length}개`,
    testId: "map-inspector-options",
    title: "맵 옵션",
  });
}

function makeDiagnosticSection(diagnostics: readonly MapDiagnostic[]): HTMLElement {
  const warnings = diagnostics.filter((item) => item.severity === "warning").length;
  const body = diagnostics.length === 0
    ? el("p", { class: "map-inspector-line", text: "문제 없음.", dataset: { testid: "map-inspector-diagnostic-clean" } })
    : el("ul", {
      class: "map-inspector-diagnostics",
      children: diagnostics.map((item) => el("li", {
        class: "map-inspector-diagnostic is-" + item.severity,
        text: item.text,
        dataset: { testid: `map-inspector-diagnostic-${item.id}` },
      })),
    });
  return makeSection({
    body,
    count: diagnostics.length === 0 ? "0" : `${diagnostics.length}건`,
    countWarning: warnings > 0,
    testId: "map-inspector-diagnostics",
    title: "진단",
  });
}

function makeSection(spec: {
  readonly body: HTMLElement;
  readonly count: string;
  readonly countWarning?: boolean;
  readonly testId: string;
  readonly title: string;
}): HTMLElement {
  return el("section", {
    class: "map-inspector-section",
    dataset: { testid: spec.testId },
    children: [
      el("h4", {
        class: "map-inspector-section-head",
        children: [
          el("span", { class: "map-inspector-section-title", text: spec.title }),
          el("span", {
            class: "map-inspector-section-count" + (spec.countWarning ? " is-warning" : ""),
            text: spec.count,
          }),
        ],
      }),
      spec.body,
    ],
  });
}

function makeActionRow(actions: readonly MapInspectorAction[]): HTMLElement {
  const row = el("div", { class: "map-inspector-actions", dataset: { testid: "map-inspector-actions" } });
  for (const action of actions) {
    const button = el("button", {
      class: "map-inspector-action" + (action.primary ? " is-primary" : ""),
      text: action.label,
      attrs: {
        type: "button",
        // 비활성 버튼이 왜 비활성인지 말하지 않으면 「눌러도 아무 일 없는 버튼」과 구분이
        // 안 된다 — 이 저장소가 헤더 '시작 맵 지정' 에서 이미 밟은 결함이다.
        title: action.disabled ? (action.disabledReason ?? action.label) : action.label,
      },
      dataset: { testid: `map-inspector-action-${action.id}` },
      on: {
        click: (event) => {
          event.stopPropagation();
          if (action.disabled) return;
          action.run();
        },
      },
    }) as HTMLButtonElement;
    button.disabled = action.disabled === true;
    row.append(button);
  }
  return row;
}
