import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proposalSummaryLines } from "@/editor/panels/aiChatPanel";
import {
  addPalettePresetToTileset,
  renderPalettePresetEditor,
  setPalettePresetLocked,
  setPalettePresetSlotTiles,
  togglePalettePresetSlotTile,
} from "@/editor/panels/palettePresetEditor";
import {
  approveAllReviewTiles,
  applyReviewConfirmation,
  buildTilesetReviewQueue,
  lowConfidenceReviewCount,
  renderTilesetReviewWizard,
  transitionTilesetReviewQueue,
} from "@/editor/panels/tilesetReviewWizard";
import { reauditTileset, type TilesetVisionClient } from "@/editor/tilesetReaudit";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { PalettePreset, Project, TileAiMetadata, TilesetDef } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  store.replace(createBlankProject());
  store.getCurrent().tilesets[DEFAULT_TILESET_ID].tileMeta = [];
  resetMapEditHistory();
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  resetMapEditHistory();
  vi.restoreAllMocks();
});

describe("tileset review wizard", () => {
  it("신뢰도 오름차순으로 검토 큐를 만든다", () => {
    const tileset = testTileset();
    setMeta(tileset, 4, { confidence: 0.8, origin: "ai" });
    setMeta(tileset, 2, { confidence: 0.2, origin: "ai" });
    setMeta(tileset, 3, { confidence: 0.2, origin: "ai" });

    expect(buildTilesetReviewQueue(tileset).map((item) => item.tile)).toEqual([2, 3, 4]);
  });

  it("confidence 1 타일과 사용자 확정 타일은 큐에서 제외한다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 1, origin: "ai" });
    setMeta(tileset, 2, { origin: "user" });
    setMeta(tileset, 3, { confidence: 0.7, origin: "ai" });

    expect(buildTilesetReviewQueue(tileset).map((item) => item.tile)).toEqual([3]);
  });

  it("건너뛰기 상태 전이는 현재 타일을 skipped에 남긴다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 0.1 });
    setMeta(tileset, 2, { confidence: 0.2 });
    const state = { queue: buildTilesetReviewQueue(tileset), skipped: [] };

    const next = transitionTilesetReviewQueue(state, "skip", 1);

    expect(next.queue.map((item) => item.tile)).toEqual([2]);
    expect(next.skipped).toEqual([1]);
  });

  it("일괄 승인 라벨의 낮은 신뢰 카운트는 confidence < 0.5만 센다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 0.49 });
    setMeta(tileset, 2, { confidence: 0.5 });
    setMeta(tileset, 3, { confidence: 0.9 });

    expect(lowConfidenceReviewCount(buildTilesetReviewQueue(tileset))).toBe(1);
  });

  it("위저드는 카드와 확인/건너뛰기 버튼, overlay mode, 일괄 승인 버튼을 렌더한다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 0.3, label: "애매한 길", role: "path" });

    const root = renderWithFakeDom(() => renderTilesetReviewWizard({ tileset }));

    expect(findByTestId(root, "tileset-review-wizard")).toBeTruthy();
    expect(findByTestId(root, "tileset-review-queue-card")?.textContent).toContain("신뢰도 30%");
    expect(findByTestId(root, "tileset-review-confirm")).toBeTruthy();
    expect(findByTestId(root, "tileset-review-fix")).toBeNull();
    expect(findByTestId(root, "tileset-review-skip")).toBeTruthy();
    expect(findByTestId(root, "tileset-review-overlay-passage")).toBeTruthy();
    expect(findByTestId(root, "tileset-review-overlay-role")).toBeTruthy();
    expect(findByTestId(root, "tileset-review-overlay-group")).toBeTruthy();
    expect(findByTestId(root, "tileset-review-approve-all")?.textContent).toContain("낮은 신뢰 1칸 포함 승인");
  });

  it("맞음 버튼은 confidence를 1로 승격하고 origin은 유지한다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 0.3, origin: "ai" });
    const root = renderWithFakeDom(() => renderTilesetReviewWizard({ tileset }));

    findByTestId(root, "tileset-review-confirm")?.click();

    expect(testTileset().tileMeta?.[1]).toMatchObject({ confidence: 1, origin: "ai" });
  });

  it("건너뛰기 버튼은 다음 카드로 진행한다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 0.1, label: "첫 타일" });
    setMeta(tileset, 2, { confidence: 0.2, label: "둘째 타일" });
    const root = renderWithFakeDom(() => renderTilesetReviewWizard({ tileset }));

    findByTestId(root, "tileset-review-skip")?.click();

    expect(findByTestId(root, "tileset-review-queue-card")?.textContent).toContain("둘째 타일");
  });

  it("일괄 승인은 큐의 모든 타일 confidence를 1로 만든다", () => {
    const tileset = testTileset();
    setMeta(tileset, 1, { confidence: 0.1 });
    setMeta(tileset, 2, { confidence: 0.9 });
    const queue = buildTilesetReviewQueue(tileset);

    approveAllReviewTiles(tileset.id, queue);

    expect(testTileset().tileMeta?.[1].confidence).toBe(1);
    expect(testTileset().tileMeta?.[2].confidence).toBe(1);
  });

});

