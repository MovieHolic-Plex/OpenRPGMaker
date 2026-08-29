import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps, resetMapPropsTabForTests } from "@/editor/panels/mapProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { FieldSpawnDef, TroopRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

function troop(id: string, name: string): TroopRecord {
  return { id, name, enemyIds: [], autoAlign: true, battleEventPages: [] };
}

function spawn(id: string, troopId: string): FieldSpawnDef {
  return { id, troopId, area: { x: 0, y: 0, w: 4, h: 4 } };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.troops = [troop("troop_a", "산적 무리"), troop("troop_b", "늑대 무리")];
  project.factions = {
    defs: [
      { id: "bandits", name: "산적단" },
      { id: "townguard", name: "경비대" },
    ],
    relations: [{ a: "bandits", b: "townguard", stance: -2 }],
  };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  map.fieldSpawns = [spawn("sp_a", "troop_a"), spawn("sp_b", "troop_b")];
  store.replace(project);
  editorState.set({ currentMapId: store.getCurrent().startMapId });
  resetMapPropsTabForTests();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  resetMapPropsTabForTests();
});

function openSpawnsTab(): FakeElement {
  const container = document.createElement("div") as unknown as FakeElement;
  renderMapProps(container as unknown as HTMLElement);
  const tab = findByTestId(container, "map-props-tab-spawns");
  expect(tab).not.toBeNull();
  tab?.click();
  return container;
}

function currentSpawns(): readonly FieldSpawnDef[] {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  return map.fieldSpawns ?? [];
}

function choose(container: FakeElement, index: number, value: string): void {
  const select = findByTestId(container, `map-spawn-faction-${index}`);
  if (!select) throw new Error(`missing faction select for spawn ${index}`);
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

describe("map properties — 필드 스폰 진영 덮어쓰기", () => {
  it("스폰마다 진영 컨트롤을 만든다", () => {
    const container = openSpawnsTab();

    const first = findByTestId(container, "map-spawn-faction-0");
    const second = findByTestId(container, "map-spawn-faction-1");
    expect(first?.tagName).toBe("SELECT");
    expect(second?.tagName).toBe("SELECT");
    // 저작값이 없으면 상속(빈 값)이 선택돼 있어야 한다.
    expect(first?.value).toBe("");
    const optionValues = (first?.querySelectorAll("option") ?? []).map((option) => option.value);
    expect(optionValues[0]).toBe("");
    expect(optionValues).toContain("bandits");
    expect(optionValues).toContain("townguard");
    expect(optionValues).toContain("enemy");
  });

  it("진영을 고르면 그 스폰의 factionId만 기록한다", () => {
    const container = openSpawnsTab();

    choose(container, 0, "bandits");

    expect(currentSpawns()[0]?.factionId).toBe("bandits");
    expect(Object.hasOwn(currentSpawns()[1] ?? {}, "factionId")).toBe(false);
  });

  it("상속 기본값으로 돌아오면 factionId 키를 지운다", () => {
    const container = openSpawnsTab();

    choose(container, 1, "townguard");
    expect(currentSpawns()[1]?.factionId).toBe("townguard");

    choose(container, 1, "");

    expect(Object.hasOwn(currentSpawns()[1] ?? {}, "factionId")).toBe(false);
    expect(currentSpawns()[1]?.troopId).toBe("troop_b");
    expect(currentSpawns()).toHaveLength(2);
  });
});
