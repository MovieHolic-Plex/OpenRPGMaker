// 농장 건물·집 꾸미기 탭 (farm-spatial) — 2026-08 모던 워크스페이스 개편.
//
// 이전 구조는 목록이 아예 없었다. 네 컬렉션(건물 유형 / 장식 유형 / 시작 건물 배치 /
// 시작 장식 배치)을 전부 "펼쳐진 편집 카드"로 2열 그리드에 쏟아붓는 폼 덤프였고,
// 건물 유형 하나가 레벨마다 10 개 넘는 컨트롤을 항상 열어 둬서 유형 2 개만 있어도
// 700px 열에 50 개 컨트롤이 세로로 쌓였다. 장식 유형이 20 개인 프로젝트는 스크롤로
// 탐색이 불가능하다(감사 A/H 축).
//
// 개편의 세 축:
//   1. 목록/상세 — 네 컬렉션을 하나의 목록 창에 그룹으로 묶고, 상세 창은 "지금 고른
//      레코드 하나"만 편집한다.
//   2. 파괴적 액션 위계 — `btn small danger` 가 다섯 깊이에서 빨갛게 줄 서 있던 걸
//      조용한 행 인라인 버튼 + 2 단계 확인으로 바꾼다(유형/레벨).
//   3. 저작 대상의 미리보기 — footprint 는 실제 타일 격자로, 방향은 나침반으로,
//      graphicResourceId 는 리소스 피커(썸네일 포함)로 바꾼다. 예전엔 전부 맨 숫자/
//      맨 텍스트라 오타 하나로 보이지 않는 건물이 조용히 만들어졌다.
//
// DOM 계약: 레코드 앵커(`db-spatial-building-type-<id>` 등)와 모든 필드 testid 는
// 예전 그대로다. 비활성 레코드의 인스펙터는 `hidden` 으로 감추되 DOM 에는 남긴다 —
// 용어 탭이 쓰는 것과 같은 계약 보존 패턴이다(workspace-modern.css 끝 주석 참고).

import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import {
  farmBuildingTypeReferenceMessage,
  homeDecorationTypeReferenceMessage,
} from "@/editor/databaseReferences";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field, matchesNameOrId, numberField, toggleSwitch } from "@/editor/panels/databaseControls";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  noticeBar,
  sectionCard,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { reconcileLinkedAnimalHousing } from "@/project/animalHousing";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type {
  Dir,
  FarmAnimalStartInstance,
  FarmBuildingLevelDefinition,
  FarmBuildingPlacement,
  FarmBuildingTypeRecord,
  HomeDecorationPlacement,
  HomeDecorationTypeRecord,
  Project,
} from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const ORIENTATIONS: readonly Dir[] = ["down", "left", "right", "up"];
const DEFAULT_GRAPHIC = "easyrpg-picture-cloud";
const ORIENTATION_ARROW: Readonly<Record<Dir, string>> = { down: "↓", left: "←", right: "→", up: "↑" };
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_CONFIRM_WINDOW_MS = 3000;

type SpatialKind = "buildingType" | "decorationType" | "buildingPlacement" | "decorationPlacement";
type Selection = { readonly kind: SpatialKind; readonly id: string };

const GROUP_LABEL: Readonly<Record<SpatialKind, string>> = {
  buildingType: "건물 유형",
  decorationType: "장식 유형",
  buildingPlacement: "시작 건물 배치",
  decorationPlacement: "시작 장식 배치",
};

let spatialSearch = "";
let spatialFilter: SpatialKind | "all" = "all";
let spatialSelection: Selection | null = null;

/** 2 단계 삭제 확인의 무장 상태. 재렌더로 버튼 노드가 갈려도 살아남아야 한다. */
const armedDeletes = new Map<string, number>();
/** Last computed impact counts for notice rendering after confirm. */
const housingImpactNotices = new Map<string, number>();

function laterCall(callback: () => void, delayMs: number): void {
  const host = globalThis as { setTimeout?: (cb: () => void, ms: number) => unknown };
  if (typeof host.setTimeout === "function") host.setTimeout(callback, delayMs);
}

// ---------------------------------------------------------------------------
// 탭 본체
// ---------------------------------------------------------------------------

export function renderFarmSpatialTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const buildingTypes = project.database.farmBuildingTypes ?? [];
  const decorationTypes = project.database.homeDecorationTypes ?? [];
  const buildingPlacements = project.session.farmBuildingPlacements ?? [];
  const decorationPlacements = project.session.homeDecorationPlacements ?? [];
  const total = buildingTypes.length + decorationTypes.length + buildingPlacements.length + decorationPlacements.length;

  spatialSelection = resolveSelection(project, spatialSelection);
  const selection = spatialSelection;

  const rows: HTMLElement[] = [];
  pushGroup(rows, "buildingType", buildingTypes.map((row, index) => typeRow("buildingType", row.id, row.name, `Lv.1~${row.levels.length}`, index, rerender)));
  pushGroup(rows, "decorationType", decorationTypes.map((row, index) => typeRow("decorationType", row.id, row.name, `${row.footprint.width}×${row.footprint.height}`, index, rerender)));
  pushGroup(rows, "buildingPlacement", buildingPlacements.map((row, index) => placementRow("buildingPlacement", row, buildingTypes, index, rerender)));
  pushGroup(rows, "decorationPlacement", decorationPlacements.map((row, index) => placementRow("decorationPlacement", row, decorationTypes, index, rerender)));

  const list = listPane({
    title: "공간 요소",
    count: total,
    search: listSearch({
      placeholder: "이름 또는 ID 검색",
      value: spatialSearch,
      testid: "db-spatial-search",
      onInput: (value) => { spatialSearch = value; rerender(); },
    }),
    chips: filterChips(rerender, {
      buildingType: buildingTypes.length,
      decorationType: decorationTypes.length,
      buildingPlacement: buildingPlacements.length,
      decorationPlacement: decorationPlacements.length,
    }),
    rows,
    empty: spatialSearch
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${spatialSearch}" 와 일치하는 항목이 없습니다.`, compact: true })
      : emptyState({ icon: "🏡", title: "아직 공간 요소가 없습니다", compact: true }),
    toolbar: listToolbar([
      { label: "+ 건물 유형", kind: "primary", testid: "db-spatial-add-building-type", onClick: () => addBuildingType(rerender) },
      { label: "+ 장식 유형", testid: "db-spatial-add-decoration-type", onClick: () => addDecorationType(rerender) },
      { label: "+ 건물 배치", testid: "db-spatial-add-building-placement", title: "건물 유형이 하나 이상 있어야 합니다", onClick: () => addBuildingPlacement(rerender) },
      { label: "+ 장식 배치", testid: "db-spatial-add-decoration-placement", title: "장식 유형이 하나 이상 있어야 합니다", onClick: () => addDecorationPlacement(rerender) },
    ]),
    testid: "db-spatial-list-pane",
  });

  const panels = el("div", { class: "db-ws-section-panels db-spatial-panels" });
  // .db-ws-detail-body 는 flex column 이라 자식이 내용보다 작게 눌릴 수 있다 —
  // 그러면 그리드 내용이 넘쳐 아래 형제와 겹쳐 보인다. 스타일시트 없이도 안전하도록 못박는다.
  panels.style.flexShrink = "0";
  for (const [index, record] of buildingTypes.entries()) {
    panels.append(panelHost(`db-spatial-building-type-panel-${record.id}`, isActive(selection, "buildingType", record.id), buildingTypeInspector(record, index, rerender)));
  }
  for (const [index, record] of decorationTypes.entries()) {
    panels.append(panelHost(`db-spatial-decoration-type-panel-${record.id}`, isActive(selection, "decorationType", record.id), decorationTypeInspector(record, index, rerender)));
  }
  for (const [index, record] of buildingPlacements.entries()) {
    panels.append(panelHost(`db-spatial-building-placement-panel-${record.instanceId}`, isActive(selection, "buildingPlacement", record.instanceId), buildingPlacementInspector(record, index, buildingTypes, rerender)));
  }
  for (const [index, record] of decorationPlacements.entries()) {
    panels.append(panelHost(`db-spatial-decoration-placement-panel-${record.instanceId}`, isActive(selection, "decorationPlacement", record.instanceId), decorationPlacementInspector(record, index, decorationTypes, rerender)));
  }
  if (!selection) panels.append(panelHost("db-spatial-empty-state", true, onboardingBoard(buildingTypes.length, decorationTypes.length, rerender)));

  const detail = detailPane({
    hero: detailHero({
      eyebrow: "공간과 성장",
      title: selection ? selectionTitle(project, selection) : "농장 건물·집 꾸미기",
      subtitle: `건물 유형 ${buildingTypes.length} · 장식 유형 ${decorationTypes.length} · 시작 배치 ${buildingPlacements.length + decorationPlacements.length}`,
      tags: selection ? [GROUP_LABEL[selection.kind], shortId(selection.id)] : undefined,
      media: el("img", {
        class: "db-spatial-hero-art",
        attrs: { src: FARMING_LIFE_UI_ASSETS.decorating, alt: "농장 건물과 집 꾸미기", loading: "lazy" },
        dataset: { testid: "db-spatial-hero-image" },
      }),
      testid: "db-spatial-hero",
    }),
    body: [
      shrinkless(statStrip([
        { label: "건물 유형", value: String(buildingTypes.length), hint: "레벨·수용량·비용", tone: buildingTypes.length ? "good" : "neutral", onClick: () => { spatialFilter = "buildingType"; rerender(); }, testid: "db-spatial-stat-building-type" },
        { label: "장식 유형", value: String(decorationTypes.length), hint: "회전·충돌 영역", tone: decorationTypes.length ? "good" : "neutral", onClick: () => { spatialFilter = "decorationType"; rerender(); }, testid: "db-spatial-stat-decoration-type" },
        { label: "시작 건물 배치", value: String(buildingPlacements.length), hint: "새 게임 시작 시", onClick: () => { spatialFilter = "buildingPlacement"; rerender(); }, testid: "db-spatial-stat-building-placement" },
        { label: "시작 장식 배치", value: String(decorationPlacements.length), hint: "새 게임 시작 시", onClick: () => { spatialFilter = "decorationPlacement"; rerender(); }, testid: "db-spatial-stat-decoration-placement" },
      ], { testid: "db-spatial-stats" })),
      panels,
    ],
    testid: "db-spatial-detail-pane",
  });

  host.append(workspaceShell({ list, detail, legacyClass: "db-spatial-workspace", testid: "db-spatial-workspace" }));
}

