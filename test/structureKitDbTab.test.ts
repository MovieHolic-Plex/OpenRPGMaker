import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderStructureKitsTab, resetStructureKitsTabSession } from "@/editor/panels/structureKitDbTab";
import { registerStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { SectionStructureKitDef, StructureKitDef } from "@/project/types";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_THEME_CATALOG, INTERIOR_ROOM_THEMES, INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { interiorObjectsForTheme } from "@/editor/interiorObjectCatalog";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetStructureKitsTabSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  resetStructureKitsTabSession();
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.structureKits;
    }
  });
});

function createTestSectionKit(id: string, name: string, parts?: StructureKitDef["parts"]): StructureKitDef {
  return {
    id,
    kind: "section",
    name,
    width: 3,
    height: 3,
    rows: [
      { tiles: [240, 240, 240], upperTiles: [0, 0, 0] },
      { tiles: [240, 116, 240], upperTiles: [0, 0, 0] },
      { tiles: [240, 240, 240], upperTiles: [0, 0, 0] },
    ],
    parts,
    learnedFrom: "user-paint",
  };
}

describe("structureKitDbTab album UI contract", () => {
  it("renders tileset rail as an album and defaults to current map tileset", () => {
    const current = store.getCurrent();
    const tilesetIds = Object.keys(current.tilesets);
    const mapId = Object.keys(current.maps)[0]!;
    const mapTilesetId = current.maps[mapId]!.tilesetId;
    const otherTilesetId = tilesetIds.find((id) => id !== mapTilesetId)!;

    registerStructureKit(mapTilesetId, createTestSectionKit("kit_t1_1", "타일셋1 구조물 1"));
    registerStructureKit(otherTilesetId, createTestSectionKit("kit_t2_1", "타일셋2 구조물 1"));
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const heading = host.querySelector("[data-testid='structure-kit-heading']");
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain("구조물");
    expect(heading!.textContent).not.toContain("스탬프");

    const rail = host.querySelector("[data-testid='structure-kit-album-rail']");
    expect(rail).not.toBeNull();

    expect(host.querySelector("[data-testid='structure-kit-db-kit_t1_1']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-db-kit_t2_1']")).toBeNull();
    expect(host.textContent).toContain("타일셋1 구조물 1");
    expect(host.textContent).not.toContain("타일셋2 구조물 1");
  });

  it("shows exact empty copy when active tileset has 0 kits", () => {
    const current = store.getCurrent();
    const tilesetIds = Object.keys(current.tilesets);
    const mapId = Object.keys(current.maps)[0]!;
    const mapTilesetId = current.maps[mapId]!.tilesetId;
    const emptyTilesetId = tilesetIds.find((id) => id !== mapTilesetId)!;
    registerStructureKit(mapTilesetId, createTestSectionKit("kit_t1_1", "마을 구조물"));
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const targetRailItem = host.querySelector(`[data-testid='structure-kit-tileset-${emptyTilesetId}']`);
    expect(targetRailItem).not.toBeNull();
    targetRailItem?.click();

    expect(host.textContent).toContain("이 타일셋에는 아직 구조물이 없습니다.");
  });

  it("renders inspector with name, parts list with instance numbers, 팔레트에서 쓰기 · 행 삭제 아이콘", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    const firstTilesetId = current.maps[mapId]!.tilesetId;
    editorState.set({ currentMapId: mapId });

    const kitWithParts = createTestSectionKit("kit_inspector", "돌집 · 남쪽 현관", [
      { id: "p1", kind: "entrance", dx: 1, dy: 1, w: 1, h: 2, note: "워프는 앞칸" },
      { id: "p2", kind: "window", dx: 0, dy: 1, w: 1, h: 1 },
      { id: "p3", kind: "window", dx: 2, dy: 1, w: 1, h: 1 },
    ]);
    registerStructureKit(firstTilesetId, kitWithParts);

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    // 기본 선택이 내장 킷이므로, 등록 킷 행을 직접 선택한다.
    const kitRow = host.querySelector(`[data-testid='structure-kit-db-${kitWithParts.id}']`);
    expect(kitRow).not.toBeNull();
    kitRow!.click();

    const inspector = host.querySelector(".structure-kit-inspector") ?? host.querySelector(".inspector");
    expect(inspector).not.toBeNull();

    const nameInput = host.querySelector(`[data-testid='structure-kit-db-name-${kitWithParts.id}']`);
    expect(nameInput).not.toBeNull();

    expect(inspector?.textContent).toContain("입구");
    expect(inspector?.textContent).toContain("창문");

    // [문에서 입구 추정]과 [부위 삭제]는 편집기로 옮겼다 — 부위 목록은 읽기 전용이다.
    expect(host.querySelector("[data-testid='structure-kit-estimate-entrance']")).toBeNull();
    expect(inspector?.textContent).not.toContain("부위 삭제");

    // 아무것도 저장하지 않던 가짜 버튼 — 제거됐는지 못을 박는다.
    expect(host.querySelector("[data-testid='structure-kit-save-now']")).toBeNull();
    expect(inspector?.textContent).not.toContain("지금 저장");

    // 이 파일에는 pointer 핸들러가 없다 — 드래그를 약속하지 않는다.
    expect(inspector?.textContent).not.toContain("드래그하면");
    // 워프 칸 안내는 사실이므로 남는다.
    expect(inspector?.textContent).toContain("워프 칸");

    const useInPaletteBtn = host.querySelector(`[data-testid='structure-kit-db-use-${kitWithParts.id}']`);
    expect(useInPaletteBtn).not.toBeNull();
    expect(useInPaletteBtn?.textContent).toContain("팔레트에서 쓰기");

    // 삭제·내보내기는 인스펙터 액션 줄에서 표 행의 아이콘으로 옮겼다(액션 5개 → 3개).
    const deleteBtn = host.querySelector(`[data-testid='structure-kit-db-delete-${kitWithParts.id}']`);
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.getAttribute("aria-label")).toBe("삭제");
    expect(host.querySelector(`[data-testid='structure-kit-export-${kitWithParts.id}']`)).not.toBeNull();

    const inspectorActions = host.querySelector(".structure-kit-actions");
    expect(inspectorActions).not.toBeNull();
    expect(inspectorActions!.querySelectorAll("button")).toHaveLength(3);
  });
});