describe("locked tile metadata guards", () => {
  it("set_tile_metadata는 locked tileMeta를 AI 경로에서 보존한다", () => {
    const context: ToolContext = { project: projectWithLockedTile(1) };
    const result = runTool(context, "set_tile_metadata", { entries: [{ tile: 1, label: "AI 추측" }] });

    expect(result.ok).toBe(true);
    expect(result.diff?.warnings).toContain("잠긴 항목 1개 보존됨");
    expect(context.project.tilesets[DEFAULT_TILESET_ID].tileMeta?.[1].label).toBe("잠금 라벨");
  });

  it("set_tile_rules는 locked tileMeta의 통행/지형 변경도 보존한다", () => {
    const context: ToolContext = { project: projectWithLockedTile(1) };
    const before = context.project.tilesets[DEFAULT_TILESET_ID].terrain[1];
    const result = runTool(context, "set_tile_rules", { entries: [{ tile: 1, passable: false, terrainTag: before + 1 }] });

    expect(result.ok).toBe(true);
    expect(result.diff?.warnings).toContain("잠긴 항목 1개 보존됨");
    expect(context.project.tilesets[DEFAULT_TILESET_ID].terrain[1]).toBe(before);
  });

  it("confirmedByUser=true는 잠긴 tileMeta를 사용자 확정으로 수정할 수 있다", () => {
    const context: ToolContext = { project: projectWithLockedTile(1) };
    const result = runTool(context, "set_tile_metadata", { entries: [{ tile: 1, label: "사람 수정" }], confirmedByUser: true });

    expect(result.ok).toBe(true);
    expect(context.project.tilesets[DEFAULT_TILESET_ID].tileMeta?.[1]).toMatchObject({
      confidence: 1,
      label: "사람 수정",
      locked: true,
      origin: "user",
    });
  });
});

describe("tileset reaudit pipeline", () => {
  it("mock vision client 호출에서 locked 타일을 제외하고 보존 카운트를 반환한다", async () => {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
    setMeta(tileset, 1, { confidence: 0.2, locked: true });
    setMeta(tileset, 2, { confidence: 0.3 });
    const seen: number[][] = [];
    const client: TilesetVisionClient = {
      classifyTiles: (request) => {
        seen.push([...request.tileIds]);
        return { tiles: [{ tile: 2, label: "새 길", role: "path", confidence: 0.4 }] };
      },
    };

    const result = await reauditTileset(DEFAULT_TILESET_ID, client, { project, tileIds: [1, 2] });

    expect(seen).toEqual([[2]]);
    expect(result.preservedLockedCount).toBe(1);
    expect(result.warnings).toEqual(["잠긴 항목 1개 보존됨"]);
    expect(result.candidates).toEqual([expect.objectContaining({ tile: 2, meta: expect.objectContaining({ label: "새 길", origin: "ai" }) })]);
  });

  it("재감사 후보 적용은 위저드 승인 함수에서만 store에 반영된다", () => {
    const tileset = testTileset();
    const candidate = { tile: 2, meta: { label: "후보 물", description: "", role: "water", confidence: 0.4, origin: "ai" as const } };

    applyReviewConfirmation(tileset, 2, candidate);

    expect(tileset.tileMeta?.[2]).toMatchObject({ confidence: 1, label: "후보 물", origin: "ai" });
  });
});

