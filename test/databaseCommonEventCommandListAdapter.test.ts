import { beforeEach, describe, expect, it } from "vitest";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { createDatabaseCommandListActions } from "@/editor/panels/databaseCommandListAdapter";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Command } from "@/project/types";

describe("database common event command-list adapter", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("adds non-text commands to database-owned common event arrays and persists them", () => {
    const commonEventId = "ce_command_adapter";
    const switchId = store.getCurrent().switches[0]?.id ?? "";
    seedCommonEvent(commonEventId, [{ kind: "text", body: "seed" }]);
    const actions = adapterFor(commonEventId);

    actions.addCommand([], { kind: "setSwitch", switchId, value: true });

    const commands = restoredCommands(commonEventId);
    expect(commands).toEqual([{ kind: "text", body: "seed" }, { kind: "setSwitch", switchId, value: true }]);
  });

  it("persists nested commands created under common event branches", () => {
    const commonEventId = "ce_command_adapter_nested";
    const switchId = store.getCurrent().switches[1]?.id ?? "";
    seedCommonEvent(commonEventId, [
      { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [], else: [] },
    ]);
    const actions = adapterFor(commonEventId);

    actions.addCommand([0, FORK_THEN_BRANCH_INDEX], { kind: "setSwitch", switchId, value: false });

    expect(restoredCommands(commonEventId)[0]).toEqual({
      kind: "fork",
      condition: { kind: "switch", switchId, value: true },
      then: [{ kind: "setSwitch", switchId, value: false }],
      else: [],
    });
  });
});

function seedCommonEvent(commonEventId: string, commands: Command[]): void {
  store.update((draft) => {
    draft.commonEvents = [{ id: commonEventId, name: "Adapter", trigger: "none", commands: structuredClone(commands) }];
  });
}

function adapterFor(commonEventId: string): ReturnType<typeof createDatabaseCommandListActions> {
  return createDatabaseCommandListActions({
    commands: store.getCurrent().commonEvents.find((record) => record.id === commonEventId)?.commands ?? [],
    replaceCommands: (commands: Command[]) => {
      store.update((draft) => {
        const commonEvent = draft.commonEvents.find((record) => record.id === commonEventId);
        if (commonEvent) commonEvent.commands = commands;
      });
    },
  });
}

function restoredCommands(commonEventId: string): readonly Command[] {
  return deserialize(serialize(store.getCurrent())).commonEvents.find((record) => record.id === commonEventId)?.commands ?? [];
}