describe("structureKitDbTab 내장 파라메트릭 킷 노출", () => {
  it("combined_town 앨범에 내장 킷 행(kit_house_blue-stone)이 표시된다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    expect(current.maps[mapId]!.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")).not.toBeNull();
  });

  it("combined_town 레일 항목의 킷 수는 6 이상이다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const railItem = host.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`);
    expect(railItem).not.toBeNull();
    const count = Number.parseInt(railItem!.textContent.match(/(\d+)\s*$/)![1]!, 10);
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it("내장·등록 킷이 모두 없는 타일셋은 정확한 빈 상태 카피를 던지지 않고 렌더링한다", () => {
    const current = store.getCurrent();
    const tilesetIds = Object.keys(current.tilesets);
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    const emptyTilesetId = tilesetIds.find((id) => id !== DEFAULT_TILESET_ID)!;

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const railItem = host.querySelector(`[data-testid='structure-kit-tileset-${emptyTilesetId}']`);
    expect(railItem).not.toBeNull();
    expect(() => railItem!.click()).not.toThrow();

    const empty = host.querySelector("[data-testid='structure-kit-db-empty']");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("이 타일셋에는 아직 구조물이 없습니다.");
  });

  it("rows가 비거나 크기가 0인 등록 킷도 렌더링 시 던지지 않는다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    registerStructureKit(DEFAULT_TILESET_ID, {
      id: "kit_malformed",
      kind: "section",
      name: "깨진 킷",
      width: 0,
      height: 0,
      rows: [],
      learnedFrom: "user-paint",
    });

    const host = new FakeElement("div");
    expect(() => renderStructureKitsTab(host as unknown as HTMLElement, () => {})).not.toThrow();
    expect(host.querySelector("[data-testid='structure-kit-db-kit_malformed']")).not.toBeNull();
  });

  it("내장 킷 행에는 삭제 아이콘이 없고 등록 킷 행에는 있다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_registered", "등록 킷"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    // 내장 킷 선택
    const builtinRow = host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']");
    expect(builtinRow).not.toBeNull();
    builtinRow!.click();
    expect(host.querySelector("[data-testid='structure-kit-inspector-kit_house_blue-stone']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-db-delete-kit_house_blue-stone']")).toBeNull();

    // 등록 킷 선택
    const registeredRow = host.querySelector("[data-testid='structure-kit-db-kit_registered']");
    expect(registeredRow).not.toBeNull();
    registeredRow!.click();
    expect(host.querySelector("[data-testid='structure-kit-inspector-kit_registered']")).not.toBeNull();
    const registeredDelete = host.querySelector("[data-testid='structure-kit-db-delete-kit_registered']");
    expect(registeredDelete).not.toBeNull();
    expect(registeredDelete!.getAttribute("aria-label")).toBe("삭제");
  });

  it("[문에서 입구 추정]은 어느 행을 골라도 탭에 없다 — 편집기로 옮겼다", () => {
    // 부위를 만드는 자리와 고치는 자리가 갈려 있으면 사용자가 어디를 봐야 할지 모른다.
    // 인스펙터는 읽기 요약만 맡고, 부위 편집은 전부 편집기 다이얼로그가 갖는다.
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_registered_estimate", "등록 킷2"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const builtinRow = host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']");
    expect(builtinRow).not.toBeNull();
    builtinRow!.click();
    expect(host.querySelector("[data-testid='structure-kit-estimate-entrance']")).toBeNull();

    const registeredRow = host.querySelector("[data-testid='structure-kit-db-kit_registered_estimate']");
    expect(registeredRow).not.toBeNull();
    registeredRow!.click();
    expect(host.querySelector("[data-testid='structure-kit-estimate-entrance']")).toBeNull();
  });

  it("가져온 builtin-parametric 킷도 프로젝트 데이터면 편집 가능하다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    // 내장 집을 내보낸 파일을 가져온 상황 — learnedFrom 은 남아 있지만 프로젝트 데이터다.
    registerStructureKit(DEFAULT_TILESET_ID, {
      ...createTestSectionKit("kit_imported", "가져온 통나무집"),
      learnedFrom: "builtin-parametric",
    });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const row = host.querySelector("[data-testid='structure-kit-db-kit_imported']");
    expect(row).not.toBeNull();
    row!.click();

    expect(host.querySelector("[data-testid='structure-kit-db-delete-kit_imported']")).not.toBeNull();
    const nameInput = host.querySelector("[data-testid='structure-kit-db-name-kit_imported']");
    expect(nameInput).not.toBeNull();
    expect(nameInput!.getAttribute("disabled")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-builtin-hint']")).toBeNull();
  });
});

