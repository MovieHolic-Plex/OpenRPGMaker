import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type AuditFinding,
  type FindingStatus,
  BOUNDARY_INPUTS,
  SEEDING_PROVEN,
  VIRTUALIZER_THRESHOLD,
  bandForScore,
  bootDbLane,
  collectConsoleErrors,
  dirtyGuardOracle,
  mutatedProject,
  rawClick,
  recordFinding,
  switchTabAnyMode,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject } from "./oprn-database-helpers";

const SPEC = "_db-audit-utility-system";
const SHOTS_DIR = "output/evidence/db-beginner-audit/shots";
const DIFF_DIR = "output/evidence/db-beginner-audit/diffs";
const FINDINGS_PATH = "output/evidence/db-beginner-audit/findings/_db-audit-utility-system.json";

const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;
const TERMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "terms")!;
const SWITCHES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "switches")!;
const VARIABLES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "variables")!;
const ENEMIES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "enemies")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;

const SYSTEM_SECTIONS = [
  "party",
  "resources",
  "startup",
  "optin",
  "time",
  "typechart",
  "title",
] as const;

const PARTY_SLOT_TEST_IDS = [
  "db-picker-system-start-actor",
  "db-picker-system-start-actor-2",
  "db-picker-system-start-actor-3",
  "db-picker-system-start-actor-4",
] as const;

const DEFAULT_ATTACK_TERM = "공격";
const DEFAULT_SKILL_TERM = "스킬";
const TITLE_BG_ALT = "oprn-title-blue";
const TITLE_MUSIC_FALLBACK = "cc0-bgm-field";

type Severity = 0 | 1 | 2 | 3 | 4;
type BeginnerImpact = 0 | 1 | 2 | 3;

type ProbeResult = {
  readonly probeId: string;
  readonly status: FindingStatus;
  readonly title: string;
};

const probeLog: ProbeResult[] = [];

function ensureArtifactDirs(): void {
  mkdirSync(SHOTS_DIR, { recursive: true });
  mkdirSync(DIFF_DIR, { recursive: true });
  mkdirSync(path.dirname(FINDINGS_PATH), { recursive: true });
}

function resetFindingsFile(): void {
  ensureArtifactDirs();
  writeFileSync(FINDINGS_PATH, "[]\n", "utf8");
}

function emit(finding: Omit<AuditFinding, "spec" | "score" | "band">): void {
  const score = finding.S * finding.B;
  recordFinding({
    spec: SPEC,
    ...finding,
    score,
    band: bandForScore(score),
  });
  probeLog.push({ probeId: finding.probeId, status: finding.status, title: finding.title });
}

function emitClean(probeId: string, tabs: readonly string[], title: string, repro: readonly string[], evidence: readonly string[] = []): void {
  emit({
    id: `${probeId}-clean`,
    probeId,
    tabs: [...tabs],
    S: 0,
    B: 0,
    title,
    repro: [...repro],
    evidence: [...evidence],
    status: "clean",
  });
}

function emitDefect(opts: {
  readonly probeId: string;
  readonly id?: string;
  readonly tabs: readonly string[];
  readonly S: Severity;
  readonly B: BeginnerImpact;
  readonly title: string;
  readonly repro: readonly string[];
  readonly evidence: readonly string[];
  readonly status?: FindingStatus;
}): void {
  emit({
    id: opts.id ?? `${opts.probeId}-defect`,
    probeId: opts.probeId,
    tabs: [...opts.tabs],
    S: opts.S,
    B: opts.B,
    title: opts.title,
    repro: [...opts.repro],
    evidence: [...opts.evidence],
    status: opts.status ?? "confirmed",
  });
}

async function shot(page: Page, name: string): Promise<string> {
  ensureArtifactDirs();
  const rel = `${SHOTS_DIR}/${SPEC}-${name}.png`;
  await page.screenshot({ path: rel, fullPage: true }).catch(() => undefined);
  return rel;
}

function writeJson(rel: string, value: unknown): string {
  ensureArtifactDirs();
  writeFileSync(rel, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return rel;
}

async function reopenDatabase(page: Page): Promise<void> {
  if (page.isClosed()) return;
  if (await page.getByTestId("database-modal").isVisible().catch(() => false)) return;
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByTestId("menu-tools").click();
    await page.getByTestId("menu-tools-database").click();
  }
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

/** Prefer a direct tab click so a hung beginner-nav lookup cannot abort an expert probe. */
async function ensureTab(page: Page, tab: (typeof DATABASE_TAB_SPECS)[number]): Promise<void> {
  await reopenDatabase(page);
  const button = page.getByTestId(tab.testId);
  if ((await button.count()) > 0) {
    await button.click({ force: true });
    await expect(button).toHaveClass(/active/);
    return;
  }
  await switchTabAnyMode(page, tab);
}

async function dismissPromptIfAny(page: Page, decision: "discard" | "keep" = "discard"): Promise<boolean> {
  const prompt = page.getByTestId("database-dirty-prompt");
  if (!(await prompt.isVisible().catch(() => false))) return false;
  const testId = decision === "discard" ? "database-dirty-discard" : "database-dirty-keep-editing";
  await page.getByTestId(testId).click();
  await expect(prompt).toBeHidden();
  return true;
}

async function closeModalClean(page: Page): Promise<void> {
  if (page.isClosed()) return;
  if (!(await page.getByTestId("database-modal").isVisible().catch(() => false))) return;
  await page.keyboard.press("Escape");
  if (await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false)) {
    await page.getByTestId("database-dirty-discard").click().catch(() => undefined);
  }
  await page.getByTestId("database-modal").waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
}

async function waitExport<T>(page: Page, read: (project: Awaited<ReturnType<typeof exportedProject>>) => T, predicate: (value: T) => boolean): Promise<T> {
  let last: T | undefined;
  await expect.poll(async () => {
    last = read(await exportedProject(page));
    return predicate(last);
  }, { timeout: 5_000 }).toBe(true);
  return last as T;
}

function uniqueIds(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

function partySlotsOf(project: Awaited<ReturnType<typeof exportedProject>>): string[] {
  return [...(project.system.startActorIds ?? [])];
}

function titleSnapshot(project: Awaited<ReturnType<typeof exportedProject>>): {
  titleResourceId: string | undefined;
  backgroundResourceId: string | undefined;
} {
  return {
    titleResourceId: project.system.titleResourceId,
    backgroundResourceId: project.system.titleScreen?.backgroundResourceId,
  };
}

function recordConsole(errors: readonly string[], probeId: string, tabs: readonly string[]): void {
  if (errors.length === 0) return;
  emitDefect({
    probeId,
    tabs,
    S: 1,
    B: 1,
    title: `console errors during ${probeId}: ${errors[0]}`,
    repro: ["bootDbLane", probeId, "collectConsoleErrors"],
    evidence: [writeJson(`${DIFF_DIR}/${SPEC}-${probeId}.json`, errors)],
  });
}

async function runProbe(probeId: string, tabs: readonly string[], body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitDefect({
      probeId,
      id: `${probeId}-aborted`,
      tabs,
      S: 1,
      B: 1,
      title: `${probeId} aborted: ${message.slice(0, 180)}`,
      repro: [`probe ${probeId} threw before a contract judgment`],
      evidence: [],
      status: "unconfirmed-vqa",
    });
  }
}

