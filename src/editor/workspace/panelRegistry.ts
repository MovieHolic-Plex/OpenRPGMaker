// editor/workspace/panelRegistry.ts
// 도킹 가능한 패널의 단일 등록소.
//
// 왜 필요한가 —
// 지금까지 `editor.ts` 의 `applyEditorUiModeLayout()` 이 **어떤 패널이 어느 고정 DOM
// 슬롯에 들어가는지를 직접 알고 있었다**:
//
//   if (leftMapRoot) { leftMapRoot.hidden = !chrome.mapTree; … }
//   if (leftPaletteRoot && leftMapRoot && …) { renderTilePalette(leftPaletteRoot);
//                                              renderMapList(leftMapRoot); … }
//
// 패널을 옮기거나 새 패널을 넣으려면 그 함수와 `renderEditor` 의 DOM 조립, CSS 의
// `.left-panel-stack` 선택자를 동시에 고쳐야 했다. 즉 **패널 목록이 코드에 흩어져** 있어
// 레이아웃을 데이터로 다룰 수 없었다.
//
// 이제 패널은 `{id, 제목, 선호 도크, render}` 로 등록되고, 배치는 워크스페이스 레이아웃
// (workspaceLayout.ts)이 데이터로 들고 있다. 도크 컨테이너(dockHost.ts)가 그 둘을 합쳐 그린다.
//
// ⚠ 등록 대상은 **상시 떠 있는 표면**만이다. 자료집·자료 보관함·세계관·이벤트 에디터는
// 모달이라 도크에 넣지 않았다 — 목록만 길게 만들고 실제로 도킹되지 않으면 거짓이다.
// 모달을 패널로 승격하는 것은 별도 작업이다(각자 자기 크롬·포커스 트랩을 갖고 있다).

import { renderTilePalette } from "@/editor/panels/tilePalette";
import { renderMapList } from "@/editor/panels/mapList";

/** 패널이 놓일 수 있는 자리. 캔버스는 항상 가운데이고 도크가 아니다. */
export type DockZone = "left" | "right" | "bottom";

export type PanelId = "tiles" | "maps" | "assistant";

export type PanelDef = {
  readonly id: PanelId;
  /** 도크 탭·헤더에 보이는 이름. */
  readonly title: string;
  readonly preferredDock: DockZone;
  /**
   * 패널 본문을 host 에 그린다. host 는 매번 비워진 상태로 들어온다.
   *
   * `assistant` 는 예외로 render 가 없다 — 조수는 자체 수명주기(대화 상태)를 갖고
   * `editor.ts` 의 `mountAssistantOverlay` 가 노드를 **이동**시킨다.
   * 다시 그리면 대화가 날아가므로 레지스트리는 자리만 알려주고 그리지 않는다.
   */
  readonly render?: (host: HTMLElement) => void;
  /** 이 패널이 자기 host 를 스크롤 컨테이너로 쓰는가 (도크가 overflow 를 넘겨준다). */
  readonly scrolls: boolean;
};

const PANELS: readonly PanelDef[] = [
  {
    id: "tiles",
    title: "타일",
    preferredDock: "left",
    render: (host) => renderTilePalette(host),
    scrolls: true,
  },
  {
    id: "maps",
    title: "맵",
    preferredDock: "left",
    render: (host) => renderMapList(host),
    scrolls: true,
  },
  {
    id: "assistant",
    title: "조수",
    preferredDock: "right",
    scrolls: false,
  },
] as const;

const BY_ID = new Map<PanelId, PanelDef>(PANELS.map((panel) => [panel.id, panel]));

export function allPanels(): readonly PanelDef[] {
  return PANELS;
}

export function panelById(id: PanelId): PanelDef | undefined {
  return BY_ID.get(id);
}

export function isPanelId(value: unknown): value is PanelId {
  return typeof value === "string" && BY_ID.has(value as PanelId);
}

/** 레이아웃에 적히지 않은 패널을 복구할 때 쓴다. */
export function defaultDockFor(id: PanelId): DockZone {
  return BY_ID.get(id)?.preferredDock ?? "left";
}

const ORDER = new Map<PanelId, number>(PANELS.map((panel, index) => [panel.id, index]));

/**
 * 한 도크 안의 패널 순서는 **레지스트리 순서로 고정**된다. 사용자 클릭 순서를 따르지 않는다.
 *
 * 왜 — `.left-panel` 은 `grid-template-rows: minmax(0,1fr) 6px var(--map-tree-height)` 인
 * 3행 그리드다(figma-editor/02, 07). 즉 **1행은 늘어나고 3행은 고정 높이**라 자리마다 성격이
 * 다르다. 순서를 자유롭게 뒤집으면 맵 트리가 늘어나는 행을 차지하고 팔레트가 300px 칸에
 * 갇혀 실측 73px 까지 찌그러진다(실제로 측정했다). 그래서 이번 라운드가 데이터로 다루는
 * 것은 **구성**(어떤 패널이 어느 도크에)이고, 자유 재배열은 그리드를 패널 개수에 맞춰
 * 계산하도록 CSS 를 고친 뒤의 일이다.
 */
export function sortPanels(ids: readonly PanelId[]): PanelId[] {
  return [...ids].sort((a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0));
}
