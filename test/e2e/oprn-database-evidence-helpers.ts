import { mkdir, writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import {
  captureDatabaseShellMetrics,
  exportedProject,
  switchDatabaseTab,
  type DatabaseShellMetrics,
  type DatabaseTabSpec,
  type ExportedProject,
} from "./oprn-database-helpers";

export type EvidenceViewport = {
  readonly height: number;
  readonly name: string;
  readonly width: number;
};

export type DatabaseEvidenceScenario = {
  readonly acceptance: readonly string[];
  readonly editedCanonicalPaths?: readonly string[];
  readonly name: string;
  readonly path: readonly string[];
  readonly route: string;
  readonly tabIds?: readonly string[];
  readonly viewports: readonly EvidenceViewport[];
};

export type DatabaseTabEvidence = {
  readonly metrics: DatabaseShellMetrics;
  readonly screenshot: string;
  readonly slug: string;
  readonly testId: string;
};

export type DatabaseEvidenceArtifacts = {
  readonly projectExport: string;
  readonly tabMetrics: string;
};

export type DatabaseEvidencePacket = {
  readonly artifacts: DatabaseEvidenceArtifacts;
  readonly project: ExportedProject;
  readonly tabs: readonly DatabaseTabEvidence[];
};

export type VisualQaVerdictInput = {
  readonly agyVision: string;
  readonly browserPath: string;
  readonly diff: string;
  readonly findings: readonly string[];
  readonly mustFix: readonly string[];
  readonly screenshots: readonly string[];
  readonly stateDumps: readonly string[];
  readonly verdict: "GOOD" | "NEEDS WORK";
};

export async function writeDatabaseScenario(dir: string, scenario: DatabaseEvidenceScenario): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeJson(`${dir}/scenario.json`, scenario);
}

export async function captureDatabaseEvidencePacket(
  page: Page,
  dir: string,
  tabs: readonly DatabaseTabSpec[]
): Promise<DatabaseEvidencePacket> {
  await mkdir(`${dir}/tabs`, { recursive: true });

  const tabEvidence: DatabaseTabEvidence[] = [];
  for (const tab of tabs) {
    await switchDatabaseTab(page, tab);
    const screenshot = `${dir}/tabs/${tab.slug}.png`;
    await page.getByTestId("database-modal").screenshot({ path: screenshot });
    tabEvidence.push({
      metrics: await captureDatabaseShellMetrics(page),
      screenshot,
      slug: tab.slug,
      testId: tab.testId,
    });
  }

  const project = await exportedProject(page);
  const artifacts = {
    projectExport: `${dir}/project-export.json`,
    tabMetrics: `${dir}/tab-metrics.json`,
  };

  await writeJson(artifacts.projectExport, project);
  await writeJson(artifacts.tabMetrics, tabEvidence);

  return { artifacts, project, tabs: tabEvidence };
}

export async function writeVisualQaVerdict(dir: string, input: VisualQaVerdictInput): Promise<void> {
  const mustFix = input.mustFix.length > 0 ? input.mustFix : ["None."];
  const markdown = [
    `# Visual QA - Verdict: ${input.verdict}`,
    "",
    "## Evidence",
    "",
    `- Browser path: ${input.browserPath}`,
    `- Screenshots: ${input.screenshots.join(", ")}`,
    `- State dumps: ${input.stateDumps.join(", ")}`,
    `- Diff: ${input.diff}`,
    `- agy-vision: ${input.agyVision}`,
    "",
    "## Findings",
    "",
    ...input.findings.map((finding) => `- ${finding}`),
    "",
    "## Must Fix",
    "",
    ...mustFix.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/visual-qa.md`, markdown, "utf8");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
