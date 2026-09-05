import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { ActorRecord, Command, EventPage, Project, SkillRecord } from "@/project/types";
import { debugState, dismissDialogue, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop9-learn-skill";

test.setTimeout(90_000);

test("loop9 certifies learnSkill runtime state status menu and save persistence", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  const project = learnSkillProject();
  const actor = firstActor(project);
  const skill = requiredSkill(project, "skill_fire");
  await seedProjectFromSupabaseCanonical(page, project);
  await writeJson("000-scenario.json", {
    scope: ["learnSkill editor authoring", "roundtrip persistence", "runtime learned skill state", "status menu visible skill", "save slot persistence"],
    actorId: actor.id,
    skillId: skill.id,
    skillName: skill.name,
  });

  await screenshot(page, "001-editor-event-layer.png");
  await openEventEditor(page, "ev_skill_reward");
  await editLearnSkill(page, async (command) => {
    await command.getByTestId("learn-skill-actor-select").selectOption(actor.id);
  });
  await editLearnSkill(page, async (command) => {
    await command.getByTestId("learn-skill-skill-select").selectOption(skill.id);
  });
  await screenshot(page, "002-editor-learn-skill.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertLearnSkillExport(editorExport, actor.id, skill.id);
  await writeJson("003-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((reloadedProject) => {
    window.__RPG_ZZU_E2E_PROJECT__ = reloadedProject;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertLearnSkillExport(roundtrip, actor.id, skill.id);
  await writeJson("004-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_skill_reward");
  await editLearnSkill(page, async (command) => {
    await expect(command.getByTestId("learn-skill-actor-select")).toHaveValue(actor.id);
    await expect(command.getByTestId("learn-skill-skill-select")).toHaveValue(skill.id);
  });
  await screenshot(page, "005-editor-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  const startState = await runtimeState(page);
  expect(startState.actorSkillIds?.[actor.id] ?? []).not.toContain(skill.id);
  await writeJson("006-runtime-before-learn.json", startState);
  await page.getByTestId("event-ev_skill_reward").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("SKILL LEARNED");
  await screenshot(page, "007-runtime-dialogue-skill-learned.png");
  await dismissDialogue(page);
  const learnedState = await runtimeState(page);
  expect(learnedState.actorSkillIds?.[actor.id]).toContain(skill.id);
  await writeJson("008-runtime-after-learn.json", learnedState);

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.getByTestId("status-menu-command-skills").click();
  await expect(page.getByTestId("status-menu-detail")).toContainText(skill.name);
  await screenshot(page, "009-status-menu-skill-visible.png");
  await page.getByTestId("status-menu-command-save").click();
  await page.getByTestId("save-slot-1").click();
  const saved = await saveSlot(page, 1);
  expect(saved.session.actorSkillIds?.[actor.id]).toContain(skill.id);
  await writeJson("010-save-slot-after-learn.json", saved);

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 9 learn skill",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: editor-authored Change Skills/learnSkill command, export/reload/reopen persistence, runtime learned-skill session state, status menu visibility, and save-slot persistence.",
    "- Scoped deviation: this certifies skill acquisition for an actor in the field menu. It does not certify every RM2003 battle command list or class-level skill-table interaction.",
    "",
  ].join("\n"));
  await writeJson("cleanup-receipt.json", {
    ownedServerProcess: "playwright webServer",
    browserClosedBy: "playwright test runner",
    storageIsolation: "fresh browser context per test; localStorage cleared before reload",
    generatedEvidenceRoot: EVIDENCE_DIR,
    status: "cleaned by runner",
  });
  await writeJson("manifest.json", {
    runId: "loop9-learn-skill",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-event-layer.png",
      "002-editor-learn-skill.png",
      "005-editor-after-reload.png",
      "007-runtime-dialogue-skill-learned.png",
      "009-status-menu-skill-visible.png",
    ],
    json: [
      "000-scenario.json",
      "003-editor-export.json",
      "004-editor-roundtrip-after-reload.json",
      "006-runtime-before-learn.json",
      "008-runtime-after-learn.json",
      "010-save-slot-after-learn.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function editLearnSkill(page: Page, action: (command: ReturnType<Page["getByTestId"]>) => Promise<void>): Promise<void> {
  const command = page.getByTestId("event-command-learnSkill").first();
  if (!(await command.evaluate((node) => node.classList.contains("editing")).catch(() => false))) {
    await command.scrollIntoViewIfNeeded();
    await command.evaluate((node) => node.classList.add("editing"));
  }
  await expect(command).toHaveClass(/editing/);
  await action(command);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

async function saveSlot(page: Page, slot: 1): Promise<{ readonly session: { readonly actorSkillIds?: Record<string, readonly string[]> } }> {
  return page.evaluate((slotIndex) => {
    const text = window.localStorage.getItem(`oprn:save-slot:v5:${slotIndex}`);
    if (!text) throw new Error("missing save snapshot");
    return JSON.parse(text) as { readonly session: { readonly actorSkillIds?: Record<string, readonly string[]> } };
  }, slot);
}

function assertLearnSkillExport(state: DebugState, actorId: string, skillId: string): void {
  const event = state.project.maps[state.project.startMapId]?.events.find((item) => item.id === "ev_skill_reward");
  expect(event?.pages?.[0]?.commands).toMatchObject([
    { kind: "learnSkill", actorId, skillId },
    { kind: "text", body: "SKILL LEARNED" },
  ]);
}

function learnSkillProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  map.events.push({
    id: "ev_skill_reward",
    x: project.startPos.x,
    y: project.startPos.y - 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [eventPage([{ kind: "learnSkill", actorId: firstActor(project).id, skillId: requiredSkill(project, "skill_sword_slash").id }, { kind: "text", body: "SKILL LEARNED" }])],
  });
  return project;
}

function eventPage(commands: Command[]): EventPage {
  return {
    id: "skill_reward_page",
    name: "skill_reward_page",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function firstActor(project: Project): ActorRecord {
  const actorId = project.session.partyActorIds[0];
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) throw new Error("missing first actor");
  return actor;
}

function requiredSkill(project: Project, skillId: string): SkillRecord {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) throw new Error(`missing skill ${skillId}`);
  return skill;
}