describe("structureKitDbTab 3원본 앨범(내장·실내 오브젝트·내가 저장한)", () => {
  function renderOnInteriorAlbum(): FakeElement {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    const railItem = host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`);
    expect(railItem).not.toBeNull();
    railItem!.click();
    return host;
  }

  function clickSource(host: FakeElement, source: "all" | "builtin" | "interior" | "user"): void {
    const chip = host.querySelector(`[data-testid='structure-kit-source-${source}']`);
    expect(chip).not.toBeNull();
    chip!.click();
  }

  // f. 실내 칩셋 앨범 + 실내 오브젝트 원본 → 책장 행이 있고 빈 상태가 아니다.
  it("실내 칩셋 앨범에서 실내 오브젝트 원본을 고르면 책장 행이 래스터와 함께 표시된다", () => {
    const host = renderOnInteriorAlbum();
    clickSource(host, "interior");

    const row = host.querySelector("[data-testid='structure-kit-object-bookshelf']");
    expect(row).not.toBeNull();
    expect(row!.querySelector("canvas")).not.toBeNull();
    expect(row!.textContent).toContain("책장");
    expect(row!.textContent).toContain("3×3");
    expect(row!.textContent).toContain("서재");

    expect(host.querySelector("[data-testid='structure-kit-db-empty']")).toBeNull();
  });

  // g. 실내 오브젝트는 다른 타일셋 앨범에 섞이지 않는다.
  it("combined_town 앨범에는 실내 오브젝트가 섞이지 않는다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    expect(current.maps[mapId]!.tilesetId).toBe(DEFAULT_TILESET_ID);

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    expect(host.querySelector("[data-testid='structure-kit-object-bookshelf']")).toBeNull();

    clickSource(host, "interior");
    expect(host.querySelector("[data-testid='structure-kit-object-bookshelf']")).toBeNull();
    // 앨범 자체는 내장 킷이 있으므로 정확한 빈 상태 카피가 아니라 조용한 안내만 나온다.
    expect(host.querySelector("[data-testid='structure-kit-db-empty']")).toBeNull();
    const note = host.querySelector("[data-testid='structure-kit-source-empty']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("실내 오브젝트");
  });

  // h. 세 원본 칩이 모두 있고, 표시된 개수가 그 원본이 나열하는 행 수와 같다.
  it("원본 칩 세 개가 모두 있고 개수가 실제 행 수와 일치한다", () => {
    const sources = ["builtin", "interior", "user"] as const;

    const interiorHost = renderOnInteriorAlbum();
    for (const source of sources) {
      clickSource(interiorHost, source);
      const chip = interiorHost.querySelector(`[data-testid='structure-kit-source-${source}']`)!;
      const shown = Number.parseInt(chip.textContent.match(/(\d+)\s*$/u)![1]!, 10);
      expect(interiorHost.querySelectorAll(".structure-kit-row").length).toBe(shown);
    }
    clickSource(interiorHost, "interior");
    const interiorChip = interiorHost.querySelector("[data-testid='structure-kit-source-interior']")!;
    expect(Number.parseInt(interiorChip.textContent.match(/(\d+)\s*$/u)![1]!, 10)).toBe(
      INTERIOR_OBJECT_CATALOG.length,
    );

    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_mine", "내가 저장한 킷"));

    const townHost = new FakeElement("div");
    renderStructureKitsTab(townHost as unknown as HTMLElement, () => {});
    // 앨범 선택은 세션에 남으므로(실내 앨범) 마을 앨범을 명시적으로 고른다.
    townHost.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`)!.click();
    for (const source of sources) {
      clickSource(townHost, source);
      const chip = townHost.querySelector(`[data-testid='structure-kit-source-${source}']`)!;
      const shown = Number.parseInt(chip.textContent.match(/(\d+)\s*$/u)![1]!, 10);
      expect(townHost.querySelectorAll(".structure-kit-row").length).toBe(shown);
    }
    clickSource(townHost, "user");
    expect(townHost.querySelector("[data-testid='structure-kit-db-kit_mine']")).not.toBeNull();
    expect(townHost.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")).toBeNull();
  });

  // i. 실내 오브젝트 인스펙터: 삭제/이름 변경 없음.
  it("실내 오브젝트를 선택하면 삭제 없는 인스펙터가 렌더된다", () => {
    const host = renderOnInteriorAlbum();
    clickSource(host, "interior");
    host.querySelector("[data-testid='structure-kit-object-bookshelf']")!.click();

    const inspector = host.querySelector("[data-testid='structure-kit-inspector-bookshelf']");
    expect(inspector).not.toBeNull();
    expect(inspector!.textContent).toContain("책장");
    expect(inspector!.textContent).toContain("3×3");
    expect(inspector!.textContent).toContain("하층");
    expect(inspector!.textContent).toContain("서재");
    expect(inspector!.textContent).toContain("북쪽 벽");
    expect(inspector!.querySelector("canvas")).not.toBeNull();

    expect(host.querySelector("[data-testid='structure-kit-db-delete-bookshelf']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-db-name-bookshelf']")).toBeNull();
    const hint = host.querySelector("[data-testid='structure-kit-object-hint']");
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toMatch(/타일셋|코드/);
  });

  it("실내 오브젝트 인스펙터에 [팔레트에서 쓰기]가 있다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    // 실내 칩셋 앨범으로 이동
    host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`)!.click();

    const first = INTERIOR_OBJECT_CATALOG[0]!;
    const row = host.querySelector(`[data-testid='structure-kit-object-${first.id}']`);
    expect(row).not.toBeNull();
    row!.click();

    const useBtn = host.querySelector(`[data-testid='structure-kit-object-use-${first.id}']`);
    expect(useBtn).not.toBeNull();
    expect(useBtn!.textContent).toContain("팔레트에서 쓰기");
  });
});

describe("structureKitDbTab 방 종류 테마 문법 뷰", () => {
  function renderInteriorThemeView(): FakeElement {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`)!.click();
    host.querySelector("[data-testid='structure-kit-source-interior']")!.click();
    return host;
  }

  // j. 일곱 테마 카드가 실내 앨범에 모두 렌더된다.
  it("실내 앨범에서 일곱 개 방 종류 카드가 모두 렌더된다", () => {
    const host = renderInteriorThemeView();

    expect(INTERIOR_ROOM_THEMES.length).toBe(7);
    for (const theme of INTERIOR_ROOM_THEMES) {
      const card = host.querySelector(`[data-testid='structure-kit-theme-${theme}']`);
      expect(card, theme).not.toBeNull();
      expect(card!.textContent).toContain(INTERIOR_ROOM_THEME_CATALOG[theme].label);
    }
    expect(host.querySelectorAll(".structure-kit-theme-card").length).toBe(7);

    // 필수 역할이 없는 방(창고·복도)은 빈 줄이 아니라 한국어 안내를 둔다.
    for (const theme of ["storage", "corridor"] as const) {
      const card = host.querySelector(`[data-testid='structure-kit-theme-${theme}']`)!;
      expect(card.querySelector("canvas")).toBeNull();
      expect(card.textContent).toContain("필수 오브젝트가 없는 방입니다");
    }
  });

  // k. 침실 카드는 침대 역할 오브젝트를, 선술집 카드는 탁자·카운터 두 역할을 덮는다.
  it("침실 카드는 침대 역할 썸네일을, 선술집 카드는 탁자·카운터 역할을 함께 보여준다", () => {
    const host = renderInteriorThemeView();

    const bedroom = host.querySelector("[data-testid='structure-kit-theme-bedroom']")!;
    const bedSlot = bedroom.querySelector("[data-testid='structure-kit-theme-bedroom-role-bed']");
    expect(bedSlot).not.toBeNull();
    expect(bedSlot!.querySelector("canvas")).not.toBeNull();
    expect(bedroom.textContent).toContain("침대");

    const tavern = host.querySelector("[data-testid='structure-kit-theme-tavern']")!;
    const tableSlot = tavern.querySelector("[data-testid='structure-kit-theme-tavern-role-table']");
    const counterSlot = tavern.querySelector("[data-testid='structure-kit-theme-tavern-role-counter']");
    expect(tableSlot).not.toBeNull();
    expect(counterSlot).not.toBeNull();
    expect(tableSlot!.querySelector("canvas")).not.toBeNull();
    expect(counterSlot!.querySelector("canvas")).not.toBeNull();
    expect(tavern.textContent).toContain("탁자");
    expect(tavern.textContent).toContain("카운터");
    // 제안 분위기도 한국어로 노출된다(선술집: rustic|luxury).
    expect(tavern.textContent).toContain("소박함");
    expect(tavern.textContent).toContain("화려함");
  });

  // l. 서재 카드를 고르면 표가 서재 테마 오브젝트로만 좁혀지고, 다시 누르면 풀린다.
  it("서재 카드를 고르면 표가 서재 테마 오브젝트로 좁혀지고 다시 누르면 해제된다", () => {
    const host = renderInteriorThemeView();

    expect(host.querySelector("[data-testid='structure-kit-object-bed_h']")).not.toBeNull();

    host.querySelector("[data-testid='structure-kit-theme-study']")!.click();

    expect(host.querySelector("[data-testid='structure-kit-object-bookshelf']")).not.toBeNull();
    // bed_h는 침실 전용이라 서재 필터에서 사라진다.
    expect(host.querySelector("[data-testid='structure-kit-object-bed_h']")).toBeNull();
    expect(host.querySelectorAll(".structure-kit-row").length).toBe(interiorObjectsForTheme("study").length);

    host.querySelector("[data-testid='structure-kit-theme-study']")!.click();
    expect(host.querySelector("[data-testid='structure-kit-object-bed_h']")).not.toBeNull();
    expect(host.querySelectorAll(".structure-kit-row").length).toBe(INTERIOR_OBJECT_CATALOG.length);
  });
});