describe("palette preset editor", () => {
  it("프리셋 신규 생성은 pp_ id와 user origin을 만든다", () => {
    const tileset = testTileset();
    const id = addPalettePresetToTileset(tileset, "pp_test");

    expect(id).toBe("pp_test");
    expect(tileset.palettePresets?.[0]).toMatchObject({ id: "pp_test", origin: "user" });
  });

  it("잠금 토글 helper는 locked 값을 바꾼다", () => {
    const tileset = testTileset();
    tileset.palettePresets = [preset("pp_lock")];

    setPalettePresetLocked(tileset, "pp_lock", true);

    expect(tileset.palettePresets[0]?.locked).toBe(true);
  });

  it("slot 타일 편집은 중복과 범위 밖 타일을 정리한다", () => {
    const tileset = testTileset();
    tileset.palettePresets = [preset("pp_slots")];

    setPalettePresetSlotTiles(tileset, "pp_slots", "ground", [2, 2, -1, tileset.count + 1, 1]);

    expect(tileset.palettePresets[0]?.slots).toEqual([{ role: "ground", tileIds: [1, 2] }]);
  });

  it("slot 그리드 토글 helper는 타일을 추가하고 다시 제거한다", () => {
    const tileset = testTileset();
    tileset.palettePresets = [preset("pp_toggle")];

    togglePalettePresetSlotTile(tileset, "pp_toggle", "decor", 5);
    togglePalettePresetSlotTile(tileset, "pp_toggle", "decor", 5);

    expect(tileset.palettePresets[0]?.slots.find((slot) => slot.role === "decor")?.tileIds).toEqual([]);
  });

  it("프리셋 편집기는 목록, add, lock testid를 렌더하고 add 클릭으로 store를 갱신한다", () => {
    const rerender = vi.fn();
    const root = renderWithFakeDom(() => renderPalettePresetEditor(testTileset(), rerender));

    expect(findByTestId(root, "palette-preset-list")).toBeTruthy();
    expect(findByTestId(root, "palette-preset-add")).toBeTruthy();
    findByTestId(root, "palette-preset-add")?.click();

    const saved = testTileset().palettePresets?.[0];
    expect(saved?.id.startsWith("pp_")).toBe(true);
    expect(rerender).toHaveBeenCalled();
  });

  it("프리셋 편집기는 origin/locked 배지와 lock 토글을 렌더한다", () => {
    const tileset = testTileset();
    tileset.palettePresets = [preset("pp_badged", { locked: true, origin: "ai" })];

    const root = renderWithFakeDom(() => renderPalettePresetEditor(tileset, vi.fn()));

    expect(findByTestId(root, "palette-preset-edit-pp_badged")?.textContent).toContain("AI");
    expect(findByTestId(root, "palette-preset-edit-pp_badged")?.textContent).toContain("잠금");
    expect(findByTestId(root, "palette-preset-lock")?.textContent).toBe("잠금");
  });

  it("프리셋 upsert diff 요약에는 잠긴 항목 보존 문구가 포함된다", () => {
    const context: ToolContext = { project: createBlankProject() };
    context.project.tilesets[DEFAULT_TILESET_ID].palettePresets = [preset("pp_locked", { locked: true })];
    const result = runTool(context, "upsert_palette_preset", {
      preset: { name: "새 AI 프리셋", slots: [{ role: "ground", tileIds: [1] }] },
    });

    expect(result.ok).toBe(true);
    expect(result.diff?.warnings).toContain("잠긴 항목 1개 보존됨");
    expect(proposalSummaryLines([{ name: "upsert_palette_preset", args: {}, summary: result.summary, result, destructive: false }])).toContain("잠긴 항목 1개 보존됨");
  });
});

function testTileset(): TilesetDef {
  return store.getCurrent().tilesets[DEFAULT_TILESET_ID];
}

function setMeta(tileset: TilesetDef, tile: number, patch: Partial<TileAiMetadata>): void {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length <= tile) tileset.tileMeta.push(undefined as unknown as TileAiMetadata);
  const current = tileset.tileMeta[tile] ?? {};
  tileset.tileMeta[tile] = { ...current, ...patch, label: patch.label ?? current.label ?? "", description: patch.description ?? current.description ?? "" };
}

function projectWithLockedTile(tile: number): Project {
  const project = createBlankProject();
  setMeta(project.tilesets[DEFAULT_TILESET_ID], tile, {
    confidence: 1,
    label: "잠금 라벨",
    locked: true,
    origin: "user",
  });
  return project;
}

function preset(id: string, patch: Partial<PalettePreset> = {}): PalettePreset {
  return {
    id,
    name: "프리셋",
    origin: "user",
    slots: [],
    ...patch,
  };
}
