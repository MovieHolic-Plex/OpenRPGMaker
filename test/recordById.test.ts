import { describe, expect, it } from "vitest";
import { recordById } from "@/project/recordById";

describe("recordById", () => {
  it("answers like Array.find by id, including after in-place edits", () => {
    const list = [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "a", v: 3 }];
    expect(recordById(list, "a")).toBe(list[0]);
    expect(recordById(list, "b")?.v).toBe(2);
    expect(recordById(list, "zz")).toBeUndefined();
    list[1] = { id: "c", v: 4 };
    expect(recordById(list, "b")).toBeUndefined();
    expect(recordById(list, "c")?.v).toBe(4);
    list.push({ id: "d", v: 5 });
    expect(recordById(list, "d")?.v).toBe(5);
    list.unshift({ id: "d", v: 6 });
    expect(recordById(list, "d")).toBe(list.find((r) => r.id === "d"));
    expect(recordById(list, "a")).toBe(list.find((r) => r.id === "a"));
  });
});
