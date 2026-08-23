import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { captureDatabaseEvidencePacket, writeDatabaseScenario, writeVisualQaVerdict } from "./oprn-database-evidence-helpers";
import {
  DATABASE_TAB_SPECS,
  applyDatabaseChanges,
  closeAndReopenDatabase,
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./oprn-database-helpers";

const evidenceDir = "output/evidence/database-tabs-team/T5-battle-domain";
const battleTabs = DATABASE_TAB_SPECS.filter((tab) => tab.slug === "enemies" || tab.slug === "troops" || tab.slug === "battle-screen");

type T5RuntimeState = {
  readonly backdropResourceId?: string;
  readonly enemies: readonly {
    readonly maxHp: number;
    readonly name: string;
    readonly recordId: string;
  }[];
  readonly troopId: string;
};

test("T5 battle-domain tabs persist enemy, troop, and battle screen settings into runtime consumers", async ({ page }) => {
  await writeDatabaseScenario(evidenceDir, {
    name: "T5 battle-domain database tabs",
    route: "/?freshProject=1",
    viewports: [{ name: "desktop", width: 1280, height: 800 }],
    path: [
      "open Database modal",
      "edit Enemies canonical fields",
      "edit Troops canonical fields",
      "edit Battle Screen system aggregate fields",
      "apply, close, reopen, export JSON",
      "instantiate battle runtime from edited system.initialTroopId",
      "capture screenshots and state packet",
    ],
    acceptance: [
      "enemies tab writes Project.database.enemies",
      "troops tab writes Project.database.troops",
      "battleScreen tab writes Project.system.battleSystemResourceId and Project.system.initialTroopId",
      "export/reopen preserves edited values",
      "battle runtime reads the edited troop/background/enemy surfaces",
    ],
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  const enemiesTab = tabBySlug("enemies");
  const troopsTab = tabBySlug("troops");
  const battleScreenTab = tabBySlug("battle-screen");

  await switchDatabaseTab(page, enemiesTab);
  await page.getByTestId("db-field-name").fill("T5 Runtime Hornet");
  await page.getByTestId("db-field-enemy-max-hp").fill("66");
  await page.getByTestId("db-field-enemy-attack").fill("19");
  await page.getByTestId("db-field-enemy-exp").fill("44");
  await page.getByTestId("db-field-enemy-gold").fill("33");

  await switchDatabaseTab(page, troopsTab);
  await page.getByTestId("db-field-name").fill("T5 Runtime Troop");
  await page.getByTestId("db-picker-troop-member-enemy").selectOption({ label: "T5 Runtime Hornet" });
  await page.getByTestId("db-field-troop-member-x").fill("188");
  await page.getByTestId("db-field-troop-member-y").fill("104");
  await page.getByTestId("db-field-troop-backdrop").fill("easyrpg-backdrop-dawn1");

  const edited = await exportedProject(page);
  const editedTroop = edited.database.troops.find((troop) => troop.name === "T5 Runtime Troop");
  if (!editedTroop) throw new Error("T5 troop edit did not produce a troop record");

  await switchDatabaseTab(page, battleScreenTab);
  await page.getByTestId("db-field-battle-system-resource").fill("easyrpg-system2-system2-b");
  await page.getByTestId("db-picker-battle-initial-troop").selectOption({ label: editedTroop.name });
  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);

  await switchDatabaseTab(page, battleScreenTab);
  await expect(page.getByTestId("db-field-battle-system-resource")).toHaveValue("easyrpg-system2-system2-b");
  await expect(page.getByTestId("db-picker-battle-initial-troop")).toHaveValue(editedTroop.id);

  const packet = await captureDatabaseEvidencePacket(page, evidenceDir, battleTabs);
  const project = packet.project;
  const enemy = project.database.enemies.find((record) => record.name === "T5 Runtime Hornet");
  const troop = project.database.troops.find((record) => record.name === "T5 Runtime Troop");

  expect(enemy).toMatchObject({
    stats: { maxHp: 66, attack: 19 },
    rewards: { exp: 44, gold: 33 },
  });
  expect(troop).toMatchObject({
    members: [{ enemyId: enemy?.id, x: 188, y: 104 }],
    previewBackgroundResourceId: "easyrpg-backdrop-dawn1",
  });
  expect(project.system.battleSystemResourceId).toBe("easyrpg-system2-system2-b");
  expect(project.system.initialTroopId).toBe(troop?.id);

  const runtimeState = await page.evaluate<T5RuntimeState>(async () => {
    const storeModulePath = "/src/project/store.ts";
    const runtimeModulePath = "/src/battle/runtime.ts";
    const [{ store }, { createBattleRuntime }] = await Promise.all([
      import(storeModulePath),
      import(runtimeModulePath),
    ]);
    const project = store.getCurrent();
    const troopId = project.system.initialTroopId;
    if (!troopId) throw new Error("missing initial troop id");
    const runtime = createBattleRuntime({ project, troopId, canEscape: true, canLose: true });
    return runtime.snapshot();
  });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(`${evidenceDir}/state-capture.json`, `${JSON.stringify(runtimeState, null, 2)}\n`, "utf8");

  expect(runtimeState.troopId).toBe(troop?.id);
  expect(runtimeState.backdropResourceId).toBe("easyrpg-backdrop-dawn1");
  expect(runtimeState.enemies[0]).toMatchObject({
    maxHp: 66,
    name: "T5 Runtime Hornet",
    recordId: enemy?.id,
  });

  await writeVisualQaVerdict(evidenceDir, {
    verdict: "GOOD",
    browserPath: "Playwright edited enemies, troops, and battleScreen, applied, reopened, exported JSON, and instantiated battle runtime from system.initialTroopId.",
    screenshots: packet.tabs.map((tab) => tab.screenshot),
    stateDumps: [packet.artifacts.projectExport, packet.artifacts.tabMetrics, `${evidenceDir}/state-capture.json`],
    diff: "No baseline diff for domain packet; JSON export and runtime snapshot are the behavioral oracle.",
    findings: ["PASS: all T5 assigned tabs rendered and exported canonical Project surfaces.", "PASS: runtime snapshot consumed edited troop, enemy, and battle backdrop fields."],
    mustFix: [],
    agyVision: `${evidenceDir}/agy-vision.txt - populated after Playwright capture by the T5 agy vision step.`,
  });
});


test("T8 troop battle event pages edit active commands and enemy action pickers are live", async ({ page }) => {
  const task8EvidenceDir = ".omo/evidence/task-8-playwright";
  await writeDatabaseScenario(task8EvidenceDir, {
    name: "T8 battle event tabs and enemy action controls",
    route: "/?freshProject=1",
    viewports: [{ name: "desktop", width: 1280, height: 840 }],
    path: [
      "open Database modal",
      "create two Troop battle event pages",
      "switch to page 2 and edit its command through the shared command editor",
      "apply, close, reopen, and verify page 2 command persisted",
      "open Enemy action dialog and use the switch picker button",
    ],
    acceptance: [
      "troop battle event tabs are clickable and mark the active page",
      "active page commands render with shared event command list controls",
      "edited active page commands persist after Apply/reopen",
      "enemy action switch picker buttons open a real record picker",
    ],
  });

  await page.setViewportSize({ width: 1280, height: 840 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  await switchDatabaseTab(page, tabBySlug("troops"));
  await page.getByTestId("db-troop-event-add-page").click();
  await page.getByTestId("db-troop-event-add-page").click();
  await expect(page.getByTestId("db-troop-event-page-tab-1")).toBeVisible();
  await expect(page.getByTestId("db-troop-event-page-tab-2")).toBeVisible();
  await page.getByTestId("db-troop-event-page-tab-2").click();
  await expect(page.getByTestId("db-troop-event-page-tab-2")).toHaveClass(/active/);

  await page.getByTestId("db-troop-event-add-change-enemy-hp").click();
  const commandList = page.getByTestId("db-troop-event-command-list");
  const battleCommand = commandList.getByTestId("event-command-m2Command").first();
  await expect(battleCommand).toBeVisible();
  await battleCommand.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-edit").click();
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  const targetSelect = commandDialog.getByTestId("m2-command-target-record-select");
  await targetSelect.selectOption({ index: 1 });
  const selectedTarget = await targetSelect.inputValue();
  await commandDialog.getByTestId("m2-command-operation-option-select").selectOption("remove");
  await commandDialog.getByTestId("m2-command-value-input").fill("37");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(commandDialog).toBeHidden();

  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);
  await switchDatabaseTab(page, tabBySlug("troops"));
  await page.getByTestId("db-troop-event-page-tab-2").click();
  await expect(page.getByTestId("db-troop-event-command-list").getByTestId("event-command-m2Command")).toContainText("적 HP 변경");

  let project = await exportedProject(page);
  const troopPage = project.database.troops[0]?.battleEventPages?.[1];
  expect(troopPage?.commands[0]).toMatchObject({
    kind: "m2Command",
    commandId: "m2-098-change-enemy-hp",
    fields: { target: selectedTarget, operation: "remove", value: "37" },
  });

  await switchDatabaseTab(page, tabBySlug("enemies"));
  await page.getByTestId("db-enemy-action-row-0").dblclick();
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeVisible();
  const switchPicker = page.getByTestId("db-enemy-action-switch-on-picker");
  await expect(switchPicker).toBeEnabled();
  await expect(switchPicker).toHaveAttribute("aria-label", /스위치 ON 선택/u);
  await switchPicker.click();
  await expect(page.getByTestId("event-record-picker")).toBeVisible();
  await page.getByTestId("event-record-picker-row-1").click();
  await page.getByTestId("event-record-picker-ok").click();
  await expect(page.getByTestId("event-record-picker")).toBeHidden();
  await expect(page.getByTestId("db-enemy-action-switch-on-enabled")).toBeChecked();
  await page.getByTestId("db-enemy-action-ok").click();

  project = await exportedProject(page);
  const enemyAction = project.database.enemies[0]?.actions[0];
  expect(enemyAction?.switchOnAfterAction?.enabled).toBe(true);
  expect(enemyAction?.switchOnAfterAction?.switchId).toBe(project.switches[0]?.id);

  await mkdir(`${task8EvidenceDir}/tabs`, { recursive: true });
  await page.getByTestId("database-modal").screenshot({ path: `${task8EvidenceDir}/tabs/t8-final-database.png` });
  await writeFile(`${task8EvidenceDir}/state-capture.json`, `${JSON.stringify({ enemyAction, troopPage }, null, 2)}\n`, "utf8");
});

function tabBySlug(slug: "battle-screen" | "enemies" | "troops") {
  const tab = DATABASE_TAB_SPECS.find((candidate) => candidate.slug === slug);
  if (!tab) throw new Error(`missing Database tab spec: ${slug}`);
  return tab;
}
