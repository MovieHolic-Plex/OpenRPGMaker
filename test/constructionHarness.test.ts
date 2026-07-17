import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("construction:harness verifier", () => {
  it("binds the package command to the dependency-free local Node wrapper", () => {
    // Given
    const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));

    // When
    const command = Reflect.get(Reflect.get(packageJson, "scripts"), "construction:harness");

    // Then
    expect(command).toBe("node scripts/run-construction-harness.mjs");
    expect(existsSync(resolve("scripts/run-construction-harness.mjs"))).toBe(true);
  });
});
