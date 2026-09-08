import { describe, expect, it } from "vitest";
import { FakeNode } from "./fakeDom";

describe("acceptance checklist DOM insertion", () => {
  it("moves an existing row without duplication and supports append and self insertion", () => {
    const list = new FakeNode(), first = new FakeNode(), second = new FakeNode();
    list.append(first, second);
    expect(list.insertBefore(second, first)).toBe(second);
    expect(list.childNodes).toEqual([second, first]);
    list.insertBefore(second, second);
    expect(list.childNodes).toEqual([second, first]);
    list.insertBefore(second, null);
    expect(list.childNodes).toEqual([first, second]);
    expect(second.parentNode).toBe(list);
  });
  it("detaches a row from its previous list and rejects a foreign reference", () => {
    const previous = new FakeNode(), next = new FakeNode(), row = new FakeNode(), foreign = new FakeNode();
    previous.append(row);
    next.insertBefore(row, null);
    expect(previous.childNodes).toEqual([]);
    expect(next.childNodes).toEqual([row]);
    expect(row.parentNode).toBe(next);
    expect(() => next.insertBefore(row, foreign)).toThrow();
    expect(next.childNodes).toEqual([row]);
  });
});
