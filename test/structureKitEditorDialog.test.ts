import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStructureKitFromHouse, importStructureKits, registerStructureKit, replaceStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { buildAiMetaDraftPrompt, collectUsedTiles, openStructureKitEditor, parseAiMetaDraft } from "@/editor/panels/structureKitEditorDialog";
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

describe("createStructureKitFromHouse", () => {
  it("aframe-stone 은 폭·높이 등식이 안 맞으면 null 을 돌려주고 아무것도 등록하지 않는다", () => {
    // wallBandRows(3) + floor((12-1)/2)(5) + 1 = 9 여야 하는데 8 을 준다 — stampFootprintHouseKit 이 거부한다.
    const kit = createStructureKitFromHouse(DEFAULT_TILESET_ID, "aframe-stone", { width: 12, height: 8 });

    expect(kit).toBeNull();
    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(stored).toHaveLength(0);
  });

  it("aframe-stone 은 등식이 맞는 크기면 실제로 칠해진 킷을 등록한다", () => {
    const kit = createStructureKitFromHouse(DEFAULT_TILESET_ID, "aframe-stone", { width: 12, height: 9 });

    expect(kit).not.toBeNull();
    expect(kit!.kind).toBe("section");
    const painted = kit!.rows.some((row) => row.tiles.some((tile) => tile !== -1));
    expect(painted).toBe(true);

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(stored.some((candidate) => candidate.id === kit!.id)).toBe(true);
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
  /* 되돌리기 뒤에 수락하면 다음 다시하기가 사용자가 보증한 메타를 지웠다. 수락이
     commitKit 을 우회해 replaceStructureKit 을 직접 불러서 재시도 분기(future)가
     남아 있었기 때문이다. 사용자가 "내가 보증" 을 누른 값이 조용히 사라지는 경로다. */
  it("되돌리기 뒤 AI 메타를 수락하면 다시하기가 그것을 지우지 않는다", () => {
    const kit = seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, kit.id, () => {});
    const pick = (id: string): FakeElement | null =>
      document.querySelector(`[data-testid='${id}']`) as unknown as FakeElement | null;
    const readKit = () => (store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.structureKits ?? [])
      .find((c) => c.id === kit.id);

    // 이력 한 칸: 크기 변경은 commitKit 을 지난다
    const width = pick("structure-kit-editor-width");
    expect(width).toBeTruthy();
    width!.value = String((kit.width ?? 2) + 1);
    width!.dispatchEvent(new Event("change"));
    expect(readKit()?.width).toBe((kit.width ?? 2) + 1);

    // 되돌린다 — 이 순간 future 에 항목이 생긴다
    pick("structure-kit-editor-undo")!.click();
    expect(readKit()?.width).toBe(kit.width);

    // 그 상태에서 AI 메타를 수락한다
    pick("structure-kit-editor-tab-ai")!.click();
    const role = pick("structure-kit-editor-ai-role");
    expect(role).toBeTruthy();
    role!.value = "house";
    role!.dispatchEvent(new Event("change"));
    const accept = pick("structure-kit-editor-ai-accept");
    expect(accept).toBeTruthy();
    accept!.click();
    expect(readKit()?.ai?.origin).toBe("user");

    // 다시하기 — 수락한 메타가 살아 있어야 한다
    const redo = pick("structure-kit-editor-redo");
    if (redo) redo.click();
    expect(readKit()?.ai?.origin).toBe("user");
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

  it("부위 행의 ✕ 로 지우고, ✎ 로 종류 팝오버를 연다", () => {
    // 종류 <select> 는 ✎ 팝오버로 바뀌었다(설계 §5.4 목업). 팝오버 자체는 window 가
    // 필요해 여기서는 버튼 존재만 보고, 실제 종류 변경은 structureKitPartKindMenu.test.ts 가 본다.
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    const partId = (store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef).parts![0]!.id;

    const editBtn = document.querySelector(`[data-testid='structure-kit-editor-part-edit-${partId}']`);
    expect(editBtn).not.toBeNull();
    expect(editBtn!.getAttribute("aria-label")).toBe("부위 편집");
    // 종류 이름은 행에 글로 남는다 — 아이콘만 있으면 무슨 부위인지 알 수 없다.
    expect(document.querySelector("[data-testid='structure-kit-editor-parts']")!.textContent).toContain("입구");

    (document.querySelector(`[data-testid='structure-kit-editor-part-delete-${partId}']`) as unknown as FakeElement).click();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
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

describe("AI 메타 초안", () => {
  it("프롬프트에 타일 행렬과 타일 라벨과 기존 이름이 들어간다", () => {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const kit = seedKit();
    const prompt = buildAiMetaDraftPrompt(kit, tileset, ["울타리", "다리"]);

    expect(prompt).toContain("3×3");
    expect(prompt).toContain("116");        // 문 타일 번호
    expect(prompt).toContain("울타리");      // 이름 중복 회피용
    // 모델이 타일 번호를 추측하지 않도록 사람이 읽는 라벨을 함께 준다.
    expect(prompt).toMatch(/문|출입/);
  });

  it("응답 JSON 을 메타로 파싱한다", () => {
    const meta = parseAiMetaDraft(JSON.stringify({
      description: "돌 우물",
      placementRules: "광장 중앙",
      tags: ["우물"],
      role: "prop",
      repeatability: "fixed",
    }));
    expect(meta).not.toBeNull();
    expect(meta!.description).toBe("돌 우물");
    expect(meta!.repeatability).toBe("fixed");
    // 초안은 절대 user 가 아니다 — 사람이 수락해야 user 가 된다(제로 부트스트랩).
    expect(meta!.origin).toBe("ai");
  });

  it("깨진 응답은 null 을 준다", () => {
    expect(parseAiMetaDraft("이건 JSON 이 아닙니다")).toBeNull();
    expect(parseAiMetaDraft(JSON.stringify({ nope: 1 }))).toBeNull();
  });

  it("모르는 role·repeatability 는 버린다", () => {
    const meta = parseAiMetaDraft(JSON.stringify({
      description: "x", placementRules: "y", role: "spaceship", repeatability: "sometimes",
    }));
    expect(meta!.role).toBeUndefined();
    expect(meta!.repeatability).toBeUndefined();
  });

  it("설명과 배치 규칙이 공백뿐이면 초안을 거부한다", () => {
    // 공백 문자열은 truthy 라 트림 없이는 "내용 있음"으로 통과한다 — 모델이 빈 프롬프트를
    // 돌려줘도 session.draft 를 덮어써 사람이 이미 입력한 값을 지워 버리는 경로였다.
    const meta = parseAiMetaDraft(JSON.stringify({ description: "   ", placementRules: "\n\t " }));
    expect(meta).toBeNull();
  });
});

describe("AI 메타 탭", () => {
  it("탭을 열면 폼이 나오고 초안은 자동 저장되지 않는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    expect(document.querySelector("[data-testid='structure-kit-editor-ai-description']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor-ai-placement']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor-ai-draft']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor-ai-accept']")).not.toBeNull();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai).toBeUndefined();
  });

  it("수락하면 폼 값이 저장되고 origin 이 user 가 된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    const description = document.querySelector("[data-testid='structure-kit-editor-ai-description']") as unknown as HTMLTextAreaElement;
    description.value = "돌담을 두른 두레우물";
    (description as unknown as FakeElement).dispatchEvent(new Event("change"));

    (document.querySelector("[data-testid='structure-kit-editor-ai-accept']") as unknown as FakeElement).click();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai?.description).toBe("돌담을 두른 두레우물");
    expect(stored.ai?.origin).toBe("user");
  });
});

describe("AI 메타 탭 — 반복·분류", () => {
  // I1: repeatability 는 이전까지 모델의 JSON 초안이나 가져오기 파일로만 채워질 수 있었다 —
  // 폼에 컨트롤이 없어 사람이 직접 "한 채 완결"로 고정할 방법이 없었다.
  it("반복에서 '한 채 완결'을 고르고 수락하면 repeatability 가 fixed 로 저장된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    const repeatabilitySelect = document.querySelector("[data-testid='structure-kit-editor-ai-repeatability']") as unknown as FakeElement;
    expect(repeatabilitySelect).not.toBeNull();
    (repeatabilitySelect as unknown as HTMLSelectElement).value = "fixed";
    repeatabilitySelect.dispatchEvent(new Event("change"));

    (document.querySelector("[data-testid='structure-kit-editor-ai-accept']") as unknown as FakeElement).click();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai?.repeatability).toBe("fixed");
  });

  it("반복을 '미지정'으로 되돌리면 repeatability 키 자체가 사라진다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, {
      ...(store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
        .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef),
      ai: { description: "설명", placementRules: "규칙", repeatability: "repeat", origin: "user" },
    });
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    const repeatabilitySelect = document.querySelector("[data-testid='structure-kit-editor-ai-repeatability']") as unknown as FakeElement;
    (repeatabilitySelect as unknown as HTMLSelectElement).value = "";
    repeatabilitySelect.dispatchEvent(new Event("change"));

    (document.querySelector("[data-testid='structure-kit-editor-ai-accept']") as unknown as FakeElement).click();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai).toBeDefined();
    expect("repeatability" in (stored.ai as object)).toBe(false);
  });

  it("분류에서 역할을 고르고 수락하면 role 이 저장된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    const roleSelect = document.querySelector("[data-testid='structure-kit-editor-ai-role']") as unknown as FakeElement;
    expect(roleSelect).not.toBeNull();
    (roleSelect as unknown as HTMLSelectElement).value = "prop";
    roleSelect.dispatchEvent(new Event("change"));

    (document.querySelector("[data-testid='structure-kit-editor-ai-accept']") as unknown as FakeElement).click();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai?.role).toBe("prop");
  });
});