function pushGroup(rows: HTMLElement[], kind: SpatialKind, built: readonly HTMLElement[]): void {
  if (built.length === 0) return;
  if (spatialFilter !== "all" && spatialFilter !== kind) return;
  const visible = built.filter((node) => node.dataset.spatialHidden !== "1");
  rows.push(el("div", {
    class: "db-spatial-group",
    dataset: { testid: `db-spatial-group-${kind}` },
    children: [
      el("div", {
        class: "db-spatial-group-head",
        children: [
          el("span", { class: "db-spatial-group-title", text: GROUP_LABEL[kind] }),
          el("span", { class: "db-spatial-group-count", text: `${built.length}` }),
        ],
      }),
      ...(visible.length > 0
        ? visible
        : [el("p", { class: "db-spatial-group-empty", text: "검색과 일치하는 항목이 없습니다." })]),
    ],
  }));
}

/** db-ws-stack 한 행을 통째로 쓰게 한다(안내 바처럼 가로로 긴 것). */
/** 히어로 배지는 줄바꿈이 안 된다 — uuid 꼬리표가 좁은 폭에서 히어로를 넘치게 하는 걸 막는다. */
function shortId(id: string): string {
  return id.length > 26 ? `${id.slice(0, 24)}…` : id;
}

function shrinkless(node: HTMLElement): HTMLElement {
  node.style.flexShrink = "0";
  return node;
}

function spanned(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}

function isActive(selection: Selection | null, kind: SpatialKind, id: string): boolean {
  return selection?.kind === kind && selection.id === id;
}

function panelHost(testid: string, active: boolean, body: HTMLElement): HTMLElement {
  const node = el("div", { class: "db-ws-section-panel", dataset: { testid }, children: [body] });
  if (!active) node.setAttribute("hidden", "");
  return node;
}

function resolveSelection(project: Project, current: Selection | null): Selection | null {
  const exists = (candidate: Selection): boolean => {
    if (candidate.kind === "buildingType") return (project.database.farmBuildingTypes ?? []).some((row) => row.id === candidate.id);
    if (candidate.kind === "decorationType") return (project.database.homeDecorationTypes ?? []).some((row) => row.id === candidate.id);
    if (candidate.kind === "buildingPlacement") return (project.session.farmBuildingPlacements ?? []).some((row) => row.instanceId === candidate.id);
    return (project.session.homeDecorationPlacements ?? []).some((row) => row.instanceId === candidate.id);
  };
  if (current && exists(current)) return current;
  const first = project.database.farmBuildingTypes?.[0]?.id
    ?? project.database.homeDecorationTypes?.[0]?.id
    ?? project.session.farmBuildingPlacements?.[0]?.instanceId
    ?? project.session.homeDecorationPlacements?.[0]?.instanceId;
  if (!first) return null;
  if (project.database.farmBuildingTypes?.[0]) return { kind: "buildingType", id: project.database.farmBuildingTypes[0]!.id };
  if (project.database.homeDecorationTypes?.[0]) return { kind: "decorationType", id: project.database.homeDecorationTypes[0]!.id };
  if (project.session.farmBuildingPlacements?.[0]) return { kind: "buildingPlacement", id: project.session.farmBuildingPlacements[0]!.instanceId };
  return { kind: "decorationPlacement", id: first };
}

function selectionTitle(project: Project, selection: Selection): string {
  if (selection.kind === "buildingType") return project.database.farmBuildingTypes?.find((row) => row.id === selection.id)?.name ?? selection.id;
  if (selection.kind === "decorationType") return project.database.homeDecorationTypes?.find((row) => row.id === selection.id)?.name ?? selection.id;
  if (selection.kind === "buildingPlacement") {
    const row = project.session.farmBuildingPlacements?.find((entry) => entry.instanceId === selection.id);
    const type = project.database.farmBuildingTypes?.find((entry) => entry.id === row?.typeId);
    return type ? `${type.name} Lv.${row?.level ?? 1}` : selection.id;
  }
  const row = project.session.homeDecorationPlacements?.find((entry) => entry.instanceId === selection.id);
  const type = project.database.homeDecorationTypes?.find((entry) => entry.id === row?.typeId);
  return type?.name ?? selection.id;
}

function filterChips(rerender: () => void, counts: Readonly<Record<SpatialKind, number>>): HTMLElement {
  const chip = (id: SpatialKind | "all", label: string): HTMLElement => el("button", {
    class: `db-filter-chip${spatialFilter === id ? " active" : ""}`,
    text: label,
    attrs: { type: "button", "aria-pressed": spatialFilter === id ? "true" : "false" },
    dataset: { testid: `db-spatial-chip-${id}` },
    on: { click: () => { spatialFilter = id; rerender(); } },
  });
  return el("div", {
    class: "db-filter-chips db-spatial-chips",
    attrs: { role: "group", "aria-label": "공간 요소 분류" },
    children: [
      chip("all", "전체"),
      chip("buildingType", `건물 ${counts.buildingType}`),
      chip("decorationType", `장식 ${counts.decorationType}`),
      chip("buildingPlacement", `건물 배치 ${counts.buildingPlacement}`),
      chip("decorationPlacement", `장식 배치 ${counts.decorationPlacement}`),
    ],
  });
}

// ---------------------------------------------------------------------------
// 목록 행
// ---------------------------------------------------------------------------

function typeRow(
  kind: "buildingType" | "decorationType",
  id: string,
  name: string,
  sub: string,
  index: number,
  rerender: () => void,
): HTMLElement {
  const anchor = kind === "buildingType" ? `db-spatial-building-type-${id}` : `db-spatial-decoration-type-${id}`;
  const row = listRow({
    name,
    sub,
    number: index + 1,
    title: id,
    active: isActive(spatialSelection, kind, id),
    testid: anchor,
    dataset: { recordId: id },
    onSelect: () => { spatialSelection = { kind, id }; rerender(); },
  });
  const remove = kind === "buildingType"
    ? () => removeBuildingType(id, rerender)
    : () => removeDecorationType(id, rerender);
  const deleteTestId = kind === "buildingType" ? `db-spatial-delete-building-type-${id}` : `db-spatial-delete-decoration-type-${id}`;
  return rowWrap(row, confirmDeleteButton(deleteTestId, `${name} 삭제`, remove), matchesNameOrId(name, id, spatialSearch));
}

function placementRow(
  kind: "buildingPlacement" | "decorationPlacement",
  record: FarmBuildingPlacement | HomeDecorationPlacement,
  types: readonly { readonly id: string; readonly name: string }[],
  index: number,
  rerender: () => void,
): HTMLElement {
  const typeName = types.find((entry) => entry.id === record.typeId)?.name ?? `${record.typeId} (삭제됨)`;
  const anchor = kind === "buildingPlacement"
    ? `db-spatial-building-placement-${record.instanceId}`
    : `db-spatial-decoration-placement-${record.instanceId}`;
  const row = listRow({
    name: typeName,
    sub: `${record.x},${record.y} ${ORIENTATION_ARROW[record.orientation]}`,
    number: index + 1,
    title: record.instanceId,
    active: isActive(spatialSelection, kind, record.instanceId),
    testid: anchor,
    dataset: { recordId: record.instanceId },
    onSelect: () => { spatialSelection = { kind, id: record.instanceId }; rerender(); },
  });
  const deleteTestId = kind === "buildingPlacement"
    ? `db-spatial-delete-building-placement-${record.instanceId}`
    : `db-spatial-delete-decoration-placement-${record.instanceId}`;
  if (kind === "buildingPlacement") {
    const impact = countAuthoredAnimalsOnPlacement(record.instanceId);
    if (impact > 0) {
      const button = confirmDeleteButton(
        deleteTestId,
        `${typeName} 시작 배치 삭제`,
        () => removeBuildingPlacement(record.instanceId, rerender),
        `미배정 ${impact}마리 · ${DELETE_CONFIRM_LABEL}`,
        `미배정 ${impact}마리`,
      );
      return rowWrap(row, button, matchesNameOrId(typeName, record.instanceId, spatialSearch));
    }
    const button = el("button", {
      class: "db-ws-row-delete",
      text: DELETE_IDLE_LABEL,
      attrs: { type: "button", "aria-label": `${typeName} 시작 배치 삭제` },
      dataset: { testid: deleteTestId },
      on: { click: () => removeBuildingPlacement(record.instanceId, rerender) },
    });
    return rowWrap(row, button, matchesNameOrId(typeName, record.instanceId, spatialSearch));
  }
  const button = el("button", {
    class: "db-ws-row-delete",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button", "aria-label": `${typeName} 시작 배치 삭제` },
    dataset: { testid: deleteTestId },
    on: { click: () => removeDecorationPlacement(record.instanceId, rerender) },
  });
  return rowWrap(row, button, matchesNameOrId(typeName, record.instanceId, spatialSearch));
}