describe("structureKitDbTab 신규·복제", () => {
  it("도구줄에 [+ 새 구조물]과 힌트칩 제거가 반영된다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    expect(host.querySelector("[data-testid='structure-kit-new']")).not.toBeNull();
    // 힌트칩의 문구는 빈 상태 안내에 이미 똑같이 있어 중복이었다.
    expect(host.querySelector(".structure-kit-hint-chip")).toBeNull();
  });

  it("내장 킷 인스펙터의 [내 구조물로 복제]가 section 사본을 만든다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")!.click();

    const dup = host.querySelector("[data-testid='structure-kit-duplicate-kit_house_blue-stone']");
    expect(dup).not.toBeNull();
    dup!.click();

    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    expect(kits[0]!.kind).toBe("section");
    expect(kits[0]!.learnedFrom).toBe("db-authored");
    expect(kits[0]!.name).toContain("사본");
  });

  it("실내 오브젝트 인스펙터에도 복제가 있다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`)!.click();

    const first = INTERIOR_OBJECT_CATALOG[0]!;
    host.querySelector(`[data-testid='structure-kit-object-${first.id}']`)!.click();

    const dup = host.querySelector(`[data-testid='structure-kit-duplicate-${first.id}']`);
    expect(dup).not.toBeNull();
    dup!.click();

    const kits = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    const duplicated = kits[0]!;
    if (duplicated.kind !== "section") throw new Error("section 킷이어야 한다");
    expect(duplicated.width).toBe(first.width);
  });

  it("combined_town 앨범에서 [+ 새 구조물]은 시작점을 묻는다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`)!.click();
    host.querySelector("[data-testid='structure-kit-new']")!.click();

    expect(document.querySelector("[data-testid='structure-kit-new']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-new-blank']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-new-house-confirm']")).not.toBeNull();
  });

  it("[이 집으로 시작]이 section 킷을 만든다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`)!.click();
    host.querySelector("[data-testid='structure-kit-new']")!.click();
    (document.querySelector("[data-testid='structure-kit-new-house-confirm']") as unknown as FakeElement).click();

    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    expect(kits[0]!.kind).toBe("section");
    expect(kits[0]!.learnedFrom).toBe("db-authored");
    // 빈 껍데기가 아니라 실제 타일이 들어 있어야 한다.
    const painted = (kits[0] as SectionStructureKitDef).rows.some((row) => row.tiles.some((tile) => tile !== -1));
    expect(painted).toBe(true);
  });
});

