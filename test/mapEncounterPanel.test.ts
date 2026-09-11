import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps } from "@/editor/panels/mapProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TroopRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

function troop(id: string, name: string): TroopRecord {
  return { id, name, enemyIds: [], autoAlign: true, battleEventPages: [] };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.troops = [troop("troop_a", "풀벌레들"), troop("troop_b", "늑대 무리")];
  store.replace(project);
  editorState.set({ currentMapId: store.getCurrent().startMapId });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function openEncounterTab(): FakeElement {
  const container = document.createElement("div") as unknown as FakeElement;
  renderMapProps(container as unknown as HTMLElement);
  // 단일 화면 전환 뒤 탭 클릭은 섹션 이동일 뿐 전환이 아니다 — 8섹션이 동시에 붙는지 단언한다.
  for (const tab of ["general", "background", "bgm", "battle", "restrictions", "encounter", "spawns", "minimap"]) {
    expect(findByTestId(container, `map-props-section-${tab}`)).not.toBeNull();
  }
  const tab = findByTestId(container, "map-props-tab-encounter");
  expect(tab).not.toBeNull();
  tab?.click();
  return container;
}

function currentMap() {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  return map;
}

function change(node: FakeElement | null, value: string): void {
  if (!node) throw new Error("missing control");
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

describe("map properties — 인카운터 탭 UI", () => {
  it("인카운트율을 숫자 입력으로 설정한다", () => {
    const container = openEncounterTab();
    change(findByTestId(container, "map-encounter-rate-input"), "8");
    expect(currentMap().encounterRate).toBe(8);
  });

  it("인카운트율 0은 필드를 제거한다", () => {
    const container = openEncounterTab();
    change(findByTestId(container, "map-encounter-rate-input"), "8");
    change(findByTestId(container, "map-encounter-rate-input"), "0");
    expect(currentMap().encounterRate).toBeUndefined();
  });

  it("기본 출현 그룹을 체크박스로 고른다", () => {
    const container = openEncounterTab();
    const check = findByTestId(container, "map-encounter-troop-troop_b");
    expect(check).not.toBeNull();
    if (!check) return;
    check.checked = true;
    check.dispatchEvent(new Event("change"));
    expect(currentMap().troopIds).toEqual(["troop_b"]);
  });

  it("행 추가 → 트룹/가중치 편집 → 삭제가 테이블에 반영된다", () => {
    const container = openEncounterTab();
    findByTestId(container, "map-encounter-row-add")?.click();
    expect(currentMap().encounterTable).toEqual([{ troopId: "troop_a", weight: 1 }]);

    change(findByTestId(container, "map-encounter-troop-select-0"), "troop_b");
    change(findByTestId(container, "map-encounter-weight-0"), "3");
    expect(currentMap().encounterTable).toEqual([{ troopId: "troop_b", weight: 3 }]);

    findByTestId(container, "map-encounter-remove-0")?.click();
    expect(currentMap().encounterTable).toBeUndefined();
  });

  it("조건(시간대/파티 레벨)을 붙였다 떼면 conditions가 생기고 사라진다", () => {
    const container = openEncounterTab();
    findByTestId(container, "map-encounter-row-add")?.click();

    change(findByTestId(container, "map-encounter-timephase-0"), "night");
    change(findByTestId(container, "map-encounter-minlevel-0"), "5");
    expect(currentMap().encounterTable?.[0]?.conditions).toEqual({ timePhase: "night", minPartyLevel: 5 });

    change(findByTestId(container, "map-encounter-timephase-0"), "");
    change(findByTestId(container, "map-encounter-minlevel-0"), "");
    expect(currentMap().encounterTable?.[0]?.conditions).toBeUndefined();
  });

  it("구역 제한 체크 시 맵 전체 사각형이 기본값으로 들어간다", () => {
    const container = openEncounterTab();
    findByTestId(container, "map-encounter-row-add")?.click();

    const toggle = findByTestId(container, "map-encounter-region-toggle-0");
    expect(toggle).not.toBeNull();
    if (!toggle) return;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    const map = currentMap();
    expect(map.encounterTable?.[0]?.conditions?.region).toEqual({ x: 0, y: 0, w: map.width, h: map.height });

    change(findByTestId(container, "map-encounter-region-w-0"), "6");
    expect(currentMap().encounterTable?.[0]?.conditions?.region?.w).toBe(6);
  });

  it("구역이 없는 맵에서도 이름 붙은 구역 필드와 그리기 버튼을 낸다", () => {
    // 어포던스 감사(2026-09-11): 0개 맵에서 이 필드를 통째로 숨기던 것이 «기능의 존재를 배울
    // 기회가 없다» 의 가장 강한 근거였다. 자리는 남기고, 빈 이유와 행동을 함께 낸다.
    const container = openEncounterTab();
    findByTestId(container, "map-encounter-row-add")?.click();

    expect(findByTestId(container, "map-encounter-location-0")).not.toBeNull();
    expect(findByTestId(container, "map-encounter-location-empty-0")).not.toBeNull();
    expect(findByTestId(container, "map-encounter-location-draw-0")).not.toBeNull();
  });
});