function rowWrap(row: HTMLElement, action: HTMLElement, matches: boolean): HTMLElement {
  row.classList.add("db-row");
  const wrap = el("div", { class: "db-ws-row-wrap db-spatial-row-wrap", children: [row, action] });
  if (!matches) wrap.dataset.spatialHidden = "1";
  return wrap;
}

function confirmDeleteButton(
  testid: string,
  ariaLabel: string,
  perform: () => void,
  confirmLabel: string = DELETE_CONFIRM_LABEL,
  idleLabel: string = DELETE_IDLE_LABEL,
): HTMLElement {
  const armed = (armedDeletes.get(testid) ?? 0) > Date.now();
  const button = el("button", {
    class: `db-ws-row-delete${armed ? " confirming" : ""}`,
    text: armed ? confirmLabel : idleLabel,
    attrs: { type: "button", "aria-label": ariaLabel },
    dataset: { testid },
  });
  button.addEventListener("click", () => {
    if ((armedDeletes.get(testid) ?? 0) > Date.now()) {
      armedDeletes.delete(testid);
      perform();
      return;
    }
    armedDeletes.set(testid, Date.now() + DELETE_CONFIRM_WINDOW_MS);
    button.textContent = confirmLabel;
    button.classList.add("confirming");
    laterCall(() => {
      if ((armedDeletes.get(testid) ?? 0) > Date.now()) return;
      armedDeletes.delete(testid);
      button.textContent = idleLabel;
      button.classList.remove("confirming");
    }, DELETE_CONFIRM_WINDOW_MS + 80);
  });
  return button;
}

/** 카드 안 인라인 삭제(레벨/재료). 목록 행과 같은 조용한 톤을 쓴다. */
function inlineDeleteButton(testid: string, label: string, perform: () => void, confirm: boolean): HTMLElement {
  if (confirm) {
    const button = confirmDeleteButton(testid, label, perform);
    button.classList.add("db-spatial-inline-delete");
    return button;
  }
  const button = el("button", {
    class: "db-ws-row-delete db-spatial-inline-delete",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button", "aria-label": label },
    dataset: { testid },
    on: { click: perform },
  });
  return button;
}

// ---------------------------------------------------------------------------
// 빈 상태 / 온보딩
// ---------------------------------------------------------------------------

function onboardingBoard(buildingCount: number, decorationCount: number, rerender: () => void): HTMLElement {
  const card = (
    title: string,
    hint: string,
    bullets: readonly string[],
    action: { label: string; testid: string; onClick: () => void },
    kind: "primary" | "ghost",
  ): HTMLElement => sectionCard({
    title,
    hint,
    children: [
      el("ul", { class: "db-spatial-bullets", children: bullets.map((text) => el("li", { text })) }),
      el("div", {
        class: "db-ws-toolbar",
        children: [el("button", {
          class: `db-ws-btn db-ws-btn-${kind}`,
          text: action.label,
          attrs: { type: "button" },
          dataset: { testid: action.testid },
          on: { click: action.onClick },
        })],
      }),
    ],
  });

  return el("div", {
    class: "db-ws-stack",
    children: [
      spanned(noticeBar({
        text: "유형을 먼저 만들고, 그 유형을 새 게임 시작 시점에 놓을 위치를 배치로 지정합니다.",
        testid: "db-spatial-onboarding-notice",
      })),
      card("건물 유형", "레벨별 정의", [
        "레벨마다 차지 영역(너비×높이)과 수용량",
        "건설·업그레이드 비용(골드 + 재료 아이템)",
        "기본 그래픽과 방향별 그래픽",
        "설치할 수 있는 맵 제한",
      ], { label: "건물 유형 만들기", testid: "db-spatial-empty-add-building-type", onClick: () => addBuildingType(rerender) }, "primary"),
      card("장식 유형", "집 안 소품", [
        "인벤토리에서 꺼내 놓을 아이템 연결",
        "차지 영역과 이동 차단 여부",
        "허용 회전 방향(회전하면 영역도 함께 돈다)",
        "방향별 그래픽",
      ], { label: "장식 유형 만들기", testid: "db-spatial-empty-add-decoration-type", onClick: () => addDecorationType(rerender) }, "ghost"),
      card("시작 건물 배치", buildingCount ? "바로 배치할 수 있습니다" : "건물 유형이 필요합니다", [
        "새 게임을 시작할 때 이미 서 있는 건물",
        "맵·좌표·방향·시작 레벨을 지정",
        "빈 자리를 자동으로 찾아 넣습니다",
      ], { label: "시작 건물 배치", testid: "db-spatial-empty-add-building-placement", onClick: () => addBuildingPlacement(rerender) }, "ghost"),
      card("시작 장식 배치", decorationCount ? "바로 배치할 수 있습니다" : "장식 유형이 필요합니다", [
        "인벤토리와 별개로 처음부터 놓여 있는 장식",
        "맵·좌표·회전 방향을 지정",
        "충돌 영역이 겹치면 배치되지 않습니다",
      ], { label: "시작 장식 배치", testid: "db-spatial-empty-add-decoration-placement", onClick: () => addDecorationPlacement(rerender) }, "ghost"),
    ],
  });
}

// ---------------------------------------------------------------------------
// 인스펙터 — 건물 유형
// ---------------------------------------------------------------------------

function buildingTypeInspector(record: FarmBuildingTypeRecord, index: number, rerender: () => void): HTMLElement {
  const blocked = farmBuildingTypeReferenceMessage(record.id);
  const housingEnabled = record.animalHousing !== undefined;
  const housingImpact = housingImpactNotices.get(`housing:${record.id}`);
  const cards: HTMLElement[] = [
    sectionCard({
      title: "기본 정보",
      hint: "ID 는 배치가 참조합니다",
      children: [
        nameInput("이름", `db-spatial-building-name-${record.id}`, record.name, (value) => patchBuildingType(index, { name: value }, false), rerender),
        idInput("ID", `db-spatial-building-id-${record.id}`, record.id, (value) => renameType("building", index, value, rerender)),
      ],
      testid: `db-spatial-building-basics-${record.id}`,
    }),
    sectionCard({
      title: "허용 맵",
      hint: "선택하지 않으면 모든 맵",
      children: [mapChecklist(record.allowedMapIds, `db-spatial-building-map-${record.id}`, (ids) => patchBuildingType(index, { allowedMapIds: ids.length ? ids : undefined }, true, rerender))],
      testid: `db-spatial-building-maps-${record.id}`,
    }),
    sectionCard({
      title: "동물 주거",
      hint: "켜면 각 레벨에 동물 정원이 필요합니다. 범용 수용량과 별개입니다.",
      children: [
        toggleSwitch(
          "동물 주거 사용",
          `db-spatial-building-animal-housing-${record.id}`,
          housingEnabled,
          (enabled) => setBuildingAnimalHousing(index, enabled, rerender),
        ),
        ...(housingEnabled ? [housingSpeciesToggles(record, index, rerender)] : []),
        el("p", {
          class: "db-ws-usage",
          text: housingImpact !== undefined
            ? (housingImpact > 0 ? `미배정 ${housingImpact}마리` : "미배정 0마리")
            : housingEnabled
              ? "허용 종과 레벨별 동물 정원을 설정하세요."
              : "주거를 끄면 이 유형 배치에 연결된 시작 개체가 미배정됩니다.",
          dataset: { testid: `db-spatial-building-housing-impact-${record.id}` },
        }),
      ],
      testid: `db-spatial-building-housing-${record.id}`,
    }),
  ];

  for (const [levelIndex, level] of record.levels.entries()) {
    cards.push(buildingLevelCard(record, index, level, levelIndex, rerender));
  }

  cards.push(sectionCard({
    title: "레벨 관리",
    hint: `현재 ${record.levels.length}단계 (최대 16)`,
    children: [
      el("div", {
        class: "db-ws-toolbar",
        children: [el("button", {
          class: "db-ws-btn db-ws-btn-ghost",
          text: "＋ 업그레이드 레벨 추가",
          attrs: { type: "button", ...(record.levels.length >= 16 ? { disabled: "true" } : {}) },
          dataset: { testid: `db-spatial-building-add-level-${record.id}` },
          on: { click: () => addBuildingLevel(index, rerender) },
        })],
      }),
      ...(blocked ? [el("p", { class: "db-ws-usage db-ws-usage-active", text: blocked })] : []),
    ],
    testid: `db-spatial-building-levels-${record.id}`,
  }));

  return el("div", { class: "db-ws-stack", children: cards });
}

