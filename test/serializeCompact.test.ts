import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize, serializePretty } from "@/project/io";

describe("project serialize wire format", () => {
  it("uses compact JSON for canonical serialize (no pretty indent)", () => {
    const project = createBlankProject();
    const wire = serialize(project);
    expect(wire.includes("\n  ")).toBe(false);
    expect(wire.startsWith("{")).toBe(true);
    expect(deserialize(wire).meta.title).toBe(project.meta.title);
  });

  it("keeps pretty serialize for human package dumps", () => {
    const project = createBlankProject();
    const pretty = serializePretty(project);
    expect(pretty.includes("\n  ")).toBe(true);
    expect(deserialize(pretty).version).toBe(project.version);
  });
});
