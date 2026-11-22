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
});