describe("structureKitDbTab 내보내기", () => {
  it("내 구조물 행에만 체크박스가 있다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_mine", "내 우물"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    expect(host.querySelector("[data-testid='structure-kit-check-kit_mine']")).not.toBeNull();
    // 내장 킷 행에는 없다 — 내보낼 수 있는 것이 내 구조물뿐이다.
    expect(host.querySelector("[data-testid='structure-kit-check-kit_house_blue-stone']")).toBeNull();
  });

  it("체크하면 푸터가 선택 개수와 내보내기로 바뀐다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_mine", "내 우물"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    const exportBtn = host.querySelector("[data-testid='structure-kit-export']");
    expect(exportBtn).not.toBeNull();
    expect(exportBtn!.textContent).toContain("앨범 내보내기");

    host.querySelector("[data-testid='structure-kit-check-kit_mine']")!.click();

    expect(host.textContent).toContain("1개 선택됨");
    expect(host.querySelector("[data-testid='structure-kit-export']")!.textContent).toContain("선택 내보내기");
  });

  it("가져오기 버튼이 도구줄에 있다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    expect(host.querySelector("[data-testid='structure-kit-import']")).not.toBeNull();
  });

  it("체크한 킷이 다른 원본 칩으로 가려지면 라벨이 앨범 내보내기로 되돌아간다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_mine", "내 우물"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});

    host.querySelector("[data-testid='structure-kit-check-kit_mine']")!.click();
    expect(host.querySelector("[data-testid='structure-kit-export']")!.textContent).toContain("선택 내보내기");

    // 체크는 그대로 둔 채, 지금 보이는 행에서 그 킷이 빠지도록 다른 원본으로 옮긴다.
    host.querySelector("[data-testid='structure-kit-source-builtin']")!.click();

    expect(host.querySelector("[data-testid='structure-kit-check-kit_mine']")).toBeNull();
    const exportBtn = host.querySelector("[data-testid='structure-kit-export']")!;
    expect(exportBtn.textContent).toContain("앨범 내보내기");
    expect(exportBtn.textContent).not.toContain("선택 내보내기");
  });
});