function buildingLevelCard(
  record: FarmBuildingTypeRecord,
  typeIndex: number,
  level: FarmBuildingLevelDefinition,
  levelIndex: number,
  rerender: () => void,
): HTMLElement {
  const prefix = `${record.id}-${level.level}`;
  const costItems = level.cost?.items ?? [];
  const preview = footprintPreview(level.footprint.width, level.footprint.height);

  const children: HTMLElement[] = [
    el("div", {
      class: "db-spatial-footprint-row",
      children: [
        preview.node,
        el("div", {
          class: "db-spatial-footprint-fields",
          children: [
            numberField("너비", `db-spatial-building-width-${prefix}`, level.footprint.width, (value) => {
              patchFootprint(typeIndex, levelIndex, "width", value);
              preview.update(currentFootprint(typeIndex, levelIndex));
            }, { min: 1, max: 16 }),
            numberField("높이", `db-spatial-building-height-${prefix}`, level.footprint.height, (value) => {
              patchFootprint(typeIndex, levelIndex, "height", value);
              preview.update(currentFootprint(typeIndex, levelIndex));
            }, { min: 1, max: 16 }),
          ],
        }),
      ],
    }),
    nameInput("레벨 이름", `db-spatial-building-level-name-${prefix}`, level.name ?? "", (value) => patchBuildingLevel(typeIndex, levelIndex, { name: value || undefined }, false), rerender),
    numberField("수용량", `db-spatial-building-capacity-${prefix}`, level.capacity, (value) => patchBuildingLevel(typeIndex, levelIndex, { capacity: value }, false), { min: 1, max: 9999 }),
    ...(record.animalHousing
      ? [
          numberField(
            "동물 정원",
            `db-spatial-building-animal-capacity-${prefix}`,
            level.animalCapacity ?? 0,
            (value) => commitAnimalCapacity(typeIndex, levelIndex, value, rerender),
            { min: 0, max: 9999 },
          ),
          el("p", {
            class: "db-ws-usage",
            text: (() => {
              const impact = housingImpactNotices.get(`capacity:${record.id}:${level.level}`);
              if (impact === undefined) return "범용 수용량과 별개인 동물 슬롯입니다.";
              return impact > 0 ? `미배정 ${impact}마리` : "미배정 0마리";
            })(),
            dataset: { testid: `db-spatial-building-animal-capacity-impact-${prefix}` },
          }),
        ]
      : []),
    numberField("골드 비용", `db-spatial-building-gold-${prefix}`, level.cost?.gold ?? 0, (value) => patchBuildingCost(typeIndex, levelIndex, value), { min: 0, max: 9_999_999 }),
    resourcePickerControl({
      label: "기본 그래픽",
      resourceId: level.graphicResourceId,
      kind: "charset",
      testid: `db-spatial-building-graphic-${prefix}`,
      dialogTitle: `${record.name} Lv.${level.level} 그래픽`,
      onChange: (result) => patchBuildingLevel(typeIndex, levelIndex, { graphicResourceId: result.resourceId }, false),
      rerender,
    }),
    orientationGraphics(level.orientationGraphicResourceIds, `db-spatial-building-orientation-graphic-${prefix}`, level.graphicResourceId, (graphics) => patchBuildingLevel(typeIndex, levelIndex, { orientationGraphicResourceIds: graphics }, false), rerender),
    el("div", {
      class: "db-spatial-cost-list",
      children: [
        el("span", { class: "db-spatial-sublabel", text: `건설 재료 ${costItems.length}종` }),
        ...costItems.map((item, itemIndex) => el("div", {
          class: "db-spatial-inline-row",
          children: [
            chooserField("재료", `db-spatial-building-cost-item-${prefix}-${itemIndex}`, item.itemId, itemOptions(), (itemId) => patchBuildingCostItem(typeIndex, levelIndex, itemIndex, { itemId }, rerender)),
            numberField("수량", `db-spatial-building-cost-count-${prefix}-${itemIndex}`, item.count, (count) => patchBuildingCostItem(typeIndex, levelIndex, itemIndex, { count }, undefined), { min: 1, max: 9_999_999 }),
            inlineDeleteButton(`db-spatial-building-cost-delete-${prefix}-${itemIndex}`, "재료 삭제", () => removeBuildingCostItem(typeIndex, levelIndex, itemIndex, rerender), false),
          ],
        })),
        el("div", {
          class: "db-ws-toolbar",
          children: [el("button", {
            class: "db-ws-btn db-ws-btn-ghost",
            text: "＋ 재료 추가",
            attrs: { type: "button" },
            dataset: { testid: `db-spatial-building-cost-add-${prefix}` },
            on: { click: () => addBuildingCostItem(typeIndex, levelIndex, rerender) },
          })],
        }),
      ],
    }),
  ];

  if (levelIndex > 0) {
    children.push(el("div", {
      class: "db-ws-toolbar",
      children: [inlineDeleteButton(`db-spatial-building-delete-level-${prefix}`, `Lv.${level.level} 삭제`, () => removeBuildingLevel(typeIndex, levelIndex, rerender), true)],
    }));
  }

  const card = sectionCard({
    title: level.level === 1 ? "Lv.1 건설" : `Lv.${level.level} 업그레이드`,
    hint: record.animalHousing
      ? `${level.footprint.width}×${level.footprint.height} · 수용량 ${level.capacity} · 동물 ${level.animalCapacity ?? 0}`
      : `${level.footprint.width}×${level.footprint.height} · 수용량 ${level.capacity}`,
    children,
    testid: `db-spatial-building-level-${prefix}`,
  });
  card.classList.add("db-ws-span", "db-spatial-level-card");
  return card;
}

// ---------------------------------------------------------------------------
// 인스펙터 — 장식 유형
// ---------------------------------------------------------------------------

