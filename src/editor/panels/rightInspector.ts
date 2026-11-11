// editor/panels/rightInspector.ts
// 캔버스 오른쪽의 늘 보이는 인스펙터(2026-11-03 목업 「광장 · 맵 · 40 × 30 칸」).
//
// 무엇을 보이나: 고른 것의 이름을 머리에, 그 아래 「라벨 — 값」 행 몇 줄.
//   - 아무것도 안 고름 → 지금 맵: 기본(이름·타일셋·크기) · 소리(배경 음악·환경음) · 전투(적 출현·전투 배경)
//     · 이 칸(마우스가 가리킨 칸의 타일·통행) · 접힌 「고급」(나머지 맵 설정 항목).
//   - 이벤트 레이어에서 이벤트를 고름 → 그 이벤트: 이름·위치·실행 조건 + 「이벤트 편집」.
// 값은 여기서 고치지 않는다. 행을 누르면 그 값을 고치는 맵 설정 창의 항목이나 이벤트 편집기가 열린다 —
// 맵 설정의 정본은 renderMapProps 하나다(mapPropertiesDialog.ts 머리 주석).
//
// 조수와의 관계: 조수를 펼치면 이 열은 숨고 조수 도크가 그 자리를 쓴다(editor.ts 가 레이아웃에
// `is-assistant-open` 을 붙인다). 좁은 창(<1200px)에서는 캔버스 폭을 지키려고 숨는다(right-inspector.css).
//
// 다시 그리기: 맵·선택·레이어가 바뀌거나 프로젝트가 바뀔 때, 그리고 마우스가 다른 칸으로 갈 때.
// 매번 행 값의 지문을 비교해 **바뀐 경우에만** DOM 을 갈아 끼운다 — 칠하는 동안 저장 통지가 와도 열이 깜박이지 않는다.

import { editorState } from "@/editor/editorState";
import { triggerLabel } from "@/editor/eventMarkerUx";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { openMapPropertiesDialog, type MapPropertiesFocus } from "@/editor/panels/mapPropertiesDialog";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
import { isPassable } from "@/project/collision";
import { eventDisplayName } from "@/project/eventDisplayName";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";
import { el } from "@/util/dom";

/** mapProps.ts SECTION_ORDER 의 항목 id. */
type MapSection = "general" | "bgm" | "encounter" | "battle" | "restrictions" | "spawns" | "background" | "minimap" | "transit" | "sunlight" | "climate" | "clouds" | "atmosphere";

export type InspectorRow = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly section?: MapSection;
  readonly focus?: MapPropertiesFocus;
};

export type InspectorGroup = { readonly key: string; readonly title: string; readonly rows: readonly InspectorRow[] };

export type InspectorView =
  | { readonly kind: "empty"; readonly title: string }
  | { readonly kind: "map"; readonly mapId: string; readonly title: string; readonly subtitle: string; readonly groups: readonly InspectorGroup[] }
  | { readonly kind: "event"; readonly mapId: string; readonly eventId: string; readonly title: string; readonly subtitle: string; readonly groups: readonly InspectorGroup[] };

/** 처음 30분에 만지지 않는 맵 설정 항목 — 접힌 「고급」 안에 둔다. */
const ADVANCED_SECTIONS: readonly { readonly section: MapSection; readonly label: string }[] = [
  { section: "background", label: "맵 배경" },
  { section: "restrictions", label: "행동 제한" },
  { section: "spawns", label: "필드 스폰" },
  { section: "minimap", label: "미니맵" },
  { section: "transit", label: "탈것(차·버스·전차)" },
  { section: "sunlight", label: "태양과 그림자" },
  { section: "climate", label: "기후" },
  { section: "clouds", label: "구름 그림자" },
  { section: "atmosphere", label: "환경 효과" },
];

// 인스펙터는 마우스가 칸을 옮길 때마다 다시 지어진다. 이름 하나를 얻으려고 음악·효과음 카탈로그 전체를 매번 다시 만들었다
// (2026-11-08 실측, 폴른 스타 칠하기 프로파일의 0.3s). 스토어는 바뀔 때마다 새 프로젝트 객체를 넣으므로 같은 객체 안에서만 재사용한다.
const resourceNameCache = new WeakMap<Project, Map<string, string>>();

function resourceName(project: Project, kind: "music" | "sound" | "backdrop", id: string | undefined): string {
  if (!id) return "";
  let names = resourceNameCache.get(project);
  if (!names) {
    names = new Map();
    resourceNameCache.set(project, names);
  }
  const key = `${kind}\u0000${id}`;
  const cached = names.get(key);
  if (cached !== undefined) return cached;
  const name = listDatabaseResourceOptions(kind, project).find((item) => item.id === id)?.name ?? "";
  // 빈 이름은 기억하지 않는다 — 전체 BGM 설치처럼 프로젝트 밖에서 곡이 생기면 다음 그리기에서 바로 보여야 한다.
  if (name) names.set(key, name);
  return name;
}

