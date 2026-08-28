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

describe("편집기 크기 조절", () => {
  it("폭을 늘리면 store 의 킷이 넓어진다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const widthInput = document.querySelector("[data-testid='structure-kit-editor-width']") as unknown as FakeElement;
    expect(widthInput).not.toBeNull();
    (widthInput as unknown as HTMLInputElement).value = "5";
    widthInput.dispatchEvent(new Event("change"));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.width).toBe(5);
    expect(stored.rows[0]!.tiles).toHaveLength(5);
  });

  it("줄여서 부위가 잘리면 개수를 보고한다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, {
      ...(store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
        .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef),
      parts: [{ id: "p_far", kind: "sign", dx: 2, dy: 2, w: 1, h: 1 }],
    });
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const widthInput = document.querySelector("[data-testid='structure-kit-editor-width']") as unknown as FakeElement;
    (widthInput as unknown as HTMLInputElement).value = "1";
    widthInput.dispatchEvent(new Event("change"));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.width).toBe(1);
    expect(stored.parts ?? []).toHaveLength(0);
  });
});

describe("편집기 부위 편집", () => {
  it("부위 도구로 캔버스를 누르고 떼면 부위가 생긴다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();

    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts ?? []).toHaveLength(1);
    expect(stored.parts![0]!.kind).toBe("entrance");
    expect(stored.parts![0]!.dx).toBe(0);
    expect(stored.parts![0]!.dy).toBe(0);
  });

  it("부위 목록에서 종류를 바꾸고 지울 수 있다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    const partId = (store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef).parts![0]!.id;

    const kindSelect = document.querySelector(`[data-testid='structure-kit-editor-part-kind-${partId}']`) as unknown as FakeElement;
    expect(kindSelect).not.toBeNull();
    (kindSelect as unknown as HTMLSelectElement).value = "window";
    kindSelect.dispatchEvent(new Event("change"));

    let stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts![0]!.kind).toBe("window");

    (document.querySelector(`[data-testid='structure-kit-editor-part-delete-${partId}']`) as unknown as FakeElement).click();

    stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts ?? []).toHaveLength(0);
  });
});

describe("편집기 도구 표시", () => {
  it("도구를 바꾸면 활성 표시가 갱신된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-erase']") as unknown as FakeElement).click();

    const eraseBtn = document.querySelector("[data-testid='structure-kit-editor-tool-erase']") as unknown as FakeElement;
    const paintBtn = document.querySelector("[data-testid='structure-kit-editor-tool-paint']") as unknown as FakeElement;
    expect(eraseBtn.classList.contains("primary")).toBe(true);
    expect(paintBtn.classList.contains("primary")).toBe(false);
  });
});

describe("편집기 부위 드래그 안전성", () => {
  it("도구를 바꾼 뒤에도 남은 드래그가 새 부위를 만들지 않는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));

    (document.querySelector("[data-testid='structure-kit-editor-tool-paint']") as unknown as FakeElement).click();
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts ?? []).toHaveLength(0);
  });
});
