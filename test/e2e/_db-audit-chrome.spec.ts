import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  bandForScore,
  bootDbLane,
  collectConsoleErrors,
  COMMON_DB_TAB_TEST_IDS,
  dirtyGuardOracle,
  mutatedProject,
  recordFinding,
  SEEDING_PROVEN,
  switchTabAnyMode,
  VIRTUALIZER_THRESHOLD,
  type AuditFinding,
  type EditorLaneMode,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject, type DatabaseTabSpec } from "./oprn-database-helpers";

/**
 * Diagnostic adversarial audit of Database chrome + Overview (todo 13).
 * `_` prefix keeps it out of the default suite. Probe outcome != test failure:
 * assert only harness invariants. Every contract deviation is a scored finding.
 */

test.use({ serviceWorkers: "block" });

const SPEC = "_db-audit-chrome";
const SHOT_DIR = "output/evidence/db-beginner-audit/shots";
const DIFF_DIR = "output/evidence/db-beginner-audit/diffs";
const FINDINGS_PATH = `output/evidence/db-beginner-audit/findings/${SPEC}.json`;

const ACTORS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const SWITCHES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "switches")!;
const TERRAIN_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "terrain")!;
const TILESETS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "tilesets")!;
const ELEMENTS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "elements")!;
const SKILLS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "skills")!;
const OVERVIEW_TAB = { label: "Overview", slug: "overview", testId: "db-tab-overview" } as const satisfies DatabaseTabSpec;

const EXTRA_TABS: readonly DatabaseTabSpec[] = [
  OVERVIEW_TAB,
  { label: "Crops", slug: "crops", testId: "db-tab-crops" },
  { label: "Characters", slug: "characters", testId: "db-tab-characters" },
  { label: "Monster Species", slug: "monster-species", testId: "db-tab-monster-species" },
  { label: "Structure Kits", slug: "structure-kits", testId: "db-tab-structure-kits" },
];

/** W2 group order (overview pinned, then TAB_GROUPS). 24 surfaces. */
const GROUP_ORDER_TEST_IDS = [
  "db-tab-overview",
  "db-tab-actors",
  "db-tab-classes",
  "db-tab-skills",
  "db-tab-items",
  "db-tab-equipment",
  "db-tab-elements",
  "db-tab-states",
  "db-tab-animations",
  "db-tab-battle-screen",
  "db-tab-battle-commands",
  "db-tab-enemies",
  "db-tab-monster-species",
  "db-tab-troops",
  "db-tab-crops",
  "db-tab-characters",
  "db-tab-terrain",
  "db-tab-tilesets",
  "db-tab-structure-kits",
  "db-tab-common-events",
  "db-tab-system",
  "db-tab-terms",
  "db-tab-switches",
  "db-tab-variables",
] as const;

const CLOSE_PATHS = ["escape", "backdrop", "x", "cancel"] as const;
const DECISIONS = ["save", "discard", "keep"] as const;
const OFFSCREEN_ITEM = { id: "item_gen_lamp_oil", name: "기름 등불" } as const;
const TOWN_TILESET_ROW = "tileset-db-row-easyrpg_chipset_combined_town";
const HELP_TOAST = "데이터베이스에서 레코드와 시스템 설정을 조정합니다.";
const VIEW_MODE_KEY = "oprn:database.viewMode";
const ACTIVE_TAB_KEY = "oprn:database.activeTab";
const HARDCODED_H2 = "데이터베이스";

type ClosePath = (typeof CLOSE_PATHS)[number];
type Decision = (typeof DECISIONS)[number];
type Severity = 0 | 1 | 2 | 3 | 4;
type BeginnerImpact = 0 | 1 | 2 | 3;
type FindingDraft = Omit<AuditFinding, "spec" | "score" | "band">;

type DirtyCell = {
  readonly closePath: ClosePath;
  readonly decision: Decision;
  readonly promptShown: boolean;
  readonly modalOpenAfter: boolean;
  readonly nameBefore: string;
  readonly nameAfter: string;
  readonly ok: boolean;
  readonly note: string;
};

function tabByTestId(testId: string): DatabaseTabSpec {
  const fromHelper = DATABASE_TAB_SPECS.find((tab) => tab.testId === testId);
  if (fromHelper) return fromHelper;
  const extra = EXTRA_TABS.find((tab) => tab.testId === testId);
  if (extra) return extra;
  throw new Error(`unknown tab testId ${testId}`);
}

function emit(draft: FindingDraft): void {
  const score = draft.S * draft.B;
  recordFinding({
    spec: SPEC,
    ...draft,
    score,
    band: bandForScore(score),
  });
}

function emitClean(
  id: string,
  probeId: string,
  tabs: readonly string[],
  title: string,
  repro: readonly string[],
  evidence: readonly string[] = [],
): void {
  emit({
    id,
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
  readonly id: string;
  readonly probeId: string;
  readonly tabs: readonly string[];
  readonly S: Severity;
  readonly B: BeginnerImpact;
  readonly title: string;
  readonly repro: readonly string[];
  readonly evidence: readonly string[];
  readonly status?: AuditFinding["status"];
}): void {
  emit({
    id: opts.id,
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
  mkdirSync(SHOT_DIR, { recursive: true });
  const path = `${SHOT_DIR}/${SPEC}-${name}.png`;
  try {
    if (page.isClosed()) return `${path} (page-closed)`;
    const modal = page.getByTestId("database-modal");
    if (await modal.isVisible().catch(() => false)) await modal.screenshot({ path });
    else await page.screenshot({ path });
    return path;
  } catch (error) {
    return `${path} (unavailable: ${error instanceof Error ? error.message : String(error)})`;
  }
}

function writeJson(name: string, value: unknown): string {
  mkdirSync(DIFF_DIR, { recursive: true });
  const path = `${DIFF_DIR}/${SPEC}-${name}.json`;
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

async function runProbe(
  page: Page,
  errors: string[],
  probeId: string,
  tabs: readonly string[],
  body: () => Promise<void>,
): Promise<void> {
  const before = errors.length;
  try {
    await body();
  } catch (error) {
    const evidence = await shot(page, `${probeId.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-threw`);
    emitDefect({
      id: `${probeId}-threw`,
      probeId,
      tabs,
      S: 2,
      B: 1,
      title: `${probeId} probe threw before it could finish`,
      repro: [`runProbe ${probeId}`, error instanceof Error ? error.message : String(error)],
      evidence: [evidence],
      status: "unconfirmed-vqa",
    });
  }
  const fresh = errors.slice(before);
  if (fresh.length > 0) {
    const evidence = await shot(page, `${probeId.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-console`);
    emitDefect({
      id: `${probeId}-console`,
      probeId,
      tabs,
      S: 1,
      B: 1,
      title: `${probeId} emitted console errors`,
      repro: [`run ${probeId}`, ...fresh.slice(0, 6)],
      evidence: [evidence],
    });
  }
}

async function reopenDatabase(page: Page): Promise<void> {
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

async function dismissDirtyIfAny(page: Page, decision: "discard" | "keep" | "save" = "discard"): Promise<boolean> {
  const prompt = page.getByTestId("database-dirty-prompt");
  if (!(await prompt.isVisible().catch(() => false))) return false;
  const testId =
    decision === "save"
      ? "database-dirty-save"
      : decision === "keep"
        ? "database-dirty-keep-editing"
        : "database-dirty-discard";
  await page.getByTestId(testId).click();
  if (decision === "keep") {
    await expect(prompt).toBeHidden();
    return true;
  }
  await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 8_000 });
  return true;
}

async function closeModalClean(page: Page): Promise<void> {
  if (!(await page.getByTestId("database-modal").isVisible().catch(() => false))) return;
  await page.keyboard.press("Escape");
  if (await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false)) {
    await page.getByTestId("database-dirty-discard").click();
  }
  await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 8_000 });
}

async function ensureModal(page: Page): Promise<void> {
  await reopenDatabase(page);
  if (await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false)) {
    await page.getByTestId("database-dirty-keep-editing").click().catch(async () => {
      await page.getByTestId("database-dirty-discard").click().catch(() => undefined);
    });
  }
}

async function dismissBootChrome(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click();
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
}

async function reloadEditor(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissBootChrome(page);
}

async function actorNameOf(page: Page): Promise<string> {
  const project = await exportedProject(page);
  return project.database.actors[0]?.name ?? "";
}

async function waitActorName(page: Page, expected: string, timeout = 3_000): Promise<string> {
  let last = "";
  try {
    await expect.poll(async () => {
      last = await actorNameOf(page);
      return last;
    }, { timeout }).toBe(expected);
  } catch {
    last = await actorNameOf(page);
  }
  return last;
}

async function fillActorName(page: Page, value: string): Promise<string> {
  await ensureModal(page);
  await switchTabAnyMode(page, ACTORS_TAB);
  const name = page.getByTestId("db-field-name");
  await expect(name).toBeVisible({ timeout: 8_000 });
  const before = await name.inputValue();
  await name.fill(value);
  await expect
    .poll(async () => page.getByTestId("db-field-name").inputValue(), { timeout: 3_000 })
    .toBe(value);
  return before;
}

