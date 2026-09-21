// 타일셋 섹션 3탭 재편 + 타일별 레이어 수동 지정 계약(2026-07-05).
// - DB 타일셋에서 레이어(자동/하위/상위)를 사용자 확정으로 지정할 수 있고, 로드 시 하네스가 덮지 않는다.
// - 통행/지형 편집도 user 메타로 기록되어 하네스 재적용에 살아남는다.
// - 지형 템플릿(교과서)은 구성 탭으로 이사했다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { passageGlyph } from "@/editor/panels/tilesetChipsetPreview";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import {
  getTilesetPassagePaint,
  getTilesetSectionTab,
  setTilesetMetadataEditMode,
  setTilesetPassagePaint,
  setTilesetSectionTab,
} from "@/editor/panels/tilesetMetadataEditor";
import { createEditorModalDirtyCloseController } from "@/editor/panels/editorModalDirtyState";
import {
  closeTilesetMeaningDialog,
  closeTilesetTileContextMenu,
  openTilesetTileContextMenu,
} from "@/editor/panels/tilesetTileContextMenu";
import { setTileLayerOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import { passageMarkForTile, setPassageMark } from "@/project/tilesetPassage";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const SLOPED_ROOF = 385; // 투명 칩 — 자동 판정은 상위.
const STRAIGHT_ROOF = 404; // 불투명 — 자동 판정은 하위.

describe("타일 레이어 수동 지정(setTileLayerOverride)", () => {
  it("하위로 확정하면 userLocked 메타로 기록되고 하네스 재적용에도 유지된다", () => {
    const tileset = defaultTileset();
    expect(tileset.priority[SLOPED_ROOF]).toBe("upper"); // 자동 판정.

    setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
    expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
    expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("lower");
    expect(tileVisibleOnLayer(tileset, SLOPED_ROOF, "lower")).toBe(true);

    // 프로젝트 로드 시 돌아가는 하네스가 사용자 확정을 덮지 않는다.
    applyCombinedTownHarness(tileset);
    expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
    expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("lower");
  });

  it("상위 확정은 하위 홈 타일(404)에도 적용된다", () => {
    const tileset = defaultTileset();
    setTileLayerOverride(tileset, STRAIGHT_ROOF, "upper");
    expect(tileLayerHome(tileset, STRAIGHT_ROOF)).toBe("upper");
    applyCombinedTownHarness(tileset);
    expect(tileset.priority[STRAIGHT_ROOF]).toBe("upper");
  });

  it("자동으로 되돌리면 하네스 판정(투명 칩=상위)으로 복귀한다", () => {
    const tileset = defaultTileset();
    if (!tileset.tileMeta) throw new Error("missing tile metadata");
    tileset.tileMeta[SLOPED_ROOF] = { label: "", description: "", source: "unknown" };
    setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
    setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull();
    expect(tileset.tileMeta?.[SLOPED_ROOF]?.source).not.toBe("user");
    expect(tileset.tileMeta?.[SLOPED_ROOF]?.locked).toBeUndefined();
    expect(tileset.tileMeta?.[SLOPED_ROOF]?.origin).toBeUndefined();
    expect(tileset.tileMeta?.[SLOPED_ROOF]?.userLocked).toBeUndefined();
    expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
    expect(tileLayerHome(tileset, SLOPED_ROOF)).toBe("upper");
  });

  it("자동 복귀 시 사용자 지식(라벨)은 지우지 않는다", () => {
    const tileset = defaultTileset();
    tileset.tileMeta![SLOPED_ROOF] = { label: "우리집 지붕", description: "", source: "user", userLocked: true };
    setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
    setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
    expect(tileset.tileMeta![SLOPED_ROOF].label).toBe("우리집 지붕");
    expect(tileset.tileMeta![SLOPED_ROOF].userLocked).toBe(true);
  });
});

describe("통행 편집의 레이어 보호", () => {
  it("번들 메타를 통행 편집으로 승격해도 defaultLayer가 사용자 확정으로 둔갑하지 않는다", async () => {
    const { markUserTileRuntimeMetadata } = await import("@/editor/runtimeTileMetadata");
    const tileset = defaultTileset();
    // roof-overlays 그룹 계약이 넣어둔 번들 defaultLayer:"upper"가 있는 상태에서 통행만 기록.
    expect(tileset.tileMeta![SLOPED_ROOF].defaultLayer).toBe("upper");
    markUserTileRuntimeMetadata(tileset, SLOPED_ROOF, { passage: "solid" });
    expect(tileset.tileMeta![SLOPED_ROOF].source).toBe("user");
    expect(tileset.tileMeta![SLOPED_ROOF].defaultLayer).toBeUndefined();
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull(); // 레이어는 여전히 자동.
    // 이미 사용자 확정 레이어가 있으면 통행 편집이 그것을 지우지 않는다.
    setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
    markUserTileRuntimeMetadata(tileset, SLOPED_ROOF, { passage: "passable" });
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
  });

  it("투명 칩에 O/X를 찍어도 priority는 상위를 유지한다", () => {
    const tileset = defaultTileset();
    setPassageMark(tileset, SLOPED_ROOF, "o");
    expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
    setPassageMark(tileset, SLOPED_ROOF, "x");
    expect(tileset.priority[SLOPED_ROOF]).toBe("upper");
    // 불투명 타일은 기존대로 하위로 내려간다.
    setPassageMark(tileset, STRAIGHT_ROOF, "o");
    expect(tileset.priority[STRAIGHT_ROOF]).toBe("lower");
  });
});

describe("타일셋 섹션 UI", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    store.replace(createBlankProject());
    restoreDom = installFakeDom();
    setTilesetMetadataEditMode("passage", () => {}); // rules 탭으로 초기화.
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  function renderEditor(): FakeElement {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    return renderTilesetEditor(tileset, () => {}) as unknown as FakeElement;
  }

  it("참고문서와 설정을 포함한 5탭에서 규칙 탭에 레이어/통행 컨트롤이 있다", () => {
    const editor = renderEditor();
    expect(findByTestId(editor, "tileset-section-tab-references")).toBeTruthy();
    expect(findByTestId(editor, "tileset-section-tab-settings")).toBeTruthy();
    expect(findByTestId(editor, "tileset-section-tab-rules")).toBeTruthy();
    expect(findByTestId(editor, "tileset-section-tab-knowledge")).toBeTruthy();
    expect(findByTestId(editor, "tileset-section-tab-compose")).toBeTruthy();
    expect(findByTestId(editor, "tileset-rule-layer")).toBeTruthy();
    expect(findByTestId(editor, "tileset-rule-passage")).toBeTruthy();
    expect(findByTestId(editor, "tileset-passage-compass-details")?.getAttribute("open")).not.toBeNull();
    expect(findByTestId(editor, "tileset-tile-meaning-edit")).toBeNull();
    expect(findByTestId(editor, "tileset-field-ai-label")).toBeNull();
    expect(findByTestId(editor, "tileset-field-ai-description")).toBeNull();
    // 규칙 탭에는 AI 메타/그룹 모드 버튼이 노출되지 않는다 — 기능 분리.
    expect(findByTestId(editor, "tileset-edit-mode-ai")).toBeNull();
    expect(findByTestId(editor, "tileset-edit-mode-group")).toBeNull();
  });

  it("칩 우클릭 메뉴에서 의미 편집 대화상자를 연다", () => {
    openTilesetTileContextMenu({
      tilesetId: DEFAULT_TILESET_ID,
      tile: 350,
      clientX: 40,
      clientY: 40,
      rerender: () => {},
    });
    const menu = document.querySelector('[data-testid="tileset-tile-context-menu"]');
    expect(menu).toBeTruthy();
    const editBtn = document.querySelector('[data-testid="tileset-ctx-edit-meaning"]') as HTMLButtonElement | null;
    expect(editBtn).toBeTruthy();
    editBtn?.click();
    expect(document.querySelector('[data-testid="tileset-meaning-dialog"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="tileset-meaning-dialog-label"]')).toBeTruthy();
    const label = document.querySelector('[data-testid="tileset-meaning-dialog-label"]') as HTMLInputElement;
    label.value = "우편함";
    label.dispatchEvent(new Event("input"));
    (document.querySelector('[data-testid="tileset-meaning-dialog-apply"]') as HTMLButtonElement)?.click();
    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.tileMeta?.[350]?.label).toBe("우편함");
    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.tileMeta?.[350]?.source).toBe("user");
    closeTilesetMeaningDialog();
    closeTilesetTileContextMenu();
  });

  it("Escape 는 타일 메뉴만 닫고 데이터베이스 모달은 닫지 않는다", () => {
    let closed = false;
    const controller = createEditorModalDirtyCloseController({
      isDirty: () => false,
      promptUnsavedChanges: () => "keep-editing" as const,
      save: () => {},
      discard: () => {},
      close: () => {
        closed = true;
      },
    });

    openTilesetTileContextMenu({
      tilesetId: DEFAULT_TILESET_ID,
      tile: 350,
      clientX: 20,
      clientY: 20,
      rerender: () => {},
    });
    expect(document.querySelector('[data-testid="tileset-tile-context-menu"]')).toBeTruthy();

    // 메뉴가 열려 있으면 DB 모달 close 금지 (nested 가드)
    controller.handleKeyDown({ key: "Escape", defaultPrevented: false } as Event);
    expect(closed).toBe(false);

    closeTilesetTileContextMenu();
    // 메뉴 닫힌 뒤에는 Escape 가 DB 를 닫을 수 있음
    controller.handleKeyDown({ key: "Escape", defaultPrevented: false } as Event);
    expect(closed).toBe(true);
  });

  it("칩셋 프리뷰에 레이어 필터·범례·셀 layer 속성이 있다", () => {
    const editor = renderEditor();
    expect(findByTestId(editor, "tileset-layer-filter")).toBeTruthy();
    expect(findByTestId(editor, "tileset-layer-filter-all")).toBeTruthy();
    expect(findByTestId(editor, "tileset-layer-filter-lower")).toBeTruthy();
    expect(findByTestId(editor, "tileset-layer-filter-upper")).toBeTruthy();
    expect(findByTestId(editor, "tileset-layer-legend")).toBeTruthy();
    expect(findByTestId(editor, "tileset-sheet-info")).toBeTruthy();
    expect(findByTestId(editor, "tileset-selected-layer-badge")).toBeTruthy();

    // 투명 칩 385 = 상위 홈. 셀 data-layer / class에 반영.
    const upperCell = findByTestId(editor, `tileset-db-cell-${SLOPED_ROOF}`) as unknown as {
      getAttribute?: (name: string) => string | null;
      className?: string;
    };
    expect(upperCell.getAttribute?.("data-layer") ?? (upperCell as { dataset?: { layer?: string } }).dataset?.layer).toBe("upper");
    const className = String(upperCell.className ?? "");
    expect(className).toContain("layer-upper");

    const lowerCell = findByTestId(editor, `tileset-db-cell-${STRAIGHT_ROOF}`) as unknown as {
      className?: string;
    };
    expect(String(lowerCell.className ?? "")).toContain("layer-lower");
  });

  it("레이어 버튼으로 하위 확정하면 store에 반영되고 투명 칩 경고가 뜬다", () => {
    let editor = renderEditor();
    // 칩셋 셀 클릭으로 385 선택(규칙 탭 클릭은 통행 토글도 겸한다).
    (findByTestId(editor, `tileset-db-cell-${SLOPED_ROOF}`) as unknown as HTMLElement).click();
    editor = renderEditor();
    (findByTestId(editor, "tileset-layer-lower") as unknown as HTMLElement).click();

    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");

    editor = renderEditor();
    expect(findByTestId(editor, "tileset-layer-warning")).toBeTruthy(); // 투명 칩 하위 경고.
  });

  it("지식 탭에서 설명 필드는 접힌 details 안에 있다", () => {
    setTilesetSectionTab("knowledge", () => {});
    const editor = renderEditor();
    expect(findByTestId(editor, "tileset-tile-meaning-details")).toBeTruthy();
    expect(findByTestId(editor, "tileset-field-ai-description")).toBeTruthy();
    expect(findByTestId(editor, "tileset-selected-usage")).toBeNull();
    setTilesetMetadataEditMode("passage", () => {});
  });

  // 통과 칸도 글리프를 가진다. 예전에는 통과가 "글자 없음"이라 어두운 칩 위에서
  // 「통과」와 「글리프가 안 보임」을 구별할 수 없었다.
  it("통행 붓은 클릭한 칸에 고른 규칙을 칠하고 통과 칸에도 표시가 남는다", () => {
    setTilesetPassagePaint("x");
    let editor = renderEditor();
    expect(getTilesetPassagePaint()).toBe("x");
    const open = findByTestId(editor, "tileset-passage-open") as unknown as HTMLElement;
    const blocked = findByTestId(editor, "tileset-passage-blocked") as unknown as HTMLElement;
    const star = findByTestId(editor, "tileset-passage-star") as unknown as HTMLElement;
    expect(open).toBeTruthy();
    expect(blocked).toBeTruthy();
    expect(star).toBeTruthy();

    const tilesetId = DEFAULT_TILESET_ID;
    expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("x");
    setTilesetPassagePaint("o");
    editor = renderEditor();
    (findByTestId(editor, "tileset-db-cell-0") as unknown as HTMLElement).click();
    expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("o");
    editor = renderEditor();
    const cell = findByTestId(editor, "tileset-db-cell-0") as unknown as { textContent?: string };
    expect(String(cell.textContent ?? "")).toBe(passageGlyph("o"));

    setTilesetPassagePaint("x");
    editor = renderEditor();
    (findByTestId(editor, "tileset-db-cell-0") as unknown as HTMLElement).click();
    expect(passageMarkForTile(store.getCurrent().tilesets[tilesetId]!, 0)).toBe("x");
    setTilesetPassagePaint("o");
  });

  it("구성 탭에는 오토타일 섹션만 렌더된다", () => {
    setTilesetSectionTab("compose", () => {});
    const editor = renderEditor();
    expect(getTilesetSectionTab()).toBe("compose");
    expect(findByTestId(editor, "tileset-autotile-editor")).toBeTruthy();
    expect(findByTestId(editor, "tileset-autotile-toolbar")).toBeTruthy();
    expect(findByTestId(editor, "tileset-autotile-layout-cells-9")).toBeTruthy();
    expect(findByTestId(editor, "tileset-autotile-layout-cells-11")).toBeTruthy();
    expect(findByTestId(editor, "tileset-autotile-layout-custom")).toBeTruthy();
    expect(findByTestId(editor, "tileset-autotile-hint")).toBeTruthy();
    expect(findByTestId(editor, "tileset-selected-tile-panel")).toBeNull();
    expect(findByTestId(editor, "terrain-template-section")).toBeNull();
    expect(findByTestId(editor, "tileset-side-pane-toggle")).toBeNull();
    setTilesetMetadataEditMode("passage", () => {}); // 다른 테스트를 위해 복귀.
  });
});