describe("importStructureKits", () => {
  it("새 id 를 발급해 넣고 개수를 돌려준다", () => {
    seedKit(); // kit_edit 이 이미 있다
    const added = importStructureKits(DEFAULT_TILESET_ID, [
      { kit: { ...seedKit(), id: "kit_edit" }, name: "우물 (2)" },
    ]);
    expect(added).toBe(1);

    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    expect(kits).toHaveLength(2);
    const imported = kits.find((kit) => kit.name === "우물 (2)")!;
    expect(imported.id).not.toBe("kit_edit");
    expect(imported.id.startsWith("kit_")).toBe(true);
  });

  it("가져온 킷은 편집 가능한 계보를 갖는다", () => {
    const added = importStructureKits(DEFAULT_TILESET_ID, [
      { kit: { ...seedKit(), id: "x", learnedFrom: "builtin-parametric" }, name: "가져온 집" },
    ]);
    expect(added).toBe(1);
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    const imported = kits.find((kit) => kit.name === "가져온 집")!;
    expect(imported).toBeDefined();
    expect(imported.learnedFrom).toBe("db-authored");
  });

  it("origin 을 자동으로 user 로 올리지 않는다", () => {
    // 제로 부트스트랩: 가져오기 체크는 "이 파일을 받겠다" 이지 "이 설명을 내가 보증한다" 가 아니다.
    importStructureKits(DEFAULT_TILESET_ID, [
      {
        kit: { ...seedKit(), id: "y", ai: { description: "남이 쓴 설명", placementRules: "남이 쓴 규칙", origin: "ai" } },
        name: "남의 우물",
      },
    ]);
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    const imported = kits.find((kit) => kit.name === "남의 우물")!;
    expect(imported).toBeDefined();
    expect(imported.ai?.origin).toBe("ai");
  });

});
describe("AI 메타 초안 파싱 — 새 어휘", () => {
  it("growthAxis·layerHome·themes 를 읽는다", () => {
    const draft = parseAiMetaDraft(JSON.stringify({
      description: "돌 성벽",
      placementRules: "경계를 따라",
      growthAxis: "vertical",
      layerHome: "upper",
      themes: ["성채", " ", "dungeon"],
      tags: ["벽"],
    }));
    expect(draft).not.toBeNull();
    expect(draft!.growthAxis).toBe("vertical");
    expect(draft!.layerHome).toBe("upper");
    expect(draft!.themes).toEqual(["성채", "dungeon"]);
    // 어떤 자동 경로도 origin 을 user 로 만들지 않는다.
    expect(draft!.origin).toBe("ai");
  });

  it("모르는 축·레이어 값은 버린다", () => {
    const draft = parseAiMetaDraft(JSON.stringify({
      description: "d", placementRules: "", growthAxis: "diagonal", layerHome: "middle",
    }));
    expect(draft!.growthAxis).toBeUndefined();
    expect(draft!.layerHome).toBeUndefined();
  });

  it("초안 프롬프트가 새 필드를 실제로 요구한다", () => {
    const kit = seedKit();
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const prompt = buildAiMetaDraftPrompt(kit, tileset, []);
    expect(prompt).toContain("growthAxis");
    expect(prompt).toContain("layerHome");
    expect(prompt).toContain("themes");
  });
});

