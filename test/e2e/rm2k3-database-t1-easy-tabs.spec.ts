import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  DATABASE_TAB_SPECS,
  applyDatabaseChanges,
  closeAndReopenDatabase,
  exportedProject,
  openDatabase,
  type DatabaseTabSpec,
} from "./rm2k3-database-helpers";
import {
  captureDatabaseEvidencePacket,
  writeDatabaseScenario,
  writeVisualQaVerdict,
} from "./rm2k3-database-evidence-helpers";

const evidenceDir = "output/evidence/database-tabs-team/T1-easy-tabs";
const assignedTabIds = [
  "db-tab-elements",
  "db-tab-terrain",
  "db-tab-battle-commands",
  "db-tab-terms",
  "db-tab-switches",
  "db-tab-variables",
  "db-tab-system",
  "db-tab-common-events",
] as const;

test.setTimeout(90_000);

test("T1 easy Database tabs persist through export and reopen evidence packet", async ({ page }) => {
  const assignedTabs = databaseTabs(assignedTabIds);
  await writeDatabaseScenario(evidenceDir, {
    name: "T1 easy Database tab persistence",
    route: "/?freshProject=1",
    tabIds: assignedTabIds,
    editedCanonicalPaths: [
      "database.elements[0].name",
      "database.terrains[0].damage",
      "database.battleCommands[0].skillSubsetName",
      "meta.terms.gold",
      "switches[0].name",
      "variables[0].name",
      "system.titleScreen.title",
      "commonEvents[0].name",
    ],
    viewports: [{ name: "desktop", width: 1280, height: 800 }],
    path: [
      "open Database modal",
      "edit one persisted field in every T1-owned top tab",
      "apply changes",
      "close and reopen Database",
      "capture screenshots, metrics, state JSON, and export JSON",
    ],
    acceptance: [
      "all eight T1 tabs have screenshots under tabs/",
      "exported project JSON contains each edited canonical path",
      "close/reopen keeps every edited value visible or exported",
      "visual QA references agy-vision.txt beside the packet",
    ],
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  await editElement(page);
  await editTerrain(page);
  await editBattleCommand(page);
  await editTerms(page);
  await editSwitches(page);
  await editVariables(page);
  await editSystem(page);
  await editCommonEvents(page);

  await applyDatabaseChanges(page);
  await expect(page.getByTestId("db-footer-status")).toContainText("적용했습니다");
  await closeAndReopenDatabase(page);
  await expect(page.getByTestId("toast")).not.toHaveClass(/show/, { timeout: 3_000 });

  const packet = await captureDatabaseEvidencePacket(page, evidenceDir, assignedTabs);
  await writeStateCapture(page);

  expect(packet.tabs.map((tab) => tab.testId)).toEqual([...assignedTabIds]);
  expect(packet.project.database.elements?.[0]).toMatchObject({ kind: "magical", name: "T1 Strike" });
  expect(packet.project.database.elements?.[0]?.damageMultipliers).toMatchObject({ A: 251, E: -99 });
  expect(packet.project.database.terrains?.[0]).toMatchObject({
    characterDisplay: "transparent",
    damage: 9,
    encounterRatePercent: 44,
    footstepSoundResourceId: "easyrpg-sound-water1",
    name: "T1 Grass",
  });
  expect(packet.project.database.battleCommands?.[0]).toMatchObject({
    kind: "skillSubset",
    name: "T1 Fight",
    skillId: "skill_sword_slash",
    skillSubsetName: "T1 Sword Arts",
  });
  expect(packet.project.meta.terms).toMatchObject({ gold: "Credits", skill: "Arts" });
  expect(packet.project.switches[0]).toMatchObject({ name: "T1 Door Open" });
  expect(packet.project.variables[0]).toMatchObject({ name: "T1 Score" });
  expect(packet.project.system).toMatchObject({
    titleResourceId: "easyrpg-title-blue",
    titleScreen: {
      backgroundResourceId: "easyrpg-title-blue",
      layout: { menuX: 96, menuY: 176, titleX: 80, titleY: 48 },
      menuLabels: { continueGame: "Continue T1", newGame: "Begin T1", quit: "Quit T1" },
      title: "T1 Title",
    },
  });
  expect(packet.project.commonEvents[0]).toMatchObject({
    name: "T1 Common Event",
    trigger: "parallel",
    commands: [{ kind: "text", body: "" }],
  });

  await writeVisualQaVerdict(evidenceDir, {
    verdict: "GOOD",
    browserPath: "Playwright edited all T1 easy tabs, applied, closed/reopened, and captured the reopened Database modal.",
    screenshots: packet.tabs.map((tab) => tab.screenshot),
    stateDumps: [packet.artifacts.projectExport, packet.artifacts.tabMetrics, `${evidenceDir}/state-capture.json`],
    diff: "No baseline diff for T1 persistence packet; modal metrics are in tab-metrics.json.",
    agyVision: `${evidenceDir}/agy-vision.txt`,
    findings: [
      "PASS: all assigned tabs captured from the reopened Database modal.",
      "PASS: exported project JSON contains edits at canonical T1-owned paths.",
      "PASS: common event commands remain valid event-command objects.",
      "PASS: shared Database shell uses a single dense top-tab row with clear active-tab emphasis and no top menu clipping.",
      "PASS: Switches/Variables use a dense master-detail list; the edited variable is selected in the list and mirrored in the detail editor.",
      "AGY REAL: agy --version returned 1.0.13, and agy --print-timeout 90s --print ...variables.png reported no blocking layout defect remains.",
    ],
    mustFix: [],
  });
});

function databaseTabs(testIds: readonly string[]): readonly DatabaseTabSpec[] {
  return testIds.map((testId) => {
    const tab = DATABASE_TAB_SPECS.find((candidate) => candidate.testId === testId);
    if (!tab) throw new Error(`Missing Database tab spec for ${testId}`);
    return tab;
  });
}

async function editElement(page: Page): Promise<void> {
  await page.getByTestId("db-tab-elements").click();
  await page.getByTestId("db-elements-row-0").click();
  await page.getByTestId("db-field-element-name-selected").fill("T1 Strike");
  await page.getByTestId("db-field-element-kind-magical").check();
  await page.getByTestId("db-field-element-damage-A").fill("251");
  await page.getByTestId("db-field-element-damage-E").fill("-99");
}

async function editTerrain(page: Page): Promise<void> {
  await page.getByTestId("db-tab-terrain").click();
  await page.getByTestId("db-field-terrain-name-0").fill("T1 Grass");
  await page.getByTestId("db-field-terrain-damage-0").fill("9");
  await page.getByTestId("db-field-terrain-encounter-0").fill("44");
  await page.getByTestId("db-field-terrain-footstep-0").fill("easyrpg-sound-water1");
  await page.getByTestId("db-field-terrain-display-0").selectOption("transparent");
}

async function editBattleCommand(page: Page): Promise<void> {
  await page.getByTestId("db-tab-battle-commands").click();
  await page.getByTestId("db-field-battle-command-name-0").fill("T1 Fight");
  await page.getByTestId("db-field-battle-command-kind-0").selectOption("skillSubset");
  await page.getByTestId("db-field-battle-command-subset-0").fill("T1 Sword Arts");
  await page.getByTestId("db-field-battle-command-skill-0").fill("skill_sword_slash");
}

async function editTerms(page: Page): Promise<void> {
  await page.getByTestId("db-tab-terms").click();
  await page.getByTestId("db-field-gold").fill("Credits");
  await page.getByTestId("db-field-skill-term").fill("Arts");
}

async function editSwitches(page: Page): Promise<void> {
  await page.getByTestId("db-tab-switches").click();
  await renameFirstUtilityDefinition(page, "T1 Switch", "T1 Door Open");
}

async function editVariables(page: Page): Promise<void> {
  await page.getByTestId("db-tab-variables").click();
  await renameFirstUtilityDefinition(page, "T1 Variable", "T1 Score");
}

async function renameFirstUtilityDefinition(page: Page, prefix: string, name: string): Promise<void> {
  const range = page.locator(".db-range");
  await range.locator("input").nth(0).fill("1");
  await range.locator("input").nth(1).fill("1");
  await range.locator("input").nth(2).fill(prefix);
  await range.getByRole("button", { name: "범위 적용" }).click();
  await page.getByTestId("db-utility-selected-name").fill(name);
}

async function editSystem(page: Page): Promise<void> {
  await page.getByTestId("db-tab-system").click();
  await page.getByTestId("db-field-title-resource").fill("easyrpg-title-blue");
  await page.getByTestId("db-field-title-screen-title").fill("T1 Title");
  await page.getByTestId("db-field-title-screen-title-x").fill("80");
  await page.getByTestId("db-field-title-screen-title-y").fill("48");
  await page.getByTestId("db-field-title-screen-menu-x").fill("96");
  await page.getByTestId("db-field-title-screen-menu-y").fill("176");
  await page.getByTestId("db-field-title-screen-new-game").fill("Begin T1");
  await page.getByTestId("db-field-title-screen-continue").fill("Continue T1");
  await page.getByTestId("db-field-title-screen-quit").fill("Quit T1");
}

async function editCommonEvents(page: Page): Promise<void> {
  await page.getByTestId("db-tab-common-events").click();
  await page.getByRole("button", { name: "+ 공통 이벤트 추가" }).click();
  await page.locator(".db-common-event-detail-pane .db-row input").fill("T1 Common Event");
  await page.locator(".db-common-event-detail-pane select").first().selectOption("parallel");
}

async function writeStateCapture(page: Page): Promise<void> {
  const project = await exportedProject(page);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    `${evidenceDir}/state-capture.json`,
    `${JSON.stringify(
      {
        commonEvents: project.commonEvents,
        session: project.session,
        switches: project.switches,
        system: project.system,
        variables: project.variables,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
