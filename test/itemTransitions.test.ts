import { describe, expect, it } from "vitest";
import {
  normalizeItemTransitionState,
  transitionItemState,
  transitionItemStates,
  type ItemTransitionAction,
  type ItemTransitionState,
} from "@/project/itemTransitions";
import { createBlankProject } from "@/project/defaults";
import type { ItemRecord } from "@/project/types";

function finiteItem(limit: 1 | 2 | 3 | 4 | 5): ItemRecord {
  const item = structuredClone(createBlankProject().database.items[0]!);
  item.id = "finite";
  item.consumable = true;
  item.consumptionLimit = limit;
  return item;
}

describe("item transition authority", () => {
  it("counts successful uses on the FIFO copy and consumes exactly at its limit", () => {
    const item = finiteItem(3);
    const first = transitionItemState({ inventory: { finite: 2 } }, [item], { kind: "successfulUse", itemId: item.id });
    expect(first).toEqual({ inventory: { finite: 2 }, itemUseCharges: { finite: 1 } });
    const second = transitionItemState(first, [item], { kind: "successfulUse", itemId: item.id });
    expect(second).toEqual({ inventory: { finite: 2 }, itemUseCharges: { finite: 2 } });
    const third = transitionItemState(second, [item], { kind: "successfulUse", itemId: item.id });
    expect(third).toEqual({ inventory: { finite: 1 }, itemUseCharges: {} });
  });

  it("preserves a partial current copy on grant and removes uncharged tail copies first", () => {
    const item = finiteItem(4);
    const granted = transitionItemState(
      { inventory: { finite: 1 }, itemUseCharges: { finite: 2 } },
      [item],
      { kind: "grant", itemId: item.id, amount: 2 },
    );
    expect(granted).toEqual({ inventory: { finite: 3 }, itemUseCharges: { finite: 2 } });
    const removedTail = transitionItemState(granted, [item], { kind: "remove", itemId: item.id, amount: 2 });
    expect(removedTail).toEqual({ inventory: { finite: 1 }, itemUseCharges: { finite: 2 } });
    const removedCurrent = transitionItemState(removedTail, [item], { kind: "remove", itemId: item.id, amount: 1 });
    expect(removedCurrent).toEqual({ inventory: {}, itemUseCharges: {} });
  });

  it("applies a readonly action batch in the same order as individual transitions", () => {
    const item = finiteItem(3);
    const initial = { inventory: { finite: 1 }, itemUseCharges: { finite: 1 } };
    const actions = [
      { kind: "grant", itemId: item.id, amount: 2 },
      { kind: "successfulUse", itemId: item.id },
      { kind: "remove", itemId: item.id, amount: 1 },
      { kind: "successfulUse", itemId: item.id },
    ] as const satisfies readonly ItemTransitionAction[];
    const individual = actions.reduce<ItemTransitionState>(
      (state, action) => transitionItemState(state, [item], action),
      initial,
    );

    expect(transitionItemStates(initial, [item], actions)).toEqual(individual);
    expect(transitionItemStates(initial, [item], actions)).toEqual({
      inventory: { finite: 1 },
      itemUseCharges: {},
    });
  });

  it("normalizes lowered limits and prunes malformed, unknown, unlimited, and empty entries independently", () => {
    const finite = finiteItem(2);
    const unlimited = { ...finiteItem(3), id: "unlimited", consumptionLimit: "noLimit" as const };
    expect(normalizeItemTransitionState({
      inventory: { finite: 4, unlimited: 1, unknown: 1 },
      itemUseCharges: { finite: 5, unlimited: 1, unknown: 1, malformed: -4 },
    }, [finite, unlimited])).toEqual({
      inventory: { finite: 2, unlimited: 1, unknown: 1 },
      itemUseCharges: { finite: 1 },
    });
  });
});