async function modalMetrics(page: Page): Promise<{
  overflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  footerOkInView: boolean;
  footerApplyInView: boolean;
  viewport: { width: number; height: number };
}> {
  return page.evaluate(() => {
    const modal = document.querySelector(".database-modal-window");
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const inView = (testId: string): boolean => {
      const node = document.querySelector(`[data-testid='${testId}']`);
      if (!(node instanceof HTMLElement)) return false;
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1 && box.top >= -1 && box.left >= -1;
    };
    if (!(modal instanceof HTMLElement)) {
      return {
        overflow: true,
        scrollWidth: 0,
        clientWidth: 0,
        footerOkInView: inView("database-footer-ok"),
        footerApplyInView: inView("database-footer-apply"),
        viewport,
      };
    }
    return {
      overflow: modal.scrollWidth > modal.clientWidth + 1,
      scrollWidth: modal.scrollWidth,
      clientWidth: modal.clientWidth,
      footerOkInView: inView("database-footer-ok"),
      footerApplyInView: inView("database-footer-apply"),
      viewport,
    };
  });
}

test.describe("DB audit — chrome + overview", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
    mkdirSync(DIFF_DIR, { recursive: true });
    mkdirSync("output/evidence/db-beginner-audit/findings", { recursive: true });
    writeFileSync(FINDINGS_PATH, "[]\n", "utf8");
  });

  test("expert lane X1–X6 X8 X9 X11–X13", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await runProbe(page, errors, "X2", ["actors"], () => probeX2(page, "expert"));
    await runProbe(page, errors, "X1", ["actors"], () => probeX1(page, "expert"));
    await runProbe(page, errors, "X3", ["actors"], () => probeX3(page));
    await runProbe(page, errors, "X4", ["items", "switches"], () => probeX4(page));
    await runProbe(page, errors, "X5", ["items"], () => probeX5(page, "expert"));
    await runProbe(page, errors, "X6", ["items"], () => probeX6(page));
    await runProbe(page, errors, "X13", ["items"], () => probeX13(page));
    await runProbe(page, errors, "X8", ["actors"], () => probeX8(page));
    await runProbe(page, errors, "X9", ["actors"], () => probeX9(page, "expert"));
    await runProbe(page, errors, "X11", [...GROUP_ORDER_TEST_IDS], () => probeX11(page));
    await runProbe(page, errors, "X12", ["actors"], () => probeX12(page));
    await runProbe(page, errors, "R3", [...COMMON_DB_TAB_TEST_IDS], () => probeR3ExpertCapture(page));
  });

  test("expert lane X10 1024x768 + 150% zoom", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert", viewport: { width: 1024, height: 768 } });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await runProbe(page, errors, "X10", ["actors", "items"], () => probeX10(page, "expert"));
  });

  test("expert lane overview F1–F6 + R1 tilesets", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await runProbe(page, errors, "F1", ["overview"], () => probeF1(page));
    await runProbe(page, errors, "F5", ["overview"], () => probeF5(page));
    await runProbe(page, errors, "F4", ["overview"], () => probeF4(page));
    await runProbe(page, errors, "F6", ["overview"], () => probeF6(page));
    await runProbe(page, errors, "F3", ["overview"], () => probeF3(page));
    await runProbe(page, errors, "F2", ["overview"], () => probeF2(page));
    await runProbe(page, errors, "R1", ["tilesets"], () => probeR1(page));
  });

  test("expert lane F7 seeded activeTab=overview", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, {
      mode: "expert",
      localStorageSeed: { [ACTIVE_TAB_KEY]: "overview" },
    });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await runProbe(page, errors, "F7", ["overview"], () => probeF7(page));
  });

  test("expert lane X7 corrupted localStorage", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, {
      mode: "expert",
      localStorageSeed: {
        [VIEW_MODE_KEY]: "{{{",
        [ACTIVE_TAB_KEY]: "not-a-real-tab",
      },
    });
    await runProbe(page, errors, "X7", ["actors"], () => probeX7(page, errors));
  });

  test("beginner lane X1/X2/X5/X9/X10 + R2–R4 + G + help/coach", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner", viewport: { width: 1024, height: 768 } });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await runProbe(page, errors, "G1", ["overview"], () => probeG1(page));
    await runProbe(page, errors, "R4", ["overview"], () => probeR4(page));
    await runProbe(page, errors, "R3", [...COMMON_DB_TAB_TEST_IDS], () => probeR3Compare(page));
    await runProbe(page, errors, "G4", ["actors"], () => probeHelpAndCoach(page));
    await runProbe(page, errors, "X2", ["actors"], () => probeX2(page, "beginner"));
    await runProbe(page, errors, "X1", ["actors"], () => probeX1(page, "beginner"));
    await runProbe(page, errors, "X5", ["items"], () => probeX5(page, "beginner"));
    await runProbe(page, errors, "X9", ["actors"], () => probeX9(page, "beginner"));
    await runProbe(page, errors, "R2", [...COMMON_DB_TAB_TEST_IDS], () => probeR2(page));
    await runProbe(page, errors, "X10", ["actors", "items"], () => probeX10(page, "beginner"));
    await runProbe(page, errors, "G2", ["elements"], () => probeG2(page));
    await runProbe(page, errors, "G5", ["overview"], () => probeG5(page));
  });
});

// ---------------------------------------------------------------------------
// X1 — 12-cell dirty matrix
// ---------------------------------------------------------------------------
async function probeX1(page: Page, mode: EditorLaneMode): Promise<void> {
  const cells: DirtyCell[] = [];
  for (const closePath of CLOSE_PATHS) {
    for (const decision of DECISIONS) {
      cells.push(await runDirtyCell(page, closePath, decision, mode));
    }
  }
  const tablePath = writeJson(`x1-${mode}-matrix`, { mode, cells });
  const evidence = await shot(page, `x1-${mode}`);
  let failed = 0;
  for (const cell of cells) {
    const id = `X1-${mode}-${cell.closePath}-${cell.decision}`;
    const repro = [
      `bootDbLane ${mode}`,
      "actors → edit db-field-name",
      `close via ${cell.closePath} then ${cell.decision}`,
      `promptShown=${cell.promptShown} modalOpenAfter=${cell.modalOpenAfter}`,
      `nameBefore=${cell.nameBefore} nameAfter=${cell.nameAfter}`,
      cell.note,
    ];
    if (cell.ok) {
      emitClean(id, "X1", ["actors"], `X1 ${mode} ${cell.closePath}/${cell.decision} held`, repro, [evidence, tablePath]);
    } else {
      failed += 1;
      const silentClose = !cell.promptShown;
      emitDefect({
        id,
        probeId: "X1",
        tabs: ["actors"],
        S: silentClose ? 4 : 3,
        B: silentClose ? 3 : 2,
        title: `X1 ${mode} ${cell.closePath}/${cell.decision}: ${cell.note}`,
        repro,
        evidence: [evidence, tablePath],
      });
    }
  }
  if (failed === 0) {
    emitClean(
      `X1-${mode}-matrix`,
      "X1",
      ["actors"],
      `X1 ${mode} 12-cell dirty matrix all held`,
      [`see ${tablePath}`],
      [evidence, tablePath],
    );
  }
}

async function runDirtyCell(page: Page, closePath: ClosePath, decision: Decision, mode: EditorLaneMode): Promise<DirtyCell> {
  await ensureModal(page);
  await dismissDirtyIfAny(page, "discard");
  await ensureModal(page);
  const sentinel = `X1-${mode}-${closePath}-${decision}`;
  const nameBefore = await fillActorName(page, sentinel);
  const close = await dirtyGuardOracle(page, closePath);
  const promptShown = close.promptShown;
  if (!promptShown) {
    const modalOpenAfter = await page.getByTestId("database-modal").isVisible().catch(() => false);
    const nameAfter = await actorNameOf(page);
    if (modalOpenAfter) await dismissDirtyIfAny(page, "discard");
    else await ensureModal(page);
    return {
      closePath,
      decision,
      promptShown,
      modalOpenAfter,
      nameBefore,
      nameAfter,
      ok: false,
      note: `closed via ${closePath} without a 3-way prompt (silent close)`,
    };
  }

  const button =
    decision === "save"
      ? "database-dirty-save"
      : decision === "discard"
        ? "database-dirty-discard"
        : "database-dirty-keep-editing";
  await page.getByTestId(button).click();

  if (decision === "keep") {
    const modalOpenAfter = await page.getByTestId("database-modal").isVisible().catch(() => false);
    const promptGone = !(await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false));
    const nameAfter = await waitActorName(page, sentinel);
    const stillDirty = await confirmStillDirty(page);
    const ok = modalOpenAfter && promptGone && nameAfter === sentinel && stillDirty;
    await dismissDirtyIfAny(page, "discard");
    return {
      closePath,
      decision,
      promptShown,
      modalOpenAfter,
      nameBefore,
      nameAfter,
      ok,
      note: ok
        ? "Keep Editing kept the modal and the dirty state"
        : `Keep Editing failed modalOpen=${modalOpenAfter} promptGone=${promptGone} stillDirty=${stillDirty} name=${nameAfter}`,
    };
  }

  await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 8_000 }).catch(() => undefined);
  const modalOpenAfter = await page.getByTestId("database-modal").isVisible().catch(() => false);
  const nameAfter = await waitActorName(page, decision === "save" ? sentinel : nameBefore);
  if (decision === "save") {
    const ok = !modalOpenAfter && nameAfter === sentinel;
    return {
      closePath,
      decision,
      promptShown,
      modalOpenAfter,
      nameBefore,
      nameAfter,
      ok,
      note: ok ? "Save persisted and closed" : `Save expected persist+close, got modalOpen=${modalOpenAfter} name=${nameAfter}`,
    };
  }
  const ok = !modalOpenAfter && nameAfter === nameBefore;
  if (!ok) await ensureModal(page);
  return {
    closePath,
    decision,
    promptShown,
    modalOpenAfter,
    nameBefore,
    nameAfter,
    ok,
    note: ok
      ? "Discard restored the modal-open snapshot and closed"
      : `Discard expected restore+close, got modalOpen=${modalOpenAfter} name=${nameAfter} (snapshot ${nameBefore})`,
  };
}

