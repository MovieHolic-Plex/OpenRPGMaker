import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

it("rejects dangling manual face mappings rather than loading them as valid project metadata", () => {
  const project = createBlankProject();
  const profile = project.resourceProfiles.find((entry) => entry.kind === "charset")!;
  Object.assign(profile, { characterSlots: [{ characterIndex: 0, status: "mapped", faceResourceId: "missing-face", quality: "exact", note: "", graphicAttributes: {} }] });
  expect(() => deserialize(serialize(project))).toThrow();
});
