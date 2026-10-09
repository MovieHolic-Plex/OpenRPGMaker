import { expect, test, type Page } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { seedProjectForEditor } from "./projectSeed";
import { applyDatabaseChanges, exportedProject, openDatabase } from "./oprn-database-helpers";
import { startNewGameFromTitle } from "./runtimeInput";

type Project = ReturnType<typeof deserialize>;
type JsonRecord = Record<string, unknown>;

const EVIDENCE = "output/evidence/event-editor-cert/loop15-m2-battle-only";
const FORCE_ESCAPE_ID = "m2-107-force-escape";
const ACTION_TIMES_ID = "m2-108-action-times";
const EXTRA_ACTOR_ID = "actor_loop15_guest";

test("Loop 15 certifies battle-only M2 editor authoring, persistence, and runtime", async ({ page }) => {
  await resetEvidence();
  await page.setViewportSize({ width: 1360, height: 840 });
  await seedProjectForEditor(page, await battleProject());

  await authorBattleOnlyCommands(page);
  await page.getByTestId("database-modal").screenshot({ path: artifact("001-editor-all-battle-only-authoring.png") });
  await writeJson("002-editor-export.json", await battlePageProof(page));
  const fullProject = await exportedRawProject(page);

  await seedProjectForEditor(page, fullProject);
  await openDatabase(page);
  await page.getByTestId("db-tab-troops").click();
  await expect(page.getByTestId("db-field-troop-event-force-escape-summary")).toBeVisible();
  await page.getByTestId("database-modal").screenshot({ path: artifact("003-editor-all-battle-only-after-reload.png") });
  await writeJson("004-editor-roundtrip-after-reload.json", await battlePageProof(page));

  await runNonTerminalBattle(page, projectWithoutCommand(fullProject, FORCE_ESCAPE_ID));
  await runWithoutActionTimesBattle(page, projectWithoutCommands(fullProject, [FORCE_ESCAPE_ID, ACTION_TIMES_ID]));
  await runForceEscapeBattle(page, fullProject);
  await writeSupportFiles();
});

async function authorBattleOnlyCommands(page: Page): Promise<void> {
  await openDatabase(page);
  await page.getByTestId("db-tab-troops").click();
  await page.getByTestId("db-troop-event-add-page").click();
  await page.getByTestId("db-field-troop-event-condition-kind").selectOption("variable");
  await page.getByTestId("db-field-troop-event-condition-variable").fill("var_loop15");
  await page.getByTestId("db-field-troop-event-condition-variable-value").fill("7");
  const variableCondition = await battlePageProof(page);
  await writeJson("000-editor-multifield-condition-proof.json", variableCondition);
  await page.getByTestId("db-field-troop-event-condition-kind").selectOption("actorCommand");
  await page.getByTestId("db-field-troop-event-condition-actor-command-command").selectOption("defend");
  await page.getByTestId("db-troop-event-add-change-enemy-hp").click();
  await page.getByTestId("db-field-troop-event-change-enemy-hp-target").fill("enemy-1");
  await page.getByTestId("db-field-troop-event-change-enemy-hp-operation").selectOption("remove");
  await page.getByTestId("db-field-troop-event-change-enemy-hp-value").fill("5");
  await page.getByTestId("db-troop-event-add-enemy-encounter").click();
  await page.getByTestId("db-field-troop-event-enemy-encounter-target").fill("enemy-2");
  await page.getByTestId("db-troop-event-add-change-battleback").click();
  await page.getByTestId("db-field-troop-event-change-battleback-resource").fill("easyrpg-backdrop-dawn1");
  await page.getByTestId("db-troop-event-add-action-times").click();
  await page.getByTestId("db-field-troop-event-action-times-target").fill(EXTRA_ACTOR_ID);
  await page.getByTestId("db-field-troop-event-action-times-value").fill("2");
  await page.getByTestId("db-troop-event-add-force-escape").click();
  await applyDatabaseChanges(page);
}