test.describe("audit — utility tabs + system workbench", () => {
  test.describe.configure({ timeout: 180_000 });

  test("expert lane X2 + D1-D8", async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);
    resetFindingsFile();
    ensureArtifactDirs();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await runProbe("X2", ["system"], async () => {
      await probeX2(page);
    });
    await reopenDatabase(page);
    await runProbe("D1", ["switches"], async () => {
      await probeD1(page);
    });
    await runProbe("D2", ["switches"], async () => {
      await probeD2(page);
    });
    await runProbe("D3", ["switches"], async () => {
      await probeD3(page);
    });
    await runProbe("D8", ["switches"], async () => {
      await probeD8(page);
    });
    await runProbe("D6", ["switches", "variables"], async () => {
      await probeD6(page);
    });
    await runProbe("D4", ["terms"], async () => {
      await probeD4(page);
    });
    await runProbe("D5", ["terms"], async () => {
      await probeD5(page);
    });
    recordConsole(errors, "console-utility", ["switches", "variables", "terms"]);
    await closeModalClean(page);
  });

  test("expert lane E1-E10", async ({ page }) => {
    test.slow();
    test.setTimeout(240_000);
    ensureArtifactDirs();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await runProbe("E1", ["system"], async () => {
      await probeE1(page);
    });
    await runProbe("E2", ["system"], async () => {
      await probeE2(page, "expert");
    });
    await runProbe("E3", ["system"], async () => {
      await probeE3(page, "expert");
    });
    await runProbe("E4", ["system"], async () => {
      await probeE4(page);
    });
    await runProbe("E5", ["system"], async () => {
      await probeE5(page);
    });
    await runProbe("E6", ["system"], async () => {
      await probeE6(page);
    });
    await runProbe("E7", ["system"], async () => {
      await probeE7(page);
    });
    recordConsole(errors, "console-system", ["system"]);
  });

  test("expert lane E8 type cap", async ({ page }) => {
    test.slow();
    test.setTimeout(90_000);
    ensureArtifactDirs();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await runProbe("E8", ["system"], async () => {
      await probeE8(page);
    });
    recordConsole(errors, "console-e8", ["system"]);
    await closeModalClean(page);
  });

  test("expert lane E9-E10", async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);
    ensureArtifactDirs();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await runProbe("E9", ["system"], async () => {
      await probeE9(page);
    });
    await runProbe("E10", ["system"], async () => {
      await probeE10(page);
    });
    recordConsole(errors, "console-e9e10", ["system"]);
    await closeModalClean(page);
  });

  test("expert lane D7 X6 X13 X3", async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);
    ensureArtifactDirs();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await runProbe("D7", ["enemies", "switches"], async () => {
      await probeD7(page);
    });
    await runProbe("X6", ["items"], async () => {
      await probeX6(page);
    });
    await reopenDatabase(page);
    await runProbe("X13", ["items"], async () => {
      await probeX13(page);
    });
    await runProbe("X3", ["system"], async () => {
      await probeX3(page);
    });
    recordConsole(errors, "console-chrome", ["items", "system", "enemies"]);
    await closeModalClean(page);
  });

  test("beginner lane E2 party isolation + E3 title resource", async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);
    ensureArtifactDirs();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner" });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await runProbe("E2-beginner", ["system"], async () => {
      await probeE2(page, "beginner");
    });
    await runProbe("E3-beginner", ["system"], async () => {
      await probeE3(page, "beginner");
    });

    if (errors.length > 0) {
      emitDefect({
        probeId: "console-beginner",
        tabs: ["system"],
        S: 1,
        B: 1,
        title: `console errors during beginner E2/E3: ${errors[0]}`,
        repro: ["bootDbLane beginner", "E2", "E3"],
        evidence: [writeJson(`${DIFF_DIR}/${SPEC}-console-beginner.json`, errors)],
      });
    }

    await closeModalClean(page);
    await page.evaluate(() => {
      for (const audio of Array.from(document.querySelectorAll("audio"))) {
        audio.pause();
        audio.src = "";
      }
    });
  });
});

