// 타일셋 섹션 3탭 재편 + 타일별 레이어 수동 지정 계약(2026-07-05).
// - DB 타일셋에서 레이어(자동/하위/상위)를 사용자 확정으로 지정할 수 있고, 로드 시 하네스가 덮지 않는다.
// - 통행/지형 편집도 user 메타로 기록되어 하네스 재적용에 살아남는다.
// - 지형 템플릿(교과서)은 구성 탭으로 이사했다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { getTilesetSectionTab, setTilesetMetadataEditMode, setTilesetSectionTab } from "@/editor/panels/tilesetMetadataEditor";
import { setTileLayerOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";
import { setPassageMark } from "@/project/tilesetPassage";
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
    setTileLayerOverride(tileset, SLOPED_ROOF, "lower");
    setTileLayerOverride(tileset, SLOPED_ROOF, "auto");
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBeNull();
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

describe("타일셋 섹션 3탭 UI", () => {
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

  it("탭 3개가 렌더되고 기본 규칙 탭에 레이어/통행 컨트롤이 있다", () => {
    const editor = renderEditor();
    expect(findByTestId(editor, "tileset-section-tab-rules")).toBeTruthy();
    expect(findByTestId(editor, "tileset-section-tab-knowledge")).toBeTruthy();
    expect(findByTestId(editor, "tileset-section-tab-compose")).toBeTruthy();
    expect(findByTestId(editor, "tileset-rule-layer")).toBeTruthy();
    expect(findByTestId(editor, "tileset-rule-passage")).toBeTruthy();
    // 규칙 탭에는 AI 메타/그룹 도구가 노출되지 않는다 — 기능 분리.
    expect(findByTestId(editor, "tileset-edit-mode-ai")).toBeNull();
    expect(findByTestId(editor, "tileset-edit-mode-group")).toBeNull();
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

  it("구성 탭에는 지형 템플릿(교과서) 섹션이 렌더된다", () => {
    setTilesetSectionTab("compose", () => {});
    const editor = renderEditor();
    expect(getTilesetSectionTab()).toBe("compose");
    expect(findByTestId(editor, "terrain-template-section")).toBeTruthy();
    // 내장 작은 집 템플릿이 목록에 보인다.
    expect(findByTestId(editor, "terrain-template-section-list")).toBeTruthy();
    setTilesetMetadataEditMode("passage", () => {}); // 다른 테스트를 위해 복귀.
  });
});