async function runNonTerminalBattle(page: Page, project: unknown): Promise<void> {
  await seedProjectForEditor(page, project);
  await startBattle(page);
  const beforeHp = hpFromText(await page.getByTestId("enemy-1").textContent());
  await page.screenshot({ path: artifact("005-runtime-before-nonterminal.png"), fullPage: true });
  await page.getByTestId("actor-command-defend").click();
  await expect(page.getByTestId("battle-backdrop")).toHaveAttribute("data-backdrop-resource-id", "easyrpg-backdrop-dawn1");
  await expect(page.getByTestId("enemy-2")).toHaveAttribute("data-monster-resource-id", "generated-enemy-dragon-01");
  await expect(page.locator(`.battle-acting[data-record-id="${EXTRA_ACTOR_ID}"]`)).toHaveCount(2);
  await expect(page.getByTestId("battle-message-window")).toContainText("Loop 15 Guest");
  await page.getByTestId("actor-command-defend").click();
  await expect(page.locator(`.battle-acting[data-record-id="${EXTRA_ACTOR_ID}"]`)).toHaveCount(2);
  await expect(page.getByTestId("battle-message-window")).toContainText("Loop 15 Guest");
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
  const afterHp = hpFromText(await page.getByTestId("enemy-1").textContent());
  expect(afterHp.current).toBe(beforeHp.current - 5);
  await page.screenshot({ path: artifact("006-runtime-after-nonterminal.png"), fullPage: true });
  await writeJson("007-runtime-nonterminal-state.json", await battleDomState(page));
}

async function runWithoutActionTimesBattle(page: Page, project: unknown): Promise<void> {
  await seedProjectForEditor(page, project);
  await startBattle(page);
  await page.getByTestId("actor-command-defend").click();
  await expect(page.locator(`.battle-acting[data-record-id="${EXTRA_ACTOR_ID}"]`)).toHaveCount(2);
  await page.getByTestId("actor-command-defend").click();
  await expect(page.locator(`.battle-acting[data-record-id="${EXTRA_ACTOR_ID}"]`)).toHaveCount(0);
  await expect(page.getByTestId("battle-message-window")).not.toContainText("Loop 15 Guest");
  await page.screenshot({ path: artifact("007b-runtime-without-action-times.png"), fullPage: true });
  await writeJson("007c-runtime-without-action-times-state.json", await battleDomState(page));
}

async function runForceEscapeBattle(page: Page, project: unknown): Promise<void> {
  await seedProjectForEditor(page, project);
  await startBattle(page);
  await page.screenshot({ path: artifact("008-runtime-before-force-escape.png"), fullPage: true });
  await page.getByTestId("actor-command-defend").click();
  await expect(page.getByTestId("battle-result-panel")).toHaveAttribute("data-battle-result", "escape");
  await page.screenshot({ path: artifact("009-runtime-after-force-escape.png"), fullPage: true });
  await writeJson("010-runtime-force-escape-state.json", await battleDomState(page));
}

async function startBattle(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible();
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-defend")).toBeVisible();
}

async function battleProject(): Promise<Project> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  const hero = project.database.actors.find((record) => record.id === "actor_hero");
  if (!troop) throw new Error("missing troop_slime fixture");
  if (!hero) throw new Error("missing actor_hero fixture");
  project.database.actors.push({ ...structuredClone(hero), id: EXTRA_ACTOR_ID, name: "Loop 15 Guest" });
  project.system.startActorIds = ["actor_hero", EXTRA_ACTOR_ID];
  project.session.partyActorIds = ["actor_hero", EXTRA_ACTOR_ID];
  troop.enemyIds = ["enemy_slime", "enemy_dragon"];
  troop.members = [
    { enemyId: "enemy_slime", x: 120, y: 128, hidden: false },
    { enemyId: "enemy_dragon", x: 196, y: 96, hidden: true },
  ];
  troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
  troop.battleEventPages = [];
  return project;
}

async function battlePageProof(page: Page): Promise<unknown> {
  const project = await exportedProject(page);
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  return troop?.battleEventPages?.[0] ?? null;
}

async function exportedRawProject(page: Page): Promise<unknown> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export json");
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !("project" in parsed)) throw new Error("invalid project export json");
  return parsed.project;
}

function projectWithoutCommand(project: unknown, commandId: string): unknown {
  return projectWithoutCommands(project, [commandId]);
}

function projectWithoutCommands(project: unknown, commandIds: readonly string[]): unknown {
  const clone = structuredClone(project);
  forEachBattlePage(clone, (page) => {
    const commands = page.commands;
    if (!Array.isArray(commands)) return;
    page.commands = commands.filter((command) => !commandIds.some((commandId) => isM2Command(command, commandId)));
  });
  return clone;
}