function decorationTypeInspector(record: HomeDecorationTypeRecord, index: number, rerender: () => void): HTMLElement {
  const blocked = homeDecorationTypeReferenceMessage(record.id);
  const preview = footprintPreview(record.footprint.width, record.footprint.height);
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "기본 정보",
        hint: "ID 는 배치가 참조합니다",
        children: [
          nameInput("이름", `db-spatial-decoration-name-${record.id}`, record.name, (value) => patchDecorationType(index, { name: value }, false), rerender),
          idInput("ID", `db-spatial-decoration-id-${record.id}`, record.id, (value) => renameType("decoration", index, value, rerender)),
          chooserField("배치 아이템", `db-spatial-decoration-item-${record.id}`, record.placementItemId, itemOptions(), (placementItemId) => patchDecorationType(index, { placementItemId }, true, rerender)),
        ],
        testid: `db-spatial-decoration-basics-${record.id}`,
      }),
      sectionCard({
        title: "차지 영역",
        hint: "회전하면 가로·세로가 바뀝니다",
        children: [
          el("div", {
            class: "db-spatial-footprint-row",
            children: [
              preview.node,
              el("div", {
                class: "db-spatial-footprint-fields",
                children: [
                  numberField("너비", `db-spatial-decoration-width-${record.id}`, record.footprint.width, (width) => {
                    patchDecorationType(index, { footprint: { ...currentDecorationFootprint(index), width } }, false);
                    preview.update(currentDecorationFootprint(index));
                  }, { min: 1, max: 16 }),
                  numberField("높이", `db-spatial-decoration-height-${record.id}`, record.footprint.height, (height) => {
                    patchDecorationType(index, { footprint: { ...currentDecorationFootprint(index), height } }, false);
                    preview.update(currentDecorationFootprint(index));
                  }, { min: 1, max: 16 }),
                ],
              }),
            ],
          }),
          toggleSwitch("이동을 막음", `db-spatial-decoration-blocks-${record.id}`, record.blocksMovement, (blocksMovement) => patchDecorationType(index, { blocksMovement }, false)),
        ],
        testid: `db-spatial-decoration-footprint-${record.id}`,
      }),
      sectionCard({
        title: "허용 회전",
        hint: "하나 이상 필요합니다",
        children: [
          el("div", {
            class: "db-spatial-orientation-grid",
            children: ORIENTATIONS.map((orientation) => orientationToggle(
              orientation,
              record.allowedOrientations.includes(orientation),
              `db-spatial-decoration-orientation-${record.id}-${orientation}`,
              (checked) => {
                const next = checked
                  ? [...new Set([...record.allowedOrientations, orientation])]
                  : record.allowedOrientations.filter((entry) => entry !== orientation);
                if (next.length === 0) { toast("회전 방향은 하나 이상 필요합니다.", "error"); rerender(); return; }
                patchDecorationType(index, { allowedOrientations: next }, true, rerender);
              },
            )),
          }),
        ],
        testid: `db-spatial-decoration-orientations-${record.id}`,
      }),
      sectionCard({
        title: "그래픽",
        hint: "방향별 그래픽은 비우면 기본값을 씁니다",
        children: [
          resourcePickerControl({
            label: "기본 그래픽",
            resourceId: record.graphicResourceId,
            kind: "charset",
            testid: `db-spatial-decoration-graphic-${record.id}`,
            dialogTitle: `${record.name} 그래픽`,
            onChange: (result) => patchDecorationType(index, { graphicResourceId: result.resourceId }, false),
            rerender,
          }),
          orientationGraphics(record.orientationGraphicResourceIds, `db-spatial-decoration-orientation-graphic-${record.id}`, record.graphicResourceId, (orientationGraphicResourceIds) => patchDecorationType(index, { orientationGraphicResourceIds }, false), rerender),
        ],
        testid: `db-spatial-decoration-graphics-${record.id}`,
      }),
      sectionCard({
        title: "허용 맵",
        hint: "선택하지 않으면 모든 맵",
        children: [
          mapChecklist(record.allowedMapIds, `db-spatial-decoration-map-${record.id}`, (ids) => patchDecorationType(index, { allowedMapIds: ids.length ? ids : undefined }, true, rerender)),
          ...(blocked ? [el("p", { class: "db-ws-usage db-ws-usage-active", text: blocked })] : []),
        ],
        testid: `db-spatial-decoration-maps-${record.id}`,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 인스펙터 — 배치
// ---------------------------------------------------------------------------

function buildingPlacementInspector(
  record: FarmBuildingPlacement,
  index: number,
  types: readonly FarmBuildingTypeRecord[],
  rerender: () => void,
): HTMLElement {
  const type = types.find((entry) => entry.id === record.typeId);
  const level = type?.levels.find((entry) => entry.level === record.level) ?? type?.levels[0];
  const preview = footprintPreview(level?.footprint.width ?? 1, level?.footprint.height ?? 1);
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "무엇을",
        hint: type ? `${type.name} · ${type.levels.length}단계` : "유형이 삭제되었습니다",
        children: [
          idInput("배치 ID", `db-spatial-building-placement-id-${record.instanceId}`, record.instanceId, (value) => renamePlacement("building", index, value, rerender)),
          chooserField("건물 유형", `db-spatial-building-placement-type-${record.instanceId}`, record.typeId, types.map(namedOption), (typeId) => patchBuildingPlacement(index, { typeId, level: 1 }, rerender)),
          numberField("시작 레벨", `db-spatial-building-placement-level-${record.instanceId}`, record.level, (value) => patchBuildingPlacement(index, { level: value }, rerender), { min: 1, max: Math.max(1, type?.levels.length ?? 1) }),
          el("div", { class: "db-spatial-footprint-row", children: [preview.node, el("p", { class: "db-ws-usage", text: level
            ? (type?.animalHousing
              ? `Lv.${record.level} 은 ${level.footprint.width}×${level.footprint.height} 타일, 수용량 ${level.capacity}, 동물 ${level.animalCapacity ?? 0} 입니다.`
              : `Lv.${record.level} 은 ${level.footprint.width}×${level.footprint.height} 타일, 수용량 ${level.capacity} 입니다.`)
            : "레벨 정의를 찾을 수 없습니다." })] }),
        ],
        testid: `db-spatial-building-placement-what-${record.instanceId}`,
      }),
      placementWhereCard("building", record, index, rerender, ORIENTATIONS, level?.orientationGraphicResourceIds, level?.graphicResourceId),
    ],
  });
}

function decorationPlacementInspector(
  record: HomeDecorationPlacement,
  index: number,
  types: readonly HomeDecorationTypeRecord[],
  rerender: () => void,
): HTMLElement {
  const type = types.find((entry) => entry.id === record.typeId);
  const footprint = type?.footprint ?? { width: 1, height: 1 };
  const rotated = record.orientation === "left" || record.orientation === "right"
    ? { width: footprint.height, height: footprint.width }
    : footprint;
  const preview = footprintPreview(rotated.width, rotated.height);
  return el("div", {
    class: "db-ws-stack",
    children: [
      sectionCard({
        title: "무엇을",
        hint: type ? `${type.name}` : "유형이 삭제되었습니다",
        children: [
          idInput("배치 ID", `db-spatial-decoration-placement-id-${record.instanceId}`, record.instanceId, (value) => renamePlacement("decoration", index, value, rerender)),
          chooserField("장식 유형", `db-spatial-decoration-placement-type-${record.instanceId}`, record.typeId, types.map(namedOption), (typeId) => {
            const nextType = types.find((entry) => entry.id === typeId);
            patchDecorationPlacement(index, { typeId, orientation: nextType?.allowedOrientations[0] ?? "down" }, rerender);
          }),
          el("div", { class: "db-spatial-footprint-row", children: [preview.node, el("p", { class: "db-ws-usage", text: `현재 회전에서 ${rotated.width}×${rotated.height} 타일을 차지합니다.` })] }),
        ],
        testid: `db-spatial-decoration-placement-what-${record.instanceId}`,
      }),
      placementWhereCard("decoration", record, index, rerender, type?.allowedOrientations ?? ORIENTATIONS, type?.orientationGraphicResourceIds, type?.graphicResourceId),
    ],
  });
}

function placementWhereCard(
  kind: "building" | "decoration",
  record: FarmBuildingPlacement | HomeDecorationPlacement,
  index: number,
  rerender: () => void,
  orientations: readonly Dir[],
  orientationGraphicIds: Partial<Record<Dir, string>> | undefined,
  fallbackGraphicId: string | undefined,
): HTMLElement {
  const prefix = `db-spatial-${kind}-placement`;
  const patch = (value: Partial<FarmBuildingPlacement & HomeDecorationPlacement>): void => {
    if (kind === "building") patchBuildingPlacement(index, value, rerender);
    else patchDecorationPlacement(index, value, rerender);
  };
  const map = store.getCurrent().maps[record.mapId];
  const resolvedGraphic = orientationGraphicIds?.[record.orientation] ?? fallbackGraphicId ?? "(미설정)";
  return sectionCard({
    title: "어디에",
    hint: map ? `${map.name} ${map.width}×${map.height}` : "맵을 찾을 수 없습니다",
    children: [
      chooserField("맵", `${prefix}-map-${record.instanceId}`, record.mapId, mapOptions(), (mapId) => patch({ mapId })),
      el("div", {
        class: "db-spatial-inline-row",
        children: [
          numberField("X", `${prefix}-x-${record.instanceId}`, record.x, (x) => patch({ x }), { min: 0, max: 9999 }),
          numberField("Y", `${prefix}-y-${record.instanceId}`, record.y, (y) => patch({ y }), { min: 0, max: 9999 }),
        ],
      }),
      chooserField("방향", `${prefix}-orientation-${record.instanceId}`, record.orientation, orientations.map((value) => ({ id: value, name: `${ORIENTATION_ARROW[value]} ${orientationLabel(value)}` })), (orientation) => patch({ orientation: orientation as Dir })),
      orientationCompass(record.orientation, orientations, (orientation) => patch({ orientation }), `${prefix}-compass-${record.instanceId}`),
      el("p", { class: "db-ws-usage", text: `이 방향에 쓰이는 그래픽: ${resolvedGraphic}` }),
    ],
    testid: `${prefix}-where-${record.instanceId}`,
  });
}

// ---------------------------------------------------------------------------
// 미리보기 / 공용 컨트롤
// ---------------------------------------------------------------------------

function footprintPreview(width: number, height: number): { node: HTMLElement; update: (next: { width: number; height: number }) => void } {
  const grid = el("div", { class: "db-spatial-footprint-grid", attrs: { "aria-hidden": "true" } });
  const caption = el("span", { class: "db-spatial-footprint-caption" });
  const paint = (next: { width: number; height: number }): void => {
    const w = Math.max(1, Math.min(16, Math.trunc(next.width) || 1));
    const h = Math.max(1, Math.min(16, Math.trunc(next.height) || 1));
    grid.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
    grid.replaceChildren(...Array.from({ length: w * h }, () => el("span", { class: "db-spatial-footprint-cell" })));
    caption.textContent = `${w}×${h} 타일 · ${w * h}칸`;
  };
  paint({ width, height });
  return {
    node: el("div", { class: "db-spatial-footprint", children: [grid, caption] }),
    update: paint,
  };
}

function orientationCompass(
  current: Dir,
  allowed: readonly Dir[],
  onPick: (orientation: Dir) => void,
  testid: string,
): HTMLElement {
  const button = (orientation: Dir): HTMLElement => {
    const enabled = allowed.includes(orientation);
    return el("button", {
      class: `db-spatial-compass-cell db-spatial-compass-${orientation}${orientation === current ? " active" : ""}`,
      text: ORIENTATION_ARROW[orientation],
      attrs: {
        type: "button",
        title: orientationLabel(orientation),
        "aria-label": orientationLabel(orientation),
        "aria-pressed": orientation === current ? "true" : "false",
        ...(enabled ? {} : { disabled: "true" }),
      },
      dataset: { testid: `${testid}-${orientation}` },
      on: { click: () => { if (enabled) onPick(orientation); } },
    });
  };
  return el("div", {
    class: "db-spatial-compass",
    dataset: { testid },
    children: [
      el("span", { class: "db-spatial-compass-gap" }),
      button("up"),
      el("span", { class: "db-spatial-compass-gap" }),
      button("left"),
      el("span", { class: "db-spatial-compass-hub", text: ORIENTATION_ARROW[current] }),
      button("right"),
      el("span", { class: "db-spatial-compass-gap" }),
      button("down"),
      el("span", { class: "db-spatial-compass-gap" }),
    ],
  });
}