async function confirmStillDirty(page: Page): Promise<boolean> {
  if (!(await page.getByTestId("database-modal").isVisible().catch(() => false))) return false;
  const again = await dirtyGuardOracle(page, "escape");
  if (again.promptShown) {
    await page.getByTestId("database-dirty-keep-editing").click();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// X2 — false-dirty on open
// ---------------------------------------------------------------------------
async function probeX2(page: Page, mode: EditorLaneMode): Promise<void> {
  const hits: string[] = [];
  for (const closePath of CLOSE_PATHS) {
    await ensureModal(page);
    await dismissDirtyIfAny(page, "discard");
    await ensureModal(page);
    const result = await dirtyGuardOracle(page, closePath);
    if (result.promptShown) {
      hits.push(closePath);
      await dismissDirtyIfAny(page, "discard");
    }
    const stillOpen = await page.getByTestId("database-modal").isVisible().catch(() => false);
    if (stillOpen && !result.promptShown && closePath !== "backdrop") hits.push(`${closePath}:did-not-close`);
    await ensureModal(page);
  }
  const evidence = await shot(page, `x2-${mode}`);
  const repro = [
    `bootDbLane ${mode}, touch nothing`,
    "close via Escape / backdrop / X / footer 닫기",
    `false-dirty or stuck paths: ${hits.join(",") || "(none)"}`,
  ];
  if (hits.length === 0) {
    emitClean(`X2-${mode}`, "X2", ["actors"], `X2 ${mode}: clean open does not raise a dirty prompt`, repro, [evidence]);
    return;
  }
  emitDefect({
    id: `X2-${mode}-false-dirty`,
    probeId: "X2",
    tabs: ["actors"],
    S: 2,
    B: 3,
    title: `X2 ${mode}: false-dirty on open trains beginners to click Discard`,
    repro,
    evidence: [evidence],
  });
}

// ---------------------------------------------------------------------------
// X3 — listener leak
// ---------------------------------------------------------------------------
async function probeX3(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await ensureModal(page);
    await fillActorName(page, `leak-${i}`);
    const close = await dirtyGuardOracle(page, "escape");
    if (close.promptShown) await page.getByTestId("database-dirty-discard").click();
    await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 8_000 });
  }
  await ensureModal(page);
  await fillActorName(page, "leak-final");
  await page.keyboard.press("Escape");
  // Timing contract under attack: leaked document keydown listeners fire N
  // dirty prompts on a single Escape. One rAF lets every queued listener run.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const prompts = await page.getByTestId("database-dirty-prompt").count();
  const evidence = await shot(page, "x3-leak");
  const repro = [
    "open → dirty db-field-name → Escape → Discard → reopen, five times",
    "edit once more, press Escape once",
    `database-dirty-prompt count=${prompts}`,
  ];
  if (prompts > 1) {
    emitDefect({
      id: "X3-listener-leak",
      probeId: "X3",
      tabs: ["actors"],
      S: 3,
      B: 2,
      title: `X3: one Escape after 5 dirty-Discard cycles showed ${prompts} dirty prompts (leaked keydown)`,
      repro,
      evidence: [evidence],
    });
  } else {
    emitClean("X3-ok", "X3", ["actors"], "X3: five dirty-Discard cycles left a single Escape listener", repro, [evidence]);
  }
  await dismissDirtyIfAny(page, "discard");
}

// ---------------------------------------------------------------------------
// X4 — gallery / list view persistence
// ---------------------------------------------------------------------------
async function probeX4(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const galleryToggle = page.getByTestId("db-view-toggle-gallery");
  const listToggle = page.getByTestId("db-view-toggle-list");
  await expect(galleryToggle).toBeVisible({ timeout: 8_000 });
  await expect(listToggle).toBeVisible();

  await galleryToggle.click();
  const afterGallery = await inspectItemsView(page);
  const galleryEvidence = await shot(page, "x4-gallery");
  const galleryCause = writeJson("x4-gallery-dom", afterGallery);

  if (afterGallery.cardCount === 0) {
    emitDefect({
      id: "X4-gallery-cards-missing",
      probeId: "X4",
      tabs: ["items"],
      S: 3,
      B: 3,
      title: "X4: items gallery toggle produces zero db-record-card-* (desktop-matrix root cause)",
      repro: [
        "items → db-view-toggle-gallery",
        "expect [data-testid^='db-record-card-']",
        `cardCount=${afterGallery.cardCount} rowCount=${afterGallery.rowCount} hasGalleryClass=${afterGallery.hasGalleryClass} viewMode=${afterGallery.viewMode}`,
        afterGallery.note,
      ],
      evidence: [galleryEvidence, galleryCause],
      status: "pre-existing",
    });
  } else {
    emitClean(
      "X4-gallery-renders",
      "X4",
      ["items"],
      `X4: gallery rendered ${afterGallery.cardCount} cards`,
      ["items → db-view-toggle-gallery"],
      [galleryEvidence, galleryCause],
    );
  }

  await listToggle.click();
  await expect(listToggle).toHaveClass(/active/);
  await closeModalClean(page);
  await reloadEditor(page);
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const restored = await inspectItemsView(page);
  const listActive = await listToggle.evaluate((node) => node.classList.contains("active")).catch(() => false);
  const evidence = await shot(page, "x4-list-restore");
  const repro = [
    "items → gallery → list, close, reload, reopen items",
    `stored viewMode=${restored.viewMode} listActive=${listActive}`,
  ];
  if (listActive && restored.viewMode.includes("list")) {
    emitClean("X4-list-persists", "X4", ["items"], "X4: items list view restored from oprn:database.viewMode", repro, [evidence]);
  } else {
    emitDefect({
      id: "X4-list-not-restored",
      probeId: "X4",
      tabs: ["items"],
      S: 2,
      B: 2,
      title: "X4: items list viewMode did not restore after reload",
      repro,
      evidence: [evidence],
    });
  }

  await switchTabAnyMode(page, SWITCHES_TAB);
  const toggleOnSwitches = await page.getByTestId("db-view-toggle-gallery").count();
  if (toggleOnSwitches === 0) {
    emitClean(
      "X4-toggle-absent-switches",
      "X4",
      ["switches"],
      "X4: gallery toggle is absent on switches (non-gallery collection)",
      ["open switches, count db-view-toggle-gallery === 0"],
      [await shot(page, "x4-switches")],
    );
  } else {
    emitDefect({
      id: "X4-toggle-on-switches",
      probeId: "X4",
      tabs: ["switches"],
      S: 1,
      B: 1,
      title: "X4: gallery toggle appeared on a collection that does not support gallery",
      repro: ["open switches", `db-view-toggle-gallery count=${toggleOnSwitches}`],
      evidence: [await shot(page, "x4-switches-toggle")],
    });
  }
}

async function inspectItemsView(page: Page): Promise<{
  cardCount: number;
  rowCount: number;
  hasGalleryClass: boolean;
  viewMode: string;
  listDisplay: string;
  listHeight: number;
  note: string;
}> {
  return page.evaluate((key) => {
    const cards = document.querySelectorAll("[data-testid^='db-record-card-']").length;
    const rows = document.querySelectorAll("[data-testid^='db-record-row-']").length;
    const list = document.querySelector(".db-body .db-list");
    const style = list instanceof HTMLElement ? getComputedStyle(list) : null;
    return {
      cardCount: cards,
      rowCount: rows,
      hasGalleryClass: Boolean(list?.classList.contains("db-gallery")),
      viewMode: window.localStorage.getItem(key) ?? "",
      listDisplay: style?.display ?? "missing",
      listHeight: list instanceof HTMLElement ? list.clientHeight : 0,
      note:
        cards === 0
          ? `gallery cards absent; list class=${list?.className ?? "none"} display=${style?.display ?? "missing"} height=${list instanceof HTMLElement ? list.clientHeight : 0}`
          : `gallery cards present (${cards})`,
    };
  }, VIEW_MODE_KEY);
}

