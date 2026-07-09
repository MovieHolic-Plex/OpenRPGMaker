import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAutotileEditorPanel } from "@/editor/panels/tilesetAutotileEditor";
import { createBlankProject, DEFAULT_TILESET_ID } from "@/project/defaults";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("tileset autotile editor", () => {
  it("기본 Combined Town 내장 오토타일 그룹을 읽기 전용 행으로 표시한다", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];

    const root = renderWithFakeDom(() => renderAutotileEditorPanel(tileset, vi.fn()));

    expect(findByTestId(root, "tileset-autotile-group-builtin_dirt_road")).toBeTruthy();
    expect(findByTestId(root, "tileset-autotile-group-builtin_sand")).toBeTruthy();
    expect(findByTestId(root, "tileset-autotile-builtin-builtin_dirt_road")?.textContent).toContain("내장");
    expect(findByTestId(root, "tileset-autotile-builtin-builtin_sand")?.textContent).toContain("내장");
    expect((findByTestId(root, "tileset-autotile-members-builtin_sand") as FakeElement | null)?.disabled).toBe(true);
    expect((findByTestId(root, "tileset-autotile-variant-builtin_sand-0") as FakeElement | null)?.disabled).toBe(true);
  });
});
