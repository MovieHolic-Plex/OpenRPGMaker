import { expect, it } from "vitest";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";

it("assigns appearance generation an explicit activity family", () => {
  expect(aiActivityFamilySource("generate_character_appearance")).toBe("mapped");
});
