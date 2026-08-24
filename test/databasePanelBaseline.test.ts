import { beforeEach, describe, expect, it } from "vitest";
import { addSwitch, addVariable, renameSwitch, renameVariable } from "@/editor/actions";
import { createBlankProject, DEFAULT_TILESET_ID } from "@/project/defaults";
import { store } from "@/project/store";

describe("Database panel baseline behavior", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("keeps switch and variable CRUD data in the project store", () => {
    const switchId = addSwitch("Door Open");
    const variableId = addVariable("Puzzle Count");

    renameSwitch(switchId, "Door Closed");
    renameVariable(variableId, "Puzzle Score");

    const project = store.getCurrent();
    expect(project.switches.find((entry) => entry.id === switchId)?.name).toBe("Door Closed");
    expect(project.variables.find((entry) => entry.id === variableId)?.name).toBe("Puzzle Score");
  });

  it("appends switch and variable ids beyond 1000 when legacy slots are all in use", () => {
    const project = createBlankProject();
    project.switches = Array.from({ length: 1000 }, (_, index) => ({
      id: `sw_${String(index + 1).padStart(4, "0")}`,
      name: `Switch ${index + 1}`,
    }));
    project.variables = Array.from({ length: 1000 }, (_, index) => ({
      id: `var_${String(index + 1).padStart(4, "0")}`,
      name: `Variable ${index + 1}`,
    }));
    store.replace(project);

    const switchId = addSwitch("Switch 1001");
    const variableId = addVariable("Variable 1001");

    expect(switchId).toBe("sw_1001");
    expect(variableId).toBe("var_1001");
    expect(store.getCurrent().switches.at(-1)).toEqual({ id: "sw_1001", name: "Switch 1001" });
    expect(store.getCurrent().variables.at(-1)).toEqual({ id: "var_1001", name: "Variable 1001" });
  });

  it("keeps common event commands, tileset flags, and terms editable in v3 data", () => {
    store.update((project) => {
      project.commonEvents.push({
        id: "ce_baseline",
        name: "Door Script",
        trigger: "parallel",
        commands: [{ kind: "text", body: "open" }],
      });
      project.tilesets[DEFAULT_TILESET_ID].priority[0] = "upper";
      project.tilesets[DEFAULT_TILESET_ID].passability[0].up = false;
      project.meta.terms.gold = "Coins";
    });

    const project = store.getCurrent();
    expect(project.commonEvents[0]).toMatchObject({
      id: "ce_baseline",
      trigger: "parallel",
      commands: [{ kind: "text", body: "open" }],
    });
    expect(project.tilesets[DEFAULT_TILESET_ID].priority[0]).toBe("upper");
    expect(project.tilesets[DEFAULT_TILESET_ID].passability[0].up).toBe(false);
    expect(project.meta.terms.gold).toBe("Coins");
  });
});