// ---------------------------------------------------------------------------
// X5 — filter chip + search AND-logic
// ---------------------------------------------------------------------------
async function probeX5(page: Page, mode: EditorLaneMode): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const allChip = page.getByTestId("db-filter-chip-all");
  if (await allChip.isVisible().catch(() => false)) await allChip.click();
  const medicine = page.getByTestId("db-filter-chip-medicine");
  await expect(medicine).toBeVisible({ timeout: 8_000 });
  await medicine.click();
  await expect(medicine).toHaveClass(/active/);

  const project = await exportedProject(page);
  const excluded = project.database.items.find((item) => item.type !== "medicine" && item.name.trim().length > 0);
  const query = excluded?.name ?? "청동 검-not-a-medicine";
  const search = page.locator(".db-body .db-search input").first();
  await expect(search).toBeVisible();
  await search.fill(query);
  await expect
    .poll(async () => page.locator(".db-body .db-search input").first().inputValue(), { timeout: 2_000 })
    .toBe(query);

  const rowCount = await page.locator("[data-testid^='db-record-row-']").count();
  const cardCount = await page.locator("[data-testid^='db-record-card-']").count();
  const detailText = ((await page.getByTestId("db-detail-form").textContent()) ?? "").trim();
  const hint =
    detailText.includes("레코드가 없습니다") ||
    (await page.locator(".db-empty-list-hint, .empty-state, .db-list-empty").count()) > 0;
  const evidence = await shot(page, `x5-${mode}`);
  const zero = rowCount + cardCount === 0;
  const repro = [
    `bootDbLane ${mode}`,
    "items → db-filter-chip-medicine",
    `search "${query}" (matches only a non-medicine record)`,
    `rows=${rowCount} cards=${cardCount} hint=${hint} detail=${detailText.slice(0, 80)}`,
  ];
  if (zero && hint) {
    emitClean(`X5-${mode}-and`, "X5", ["items"], `X5 ${mode}: medicine chip AND excluded-name search yielded zero + hint`, repro, [evidence]);
  } else {
    emitDefect({
      id: `X5-${mode}-and-failed`,
      probeId: "X5",
      tabs: ["items"],
      S: zero ? 1 : 3,
      B: hint ? 1 : 3,
      title: zero
        ? `X5 ${mode}: zero AND-results but no empty-state hint (records look deleted)`
        : `X5 ${mode}: medicine+excluded search still showed ${rowCount + cardCount} rows`,
      repro,
      evidence: [evidence],
    });
  }

  await allChip.click();
  const allActive = await allChip.evaluate((node) => node.classList.contains("active")).catch(() => false);
  if (allActive) {
    emitClean(`X5-${mode}-all-reset`, "X5", ["items"], `X5 ${mode}: db-filter-chip-all reset the category filter`, repro, [evidence]);
  } else {
    emitDefect({
      id: `X5-${mode}-all-not-reset`,
      probeId: "X5",
      tabs: ["items"],
      S: 3,
      B: 3,
      title: `X5 ${mode}: clicking db-filter-chip-all did not become active (filter stuck)`,
      repro,
      evidence: [evidence],
    });
  }
  await search.fill("");
}

// ---------------------------------------------------------------------------
// X6 — filter-chip persistence trap
// ---------------------------------------------------------------------------
async function probeX6(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const chip = page.getByTestId("db-filter-chip-medicine");
  await expect(chip).toBeVisible({ timeout: 8_000 });
  await chip.click();
  await expect(chip).toHaveClass(/active/);
  await closeModalClean(page);
  await reloadEditor(page);
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const restored = page.getByTestId("db-filter-chip-medicine");
  const visible = await restored.isVisible().catch(() => false);
  const active = visible && (await restored.getAttribute("class"))?.includes("active") === true;
  const pressed = visible && (await restored.getAttribute("aria-pressed")) === "true";
  const evidence = await shot(page, "x6-filter");
  const repro = [
    "items → db-filter-chip-medicine",
    "close, reload, reopen items",
    `visible=${visible} active=${active} aria-pressed=${pressed}`,
  ];
  if (visible && (active || pressed)) {
    emitClean("X6-ok", "X6", ["items"], "X6: medicine filter chip stayed visibly active after reload", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "X6-invisible-active",
    probeId: "X6",
    tabs: ["items"],
    S: 3,
    B: 3,
    title: "X6: persisted items filter is not visibly active after reload (records look deleted)",
    repro,
    evidence: [evidence],
  });
}

// ---------------------------------------------------------------------------
// X7 — corrupted localStorage
// ---------------------------------------------------------------------------
async function probeX7(page: Page, errors: string[]): Promise<void> {
  const modalOpen = await page.getByTestId("database-modal").isVisible().catch(() => false);
  const active = await page.locator(".db-tab.active").getAttribute("data-testid").catch(() => "");
  const evidence = await shot(page, "x7-corrupt");
  const repro = [
    `bootDbLane expert with ${VIEW_MODE_KEY}='{{{' and ${ACTIVE_TAB_KEY}='not-a-real-tab'`,
    `modalOpen=${modalOpen} activeTab=${active} console=${errors.length}`,
  ];
  if (!modalOpen) {
    emitDefect({
      id: "X7-bricked-profile",
      probeId: "X7",
      tabs: ["actors"],
      S: 4,
      B: 3,
      title: "X7: corrupted viewMode/activeTab prevented the Database modal from opening (bricked profile)",
      repro,
      evidence: [evidence],
    });
    return;
  }
  const fallbackActors = active === "db-tab-actors";
  if (fallbackActors && errors.length === 0) {
    emitClean("X7-ok", "X7", ["actors"], "X7: corrupted localStorage fell back to actors with a clean console", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "X7-ungraceful",
    probeId: "X7",
    tabs: ["actors"],
    S: errors.length > 0 ? 2 : 1,
    B: 1,
    title: `X7: modal opened but fallback/console was unclean (active=${active} errors=${errors.length})`,
    repro,
    evidence: [evidence],
  });
}

// ---------------------------------------------------------------------------
// X8 — resource picker
// ---------------------------------------------------------------------------
async function probeX8(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ACTORS_TAB);
  const face = page.getByTestId("db-field-face-resource");
  await expect(face).toBeVisible({ timeout: 8_000 });
  const beforeFace = await face.inputValue();
  const beforeChar = await page.getByTestId("db-field-character-resource").inputValue().catch(() => "");
  const pickerButton = page.getByRole("button", { name: "얼굴 리소스 선택" });
  await expect(pickerButton).toBeVisible();
  await pickerButton.click();
  const picker = page.getByTestId("db-actor-resource-dialog");
  await expect(picker).toBeVisible({ timeout: 8_000 });

  await page.keyboard.press("Escape");
  const pickerGone = await picker.isHidden().catch(() => true);
  const dirtyAfterEsc = await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false);
  const modalStill = await page.getByTestId("database-modal").isVisible().catch(() => false);
  const escEvidence = await shot(page, "x8-escape");
  if (pickerGone && !dirtyAfterEsc && modalStill) {
    emitClean(
      "X8-escape-ok",
      "X8",
      ["actors"],
      "X8: picker Escape closed the picker without the modal dirty guard",
      ["actors faceset 설정… → Escape"],
      [escEvidence],
    );
  } else {
    emitDefect({
      id: "X8-escape-routing",
      probeId: "X8",
      tabs: ["actors"],
      S: dirtyAfterEsc || !modalStill ? 3 : 2,
      B: 2,
      title: `X8: picker Escape routing failed (pickerGone=${pickerGone} dirty=${dirtyAfterEsc} modal=${modalStill})`,
      repro: ["open actor faceset picker", "press Escape"],
      evidence: [escEvidence],
    });
  }

  await ensureModal(page);
  await switchTabAnyMode(page, ACTORS_TAB);
  if (!(await picker.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "얼굴 리소스 선택" }).click();
    await expect(picker).toBeVisible({ timeout: 8_000 });
  }

  const search = page.getByTestId("db-actor-resource-dialog-search");
  await expect(search).toBeVisible();
  await search.fill("zzzz-no-such-faceset-qqqq");
  const emptyHint = page.locator(".db-resource-picker-empty");
  const hintVisible = await emptyHint.isVisible().catch(() => false);
  const hintText = hintVisible ? ((await emptyHint.textContent()) ?? "").trim() : "";
  const searchEvidence = await shot(page, "x8-search");
  if (hintVisible && hintText.includes("일치하는 리소스가 없습니다")) {
    emitClean("X8-search-hint", "X8", ["actors"], "X8: gibberish picker search showed the empty hint", [`hint=${hintText}`], [searchEvidence]);
  } else {
    emitDefect({
      id: "X8-search-no-hint",
      probeId: "X8",
      tabs: ["actors"],
      S: 1,
      B: 2,
      title: "X8: gibberish picker search did not show an empty-state hint",
      repro: ["reopen picker", "search zzzz-no-such-faceset-qqqq", `hintVisible=${hintVisible} text=${hintText}`],
      evidence: [searchEvidence],
    });
  }

  await search.fill("");
  const option = picker.locator("[data-testid^='db-actor-resource-dialog-option-']").nth(1);
  const optionCount = await picker.locator("[data-testid^='db-actor-resource-dialog-option-']").count();
  if (optionCount < 2) {
    emitDefect({
      id: "X8-no-options",
      probeId: "X8",
      tabs: ["actors"],
      S: 2,
      B: 1,
      title: "X8: faceset picker listed fewer than two resources",
      repro: [`optionCount=${optionCount}`],
      evidence: [await shot(page, "x8-no-options")],
    });
  } else {
    const chosenId = (await option.getAttribute("data-resource-id")) ?? "";
    await option.click();
    await page.getByTestId("db-actor-resource-dialog-ok").click();
    await expect(picker).toHaveCount(0);
    const afterFace = await page.getByTestId("db-field-face-resource").inputValue();
    const afterChar = await page.getByTestId("db-field-character-resource").inputValue().catch(() => "");
    const onlyFace = afterFace === chosenId && afterChar === beforeChar;
    const writeEvidence = await shot(page, "x8-write");
    if (onlyFace) {
      emitClean(
        "X8-single-field",
        "X8",
        ["actors"],
        "X8: picker write touched only faceResourceId",
        [`beforeFace=${beforeFace} afterFace=${afterFace} chosen=${chosenId} charUnchanged=${afterChar === beforeChar}`],
        [writeEvidence],
      );
    } else {
      emitDefect({
        id: "X8-wrong-field",
        probeId: "X8",
        tabs: ["actors"],
        S: 3,
        B: 2,
        title: "X8: picker write did not isolate the faceset field",
        repro: [`chosen=${chosenId} afterFace=${afterFace} afterChar=${afterChar} beforeChar=${beforeChar}`],
        evidence: [writeEvidence],
      });
    }
  }

  await page.getByRole("button", { name: "얼굴 리소스 선택" }).click();
  await expect(picker).toBeVisible({ timeout: 8_000 });
  await page.getByTestId("db-actor-resource-dialog-search").focus();
  let escaped = false;
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active && active.closest("[data-testid='db-actor-resource-dialog']"));
    });
    if (!inside) {
      escaped = true;
      break;
    }
  }
  const trapEvidence = await shot(page, "x8-focus");
  if (escaped) {
    emitDefect({
      id: "X8-no-focus-trap",
      probeId: "X8",
      tabs: ["actors"],
      S: 2,
      B: 1,
      title: "X8: Tab cycled out of the resource picker into the modal behind (no focus trap)",
      repro: ["open faceset picker", "Tab x16", "activeElement left db-actor-resource-dialog"],
      evidence: [trapEvidence],
    });
  } else {
    emitClean("X8-focus-trap", "X8", ["actors"], "X8: Tab stayed inside the resource picker", ["Tab x16 inside picker"], [trapEvidence]);
  }
  await page.keyboard.press("Escape");
  await dismissDirtyIfAny(page, "discard");
}

