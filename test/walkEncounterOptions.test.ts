/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { walkField, walkSelect, walkGroupComposition } from "@/editor/panels/walkEncounterOptions";

it("keeps unnamed authored records selectable with a visible identifier", () => {
  const select = walkSelect([{ id: "var_0001", name: "" }], "var_0001", () => undefined);
  expect(select.options[0]?.textContent?.trim()).not.toBe("");
  expect(select.value).toBe("var_0001");
});

it("assigns the field name explicitly without incorporating its option labels", () => {
  const select = walkSelect([{ id: "a", name: "option-a" }], "a", () => undefined);
  const field = walkField("field-a", select);
  expect(select.getAttribute("aria-label")).toBe(field.querySelector("span")?.textContent);
});


it("counts repeated and hidden authored members instead of using the legacy enemy list", () => {
  const strip = walkGroupComposition({ id: "group", name: "Group", enemyIds: ["wrong"], autoAlign: false, battleEventPages: [], members: [
    { enemyId: "a", x: 0, y: 0 }, { enemyId: "a", x: 1, y: 1, hidden: true }, { enemyId: "b", x: 2, y: 2 },
  ] });
  expect(Array.from(strip.children).map((child) => ({ ...(child as HTMLElement).dataset }))).toEqual([
    { enemyId: "a", count: "2", hiddenCount: "1" }, { enemyId: "b", count: "1", hiddenCount: "0" },
  ]);
});

it("counts legacy enemyIds when no formation was authored and preserves an empty authored formation", () => {
  const troop = { id: "group", name: "Group", enemyIds: ["a", "a"], autoAlign: true, battleEventPages: [] };
  expect(walkGroupComposition(troop).querySelector<HTMLElement>("[data-enemy-id=a]")?.dataset.count).toBe("2");
  expect(walkGroupComposition({ ...troop, members: [] }).querySelector("[data-enemy-id]")).toBeNull();
});
