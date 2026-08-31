// 데이터베이스 → 타일셋 탭.
//
// 2026-08 모던 개편 전에는 이 탭이 29 탭 중 최악이었다(게이트 clipped:9 overlap:1).
// 원인은 전부 "손으로 조립한 grid 가 자식 수와 안 맞는 것"이었다:
//   - `.tileset-db-editor.simplified` 는 `grid-template-rows: auto minmax(0,1fr)` 인데
//     자식이 셋(속성 / 시트 / AI 런처)이라 세 번째가 암시 행으로 밀려 상자 밖에서 잘리고,
//     `.oprn-tileset-main` 의 `min-height: min(74vh,760px)` 가 자기 트랙을 넘겨서
//     런처와 69px 겹쳤다.
//   - 목록 창이 168px 로 고정돼 타일셋 이름 8 개가 전부 말줄임으로 잘렸다.
//   - `.oprn-browse-button` 이 34×34px 로 못박혀 "설정..." 세 글자가 버튼 밖으로 흘렀다.
//
// 그래서 레이아웃을 databaseWorkspace.ts 프리미티브에 넘긴다. 이 파일은 "무엇을 보여줄지"만
// 정하고 행/스크롤 경계는 workspaceShell/listPane/detailPane 이 보장한다.
//
// 상세 창 콘텐츠 자체(속성 폼 · 칩셋 시트 · 섹션별 보조 패널)는 여전히
// tilesetSettingsDetails.renderTilesetEditor 가 만든다 — 그 함수는 tilesetSectionTabs.test.ts
// 의 계약이라 그대로 두고, 여기서 **조각을 꺼내 워크스페이스 슬롯에 다시 꽂는다**.
// (조각별 export 가 생기면 splitLegacyEditor 는 지워도 된다.)

import { editorState } from "@/editor/editorState";
import { matchesNameOrId } from "@/editor/panels/databaseControls";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { openTilesetAiWorkspace } from "@/editor/panels/tilesetAiWorkspaceModal";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { store } from "@/project/store";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";

const TILESET_SELECTION_KEY = "oprn:database.selectedTilesetId";

let selectedTilesetId: string | null = null;
let listQuery = "";

export function renderTilesetsTab(host: HTMLElement, rerender: () => void): void {
  const tilesets = Object.values(store.getCurrent().tilesets);
  const selected = selectTileset(tilesets);
  if (!selected) {
    host.append(renderEmptyWorkspace());
    return;
  }
  host.append(
    workspaceShell({
      list: renderTilesetList(tilesets, selected.id, rerender),
      detail: renderTilesetDetail(selected, rerender),
      legacyClass: "db-ws-tilesets",
      testid: "db-tilesets-workspace",
    }),
  );
}

function renderEmptyWorkspace(): HTMLElement {
  const detail = detailPane({
    body: emptyState({
      icon: "▦",
      title: "타일셋이 없습니다",
      body: "프로젝트에 타일셋이 하나도 없습니다. 소재 관리자에서 칩셋을 가져오거나 기본 타일셋을 복구하세요.",
    }),
    testid: "db-tilesets-detail-pane",
  });
  markDetailForm(detail);
  return workspaceShell({ detail, legacyClass: "db-ws-tilesets", testid: "db-tilesets-workspace" });
}

// ---------------------------------------------------------------------------
// 목록 창
// ---------------------------------------------------------------------------

function renderTilesetList(
  tilesets: readonly TilesetDef[],
  selectedId: string,
  rerender: () => void,
): HTMLElement {
  const query = listQuery.trim();
  const usage = mapUsageByTileset();
  const rows: HTMLElement[] = [];
  for (const [index, tileset] of tilesets.entries()) {
    const name = tileset.name || "(이름 없음)";
    if (query.length > 0 && !matchesNameOrId(name, tileset.id, query)) continue;
    const used = usage.get(tileset.id) ?? 0;
    rows.push(
      listRow({
        name,
        ...(used > 0 ? { sub: `${used}개 맵` } : {}),
        number: index + 1,
        active: tileset.id === selectedId,
        title: `${name}\n${tileset.id}`,
        testid: `tileset-db-row-${tileset.id}`,
        onSelect: () => {
          setSelectedTileset(tileset.id);
          rerender();
        },
      }),
    );
  }

  const pane = listPane({
    title: "타일셋",
    count: tilesets.length,
    search: listSearch({
      placeholder: "타일셋 이름·ID 검색",
      value: listQuery,
      testid: "tileset-db-search",
      onInput: (value) => {
        listQuery = value;
        rerender();
      },
    }),
    rows,
    empty: query.length > 0
      ? emptyState({
        icon: "⌕",
        title: "검색 결과가 없습니다",
        body: `"${query}" 와(과) 일치하는 타일셋이 없습니다.`,
        compact: true,
      })
      : emptyState({ icon: "▦", title: "타일셋이 없습니다", compact: true }),
    testid: "db-tilesets-list-pane",
  });
  revealSelectedTileset(pane);
  return pane;
}