// ---------------------------------------------------------------------------
// X9 — dock mode
// ---------------------------------------------------------------------------
async function probeX9(page: Page, mode: EditorLaneMode): Promise<void> {
  await ensureModal(page);
  const alreadyDocked = await page.getByTestId("database-modal").evaluate((node) => node.classList.contains("is-docked"));
  if (!alreadyDocked) await page.getByTestId("database-dock-toggle").click();
  await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);
  const rail = await page.evaluate(() => {
    const tabs = document.querySelector(".db-tabs");
    if (!(tabs instanceof HTMLElement)) return { width: 0, titles: [] as string[] };
    return {
      width: tabs.getBoundingClientRect().width,
      titles: Array.from(document.querySelectorAll(".db-tab")).map((node) => (node as HTMLElement).title),
    };
  });
  const evidence = await shot(page, `x9-${mode}`);
  const railOk = rail.width > 0 && rail.width <= 64;
  if (railOk) {
    emitClean(
      `X9-${mode}-rail`,
      "X9",
      ["actors"],
      `X9 ${mode}: dock toggle produced a ~48px icon rail (width=${Math.round(rail.width)})`,
      [`database-dock-toggle → is-docked, .db-tabs width=${rail.width}`],
      [evidence],
    );
  } else {
    emitDefect({
      id: `X9-${mode}-rail-width`,
      probeId: "X9",
      tabs: ["actors"],
      S: 1,
      B: 1,
      title: `X9 ${mode}: docked sidebar width was ${Math.round(rail.width)}px (expected ~48)`,
      repro: ["database-dock-toggle", `width=${rail.width}`],
      evidence: [evidence],
    });
  }

  const emptyTitles = rail.titles.filter((title) => !title).length;
  if (emptyTitles > 0) {
    emitDefect({
      id: `X9-${mode}-missing-titles`,
      probeId: "X9",
      tabs: ["actors"],
      S: 2,
      B: 3,
      title: `X9 ${mode}: docked .db-tab buttons have empty title (${emptyTitles}/${rail.titles.length}) — unlabeled icon rail`,
      repro: [
        `bootDbLane ${mode}`,
        "database-dock-toggle",
        "page.locator('.db-tab').evaluateAll(ns => ns.map(n => n.title))",
        `empty=${emptyTitles}`,
      ],
      evidence: [evidence],
    });
  }

  await switchTabAnyMode(page, ITEMS_TAB);
  await expect(page.getByTestId("db-tab-items")).toHaveClass(/active/);
  await fillActorName(page, `dock-dirty-${mode}`);
  const guard = await dirtyGuardOracle(page, "escape");
  if (guard.promptShown) {
    emitClean(
      `X9-${mode}-guard`,
      "X9",
      ["actors"],
      `X9 ${mode}: dirty guard still fires while docked`,
      ["dock → edit actor name → Escape → 3-way prompt"],
      [await shot(page, `x9-${mode}-guard`)],
    );
    await page.getByTestId("database-dirty-discard").click();
  } else {
    emitDefect({
      id: `X9-${mode}-guard-missing`,
      probeId: "X9",
      tabs: ["actors"],
      S: 4,
      B: 3,
      title: `X9 ${mode}: dirty edit in dock mode closed without a prompt`,
      repro: ["dock → edit → Escape"],
      evidence: [await shot(page, `x9-${mode}-guard-miss`)],
    });
  }
  await ensureModal(page);
  if (await page.getByTestId("database-modal").evaluate((node) => node.classList.contains("is-docked"))) {
    await page.getByTestId("database-dock-toggle").click();
  }
}

// ---------------------------------------------------------------------------
// X10 — small viewport / zoom
// ---------------------------------------------------------------------------
async function probeX10(page: Page, mode: EditorLaneMode): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  await fillActorName(page, `zoom-${mode}`);
  const at1024 = await modalMetrics(page);
  const shot1024 = await shot(page, `x10-${mode}-1024`);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1.5";
  });
  // Timing contract under attack: CSS zoom is applied synchronously but
  // layout/overflow is read on the next frame. One rAF, not a wall-clock sleep.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const atZoom = await modalMetrics(page);
  const shotZoom = await shot(page, `x10-${mode}-zoom`);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await dismissDirtyIfAny(page, "discard");

  const table = writeJson(`x10-${mode}`, { at1024, atZoom });
  for (const [label, metrics, evidence] of [
    ["1024x768", at1024, shot1024],
    ["zoom-150", atZoom, shotZoom],
  ] as const) {
    const ok = !metrics.overflow && metrics.footerOkInView && metrics.footerApplyInView;
    const repro = [
      `bootDbLane ${mode} viewport 1024x768`,
      "open → switch items → edit actor name",
      label === "zoom-150" ? "document.documentElement.style.zoom='1.5'" : "no zoom",
      `overflow=${metrics.overflow} (${metrics.scrollWidth}>${metrics.clientWidth}+1) footerOk=${metrics.footerOkInView} apply=${metrics.footerApplyInView}`,
    ];
    if (ok) {
      emitClean(`X10-${mode}-${label}`, "X10", ["actors"], `X10 ${mode} ${label}: no overflow, Save/Cancel in viewport`, repro, [evidence, table]);
    } else {
      emitDefect({
        id: `X10-${mode}-${label}-overflow`,
        probeId: "X10",
        tabs: ["actors"],
        S: 2,
        B: metrics.footerOkInView ? 1 : 3,
        title: `X10 ${mode} ${label}: ${metrics.overflow ? "horizontal overflow" : "Save/Cancel pushed out of the viewport"}`,
        repro,
        evidence: [evidence, table],
        status: label === "zoom-150" ? "unconfirmed-vqa" : "confirmed",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// X11 — Ctrl+T cycling / shell identity
// ---------------------------------------------------------------------------
async function probeX11(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  const start = await page.locator(".db-tab.active").getAttribute("data-testid");
  const before = await page.evaluateHandle(() => document.querySelector(".database-modal-window"));
  const afterCtrl: string[] = [];
  for (let i = 0; i < GROUP_ORDER_TEST_IDS.length; i += 1) {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "t", code: "KeyT", ctrlKey: true, bubbles: true, cancelable: true }));
    });
    afterCtrl.push((await page.locator(".db-tab.active").getAttribute("data-testid")) ?? "");
  }
  const uniqueAfterCtrl = new Set(afterCtrl);
  const ctrlCycles = uniqueAfterCtrl.size > 1;
  const ctrlEvidence = await shot(page, "x11-ctrlt");
  const ctrlLog = writeJson("x11-ctrlt", { start, afterCtrl });
  if (ctrlCycles) {
    emitClean(
      "X11-ctrlt-cycles",
      "X11",
      [...GROUP_ORDER_TEST_IDS],
      "X11: in-page Ctrl+T cycled Database tabs",
      [`start=${start}`, `uniqueActive=${uniqueAfterCtrl.size}`],
      [ctrlEvidence, ctrlLog],
    );
  } else {
    emitDefect({
      id: "X11-ctrlt-unimplemented",
      probeId: "X11",
      tabs: [...GROUP_ORDER_TEST_IDS],
      S: 2,
      B: 1,
      title: "X11: Ctrl+T does not cycle Database tabs (documented W2 contract is unimplemented)",
      repro: [
        "focus Database modal (not an input)",
        "dispatch ctrl+t KeyboardEvent 24 times",
        `active stayed ${start}`,
      ],
      evidence: [ctrlEvidence, ctrlLog],
    });
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (const testId of GROUP_ORDER_TEST_IDS) {
      await switchTabAnyMode(page, tabByTestId(testId));
    }
  }
  const same = await page.evaluate((el) => el === document.querySelector(".database-modal-window"), before);
  await before.dispose();
  const identityEvidence = await shot(page, "x11-identity");
  if (same) {
    emitClean(
      "X11-identity",
      "X11",
      [...GROUP_ORDER_TEST_IDS],
      "X11: cycling all 24 surfaces twice kept the same .database-modal-window instance",
      ["switchTabAnyMode every GROUP_ORDER tab x2", "evaluateHandle identity"],
      [identityEvidence],
    );
  } else {
    emitDefect({
      id: "X11-shell-rebuild",
      probeId: "X11",
      tabs: [...GROUP_ORDER_TEST_IDS],
      S: 4,
      B: 3,
      title: "X11: cycling tabs rebuilt .database-modal-window (dirty baseline would reset)",
      repro: ["cycle 24 surfaces twice", "evaluateHandle identity changed"],
      evidence: [identityEvidence],
    });
  }
}

