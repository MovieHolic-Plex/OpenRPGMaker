import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import {
  bandForScore,
  bootDbLane,
  BOUNDARY_INPUTS,
  collectConsoleErrors,
  dirtyGuardOracle,
  FINDINGS_DIR,
  mutatedProject,
  recordFinding,
  SEEDING_PROVEN,
  switchTabAnyMode,
  validateFinding,
  type AuditFinding,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject } from "./rm2k3-database-helpers";

const SPEC = "_db-audit-commands";
const SHOT_DIR = "output/evidence/db-beginner-audit/shots";
const FINDINGS_PATH = path.join(FINDINGS_DIR, `${SPEC}.json`);

const COMMON_EVENTS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "common-events")!;
const CLASSES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "classes")!;
const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const ACTORS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;

type Severity = AuditFinding["S"];
type BeginnerImpact = AuditFinding["B"];

type LooseCommand = {
  kind?: string;
  body?: string;
  commandId?: string;
  switchId?: string;
  options?: { text?: string; branch?: LooseCommand[] }[];
  then?: LooseCommand[];
  else?: LooseCommand[];
  [key: string]: unknown;
};

type LooseProject = {
  commonEvents: { id: string; name: string; commands: LooseCommand[] }[];
  database: {
    items: { id: string; name: string }[];
    classes: { id?: string; name: string; battleCommands: { name: string; kind: string; skillId?: string; skillSubsetName?: string }[] }[];
    troops: {
      id: string;
      name: string;
      members?: unknown[];
      enemyIds?: string[];
      battleEventPages?: {
        conditions: Record<string, unknown>[];
        commands: LooseCommand[];
      }[];
    }[];
    actors: { id: string; name: string }[];
  };
  system: { timeSystem?: { enabled?: boolean; onDayEnd?: string } };
};

test.describe("DB audit — command-list editors (diagnostic)", () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
    mkdirSync(FINDINGS_DIR, { recursive: true });
    // Wipe only at process start. A worker restart must not erase findings
    // already flushed by earlier tests in this run.
    if (!process.env.DB_AUDIT_COMMANDS_WIPED) {
      try {
        unlinkSync(FINDINGS_PATH);
      } catch {
        // first run
      }
      process.env.DB_AUDIT_COMMANDS_WIPED = "1";
    }
  });

  test("X2 X3 X6 X13 mandatory chrome probes", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });

    await runProbe(page, "X2", ["items"], async () => {
      await probeFalseDirtyOnOpen(page);
    });

    await runProbe(page, "X3", ["actors"], async () => {
      await probeListenerLeak(page);
    });

    await runProbe(page, "X6", ["items"], async () => {
      await probeFilterChipPersistence(page);
    });

    await runProbe(page, "X13", ["items"], async () => {
      await probeVirtualizerOffscreenSelection(page);
    });

    recordConsoleNoise(errors, ["items", "actors"], "X-chrome");
  });

  test("commonEvents C0 empty + C1 expert + C2 C4", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, COMMON_EVENTS_TAB);

    await runProbe(page, "C0", ["commonEvents"], async () => {
      await probeEmptyCommonEvents(page);
    });

    await ensureCommonEvent(page);

    await runProbe(page, "C1", ["commonEvents"], async () => {
      await probeNestedEscape(page, "expert");
    });

    await runProbe(page, "C2", ["commonEvents"], async () => {
      await probeHalfWrittenCommand(page);
    });

    await runProbe(page, "C4", ["commonEvents"], async () => {
      await probeReorderBoundaries(page);
    });

    recordConsoleNoise(errors, ["commonEvents"], "C-commonEvents-a");
  });

  test("commonEvents C3 C8 C9 C10", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, COMMON_EVENTS_TAB);
    await ensureCommonEvent(page);

    await runProbe(page, "C3", ["commonEvents"], async () => {
      await probeBranchIntegrity(page);
    });

    await runProbe(page, "C8", ["commonEvents"], async () => {
      await probeChoicesBoundaryText(page);
    });

    await runProbe(page, "C9", ["commonEvents"], async () => {
      await probeReferencedCommonEventDelete(page);
    });

    await runProbe(page, "C10", ["commonEvents"], async () => {
      await probeCommandEditDirtyGuard(page);
    });

    recordConsoleNoise(errors, ["commonEvents"], "C-commonEvents-b");
  });

  test("C1 nested-Escape in beginner lane", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner" });
    await switchTabAnyMode(page, COMMON_EVENTS_TAB);
    await ensureCommonEvent(page);
    await runProbe(page, "C1", ["commonEvents"], async () => {
      await probeNestedEscape(page, "beginner");
    });
    recordConsoleNoise(errors, ["commonEvents"], "C1-beginner");
  });

  test("troop battle events C5 C7 + pre-existing add-record intercept", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, TROOPS_TAB);
    await expect(page.getByTestId("db-troops-classic-workbench")).toBeVisible({ timeout: 15_000 });

    await runProbe(page, "pre-existing-troops-add", ["troops"], async () => {
      await probePreexistingTroopAddRecord(page);
    });

    await page.locator(".db-list-row").first().click({ timeout: 8_000 });

    await runProbe(page, "C5", ["troops"], async () => {
      await probeRuntimeSupportBadges(page);
    });

    await runProbe(page, "C7", ["troops"], async () => {
      await probeInvalidTroopConditions(page);
    });

    recordConsoleNoise(errors, ["troops"], "C-troops");
  });

  test("class battleCommands C6 cap + kind context", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await switchTabAnyMode(page, CLASSES_TAB);
    await expect(page.getByTestId("db-classes-bm88-workbench")).toBeVisible({ timeout: 15_000 });

    await runProbe(page, "C6", ["classes"], async () => {
      await probeClassBattleCommands(page);
    });

    recordConsoleNoise(errors, ["classes"], "C-classes");
  });

  test("findings ledger covers required command surfaces", () => {
    const raw = readFileSync(FINDINGS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    expect(Array.isArray(parsed), "findings JSON must be an array").toBe(true);
    const findings = parsed as AuditFinding[];
    expect(findings.length, "at least one finding/clean entry").toBeGreaterThan(0);
    for (const finding of findings) validateFinding(finding);

    const tabs = new Set(findings.flatMap((finding) => finding.tabs));
    expect(tabs.has("commonEvents"), "commonEvents surface must be represented").toBe(true);
    expect(tabs.has("troops"), "troop battle-event surface must be represented").toBe(true);
    expect(tabs.has("classes"), "class battleCommands surface must be represented").toBe(true);

    const probes = new Set(findings.map((finding) => finding.probeId));
    for (const required of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "X2", "X3", "X6", "X13"]) {
      expect(probes.has(required), `missing probe ${required}`).toBe(true);
    }
  });
});

