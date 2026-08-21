import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import { applyDatabaseChanges, exportedProject, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/evidence/task-10-db-playwright";
const COMMON_EVENTS_TAB = { label: "Common Events", slug: "common-events", testId: "db-tab-common-events" } as const;
const ENEMIES_TAB = { label: "Enemies", slug: "enemies", testId: "db-tab-enemies" } as const;
const SKILLS_TAB = { label: "Skills", slug: "skills", testId: "db-tab-skills" } as const;
const TROOPS_TAB = { label: "Troops", slug: "troops", testId: "db-tab-troops" } as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "task-10-db");
    // 기본(basic) 모드는 classic 툴바(toolbar-database)를 숨긴다 — 이 스펙은 expert 셸 전제.
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
});

test("database reference guard blocks a skill used only by event command references", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 840 });
  await seedProjectFromSupabaseCanonical(page, commandReferencedSkillProject());
  await openDatabase(page);
  await switchDatabaseTab(page, SKILLS_TAB);

  await page.getByRole("button", { name: /Task 10 Command Skill/u }).click();
  await expect(page.getByTestId("db-field-name")).toHaveValue("Task 10 Command Skill");
  await page.getByTestId("db-delete-selected").click();
  // fix(db): 삭제 거부 메시지가 "무엇이 어디서" 참조하는지(커먼 이벤트 이름/id) 포함하도록
  // 풍부화됐다.
  await expect(page.getByTestId("toast")).toContainText("커먼 이벤트 'Task 10 Skill Ref'(ce_task10_skill)이 이 스킬을 사용 중입니다.");
  await expect(page.getByRole("button", { name: /Task 10 Command Skill/u })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/db-reference-blocking-toast.png`, fullPage: true });
});

test("database dirty prompt keeps editing and discards back to the modal-open snapshot", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 840 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, SKILLS_TAB);

  await page.getByTestId("db-field-name").fill("Task 10 Unsaved Skill");
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-dirty-prompt")).toContainText("이 세션에서 바뀐 내용");
  await page.getByTestId("database-dirty-prompt").screenshot({ path: `${EVIDENCE_DIR}/db-unsaved-prompt.png` });
  await page.getByTestId("database-dirty-keep-editing").click();
  await expect(page.getByTestId("database-dirty-prompt")).toHaveCount(0);
  await expect(page.getByTestId("db-field-name")).toHaveValue("Task 10 Unsaved Skill");

  await page.getByTestId("database-footer-ok").click();
  await page.getByTestId("database-dirty-discard").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await openDatabase(page);
  await switchDatabaseTab(page, SKILLS_TAB);
  expect((await exportedProject(page)).database.skills.some((skill) => skill.name === "Task 10 Unsaved Skill")).toBe(false);
});

test("database common events use full command dialogs for nested command editing", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?freshProject=1");
  await openCommonEvents(page);

  await page.getByTestId("event-command-empty-line").dblclick();
  await page.getByTestId("command-picker-add-fork").click();
  await page.getByTestId("event-command-edit-ok").click();
  const nestedText = page.getByTestId("event-command-text").last();
  await nestedText.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-insert").click();
  await page.getByTestId("command-picker-add-setSwitch").click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toContainText("스위치 조작");
  await dialog.getByTestId("event-command-switch-value").selectOption("false");
  await dialog.getByTestId("event-command-edit-ok").click();
  await applyDatabaseChanges(page);

  const commonEvent = (await exportedProject(page)).commonEvents[0];
  const fork = commonEvent?.commands.find((command): command is Extract<Command, { kind: "fork" }> => command.kind === "fork");
  expect(fork?.then.some((command) => command.kind === "setSwitch" && command.value === false)).toBe(true);
  await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/db-common-event-full-edit.png` });
});

test("troop page tabs persist active commands and enemy action switch controls open a picker", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS_TAB);
  await page.getByTestId("db-troop-event-add-page").click();
  await page.getByTestId("db-troop-event-add-page").click();
  await page.getByTestId("db-troop-event-page-tab-2").click();
  await expect(page.getByTestId("db-troop-event-page-tab-2")).toHaveClass(/active/);
  await page.getByTestId("db-troop-event-add-change-enemy-hp").click();
  await expect(page.getByTestId("db-troop-event-command-list").getByTestId("event-command-m2Command")).toContainText("적 HP 변경");
  await applyDatabaseChanges(page);

  await switchDatabaseTab(page, ENEMIES_TAB);
  await page.getByTestId("db-enemy-action-row-0").dblclick();
  const switchPicker = page.getByTestId("db-enemy-action-switch-on-picker");
  await expect(switchPicker).toBeEnabled();
  await expect(switchPicker).toHaveAttribute("aria-label", /스위치 ON 선택/u);
  await switchPicker.click();
  await expect(page.getByTestId("event-record-picker")).toBeVisible();
  await page.getByTestId("event-record-picker-row-1").click();
  await page.getByTestId("event-record-picker-ok").click();
  await page.getByTestId("db-enemy-action-ok").click();

  const project = await exportedProject(page);
  expect(project.database.troops[0]?.battleEventPages?.[1]?.commands[0]).toMatchObject({ kind: "m2Command", commandId: "m2-098-change-enemy-hp" });
  expect(project.database.enemies[0]?.actions[0]?.switchOnAfterAction?.switchId).toBe(project.switches[0]?.id);
  await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/db-troop-enemy-action-controls.png` });
  await writeFile(`${EVIDENCE_DIR}/db-troop-enemy-action-state.json`, `${JSON.stringify({ troop: project.database.troops[0], enemyAction: project.database.enemies[0]?.actions[0] }, null, 2)}\n`, "utf8");
});

async function openCommonEvents(page: Page): Promise<void> {
  await openDatabase(page);
  await switchDatabaseTab(page, COMMON_EVENTS_TAB);
  if (await page.getByTestId("db-common-event-command-list").count() === 0) {
    await page.getByRole("button", { name: /이벤트 추가/u }).click();
  }
  await expect(page.getByTestId("db-common-event-command-list")).toBeVisible();
}

function commandReferencedSkillProject(): Project {
  const project = createBlankProject();
  const baseSkill = project.database.skills[0];
  const actorId = project.database.actors[0]?.id;
  if (!baseSkill || !actorId) throw new Error("missing default skill or actor");
  const skill = { ...baseSkill, id: "skill_task10_command", name: "Task 10 Command Skill" };
  project.database.skills.push(skill);
  project.commonEvents.push({ id: "ce_task10_skill", name: "Task 10 Skill Ref", trigger: "none", commands: [{ kind: "learnSkill", actorId, skillId: skill.id }] });
  return project;
}
