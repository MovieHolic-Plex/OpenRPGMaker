import { describe, expect, it } from "vitest";
import { assertSmallTaskLayering, problemsInSource } from "../scripts/check-small-task-layering.mjs";

const rel = "src/editor/smallTask/example.ts";

describe("small-task layering", () => {
  it("keeps core from importing or naming a numbered unit", () => {
    expect(assertSmallTaskLayering()).toEqual([]);
  });

  it("still sees a unit import after a string that contains a block-comment marker", () => {
    const source = 'const marker = "/*";\nimport "../units/02-cmd-flow";\n';
    expect(problemsInSource(source, rel)).toEqual([
      `${rel}:2: imports a unit module (../units/02-cmd-flow)`,
    ]);
  });

  it("sees a dynamic import whose specifier is on the next line", () => {
    const source = "const unit = await import(\n  \"../units/02-cmd-flow\"\n);\n";
    expect(problemsInSource(source, rel)).toEqual([
      `${rel}:1: imports a unit module (../units/02-cmd-flow)`,
    ]);
  });

  it("ignores a unit import that is only in a comment", () => {
    const source = "// import \"../units/02-cmd-flow\"\n/* from \"../units/03-cmd-switch-var\" */\nconst x = 1;\n";
    expect(problemsInSource(source, rel)).toEqual([]);
  });

  it("sees an import after a slash-star inside a regular expression", () => {
    const source = "const separator = /[/*]/;\nimport \"../units/02-cmd-flow\";\n";
    expect(problemsInSource(source, rel)).toEqual([
      `${rel}:2: imports a unit module (../units/02-cmd-flow)`,
    ]);
  });

  it("sees a unit id in a constant template literal", () => {
    const source = "if (unit === `02-cmd-flow`) handle();\n";
    expect(problemsInSource(source, rel)).toEqual([
      `${rel}:1: names a numbered unit`,
    ]);
  });

  it("sees a dynamic import of a constant template specifier", () => {
    const source = "await import(`../units/02-cmd-flow`);\n";
    expect(problemsInSource(source, rel)).toEqual([
      `${rel}:1: imports a unit module (../units/02-cmd-flow)`,
    ]);
  });

  it("does not treat an interpolated template as a constant unit import", () => {
    const source = "await import(`../units/${name}`);\n";
    expect(problemsInSource(source, rel)).toEqual([]);
  });

  it("does not treat import text inside a string as a module import", () => {
    const source = "const example = 'import \"../units/02-cmd-flow\"';\n";
    expect(problemsInSource(source, rel)).toEqual([]);
  });

  it("keeps the ownership list exempt from unit id strings", () => {
    const source = "export const id = \"02-cmd-flow\";\n";
    expect(problemsInSource(source, "src/editor/smallTask/primitives/ownership.ts")).toEqual([]);
  });
});
