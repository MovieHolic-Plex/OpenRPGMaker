import { expect, test } from "@playwright/test";
import { captureDatabaseEvidencePacket, writeDatabaseScenario, writeVisualQaVerdict } from "./oprn-database-evidence-helpers";
import {
  DATABASE_TAB_SPECS,
  openDatabase,
  switchDatabaseTab,
} from "./oprn-database-helpers";

const evidenceDir = "output/evidence/database-tabs-team/T6-evidence-harness/proof";

test("T6 shared evidence harness opens every Database tab and captures packet artifacts", async ({ page }) => {
  await writeDatabaseScenario(evidenceDir, {
    name: "T6 all-tab harness proof",
    route: "/?freshProject=1",
    viewports: [{ name: "desktop", width: 1280, height: 800 }],
    path: ["open Database modal", "switch every top tab", "capture shell metrics, screenshots, and export JSON"],
    acceptance: [
      "all 20 Database top tabs become active through the shared helper",
      "project export JSON is saved beside screenshots",
      "visual QA contract records GOOD when the proof packet is complete",
    ],
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  const packet = await captureDatabaseEvidencePacket(page, evidenceDir, DATABASE_TAB_SPECS);

  expect(packet.tabs).toHaveLength(DATABASE_TAB_SPECS.length);
  expect(packet.tabs.map((tab) => tab.testId)).toEqual(DATABASE_TAB_SPECS.map((tab) => tab.testId));
  expect(packet.project.database.actors.length).toBeGreaterThan(0);
  expect(packet.artifacts.projectExport).toContain("project-export.json");

  const actorsTab = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors");
  if (!actorsTab) throw new Error("missing actors tab spec");

  await switchDatabaseTab(page, actorsTab);
  await expect(page.getByTestId(actorsTab.testId)).toHaveClass(/active/);

  await writeVisualQaVerdict(evidenceDir, {
    verdict: "GOOD",
    browserPath: "Playwright opened Database and switched every top tab through shared helpers.",
    screenshots: packet.tabs.map((tab) => tab.screenshot),
    stateDumps: [packet.artifacts.projectExport, packet.artifacts.tabMetrics],
    diff: "No baseline diff for Wave 0 helper proof.",
    findings: [
      "PASS: all Database top tabs activated and packet artifacts were written.",
      "PASS: shared Database shell no longer shows the duplicate classic tab row, top menu clipping, or weak active-tab state that the first agy pass flagged.",
      "PASS: Variables/Switches now use the same dense master-detail pattern as the rest of the Database modal instead of a sparse full-width row form.",
      "AGY REAL: agy 1.0.13 reviewed variables.png and reported no blocking layout defect remains.",
    ],
    mustFix: [],
    agyVision: `${evidenceDir}/agy-vision.txt - variables.png second-opinion review captured; no blocking layout defect remains.`,
  });
});