// ---------------------------------------------------------------------------
// X12 — AI dock coexistence
// ---------------------------------------------------------------------------
async function probeX12(page: Page): Promise<void> {
  await ensureModal(page);
  const panel = page.locator(".ai-chat-panel");
  const visible = await panel.isVisible().catch(() => false);
  const evidence = await shot(page, "x12-ai");
  if (!visible) {
    emitDefect({
      id: "X12-ai-hidden",
      probeId: "X12",
      tabs: ["actors"],
      S: 2,
      B: 2,
      title: "X12: .ai-chat-panel is not visible while the Database modal is open (documented contract)",
      repro: ["boot expert, open Database", "count/visibility of .ai-chat-panel"],
      evidence: [evidence],
    });
    return;
  }
  emitClean("X12-visible", "X12", ["actors"], "X12: .ai-chat-panel stays visible with the Database modal open", ["open Database, .ai-chat-panel visible"], [evidence]);

  const input = page.getByTestId("ai-input");
  if (await input.isVisible().catch(() => false)) {
    await input.click();
    await input.fill("x12-escape-probe");
    await page.keyboard.press("Escape");
    const modalStill = await page.getByTestId("database-modal").isVisible().catch(() => false);
    const dirty = await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false);
    if (modalStill && !dirty) {
      emitClean(
        "X12-escape-isolated",
        "X12",
        ["actors"],
        "X12: Escape in the AI dock did not close the Database modal",
        ["click ai-input", "Escape"],
        [await shot(page, "x12-escape")],
      );
    } else {
      emitDefect({
        id: "X12-escape-closes-db",
        probeId: "X12",
        tabs: ["actors"],
        S: 3,
        B: 2,
        title: `X12: Escape in the AI dock affected the Database modal (open=${modalStill} dirty=${dirty})`,
        repro: ["click ai-input", "Escape"],
        evidence: [await shot(page, "x12-escape-fail")],
      });
    }
  }
}

// ---------------------------------------------------------------------------
// X13 — virtualizer offscreen selection
// ---------------------------------------------------------------------------
async function probeX13(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const allChip = page.getByTestId("db-filter-chip-all");
  if (await allChip.isVisible().catch(() => false)) await allChip.click();
  const listToggle = page.getByTestId("db-view-toggle-list");
  if (await listToggle.isVisible().catch(() => false)) await listToggle.click();
  const project = await exportedProject(page);
  const count = project.database.items.length;
  const search = page.locator(".db-body .db-search input").first();
  await expect(search).toBeVisible({ timeout: 8_000 });
  await search.fill(OFFSCREEN_ITEM.name);
  const row = page.getByTestId(`db-record-row-${OFFSCREEN_ITEM.id}`);
  await expect(row).toBeVisible({ timeout: 8_000 });
  await row.click();
  await search.fill("");
  let inDom = false;
  try {
    await expect
      .poll(async () => page.getByTestId(`db-record-row-${OFFSCREEN_ITEM.id}`).count(), { timeout: 5_000 })
      .toBeGreaterThan(0);
    inDom = true;
  } catch {
    inDom = false;
  }
  const evidence = await shot(page, "x13-virtualizer");
  const repro = [
    `items=${count} (threshold ${VIRTUALIZER_THRESHOLD})`,
    `search "${OFFSCREEN_ITEM.name}", select ${OFFSCREEN_ITEM.id}, clear search`,
    `selected row inDom=${inDom}`,
  ];
  if (count <= VIRTUALIZER_THRESHOLD) {
    emitDefect({
      id: "X13-seeding-limited",
      probeId: "X13",
      tabs: ["items"],
      S: 0,
      B: 0,
      title: `X13: items=${count} did not exceed virtualizer threshold ${VIRTUALIZER_THRESHOLD}`,
      repro,
      evidence: [evidence],
      status: "seeding-limited",
    });
    return;
  }
  if (inDom) {
    emitClean("X13-ok", "X13", ["items"], "X13: virtualizer kept the selected offscreen row in the DOM", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "X13-missing",
    probeId: "X13",
    tabs: ["items"],
    S: 3,
    B: 2,
    title: "X13: selected offscreen item vanished from the DOM after clearing search",
    repro,
    evidence: [evidence],
  });
}

// ---------------------------------------------------------------------------
// Overview F1–F7
// ---------------------------------------------------------------------------
async function probeF1(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  await expect(page.getByTestId("db-overview-stat-items")).toBeVisible();
  await expect(page.getByTestId("db-overview-curve")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("db-overview-scatter")).toBeVisible({ timeout: 10_000 });
  const evidence = await shot(page, "f1-charts");
  emitClean(
    "F1-ok",
    "F1",
    ["overview"],
    "F1: lazy charts appeared via awaited locators (no waitForTimeout)",
    ["switch to overview", "await db-overview-curve and db-overview-scatter"],
    [evidence],
  );
}

async function probeF2(page: Page): Promise<void> {
  if (!SEEDING_PROVEN) {
    emitDefect({
      id: "F2-seeding-limited",
      probeId: "F2",
      tabs: ["overview"],
      S: 0,
      B: 0,
      title: "F2: SEEDING_PROVEN is false — zero-data overview not attacked",
      repro: ["SEEDING_PROVEN=false"],
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await ensureModal(page);
  await mutatedProject(page, (project) => {
    const database = project.database as { enemies?: unknown[]; actors?: unknown[] } | undefined;
    if (!database) return;
    database.enemies = [];
    database.actors = [];
  });
  await switchTabAnyMode(page, ITEMS_TAB);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  const empty = page.getByTestId("db-overview-scatter-empty");
  await expect(empty).toBeVisible({ timeout: 10_000 });
  const copy = ((await empty.textContent()) ?? "").trim();
  const svgAudit = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll("[data-testid='db-overview-curve'] path, [data-testid='db-overview-scatter'] path, [data-testid='db-overview-scatter'] circle"));
    return paths.map((node) => {
      const d = node.getAttribute("d") ?? "";
      const cx = node.getAttribute("cx") ?? "";
      const cy = node.getAttribute("cy") ?? "";
      return { d, cx, cy, bad: /NaN|Infinity/.test(`${d} ${cx} ${cy}`) };
    });
  });
  const evidence = await shot(page, "f2-zero");
  const hasNan = svgAudit.some((entry) => entry.bad);
  const expectedCopy = copy.includes("몬스터가 없어");
  const repro = [
    "mutatedProject strip enemies+actors",
    "switch overview",
    `emptyCopy=${copy}`,
    `nanOrInfinity=${hasNan}`,
  ];
  if (expectedCopy && !hasNan) {
    emitClean("F2-ok", "F2", ["overview"], "F2: zero-data overview shows empty-state copy, no NaN/Infinity SVG", repro, [evidence]);
  } else {
    emitDefect({
      id: "F2-nan-or-missing-empty",
      probeId: "F2",
      tabs: ["overview"],
      S: hasNan ? 3 : 2,
      B: 2,
      title: hasNan
        ? "F2: zero-data overview produced NaN/Infinity chart paths"
        : `F2: scatter empty-state copy missing or wrong (${copy})`,
      repro,
      evidence: [evidence, writeJson("f2-svg", svgAudit)],
    });
  }
}

async function probeF3(page: Page): Promise<void> {
  if (!SEEDING_PROVEN) {
    emitDefect({
      id: "F3-seeding-limited",
      probeId: "F3",
      tabs: ["overview"],
      S: 0,
      B: 0,
      title: "F3: SEEDING_PROVEN is false — pathological scatter not attacked",
      repro: ["SEEDING_PROVEN=false"],
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await ensureModal(page);
  await mutatedProject(page, (project) => {
    const database = project.database as {
      enemies?: { stats?: { maxHp?: number } }[];
      skills?: { power?: number; effect?: { kind?: string } }[];
    } | undefined;
    if (!database) return;
    if (!Array.isArray(database.enemies) || database.enemies.length === 0) {
      database.enemies = [{ stats: { maxHp: 1 } }];
    } else {
      const first = database.enemies[0];
      if (first) {
        first.stats = { ...(first.stats ?? {}), maxHp: 1 };
      }
    }
    if (Array.isArray(database.skills) && database.skills[0]) {
      database.skills[0].power = 9_999_999;
      database.skills[0].effect = { kind: "damage" };
    }
  });
  await switchTabAnyMode(page, SKILLS_TAB);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  const scatter = page.getByTestId("db-overview-scatter");
  const empty = page.getByTestId("db-overview-scatter-empty");
  const scatterVisible = await scatter.isVisible({ timeout: 10_000 }).catch(() => false);
  const emptyVisible = await empty.isVisible().catch(() => false);
  const circles = scatterVisible
    ? await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("[data-testid='db-overview-scatter'] circle"));
        return nodes.map((node) => {
          const cx = Number(node.getAttribute("cx"));
          const cy = Number(node.getAttribute("cy"));
          return {
            cx,
            cy,
            finite: Number.isFinite(cx) && Number.isFinite(cy),
            inView: cx >= 0 && cx <= 480 && cy >= 0 && cy <= 200,
          };
        });
      })
    : [];
  const evidence = await shot(page, "f3-pathological");
  const blown = circles.some((circle) => !circle.finite || !circle.inView);
  const repro = [
    "mutatedProject: enemy[0].stats.maxHp=1, skill[0].power=9999999",
    "overview scatter",
    `scatterVisible=${scatterVisible} empty=${emptyVisible} circles=${circles.length} blown=${blown}`,
  ];
  if (emptyVisible && !scatterVisible) {
    emitClean("F3-empty-after-f2", "F3", ["overview"], "F3: scatter stayed in empty-state after F2 strip (no axis to blow)", repro, [evidence]);
    return;
  }
  if (!blown && scatterVisible) {
    emitClean("F3-ok", "F3", ["overview"], "F3: pathological 1-HP / 9999999-power scatter stayed inside the viewBox", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "F3-axis-blowout",
    probeId: "F3",
    tabs: ["overview"],
    S: 2,
    B: 2,
    title: "F3: pathological scatter produced non-finite or out-of-view dots",
    repro,
    evidence: [evidence, writeJson("f3-circles", circles)],
    status: "unconfirmed-vqa",
  });
}

