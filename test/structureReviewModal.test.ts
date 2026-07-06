// 구조물 검토 모달 계약(2026-07-05): "좌표 텍스트 덤프" 대신 넓은 화면 검토.
// extract 초안 → 그리드+행 카드 렌더 → 포함 토글/의미 수정 → 확정 저장(source=user).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openStructureReviewModal } from "@/editor/panels/structureReviewModal";
import { runTool } from "@/editor/tools/toolRunner";
import type { TerrainTemplateDraft } from "@/editor/tools/terrainTemplateExtract";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

// 합성 구조물(벽 3행 + 지붕 1행)을 가진 프로젝트를 store에 올리고 초안을 뽑는다.
function fixtureDraft(): TerrainTemplateDraft {
  const context: ToolContext = { project: createBlankProject() };
  expect(runTool(context, "create_map", { name: "검토 맵", width: 20, height: 20, id: "map_review" }).ok).toBe(true);
  const map = context.project.maps.map_review;
  const put = (layer: "lower" | "upper", y: number, tiles: number[]): void => {
    tiles.forEach((tile, index) => {
      const cell = y * map.width + 5 + index;
      if (layer === "lower") map.lowerTiles[cell] = tile;
      else map.upperTiles[cell] = tile;
    });
  };
  put("upper", 4, [375, 375, 375, 375, 377]);
  put("lower", 5, [15, 16, 16, 16, 17]);
  put("lower", 6, [45, 46, 46, 46, 47]);
  put("lower", 7, [75, 76, 76, 76, 77]);
  store.replace(context.project);
  const extracted = runTool({ project: store.getCurrent() }, "extract_terrain_template", { mapId: "map_review", x: 5, y: 4, w: 5, h: 4, name: "검토 집" });
  expect(extracted.ok, extracted.summary).toBe(true);
  return (extracted.data as { draft: TerrainTemplateDraft }).draft;
}

function savedTemplates() {
  return store.getCurrent().tilesets[DEFAULT_TILESET_ID].terrainTemplates ?? [];
}

describe("structureReviewModal", () => {
  it("그리드와 행 카드가 렌더되고, 확정 저장하면 source=user 템플릿이 생긴다", () => {
    const draft = fixtureDraft();
    expect(draft.rowSpans.length).toBeGreaterThanOrEqual(3);
    const onSaved = vi.fn();
    const modal = openStructureReviewModal({ draft, onSaved }) as unknown as FakeElement;

    expect(findByTestId(modal, "structure-review-grid")).toBeTruthy();
    expect(findByTestId(modal, "structure-review-card-0")).toBeTruthy();
    expect(findByTestId(modal, `structure-review-card-${draft.rowSpans.length - 1}`)).toBeTruthy();
    const nameInput = findByTestId(modal, "structure-review-name") as unknown as HTMLInputElement;
    expect(nameInput.value).toBe("검토 집");

    (findByTestId(modal, "structure-review-save") as unknown as HTMLElement).click();
    const saved = savedTemplates().find((template) => template.name === "검토 집");
    expect(saved).toBeDefined();
    expect(saved?.source).toBe("user");
    expect(saved?.rows.length).toBe(draft.rowSpans.length);
    expect(saved?.sourceRegion?.mapId).toBe("map_review");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "검토 집", savedRows: draft.rowSpans.length }));
  });

  it("행 제외와 의미 수정이 저장 결과에 반영된다", () => {
    const draft = fixtureDraft();
    const modal = openStructureReviewModal({ draft }) as unknown as FakeElement;

    // 첫 행 제외.
    const firstInclude = findByTestId(modal, "structure-review-include-0") as unknown as HTMLInputElement;
    firstInclude.checked = false;
    firstInclude.dispatchEvent(new Event("change"));
    // 두 번째 행 의미 수정.
    const secondMeaning = findByTestId(modal, "structure-review-meaning-1") as unknown as HTMLTextAreaElement;
    secondMeaning.value = "벽 상단부 — 지붕 바로 아래 필수";
    secondMeaning.dispatchEvent(new Event("input"));

    (findByTestId(modal, "structure-review-save") as unknown as HTMLElement).click();
    const saved = savedTemplates().find((template) => template.name === "검토 집");
    expect(saved?.rows.length).toBe(draft.rowSpans.length - 1);
    expect(saved?.rows.some((row) => row.meaning === "벽 상단부 — 지붕 바로 아래 필수")).toBe(true);
  });

  it("모든 행을 제외하면 저장을 거부한다", () => {
    const draft = fixtureDraft();
    const modal = openStructureReviewModal({ draft }) as unknown as FakeElement;
    draft.rowSpans.forEach((_, index) => {
      const include = findByTestId(modal, `structure-review-include-${index}`) as unknown as HTMLInputElement;
      include.checked = false;
      include.dispatchEvent(new Event("change"));
    });
    (findByTestId(modal, "structure-review-save") as unknown as HTMLElement).click();
    expect(savedTemplates().some((template) => template.name === "검토 집")).toBe(false);
  });
});
