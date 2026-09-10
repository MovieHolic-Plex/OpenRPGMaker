/** @vitest-environment happy-dom */
// LOC-ADOPT — 이관 창의 DOM 계약. 실제 DOM 에서 실제 store 를 지난다.
//
// 창이 지켜야 하는 것은 「눌리는가」가 아니라 「무엇을 보여 준 뒤에 눌리는가」다:
// 열기는 조사만, 실행 버튼은 선택 없이 무해, 두 번째 실행은 영수증에 멱등이라 적힌다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { resetAdoptionWorkbench } from "@/editor/mapLocationAdoptionState";
import {
  ADOPTION_TESTIDS,
  adoptionMapCheckboxTestId,
  adoptionRoleCheckboxTestId,
  closeLocationAdoptionPanel,
  openLocationAdoptionPanel,
} from "@/editor/panels/mapLocationAdoptionPanel";
import { mapLocations } from "@/project/mapNamedLocations";
import { store } from "@/project/store";
import type { GameMap, MapLayoutPlan } from "@/project/types";

const VILLAGE = "village_map";
const PLAIN = "plain_map";

function makeMap(id: string, name: string, layoutPlan?: MapLayoutPlan): GameMap {
  const size = 40;
  return {
    id,
    name,
    width: size,
    height: size,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(size * size).fill(TILE.GRASS),
    upperTiles: new Array(size * size).fill(TILE.EMPTY),
    events: [],
    ...(layoutPlan ? { layoutPlan } : {}),
  };
}

function seed(withPlan = true): void {
  const project = createBlankProject();
  project.maps[VILLAGE] = makeMap(
    VILLAGE,
    "큰 강 마을",
    withPlan
      ? {
        version: 1,
        kind: "large-river-market-village",
        regions: [
          { id: "plaza_1", role: "plaza", label: "중앙 광장", x: 10, y: 10, w: 6, h: 6 },
          { id: "market_1", role: "market", label: "북쪽 상점가", x: 20, y: 4, w: 8, h: 5 },
          { id: "house_1", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 5, h: 5 },
        ],
      }
      : undefined,
  );
  project.maps[PLAIN] = makeMap(PLAIN, "빈 들판");
  project.startMapId = VILLAGE;
  store.replace(project);
  editorState.set({ currentMapId: VILLAGE });
  resetMapEditHistory();
  resetAdoptionWorkbench();
}

function testId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

function click(id: string): void {
  const node = testId(id);
  if (!node) throw new Error(`missing testid: ${id}`);
  node.click();
}

function check(id: string, value: boolean): void {
  const node = testId(id) as HTMLInputElement | null;
  if (!node) throw new Error(`missing testid: ${id}`);
  node.checked = value;
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("layout adoption workbench panel", () => {
  beforeEach(() => {
    seed();
  });

  afterEach(() => {
    closeLocationAdoptionPanel();
    document.body.innerHTML = "";
    resetAdoptionWorkbench();
    resetMapEditHistory();
  });

  it("opening shows a read-only survey and writes nothing", () => {
    const before = JSON.stringify(store.getCurrent());
    openLocationAdoptionPanel();
    expect(testId(ADOPTION_TESTIDS.host)).not.toBeNull();
    // 설계 기록이 있는 맵만 나온다.
    expect(testId(`location-adoption-map-${VILLAGE}`)).not.toBeNull();
    expect(testId(`location-adoption-map-${PLAIN}`)).toBeNull();
    expect(testId(ADOPTION_TESTIDS.summary)?.textContent).toContain("승격 후보 2개");
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("says nothing will change while no map is selected, and running is refused", () => {
    openLocationAdoptionPanel();
    expect(testId(ADOPTION_TESTIDS.summary)?.textContent).toContain("고른 맵이 없어");
    click(ADOPTION_TESTIDS.run);
    expect(store.getCurrent().maps[VILLAGE]!.locations).toBeUndefined();
    expect(testId(ADOPTION_TESTIDS.receipt)).toBeNull();
  });

  it("shows the role filter with defaults on and construction roles off with a stated reason", () => {
    openLocationAdoptionPanel();
    expect((testId(adoptionRoleCheckboxTestId("plaza")) as HTMLInputElement).checked).toBe(true);
    expect((testId(adoptionRoleCheckboxTestId("market")) as HTMLInputElement).checked).toBe(true);
    const house = testId(adoptionRoleCheckboxTestId("house")) as HTMLInputElement;
    expect(house.checked).toBe(false);
    expect(testId(ADOPTION_TESTIDS.roleFilter)?.textContent).toContain("houseProtection");
  });

  it("turning a role on immediately re-counts the survey", () => {
    openLocationAdoptionPanel();
    check(adoptionRoleCheckboxTestId("house"), true);
    expect(testId(ADOPTION_TESTIDS.summary)?.textContent).toContain("승격 후보 3개");
  });

  it("adopts only the checked map and prints a receipt", () => {
    openLocationAdoptionPanel();
    check(adoptionMapCheckboxTestId(VILLAGE), true);
    click(ADOPTION_TESTIDS.run);
    expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(2);
    expect(store.getCurrent().maps[PLAIN]!.locations).toBeUndefined();
    const receipt = testId(ADOPTION_TESTIDS.receipt);
    expect(receipt?.textContent).toContain("구역 2개 생성");
    expect(receipt?.textContent).toContain("되돌리기 한 번");
  });

  it("the second run reports idempotency instead of adding duplicates", () => {
    openLocationAdoptionPanel();
    check(adoptionMapCheckboxTestId(VILLAGE), true);
    click(ADOPTION_TESTIDS.run);
    click(ADOPTION_TESTIDS.run);
    expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(2);
    expect(testId(ADOPTION_TESTIDS.receipt)?.textContent).toContain("이미 전부 승격돼 있습니다");
  });

  it("one undo removes the whole adoption made through the panel", () => {
    openLocationAdoptionPanel();
    check(adoptionMapCheckboxTestId(VILLAGE), true);
    click(ADOPTION_TESTIDS.run);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[VILLAGE]!.locations).toBeUndefined();
  });

  it("surfaces a name collision in the survey before the run", () => {
    store.update((project) => {
      project.maps[VILLAGE]!.locations = [{ id: "loc1", name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 }];
    });
    openLocationAdoptionPanel();
    expect(testId(`location-adoption-collision-${VILLAGE}`)?.textContent).toContain("중앙 광장");
  });

  it("tells the user plainly when the project has no builder plans at all", () => {
    seed(false);
    openLocationAdoptionPanel();
    expect(testId(ADOPTION_TESTIDS.empty)?.textContent).toContain("이관할 것이 없습니다");
    expect(testId(ADOPTION_TESTIDS.run)).toBeNull();
  });
});