function orientationToggle(orientation: Dir, checked: boolean, testid: string, onChange: (checked: boolean) => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "checkbox", ...(checked ? { checked: "" } : {}) },
    dataset: { testid },
    on: { change: (event) => onChange((event.currentTarget as HTMLInputElement).checked) },
  }) as HTMLInputElement;
  input.checked = checked;
  return el("label", {
    class: `db-spatial-orientation-toggle${checked ? " active" : ""}`,
    children: [
      input,
      el("span", { class: "db-spatial-orientation-arrow", text: ORIENTATION_ARROW[orientation] }),
      el("span", { text: orientationLabel(orientation) }),
    ],
  });
}

function orientationGraphics(
  value: Partial<Record<Dir, string>> | undefined,
  prefix: string,
  fallbackId: string,
  onChange: (value: Partial<Record<Dir, string>> | undefined) => void,
  rerender: () => void,
): HTMLElement {
  const filled = ORIENTATIONS.filter((orientation) => Boolean(value?.[orientation])).length;
  return sectionCard({
    title: "방향별 그래픽",
    hint: filled > 0 ? `${filled}/4 지정됨` : "모두 기본 그래픽 사용",
    collapsible: true,
    collapsed: filled === 0,
    children: ORIENTATIONS.map((orientation) => resourcePickerControl({
      label: `${ORIENTATION_ARROW[orientation]} ${orientationLabel(orientation)}`,
      resourceId: value?.[orientation] ?? "",
      kind: "charset",
      testid: `${prefix}-${orientation}`,
      dialogTitle: `${orientationLabel(orientation)} 방향 그래픽`,
      allowClear: true,
      onChange: (result) => {
        const next: Partial<Record<Dir, string>> = { ...value };
        if (result.resourceId && result.resourceId !== fallbackId) next[orientation] = result.resourceId;
        else delete next[orientation];
        onChange(Object.keys(next).length > 0 ? next : undefined);
      },
      rerender,
    })),
    testid: `${prefix}-card`,
  });
}

function mapChecklist(value: readonly string[] | undefined, prefix: string, onChange: (ids: string[]) => void): HTMLElement {
  const maps = Object.values(store.getCurrent().maps);
  if (maps.length === 0) return el("p", { class: "db-ws-usage", text: "프로젝트에 맵이 없습니다." });
  return el("div", {
    class: "db-spatial-checklist",
    children: maps.map((map) => {
      const checked = value?.includes(map.id) ?? false;
      const input = el("input", {
        attrs: { type: "checkbox", ...(checked ? { checked: "" } : {}) },
        dataset: { testid: `${prefix}-${map.id}` },
        on: {
          change: (event) => {
            const next = (event.currentTarget as HTMLInputElement).checked;
            onChange(next ? [...new Set([...(value ?? []), map.id])] : (value ?? []).filter((id) => id !== map.id));
          },
        },
      }) as HTMLInputElement;
      input.checked = checked;
      return el("label", { class: `db-spatial-check${checked ? " active" : ""}`, children: [input, el("span", { text: map.name })] });
    }),
  });
}

/** 이름 입력 — 타이핑 중에는 재렌더하지 않고(포커스 유지), blur 에서 목록을 갱신한다. */
function nameInput(
  label: string,
  testid: string,
  value: string,
  commit: (value: string) => void,
  rerender: () => void,
): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value, dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("input", () => commit(input.value));
  input.addEventListener("change", () => { commit(input.value); rerender(); });
  return field(label, input);
}

/** ID 입력 — 고유성 검증이 필요하므로 커밋은 change 에서만 한다. */
function idInput(label: string, testid: string, value: string, commit: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text", spellcheck: "false" }, value, dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => commit(input.value));
  const wrap = field(label, input);
  wrap.classList.add("db-spatial-id-field");
  return wrap;
}

/** 필수 선택 필드 — databaseControls.selectField 와 달리 "(없음)" 을 넣지 않는다. */
function chooserField(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  for (const option of options) select.append(el("option", { text: option.name, attrs: { value: option.id } }));
  if (options.length === 0) select.append(el("option", { text: "(선택 가능한 항목 없음)", attrs: { value: "" } }));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

function itemOptions(): { id: string; name: string }[] {
  return store.getCurrent().database.items.map(namedOption);
}

function mapOptions(): { id: string; name: string }[] {
  return Object.values(store.getCurrent().maps).map(namedOption);
}

function namedOption(record: { readonly id: string; readonly name: string }): { id: string; name: string } {
  return { id: record.id, name: record.name };
}

function orientationLabel(value: Dir): string {
  return ({ down: "아래", left: "왼쪽", right: "오른쪽", up: "위" } as const)[value];
}

function currentFootprint(typeIndex: number, levelIndex: number): { width: number; height: number } {
  return store.getCurrent().database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex]?.footprint ?? { width: 1, height: 1 };
}

function currentDecorationFootprint(index: number): { width: number; height: number } {
  return store.getCurrent().database.homeDecorationTypes?.[index]?.footprint ?? { width: 1, height: 1 };
}

// ---------------------------------------------------------------------------
// 저장소 변경 (기존 경로 그대로)
// ---------------------------------------------------------------------------

function addBuildingType(rerender: () => void): void {
  recordProjectSnapshot("범용 농장 건물 유형 추가");
  let created = "";
  store.update((project) => {
    const id = uniqueId("farm_building", new Set((project.database.farmBuildingTypes ?? []).map((entry) => entry.id)));
    created = id;
    project.database.farmBuildingTypes ??= [];
    project.database.farmBuildingTypes.push({
      id,
      name: "새 농장 건물",
      levels: [{ level: 1, footprint: { width: 2, height: 2 }, capacity: 4, graphicResourceId: DEFAULT_GRAPHIC }],
    });
  });
  if (created && !spatialSelection) spatialSelection = { kind: "buildingType", id: created };
  rerender();
}

function addDecorationType(rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) { toast("장식에 연결할 아이템을 먼저 추가하세요.", "error"); return; }
  recordProjectSnapshot("집 장식 유형 추가");
  let created = "";
  store.update((project) => {
    const id = uniqueId("home_decoration", new Set((project.database.homeDecorationTypes ?? []).map((entry) => entry.id)));
    created = id;
    project.database.homeDecorationTypes ??= [];
    project.database.homeDecorationTypes.push({
      id,
      name: "새 집 장식",
      placementItemId: itemId,
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
      allowedOrientations: ["down"],
      graphicResourceId: DEFAULT_GRAPHIC,
    });
  });
  if (created && !spatialSelection) spatialSelection = { kind: "decorationType", id: created };
  rerender();
}

function addBuildingPlacement(rerender: () => void): void {
  const project = store.getCurrent();
  const type = project.database.farmBuildingTypes?.[0];
  const level = type?.levels[0];
  if (!type || !level) { toast("건물 유형을 먼저 추가하세요.", "info"); return; }
  const position = findFreePosition(project, level.footprint, "down");
  if (!position) { toast("건물을 배치할 빈 공간을 찾지 못했습니다.", "error"); return; }
  recordProjectSnapshot("시작 범용 농장 건물 배치");
  store.update((draft) => {
    draft.session.farmBuildingPlacements ??= [];
    draft.session.farmBuildingPlacements.push({
      instanceId: uniqueId("farm_building_placement", new Set(draft.session.farmBuildingPlacements.map((entry) => entry.instanceId))),
      typeId: type.id,
      level: 1,
      ...position,
    });
  });
  rerender();
}

function addDecorationPlacement(rerender: () => void): void {
  const project = store.getCurrent();
  const type = project.database.homeDecorationTypes?.[0];
  const orientation = type?.allowedOrientations[0];
  if (!type || !orientation) { toast("장식 유형을 먼저 추가하세요.", "info"); return; }
  const position = findFreePosition(project, type.footprint, orientation);
  if (!position) { toast("장식을 배치할 빈 공간을 찾지 못했습니다.", "error"); return; }
  recordProjectSnapshot("시작 집 장식 배치");
  store.update((draft) => {
    draft.session.homeDecorationPlacements ??= [];
    draft.session.homeDecorationPlacements.push({
      instanceId: uniqueId("home_decoration_placement", new Set(draft.session.homeDecorationPlacements.map((entry) => entry.instanceId))),
      typeId: type.id,
      ...position,
    });
  });
  rerender();
}