function bgmValue(project: Project, map: GameMap): string {
  if (map.bgm?.mode === "none") return "무음";
  if (map.bgm?.mode === "custom") return resourceName(project, "music", map.bgm.resourceId) || "곡 미지정";
  return "상위 맵을 따름";
}

function bgsValue(project: Project, map: GameMap): string {
  if (!map.bgs) return "유지";
  if (map.bgs.mode === "none") return "없음";
  return resourceName(project, "sound", map.bgs.resourceId) || "곡 미지정";
}

function encounterValue(map: GameMap): string {
  const rate = map.encounterRate ?? 0;
  if (rate === 0 && (map.encounterTable?.length ?? 0) === 0) return "끔";
  return `빈도 ${rate}`;
}

function cellTileValue(project: Project, map: GameMap, x: number, y: number): string {
  const index = y * map.width + x;
  const meta = project.tilesets[map.tilesetId]?.tileMeta;
  const stack = [map.upperOverlayTiles?.[index], map.upperTiles[index], map.lowerOverlayTiles?.[index], map.lowerTiles[index]];
  for (const tile of stack) {
    if (typeof tile !== "number" || tile < 0) continue;
    const label = meta?.[tile]?.label?.trim();
    return label || `타일 ${tile}`;
  }
  return "빈칸";
}

export function buildInspectorView(
  project: Project,
  state: { readonly currentMapId: string | null; readonly selectedEventId: string | null; readonly layer: string },
  cell: { readonly x: number; readonly y: number } | null,
): InspectorView {
  const map = state.currentMapId ? project.maps[state.currentMapId] : undefined;
  if (!map) return { kind: "empty", title: "맵을 선택하세요." };
  const event = state.layer === "event" && state.selectedEventId
    ? map.events.find((item) => item.id === state.selectedEventId)
    : undefined;
  if (event) {
    const name = eventDisplayName(event);
    return {
      kind: "event", mapId: map.id, eventId: event.id, title: name, subtitle: `이벤트 · ${event.x}, ${event.y}`,
      groups: [{
        key: "event", title: "기본", rows: [
          { key: "event-name", label: "이름", value: name },
          { key: "event-position", label: "위치", value: `${event.x}, ${event.y}` },
          { key: "event-trigger", label: "실행 조건", value: triggerLabel(event.pages?.[0]?.trigger ?? event.trigger) },
          { key: "event-pages", label: "페이지", value: String(Math.max(1, event.pages?.length ?? 0)) },
        ],
      }],
    };
  }
  const inside = cell && cell.x >= 0 && cell.y >= 0 && cell.x < map.width && cell.y < map.height ? cell : null;
  return {
    kind: "map", mapId: map.id, title: map.name, subtitle: `맵 · ${map.width} × ${map.height} 칸`,
    groups: [
      {
        key: "basic", title: "기본", rows: [
          { key: "name", label: "이름", value: map.name, section: "general" },
          { key: "tileset", label: "타일셋", value: project.tilesets[map.tilesetId]?.name ?? map.tilesetId, focus: "tileset" },
          { key: "size", label: "크기", value: `${map.width} × ${map.height}`, section: "general" },
        ],
      },
      {
        key: "sound", title: "소리", rows: [
          { key: "bgm", label: "배경 음악", value: bgmValue(project, map), section: "bgm" },
          { key: "bgs", label: "환경음", value: bgsValue(project, map), section: "bgm" },
        ],
      },
      {
        key: "battle", title: "전투", rows: [
          { key: "encounter", label: "적 출현", value: encounterValue(map), focus: "encounter" },
          { key: "battle-background", label: "전투 배경", value: resourceName(project, "backdrop", map.battleBackground) || "타일셋 기본", section: "battle" },
        ],
      },
      {
        key: "cell", title: "이 칸", rows: [
          { key: "cell-tile", label: "타일", value: inside ? cellTileValue(project, map, inside.x, inside.y) : "—" },
          { key: "cell-pass", label: "통행", value: inside ? (isPassable(project, map, inside.x, inside.y) ? "지나감" : "막힘") : "—" },
        ],
      },
    ],
  };
}

function openRow(mapId: string, row: InspectorRow): void {
  const map = store.getCurrent().maps[mapId];
  if (!map) return;
  if (row.focus) openMapPropertiesDialog(map.id, map.name, { focus: row.focus });
  else if (row.section) openMapPropertiesDialog(map.id, map.name, { section: row.section });
}

function renderRow(mapId: string, row: InspectorRow): HTMLElement {
  const children = [
    el("span", { class: "right-inspector-label", text: row.label }),
    el("span", { class: "right-inspector-value", text: row.value, attrs: { title: row.value } }),
  ];
  if (!row.section && !row.focus) {
    return el("div", { class: "right-inspector-row", dataset: { testid: `right-inspector-row-${row.key}` }, children });
  }
  return el("button", {
    class: "right-inspector-row is-action",
    attrs: { type: "button" },
    dataset: { testid: `right-inspector-row-${row.key}` },
    children,
    on: { click: () => openRow(mapId, row) },
  });
}