async function probeF4(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  await expect(page.getByTestId("db-overview-curve")).toBeVisible({ timeout: 10_000 }).catch(() => undefined);
  const jump = page.locator("[data-testid^='db-overview-issue-jump-']").first();
  const empty = page.getByTestId("db-overview-issues-empty");
  if (await empty.isVisible().catch(() => false)) {
    emitClean(
      "F4-no-issues",
      "F4",
      ["overview"],
      "F4: fresh/current overview has no issue cards (empty-state copy present)",
      ["await issues empty or jump", await empty.textContent() ?? ""],
      [await shot(page, "f4-empty")],
    );
    return;
  }
  if (!(await jump.isVisible({ timeout: 10_000 }).catch(() => false))) {
    emitDefect({
      id: "F4-no-jump-or-empty",
      probeId: "F4",
      tabs: ["overview"],
      S: 1,
      B: 1,
      title: "F4: neither issue jump nor empty-state rendered",
      repro: ["open overview, wait for issues"],
      evidence: [await shot(page, "f4-missing")],
      status: "unconfirmed-vqa",
    });
    return;
  }
  const jumpTestId = (await jump.getAttribute("data-testid")) ?? "";
  const before = await page.evaluateHandle(() => document.querySelector(".database-modal-window"));
  await jump.click();
  const same = await page.evaluate((el) => el === document.querySelector(".database-modal-window"), before);
  await before.dispose();
  const active = (await page.locator(".db-tab.active").getAttribute("data-testid")) ?? "";
  const selected = await page.locator(".db-list-row.active, .db-gallery-card.active").count();
  const evidence = await shot(page, "f4-jump");
  const repro = [
    `click ${jumpTestId}`,
    `sameWindow=${same} activeTab=${active} selectedRows=${selected}`,
  ];
  if (same && active !== "db-tab-overview" && selected > 0) {
    emitClean("F4-ok", "F4", ["overview"], "F4: issue-card jump kept the modal instance and selected a record", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "F4-jump-failed",
    probeId: "F4",
    tabs: ["overview"],
    S: same ? 2 : 4,
    B: 2,
    title: `F4: issue jump ${same ? "did not select the offending record" : "rebuilt the modal (G006)"}`,
    repro,
    evidence: [evidence],
  });
}

async function probeF5(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  const close = await dirtyGuardOracle(page, "escape");
  const evidence = await shot(page, "f5-escape");
  if (!close.promptShown) {
    emitClean("F5-ok", "F5", ["overview"], "F5: overview Escape closed with no dirty prompt (read-only)", ["open overview", "Escape"], [evidence]);
  } else {
    emitDefect({
      id: "F5-false-dirty",
      probeId: "F5",
      tabs: ["overview"],
      S: 2,
      B: 3,
      title: "F5: read-only overview raised a dirty prompt on Escape",
      repro: ["open overview, touch nothing, Escape"],
      evidence: [evidence],
    });
    await dismissDirtyIfAny(page, "discard");
  }
  await ensureModal(page);
}

async function probeF6(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, OVERVIEW_TAB);
  const jump = page.locator("[data-testid^='db-overview-issue-jump-']").first();
  if (!(await jump.isVisible().catch(() => false))) {
    await switchTabAnyMode(page, ITEMS_TAB);
  } else {
    await jump.click();
  }
  const name = page.getByTestId("db-field-name");
  if (await name.isVisible().catch(() => false)) {
    const current = await name.inputValue();
    await name.fill(`${current}-f6`);
  }
  await switchTabAnyMode(page, OVERVIEW_TAB);
  await expect(page.getByTestId("db-overview-curve")).toBeVisible({ timeout: 10_000 });
  const evidence = await shot(page, "f6-recompute");
  emitClean(
    "F6-ok",
    "F6",
    ["overview"],
    "F6: returning to overview after an edit re-injected the lazy charts",
    ["jump or switch away", "edit if a name field exists", "back to overview", "await db-overview-curve"],
    [evidence],
  );
  await dismissDirtyIfAny(page, "keep");
}

async function probeF7(page: Page): Promise<void> {
  const stored = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_TAB_KEY);
  const active = (await page.locator(".db-tab.active").getAttribute("data-testid")) ?? "";
  const overviewActive = active === "db-tab-overview";
  const evidence = await shot(page, "f7-seed");
  const repro = [
    `bootDbLane expert localStorageSeed ${ACTIVE_TAB_KEY}=overview`,
    `stored=${stored} active=${active}`,
    "W5: overview is a valid last-used tab; it is only skipped as the *default* when the key is absent",
  ];
  if (stored === "overview" && overviewActive) {
    emitClean("F7-ok", "F7", ["overview"], "F7: seeded activeTab=overview reopens overview deterministically", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "F7-nondeterministic",
    probeId: "F7",
    tabs: ["overview"],
    S: 2,
    B: 1,
    title: `F7: seeded activeTab=overview did not reopen overview (active=${active})`,
    repro,
    evidence: [evidence],
  });
}

// ---------------------------------------------------------------------------
// Relocations R1–R4 + G probes
// ---------------------------------------------------------------------------
async function probeR1(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, TILESETS_TAB);
  await page.getByTestId(TOWN_TILESET_ROW).click();
  await expect(page.getByTestId("tileset-db-cell-0")).toBeVisible({ timeout: 8_000 });
  const startMark = (await page.getByTestId("tileset-db-cell-0").getAttribute("class")) ?? "";
  await page.getByTestId("tileset-settings-open").click();
  const modal = page.getByTestId("tileset-settings-modal");
  const modalOpen = await modal.isVisible({ timeout: 8_000 }).catch(() => false);
  let cycleNote = "settings modal did not open";
  let inlineMark = "";
  let passability: unknown = null;
  if (modalOpen) {
    const cell = page.getByTestId("tileset-passage-cell-0");
    const clickable = await cell.click({ timeout: 5_000 }).then(() => true).catch((error) => {
      cycleNote = `first click failed: ${error instanceof Error ? error.message : String(error)}`;
      return false;
    });
    if (clickable) {
      await cell.click().catch(() => undefined);
      await cell.click().catch(() => undefined);
      cycleNote = (await cell.getAttribute("class")) ?? "";
    }
    await page.getByTestId("tileset-settings-close").click().catch(() => undefined);
    inlineMark = (await page.getByTestId("tileset-db-cell-0").getAttribute("class")) ?? "";
    await switchTabAnyMode(page, TERRAIN_TAB);
    await switchTabAnyMode(page, TILESETS_TAB);
    const project = await exportedProject(page);
    passability = (project.tilesets["easyrpg_chipset_combined_town"] as unknown as { passability?: unknown } | undefined)?.passability;
    const first = Array.isArray(passability) ? passability[0] : passability;
    passability = first;
  }
  const evidence = await shot(page, "r1-tilesets");
  const table = writeJson("r1-passage", { startMark, cycleNote, inlineMark, passability });
  emitDefect({
    id: "R1-passage-roundtrip",
    probeId: "R1",
    tabs: ["tilesets"],
    S: 3,
    B: 2,
    title: "R1: tilesets passage-grid toggle round trip does not persist (baseline qa-terrain red)",
    repro: [
      "Database → db-tab-tilesets → tileset-db-row-easyrpg_chipset_combined_town",
      "tileset-settings-open → cycle tileset-passage-cell-0 x → star → o → tileset-settings-close",
      "expect tileset-db-cell-0 mark-o, switch terrain↔tilesets, read exportedProject.passability[0]",
      `startMark=${startMark} cycle=${cycleNote} inline=${inlineMark} passability=${JSON.stringify(passability)}`,
    ],
    evidence: [evidence, table],
    status: "pre-existing",
  });
}

async function probeR2(page: Page): Promise<void> {
  await ensureModal(page);
  if (!(await page.getByTestId("database-modal").evaluate((node) => node.classList.contains("is-docked")))) {
    await page.getByTestId("database-dock-toggle").click();
  }
  const titles = await page.locator(".db-tab").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).title));
  const evidence = await shot(page, "r2-titles");
  const empty = titles.every((title) => !title);
  const repro = [
    "bootDbLane(page,{mode:'beginner',viewport:{width:1024,height:768}})",
    "click database-dock-toggle",
    "page.locator('.db-tab').evaluateAll(ns => ns.map(n => n.title))",
    JSON.stringify(titles),
  ];
  if (empty) {
    emitDefect({
      id: "R2-dock-untitled-tabs",
      probeId: "R2",
      tabs: [...COMMON_DB_TAB_TEST_IDS],
      S: 2,
      B: 3,
      title: "R2: beginner dock .db-tab buttons never receive a title attribute (unlabeled icon rail)",
      repro,
      evidence: [evidence],
    });
    return;
  }
  emitClean("R2-titles-present", "R2", [...COMMON_DB_TAB_TEST_IDS], "R2: docked tab buttons have titles", repro, [evidence]);
}

const r3Scratch: {
  expertTabs?: string[];
  expertH2?: string;
} = {};

async function collectTabLabels(page: Page): Promise<string[]> {
  return page.locator(".db-tab").evaluateAll((nodes) =>
    nodes.map((node) => ((node as HTMLElement).textContent ?? "").replace(/\s+/g, " ").trim()),
  );
}