describe("AI 메타 탭 — 수정할 수 있는 축이 화면에 있다", () => {
  const pick = (id: string): FakeElement | null =>
    document.querySelector(`[data-testid='${id}']`) as unknown as FakeElement | null;
  const readKit = (): SectionStructureKitDef => (store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.structureKits ?? [])
    .find((candidate) => candidate.id === "kit_edit") as SectionStructureKitDef;

  function openAiTab(): void {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    pick("structure-kit-editor-tab-ai")!.click();
  }

  it("증분 축·레이어·태그·테마 칸이 모두 있다", () => {
    openAiTab();
    for (const id of [
      "structure-kit-editor-ai-growth",
      "structure-kit-editor-ai-layer",
      "structure-kit-editor-ai-tags",
      "structure-kit-editor-ai-themes",
    ]) {
      expect(pick(id), id).not.toBeNull();
    }
  });

  it("고친 값이 수락 뒤 store 에 남는다", () => {
    openAiTab();
    const growth = pick("structure-kit-editor-ai-growth")!;
    growth.value = "vertical";
    growth.dispatchEvent(new Event("change"));
    const layer = pick("structure-kit-editor-ai-layer")!;
    layer.value = "upper";
    layer.dispatchEvent(new Event("change"));
    const themes = pick("structure-kit-editor-ai-themes")!;
    themes.value = "성채, tavern";
    themes.dispatchEvent(new Event("change"));
    const tags = pick("structure-kit-editor-ai-tags")!;
    tags.value = "벽, 방어";
    tags.dispatchEvent(new Event("change"));

    pick("structure-kit-editor-ai-accept")!.click();

    const ai = readKit().ai!;
    expect(ai.growthAxis).toBe("vertical");
    expect(ai.layerHome).toBe("upper");
    expect(ai.themes).toEqual(["성채", "tavern"]);
    expect(ai.tags).toEqual(["벽", "방어"]);
    expect(ai.origin).toBe("user");
  });

  it("비운 목록 칸은 키 자체를 지운다", () => {
    openAiTab();
    const tags = pick("structure-kit-editor-ai-tags")!;
    tags.value = "벽";
    tags.dispatchEvent(new Event("change"));
    tags.value = " , ";
    tags.dispatchEvent(new Event("change"));
    pick("structure-kit-editor-ai-accept")!.click();
    expect(readKit().ai!.tags).toBeUndefined();
  });
});