function findFreePosition(project: Project, footprint: { width: number; height: number }, orientation: Dir) {
  const session = startSession(project, 0);
  const maps = Object.values(project.maps);
  for (const map of maps) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const position = { mapId: map.id, x, y, orientation };
        if (canOccupySpatialFootprint(project, session, position, footprint)) return position;
      }
    }
  }
  return undefined;
}

function addBuildingLevel(typeIndex: number, rerender: () => void): void {
  recordProjectSnapshot("건물 업그레이드 레벨 추가");
  store.update((project) => {
    const type = project.database.farmBuildingTypes?.[typeIndex];
    const previous = type?.levels.at(-1);
    if (!type || !previous || type.levels.length >= 16) return;
    const next = { ...structuredClone(previous), level: previous.level + 1, name: `Lv.${previous.level + 1}`, cost: undefined };
    if (type.animalHousing && next.animalCapacity === undefined) next.animalCapacity = 0;
    type.levels.push(next);
  });
  rerender();
}

function removeBuildingLevel(typeIndex: number, levelIndex: number, rerender: () => void): void {
  recordProjectSnapshot("건물 업그레이드 레벨 삭제");
  store.update((project) => { project.database.farmBuildingTypes?.[typeIndex]?.levels.splice(levelIndex); });
  toast("업그레이드 레벨을 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function addBuildingCostItem(typeIndex: number, levelIndex: number, rerender: () => void): void {
  const itemId = store.getCurrent().database.items[0]?.id;
  if (!itemId) { toast("재료로 쓸 아이템을 먼저 추가하세요.", "error"); return; }
  recordProjectSnapshot("건물 재료 추가");
  store.update((project) => {
    const level = project.database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex];
    if (!level) return;
    project.database.farmBuildingTypes![typeIndex]!.levels[levelIndex] = {
      ...level,
      cost: { ...level.cost, items: [...(level.cost?.items ?? []), { itemId, count: 1 }] },
    };
  });
  rerender();
}

function removeBuildingCostItem(typeIndex: number, levelIndex: number, itemIndex: number, rerender: () => void): void {
  recordProjectSnapshot("건물 재료 삭제");
  store.update((project) => {
    const level = project.database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex];
    if (!level) return;
    project.database.farmBuildingTypes![typeIndex]!.levels[levelIndex] = {
      ...level,
      cost: { ...level.cost, items: (level.cost?.items ?? []).filter((_, index) => index !== itemIndex) },
    };
  });
  toast("재료를 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function patchBuildingType(index: number, patch: Partial<FarmBuildingTypeRecord>, structural: boolean, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-spatial-building-type:${index}`);
  store.update((project) => { const row = project.database.farmBuildingTypes?.[index]; if (row) project.database.farmBuildingTypes![index] = { ...row, ...patch }; });
  if (structural) rerender?.();
}

function patchBuildingLevel(index: number, levelIndex: number, patch: Partial<FarmBuildingLevelDefinition>, structural: boolean, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-spatial-building-level:${index}:${levelIndex}`);
  store.update((project) => { const row = project.database.farmBuildingTypes?.[index]?.levels[levelIndex]; if (row) project.database.farmBuildingTypes![index]!.levels[levelIndex] = { ...row, ...patch }; });
  if (structural) rerender?.();
}

function patchFootprint(index: number, levelIndex: number, axis: "width" | "height", value: number): void {
  const level = store.getCurrent().database.farmBuildingTypes?.[index]?.levels[levelIndex];
  if (!level) return;
  const next = { ...level.footprint, [axis]: value };
  if (next.width * next.height > 128) next[axis] = Math.max(1, Math.floor(128 / (axis === "width" ? next.height : next.width)));
  patchBuildingLevel(index, levelIndex, { footprint: next }, false);
}

function patchBuildingCost(index: number, levelIndex: number, gold: number): void {
  const level = store.getCurrent().database.farmBuildingTypes?.[index]?.levels[levelIndex];
  if (!level) return;
  patchBuildingLevel(index, levelIndex, { cost: { ...level.cost, gold } }, false);
}

function patchBuildingCostItem(
  index: number,
  levelIndex: number,
  itemIndex: number,
  patch: { itemId?: string; count?: number },
  rerender?: () => void,
): void {
  const level = store.getCurrent().database.farmBuildingTypes?.[index]?.levels[levelIndex];
  const items = level?.cost?.items;
  if (!level || !items?.[itemIndex]) return;
  const next = items.map((item, current) => current === itemIndex ? { ...item, ...patch } : item);
  patchBuildingLevel(index, levelIndex, { cost: { ...level.cost, items: next } }, Boolean(rerender), rerender);
}

function patchDecorationType(index: number, patch: Partial<HomeDecorationTypeRecord>, structural: boolean, rerender?: () => void): void {
  recordCoalescedSnapshot(`db-spatial-decoration-type:${index}`);
  store.update((project) => { const row = project.database.homeDecorationTypes?.[index]; if (row) project.database.homeDecorationTypes![index] = { ...row, ...patch }; });
  if (structural) rerender?.();
}

function patchBuildingPlacement(index: number, patch: Partial<FarmBuildingPlacement>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-building-placement:${index}`);
  store.update((project) => { const row = project.session.farmBuildingPlacements?.[index]; if (row) project.session.farmBuildingPlacements![index] = { ...row, ...patch }; });
  rerender();
}

function patchDecorationPlacement(index: number, patch: Partial<HomeDecorationPlacement>, rerender: () => void): void {
  recordCoalescedSnapshot(`db-spatial-decoration-placement:${index}`);
  store.update((project) => { const row = project.session.homeDecorationPlacements?.[index]; if (row) project.session.homeDecorationPlacements![index] = { ...row, ...patch }; });
  rerender();
}

function renameType(kind: "building" | "decoration", index: number, raw: string, rerender: () => void): void {
  const id = cleanId(raw);
  const project = store.getCurrent();
  const rows = kind === "building" ? project.database.farmBuildingTypes ?? [] : project.database.homeDecorationTypes ?? [];
  const current = rows[index];
  if (!current || !id || rows.some((row, rowIndex) => rowIndex !== index && row.id === id)) {
    toast("ID는 비어 있지 않고 같은 목록에서 고유해야 합니다.", "error");
    rerender();
    return;
  }
  recordProjectSnapshot(kind === "building" ? "건물 유형 ID 변경" : "장식 유형 ID 변경");
  store.update((draft) => {
    if (kind === "building") {
      const row = draft.database.farmBuildingTypes?.[index];
      if (!row) return;
      const oldId = row.id;
      draft.database.farmBuildingTypes![index] = { ...row, id };
      draft.session.farmBuildingPlacements = draft.session.farmBuildingPlacements?.map((placement) => placement.typeId === oldId ? { ...placement, typeId: id } : placement);
    } else {
      const row = draft.database.homeDecorationTypes?.[index];
      if (!row) return;
      const oldId = row.id;
      draft.database.homeDecorationTypes![index] = { ...row, id };
      draft.session.homeDecorationPlacements = draft.session.homeDecorationPlacements?.map((placement) => placement.typeId === oldId ? { ...placement, typeId: id } : placement);
    }
  });
  spatialSelection = { kind: kind === "building" ? "buildingType" : "decorationType", id };
  rerender();
}

function renamePlacement(kind: "building" | "decoration", index: number, raw: string, rerender: () => void): void {
  const id = cleanId(raw);
  const project = store.getCurrent();
  const rows = kind === "building" ? project.session.farmBuildingPlacements ?? [] : project.session.homeDecorationPlacements ?? [];
  const current = rows[index];
  if (!current || !id || rows.some((row, rowIndex) => rowIndex !== index && row.instanceId === id)) {
    toast("배치 ID는 같은 목록에서 고유해야 합니다.", "error");
    rerender();
    return;
  }
  const oldId = current.instanceId;
  spatialSelection = { kind: kind === "building" ? "buildingPlacement" : "decorationPlacement", id };
  if (kind === "building") {
    recordProjectSnapshot("시작 건물 배치 ID 변경");
    store.update((draft) => {
      const row = draft.session.farmBuildingPlacements?.[index];
      if (!row) return;
      draft.session.farmBuildingPlacements![index] = { ...row, instanceId: id };
      if (oldId !== id && draft.session.farmAnimals) {
        draft.session.farmAnimals = draft.session.farmAnimals.map((animal) =>
          animal.housingPlacementId === oldId ? { ...animal, housingPlacementId: id } : animal,
        );
      }
    });
    rerender();
    return;
  }
  patchDecorationPlacement(index, { instanceId: id }, rerender);
}

function removeBuildingType(id: string, rerender: () => void): void {
  const index = (store.getCurrent().database.farmBuildingTypes ?? []).findIndex((row) => row.id === id);
  if (index < 0) return;
  const blocked = farmBuildingTypeReferenceMessage(id);
  if (blocked) { toast(blocked, "error"); rerender(); return; }
  recordProjectSnapshot("범용 농장 건물 유형 삭제");
  store.update((project) => { project.database.farmBuildingTypes?.splice(index, 1); });
  if (spatialSelection?.kind === "buildingType" && spatialSelection.id === id) spatialSelection = null;
  rerender();
}

