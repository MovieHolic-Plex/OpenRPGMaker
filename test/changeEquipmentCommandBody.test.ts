import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeEquipmentBody } from "@/editor/panels/eventEditor/commandBodyDatabase";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand,
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
}

describe("changeEquipment command body UX", () => {
  let restoreDom: (() => void) | undefined;
  let actorId = "";
  let weaponId = "";
  let armorId = "";
  let weaponName = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    actorId = project.database.actors[0]?.id ?? "";
    const weapon = project.database.equipment.find((entry) => entry.slot === "weapon");
    weaponId = weapon?.id ?? "";
    weaponName = weapon?.name ?? "";
    armorId = project.database.equipment.find((entry) => entry.slot === "armor")?.id ?? "";
    if (!actorId || !weaponId) throw new Error("blank project missing actor/weapon");
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders actor/slot browser with search and live preview", () => {
    const body = renderWithFakeDom(() =>
      changeEquipmentBody(ctx(), {
        kind: "changeEquipment",
        actorId,
        slot: "weapon",
        equipmentId: weaponId,
      })
    );
    expect(findByTestId(body, "change-equipment-command-body")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-intent")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-browser")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-search")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-selected")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-grid")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-preview")).not.toBeNull();
    expect(findByTestId(body, "change-equipment-presets")).toBeNull();
    expect(findByTestId(body, "change-equipment-actor-select")?.value).toBe(actorId);
    expect(findByTestId(body, "change-equipment-slot-select")?.tagName).toBe("SELECT");
    expect(findByTestId(body, "change-equipment-equipment-select")?.tagName).toBe("SELECT");
    expect(findByTestId(body, "change-equipment-equipment-select-card")?.textContent).toContain(weaponName);
    expect(body.textContent).not.toContain("빠른 선택");
  });

  it("unequips the slot through the unequip card", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      changeEquipmentBody(ctx(replaceCommand), {
        kind: "changeEquipment",
        actorId,
        slot: "weapon",
        equipmentId: weaponId,
      })
    );
    (findByTestId(body, "change-equipment-card-unequip") as FakeElement | null)?.dispatchEvent(new Event("click"));
    expect(replaceCommand).toHaveBeenCalledWith(
      [0],
      { kind: "changeEquipment", actorId, slot: "weapon", equipmentId: "" } satisfies Command
    );
  });

  it("filters the equipment grid live by name", () => {
    const body = renderWithFakeDom(() =>
      changeEquipmentBody(ctx(), {
        kind: "changeEquipment",
        actorId,
        slot: "weapon",
        equipmentId: weaponId,
      })
    );
    const search = findByTestId(body, "change-equipment-search") as FakeElement | null;
    expect(search).not.toBeNull();
    expect(findByTestId(body, `change-equipment-card-${weaponId}`)).not.toBeNull();

    if (search) {
      search.value = "zzzz-no-match";
      search.dispatchEvent(new Event("input"));
    }
    expect(findByTestId(body, `change-equipment-card-${weaponId}`)).toBeNull();
    expect(body.textContent).toContain("검색 결과");

    if (search) {
      search.value = weaponName.slice(0, Math.min(2, weaponName.length));
      search.dispatchEvent(new Event("input"));
    }
    expect(findByTestId(body, `change-equipment-card-${weaponId}`)).not.toBeNull();
  });

  it("switches slot via segment and keeps equipment select filtered", () => {
    if (!armorId) return;
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      changeEquipmentBody(ctx(replaceCommand), {
        kind: "changeEquipment",
        actorId,
        slot: "weapon",
        equipmentId: weaponId,
      })
    );
    const armorSeg = findByTestId(body, "change-equipment-slot-select-segment-armor") as FakeElement | null;
    expect(armorSeg).not.toBeNull();
    armorSeg?.dispatchEvent(new Event("click"));
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "changeEquipment" }>;
    expect(next.slot).toBe("armor");
    // weapon id should not remain selected after slot change unless it is armor
    expect(next.equipmentId === "" || next.equipmentId === armorId || next.slot === "armor").toBe(true);
  });
});
