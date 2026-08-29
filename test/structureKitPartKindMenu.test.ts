// 부위 종류 팝오버 — 드래그로 그린 사각형의 종류를 고르는 경로.
//
// 별도 파일인 이유: 팝오버는 mapContextMenu 위젯을 빌려 쓰고, 그 위젯이 window 의
// resize/scroll 리스너와 innerWidth 를 쓴다. vitest 환경이 node 라 window 가 없어
// 여기서만 최소 window 를 세워 둔다(다른 편집기 테스트는 window 없는 경로를 그대로 본다).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { SectionStructureKitDef } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let restoreWindow: (() => void) | undefined;

function installFakeWindow(): () => void {
  const previous = Reflect.get(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      innerHeight: 800,
      innerWidth: 1280,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  return () => {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previous });
  };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  restoreWindow = installFakeWindow();
});

afterEach(() => {
  restoreWindow?.();
  restoreWindow = undefined;
  restoreDom?.();
  restoreDom = undefined;
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.structureKits;
    }
  });
});

function seedKit(): void {
  registerStructureKit(DEFAULT_TILESET_ID, {
    id: "kit_part_menu",
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
  });
}

function storedKit(): SectionStructureKitDef {
  return store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
    .find((kit) => kit.id === "kit_part_menu") as SectionStructureKitDef;
}

/** [부위 그리기] 로 (0,0) 한 칸을 끈다. fakeDom 의 rect 는 전부 0 이라 언제나 (0,0) 이다. */
function dragOnePartCell(): void {
  (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();
  const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
  canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
  canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 20, clientY: 30, button: 0 }));
}

function clickMenuOption(kind: string): void {
  const option = document.querySelector(`[data-testid='structure-kit-part-kind-option-${kind}']`);
  expect(option, kind).not.toBeNull();
  (option as unknown as FakeElement).click();
}

describe("부위 종류 팝오버", () => {
  it("드래그를 떼면 네 종류를 묻고, 고르기 전에는 부위를 만들지 않는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_part_menu", () => {});
    dragOnePartCell();

    const menu = document.querySelector("[data-testid='structure-kit-part-kind-menu']");
    expect(menu).not.toBeNull();
    // 맵 메뉴 위젯을 빌렸지만 라벨은 이 쓰임으로 고쳐 둔다.
    expect(menu!.getAttribute("aria-label")).toBe("부위 종류 고르기");
    for (const kind of ["entrance", "window", "sign", "anchor"]) {
      expect(document.querySelector(`[data-testid='structure-kit-part-kind-option-${kind}']`), kind).not.toBeNull();
    }
    // 아직 고르지 않았으니 store 에는 아무 부위도 없다.
    expect(storedKit().parts ?? []).toHaveLength(0);
  });

  it("창문을 고르면 창문 부위가 생긴다 — 예전에는 종류가 언제나 입구로 굳었다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_part_menu", () => {});
    dragOnePartCell();
    clickMenuOption("window");

    const parts = storedKit().parts ?? [];
    expect(parts).toHaveLength(1);
    expect(parts[0]!.kind).toBe("window");
  });

  it("부위 행의 ✎ 로 종류를 간판으로 바꾼다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_part_menu", () => {});
    dragOnePartCell();
    clickMenuOption("entrance");

    const partId = storedKit().parts![0]!.id;
    (document.querySelector(`[data-testid='structure-kit-editor-part-edit-${partId}']`) as unknown as FakeElement)
      .dispatchEvent(Object.assign(new Event("click"), { clientX: 40, clientY: 50 }));
    clickMenuOption("sign");

    expect(storedKit().parts![0]!.kind).toBe("sign");
    expect(document.querySelector("[data-testid='structure-kit-editor-parts']")!.textContent).toContain("간판");
  });
});

describe("편집기 [문에서 추정]", () => {
  it("문 타일에서 입구 부위를 만든다 — 인스펙터에서 편집기로 옮긴 버튼이다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_part_menu", () => {});

    const estimate = document.querySelector("[data-testid='structure-kit-estimate-entrance']");
    expect(estimate).not.toBeNull();
    (estimate as unknown as FakeElement).click();

    const parts = storedKit().parts ?? [];
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((part) => part.kind === "entrance")).toBe(true);
  });
});