function removeDecorationType(id: string, rerender: () => void): void {
  const index = (store.getCurrent().database.homeDecorationTypes ?? []).findIndex((row) => row.id === id);
  if (index < 0) return;
  const blocked = homeDecorationTypeReferenceMessage(id);
  if (blocked) { toast(blocked, "error"); rerender(); return; }
  recordProjectSnapshot("집 장식 유형 삭제");
  store.update((project) => { project.database.homeDecorationTypes?.splice(index, 1); });
  if (spatialSelection?.kind === "decorationType" && spatialSelection.id === id) spatialSelection = null;
  rerender();
}

function removeBuildingPlacement(id: string, rerender: () => void): void {
  const index = (store.getCurrent().session.farmBuildingPlacements ?? []).findIndex((row) => row.instanceId === id);
  if (index < 0) return;
  const impact = countAuthoredAnimalsOnPlacement(id);
  recordProjectSnapshot("시작 범용 농장 건물 삭제");
  store.update((project) => {
    project.session.farmBuildingPlacements?.splice(index, 1);
    if (project.session.farmAnimals) {
      project.session.farmAnimals = project.session.farmAnimals.map((animal) => {
        if (animal.housingPlacementId !== id) return animal;
        const { housingPlacementId: _removed, ...rest } = animal;
        return rest;
      });
    }
  });
  if (spatialSelection?.kind === "buildingPlacement" && spatialSelection.id === id) spatialSelection = null;
  toast(impact > 0
    ? `시작 건물 배치를 삭제했습니다. 미배정 ${impact}마리. Ctrl+Z 로 되돌릴 수 있습니다.`
    : "시작 건물 배치를 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function removeDecorationPlacement(id: string, rerender: () => void): void {
  const index = (store.getCurrent().session.homeDecorationPlacements ?? []).findIndex((row) => row.instanceId === id);
  if (index < 0) return;
  recordProjectSnapshot("시작 집 장식 삭제");
  store.update((project) => { project.session.homeDecorationPlacements?.splice(index, 1); });
  if (spatialSelection?.kind === "decorationPlacement" && spatialSelection.id === id) spatialSelection = null;
  toast("시작 장식 배치를 삭제했습니다. Ctrl+Z 로 되돌릴 수 있습니다.", "ok");
  rerender();
}

function cleanId(value: string): string { return value.trim().replace(/\s+/gu, "_"); }
function uniqueId(base: string, used: ReadonlySet<string>): string { let id = genId(base); while (used.has(id)) id = genId(base); return id; }

function housingSpeciesToggles(
  record: FarmBuildingTypeRecord,
  index: number,
  rerender: () => void,
): HTMLElement {
  const species = store.getCurrent().database.farmAnimalSpecies ?? [];
  const allowed = new Set(record.animalHousing?.allowedSpeciesIds ?? []);
  if (species.length === 0) {
    return field("허용 종", el("span", { class: "db-wa-chip", text: "등록된 동물 종이 없습니다" }));
  }
  const box = el("div", {
    class: "db-wa-toggles",
    dataset: { testid: `db-spatial-building-housing-species-${record.id}` },
  });
  for (const entry of species) {
    const checkbox = el("input", {
      attrs: { type: "checkbox", ...(allowed.has(entry.id) ? { checked: "" } : {}) },
      dataset: { testid: `db-spatial-building-housing-species-${record.id}-${entry.id}` },
    }) as HTMLInputElement;
    checkbox.addEventListener("change", () => {
      const next = new Set(record.animalHousing?.allowedSpeciesIds ?? []);
      if (checkbox.checked) next.add(entry.id);
      else next.delete(entry.id);
      patchBuildingType(index, { animalHousing: { allowedSpeciesIds: [...next] } }, true, rerender);
    });
    box.append(el("label", { class: "db-wa-toggle", children: [checkbox, el("span", { text: entry.name })] }));
  }
  return field("허용 종", box);
}

function setBuildingAnimalHousing(typeIndex: number, enabled: boolean, rerender: () => void): void {
  const project = store.getCurrent();
  const type = project.database.farmBuildingTypes?.[typeIndex];
  if (!type) return;
  if (enabled) {
    recordProjectSnapshot("건물 동물 주거 사용");
    store.update((draft) => {
      const row = draft.database.farmBuildingTypes?.[typeIndex];
      if (!row) return;
      draft.database.farmBuildingTypes![typeIndex] = {
        ...row,
        animalHousing: row.animalHousing ?? { allowedSpeciesIds: [] },
        levels: row.levels.map((level) => ({
          ...level,
          animalCapacity: level.animalCapacity ?? 0,
        })),
      };
    });
    housingImpactNotices.delete(`housing:${type.id}`);
    rerender();
    return;
  }
  const impact = previewHousingDisableImpact(typeIndex);
  recordProjectSnapshot("건물 동물 주거 해제");
  store.update((draft) => {
    const row = draft.database.farmBuildingTypes?.[typeIndex];
    if (!row) return;
    const { animalHousing: _removed, ...rest } = row;
    draft.database.farmBuildingTypes![typeIndex] = {
      ...rest,
      levels: rest.levels.map((level) => {
        const { animalCapacity: _capacity, ...levelRest } = level;
        return levelRest;
      }),
    };
    applyAuthoredHousingReconcile(draft);
  });
  housingImpactNotices.set(`housing:${type.id}`, impact);
  if (impact > 0) toast(`동물 주거를 껐습니다. 미배정 ${impact}마리.`, "ok");
  rerender();
}

function commitAnimalCapacity(typeIndex: number, levelIndex: number, value: number, rerender: () => void): void {
  const project = store.getCurrent();
  const type = project.database.farmBuildingTypes?.[typeIndex];
  const level = type?.levels[levelIndex];
  if (!type || !level || !type.animalHousing) return;
  const next = Math.max(0, Math.min(9999, Math.trunc(value)));
  const previous = level.animalCapacity ?? 0;
  if (next === previous) {
    patchBuildingLevel(typeIndex, levelIndex, { animalCapacity: next }, false);
    return;
  }
  const impact = next < previous ? previewAnimalCapacityImpact(typeIndex, levelIndex, next) : 0;
  recordCoalescedSnapshot(`db-spatial-building-level:${typeIndex}:${levelIndex}`);
  store.update((draft) => {
    const row = draft.database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex];
    if (!row) return;
    draft.database.farmBuildingTypes![typeIndex]!.levels[levelIndex] = { ...row, animalCapacity: next };
    if (next < previous) applyAuthoredHousingReconcile(draft);
  });
  housingImpactNotices.set(`capacity:${type.id}:${level.level}`, impact);
  rerender();
}

function countAuthoredAnimalsOnPlacement(instanceId: string): number {
  return (store.getCurrent().session.farmAnimals ?? [])
    .filter((animal) => animal.housingPlacementId === instanceId).length;
}

function previewHousingDisableImpact(typeIndex: number): number {
  const project = structuredClone(store.getCurrent());
  const row = project.database.farmBuildingTypes?.[typeIndex];
  if (!row) return 0;
  const { animalHousing: _removed, ...rest } = row;
  project.database.farmBuildingTypes![typeIndex] = {
    ...rest,
    levels: rest.levels.map((level) => {
      const { animalCapacity: _capacity, ...levelRest } = level;
      return levelRest;
    }),
  };
  return measureNewlyUnassigned(store.getCurrent(), project);
}

function previewAnimalCapacityImpact(typeIndex: number, levelIndex: number, nextCapacity: number): number {
  const project = structuredClone(store.getCurrent());
  const row = project.database.farmBuildingTypes?.[typeIndex]?.levels[levelIndex];
  if (!row) return 0;
  project.database.farmBuildingTypes![typeIndex]!.levels[levelIndex] = { ...row, animalCapacity: nextCapacity };
  return measureNewlyUnassigned(store.getCurrent(), project);
}

function measureNewlyUnassigned(beforeProject: Project, afterProject: Project): number {
  const before = assignedHousingIds(beforeProject.session.farmAnimals ?? []);
  const afterAnimals = reconcileAuthoredAnimals(afterProject);
  const after = assignedHousingIds(afterAnimals);
  let count = 0;
  for (const id of before) if (!after.has(id)) count += 1;
  return count;
}

function assignedHousingIds(animals: readonly FarmAnimalStartInstance[]): Set<string> {
  return new Set(animals.filter((animal) => animal.housingPlacementId !== undefined).map((animal) => animal.instanceId));
}

function reconcileAuthoredAnimals(project: Project): FarmAnimalStartInstance[] {
  const animals = project.session.farmAnimals ?? [];
  const asRecord = Object.fromEntries(animals.map((animal) => [animal.instanceId, animal]));
  const placements = Object.fromEntries((project.session.farmBuildingPlacements ?? []).map((row) => [row.instanceId, row]));
  const next = reconcileLinkedAnimalHousing(project, { farmBuildingPlacements: placements }, asRecord) ?? {};
  return animals.map((animal) => next[animal.instanceId] ?? animal);
}

function applyAuthoredHousingReconcile(draft: Project): void {
  if (!draft.session.farmAnimals) return;
  draft.session.farmAnimals = reconcileAuthoredAnimals(draft);
}