async function probeR3ExpertCapture(page: Page): Promise<void> {
  r3Scratch.expertTabs = await collectTabLabels(page);
  r3Scratch.expertH2 = ((await page.locator(".database-modal-header h2").textContent()) ?? "").trim();
  const evidence = await shot(page, "r3-expert");
  writeJson("r3-expert-labels", { ...r3Scratch });
  emitClean(
    "R3-expert-captured",
    "R3",
    [...COMMON_DB_TAB_TEST_IDS],
    "R3: captured expert .db-tab labels for cross-lane comparison",
    [`labels=${(r3Scratch.expertTabs ?? []).join(",")}`, `h2=${r3Scratch.expertH2}`],
    [evidence],
  );
}

async function probeR3Compare(page: Page): Promise<void> {
  const beginnerTabs = await collectTabLabels(page);
  const beginnerH2 = ((await page.locator(".database-modal-header h2").textContent()) ?? "").trim();
  const navAll = ((await page.getByTestId("db-nav-all").locator("summary").textContent()) ?? "").trim();
  const expertTabs = r3Scratch.expertTabs ?? [];
  const expertH2 = r3Scratch.expertH2 ?? "";
  const overlap = beginnerTabs.filter((label) => expertTabs.includes(label));
  const identical = beginnerTabs.length > 0 && overlap.length === beginnerTabs.length;
  const h2Hardcoded = beginnerH2 === HARDCODED_H2 && expertH2 === HARDCODED_H2;
  const evidence = await shot(page, "r3-beginner");
  const table = writeJson("r3-labels", {
    beginnerTabs,
    expertTabs,
    beginnerH2,
    expertH2,
    navAll,
    identical,
    h2Hardcoded,
  });
  const repro = [
    "collect .db-tab textContent in beginner vs expert (separate boots)",
    `beginner=${beginnerTabs.join(",")}`,
    `expert=${expertTabs.join(",")}`,
    `overlapIdentical=${identical}`,
    `h2 beginner=${beginnerH2} expert=${expertH2} navAll=${navAll}`,
  ];
  if (expertTabs.length === 0) {
    emitDefect({
      id: "R3-expert-not-captured",
      probeId: "R3",
      tabs: [...COMMON_DB_TAB_TEST_IDS],
      S: 1,
      B: 1,
      title: "R3: expert-lane label capture did not run before the beginner comparison",
      repro,
      evidence: [evidence, table],
      status: "unconfirmed-vqa",
    });
    return;
  }
  if (identical && h2Hardcoded) {
    emitDefect({
      id: "R3-jargon-ignored",
      probeId: "R3",
      tabs: [...COMMON_DB_TAB_TEST_IDS],
      S: 1,
      B: 2,
      title: "R3: DB tab labels and modal h2 ignore jargonStyle (hardcoded; only db-nav-all uses uiLabel)",
      repro,
      evidence: [evidence, table],
    });
    return;
  }
  emitClean("R3-jargon-differs", "R3", [...COMMON_DB_TAB_TEST_IDS], "R3: beginner/expert tab labels differ", repro, [evidence, table]);
}

async function probeR4(page: Page): Promise<void> {
  const rail = page.getByTestId("basic-left-rail");
  const railVisible = await rail.isVisible().catch(() => false);
  const toolbarHidden = await page.getByTestId("toolbar-database").isHidden().catch(() => true);
  const railDb = railVisible
    ? await rail.getByText(/자료집|데이터베이스|^자료$|^DB$/).count()
    : -1;
  const evidence = await shot(page, "r4-entry");
  const repro = [
    "bootDbLane beginner",
    `basic-left-rail visible=${railVisible}`,
    `toolbar-database hidden=${toolbarHidden}`,
    `rail text matches for 자료집/데이터베이스/자료/DB count=${railDb}`,
    "only remaining path: menu-tools → menu-tools-database",
  ];
  if (railVisible && toolbarHidden && railDb === 0) {
    emitDefect({
      id: "R4-no-rail-entry",
      probeId: "R4",
      tabs: ["overview"],
      S: 2,
      B: 3,
      title: "R4: beginner icon rail has no Database entry; toolbar-database is hidden (Tools menu is the only path)",
      repro,
      evidence: [evidence],
    });
    return;
  }
  emitClean("R4-entry-present", "R4", ["overview"], "R4: beginner Database entry is on the rail or toolbar", repro, [evidence]);
}

async function probeG1(page: Page): Promise<void> {
  const direct = await page.locator(".db-tabs > .db-tab").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.testid ?? ""),
  );
  const all = page.getByTestId("db-nav-all");
  const allVisible = await all.isVisible().catch(() => false);
  const allOpen = allVisible && (await all.getAttribute("open")) !== null;
  const evidence = await shot(page, "g1-nav");
  const ok =
    direct.length === COMMON_DB_TAB_TEST_IDS.length &&
    COMMON_DB_TAB_TEST_IDS.every((id, index) => direct[index] === id) &&
    allVisible &&
    !allOpen;
  const repro = [`direct=${direct.join(",")}`, `db-nav-all visible=${allVisible} open=${allOpen}`];
  if (ok) {
    emitClean("G1-ok", "G1", [...COMMON_DB_TAB_TEST_IDS], "G1: beginner common nav is 6 tabs + collapsed db-nav-all", repro, [evidence]);
    return;
  }
  emitDefect({
    id: "G1-nav-mismatch",
    probeId: "G1",
    tabs: [...COMMON_DB_TAB_TEST_IDS],
    S: 2,
    B: 2,
    title: "G1: beginner common nav is not exactly the 6 common tabs plus collapsed db-nav-all",
    repro,
    evidence: [evidence],
  });
}

async function probeG2(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ELEMENTS_TAB);
  await expect(page.getByTestId("db-tab-elements")).toHaveClass(/active/);
  await page.getByTestId("database-footer-apply").click().catch(() => undefined);
  await closeModalClean(page);
  await page.getByTestId("menu-tools").click();
  await page.getByTestId("menu-tools-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  const stored = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_TAB_KEY);
  const active = (await page.locator(".db-tab.active").getAttribute("data-testid")) ?? "";
  const navOpen = (await page.getByTestId("db-nav-all").getAttribute("open")) !== null;
  const evidence = await shot(page, "g2-persist");
  const repro = [
    "beginner: open db-nav-all → db-tab-elements, close, reopen via Tools",
    `stored=${stored} active=${active} db-nav-all open=${navOpen}`,
  ];
  if (stored === "elements" && active === "db-tab-elements" && !navOpen) {
    emitDefect({
      id: "G2-hidden-tab-collapsed",
      probeId: "G2",
      tabs: ["elements"],
      S: 1,
      B: 2,
      title: "G2: persisted hidden tab stays active while db-nav-all is collapsed (active tab invisible in common rail)",
      repro,
      evidence: [evidence],
    });
    return;
  }
  emitClean("G2-persist", "G2", ["elements"], "G2: hidden-tab persistence was deterministic", repro, [evidence]);
}

async function probeG5(page: Page): Promise<void> {
  await ensureModal(page);
  if (!(await page.getByTestId("database-modal").evaluate((node) => node.classList.contains("is-docked")))) {
    await page.getByTestId("database-dock-toggle").click();
  }
  const metrics = await modalMetrics(page);
  const evidence = await shot(page, "g5-dock");
  const repro = [
    "beginner + dock + 1024x768",
    `overflow=${metrics.overflow} ${metrics.scrollWidth}/${metrics.clientWidth}`,
  ];
  if (!metrics.overflow) {
    emitClean("G5-ok", "G5", ["overview"], "G5: beginner dock at 1024x768 has no horizontal overflow", repro, [evidence]);
  } else {
    emitDefect({
      id: "G5-overflow",
      probeId: "G5",
      tabs: ["overview"],
      S: 2,
      B: 2,
      title: "G5: beginner dock at 1024x768 overflows horizontally",
      repro,
      evidence: [evidence],
    });
  }
}

async function probeHelpAndCoach(page: Page): Promise<void> {
  await ensureModal(page);
  const coachInModal = await page.locator(".database-modal-window [data-testid^='coach-mark-']").count();
  const coachAnywhere = await page.locator("[data-testid^='coach-mark-']").count();
  const evidenceCoach = await shot(page, "g4-coach");
  emitDefect({
    id: "G4-no-db-coachmarks",
    probeId: "G4",
    tabs: ["actors"],
    S: 1,
    B: 2,
    title: "G4: there are no Database coach marks (help is a single generic toast)",
    repro: [
      "bootDbLane beginner with onboarding keys cleared",
      "open Database",
      `coach-mark-* inside modal=${coachInModal} anywhere=${coachAnywhere}`,
    ],
    evidence: [evidenceCoach],
  });

  await page.locator(".database-modal-footer").getByRole("button", { name: "도움말", exact: true }).click();
  const toast = page.getByTestId("toast");
  const toastText = (await toast.textContent().catch(() => "")) ?? "";
  const evidenceHelp = await shot(page, "g4-help");
  if (toastText.includes(HELP_TOAST)) {
    emitDefect({
      id: "G4-generic-help-toast",
      probeId: "G4",
      tabs: ["actors"],
      S: 1,
      B: 2,
      title: "G4: DB help button is a single generic toast (no contextual help)",
      repro: ["click footer 도움말", `toast=${toastText.trim()}`],
      evidence: [evidenceHelp],
    });
  } else {
    emitClean(
      "G4-help-other",
      "G4",
      ["actors"],
      `G4: help toast was not the documented generic sentence (${toastText.trim() || "missing"})`,
      [`toast=${toastText}`],
      [evidenceHelp],
    );
  }
}
