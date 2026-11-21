import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { ProjectFormatError } from "@/project/io/errors";

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

  it("rejects a bad import without the raw English parser message", () => {
    let caught: unknown;
    try {
      deserialize("not json");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProjectFormatError);
    expect((caught as Error).message).toBe("이 파일은 프로젝트 JSON이 아닙니다.");
    expect((caught as Error).message).not.toMatch(/Unexpected token|JSON\.parse/i);
    expect((caught as { cause?: unknown }).cause).toBeInstanceOf(SyntaxError);
  });
});