function renderGroup(mapId: string, group: InspectorGroup): HTMLElement {
  return el("section", {
    class: "right-inspector-group",
    dataset: { testid: `right-inspector-group-${group.key}` },
    children: [
      el("h3", { class: "right-inspector-group-title", text: group.title }),
      el("div", { class: "right-inspector-card", children: group.rows.map((row) => renderRow(mapId, row)) }),
    ],
  });
}

function renderView(view: InspectorView): HTMLElement[] {
  if (view.kind === "empty") return [el("p", { class: "right-inspector-empty", text: view.title })];
  const nodes: HTMLElement[] = [
    el("header", {
      class: "right-inspector-head",
      children: [
        el("h2", { class: "right-inspector-title", text: view.title, dataset: { testid: "right-inspector-title" } }),
        el("p", { class: "right-inspector-subtitle", text: view.subtitle, dataset: { testid: "right-inspector-subtitle" } }),
      ],
    }),
    ...view.groups.map((group) => renderGroup(view.mapId, group)),
  ];
  if (view.kind === "event") {
    const { mapId, eventId } = view;
    nodes.push(el("button", {
      class: "right-inspector-action",
      text: "이벤트 편집",
      attrs: { type: "button" },
      dataset: { testid: "right-inspector-edit-event" },
      on: { click: () => openEventEditorModal(mapId, eventId) },
    }));
    return nodes;
  }
  const { mapId } = view;
  const advanced = el("details", { class: "right-inspector-advanced", dataset: { testid: "right-inspector-advanced" } });
  advanced.append(
    el("summary", { class: "right-inspector-group-title", text: "고급" }),
    el("div", {
      class: "right-inspector-card",
      children: ADVANCED_SECTIONS.map(({ section, label }) => renderRow(mapId, { key: `advanced-${section}`, label, value: "", section })),
    }),
  );
  nodes.push(advanced);
  return nodes;
}

function readCursorCell(layout: ParentNode): { x: number; y: number } | null {
  const text = layout.querySelector?.<HTMLElement>('[data-testid="cursor-position"]')?.textContent ?? "";
  const match = /^(\d+),(\d+)$/.exec(text.trim());
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

export type RightInspectorMount = { readonly root: HTMLElement; readonly dispose: () => void };

/** `cursorHost` 는 캔버스가 마우스 칸을 쓰는 진단 칸(`cursor-position`)을 품은 노드다. */
export function mountRightInspector(cursorHost: HTMLElement): RightInspectorMount {
  const root = el("aside", {
    class: "right-inspector",
    attrs: { "aria-label": "인스펙터" },
    dataset: { testid: "right-inspector" },
  });
  let lastCell: { x: number; y: number } | null = null;
  let fingerprint = "";
  let advancedOpen = false;
  const paint = (): void => {
    const view = buildInspectorView(store.getCurrent(), editorState.get(), lastCell);
    const next = JSON.stringify(view);
    if (next === fingerprint) return;
    fingerprint = next;
    const previousAdvanced = root.querySelector?.<HTMLDetailsElement>(".right-inspector-advanced");
    if (previousAdvanced) advancedOpen = previousAdvanced.open;
    root.replaceChildren(...renderView(view));
    const advanced = root.querySelector?.<HTMLDetailsElement>(".right-inspector-advanced");
    if (advanced) advanced.open = advancedOpen;
  };
  let frame = 0;
  const schedule = (): void => {
    if (frame) return;
    if (typeof requestAnimationFrame !== "function") { paint(); return; }
    frame = requestAnimationFrame(() => { frame = 0; paint(); });
  };
  const onCursor = (): void => {
    const cell = readCursorCell(cursorHost);
    // 맵 밖으로 나가면 마지막 칸을 그대로 둔다 — 열로 마우스를 옮기는 동안 값이 지워지지 않게.
    if (!cell || (lastCell && cell.x === lastCell.x && cell.y === lastCell.y)) return;
    lastCell = cell;
    schedule();
  };
  const unsubStore = store.subscribe(() => schedule());
  let previous = editorState.get();
  const unsubEditor = editorState.subscribe((state) => {
    const before = previous;
    previous = state;
    if (state.currentMapId === before.currentMapId && state.selectedEventId === before.selectedEventId && state.layer === before.layer) return;
    if (state.currentMapId !== before.currentMapId) lastCell = null;
    schedule();
  });
  const observer = typeof MutationObserver === "function" ? new MutationObserver(onCursor) : null;
  observer?.observe(cursorHost, { subtree: true, characterData: true, childList: true });
  paint();
  return {
    root,
    dispose: () => {
      unsubStore();
      unsubEditor();
      observer?.disconnect();
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      frame = 0;
      root.remove();
    },
  };
}