function forEachBattlePage(project: unknown, visit: (page: JsonRecord) => void): void {
  const database = isRecord(project) ? project.database : undefined;
  const troops = isRecord(database) ? database.troops : undefined;
  if (!Array.isArray(troops)) return;
  for (const troop of troops) {
    const pages = isRecord(troop) ? troop.battleEventPages : undefined;
    if (!Array.isArray(pages)) continue;
    for (const page of pages) {
      if (isRecord(page)) visit(page);
    }
  }
}

function isM2Command(value: unknown, commandId: string): boolean {
  return isRecord(value) && value.kind === "m2Command" && value.commandId === commandId;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function hpFromText(text: string | null): { readonly current: number; readonly max: number } {
  const match = /(\d+)\/(\d+)/.exec(text ?? "");
  if (!match) throw new Error(`missing enemy hp in text: ${text ?? ""}`);
  return { current: Number(match[1]), max: Number(match[2]) };
}

async function battleDomState(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const text = (testid: string) => document.querySelector(`[data-testid='${testid}']`)?.textContent ?? "";
    const attr = (testid: string, name: string) => document.querySelector(`[data-testid='${testid}']`)?.getAttribute(name) ?? null;
    return {
      backdrop: attr("battle-backdrop", "data-backdrop-resource-id"),
      enemy1Text: text("enemy-1"),
      enemy2Text: text("enemy-2"),
      enemy2Resource: attr("enemy-2", "data-monster-resource-id"),
      actingRecordIds: Array.from(document.querySelectorAll(".battle-acting")).map((node) => node.getAttribute("data-record-id")),
      actorCommandAttackVisible: document.querySelector("[data-testid='actor-command-attack']") instanceof HTMLElement,
      result: attr("battle-result-panel", "data-battle-result"),
    };
  });
}

async function resetEvidence(): Promise<void> {
  await rm(EVIDENCE, { recursive: true, force: true });
  await mkdir(EVIDENCE, { recursive: true });
}

async function writeSupportFiles(): Promise<void> {
  await writeJson("manifest.json", {
    loop: 15,
    scope: "M2 PDF battle-only command editor/runtime certification",
    artifacts: [
      "001-editor-all-battle-only-authoring.png",
      "000-editor-multifield-condition-proof.json",
      "002-editor-export.json",
      "003-editor-all-battle-only-after-reload.png",
      "004-editor-roundtrip-after-reload.json",
      "005-runtime-before-nonterminal.png",
      "006-runtime-after-nonterminal.png",
      "007-runtime-nonterminal-state.json",
      "007b-runtime-without-action-times.png",
      "007c-runtime-without-action-times-state.json",
      "008-runtime-before-force-escape.png",
      "009-runtime-after-force-escape.png",
      "010-runtime-force-escape-state.json",
      "cleanup-receipt.json",
      "manual-qa-notepad.md",
      "rm2003-comparison-note.md",
      "verification-receipt.json",
    ],
    criticalGate: { minimumScore: 9, result: "READY_FOR_CRITICAL_GATE" },
  });
  await writeJson("cleanup-receipt.json", { freshEvidenceFolder: true, localStorageClearedBySeedHelper: true });
  await writeJson("verification-receipt.json", {
    scopedPlaywright: "PASS: oprn-m2-battle-only-cert.spec.ts wrote this after all assertions completed",
    evidenceScreenshots: [
      "001-editor-all-battle-only-authoring.png",
      "003-editor-all-battle-only-after-reload.png",
      "006-runtime-after-nonterminal.png",
      "007b-runtime-without-action-times.png",
      "009-runtime-after-force-escape.png",
    ],
  });
  await writeFile(artifact("rm2003-comparison-note.md"), [
    "# Loop 15 RM2003 Scope",
    "Baseline reference: .omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md.",
    "Certifies local M2 battle-only command support for enemy HP change, enemy encounter, battleback change, force escape, and action-times in troop battle events.",
    "This does not certify every RM2003 battle branch, turn-span edge, or every target-selector variant.",
  ].join("\n"), "utf8");
  await writeFile(artifact("manual-qa-notepad.md"), [
    "# Loop 15 Manual QA Notepad",
    "- Inspect editor screenshots for all five battle-only M2 commands.",
    "- Compare runtime with and without Action Times to isolate extra-action behavior.",
    "- Confirm Force Escape shows the escape result panel separately from the non-terminal path.",
  ].join("\n"), "utf8");
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(artifact(name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function artifact(name: string): string {
  return `${EVIDENCE}/${name}`;
}
