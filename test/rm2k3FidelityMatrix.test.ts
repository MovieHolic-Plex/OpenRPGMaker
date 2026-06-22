import { describe, expect, it } from "vitest";
import matrix from "./fixtures/rm2k3-fidelity-matrix.json";

const requiredSections = [
  "battle",
  "database",
  "eventPages",
  "resourceProfiles",
  "runtimePresentation",
  "migration",
  "concurrency",
  "legalGuardrails",
] as const;

type MatrixSection = {
  readonly title: string;
  readonly checklist: readonly {
    readonly id: string;
    readonly requirement: string;
    readonly status: string;
    readonly reason?: string;
    readonly guardrail?: string;
  }[];
};

type FidelityMatrix = typeof matrix &
  Record<(typeof requiredSections)[number], MatrixSection>;

const allowedStatuses: ReadonlySet<string> = new Set([
  "done",
  "partial",
  "outOfScope",
]);
const legacyStatuses: ReadonlySet<string> = new Set([
  ["contract", "ed"].join(""),
  ["guard", "rail"].join(""),
]);
const fidelityMatrix: FidelityMatrix = matrix;

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

describe("RM2K3 fidelity matrix", () => {
  it("contains the required top-level contract sections", () => {
    expect(Object.keys(fidelityMatrix)).toEqual(
      expect.arrayContaining([...requiredSections])
    );
  });

  it("keeps each section concrete enough to guide later implementation", () => {
    for (const sectionName of requiredSections) {
      const section: MatrixSection = fidelityMatrix[sectionName];

      expect(section.title.length).toBeGreaterThan(0);
      expect(section.checklist.length).toBeGreaterThanOrEqual(3);
      expect(section.checklist.every((row) => row.id.startsWith(sectionName))).toBe(
        true
      );
      expect(section.checklist.every((row) => row.requirement.length >= 24)).toBe(
        true
      );
      expect(section.checklist.every((row) => allowedStatuses.has(row.status))).toBe(
        true
      );
      expect(section.checklist.every((row) => !legacyStatuses.has(row.status))).toBe(
        true
      );
      expect(
        section.checklist.every((row) => row.status !== "partial" || hasText(row.reason))
      ).toBe(true);
      expect(
        section.checklist.every(
          (row) =>
            row.status !== "outOfScope" ||
            (hasText(row.reason) && hasText(row.guardrail))
        )
      ).toBe(true);
    }
  });

  it("pins the RM2K3-specific drift-sensitive requirements", () => {
    const requirements = requiredSections.flatMap((sectionName) =>
      fidelityMatrix[sectionName].checklist.map((row) => row.requirement)
    );
    const contractText = requirements.join("\n");

    expect(contractText).toContain("320x240");
    expect(contractText).toContain("16x16");
    expect(contractText).toContain("24x32");
    expect(contractText).toContain("BattleCharSet");
    expect(contractText).toContain("Side-view");
    expect(contractText).toContain("Actors");
    expect(contractText).toContain("Enemies");
    expect(contractText).toContain("Event pages");
    expect(contractText).toContain("SCHEMA_VERSION = 3");
    expect(contractText).toContain("highest-number");
    expect(contractText).toContain("backup");
    expect(contractText).toContain("Must NOT");
  });
});