describe("structureKitDbTab 복제 → 편집 연결", () => {
  function renderTownAlbum(): FakeElement {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    return host;
  }

  function onlyUserKitId(): string {
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    return kits[0]!.id;
  }

  it("내장 킷 복제는 선택을 사본으로 옮기고 편집기를 연다", () => {
    // 예전에는 사본을 만들고 목록만 다시 그려서, 인스펙터가 계속 원본(편집 불가)을 봤다 —
    // 사용자에게는 "복제했는데 아무 일도 안 남" 이었다.
    const host = renderTownAlbum();
    host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")!.click();
    host.querySelector("[data-testid='structure-kit-duplicate-kit_house_blue-stone']")!.click();

    const copyId = onlyUserKitId();
    expect(host.querySelector(`[data-testid='structure-kit-inspector-${copyId}']`)).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-inspector-kit_house_blue-stone']")).toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor']")).not.toBeNull();
  });

  it("복제 후에는 원본 칩·검색어가 사본을 가리지 않는다", () => {
    const host = renderTownAlbum();
    // 내장 원본 칩 + 검색어를 켜 둔 상태에서 복제한다.
    host.querySelector("[data-testid='structure-kit-source-builtin']")!.click();
    const search = host.querySelector(".structure-kit-search")!;
    (search as unknown as HTMLInputElement).value = "파랑";
    search.dispatchEvent(new Event("input"));

    host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")!.click();
    host.querySelector("[data-testid='structure-kit-duplicate-kit_house_blue-stone']")!.click();

    // source 가 'builtin' 으로 남아 있으면 entriesForSource() 가 사본 행을 통째로 걸러낸다.
    const copyId = onlyUserKitId();
    expect(host.querySelector(`[data-testid='structure-kit-db-${copyId}']`)).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-source-user']")!.className).toContain("active");
    expect((host.querySelector(".structure-kit-search") as unknown as HTMLInputElement).value).toBe("");
  });

  it("내장 행의 복제 아이콘도 사본의 편집기까지 이어진다", () => {
    const host = renderTownAlbum();
    const dup = host.querySelector("[data-testid='structure-kit-row-duplicate-kit_house_blue-stone']");
    expect(dup).not.toBeNull();
    dup!.click();

    const copyId = onlyUserKitId();
    expect(host.querySelector(`[data-testid='structure-kit-inspector-${copyId}']`)).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor']")).not.toBeNull();
  });

  it("내 구조물 행의 ✎ 아이콘으로 편집기가 열린다", () => {
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_row_edit", "행에서 편집"));
    const host = renderTownAlbum();

    const editIcon = host.querySelector("[data-testid='structure-kit-row-edit-kit_row_edit']");
    expect(editIcon).not.toBeNull();
    expect(editIcon!.getAttribute("aria-label")).toBe("편집");
    editIcon!.click();

    expect(document.querySelector("[data-testid='structure-kit-editor']")).not.toBeNull();
    // 내장 행에는 편집 아이콘이 없다 — 고칠 수 없는 것에 편집을 약속하지 않는다.
    expect(host.querySelector("[data-testid='structure-kit-row-edit-kit_house_blue-stone']")).toBeNull();
  });

  it("편집 중 킷이 사라지면 칠하기가 무음 실패하지 않고 편집기가 닫힌다", () => {
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_vanish", "사라질 킷"));
    const host = renderTownAlbum();
    host.querySelector("[data-testid='structure-kit-row-edit-kit_vanish']")!.click();
    expect(document.querySelector("[data-testid='structure-kit-editor']")).not.toBeNull();

    // Ctrl+Z / DB 모달 취소로 store 가 교체된 상황 — 편집기가 보던 킷이 없어진다.
    store.update((project) => {
      project.tilesets[DEFAULT_TILESET_ID]!.structureKits = [];
    });

    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    expect(canvas).not.toBeNull();
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));

    // 예전에는 조용히 return 해서, 계속 칠해도 아무것도 저장되지 않았다.
    expect(document.querySelector("[data-testid='structure-kit-editor']")).toBeNull();
    expect(document.querySelector("[data-testid='toast']")!.textContent).toContain("사라졌습니다");
  });
});