async function probeX2(page: Page): Promise<void> {
  const repro = [
    "bootDbLane expert",
    "touch nothing",
    "close via Escape / backdrop / X / footer-ok",
  ];
  const paths = ["escape", "backdrop", "x", "cancel"] as const;
  const falseDirty: string[] = [];
  for (const closePath of paths) {
    await reopenDatabase(page);
    const result = await dirtyGuardOracle(page, closePath);
    if (result.promptShown) {
      falseDirty.push(closePath);
      await page.getByTestId("database-dirty-discard").click().catch(() => undefined);
    }
    if (await page.getByTestId("database-modal").isVisible().catch(() => false)) {
      await page.getByTestId("database-modal-close").click().catch(() => undefined);
      await dismissPromptIfAny(page);
    }
  }
  const evidence = [await shot(page, "x2-false-dirty")];
  if (falseDirty.length > 0) {
    emitDefect({
      probeId: "X2",
      tabs: ["system"],
      S: 1,
      B: 2,
      title: `false-dirty-on-open via ${falseDirty.join(",")}`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("X2", ["system"], "clean open: no dirty prompt on any of 4 close paths", repro, evidence);
}

async function probeD1(page: Page): Promise<void> {
  await ensureTab(page, SWITCHES_TAB);
  const before = await exportedProject(page);
  const blanks = before.switches.filter((entry) => entry.name.trim().length === 0);
  const beforeIds = before.switches.map((entry) => entry.id);
  const nextBlank = blanks[0];
  const repro = [
    "open switches",
    `blank slots already present (${blanks.length})`,
    "click db-add-switch (+ 추가)",
    "exportedProject: reused blank id, no length growth, unique ids",
  ];
  await page.getByTestId("db-add-switch").click();
  const after = await waitExport(
    page,
    (project) => project.switches,
    (switches) => switches.some((entry) => entry.name === "새 스위치") || switches.length !== before.switches.length,
  );
  const afterIds = after.map((entry) => entry.id);
  const namedNew = after.filter((entry) => entry.name === "새 스위치");
  const reused = nextBlank ? after.find((entry) => entry.id === nextBlank.id)?.name === "새 스위치" : false;
  const grew = after.length > before.switches.length;
  const dup = !uniqueIds(afterIds);
  const evidence = [
    await shot(page, "d1-blank-reuse"),
    writeJson(`${DIFF_DIR}/${SPEC}-d1.json`, {
      beforeCount: before.switches.length,
      afterCount: after.length,
      blankCount: blanks.length,
      nextBlankId: nextBlank?.id ?? null,
      reused,
      grew,
      duplicateIds: dup,
      namedNew: namedNew.map((entry) => entry.id),
    }),
  ];
  if (!nextBlank) {
    emitDefect({
      probeId: "D1",
      tabs: ["switches"],
      S: 0,
      B: 0,
      title: "no blank switch slots to reuse",
      repro,
      evidence,
      status: "seeding-limited",
    });
    return;
  }
  if (!reused || grew || dup) {
    emitDefect({
      probeId: "D1",
      tabs: ["switches"],
      S: grew || dup ? 3 : 2,
      B: 2,
      title: `+ 추가 did not reuse blank slot (reused=${reused} grew=${grew} dup=${dup})`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("D1", ["switches"], "blank-slot reuse: + 추가 filled next empty id without appending", repro, evidence);
  void beforeIds;
}

async function probeD2(page: Page): Promise<void> {
  await ensureTab(page, SWITCHES_TAB);
  const repro = [
    "name a switch",
    "blank the name again",
    "row hides (unnamed-auto-slot)",
    "enemy-action switch picker still shows a resolvable label, not a bare id",
  ];
  const project = await exportedProject(page);
  const named = project.switches.find((entry) => entry.name.trim().length > 0);
  if (!named) {
    emitDefect({
      probeId: "D2",
      tabs: ["switches"],
      S: 0,
      B: 0,
      title: "no named switch to blank",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  const row = page.locator(`.db-utility-row[data-record-id='${named.id}']`);
  await row.click();
  const nameInput = page.getByTestId("db-utility-selected-name");
  await expect(nameInput).toBeVisible();
  const original = named.name;
  await nameInput.fill("감사참조스위치");
  await waitExport(page, (next) => next.switches.find((entry) => entry.id === named.id)?.name, (value) => value === "감사참조스위치");

  if (SEEDING_PROVEN) {
    await mutatedProject(page, (draft, payload) => {
      const enemies = (draft.database as { enemies?: { actions?: { switchOnAfterAction?: { enabled: boolean; switchId?: string } }[] }[] } | undefined)?.enemies;
      const first = enemies?.[0];
      if (!first) return;
      first.actions = first.actions ?? [];
      if (!first.actions[0]) first.actions[0] = { switchOnAfterAction: { enabled: true, switchId: payload } };
      else first.actions[0].switchOnAfterAction = { enabled: true, switchId: payload };
    }, named.id);
  }

  await nameInput.fill("");
  await waitExport(page, (next) => next.switches.find((entry) => entry.id === named.id)?.name ?? "", (value) => value.trim().length === 0);
  // The named-list filter only re-applies on a full tab rerender (search / tab switch),
  // not on each keystroke. Force that contract surface before judging hide.
  await ensureTab(page, VARIABLES_TAB);
  await ensureTab(page, SWITCHES_TAB);
  const hidden = await page.locator(`.db-utility-row[data-record-id='${named.id}']`).count() === 0;
  const visibleNamed = await page.locator(`.db-utility-row[data-record-id='${named.id}']`).count();

  await ensureTab(page, ENEMIES_TAB);
  await page.getByTestId("db-enemy-action-row-0").press("Enter");
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeVisible();
  const optionLabels = await page.getByTestId("db-enemy-action-switch-on-id").locator("option").allTextContents();
  await page.getByTestId("db-enemy-action-cancel").click();
  const bareId = optionLabels.some((label) => label.trim() === named.id || /^sw_\d+$/.test(label.trim()));
  const resolvable = optionLabels.some((label) => label.includes("(이름 없음)") || label.includes(named.id) && label.includes(":"));

  await ensureTab(page, SWITCHES_TAB);
  const restoreRow = page.locator(".db-utility-row").first();
  if (await restoreRow.isVisible().catch(() => false)) {
    await restoreRow.click();
  }
  // Restore the name so later list probes still have a labeled row.
  if (SEEDING_PROVEN) {
    await mutatedProject(page, (draft, payload) => {
      const record = (draft.switches as { id: string; name: string }[] | undefined)?.find((entry) => entry.id === payload.id);
      if (record) record.name = payload.name;
    }, { id: named.id, name: original });
    await ensureTab(page, VARIABLES_TAB);
    await ensureTab(page, SWITCHES_TAB);
  }

  const evidence = [
    await shot(page, "d2-unnamed-hide"),
    writeJson(`${DIFF_DIR}/${SPEC}-d2.json`, { id: named.id, hidden, visibleNamed, optionLabels, bareId, resolvable }),
  ];
  if (!hidden && visibleNamed > 0) {
    emitDefect({
      probeId: "D2",
      tabs: ["switches"],
      S: 1,
      B: 1,
      title: "blanked switch name stayed visible in the named list",
      repro,
      evidence,
    });
    return;
  }
  if (bareId && !resolvable) {
    emitDefect({
      probeId: "D2",
      tabs: ["switches", "enemies"],
      S: 2,
      B: 3,
      title: "blanked switch reference shows a bare numeric/id label",
      repro,
      evidence,
    });
    return;
  }
  emitClean("D2", ["switches"], "unnamed row hides; references stay labeled", repro, evidence);
}

async function probeD3(page: Page): Promise<void> {
  await ensureTab(page, SWITCHES_TAB);
  const repro = [
    "open switches",
    "seed a story flag if the section is empty",
    "attempt to edit a 스토리 플래그 row",
    "expect disabled inputs with a reason, or a purely read-only display",
  ];
  if (SEEDING_PROVEN) {
    const project = await exportedProject(page);
    const target = project.switches.find((entry) => entry.name.trim().length > 0) ?? project.switches[0];
    if (target) {
      await mutatedProject(page, (draft, payload) => {
        draft.storyFlags = [
          {
            id: "audit-story-flag",
            kind: "switch",
            targetId: payload,
            description: "감사 스토리 플래그",
          },
        ];
      }, target.id);
      await ensureTab(page, VARIABLES_TAB);
      await ensureTab(page, SWITCHES_TAB);
    }
  }
  const heading = page.getByText("스토리 플래그 (읽기 전용)");
  await expect(heading).toBeVisible();
  const section = page.locator(".db-story-flag-list");
  const inputs = section.locator("input, textarea, select, [contenteditable='true']");
  const inputCount = await inputs.count();
  const enabled: string[] = [];
  for (let index = 0; index < inputCount; index += 1) {
    const handle = inputs.nth(index);
    if (await handle.isEnabled().catch(() => false)) {
      enabled.push(await handle.evaluate((node) => (node as HTMLElement).dataset.testid || node.tagName));
    }
  }
  const evidence = [await shot(page, "d3-story-flag")];
  if (enabled.length > 0) {
    emitDefect({
      probeId: "D3",
      tabs: ["switches"],
      S: 3,
      B: 2,
      title: `story-flag row is editable (${enabled.join(",")})`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("D3", ["switches"], "story-flag section is read-only (no enabled inputs)", repro, evidence);
}

async function probeD8(page: Page): Promise<void> {
  await ensureTab(page, SWITCHES_TAB);
  const repro = [
    "select a named switch",
    "type a new name without blur",
    "immediately click the next named row",
    "exportedProject keeps both names",
  ];
  const rows = page.locator(".db-utility-row");
  const rowCount = await rows.count();
  if (rowCount < 2) {
    await page.getByTestId("db-add-switch").click();
  }
  const first = page.locator(".db-utility-row").nth(0);
  const second = page.locator(".db-utility-row").nth(1);
  await first.click();
  const firstId = await first.getAttribute("data-record-id");
  const secondId = await second.getAttribute("data-record-id");
  const nameInput = page.getByTestId("db-utility-selected-name");
  await nameInput.click();
  await page.keyboard.press("Control+a");
  await nameInput.pressSequentially("빠른이름A", { delay: 15 });
  await rawClick(page, second);
  const names = await waitExport(
    page,
    (project) => ({
      first: project.switches.find((entry) => entry.id === firstId)?.name,
      second: project.switches.find((entry) => entry.id === secondId)?.name,
    }),
    () => true,
  );
  const evidence = [
    await shot(page, "d8-rapid-rename"),
    writeJson(`${DIFF_DIR}/${SPEC}-d8.json`, { firstId, secondId, names }),
  ];
  if (names.first !== "빠른이름A") {
    emitDefect({
      probeId: "D8",
      tabs: ["switches"],
      S: 4,
      B: 3,
      title: "rapid rename without blur lost the in-flight name",
      repro,
      evidence,
    });
    return;
  }
  emitClean("D8", ["switches"], "rapid rename committed without blur", repro, evidence);
}

async function probeD6(page: Page): Promise<void> {
  const repro = [
    "open switches (1000 slots already > VIRTUALIZER_THRESHOLD 80)",
    "scroll the list and search a named row",
    "rename and confirm scrollTop does not jump",
    "repeat search reachability on variables",
  ];
  await ensureTab(page, SWITCHES_TAB);
  const project = await exportedProject(page);
  const namedSwitches = project.switches.filter((entry) => entry.name.trim().length > 0);
  const list = page.locator(".db-utility-list").first();
  await expect(list).toBeVisible();
  const beforeScroll = await list.evaluate((node) => node.scrollTop);
  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const afterScroll = await list.evaluate((node) => ({ top: node.scrollTop, height: node.scrollHeight, client: node.clientHeight }));
  const search = page.locator(".db-search input").first();
  const target = namedSwitches[0];
  let reachable = namedSwitches.length === 0;
  if (target) {
    await search.fill(target.name);
    // Timing contract under attack: utility search applies on an 80ms debounce
    // (databaseUtilityViews.searchInput). Poll the filtered row instead of sleeping.
    await expect.poll(async () => page.locator(`.db-utility-row[data-record-id='${target.id}']`).count(), { timeout: 3_000 }).toBeGreaterThan(0);
    reachable = (await page.locator(`.db-utility-row[data-record-id='${target.id}']`).count()) > 0;
    await search.fill("");
    await expect.poll(async () => page.locator(".db-utility-row").count(), { timeout: 3_000 }).toBeGreaterThan(0);
  }
  if (target) {
    await page.locator(`.db-utility-row[data-record-id='${target.id}']`).click();
    await list.evaluate((node) => {
      node.scrollTop = 40;
    });
    const pinned = await list.evaluate((node) => node.scrollTop);
    const nameInput = page.getByTestId("db-utility-selected-name");
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(`${target.name}·`);
      await waitExport(page, (next) => next.switches.find((entry) => entry.id === target.id)?.name, (value) => value === `${target.name}·`);
    }
    const jumped = await list.evaluate((node, expected) => Math.abs(node.scrollTop - expected) > 8, pinned);
    await search.fill("");
    const virtual = await page.locator(".db-virtual-spacer").count();
    const evidence = [
      await shot(page, "d6-switches-scale"),
      writeJson(`${DIFF_DIR}/${SPEC}-d6.json`, {
        switchCount: project.switches.length,
        named: namedSwitches.length,
        threshold: VIRTUALIZER_THRESHOLD,
        beforeScroll,
        afterScroll,
        reachable,
        jumped,
        virtualizerSpacers: virtual,
        seedingProven: SEEDING_PROVEN,
      }),
    ];
    await ensureTab(page, VARIABLES_TAB);
    const vars = (await exportedProject(page)).variables;
    const namedVars = vars.filter((entry) => entry.name.trim().length > 0);
    const varSearch = page.locator(".db-search input").first();
    let varReachable = namedVars.length === 0;
    if (namedVars[0]) {
      await varSearch.fill(namedVars[0].name);
      await expect.poll(async () => page.locator(`.db-utility-row[data-record-id='${namedVars[0].id}']`).count(), { timeout: 3_000 }).toBeGreaterThan(0);
      varReachable = (await page.locator(`.db-utility-row[data-record-id='${namedVars[0].id}']`).count()) > 0;
      await varSearch.fill("");
    }
    if (!reachable || !varReachable) {
      emitDefect({
        probeId: "D6",
        tabs: ["switches", "variables"],
        S: 2,
        B: 2,
        title: "named utility row not reachable by scroll/search at 1000-slot scale",
        repro,
        evidence,
      });
      return;
    }
    if (jumped) {
      emitDefect({
        probeId: "D6",
        tabs: ["switches"],
        S: 1,
        B: 2,
        title: "renaming a switch jumped the list scroll position",
        repro,
        evidence,
      });
      return;
    }
    emitClean("D6", ["switches", "variables"], "1000-slot lists remain searchable; rename did not jump scroll", repro, evidence);
    return;
  }
  emitDefect({
    probeId: "D6",
    tabs: ["switches"],
    S: 0,
    B: 0,
    title: "no named switches to search at scale",
    repro,
    evidence: [await shot(page, "d6-empty")],
    status: "seeding-limited",
  });
}

async function probeD4(page: Page): Promise<void> {
  await ensureTab(page, TERMS_TAB);
  const repro = [
    "set db-field-skill-term",
    "clear the field",
    "exportedProject.meta.terms.skill is deleted (not an empty string)",
    "placeholder shows defaultTerms().skill",
  ];
  const skill = page.getByTestId("db-field-skill-term");
  await skill.fill("필살기감사");
  await waitExport(page, (project) => project.meta.terms.skill, (value) => value === "필살기감사");
  await skill.fill("");
  const after = await waitExport(
    page,
    (project) => project.meta.terms.skill,
    (value) => value === undefined || value === "",
  );
  const placeholder = await skill.getAttribute("placeholder");
  const evidence = [
    await shot(page, "d4-terms-clear"),
    writeJson(`${DIFF_DIR}/${SPEC}-d4.json`, { skill: after, placeholder }),
  ];
  if (after === "") {
    emitDefect({
      probeId: "D4",
      tabs: ["terms"],
      S: 3,
      B: 3,
      title: "clearing a term persisted an empty string instead of deleting the override",
      repro,
      evidence,
    });
    return;
  }
  if (placeholder !== DEFAULT_SKILL_TERM) {
    emitDefect({
      probeId: "D4",
      tabs: ["terms"],
      S: 1,
      B: 2,
      title: `cleared term placeholder was ${JSON.stringify(placeholder)}, expected ${DEFAULT_SKILL_TERM}`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("D4", ["terms"], "clearing a term deletes the override; defaultTerms placeholder remains", repro, evidence);
}

async function probeD5(page: Page): Promise<void> {
  await ensureTab(page, TERMS_TAB);
  const repro = [
    "fill 공격 with BOUNDARY_INPUTS.longCjk",
    "exportedProject.meta.terms.attack exact match",
    "fill 공격 with BOUNDARY_INPUTS.emojiZwj",
    "exportedProject exact match",
  ];
  const attack = page.getByLabel("공격");
  await attack.fill(BOUNDARY_INPUTS.longCjk);
  const cjk = await waitExport(page, (project) => project.meta.terms.attack, (value) => value === BOUNDARY_INPUTS.longCjk || value !== undefined);
  await attack.fill(BOUNDARY_INPUTS.emojiZwj);
  const emoji = await waitExport(page, (project) => project.meta.terms.attack, (value) => value === BOUNDARY_INPUTS.emojiZwj || value !== cjk);
  const evidence = [
    await shot(page, "d5-terms-boundary"),
    writeJson(`${DIFF_DIR}/${SPEC}-d5.json`, {
      expectedCjk: BOUNDARY_INPUTS.longCjk,
      gotCjk: cjk,
      expectedEmoji: BOUNDARY_INPUTS.emojiZwj,
      gotEmoji: emoji,
    }),
  ];
  await attack.fill(DEFAULT_ATTACK_TERM);
  if (cjk !== BOUNDARY_INPUTS.longCjk || emoji !== BOUNDARY_INPUTS.emojiZwj) {
    emitDefect({
      probeId: "D5",
      tabs: ["terms"],
      S: 3,
      B: 2,
      title: "CJK/emoji battle term did not round-trip exactly",
      repro,
      evidence,
    });
    return;
  }
  emitClean("D5", ["terms"], "100-char CJK and emoji+ZWJ battle terms round-trip", repro, evidence);
}

async function probeD7(page: Page): Promise<void> {
  const repro = [
    "mutatedProject: switches = []",
    "open enemies action dialog",
    "switch picker disabled with title/ARIA reason",
  ];
  if (!SEEDING_PROVEN) {
    emitDefect({
      probeId: "D7",
      tabs: ["enemies"],
      S: 0,
      B: 0,
      title: "cannot empty switches without proven seeding",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await mutatedProject(page, (draft) => {
    draft.switches = [];
  });
  await ensureTab(page, ENEMIES_TAB);
  await page.getByTestId("db-enemy-action-row-0").press("Enter");
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeVisible();
  const picker = page.getByTestId("db-enemy-action-switch-on-picker");
  const disabled = await picker.isDisabled();
  const title = (await picker.getAttribute("title")) ?? "";
  const aria = (await picker.getAttribute("aria-label")) ?? "";
  const ariaDisabled = (await picker.getAttribute("aria-disabled")) ?? "";
  const evidence = [
    await shot(page, "d7-zero-switch-picker"),
    writeJson(`${DIFF_DIR}/${SPEC}-d7.json`, { disabled, title, aria, ariaDisabled }),
  ];
  await page.getByTestId("db-enemy-action-cancel").click().catch(() => undefined);
  if (!disabled) {
    emitDefect({
      probeId: "D7",
      tabs: ["enemies"],
      S: 2,
      B: 2,
      title: "zero-switch picker stayed enabled (dead button)",
      repro,
      evidence,
    });
    return;
  }
  if (!title && !aria) {
    emitDefect({
      probeId: "D7",
      tabs: ["enemies"],
      S: 1,
      B: 2,
      title: "zero-switch picker is disabled but has no title/ARIA reason",
      repro,
      evidence,
    });
    return;
  }
  emitClean("D7", ["enemies"], "zero-switch picker disabled with a stated reason", repro, evidence);
}

async function probeE1(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  const repro = [
    "open system title section",
    "type an in-flight title without blur",
    "click all 7 db-system-nav-* sections",
    "return to title: the unblurred value survives (visibility-only nav)",
  ];
  await page.getByTestId("db-system-nav-title").click();
  const title = page.getByTestId("db-field-title-screen-title");
  await title.click();
  await page.keyboard.press("Control+a");
  const pending = "비행중섹션전환";
  await title.pressSequentially(pending, { delay: 10 });
  for (const slug of SYSTEM_SECTIONS) {
    await page.getByTestId(`db-system-nav-${slug}`).click();
    await expect(page.getByTestId(`db-system-nav-${slug}`)).toHaveClass(/active/);
  }
  await page.getByTestId("db-system-nav-title").click();
  const value = await title.inputValue();
  const evidence = [
    await shot(page, "e1-section-nav"),
    writeJson(`${DIFF_DIR}/${SPEC}-e1.json`, { pending, value }),
  ];
  if (value !== pending) {
    const truncatedToFirst = value === pending.slice(0, 1);
    emitDefect({
      probeId: "E1",
      tabs: ["system"],
      S: 3,
      B: 3,
      title: truncatedToFirst
        ? `in-flight title edit truncated to its first character across section nav (${JSON.stringify(pending)} -> ${JSON.stringify(value)})`
        : `in-flight title edit did not survive 7-section navigation (${JSON.stringify(pending)} -> ${JSON.stringify(value)})`,
      repro: [
        ...repro,
        `observed input value after nav: ${JSON.stringify(value)}`,
      ],
      evidence,
    });
    return;
  }
  emitClean("E1", ["system"], "section nav is visibility-only; in-flight edit survived", repro, evidence);
}

async function probeE2(page: Page, lane: "expert" | "beginner"): Promise<void> {
  const probeId = lane === "beginner" ? "E2-beginner" : "E2";
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-party").click();
  const firstMisread = lane === "beginner"
    ? "first-pass misread: beginner before-snapshot was 3 slots [actor_hero,actor_guardian,actor_mage] and after grew to 4 by appending actor_scout — that was an incomplete fill, not a slot mutation"
    : "precondition: startActorIds.length === 4 verified before the slot-2 edit";
  const reproBase = [
    `bootDbLane ${lane}`,
    "fill all 4 startActorIds slots via the four party pickers",
    "assert exportedProject.system.startActorIds.length === 4 BEFORE editing slot 2",
    "change ONLY slot 2",
    "exportedProject: other three untouched",
    firstMisread,
  ];
  const actors = (await exportedProject(page)).database.actors.map((actor) => (actor as { id?: string }).id).filter((id): id is string => typeof id === "string" && id.length > 0);
  if (actors.length < 5) {
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 0,
      B: 0,
      title: `not enough actors to fill 4 slots and change slot 2 (${actors.length})`,
      repro: reproBase,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  const fill = [actors[0], actors[1], actors[2], actors[3]];
  for (let index = 0; index < 4; index += 1) {
    await page.getByTestId(PARTY_SLOT_TEST_IDS[index]).selectOption(fill[index]);
  }
  let before: string[] = [];
  try {
    before = await waitExport(
      page,
      (project) => partySlotsOf(project),
      (slots) => slots.length === 4 && fill.every((id, index) => slots[index] === id),
    );
  } catch {
    before = partySlotsOf(await exportedProject(page));
    const beforePath = writeJson(`${DIFF_DIR}/${SPEC}-${probeId}-before.json`, { startActorIds: before, fill });
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 2,
      B: 2,
      title: `${lane} lane: 4th start-party slot could not be filled (observed ${JSON.stringify(before)})`,
      repro: [...reproBase, `precondition startActorIds=${JSON.stringify(before)} (wanted ${JSON.stringify(fill)})`],
      evidence: [beforePath, await shot(page, `${probeId}-unfilled`)],
    });
    return;
  }
  const beforePath = writeJson(`${DIFF_DIR}/${SPEC}-${probeId}-before.json`, { startActorIds: before });
  const replacement = actors[4];
  await page.getByTestId(PARTY_SLOT_TEST_IDS[1]).selectOption(replacement);
  const after = await waitExport(page, (project) => partySlotsOf(project), (slots) => slots[1] === replacement || slots.join("|") !== before.join("|"));
  const afterPath = writeJson(`${DIFF_DIR}/${SPEC}-${probeId}-after.json`, { startActorIds: after });
  const evidence = [beforePath, afterPath, await shot(page, `${probeId}-party`)];
  const repro = [...reproBase, `precondition startActorIds=${JSON.stringify(before)}`, `after startActorIds=${JSON.stringify(after)}`];
  const collapsed = after.length < before.length || after.length === 1;
  const othersIntact = after[0] === before[0] && after[2] === before[2] && after[3] === before[3];
  if (collapsed) {
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 4,
      B: 3,
      title: `start party collapsed after slot-2 edit (${before.length} -> ${after.length})`,
      repro,
      evidence,
    });
    return;
  }
  if (!othersIntact || after[1] !== replacement) {
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 4,
      B: 3,
      title: "changing startActorIds slot 2 mutated another slot",
      repro,
      evidence,
    });
    return;
  }
  emitClean(probeId, ["system"], "slot-2 edit left the other three startActorIds untouched", repro, evidence);
}

async function probeE3(page: Page, lane: "expert" | "beginner"): Promise<void> {
  const probeId = lane === "beginner" ? "E3-beginner" : "E3";
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-title").click();
  const repro = [
    `bootDbLane ${lane}`,
    "set db-field-title-screen-background",
    "exportedProject writes only titleScreen.backgroundResourceId",
    "system.titleResourceId is not cleared",
  ];
  const before = titleSnapshot(await exportedProject(page));
  const beforePath = writeJson(`${DIFF_DIR}/${SPEC}-${probeId}-before.json`, before);
  repro.push(`precondition titleResourceId=${JSON.stringify(before.titleResourceId)} backgroundResourceId=${JSON.stringify(before.backgroundResourceId)}`);
  const nextBg = before.backgroundResourceId === TITLE_BG_ALT ? "oprn-title-field" : TITLE_BG_ALT;
  const input = page.getByTestId("db-field-title-screen-background");
  await input.fill(nextBg);
  await input.blur();
  const after = await waitExport(
    page,
    (project) => titleSnapshot(project),
    (snap) => snap.backgroundResourceId === nextBg || snap.titleResourceId !== before.titleResourceId,
  );
  const afterPath = writeJson(`${DIFF_DIR}/${SPEC}-${probeId}-after.json`, after);
  repro.push(`after titleResourceId=${JSON.stringify(after.titleResourceId)} backgroundResourceId=${JSON.stringify(after.backgroundResourceId)}`);
  const evidence = [beforePath, afterPath, await shot(page, `${probeId}-title-bg`)];
  const titleCleared = Boolean(before.titleResourceId) && !after.titleResourceId;
  const titleChanged = after.titleResourceId !== before.titleResourceId;
  const bgWritten = after.backgroundResourceId === nextBg;
  if (titleCleared || (titleChanged && after.titleResourceId !== before.titleResourceId && after.titleResourceId !== nextBg && titleChanged)) {
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 4,
      B: 3,
      title: "title background write cleared or mutated system.titleResourceId",
      repro,
      evidence,
    });
    return;
  }
  if (titleChanged) {
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 3,
      B: 2,
      title: "title background write also changed system.titleResourceId (documented trap)",
      repro,
      evidence,
    });
    return;
  }
  if (!bgWritten) {
    emitDefect({
      probeId,
      tabs: ["system"],
      S: 2,
      B: 2,
      title: "title background write did not land on titleScreen.backgroundResourceId",
      repro,
      evidence,
    });
    return;
  }
  emitClean(probeId, ["system"], "background write touched only titleScreen.backgroundResourceId", repro, evidence);
}

async function probeE4(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-title").click();
  const repro = [
    "open title menu",
    "db-field-title-screen-visible-new-game is checked+disabled",
    "uncheck attempt does not hide New Game",
  ];
  const box = page.getByTestId("db-field-title-screen-visible-new-game");
  const disabled = await box.isDisabled();
  const checked = await box.isChecked();
  await box.uncheck({ force: true }).catch(() => undefined);
  const stillChecked = await box.isChecked();
  const stillDisabled = await box.isDisabled();
  const evidence = [await shot(page, "e4-new-game-lock")];
  if (!disabled || !checked || !stillChecked || !stillDisabled) {
    emitDefect({
      probeId: "E4",
      tabs: ["system"],
      S: 4,
      B: 3,
      title: `New Game visibility is not locked checked+disabled (disabled=${disabled} checked=${checked} after=${stillChecked})`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("E4", ["system"], "New Game visibility is locked checked+disabled", repro, evidence);
}

async function probeE5(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-title").click();
  const repro = [
    "read preview labels vs menu fields",
    "uncheck 이어 하기 visibility",
    "preview drops that option and keeps New Game",
  ];
  const newGameLabel = await page.getByTestId("db-field-title-screen-new-game").inputValue();
  const continueLabel = await page.getByTestId("db-field-title-screen-continue").inputValue();
  const quitLabel = await page.getByTestId("db-field-title-screen-quit").inputValue();
  const preview = page.getByTestId("db-title-workbench-menu-preview");
  const beforeLabels = (await preview.locator(".db-title-workbench-menu-item").allTextContents()).map((text) => text.trim());
  const beforeParity = beforeLabels.includes(newGameLabel) && beforeLabels.includes(continueLabel) && beforeLabels.includes(quitLabel);
  await page.getByTestId("db-field-title-screen-visible-continue").uncheck();
  await expect.poll(async () => (await preview.locator(".db-title-workbench-menu-item").allTextContents()).map((text) => text.trim()).includes(continueLabel)).toBe(false);
  const afterLabels = (await preview.locator(".db-title-workbench-menu-item").allTextContents()).map((text) => text.trim());
  await page.getByTestId("db-field-title-screen-visible-continue").check();
  const evidence = [
    await shot(page, "e5-preview-parity"),
    writeJson(`${DIFF_DIR}/${SPEC}-e5.json`, { newGameLabel, continueLabel, quitLabel, beforeLabels, afterLabels }),
  ];
  if (!beforeParity || afterLabels.includes(continueLabel) || !afterLabels.includes(newGameLabel)) {
    emitDefect({
      probeId: "E5",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: "title preview labels diverged from listTitleMenuOptions / visibility",
      repro,
      evidence,
    });
    return;
  }
  emitClean("E5", ["system"], "preview labels match visible title menu options", repro, evidence);
}

async function probeE6(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-title").click();
  const repro = [
    "set title BGM if empty",
    "click db-title-bgm-play (user gesture unlocks audio)",
    "wait for an audio element / playing state via evaluate, not sleep",
    "switch system section then switch tab",
    "stop control remains reachable; no orphan loop",
  ];
  const music = page.getByTestId("db-field-title-screen-music");
  if (((await music.inputValue()) ?? "").trim().length === 0) {
    await music.fill(TITLE_MUSIC_FALLBACK);
    await music.blur();
  }
  const play = page.getByTestId("db-title-bgm-play");
  const stop = page.getByTestId("db-title-bgm-stop");
  await expect(stop).toBeVisible();
  if (await play.isDisabled()) {
    emitDefect({
      probeId: "E6",
      tabs: ["system"],
      S: 1,
      B: 1,
      title: "BGM play stayed disabled after assigning a music resource",
      repro,
      evidence: [await shot(page, "e6-play-disabled")],
      status: "unconfirmed-vqa",
    });
    return;
  }
  await play.click();
  let audioInfo: { count: number; playing: number; loop: number } | null = null;
  try {
    await expect.poll(async () => {
      audioInfo = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("audio"));
        return {
          count: nodes.length,
          playing: nodes.filter((node) => !node.paused && !node.ended).length,
          loop: nodes.filter((node) => node.loop).length,
        };
      });
      return audioInfo.count;
    }, { timeout: 3_000 }).toBeGreaterThan(0);
  } catch {
    emitDefect({
      probeId: "E6",
      tabs: ["system"],
      S: 2,
      B: 1,
      title: "BGM play click produced no audio element — playback state unconfirmed",
      repro,
      evidence: [await shot(page, "e6-no-audio")],
      status: "unconfirmed-vqa",
    });
    return;
  }
  await page.getByTestId("db-system-nav-party").click();
  const stopAfterSection = await page.getByTestId("db-title-bgm-stop").isVisible().catch(() => false);
  await ensureTab(page, TERMS_TAB);
  const stopOnOtherTab = await page.getByTestId("db-title-bgm-stop").isVisible().catch(() => false);
  const audioAfterTab = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("audio"));
    return {
      count: nodes.length,
      playing: nodes.filter((node) => !node.paused && !node.ended).length,
      loop: nodes.filter((node) => node.loop).length,
    };
  });
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-title").click();
  const stopBack = await page.getByTestId("db-title-bgm-stop").isVisible().catch(() => false);
  if (stopBack) await page.getByTestId("db-title-bgm-stop").click();
  const evidence = [
    await shot(page, "e6-bgm"),
    writeJson(`${DIFF_DIR}/${SPEC}-e6.json`, { audioInfo, stopAfterSection, stopOnOtherTab, audioAfterTab, stopBack }),
  ];
  if (audioAfterTab.playing > 0 && !stopOnOtherTab) {
    emitDefect({
      probeId: "E6",
      tabs: ["system", "terms"],
      S: 2,
      B: 2,
      title: "orphaned looping BGM after leaving the title section — stop not reachable",
      repro,
      evidence,
    });
    return;
  }
  if (!stopBack) {
    emitDefect({
      probeId: "E6",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: "BGM stop control not reachable after section/tab switch",
      repro,
      evidence,
    });
    return;
  }
  emitClean("E6", ["system"], "BGM play/stop stayed coherent across section and tab switches", repro, evidence);
}

async function probeE7(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-time").click();
  const repro = [
    "enable timeSystem",
    "set dayStartHour=20 and dayEndHour=6 (min>max)",
    "point onDayEnd at a seeded common event",
    "expect normalize/validation, not an inverted persisted range",
  ];
  const enable = page.getByTestId("db-field-system-time-enabled");
  if (!(await enable.isChecked())) await enable.check();
  await expect(page.getByTestId("db-field-system-time-day-start")).toBeVisible();
  if (SEEDING_PROVEN) {
    await mutatedProject(page, (draft) => {
      const events = (draft.commonEvents as { id: string; name: string; trigger: string; commands: unknown[] }[] | undefined) ?? [];
      if (!events.some((entry) => entry.id === "ce_audit_day_end")) {
        events.push({ id: "ce_audit_day_end", name: "감사 하루종료", trigger: "none", commands: [] });
      }
      draft.commonEvents = events;
    });
    await ensureTab(page, TERMS_TAB);
    await ensureTab(page, SYSTEM_TAB);
    await page.getByTestId("db-system-nav-time").click();
    if (!(await page.getByTestId("db-field-system-time-enabled").isChecked())) {
      await page.getByTestId("db-field-system-time-enabled").check();
    }
  }
  await page.getByTestId("db-field-system-time-day-start").fill("20");
  await page.getByTestId("db-field-system-time-day-end").fill("6");
  const picker = page.getByTestId("db-picker-system-time-on-day-end");
  if (await picker.locator("option[value='ce_audit_day_end']").count()) {
    await picker.selectOption("ce_audit_day_end");
  }
  const time = await waitExport(
    page,
    (project) => (project.system as { timeSystem?: { enabled?: boolean; dayStartHour?: number; dayEndHour?: number; onDayEnd?: string } }).timeSystem,
    (value) => value?.enabled === true,
  );
  const inverted = typeof time?.dayStartHour === "number" && typeof time?.dayEndHour === "number" && time.dayEndHour <= time.dayStartHour;
  const toastText = await page.getByTestId("toast").textContent().catch(() => "");
  const evidence = [
    await shot(page, "e7-time-bounds"),
    writeJson(`${DIFF_DIR}/${SPEC}-e7.json`, { time, inverted, toastText }),
  ];
  if (inverted) {
    emitDefect({
      probeId: "E7",
      tabs: ["system"],
      S: 3,
      B: 2,
      title: "timeSystem persisted inverted day bounds (end <= start)",
      repro,
      evidence,
    });
    return;
  }
  emitClean("E7", ["system"], "inverted day bounds were normalized; onDayEnd accepted a common event", repro, evidence);
}

async function probeE8(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-typechart").click();
  const repro = [
    "open type chart",
    "enter 33 comma-separated types",
    "blur",
    "expect 32-cap with a hint, not silent truncation",
  ];
  const types = Array.from({ length: 33 }, (_, index) => `t${String(index + 1).padStart(2, "0")}`);
  const input = page.getByTestId("db-field-system-type-chart-types");
  await input.fill(types.join(", "));
  await input.blur();
  // Persist the overflow via exportedProject, then restore the default 3-type chart
  // immediately so a 32x32 matrix cannot freeze later probes.
  const chart = await waitExport(
    page,
    (project) => (project.system as { typeChart?: { types?: string[] } }).typeChart?.types ?? [],
    (value) => value.includes("t01") || value.length >= 32,
  );
  if (SEEDING_PROVEN) {
    await mutatedProject(page, (draft) => {
      const system = draft.system as { typeChart?: { types: string[]; multipliers: Record<string, Record<string, number>> } };
      system.typeChart = {
        types: ["fire", "water", "grass"],
        multipliers: {
          fire: { fire: 0.5, water: 0.5, grass: 2 },
          water: { fire: 2, water: 0.5, grass: 0.5 },
          grass: { fire: 0.5, water: 2, grass: 0.5 },
        },
      };
    });
  }
  const toastText = await page.getByTestId("toast").textContent().catch(() => "");
  const hint = Boolean(toastText && /32|최대|제한|초과/.test(toastText))
    || await page.getByText(/32|최대 32|타입.*제한/).count() > 0;
  const evidence = [
    await shot(page, "e8-type-cap"),
    writeJson(`${DIFF_DIR}/${SPEC}-e8.json`, { count: chart.length, types: chart, hint, toastText }),
  ];
  if (chart.length > 32) {
    emitDefect({
      probeId: "E8",
      tabs: ["system"],
      S: 3,
      B: 2,
      title: `type chart accepted ${chart.length} types (cap is 32)`,
      repro,
      evidence,
    });
  } else if (chart.length === 32 && !hint) {
    emitDefect({
      probeId: "E8",
      tabs: ["system"],
      S: 1,
      B: 2,
      title: "33rd type was silently truncated to 32 with no hint",
      repro,
      evidence,
    });
  } else {
    emitClean("E8", ["system"], "32-type cap enforced with visible feedback", repro, evidence);
  }
}

async function probeE9(page: Page): Promise<void> {
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-time").click();
  const repro = [
    "toggle db-field-system-time-enabled 10 times rapidly",
    "edit a field and Escape once",
    "more than one dirty prompt = leaked re-render listeners",
  ];
  const enable = page.getByTestId("db-field-system-time-enabled");
  for (let index = 0; index < 10; index += 1) {
    await rawClick(page, enable);
  }
  const enableCount = await page.getByTestId("db-field-system-time-enabled").count();
  if (!(await page.getByTestId("db-field-system-time-enabled").isChecked().catch(() => false))) {
    await page.getByTestId("db-field-system-time-enabled").check();
  }
  await page.getByTestId("db-field-system-time-minutes-per-second").fill("3");
  await page.keyboard.press("Escape");
  const prompts = await page.getByTestId("database-dirty-prompt").count();
  if (prompts > 0) await page.getByTestId("database-dirty-keep-editing").click().catch(async () => {
    await page.getByTestId("database-dirty-discard").click().catch(() => undefined);
  });
  const evidence = [
    await shot(page, "e9-time-toggle"),
    writeJson(`${DIFF_DIR}/${SPEC}-e9.json`, { enableCount, prompts }),
  ];
  if (enableCount > 1 || prompts > 1) {
    emitDefect({
      probeId: "E9",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: `time-enable 10x produced duplicate listeners (enable=${enableCount} prompts=${prompts})`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("E9", ["system"], "10x time-enable toggle did not duplicate listeners", repro, evidence);
}

async function probeE10(page: Page): Promise<void> {
  await reopenDatabase(page);
  await ensureTab(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-party").click();
  const repro = [
    "edit start-party slot 1 (section 1)",
    "switch to title (section 7)",
    "close via Escape",
    "dirty prompt fires; Discard reverts the section-1 field",
  ];
  const before = partySlotsOf(await exportedProject(page));
  const select = page.getByTestId(PARTY_SLOT_TEST_IDS[0]);
  const options = await select.locator("option").evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean));
  const current = await select.inputValue();
  const next = options.find((value) => value !== current) ?? options[0];
  if (!next) {
    emitDefect({
      probeId: "E10",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "no alternate actor to dirty section 1",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await select.selectOption(next);
  await waitExport(page, (project) => partySlotsOf(project)[0], (value) => value === next);
  await page.getByTestId("db-system-nav-title").click();
  const oracle = await dirtyGuardOracle(page, "escape");
  let reverted = false;
  if (oracle.promptShown) {
    await page.getByTestId("database-dirty-discard").click();
    await expect(page.getByTestId("database-modal")).toBeHidden();
    await reopenDatabase(page);
    await ensureTab(page, SYSTEM_TAB);
    await page.getByTestId("db-system-nav-party").click();
    const after = partySlotsOf(await exportedProject(page));
    reverted = after[0] === before[0];
  }
  const evidence = [
    await shot(page, "e10-cross-section-dirty"),
    writeJson(`${DIFF_DIR}/${SPEC}-e10.json`, { before, next, promptShown: oracle.promptShown, buttons: oracle.buttons, reverted }),
  ];
  if (!oracle.promptShown) {
    emitDefect({
      probeId: "E10",
      tabs: ["system"],
      S: 4,
      B: 3,
      title: "cross-section dirty miss: Escape from section 7 dropped the section-1 edit with no prompt",
      repro,
      evidence,
    });
    return;
  }
  if (!reverted) {
    emitDefect({
      probeId: "E10",
      tabs: ["system"],
      S: 4,
      B: 3,
      title: "Discard from section 7 did not revert the section-1 party slot",
      repro,
      evidence,
    });
    return;
  }
  emitClean("E10", ["system"], "cross-section dirty prompt fired; Discard restored section 1", repro, evidence);
}

async function probeX6(page: Page): Promise<void> {
  await ensureTab(page, ITEMS_TAB);
  const repro = [
    "items tab",
    "click db-filter-chip-medicine",
    "chip aria-pressed=true and .active",
    "close, reload, reopen items",
    "chip still visibly active",
  ];
  const chip = page.getByTestId("db-filter-chip-medicine");
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await closeModalClean(page);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click();
  await reopenDatabase(page);
  await ensureTab(page, ITEMS_TAB);
  const restored = page.getByTestId("db-filter-chip-medicine");
  const pressed = await restored.getAttribute("aria-pressed");
  const activeClass = await restored.getAttribute("class");
  const evidence = [
    await shot(page, "x6-filter-chip"),
    writeJson(`${DIFF_DIR}/${SPEC}-x6.json`, { pressed, activeClass }),
  ];
  if (pressed !== "true" || !activeClass?.includes("active")) {
    emitDefect({
      probeId: "X6",
      tabs: ["items"],
      S: 2,
      B: 3,
      title: "medicine filter persisted but the chip is not visibly active after reload",
      repro,
      evidence,
    });
    return;
  }
  emitClean("X6", ["items"], "filter chip stays visibly active after reload", repro, evidence);
}

async function probeX13(page: Page): Promise<void> {
  await ensureTab(page, ITEMS_TAB);
  const allChip = page.getByTestId("db-filter-chip-all");
  if (await allChip.isVisible().catch(() => false)) await allChip.click();
  if (await page.getByTestId("db-view-toggle-list").isVisible().catch(() => false)) {
    await page.getByTestId("db-view-toggle-list").click();
  }
  const repro = [
    "items list (177 > 80)",
    "search an offscreen record",
    "select it",
    "clear search",
    "selected row remains in the DOM",
  ];
  const items = (await exportedProject(page)).database.items;
  const target = items[items.length - 1];
  if (!target) {
    emitDefect({
      probeId: "X13",
      tabs: ["items"],
      S: 0,
      B: 0,
      title: "no items to select offscreen",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  const search = page.locator(".db-search input").first();
  await search.fill(target.name || target.id);
  const row = page.getByTestId(`db-record-row-${target.id}`);
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await search.fill("");
  await expect.poll(async () => page.locator(".db-search input").first().inputValue(), { timeout: 3_000 }).toBe("");
  const inDom = await page.getByTestId(`db-record-row-${target.id}`).count();
  const selectedVisible = inDom > 0;
  const evidence = [
    await shot(page, "x13-virtualizer"),
    writeJson(`${DIFF_DIR}/${SPEC}-x13.json`, { id: target.id, name: target.name, inDom, itemCount: items.length, threshold: VIRTUALIZER_THRESHOLD }),
  ];
  if (!selectedVisible) {
    emitDefect({
      probeId: "X13",
      tabs: ["items"],
      S: 2,
      B: 2,
      title: "virtualizer dropped the selected offscreen row after clearing search",
      repro,
      evidence,
    });
    return;
  }
  emitClean("X13", ["items"], "offscreen selection stayed in the DOM after clearing search", repro, evidence);
}

async function probeX3(page: Page): Promise<void> {
  const repro = [
    "open->dirty->Discard->reopen ×5",
    "Escape once on the clean reopen",
    "N stacked prompts = leaked keydown listeners",
  ];
  for (let index = 0; index < 5; index += 1) {
    await reopenDatabase(page);
    await ensureTab(page, SYSTEM_TAB);
    await page.getByTestId("db-system-nav-title").click();
    const title = page.getByTestId("db-field-title-screen-title");
    await title.fill(`leak-${index}`);
    await title.blur();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("database-dirty-prompt")).toBeVisible();
    await page.getByTestId("database-dirty-discard").click();
    await expect(page.getByTestId("database-modal")).toBeHidden();
  }
  await reopenDatabase(page);
  await page.keyboard.press("Escape");
  const prompts = await page.getByTestId("database-dirty-prompt").count();
  if (prompts > 0) {
    await page.getByTestId("database-dirty-discard").click().catch(() => undefined);
  } else {
    await expect(page.getByTestId("database-modal")).toBeHidden();
  }
  const evidence = [
    await shot(page, "x3-listener-leak"),
    writeJson(`${DIFF_DIR}/${SPEC}-x3.json`, { prompts }),
  ];
  if (prompts > 1) {
    emitDefect({
      probeId: "X3",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: `Escape after 5 dirty-discard cycles stacked ${prompts} prompts (listener leak)`,
      repro,
      evidence,
    });
    return;
  }
  emitClean("X3", ["system"], "5 dirty-discard-reopen cycles left a single Escape coherent", repro, evidence);
}
