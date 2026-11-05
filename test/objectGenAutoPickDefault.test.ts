// 2026-11-05 imageplan-follow (lead, owner 「필요한 에셋은 만들게 하고」): the assistant must not stop and wait for a person to pick
// a drawn object. 「알아서 고르기」 is on unless the user switched it off on this device, and a drawing that never passes review
// goes back to the assistant as a «could not draw» follow-up instead of waiting on the card.
import { afterEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { OBJECT_GEN_AUTO_PICK_KEY, objectGenAutoPick } = await import("@/editor/workshop/assistantObjectGen");
const { outcomeText } = await import("@/editor/panels/aiObjectGenCard");

describe("object-gen auto pick default", () => {
  afterEach(() => store.clear());

  it("is on when nothing is stored and off only when the user turned it off", () => {
    expect(objectGenAutoPick()).toBe(true);
    store.set(OBJECT_GEN_AUTO_PICK_KEY, "1");
    expect(objectGenAutoPick()).toBe(true);
    store.set(OBJECT_GEN_AUTO_PICK_KEY, "0");
    expect(objectGenAutoPick()).toBe(false);
  });

  it("tells the assistant to place an existing object when a drawing failed, without asking to draw again", () => {
    const text = outcomeText([{ failed: "뿌리 뻗은 고목" }], [{ title: "뿌리 뻗은 고목", need: "고목 방" } as never]);
    expect(text).toContain("[공방에서 못 그림]");
    expect(text).toContain("「뿌리 뻗은 고목」");
    expect(text).toContain("generate_missing_object 를 다시 부르지 마라");
  });
});
