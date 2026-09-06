/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { walkField, walkSelect } from "@/editor/panels/walkEncounterOptions";

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