function mapUsageByTileset(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const map of Object.values(store.getCurrent().maps)) {
    const id = map.tilesetId;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function revealSelectedTileset(pane: HTMLElement): void {
  const selected = pane.querySelector?.(".db-ws-row.active");
  if (!(selected instanceof HTMLElement) || typeof selected.scrollIntoView !== "function") return;
  selected.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// ---------------------------------------------------------------------------
// 상세 창
// ---------------------------------------------------------------------------

function renderTilesetDetail(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const parts = splitLegacyEditor(tileset, rerender);
  const body: HTMLElement[] = [];

  if (parts.properties) {
    // 카드 제목은 일부러 없다 — fieldset legend 가 이미 "이름 / 타일셋 그래픽 /
    // 투명색" 을 말하고 있어서 머리글을 얹으면 34px 을 그림판에서 뺏기만 한다.
    body.push(sectionCard({ children: [parts.properties], testid: "db-tileset-properties-card" }));
  }
  if (parts.sectionTabs) body.push(parts.sectionTabs);
  if (parts.workbench) body.push(parts.workbench);
  if (parts.fallback) body.push(parts.fallback);

  const detail = detailPane({
    hero: detailHero({
      eyebrow: "타일셋",
      title: tileset.name || "(이름 없음)",
      tags: heroTags(tileset),
      actions: [
        {
          label: "AI 타일셋",
          kind: "primary",
          title: "타일셋 전체를 분석하고 애매한 칸만 확인합니다.",
          testid: "tileset-ai-workspace-open",
          onClick: () => openTilesetAiWorkspace(tileset.id, rerender),
        },
      ],
      testid: "db-tilesets-hero",
    }),
    body,
    testid: "db-tilesets-detail-pane",
  });
  markDetailForm(detail);
  return detail;
}

function heroTags(tileset: TilesetDef): readonly string[] {
  const passage = passageSummary(tileset);
  return [
    `${tileset.count}칸`,
    `O ${passage.open} · X ${passage.blocked} · ★ ${passage.upper}`,
  ];
}

function passageSummary(tileset: TilesetDef): { open: number; blocked: number; upper: number } {
  let open = 0;
  let blocked = 0;
  let upper = 0;
  for (let index = 0; index < tileset.count; index += 1) {
    const mark = passageMarkForTile(tileset, index);
    if (mark === "o") open += 1;
    else if (mark === "x") blocked += 1;
    else if (mark === "star") upper += 1;
  }
  return { open, blocked, upper };
}

/**
 * `.db-detail-form` testid 계약(qa-tilesets / databaseRecordPartialRender 등)을 상세 창
 * 본문 래퍼에 옮겨 붙인다. 예전처럼 최상위 `section.db-detail-form` 을 쓰면
 * 05-dense-workbenches.css 의 `.db-detail-form { overflow:auto }` 가 두 번째 스크롤
 * 컨테이너를 만들어 `.db-ws-detail-body` 와 경쟁한다.
 */
function markDetailForm(detail: HTMLElement): void {
  const body = detail.querySelector?.(".db-ws-detail-body");
  if (body instanceof HTMLElement) body.dataset.testid = "db-detail-form";
}

// ---------------------------------------------------------------------------
// 레거시 편집기 조각 재배치
// ---------------------------------------------------------------------------

type EditorParts = {
  readonly properties?: HTMLElement;
  readonly sectionTabs?: HTMLElement;
  readonly workbench?: HTMLElement;
  /** 예상한 모양이 아니면 통째로 넣어 기능을 잃지 않는다. */
  readonly fallback?: HTMLElement;
};

/**
 * `renderTilesetEditor` 는 [속성, 그림판 워크벤치] 두 조각을 만든다.
 * 예전 세 번째 조각(AI 런처)은 히어로 액션이 정본이라 편집기에서 빼 두었다.
 *
 * - 속성: 섹션 3탭(규칙/지식/구성)을 밖으로 꺼내 워크벤치 바로 위 레일로 세운다.
 */
function splitLegacyEditor(tileset: TilesetDef, rerender: () => void): EditorParts {
  const editor = renderTilesetEditor(tileset, rerender);
  const properties = childByClass(editor, "oprn-tileset-properties");
  const workbench = childByClass(editor, "oprn-tileset-main");
  if (!properties || !workbench) return { fallback: editor };

  const sectionTabs = childByClass(properties, "tileset-section-tabs");
  sectionTabs?.remove();
  properties.remove();
  workbench.remove();
  workbench.classList.add("db-ws-tileset-workbench");
  sectionTabs?.classList.add("db-ws-tileset-rail");
  return { properties, ...(sectionTabs ? { sectionTabs } : {}), workbench };
}

function childByClass(parent: HTMLElement, className: string): HTMLElement | null {
  for (const child of Array.from(parent.children)) {
    if (child instanceof HTMLElement && child.classList.contains(className)) return child;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 선택 상태
// ---------------------------------------------------------------------------

function selectTileset(tilesets: readonly TilesetDef[]): TilesetDef | undefined {
  if (tilesets.length === 0) {
    selectedTilesetId = null;
    return undefined;
  }
  const storedId = selectedTilesetId ?? readStoredSelectedTilesetId();
  const preferredTilesetId = currentMapTilesetId() ?? "easyrpg_chipset_combined_town";
  const selected = tilesets.find((tileset) => tileset.id === storedId)
    ?? tilesets.find((tileset) => tileset.id === preferredTilesetId)
    ?? tilesets[0];
  selectedTilesetId = selected.id;
  return selected;
}

function setSelectedTileset(tilesetId: string): void {
  selectedTilesetId = tilesetId;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TILESET_SELECTION_KEY, tilesetId);
}

function readStoredSelectedTilesetId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TILESET_SELECTION_KEY);
}

function currentMapTilesetId(): string | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  return project.maps[mapId]?.tilesetId ?? null;
}
