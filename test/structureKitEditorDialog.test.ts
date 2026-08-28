import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerStructureKit, replaceStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import { store } from "@/project/store";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { SectionStructureKitDef } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.structureKits;
    }
  });
});

function seedKit(): SectionStructureKitDef {
  const kit: SectionStructureKitDef = {
    id: "kit_edit",
    kind: "section",
    name: "우물",
    width: 3,
    height: 3,
    rows: [
      { tiles: [240, 240, 240] },
      { tiles: [240, 116, 240] },
      { tiles: [240, 240, 240] },
    ],
    learnedFrom: "db-authored",
  };
  registerStructureKit(DEFAULT_TILESET_ID, kit);
  return kit;
}

describe("replaceStructureKit", () => {
  it("같은 id 의 킷을 통째로 갈아끼운다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, {
      ...seedKit(),
      name: "고친 우물",
      rows: [{ tiles: [421, 421, 421] }, { tiles: [421, 116, 421] }, { tiles: [421, 421, 421] }],
    });

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit");
    expect(stored).toBeDefined();
    expect(stored!.name).toBe("고친 우물");
    expect((stored as SectionStructureKitDef).rows[0]!.tiles).toEqual([421, 421, 421]);
  });

  it("없는 id 면 아무것도 하지 않는다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, { ...seedKit(), id: "kit_nope", name: "유령" });
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    expect(kits.map((kit) => kit.id)).not.toContain("kit_nope");
  });
});

describe("openStructureKitEditor", () => {
  it("다이얼로그를 열고 래스터·팔레트·크기 입력을 그린다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const dialog = document.querySelector("[data-testid='structure-kit-editor']");
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-canvas']")).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-palette']")).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-width']")).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-height']")).not.toBeNull();
  });

  it("캔버스에 pointerdown 핸들러가 실제로 붙어 있다", () => {
    // 인스펙터가 "드래그하면 부위가 붙습니다"라고 거짓으로 약속하던 그 동작을,
    // 약속한 자리가 아니라 실제로 되는 자리에 만들었는지 못을 박는다.
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']");
    expect(canvas).not.toBeNull();
    expect((canvas as unknown as FakeElement).hasListener("pointerdown")).toBe(true);
  });

  it("팔레트에서 타일을 고르고 칸을 누르면 store 에 반영된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const swatch = document.querySelector("[data-testid='structure-kit-editor-tile-421']");
    expect(swatch).not.toBeNull();
    (swatch as unknown as FakeElement).click();

    // fakeDom 의 getBoundingClientRect() 는 전부 0 이라 (0,0) 칸이 눌린다.
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']")!;
    (canvas as unknown as FakeElement).dispatchEvent(
      Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }),
    );

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.rows[0]!.tiles[0]).toBe(421);
  });
});