describe("structureKitDbTab AI 메타 요약(§5.3)", () => {
  // I2: 인스펙터에 AI 메타 요약이 없으면, 어느 구조물이 아직 사람 승인을 못 받았는지
  // (origin !== "user") 보려면 킷마다 편집기를 열어야 한다.
  function renderWithSelectedKit(kit: StructureKitDef): FakeElement {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, kit);

    const host = new FakeElement("div");
    renderStructureKitsTab(host as unknown as HTMLElement, () => {});
    host.querySelector(`[data-testid='structure-kit-db-${kit.id}']`)!.click();
    return host;
  }

  it("origin이 ai인 킷은 미승인 배지와 설명 첫 줄을 보여준다", () => {
    const kit = { ...createTestSectionKit("kit_ai_meta", "미승인 우물"), ai: { description: "돌담을 두른 두레우물", placementRules: "광장 중앙", origin: "ai" as const } };
    const host = renderWithSelectedKit(kit);

    const summary = host.querySelector("[data-testid='structure-kit-ai-summary']");
    expect(summary).not.toBeNull();
    expect(summary!.textContent).toContain("돌담을 두른 두레우물");
    expect(host.querySelector("[data-testid='structure-kit-ai-unapproved']")).not.toBeNull();
  });

  it("origin이 user인 킷은 미승인 배지가 없다", () => {
    const kit = { ...createTestSectionKit("kit_ai_meta_user", "승인된 우물"), ai: { description: "돌담을 두른 두레우물", placementRules: "광장 중앙", origin: "user" as const } };
    const host = renderWithSelectedKit(kit);

    expect(host.querySelector("[data-testid='structure-kit-ai-summary']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-ai-unapproved']")).toBeNull();
  });

  it("ai 메타가 없는 킷은 배지도 빈 블록도 없이 조용한 안내만 보여준다", () => {
    const kit = createTestSectionKit("kit_no_ai_meta", "메타 없는 우물");
    const host = renderWithSelectedKit(kit);

    const summary = host.querySelector("[data-testid='structure-kit-ai-summary']");
    expect(summary).not.toBeNull();
    expect(summary!.textContent?.trim()).not.toBe("");
    expect(summary!.textContent).toContain("아직 없습니다");
    expect(host.querySelector("[data-testid='structure-kit-ai-unapproved']")).toBeNull();
  });
});