describe("칸 힌트 도구", () => {
  const pick = (id: string): FakeElement | null =>
    document.querySelector(`[data-testid='${id}']`) as unknown as FakeElement | null;
  const readKit = (): SectionStructureKitDef => (store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.structureKits ?? [])
    .find((candidate) => candidate.id === "kit_edit") as SectionStructureKitDef;

  function pressCell(): void {
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
  }

  /* window 가 없는 이 파일에서는 팝오버를 띄울 수 없으므로 결정적 순환 경로가 돈다.
     축의 집합은 두 경로에서 같다 — 순환 순서를 못 박아 둔다. */
  it("도구를 잡고 칸을 누르면 가로 → 세로 → 양방향 → 없음 순으로 돈다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    pick("structure-kit-editor-tool-hint")!.click();

    pressCell();
    expect(readKit().cellHints).toEqual([{ dx: 0, dy: 0, growth: "horizontal" }]);
    pressCell();
    expect(readKit().cellHints![0]!.growth).toBe("vertical");
    pressCell();
    expect(readKit().cellHints![0]!.growth).toBe("both");
    pressCell();
    expect(readKit().cellHints).toBeUndefined();
  });

  it("힌트를 붙이면 목록에 축과 설명 칸이 생기고, 설명이 store 에 남는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    pick("structure-kit-editor-tool-hint")!.click();
    pressCell();

    expect(pick("structure-kit-editor-cell-hint-0-0")).not.toBeNull();
    const note = pick("structure-kit-editor-cell-hint-note-0-0")!;
    note.value = "가로로 무한히 이어붙일 수 있는 벽 몸통";
    note.dispatchEvent(new Event("change"));

    expect(readKit().cellHints![0]!.note).toBe("가로로 무한히 이어붙일 수 있는 벽 몸통");
  });

  it("삭제 버튼이 그 칸의 힌트만 지운다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    pick("structure-kit-editor-tool-hint")!.click();
    pressCell();
    expect(readKit().cellHints).toHaveLength(1);

    pick("structure-kit-editor-cell-hint-delete-0-0")!.click();
    expect(readKit().cellHints).toBeUndefined();
  });

  it("힌트가 없을 때는 무엇을 하는 도구인지 적어 둔다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    expect(pick("structure-kit-editor-cell-hints-empty")).not.toBeNull();
describe("collectUsedTiles", () => {
  it("두 레이어에서 쓰는 타일을 모으고 빈 칸은 뺀다", () => {
    const used = collectUsedTiles({
      id: "k",
      kind: "section",
      width: 2,
      height: 2,
      rows: [
        { tiles: [240, -1], upperTiles: [116, -1] },
        { tiles: [-1, 300] },
      ],
    } as SectionStructureKitDef);
    expect([...used].sort((a, b) => a - b)).toEqual([116, 240, 300]);
  });
});

/* 사용자가 "팔레트에서 클릭해서 그리는데 state 때문에 화면이 자꾸 흔들린다"고 했다.
   실측(1440×900): 팔레트를 400px 내려 타일을 하나 고르면 scrollTop 400 → 0,
   검색창에 글자를 치다 타일을 고르면 activeElement 가 search → BODY.
   원인은 redraw 가 rightWrap.replaceChildren 로 같은 노드를 **재부모**하고 480칸을
   재생성한 것이다. 노드 정체성이 유지되는지로 회귀를 못 박는다 — FakeDom 은 스크롤을
   흉내내지 않으므로 정체성이 이 계약의 검사 가능한 형태다. */
describe("편집기 팔레트 안정성", () => {
  const swatch = (tile: number): FakeElement =>
    document.querySelector(`[data-testid='structure-kit-editor-tile-${tile}']`) as unknown as FakeElement;

  it("타일을 골라도 팔레트 노드를 다시 만들지 않는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const before = swatch(421);
    const searchBefore = document.querySelector("[data-testid='structure-kit-editor-search']");
    before.click();

    expect(swatch(421)).toBe(before);
    expect(document.querySelector("[data-testid='structure-kit-editor-search']")).toBe(searchBefore);
    expect(before.className).toContain("active");
  });

  it("도구·분류를 바꿔도 팔레트와 검색창 노드가 그대로다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const paletteBefore = document.querySelector("[data-testid='structure-kit-editor-palette']");
    const searchBefore = document.querySelector("[data-testid='structure-kit-editor-search']");
    (document.querySelector("[data-testid='structure-kit-editor-tool-erase']") as unknown as FakeElement).click();
    (document.querySelector("[data-testid='structure-kit-editor-category-house']") as unknown as FakeElement).click();

    expect(document.querySelector("[data-testid='structure-kit-editor-palette']")).toBe(paletteBefore);
    expect(document.querySelector("[data-testid='structure-kit-editor-search']")).toBe(searchBefore);
    const chip = document.querySelector("[data-testid='structure-kit-editor-category-house']") as unknown as FakeElement;
    expect(chip.className).toContain("active");
  });

  it("이 구조물이 쓰는 타일에 사용 표식이 붙는다", () => {
    seedKit(); // 240 · 116 을 쓴다
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    expect(swatch(240).className).toContain("is-used");
    expect(swatch(116).className).toContain("is-used");
    expect(swatch(421).className).not.toContain("is-used");
    expect(swatch(240).getAttribute("title")).toContain("사용 중");
    const count = document.querySelector("[data-testid='structure-kit-editor-used-count']") as unknown as FakeElement;
    expect(count.textContent).toBe("사용 중 2칸");
  });

  it("[안 쓴 타일만] 을 켜면 쓰인 타일이 숨고, 지금 잡은 붓은 남는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    // 안 쓰는 타일을 붓으로 잡아 둔다 — 기본 붓(잔디 240)은 이 킷이 쓰는 타일이다.
    swatch(421).click();

    const box = document.querySelector("[data-testid='structure-kit-editor-unused-only']") as unknown as FakeElement;
    box.checked = true;
    box.dispatchEvent(new Event("change"));

    expect(swatch(240).getAttribute("hidden")).toBe("");
    expect(swatch(116).getAttribute("hidden")).toBe("");
    expect(swatch(421).getAttribute("hidden")).toBeNull();

    box.checked = false;
    box.dispatchEvent(new Event("change"));
    expect(swatch(240).getAttribute("hidden")).toBeNull();
  });

  it("칠하면 그 타일이 사용 표식을 얻는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    expect(swatch(421).className).not.toContain("is-used");

    swatch(421).click();
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    expect(swatch(421).className).toContain("is-used");
  });
});