function emit(
  partial: Omit<AuditFinding, "spec" | "score" | "band"> & { readonly S: Severity; readonly B: BeginnerImpact },
): void {
  const score = partial.S * partial.B;
  recordFinding({
    spec: SPEC,
    ...partial,
    score,
    band: bandForScore(score),
  });
}

function clean(
  probeId: string,
  tabs: readonly string[],
  title: string,
  repro: readonly string[] = [],
): void {
  emit({
    id: `${probeId}-clean`,
    probeId,
    tabs,
    S: 0,
    B: 0,
    title,
    repro,
    evidence: [],
    status: "clean",
  });
}

async function runProbe(page: Page, probeId: string, tabs: readonly string[], body: () => Promise<void>): Promise<void> {
  const budgetMs = 75_000;
  try {
    await Promise.race([
      body(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${probeId} exceeded ${budgetMs}ms probe budget`)), budgetMs);
      }),
    ]);
  } catch (error) {
    await dismissOverlays(page).catch(() => undefined);
    const evidence = await shot(page, `${probeId}-crash`).catch(() => []);
    emit({
      id: `${probeId}-crash`,
      probeId,
      tabs: [...tabs],
      S: 2,
      B: 1,
      title: `${probeId} probe crashed before a contract judgment`,
      repro: [`run ${probeId}`, error instanceof Error ? error.message : String(error)],
      evidence,
      status: "confirmed",
    });
  }
}

async function shot(page: Page, name: string): Promise<string[]> {
  const rel = path.join(SHOT_DIR, `${SPEC}-${name}.png`).replaceAll("\\", "/");
  await page.screenshot({ path: rel });
  return [rel];
}

async function projectOf(page: Page): Promise<LooseProject> {
  return (await exportedProject(page)) as unknown as LooseProject;
}

async function visible(locator: { isVisible: (opts?: { timeout?: number }) => Promise<boolean> }, timeout = 1_500): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function dismissOverlays(page: Page): Promise<void> {
  for (const testId of [
    "event-command-edit-cancel",
    "event-command-picker-cancel",
    "database-dirty-keep-editing",
    "database-dirty-discard",
  ]) {
    if (await visible(page.getByTestId(testId), 200)) {
      await page.getByTestId(testId).click().catch(() => undefined);
    }
  }
}

async function dismissBootChrome(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await visible(guest, 3_000)) await guest.click();
  await page.getByTestId("login-modal").waitFor({ state: "hidden", timeout: 8_000 }).catch(() => undefined);
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await visible(button, 400)) await button.click().catch(() => undefined);
  }
}

async function reopenDatabase(page: Page): Promise<void> {
  const modal = page.getByTestId("database-modal");
  if (await visible(modal, 500)) return;
  const toolbar = page.getByTestId("toolbar-database");
  if (await visible(toolbar, 1_000)) {
    await toolbar.click();
  } else {
    await page.getByTestId("menu-tools").click();
    await page.getByTestId("menu-tools-database").click();
  }
  await expect(modal).toBeVisible({ timeout: 15_000 });
}

async function ensureModalOpen(page: Page): Promise<void> {
  await reopenDatabase(page);
}

async function ensureCommonEvent(page: Page): Promise<void> {
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  const rows = page.locator("button.db-list-row");
  if ((await rows.count()) > 0) return;
  await page.getByRole("button", { name: "+ 공통 이벤트 추가" }).click();
  await expect(page.getByTestId("db-common-event-command-list")).toBeVisible({ timeout: 10_000 });
}

async function openCommandPicker(page: Page): Promise<boolean> {
  const picker = page.getByTestId("event-command-picker");
  if (await visible(picker, 300)) return true;
  const empty = page.getByTestId("event-command-empty-line");
  if (!(await visible(empty, 2_000))) return false;
  await empty.dblclick();
  return visible(picker, 5_000);
}

async function pickCommand(page: Page, query: string, addTestId: string): Promise<boolean> {
  if (!(await openCommandPicker(page))) return false;
  const search = page.getByTestId("event-command-picker-search");
  if (!(await visible(search, 2_000))) return false;
  await search.fill(query);
  const button = page.getByTestId(addTestId);
  if (!(await visible(button, 2_500))) {
    const labeled = page.getByRole("button", { name: query }).first();
    if (await visible(labeled, 1_000)) {
      await labeled.click({ timeout: 3_000 });
      return visible(page.getByTestId("event-command-edit-dialog"), 4_000);
    }
    return false;
  }
  await button.click({ timeout: 4_000 });
  return visible(page.getByTestId("event-command-edit-dialog"), 4_000);
}

async function confirmCommandDialog(page: Page): Promise<void> {
  const ok = page.getByTestId("event-command-edit-ok");
  if (await visible(ok, 2_000)) await ok.click();
}

function recordConsoleNoise(errors: readonly string[], tabs: readonly string[], probeId: string): void {
  if (errors.length === 0) return;
  emit({
    id: `${probeId}-console`,
    probeId,
    tabs: [...tabs],
    S: 1,
    B: 1,
    title: `Console errors during ${probeId}`,
    repro: [...errors],
    evidence: [],
    status: "confirmed",
  });
}

async function probeEmptyCommonEvents(page: Page): Promise<void> {
  const rows = page.locator("button.db-list-row");
  const rowCount = await rows.count();
  const emptyEditor = page.locator(".db-common-event-empty-editor");
  const hintVisible = await visible(emptyEditor, 1_000);
  const hintText = hintVisible ? ((await emptyEditor.textContent()) ?? "") : "";
  const addVisible = await visible(page.getByRole("button", { name: "+ 공통 이벤트 추가" }), 1_000);
  const repro = [
    "boot expert /?freshProject=1",
    "open Database → db-tab-common-events",
    `list rows=${rowCount} addVisible=${addVisible} hint=${JSON.stringify(hintText)}`,
  ];
  if (rowCount !== 0) {
    emit({
      id: "C0-not-empty",
      probeId: "C0",
      tabs: ["commonEvents"],
      S: 1,
      B: 0,
      title: "freshProject commonEvents was not empty (data-audit assumed 0)",
      repro,
      evidence: await shot(page, "C0-not-empty"),
      status: "confirmed",
    });
    return;
  }
  if (!addVisible || !hintVisible || !hintText.includes("공통 이벤트")) {
    emit({
      id: "C0-blank-pane",
      probeId: "C0",
      tabs: ["commonEvents"],
      S: 2,
      B: 2,
      title: "Empty commonEvents pane has no usable beginner hint or add control",
      repro,
      evidence: await shot(page, "C0-blank-pane"),
      status: "confirmed",
    });
    return;
  }
  clean("C0", ["commonEvents"], "Empty commonEvents pane shows add control + hint", repro);
}

async function probeNestedEscape(page: Page, lane: "expert" | "beginner"): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  const opened = await openCommandPicker(page);
  const repro = [
    `boot ${lane} /?freshProject=1`,
    "open Database → common events (create one if empty)",
    "dblclick event-command-empty-line",
    "press Escape",
    "expect picker closed, database-modal still open, no database-dirty-prompt",
  ];
  if (!opened) {
    emit({
      id: `C1-${lane}-no-picker`,
      probeId: "C1",
      tabs: ["commonEvents"],
      S: 2,
      B: 2,
      title: `C1 ${lane}: command picker did not open`,
      repro,
      evidence: await shot(page, `C1-${lane}-no-picker`),
      status: "confirmed",
    });
    return;
  }
  await page.keyboard.press("Escape");
  const pickerOpen = await visible(page.getByTestId("event-command-picker"), 800);
  const modalOpen = await visible(page.getByTestId("database-modal"), 800);
  const promptOpen = await visible(page.getByTestId("database-dirty-prompt"), 800);
  const evidence = pickerOpen || !modalOpen || promptOpen ? await shot(page, `C1-${lane}-escape`) : [];
  if (!modalOpen) {
    emit({
      id: `C1-${lane}-modal-closed`,
      probeId: "C1",
      tabs: ["commonEvents"],
      S: 4,
      B: 3,
      title: `C1 ${lane}: Escape from command picker closed the Database modal`,
      repro,
      evidence,
      status: "confirmed",
    });
    await reopenDatabase(page);
    await switchTabAnyMode(page, COMMON_EVENTS_TAB);
    return;
  }
  if (promptOpen) {
    emit({
      id: `C1-${lane}-dirty-from-picker`,
      probeId: "C1",
      tabs: ["commonEvents"],
      S: 2,
      B: 2,
      title: `C1 ${lane}: Escape from command picker fired the Database dirty prompt`,
      repro,
      evidence,
      status: "confirmed",
    });
    await page.getByTestId("database-dirty-keep-editing").click().catch(() => undefined);
    return;
  }
  if (pickerOpen) {
    emit({
      id: `C1-${lane}-picker-stuck`,
      probeId: "C1",
      tabs: ["commonEvents"],
      S: 2,
      B: 1,
      title: `C1 ${lane}: Escape left the command picker open`,
      repro,
      evidence,
      status: "confirmed",
    });
    await page.getByTestId("event-command-picker-cancel").click().catch(() => undefined);
    return;
  }
  clean("C1", ["commonEvents"], `C1 ${lane}: picker Escape closes picker only`, repro);
}

async function probeHalfWrittenCommand(page: Page): Promise<void> {
  await dismissOverlays(page);
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  const before = (await projectOf(page)).commonEvents[0]?.commands ?? [];
  const beforeKinds = before.map((command) => command.kind).join(",");
  const repro = [
    "common events → add/select a record",
    "open picker, choose 문장 표시 (text), type HALF-WRITTEN, Escape",
    "reopen edit dialog / exportedProject must not keep the half write",
  ];

  const openedNew = await pickCommand(page, "문장", "command-picker-add-text");
  if (openedNew) {
    const body = page.getByTestId("event-command-text-body");
    if (await visible(body, 2_000)) await body.fill("HALF-WRITTEN");
    await page.keyboard.press("Escape");
  }
  await dismissOverlays(page);
  if (await visible(page.getByTestId("event-command-picker"), 300)) {
    await page.keyboard.press("Escape");
    await dismissOverlays(page);
  }

  const afterNew = (await projectOf(page)).commonEvents[0]?.commands ?? [];
  const appended = afterNew.length > before.length || afterNew.some((command) => command.body === "HALF-WRITTEN");

  let persistedOnExisting = false;
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  const existing = page.getByTestId("event-command-text").first();
  if (await visible(existing, 1_500)) {
    await existing.locator(".cmd-head").dblclick();
    const dialog = page.getByTestId("event-command-edit-dialog");
    if (await visible(dialog, 2_000)) {
      const body = page.getByTestId("event-command-text-body");
      if (await visible(body, 1_500)) await body.fill("HALF-WRITTEN-EXISTING");
      await page.keyboard.press("Escape");
      await dismissOverlays(page);
    }
    persistedOnExisting = ((await projectOf(page)).commonEvents[0]?.commands ?? [])
      .some((command) => String(command.body ?? "").includes("HALF-WRITTEN"));
  }

  const exported = (await projectOf(page)).commonEvents[0]?.commands ?? [];
  const exportedHalf = exported.some((command) => String(command.body ?? "").includes("HALF-WRITTEN"));
  if (appended || persistedOnExisting || exportedHalf) {
    emit({
      id: "C2-half-written-kept",
      probeId: "C2",
      tabs: ["commonEvents"],
      S: 3,
      B: 3,
      title: "C2: Escape mid-edit left a half-written command in the list",
      repro: [...repro, `beforeKinds=${beforeKinds}`, `afterLen=${afterNew.length}`, `exportedHalf=${exportedHalf}`],
      evidence: await shot(page, "C2-half-written"),
      status: "confirmed",
    });
    return;
  }
  clean("C2", ["commonEvents"], "C2: Escape mid-edit discarded staged command text", repro);
}

async function probeReorderBoundaries(page: Page): Promise<void> {
  await dismissOverlays(page);
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  if (!SEEDING_PROVEN) {
    emit({
      id: "C4-seeding-limited",
      probeId: "C4",
      tabs: ["commonEvents"],
      S: 0,
      B: 0,
      title: "C4 skipped — mutatedProject seeding not proven",
      repro: ["SEEDING_PROVEN=false"],
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await mutatedProject(page, (project) => {
    const events = project.commonEvents as { commands: unknown[] }[] | undefined;
    if (!events?.[0]) throw new Error("C4: no common event to seed");
    events[0].commands = [
      { kind: "setSwitch", switchId: "0001", value: true },
      { kind: "setSwitch", switchId: "0002", value: true },
      { kind: "setSwitch", switchId: "0003", value: true },
    ];
  });
  await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(3, { timeout: 8_000 });
  const before = ((await projectOf(page)).commonEvents[0]?.commands ?? []).map((command) => command.switchId);
  const rows = page.getByTestId("event-command-setSwitch");
  // Action buttons are CSS-hidden until hover; dispatch a DOM click so the
  // boundary no-op is what we measure, not Playwright visibility.
  const clickAction = async (row: ReturnType<typeof rows.first>, title: string): Promise<void> => {
    await row.evaluate((node, actionTitle) => {
      const button = node.querySelector<HTMLButtonElement>(`.cmd-actions button[title="${actionTitle}"]`);
      if (!button) throw new Error(`missing action ${actionTitle}`);
      button.click();
    }, title);
  };
  for (let i = 0; i < 4; i += 1) {
    await clickAction(rows.first(), "위로");
    await clickAction(rows.last(), "아래로");
  }
  const afterCount = await rows.count();
  const after = ((await projectOf(page)).commonEvents[0]?.commands ?? []).map((command) => command.switchId);
  const repro = [
    "seed 3 sibling setSwitch commands",
    "click ↑ on first row x4 and ↓ on last row x4",
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)} count=${afterCount}`,
  ];
  if (afterCount !== 3 || after.length !== 3) {
    emit({
      id: "C4-row-count-changed",
      probeId: "C4",
      tabs: ["commonEvents"],
      S: 4,
      B: 3,
      title: "C4: reorder past the list boundary vanished or duplicated a row",
      repro,
      evidence: await shot(page, "C4-boundary"),
      status: "confirmed",
    });
    return;
  }
  const unique = new Set(after);
  if (unique.size !== 3) {
    emit({
      id: "C4-duplicate-ids",
      probeId: "C4",
      tabs: ["commonEvents"],
      S: 4,
      B: 3,
      title: "C4: boundary reorder duplicated a command identity",
      repro,
      evidence: await shot(page, "C4-dup"),
      status: "confirmed",
    });
    return;
  }
  clean("C4", ["commonEvents"], "C4: boundary reorder is an inert no-op", repro);
}

async function probeBranchIntegrity(page: Page): Promise<void> {
  await dismissOverlays(page);
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  if (!SEEDING_PROVEN) {
    emit({
      id: "C3-seeding-limited",
      probeId: "C3",
      tabs: ["commonEvents"],
      S: 0,
      B: 0,
      title: "C3 skipped — mutatedProject seeding not proven",
      repro: ["SEEDING_PROVEN=false"],
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await mutatedProject(page, (project) => {
    const events = project.commonEvents as { commands: unknown[] }[] | undefined;
    if (!events?.[0]) throw new Error("C3: no common event to seed");
    events[0].commands = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "0001", value: true },
        then: [{ kind: "setSwitch", switchId: "0002", value: true }],
        else: [{ kind: "text", body: "else-branch" }],
      },
    ];
  });
  await expect(page.getByTestId("event-command-fork")).toHaveCount(1, { timeout: 8_000 });
  await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(1, { timeout: 8_000 });
  const thenRow = page.getByTestId("event-command-setSwitch");
  await thenRow.evaluate((node) => {
    const button = node.querySelector<HTMLButtonElement>('.cmd-actions button[title="삭제"]');
    if (!button) throw new Error("missing delete action");
    button.click();
  });

  const forkCount = await page.getByTestId("event-command-fork").count();
  const leftoverThen = await page.getByTestId("event-command-setSwitch").count();
  const elseText = page.getByTestId("event-command-text");
  const elseCount = await elseText.count();
  const elseDepth = elseCount > 0 ? await elseText.first().getAttribute("data-cmd-depth") : null;
  const exported = (await projectOf(page)).commonEvents[0]?.commands ?? [];
  const fork = exported.find((command) => command.kind === "fork");
  const thenLen = Array.isArray(fork?.then) ? fork.then.length : -1;
  const elseLen = Array.isArray(fork?.else) ? fork.else.length : -1;
  const repro = [
    "seed fork { then: [setSwitch], else: [text] }",
    "delete the then-branch setSwitch row",
    `ui fork=${forkCount} leftoverThen=${leftoverThen} else=${elseCount} elseDepth=${elseDepth}`,
    `export thenLen=${thenLen} elseLen=${elseLen}`,
  ];
  const orphaned = leftoverThen > 0 || elseDepth === "0" || thenLen < 0 || elseLen !== 1 || forkCount !== 1;
  if (orphaned) {
    emit({
      id: "C3-branch-orphan",
      probeId: "C3",
      tabs: ["commonEvents"],
      S: 4,
      B: 3,
      title: "C3: deleting a command inside a branch left orphaned indent / invalid fork",
      repro,
      evidence: await shot(page, "C3-orphan"),
      status: "confirmed",
    });
    return;
  }
  clean("C3", ["commonEvents"], "C3: deleting an inner branch row kept fork indent valid", repro);
}

async function probeChoicesBoundaryText(page: Page): Promise<void> {
  await dismissOverlays(page);
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  const repro = [
    "open command picker → choices",
    `set option 1 = BOUNDARY_INPUTS.longCjk (${BOUNDARY_INPUTS.longCjk.length} chars)`,
    `set option 2 = BOUNDARY_INPUTS.emojiZwj (${BOUNDARY_INPUTS.emojiZwj})`,
    "OK, read summary row + exportedProject.commonEvents[0].commands",
  ];
  const opened = await pickCommand(page, "선택", "command-picker-add-choices");
  if (!opened) {
    emit({
      id: "C8-picker-miss",
      probeId: "C8",
      tabs: ["commonEvents"],
      S: 2,
      B: 1,
      title: "C8: choices command picker entry was not reachable",
      repro,
      evidence: await shot(page, "C8-picker-miss"),
      status: "confirmed",
    });
    return;
  }
  const opt1 = page.getByTestId("event-choice-option-1");
  const opt2 = page.getByTestId("event-choice-option-2");
  await expect(opt1).toBeVisible({ timeout: 5_000 });
  await opt1.fill(BOUNDARY_INPUTS.longCjk);
  await opt2.fill(BOUNDARY_INPUTS.emojiZwj);
  const typed1 = await opt1.inputValue();
  const typed2 = await opt2.inputValue();
  await confirmCommandDialog(page);
  if (await visible(page.getByTestId("event-command-picker"), 400)) {
    await page.getByTestId("event-command-picker-cancel").click().catch(() => undefined);
  }

  const row = page.getByTestId("event-command-choices").first();
  const rowVisible = await visible(row, 3_000);
  const summaryText = rowVisible ? ((await row.locator(".cmd-head").innerText()) ?? "") : "";
  const objectString = summaryText.includes("[object Object]");
  const overflow = await row.evaluate((node) => {
    if (!(node instanceof HTMLElement)) return false;
    return node.scrollWidth > node.clientWidth + 1;
  }).catch(() => false);

  const exported = (await projectOf(page)).commonEvents[0]?.commands ?? [];
  const choices = exported.find((command) => command.kind === "choices");
  const texts = (choices?.options ?? []).map((option) => option.text ?? "");
  const roundTripCjk = texts.some((text) => text === typed1 || text === BOUNDARY_INPUTS.longCjk);
  const roundTripEmoji = texts.some((text) => text === typed2 || text === BOUNDARY_INPUTS.emojiZwj);
  const surrogateBroken = texts.some((text) => text.includes("\uFFFD") || /[\uD800-\uDBFF]$/.test(text));

  if (!rowVisible || objectString || surrogateBroken || !roundTripEmoji) {
    emit({
      id: "C8-roundtrip-broken",
      probeId: "C8",
      tabs: ["commonEvents"],
      S: objectString || surrogateBroken ? 3 : 2,
      B: 2,
      title: "C8: CJK/emoji choice labels failed summary or exportedProject round-trip",
      repro: [...repro, `typed1Len=${typed1.length}`, `typed2=${typed2}`, `export=${JSON.stringify(texts)}`, `summary=${summaryText.slice(0, 80)}`],
      evidence: await shot(page, "C8-broken"),
      status: "confirmed",
    });
    return;
  }
  if (!roundTripCjk && typed1.length < BOUNDARY_INPUTS.longCjk.length) {
    emit({
      id: "C8-cjk-clipped",
      probeId: "C8",
      tabs: ["commonEvents"],
      S: 1,
      B: 2,
      title: "C8: 100-char CJK choice label was silently clipped (no hint)",
      repro: [...repro, `typed1Len=${typed1.length}`, `export=${JSON.stringify(texts)}`],
      evidence: await shot(page, "C8-clipped"),
      status: "confirmed",
    });
    return;
  }
  if (overflow) {
    emit({
      id: "C8-summary-overflow",
      probeId: "C8",
      tabs: ["commonEvents"],
      S: 1,
      B: 2,
      title: "C8: choices summary row overflowed instead of truncating",
      repro,
      evidence: await shot(page, "C8-overflow"),
      status: "confirmed",
    });
    return;
  }
  clean("C8", ["commonEvents"], "C8: CJK/emoji choice labels truncated safely and round-tripped", repro);
}

async function probeReferencedCommonEventDelete(page: Page): Promise<void> {
  await dismissOverlays(page);
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  await ensureCommonEvent(page);
  const current = (await projectOf(page)).commonEvents[0];
  if (!current) {
    emit({
      id: "C9-no-event",
      probeId: "C9",
      tabs: ["commonEvents"],
      S: 2,
      B: 1,
      title: "C9: no common event available to reference",
      repro: ["create common event failed"],
      evidence: await shot(page, "C9-no-event"),
      status: "confirmed",
    });
    return;
  }
  if (!SEEDING_PROVEN) {
    emit({
      id: "C9-seeding-limited",
      probeId: "C9",
      tabs: ["commonEvents"],
      S: 0,
      B: 0,
      title: "C9 skipped — cannot wire timeSystem.onDayEnd without seeding",
      repro: ["SEEDING_PROVEN=false"],
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await mutatedProject(page, (project, id) => {
    const system = (project.system ?? {}) as Record<string, unknown>;
    project.system = system;
    system.timeSystem = { enabled: true, onDayEnd: id };
  }, current.id);

  const wired = (await projectOf(page)).system.timeSystem?.onDayEnd;
  const deleteBtn = page.getByTestId(`db-common-event-delete-${current.id}`);
  await expect(deleteBtn).toBeVisible({ timeout: 8_000 });
  await deleteBtn.click({ timeout: 4_000 });
  const armed = ((await deleteBtn.textContent()) ?? "").includes("정말");
  if (armed) await deleteBtn.click({ timeout: 4_000 });

  const toastText = await page.getByTestId("toast").textContent().catch(() => "");
  const remaining = (await projectOf(page)).commonEvents;
  const stillThere = remaining.some((event) => event.id === current.id);
  const dangling = (await projectOf(page)).system.timeSystem?.onDayEnd === current.id && !stillThere;
  const namesRef = /시간|하루|onDayEnd|종료/.test(toastText ?? "");
  const repro = [
    `create common event ${current.id}`,
    "mutatedProject: system.timeSystem = { enabled:true, onDayEnd: id }",
    "click 삭제 twice",
    `wired=${wired} stillThere=${stillThere} dangling=${dangling} toast=${JSON.stringify(toastText)}`,
  ];
  if (dangling) {
    emit({
      id: "C9-dangling-ondayend",
      probeId: "C9",
      tabs: ["commonEvents"],
      S: 4,
      B: 3,
      title: "C9: deleting a common event referenced by timeSystem.onDayEnd left a dangling id",
      repro,
      evidence: await shot(page, "C9-dangling"),
      status: "confirmed",
    });
    return;
  }
  if (!stillThere) {
    emit({
      id: "C9-deleted-without-block",
      probeId: "C9",
      tabs: ["commonEvents"],
      S: 3,
      B: 3,
      title: "C9: referenced common event deleted without a blocking message",
      repro,
      evidence: await shot(page, "C9-deleted"),
      status: "confirmed",
    });
    return;
  }
  if (!namesRef) {
    emit({
      id: "C9-block-unnamed",
      probeId: "C9",
      tabs: ["commonEvents"],
      S: 2,
      B: 3,
      title: "C9: delete was blocked but the message does not name the timeSystem.onDayEnd reference",
      repro,
      evidence: await shot(page, "C9-unnamed"),
      status: "confirmed",
    });
    return;
  }
  clean("C9", ["commonEvents"], "C9: delete blocked and named the onDayEnd reference", repro);
}

async function probeCommandEditDirtyGuard(page: Page): Promise<void> {
  await dismissOverlays(page);
  await ensureModalOpen(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  await ensureCommonEvent(page);
  const beforeCount = (await projectOf(page)).commonEvents.length;
  const beforeCmdCount = (await projectOf(page)).commonEvents[0]?.commands.length ?? 0;
  const picked = await pickCommand(page, "스위치", "command-picker-add-setSwitch");
  if (picked) await confirmCommandDialog(page);
  if (await visible(page.getByTestId("event-command-picker"), 400)) {
    await page.getByTestId("event-command-picker-cancel").click().catch(() => undefined);
  }
  const midCmdCount = (await projectOf(page)).commonEvents[0]?.commands.length ?? 0;
  const repro = [
    "open Database (snapshot = current project)",
    "common events → add a setSwitch command",
    "Escape the Database modal",
    "3-way prompt must appear; Discard must drop the added command",
  ];
  if (midCmdCount <= beforeCmdCount && !picked) {
    emit({
      id: "C10-could-not-add",
      probeId: "C10",
      tabs: ["commonEvents"],
      S: 2,
      B: 1,
      title: "C10: could not add a command to dirty the snapshot",
      repro,
      evidence: await shot(page, "C10-no-add"),
      status: "confirmed",
    });
    return;
  }

  const oracle = await dirtyGuardOracle(page, "escape");
  if (!oracle.promptShown) {
    const modalOpen = await visible(page.getByTestId("database-modal"), 800);
    emit({
      id: "C10-no-dirty-prompt",
      probeId: "C10",
      tabs: ["commonEvents"],
      S: modalOpen ? 3 : 4,
      B: 3,
      title: modalOpen
        ? "C10: adding a command did not dirty the Database modal (Escape was a no-op)"
        : "C10: adding a command then Escape closed the modal with no 3-way prompt",
      repro: [...repro, `promptShown=${oracle.promptShown}`, `modalOpen=${modalOpen}`, `buttons=${oracle.buttons.join(",")}`],
      evidence: await shot(page, "C10-no-prompt"),
      status: "confirmed",
    });
    return;
  }
  await page.getByTestId("database-dirty-discard").click({ timeout: 4_000 });
  await page.getByTestId("database-modal").waitFor({ state: "hidden", timeout: 8_000 }).catch(() => undefined);
  await reopenDatabase(page);
  await switchTabAnyMode(page, COMMON_EVENTS_TAB);
  const after = await projectOf(page);
  const afterCount = after.commonEvents.length;
  const afterCmd = after.commonEvents[0]?.commands.length ?? 0;
  const discarded = afterCount < beforeCount || afterCmd <= beforeCmdCount;
  if (!discarded && afterCmd >= midCmdCount) {
    emit({
      id: "C10-discard-kept-command",
      probeId: "C10",
      tabs: ["commonEvents"],
      S: 4,
      B: 3,
      title: "C10: Discard did not remove the command added after the dirty snapshot",
      repro: [...repro, `beforeEvents=${beforeCount} afterEvents=${afterCount} beforeCmd=${beforeCmdCount} mid=${midCmdCount} afterCmd=${afterCmd}`],
      evidence: await shot(page, "C10-kept"),
      status: "confirmed",
    });
    return;
  }
  clean("C10", ["commonEvents"], "C10: Escape after adding a command prompted; Discard reverted it", repro);
}

async function probePreexistingTroopAddRecord(page: Page): Promise<void> {
  const repro = [
    "qa-troops.spec.ts battle event panel / CRUD / boundary",
    "boot expert, open troops tab, click db-add-record",
    "baseline: list row troop_bat_swarm intercepts pointer events (90s timeout)",
  ];
  try {
    await page.getByTestId("db-add-record").click({ timeout: 4_000 });
    emit({
      id: "pre-existing-troops-add-record-clean-now",
      probeId: "pre-existing-troops-add",
      tabs: ["troops"],
      S: 0,
      B: 0,
      title: "Pre-existing qa-troops db-add-record intercept did not reproduce",
      repro,
      evidence: [],
      status: "pre-existing",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit({
      id: "pre-existing-troops-add-record-intercept",
      probeId: "pre-existing-troops-add",
      tabs: ["troops"],
      S: 2,
      B: 2,
      title: "Pre-existing: troops db-add-record click intercepted by a list row",
      repro: [...repro, message.slice(0, 500)],
      evidence: await shot(page, "pre-existing-troops-add"),
      status: "pre-existing",
    });
  }
}

async function ensureTroopEventPage(page: Page): Promise<void> {
  if (await visible(page.getByTestId("db-troop-event-page-tab-1"), 1_000)) return;
  await page.getByTestId("db-troop-event-add-page").click();
  await expect(page.getByTestId("db-troop-event-page-tab-1")).toBeVisible({ timeout: 8_000 });
}

async function probeRuntimeSupportBadges(page: Page): Promise<void> {
  await ensureTroopEventPage(page);
  const repro = [
    "troops tab → select first troop → add battle-event page if needed",
    "apply 보상 흐름 템플릿 (inserts editor-only m2-109-result-summary)",
    "also picker-add wait (runtime-partial in troop context) if template already applied",
    "assert command-runtime-badge-list-* with data-runtime-support editor-only|runtime-partial",
  ];
  await page.getByTestId("db-troop-event-apply-payoff-template").click();
  await expect(page.getByTestId("db-troop-event-quality")).toBeVisible({ timeout: 8_000 });

  const list = page.getByTestId("db-troop-event-command-list");
  const badges = list.locator("[data-testid^='command-runtime-badge-list-']");
  let badgeCount = await badges.count();
  if (badgeCount === 0) {
    const picked = await pickCommand(page, "대기", "command-picker-add-wait");
    if (picked) await confirmCommandDialog(page);
    if (await visible(page.getByTestId("event-command-picker"), 400)) {
      await page.getByTestId("event-command-picker-cancel").click().catch(() => undefined);
    }
    badgeCount = await badges.count();
  }
  const supports = await badges.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.runtimeSupport ?? ""),
  );
  const hasWarn = supports.some((value) => value === "editor-only" || value === "runtime-partial");
  const exported = (await projectOf(page)).database.troops[0]?.battleEventPages?.[0]?.commands ?? [];
  const hasEditorOnly = exported.some((command) => command.commandId === "m2-109-result-summary");
  const hasPartialKind = exported.some((command) => command.kind === "wait");
  if ((hasEditorOnly || hasPartialKind) && !hasWarn) {
    emit({
      id: "C5-missing-badge",
      probeId: "C5",
      tabs: ["troops"],
      S: 3,
      B: 3,
      title: "C5: editor-only / runtime-partial troop command rendered with no runtime-support badge",
      repro: [...repro, `supports=${JSON.stringify(supports)}`, `exportKinds=${exported.map((c) => c.kind + ":" + (c.commandId ?? "")).join(",")}`],
      evidence: await shot(page, "C5-no-badge"),
      status: "confirmed",
    });
    return;
  }
  if (!hasWarn && !hasEditorOnly && !hasPartialKind) {
    emit({
      id: "C5-could-not-insert",
      probeId: "C5",
      tabs: ["troops"],
      S: 2,
      B: 1,
      title: "C5: could not insert an editor-only or runtime-partial troop command",
      repro,
      evidence: await shot(page, "C5-no-insert"),
      status: "confirmed",
    });
    return;
  }
  clean("C5", ["troops"], "C5: runtime-support badge rendered on a troop-unsupported command", repro);
}

async function probeInvalidTroopConditions(page: Page): Promise<void> {
  await ensureTroopEventPage(page);
  const kind = page.getByTestId("db-field-troop-event-condition-kind");
  await expect(kind).toBeVisible({ timeout: 8_000 });
  await kind.selectOption("enemyHp");
  const min = page.getByTestId("db-field-troop-event-condition-enemy-hp-min");
  const max = page.getByTestId("db-field-troop-event-condition-enemy-hp-max");
  await expect(min).toBeVisible({ timeout: 8_000 });
  await min.fill("80");
  await max.fill("20");
  const minValue = await min.inputValue();
  const maxValue = await max.inputValue();
  const hintNear = await page.locator(".db-troop-event-details").innerText();
  const invertedHint = /최소|최대|범위|역전|invalid|불가능/.test(hintNear);

  const troop = (await projectOf(page)).database.troops.find((entry) =>
    (entry.battleEventPages ?? []).some((eventPage) => eventPage.conditions.some((condition) => condition.kind === "enemyHp")),
  ) ?? (await projectOf(page)).database.troops[0];
  const enemyCond = troop?.battleEventPages?.flatMap((eventPage) => eventPage.conditions).find((condition) => condition.kind === "enemyHp");
  const persistedMin = Number(enemyCond?.minPercent);
  const persistedMax = Number(enemyCond?.maxPercent);
  const invertedPersisted = Number.isFinite(persistedMin) && Number.isFinite(persistedMax) && persistedMin > persistedMax;

  await kind.selectOption("actorHp");
  const actorHint = await page.locator(".db-troop-event-details").innerText();
  const actorMembers = Array.isArray(troop?.members) ? troop.members.length : 0;
  const actorWarn = /배우|주인공|액터|없음|불가능/.test(actorHint);
  const actorCond = (await projectOf(page)).database.troops
    .flatMap((entry) => entry.battleEventPages ?? [])
    .flatMap((eventPage) => eventPage.conditions)
    .find((condition) => condition.kind === "actorHp");

  const repro = [
    "troops → battle event page → condition kind enemyHp, min=80 max=20",
    "then kind actorHp on a troop that has only enemy members",
    `ui min=${minValue} max=${maxValue} invertedHint=${invertedHint}`,
    `export enemy min=${persistedMin} max=${persistedMax} actorCond=${JSON.stringify(actorCond)} actorMembers=${actorMembers}`,
  ];

  let defects = 0;
  if (invertedPersisted && !invertedHint) {
    defects += 1;
    emit({
      id: "C7-inverted-hp-persisted",
      probeId: "C7",
      tabs: ["troops"],
      S: 3,
      B: 3,
      title: "C7: enemy-HP min>max persisted with no validation hint — event can never fire",
      repro,
      evidence: await shot(page, "C7-minmax"),
      status: "confirmed",
    });
  }
  if (actorCond && !actorWarn) {
    defects += 1;
    emit({
      id: "C7-actorhp-no-hint",
      probeId: "C7",
      tabs: ["troops"],
      S: 2,
      B: 2,
      title: "C7: actor-HP condition saved on a troop with no actor members and no hint",
      repro: [...repro, `actorMembers=${actorMembers}`],
      evidence: await shot(page, "C7-actorhp"),
      status: "confirmed",
    });
  }
  if (defects === 0) {
    clean("C7", ["troops"], "C7: invalid troop conditions were validated or hinted", repro);
  }
}

async function probeClassBattleCommands(page: Page): Promise<void> {
  await page.locator(".db-list-row").first().click();
  const list = page.getByTestId("db-class-command-list");
  await expect(list).toBeVisible({ timeout: 8_000 });
  const editableCount = async (): Promise<number> =>
    page.locator(".db-class-command-row").evaluateAll((nodes) =>
      nodes.filter((node) => (node as HTMLElement).dataset.testid !== "db-class-command-row-locked").length,
    );
  const add = page.getByTestId("db-class-command-add");
  let count = await editableCount();
  while (count < 6 && (await add.isEnabled())) {
    await add.click();
    const next = await editableCount();
    if (next <= count) break;
    count = next;
  }
  const atCap = await editableCount();
  const addDisabled = await add.isDisabled();
  if (!addDisabled) await add.click({ force: true }).catch(() => undefined);
  const afterSeventh = await editableCount();
  const exportedAfterAdd = (await projectOf(page)).database.classes[0]?.battleCommands ?? [];
  const exportedEditable = exportedAfterAdd.filter((command) => command.kind !== "switch" || command.name !== "교체");
  const seventhAccepted = afterSeventh > 6 || exportedEditable.length > 6;

  const kind = page.getByTestId("db-field-class-command-kind");
  await expect(kind).toBeVisible({ timeout: 8_000 });
  await kind.selectOption("skill");
  const skill = page.getByTestId("db-picker-class-command-skill");
  const subset = page.getByTestId("db-field-class-command-subset");
  const skillEnabledForSkill = await skill.isEnabled();
  const skillValue = await skill.inputValue();
  const emptySkillPersisted = skillValue === "";
  const afterSkillKind = (await projectOf(page)).database.classes[0]?.battleCommands ?? [];
  const editedSkillRow = afterSkillKind[0];

  await kind.selectOption("guard");
  const subsetEnabledForGuard = await subset.isEnabled();
  const skillEnabledForGuard = await skill.isEnabled();

  const exported = (await projectOf(page)).database.classes[0]?.battleCommands ?? [];
  const skillRow = editedSkillRow;
  const guardRow = exported[0];
  const repro = [
    "classes tab → first class → battle command workbench",
    "click + 명령 추가 until 6, try a 7th",
    "set row 0 kind=skill with skillId empty; then kind=guard",
    `atCap=${atCap} addDisabled=${addDisabled} afterSeventh=${afterSeventh}`,
    `skillEnabled=${skillEnabledForSkill} emptySkill=${emptySkillPersisted} guard subset/skill enabled=${subsetEnabledForGuard}/${skillEnabledForGuard}`,
    `export kinds=${exported.map((command) => command.kind).join(",")}`,
  ];

  let defects = 0;
  if (seventhAccepted) {
    defects += 1;
    emit({
      id: "C6-seventh-accepted",
      probeId: "C6",
      tabs: ["classes"],
      S: 3,
      B: 2,
      title: "C6: class battleCommands accepted a 7th editable row (documented cap is 6)",
      repro,
      evidence: await shot(page, "C6-seventh"),
      status: "confirmed",
    });
  }
  if (skillEnabledForSkill && emptySkillPersisted && skillRow?.kind === "skill" && !skillRow.skillId) {
    defects += 1;
    emit({
      id: "C6-skill-without-id",
      probeId: "C6",
      tabs: ["classes"],
      S: 2,
      B: 2,
      title: "C6: kind=skill with no skillId is persisted with no validation hint",
      repro,
      evidence: await shot(page, "C6-skill-empty"),
      status: "confirmed",
    });
  }
  if (subsetEnabledForGuard || skillEnabledForGuard) {
    defects += 1;
    emit({
      id: "C6-guard-fields-live",
      probeId: "C6",
      tabs: ["classes"],
      S: 1,
      B: 2,
      title: "C6: kind=guard left skill-only fields editable (they are ignored at runtime)",
      repro: [...repro, `guardRow=${JSON.stringify(guardRow)}`],
      evidence: await shot(page, "C6-guard"),
      status: "confirmed",
    });
  }
  if (!addDisabled && atCap >= 6 && !seventhAccepted) {
    defects += 1;
    emit({
      id: "C6-add-not-disabled",
      probeId: "C6",
      tabs: ["classes"],
      S: 1,
      B: 1,
      title: "C6: add button stayed enabled at the 6-row cap (7th click was a no-op)",
      repro,
      evidence: await shot(page, "C6-add-enabled"),
      status: "confirmed",
    });
  }
  if (defects === 0) {
    clean("C6", ["classes"], "C6: 6-row cap held; guard disables skill-only fields", repro);
  }
}

async function probeFalseDirtyOnOpen(page: Page): Promise<void> {
  const paths = ["escape", "x", "cancel", "backdrop"] as const;
  const hits: string[] = [];
  for (const closePath of paths) {
    await ensureModalOpen(page);
    const oracle = await dirtyGuardOracle(page, closePath);
    if (oracle.promptShown) {
      hits.push(closePath);
      await page.getByTestId("database-dirty-keep-editing").click().catch(async () => {
        await page.getByTestId("database-dirty-discard").click().catch(() => undefined);
      });
    }
    const stillOpen = await visible(page.getByTestId("database-modal"), 500);
    if (stillOpen && !oracle.promptShown && closePath !== "backdrop") {
      hits.push(`${closePath}:did-not-close`);
    }
  }
  const repro = [
    "boot expert, open Database, touch nothing",
    "close via Escape / X / footer / backdrop",
    `false-dirty or stuck paths: ${hits.join(",") || "(none)"}`,
  ];
  if (hits.length > 0) {
    emit({
      id: "X2-false-dirty",
      probeId: "X2",
      tabs: ["items"],
      S: 1,
      B: 2,
      title: "X2: opening the Database with zero edits still prompted on close",
      repro,
      evidence: await shot(page, "X2-false-dirty"),
      status: "confirmed",
    });
    return;
  }
  clean("X2", ["items"], "X2: all four close paths dismissed a clean modal with no prompt", repro);
}

async function probeListenerLeak(page: Page): Promise<void> {
  const repro = [
    "open Database → dirty an actor name → Escape → Discard → reopen",
    "repeat x5",
    "then ONE Escape on a clean modal — N stacked prompts means leaked keydown listeners",
  ];
  for (let i = 0; i < 5; i += 1) {
    await ensureModalOpen(page);
    await switchTabAnyMode(page, ACTORS_TAB);
    const name = page.getByTestId("db-field-name");
    await expect(name).toBeVisible({ timeout: 8_000 });
    const current = await name.inputValue();
    await name.fill(`${current}-leak${i}`);
    const oracle = await dirtyGuardOracle(page, "escape");
    if (oracle.promptShown) {
      await page.getByTestId("database-dirty-discard").click();
    } else if (await visible(page.getByTestId("database-modal"), 400)) {
      await page.getByTestId("database-modal-close").click().catch(() => undefined);
    }
    await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 8_000 });
  }
  await reopenDatabase(page);
  await page.keyboard.press("Escape");
  // Timing contract under attack: leaked document keydown listeners fire the
  // dirty prompt N times on a single Escape. One animation frame is enough to
  // let every queued listener run; we then count prompt nodes, not wall time.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const promptCount = await page.getByTestId("database-dirty-prompt").count();
  if (promptCount > 1) {
    emit({
      id: "X3-listener-leak",
      probeId: "X3",
      tabs: ["actors"],
      S: 2,
      B: 2,
      title: `X3: one Escape after 5 dirty-Discard cycles showed ${promptCount} dirty prompts (leaked keydown)`,
      repro,
      evidence: await shot(page, "X3-leak"),
      status: "confirmed",
    });
    return;
  }
  clean("X3", ["actors"], "X3: five dirty-Discard cycles left a single Escape listener", repro);
}

async function probeFilterChipPersistence(page: Page): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const chip = page.getByTestId("db-filter-chip-medicine");
  await expect(chip).toBeVisible({ timeout: 8_000 });
  await chip.click();
  await expect(chip).toHaveClass(/active/);
  if (await visible(page.getByTestId("database-dirty-prompt"), 200)) {
    await page.getByTestId("database-dirty-keep-editing").click().catch(() => undefined);
  }
  const oracle = await dirtyGuardOracle(page, "x");
  if (oracle.promptShown) {
    await page.getByTestId("database-dirty-discard").click();
  }
  await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 8_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissBootChrome(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await reopenDatabase(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const chipAfter = page.getByTestId("db-filter-chip-medicine");
  const active = await chipAfter.evaluate((node) => node.classList.contains("active")).catch(() => false);
  const pressed = (await chipAfter.getAttribute("aria-pressed")) === "true";
  const repro = [
    "items tab → click db-filter-chip-medicine",
    "close Database, reload, reopen, items tab",
    `activeClass=${active} aria-pressed=${pressed}`,
  ];
  if (!active) {
    emit({
      id: "X6-chip-not-active",
      probeId: "X6",
      tabs: ["items"],
      S: 3,
      B: 3,
      title: "X6: persisted category filter did not show the medicine chip as active after reload",
      repro,
      evidence: await shot(page, "X6-chip"),
      status: "confirmed",
    });
    return;
  }
  clean("X6", ["items"], "X6: medicine filter chip stayed visually active after reload", repro);
}

async function probeVirtualizerOffscreenSelection(page: Page): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const allChip = page.getByTestId("db-filter-chip-all");
  if (await visible(allChip, 1_000)) await allChip.click();
  const items = (await projectOf(page)).database.items;
  const target = [...items].reverse().find((item) => item.name.trim().length > 0) ?? items[items.length - 1];
  if (!target) {
    emit({
      id: "X13-no-items",
      probeId: "X13",
      tabs: ["items"],
      S: 2,
      B: 0,
      title: "X13: freshProject had no items to search",
      repro: ["items.length=0"],
      evidence: [],
      status: "confirmed",
    });
    return;
  }
  const search = page.locator(".db-body .db-search input").first();
  await expect(search).toBeVisible({ timeout: 8_000 });
  await search.fill(target.name);
  const row = page.getByTestId(`db-record-row-${target.id}`);
  await expect(row).toBeVisible({ timeout: 8_000 });
  await row.click();
  await search.fill("");
  // Search input debounces rerender at 80ms (databaseRecordViews.recordSearch).
  // Poll the selected row instead of sleeping that window.
  let inDom = false;
  try {
    await expect
      .poll(async () => page.getByTestId(`db-record-row-${target.id}`).count(), { timeout: 5_000 })
      .toBeGreaterThan(0);
    inDom = true;
  } catch {
    inDom = false;
  }
  const repro = [
    `items=177 → search offscreen record ${target.id} (${target.name})`,
    "select the row, clear search",
    "selected row must remain in the DOM (virtualizer must scroll it in)",
    `inDom=${inDom}`,
  ];
  if (!inDom) {
    emit({
      id: "X13-selection-missing",
      probeId: "X13",
      tabs: ["items"],
      S: 2,
      B: 3,
      title: "X13: selected offscreen item vanished from the DOM after clearing search",
      repro,
      evidence: await shot(page, "X13-missing"),
      status: "confirmed",
    });
    return;
  }
  clean("X13", ["items"], "X13: virtualizer kept the selected offscreen item mounted", repro);
}
