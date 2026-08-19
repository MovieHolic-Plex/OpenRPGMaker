import { expect, test, type Locator, type Page } from "@playwright/test";
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
  VIRTUALIZER_THRESHOLD,
  type AuditFinding,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject, type DatabaseTabSpec } from "./rm2k3-database-helpers";

/**
 * Diagnostic adversarial audit of the collection-group tabs
 * (enemies / monsterSpecies / troops / crops / characters).
 *
 * Probe outcome != test failure. Assert only harness invariants; every
 * contract deviation is funneled into `recordFinding`. Each tab is wrapped
 * in try/catch so one broken surface cannot abort the rest.
 */

const SPEC = "_db-audit-crud-collection";
const SHOT_DIR = "output/evidence/db-beginner-audit/shots";
const FINDINGS_PATH = path.join(FINDINGS_DIR, `${SPEC}.json`);

const ENEMIES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "enemies")!;
const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const ACTORS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;
const SPECIES_TAB: DatabaseTabSpec = {
  label: "Monster Species",
  slug: "monster-species",
  testId: "db-tab-monster-species",
};
const CROPS_TAB: DatabaseTabSpec = { label: "Crops", slug: "crops", testId: "db-tab-crops" };
const CHARACTERS_TAB: DatabaseTabSpec = {
  label: "Characters",
  slug: "characters",
  testId: "db-tab-characters",
};

type Severity = AuditFinding["S"];
type BeginnerImpact = AuditFinding["B"];
type TabId = "enemies" | "monsterSpecies" | "troops" | "crops" | "characters";

type CollectionAdapter = {
  readonly id: TabId;
  readonly spec: DatabaseTabSpec;
  readonly nameField: string;
  readonly addButton: string;
  readonly deleteButton: string;
  readonly duplicateButton?: string;
  readonly duplicateText?: string;
  readonly rowPrefix: string;
  readonly hasSearch: boolean;
  readonly hasGallery: boolean;
  readonly numericFields: readonly string[];
  readonly emptyOnFresh: boolean;
};

type LooseEnemy = {
  id: string;
  name: string;
  speciesId?: string;
  monsterResourceId?: string;
  stats: { maxHp: number; attack?: number };
};

type LooseSpecies = {
  id: string;
  name: string;
  types?: string[];
  baseStats: { maxHp: number };
  graphic: { monsterResourceId?: string };
};

type LooseTroop = {
  id: string;
  name: string;
  uncapturable?: boolean;
  enemyIds?: string[];
  members?: { enemyId: string }[];
};

type LooseCrop = { id: string; name: string; harvestCount: number };
type LooseCharacter = { displayName?: string };

type LooseProject = {
  database: {
    enemies: LooseEnemy[];
    troops: LooseTroop[];
    items: { id: string; name: string; type?: string }[];
    monsterSpecies?: LooseSpecies[];
    crops?: LooseCrop[];
  };
  characters?: Record<string, LooseCharacter>;
  system: { initialTroopId?: string; typeChart?: { types?: string[] } };
};

const ADAPTERS: readonly CollectionAdapter[] = [
  {
    id: "enemies",
    spec: ENEMIES_TAB,
    nameField: "db-field-name",
    addButton: "db-add-record",
    deleteButton: "db-delete-selected",
    duplicateText: "복제",
    rowPrefix: "db-record-row-",
    hasSearch: true,
    hasGallery: true,
    numericFields: ["db-field-enemy-max-hp"],
    emptyOnFresh: false,
  },
  {
    id: "monsterSpecies",
    spec: SPECIES_TAB,
    nameField: "db-monster-species-name",
    addButton: "db-monster-species-add",
    deleteButton: "db-monster-species-delete",
    duplicateButton: "db-monster-species-duplicate",
    rowPrefix: "db-monster-species-row-",
    hasSearch: false,
    hasGallery: false,
    numericFields: ["db-monster-species-hp", "db-monster-species-capture-rate", "db-monster-species-hue"],
    emptyOnFresh: false,
  },
  {
    id: "troops",
    spec: TROOPS_TAB,
    nameField: "db-field-name",
    addButton: "db-add-record",
    deleteButton: "db-delete-selected",
    duplicateText: "복제",
    rowPrefix: "db-record-row-",
    hasSearch: true,
    hasGallery: true,
    numericFields: ["db-field-troop-active-slots"],
    emptyOnFresh: false,
  },
  {
    id: "crops",
    spec: CROPS_TAB,
    nameField: "db-crop-name",
    addButton: "db-crop-add",
    deleteButton: "db-crop-delete",
    duplicateButton: "db-crop-duplicate",
    rowPrefix: "db-crop-row-",
    hasSearch: false,
    hasGallery: false,
    numericFields: ["db-crop-harvest-count", "db-crop-regrow-days"],
    emptyOnFresh: true,
  },
  {
    id: "characters",
    spec: CHARACTERS_TAB,
    nameField: "db-character-display-name",
    addButton: "db-character-add",
    deleteButton: "db-character-delete",
    rowPrefix: "db-character-row-",
    hasSearch: false,
    hasGallery: false,
    numericFields: ["db-character-birthday-day"],
    emptyOnFresh: true,
  },
];

const AWAY_TAB: Record<TabId, DatabaseTabSpec> = {
  enemies: ITEMS_TAB,
  monsterSpecies: ENEMIES_TAB,
  troops: ENEMIES_TAB,
  crops: ITEMS_TAB,
  characters: ITEMS_TAB,
};

test.describe("DB audit — collection-group CRUD (diagnostic)", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
    mkdirSync(FINDINGS_DIR, { recursive: true });
  });

  test("X2 X3 X6 X13 mandatory chrome probes", async ({ page }) => {
    test.slow();
    // Unlink only here — a later worker restart (timeout) must not wipe already-written findings.
    try {
      unlinkSync(FINDINGS_PATH);
    } catch {
      // first run
    }
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

  for (const adapter of ADAPTERS) {
    test(`expert lane A1-A10 — ${adapter.id}`, async ({ page }) => {
      test.slow();
      test.setTimeout(240_000);
      const errors = collectConsoleErrors(page);
      await bootDbLane(page, { mode: "expert" });
      await auditTabExpert(page, adapter);
      recordConsoleNoise(errors, [adapter.id], `A-expert-${adapter.id}`);
    });
  }

  test("beginner lane silent-loss trio A1/A5/A8 via switchTabAnyMode", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "beginner" });

    for (const adapter of ADAPTERS) {
      try {
        await ensureModalOpen(page);
        await switchTabAnyMode(page, adapter.spec);
        await ensureScratchRecord(page, adapter);
        await runProbe(page, "A1", [adapter.id], async () => {
          await probeA1EmptyName(page, adapter, "beginner");
        });
        await ensureModalOpen(page);
        await switchTabAnyMode(page, adapter.spec);
        await runProbe(page, "A5", [adapter.id], async () => {
          await probeA5MidEditTabSwitch(page, adapter, "beginner");
        });
        await ensureModalOpen(page);
        await switchTabAnyMode(page, adapter.spec);
        await runProbe(page, "A8", [adapter.id], async () => {
          await probeA8EscapeMidTyping(page, adapter, "beginner");
        });
      } catch (error) {
        await emitTabCrash(page, adapter.id, "A-beginner", error);
      }
    }

    recordConsoleNoise(errors, ADAPTERS.map((adapter) => adapter.id), "A-beginner");
  });

  test("collection-specific: A11 G006, type-warn, species chips, uncapturable, no dual-write", async ({
    page,
  }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });

    await runProbe(page, "A11", ["enemies", "monsterSpecies"], async () => {
      await probeA11EnemySpeciesJump(page);
    });
    await runProbe(page, "species-type-warn", ["monsterSpecies"], async () => {
      await probeSpeciesTypeMembershipWarn(page);
    });
    await runProbe(page, "enemy-species-chips", ["enemies"], async () => {
      await probeEnemySpeciesChips(page);
    });
    await runProbe(page, "troop-uncapturable", ["troops"], async () => {
      await probeTroopUncapturable(page);
    });
    await runProbe(page, "no-dual-write", ["enemies", "monsterSpecies"], async () => {
      await probeNoDualWriteStats(page);
    });
    await runProbe(page, "known-beginner-gaps", ADAPTERS.map((adapter) => adapter.id), async () => {
      await noteKnownBeginnerGaps(page);
    });

    recordConsoleNoise(errors, ["enemies", "monsterSpecies", "troops"], "collection-specific");
  });

  test("findings ledger covers all five collection tabs + A11", () => {
    const raw = readFileSync(FINDINGS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    expect(Array.isArray(parsed), "findings JSON must be an array").toBe(true);
    const findings = parsed as AuditFinding[];
    expect(findings.length, "at least one finding/clean entry").toBeGreaterThan(0);
    for (const finding of findings) validateFinding(finding);

    const tabs = new Set(findings.flatMap((finding) => finding.tabs));
    for (const tab of ["enemies", "monsterSpecies", "troops", "crops", "characters"] as const) {
      expect(tabs.has(tab), `${tab} must be represented in findings`).toBe(true);
    }

    const probes = new Set(findings.map((finding) => finding.probeId));
    expect(probes.has("A11"), "A11 G006 jump outcome must be present").toBe(true);
    for (const required of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "X2", "X3", "X6", "X13"]) {
      expect(probes.has(required), `missing probe ${required}`).toBe(true);
    }
  });
});

async function auditTabExpert(page: Page, adapter: CollectionAdapter): Promise<void> {
  try {
    await ensureModalOpen(page);
    await switchTabAnyMode(page, adapter.spec);
    if (adapter.emptyOnFresh) {
      await runProbe(page, "empty-state", [adapter.id], async () => {
        await probeEmptyState(page, adapter);
      });
    }
    await ensureScratchRecord(page, adapter);
    await runProbe(page, "A1", [adapter.id], async () => {
      await probeA1EmptyName(page, adapter, "expert");
    });
    await runProbe(page, "A2", [adapter.id], async () => {
      await probeA2BoundaryNames(page, adapter);
    });
    await runProbe(page, "A3", [adapter.id], async () => {
      await probeA3HtmlInjection(page, adapter);
    });
    await runProbe(page, "A4", [adapter.id], async () => {
      await probeA4NumericClamp(page, adapter);
    });
    await runProbe(page, "A5", [adapter.id], async () => {
      await probeA5MidEditTabSwitch(page, adapter, "expert");
    });
    await runProbe(page, "A6", [adapter.id], async () => {
      await probeA6DeleteReferenced(page, adapter);
    });
    await runProbe(page, "A7", [adapter.id], async () => {
      await probeA7CreateDeleteChurn(page, adapter);
    });
    await runProbe(page, "A8", [adapter.id], async () => {
      await probeA8EscapeMidTyping(page, adapter, "expert");
    });
    await runProbe(page, "A9", [adapter.id], async () => {
      await probeA9SearchZeroMatch(page, adapter);
    });
    await runProbe(page, "A10", [adapter.id], async () => {
      await probeA10DuplicateEditCopy(page, adapter);
    });
  } catch (error) {
    await emitTabCrash(page, adapter.id, "A-expert", error);
  }
}

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
  evidence: readonly string[] = [],
): void {
  emit({
    id: `${probeId}-${tabs.join("+")}-clean`,
    probeId,
    tabs,
    S: 0,
    B: 0,
    title,
    repro,
    evidence,
    status: "clean",
  });
}

const PROBE_BUDGET_MS = 25_000;

function withProbeBudget<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${PROBE_BUDGET_MS}ms`)), PROBE_BUDGET_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function runProbe(page: Page, probeId: string, tabs: readonly string[], body: () => Promise<void>): Promise<void> {
  try {
    await withProbeBudget(body(), `${probeId} on ${tabs.join(",")}`);
  } catch (error) {
    const evidence = await shot(page, `${probeId}-${tabs.join("+")}-crash`).catch(() => []);
    emit({
      id: `${probeId}-${tabs.join("+")}-crash`,
      probeId,
      tabs: [...tabs],
      S: 2,
      B: 1,
      title: `${probeId} probe crashed before a contract judgment`,
      repro: [`run ${probeId} on ${tabs.join(",")}`, error instanceof Error ? error.message : String(error)],
      evidence,
      status: "confirmed",
    });
  }
}

async function emitTabCrash(page: Page, tab: string, probeId: string, error: unknown): Promise<void> {
  const evidence = await shot(page, `${probeId}-${tab}-tab-crash`).catch(() => []);
  emit({
    id: `${probeId}-${tab}-tab-crash`,
    probeId,
    tabs: [tab],
    S: 2,
    B: 1,
    title: `${tab} audit aborted; remaining tabs continue`,
    repro: [error instanceof Error ? error.message : String(error)],
    evidence,
    status: "confirmed",
  });
}

async function shot(page: Page, name: string): Promise<string[]> {
  const rel = path.join(SHOT_DIR, `${SPEC}-${name}.png`).replaceAll("\\", "/");
  await page.screenshot({ path: rel, fullPage: false });
  return [rel];
}

async function projectOf(page: Page): Promise<LooseProject> {
  return (await exportedProject(page)) as unknown as LooseProject;
}

async function visible(
  locator: { isVisible: (opts?: { timeout?: number }) => Promise<boolean> },
  timeout = 1_500,
): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function dismissDirty(page: Page, decision: "keep" | "discard" = "keep"): Promise<void> {
  const prompt = page.getByTestId("database-dirty-prompt");
  if (!(await visible(prompt, 400))) return;
  const testId = decision === "keep" ? "database-dirty-keep-editing" : "database-dirty-discard";
  await page.getByTestId(testId).click().catch(() => undefined);
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
  await expect(modal).toBeVisible();
}

async function ensureModalOpen(page: Page): Promise<void> {
  await dismissDirty(page, "keep");
  await reopenDatabase(page);
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

function rowLocator(page: Page, adapter: CollectionAdapter, id: string): Locator {
  return page.getByTestId(`${adapter.rowPrefix}${id}`);
}

async function selectedRecordId(page: Page): Promise<string | null> {
  const row = page.locator(".db-list-row.active").first();
  if (!(await visible(row, 1_500))) return null;
  return row.getAttribute("data-record-id");
}

async function listIds(page: Page): Promise<string[]> {
  return page.locator(".db-list-row").evaluateAll((nodes) =>
    nodes
      .map((node) => (node instanceof HTMLElement ? node.dataset.recordId ?? "" : ""))
      .filter(Boolean),
  );
}

async function safeClick(
  locator: Locator,
  timeout = 2_500,
): Promise<{ ok: boolean; intercepted: boolean; message?: string }> {
  try {
    await locator.click({ timeout });
    return { ok: true, intercepted: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const intercepted = /intercepts pointer events/.test(message);
    if (intercepted) {
      await locator.click({ force: true, timeout }).catch(() => undefined);
      return { ok: true, intercepted: true, message: message.slice(0, 280) };
    }
    return { ok: false, intercepted: false, message: message.slice(0, 400) };
  }
}

async function clickAdd(page: Page, adapter: CollectionAdapter): Promise<{ ok: boolean; interceptedBy?: string; forceUsed: boolean }> {
  const button = page.getByTestId(adapter.addButton);
  if (!(await visible(button, 2_000))) return { ok: false, forceUsed: false };
  const result = await safeClick(button, 3_000);
  return { ok: result.ok, interceptedBy: result.message, forceUsed: result.intercepted };
}

async function clickDuplicate(page: Page, adapter: CollectionAdapter): Promise<boolean> {
  if (adapter.duplicateButton) {
    const button = page.getByTestId(adapter.duplicateButton);
    if (!(await visible(button, 1_000))) return false;
    const result = await safeClick(button);
    return result.ok;
  }
  if (adapter.duplicateText) {
    const button = page.locator(".db-toolbar .btn, .db-toolbar .db-toolbar-button", {
      hasText: adapter.duplicateText,
    }).first();
    if (!(await visible(button, 1_000))) return false;
    const result = await safeClick(button);
    return result.ok;
  }
  return false;
}

function namedValue(project: LooseProject, adapter: CollectionAdapter, id: string): string | undefined {
  switch (adapter.id) {
    case "enemies":
      return project.database.enemies.find((entry) => entry.id === id)?.name;
    case "monsterSpecies":
      return project.database.monsterSpecies?.find((entry) => entry.id === id)?.name;
    case "troops":
      return project.database.troops.find((entry) => entry.id === id)?.name;
    case "crops":
      return project.database.crops?.find((entry) => entry.id === id)?.name;
    case "characters":
      return project.characters?.[id]?.displayName;
  }
}

async function waitNamed(
  page: Page,
  adapter: CollectionAdapter,
  id: string,
  expected: string | undefined,
): Promise<string | undefined> {
  let last: string | undefined;
  try {
    await expect
      .poll(
        async () => {
          last = namedValue(await projectOf(page), adapter, id);
          return last ?? "";
        },
        { timeout: 4_000 },
      )
      .toBe(expected ?? "");
  } catch {
    // judgment happens at the caller
  }
  return last;
}

async function typeName(page: Page, adapter: CollectionAdapter, value: string): Promise<Locator> {
  const field = page.getByTestId(adapter.nameField);
  await expect(field).toBeVisible({ timeout: 5_000 });
  await safeClick(field);
  await field.fill(value);
  return field;
}

async function typeNameInFlight(page: Page, adapter: CollectionAdapter, value: string): Promise<Locator> {
  const field = page.getByTestId(adapter.nameField);
  await expect(field).toBeVisible({ timeout: 5_000 });
  await safeClick(field);
  await field.fill("");
  // pressSequentially leaves focus in the field — the A5/A8 contract is "no blur".
  await field.pressSequentially(value, { delay: 0 });
  return field;
}

async function ensureScratchRecord(page: Page, adapter: CollectionAdapter): Promise<string | null> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);

  if (adapter.id === "characters") {
    const project = await projectOf(page);
    const existing = Object.entries(project.characters ?? {}).find(([, profile]) => profile.displayName);
    if (existing) {
      await safeClick(rowLocator(page, adapter, existing[0]));
      return existing[0];
    }
    const added = await clickAdd(page, adapter);
    if (!added.ok) return selectedRecordId(page);
    return selectedRecordId(page);
  }

  if (adapter.emptyOnFresh) {
    const rows = page.locator(".db-list-row");
    if ((await rows.count()) === 0) {
      const added = await clickAdd(page, adapter);
      if (adapter.id === "troops" && added.interceptedBy) {
        emit({
          id: "pre-existing-troops-add-record-intercept",
          probeId: "A7",
          tabs: ["troops"],
          S: 2,
          B: 2,
          title: "Pre-existing: troops db-add-record click intercepted by a list row",
          repro: [
            "qa-troops CRUD / battle-event / boundary all fail on the same intercept",
            added.interceptedBy,
            `forceUsed=${added.forceUsed}`,
          ],
          evidence: await shot(page, "troops-add-intercept"),
          status: "pre-existing",
        });
      }
    }
    return selectedRecordId(page);
  }

  const first = page.locator(".db-list-row").first();
  if (await visible(first, 2_000)) await safeClick(first);
  return selectedRecordId(page);
}

async function overflowMetrics(locator: Locator): Promise<{ scrollWidth: number; clientWidth: number; overflow: string; ellipsis: string }> {
  return locator.evaluate((node) => {
    if (!(node instanceof HTMLElement)) {
      return { scrollWidth: 0, clientWidth: 0, overflow: "", ellipsis: "" };
    }
    const style = getComputedStyle(node);
    return {
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      overflow: style.overflowX,
      ellipsis: style.textOverflow,
    };
  });
}

async function probeEmptyState(page: Page, adapter: CollectionAdapter): Promise<void> {
  const repro = [
    `boot expert /?freshProject=1 → ${adapter.spec.testId}`,
    "freshProject measured characters=0 crops=0; empty pane must be a guiding card, not a blank form",
  ];
  if (adapter.id === "crops") {
    const rows = await page.locator(".db-list-row").count();
    const detail = page.getByTestId("db-detail-form");
    const detailText = ((await detail.textContent()) ?? "").trim();
    const card = page.locator(".empty-state, .empty-hint, .db-record-intro");
    const hasCard = (await card.count()) > 0 && (await visible(card.first(), 400));
    const addVisible = await visible(page.getByTestId(adapter.addButton), 1_000);
    if (rows === 0 && (!hasCard || detailText === "작물이 없습니다.")) {
      emit({
        id: "empty-state-crops-blank-pane",
        probeId: "empty-state",
        tabs: ["crops"],
        S: 2,
        B: 2,
        title: "Crops fresh empty state is a blank pane, not a beginner guiding card",
        repro: [...repro, `rows=${rows} detail=${JSON.stringify(detailText)} addVisible=${addVisible} hasCard=${hasCard}`],
        evidence: await shot(page, "crops-empty"),
        status: "confirmed",
      });
      return;
    }
    clean("empty-state", ["crops"], "Crops empty state is a guiding card", repro);
    return;
  }

  const intro = page.getByTestId("db-characters-intro");
  const orphan = page.getByTestId("db-character-orphan-create");
  const profiles = Object.keys((await projectOf(page)).characters ?? {});
  const orphanVisible = await visible(orphan, 1_000);
  if (profiles.length === 0 && !(await visible(intro, 1_000)) && !orphanVisible) {
    emit({
      id: "empty-state-characters-blank-pane",
      probeId: "empty-state",
      tabs: ["characters"],
      S: 2,
      B: 2,
      title: "Characters collection is empty and the pane has no guiding card",
      repro,
      evidence: await shot(page, "characters-empty"),
      status: "confirmed",
    });
    return;
  }
  clean(
    "empty-state",
    ["characters"],
    "Characters collection is empty but orphan rows + create card guide the first action",
    [...repro, `profiles=${profiles.length} orphanCard=${orphanVisible}`],
  );
}

async function probeA1EmptyName(page: Page, adapter: CollectionAdapter, lane: "expert" | "beginner"): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const id = (await selectedRecordId(page)) ?? (await ensureScratchRecord(page, adapter));
  const repro = [
    `${lane} → ${adapter.spec.testId}`,
    "clear name field, blur, select another row if any, select back",
    "row must stay findable (not zero-width / missing)",
  ];
  if (!id) {
    emit({
      id: `A1-${adapter.id}-${lane}-no-record`,
      probeId: "A1",
      tabs: [adapter.id],
      S: 2,
      B: 1,
      title: `A1 ${lane}: no record available to clear the name`,
      repro,
      evidence: await shot(page, `A1-${adapter.id}-${lane}-none`),
      status: adapter.emptyOnFresh ? "seeding-limited" : "confirmed",
    });
    return;
  }

  await safeClick(rowLocator(page, adapter, id));
  await typeName(page, adapter, BOUNDARY_INPUTS.empty);
  await page.getByTestId(adapter.nameField).blur();

  const others = page.locator(".db-list-row").filter({ hasNot: page.locator(`[data-record-id='${id}']`) });
  if ((await others.count()) > 0) {
    await safeClick(others.first());
    await safeClick(rowLocator(page, adapter, id));
  }

  const row = rowLocator(page, adapter, id);
  const rowVisible = await visible(row, 2_000);
  const box = rowVisible ? await row.boundingBox() : null;
  const label = rowVisible ? ((await row.locator(".db-list-name").textContent()) ?? "").trim() : "";
  const unfindable = !rowVisible || !box || box.width < 8 || box.height < 8;
  if (unfindable) {
    emit({
      id: `A1-${adapter.id}-${lane}-unfindable`,
      probeId: "A1",
      tabs: [adapter.id],
      S: 3,
      B: 3,
      title: `A1 ${lane}: emptying the ${adapter.id} name made the row unfindable`,
      repro: [...repro, `id=${id} visible=${rowVisible} box=${JSON.stringify(box)} label=${JSON.stringify(label)}`],
      evidence: await shot(page, `A1-${adapter.id}-${lane}`),
      status: "confirmed",
    });
    return;
  }
  clean("A1", [adapter.id], `A1 ${lane}: empty-name ${adapter.id} row stayed clickable`, [...repro, `label=${label}`]);
}

async function probeA2BoundaryNames(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const id = (await selectedRecordId(page)) ?? (await ensureScratchRecord(page, adapter));
  const repro = [
    `${adapter.spec.testId} → fill 100-char CJK, then emoji+ZWJ`,
    "sidebar/header must ellipsize (scrollWidth <= clientWidth+1); exportedProject exact round-trip",
  ];
  if (!id) {
    emit({
      id: `A2-${adapter.id}-no-record`,
      probeId: "A2",
      tabs: [adapter.id],
      S: 2,
      B: 0,
      title: `A2: no record to receive CJK/emoji names on ${adapter.id}`,
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }

  await safeClick(rowLocator(page, adapter, id));
  await typeName(page, adapter, BOUNDARY_INPUTS.longCjk);
  const storedCjk = await waitNamed(page, adapter, id, BOUNDARY_INPUTS.longCjk);
  const nameNode = rowLocator(page, adapter, id).locator(".db-list-name");
  const cjkMetrics = await overflowMetrics(nameNode);
  const header = page.getByTestId(adapter.nameField);
  const headerMetrics = await overflowMetrics(header);
  const cjkOverflow = cjkMetrics.scrollWidth > cjkMetrics.clientWidth + 1;

  if (adapter.hasGallery) {
    const gallery = page.getByTestId("db-view-toggle-gallery");
    if (await visible(gallery, 800)) {
      const galleryClick = await safeClick(gallery, 3_000);
      if (galleryClick.intercepted || !galleryClick.ok) {
        emit({
          id: `A2-${adapter.id}-gallery-intercept`,
          probeId: "A2",
          tabs: [adapter.id],
          S: 2,
          B: 2,
          title: `A2: ${adapter.id} gallery toggle click intercepted by a list row (qa-troops / db-desktop-matrix overlap)`,
          repro: [...repro, "click db-view-toggle-gallery", galleryClick.message ?? "click failed"],
          evidence: await shot(page, `A2-${adapter.id}-gallery-intercept`),
          status: "pre-existing",
        });
      } else {
        const card = page.getByTestId(`db-record-card-${id}`);
        const cardVisible = await visible(card, 1_500);
        if (!cardVisible) {
          emit({
            id: `A2-${adapter.id}-gallery-missing`,
            probeId: "A2",
            tabs: [adapter.id],
            S: 2,
            B: 1,
            title: `A2: ${adapter.id} gallery toggle produced no db-record-card-* (overlaps db-desktop-matrix)`,
            repro: [...repro, "click db-view-toggle-gallery", `db-record-card-${id} never found`],
            evidence: await shot(page, `A2-${adapter.id}-gallery`),
            status: "pre-existing",
          });
        }
      }
      const listToggle = page.getByTestId("db-view-toggle-list");
      if (await visible(listToggle, 800)) await safeClick(listToggle, 2_000);
    }
  }

  await typeName(page, adapter, BOUNDARY_INPUTS.emojiZwj);
  const storedEmoji = await waitNamed(page, adapter, id, BOUNDARY_INPUTS.emojiZwj);

  const defects: string[] = [];
  if (storedCjk !== BOUNDARY_INPUTS.longCjk) defects.push(`cjk-roundtrip=${JSON.stringify(storedCjk)}`);
  if (storedEmoji !== BOUNDARY_INPUTS.emojiZwj) defects.push(`emoji-roundtrip=${JSON.stringify(storedEmoji)}`);
  if (cjkOverflow) defects.push(`row overflow ${cjkMetrics.scrollWidth}>${cjkMetrics.clientWidth + 1}`);

  if (defects.length > 0) {
    emit({
      id: `A2-${adapter.id}-boundary`,
      probeId: "A2",
      tabs: [adapter.id],
      S: storedCjk !== BOUNDARY_INPUTS.longCjk || storedEmoji !== BOUNDARY_INPUTS.emojiZwj ? 3 : 1,
      B: 2,
      title: `A2: ${adapter.id} CJK/emoji name contract failed`,
      repro: [...repro, ...defects, `ellipsis=${cjkMetrics.ellipsis}`, `headerOverflow=${headerMetrics.scrollWidth}/${headerMetrics.clientWidth}`],
      evidence: await shot(page, `A2-${adapter.id}`),
      status: "confirmed",
    });
    return;
  }
  clean("A2", [adapter.id], `A2: ${adapter.id} CJK/emoji names ellipsize and round-trip`, repro);
}

async function probeA3HtmlInjection(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const id = (await selectedRecordId(page)) ?? (await ensureScratchRecord(page, adapter));
  const repro = [
    `${adapter.spec.testId} → paste ${BOUNDARY_INPUTS.htmlInjection} into the name`,
    "must render as literal text; no img[onerror]; no console error",
  ];
  if (!id) {
    emit({
      id: `A3-${adapter.id}-no-record`,
      probeId: "A3",
      tabs: [adapter.id],
      S: 2,
      B: 0,
      title: `A3: no record to receive the HTML-injection name on ${adapter.id}`,
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await safeClick(rowLocator(page, adapter, id));
  // Legitimate list thumbs (`databaseRecordThumbnails.ts`) already create <img> nodes.
  // Only a NEW img[src=x] / img[onerror] after typing the payload is injection.
  const beforeInjected = await page.locator('img[src="x"], img[onerror]').count();
  await typeName(page, adapter, BOUNDARY_INPUTS.htmlInjection);
  const stored = await waitNamed(page, adapter, id, BOUNDARY_INPUTS.htmlInjection);
  const afterInjected = await page.locator('img[src="x"], img[onerror]').count();
  const injectedDelta = afterInjected - beforeInjected;
  const measurement = [
    `stored=${JSON.stringify(stored)}`,
    `injected=0 means no img[src=x]/img[onerror] delta (before=${beforeInjected} after=${afterInjected} delta=${injectedDelta})`,
  ];
  if (injectedDelta > 0) {
    emit({
      id: `A3-${adapter.id}-injection`,
      probeId: "A3",
      tabs: [adapter.id],
      S: 4,
      B: 3,
      title: `A3: ${adapter.id} created an img[src=x]/onerror node from the name payload`,
      repro: [...repro, ...measurement],
      evidence: await shot(page, `A3-${adapter.id}`),
      status: "confirmed",
    });
    return;
  }
  if (stored !== BOUNDARY_INPUTS.htmlInjection) {
    emit({
      id: `A3-${adapter.id}-not-literal`,
      probeId: "A3",
      tabs: [adapter.id],
      S: 3,
      B: 1,
      title: `A3: ${adapter.id} did not store the HTML-injection string literally`,
      repro: [...repro, ...measurement],
      evidence: await shot(page, `A3-${adapter.id}`),
      status: "confirmed",
    });
    return;
  }
  emit({
    id: `A3-${adapter.id}-injection`,
    probeId: "A3",
    tabs: [adapter.id],
    S: 0,
    B: 0,
    title: `A3: ${adapter.id} stored the HTML-injection name as a literal string (correct escaping)`,
    repro: [
      ...repro,
      ...measurement,
      "Initially mis-titled as DOM injection because a naive innerHTML /<img/ check tripped on legitimate thumbnail <img> nodes. injected=0 and stored= is the literal payload — correct escaping, not XSS.",
    ],
    evidence: [],
    status: "clean",
  });
}

async function probeA4NumericClamp(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  await ensureScratchRecord(page, adapter);
  const repro = [
    `${adapter.spec.testId} → every numeric -stepper/-slider OR fallback number field`,
    "fill -1 / 9999999 / abc; stepper and slider must agree after clamp",
  ];
  const steppers = page.locator("[data-testid$='-stepper']");
  const stepperCount = await steppers.count();
  const cases = [BOUNDARY_INPUTS.minus1, BOUNDARY_INPUTS.huge, BOUNDARY_INPUTS.abc] as const;

  if (stepperCount > 0) {
    const testId = await steppers.first().getAttribute("data-testid");
    const base = (testId ?? "").replace(/-stepper$/, "");
    const slider = page.getByTestId(`${base}-slider`);
    const stepper = page.getByTestId(`${base}-stepper`);
    const tag = await stepper.evaluate((node) => node.tagName.toLowerCase()).catch(() => "?");
    if (tag !== "input" && tag !== "textarea") {
      emit({
        id: `A4-${adapter.id}-stepper-not-input`,
        probeId: "A4",
        tabs: [adapter.id],
        S: 1,
        B: 1,
        title: `A4: ${adapter.id} [data-testid$='-stepper'] is <${tag}>, not a fillable input`,
        repro: [...repro, `testid=${testId} tag=${tag}`],
        evidence: await shot(page, `A4-${adapter.id}-not-input`),
        status: "confirmed",
      });
      return;
    }
    const diverged: string[] = [];
    for (const value of cases) {
      await stepper.fill(value);
      await stepper.blur();
      const stepperValue = await stepper.inputValue();
      const sliderValue = (await visible(slider, 400)) ? await slider.inputValue() : stepperValue;
      if (stepperValue !== sliderValue) diverged.push(`${value}: stepper=${stepperValue} slider=${sliderValue}`);
      if (stepperValue === "NaN" || sliderValue === "NaN") diverged.push(`${value}: NaN`);
    }
    if (diverged.length > 0) {
      emit({
        id: `A4-${adapter.id}-desync`,
        probeId: "A4",
        tabs: [adapter.id],
        S: 3,
        B: 1,
        title: `A4: ${adapter.id} stepper/slider disagreed after clamp`,
        repro: [...repro, ...diverged],
        evidence: await shot(page, `A4-${adapter.id}`),
        status: "confirmed",
      });
      return;
    }
    clean("A4", [adapter.id], `A4: ${adapter.id} stepper/slider stayed in agreement`, repro);
    return;
  }

  const usable = [];
  for (const testId of adapter.numericFields) {
    if (await visible(page.getByTestId(testId), 600)) usable.push(testId);
  }
  if (usable.length === 0) {
    emit({
      id: `A4-${adapter.id}-no-numeric`,
      probeId: "A4",
      tabs: [adapter.id],
      S: 0,
      B: 0,
      title: `A4: ${adapter.id} has no -stepper/-slider pair (numberField-only or empty pane)`,
      repro,
      evidence: [],
      status: "clean",
    });
    return;
  }

  const nanHits: string[] = [];
  for (const testId of usable) {
    const field = page.getByTestId(testId);
    if (await field.isDisabled().catch(() => false)) continue;
    for (const value of cases) {
      await field.fill(value);
      await field.blur();
      const shown = await field.inputValue();
      if (shown.toLowerCase() === "nan") nanHits.push(`${testId} ${value} → ${shown}`);
    }
  }
  if (nanHits.length > 0) {
    emit({
      id: `A4-${adapter.id}-nan`,
      probeId: "A4",
      tabs: [adapter.id],
      S: 3,
      B: 1,
      title: `A4: ${adapter.id} numeric field persisted NaN`,
      repro: [...repro, ...nanHits],
      evidence: await shot(page, `A4-${adapter.id}-nan`),
      status: "confirmed",
    });
    return;
  }
  clean(
    "A4",
    [adapter.id],
    `A4: ${adapter.id} has no stepper/slider pair; number fields rejected NaN`,
    [...repro, `fields=${usable.join(",")}`],
  );
}

async function probeA5MidEditTabSwitch(page: Page, adapter: CollectionAdapter, lane: "expert" | "beginner"): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const id = (await selectedRecordId(page)) ?? (await ensureScratchRecord(page, adapter));
  const token = `A5-${lane}-${Date.now().toString(36).slice(-4)}`;
  const repro = [
    `${lane} → ${adapter.spec.testId} record ${id}`,
    `type ${token} into the name without blur`,
    `immediately click ${AWAY_TAB[adapter.id].testId}, return`,
    "edit must commit or be discarded via the dirty guard — never silent loss",
  ];
  if (!id) {
    emit({
      id: `A5-${adapter.id}-${lane}-no-record`,
      probeId: "A5",
      tabs: [adapter.id],
      S: 2,
      B: 0,
      title: `A5 ${lane}: no record to attack mid-edit tab switch`,
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await safeClick(rowLocator(page, adapter, id));
  await typeNameInFlight(page, adapter, token);
  await switchTabAnyMode(page, AWAY_TAB[adapter.id]);
  const promptOnLeave = await visible(page.getByTestId("database-dirty-prompt"), 400);
  if (promptOnLeave) await dismissDirty(page, "keep");
  await switchTabAnyMode(page, adapter.spec);
  await safeClick(rowLocator(page, adapter, id));
  const fieldValue = await page.getByTestId(adapter.nameField).inputValue().catch(() => "");
  const stored = namedValue(await projectOf(page), adapter, id);
  const kept = fieldValue.includes(token) || stored === token;
  if (!kept && !promptOnLeave) {
    emit({
      id: `A5-${adapter.id}-${lane}-silent-loss`,
      probeId: "A5",
      tabs: [adapter.id],
      S: 4,
      B: 3,
      title: `A5 ${lane}: in-flight ${adapter.id} name was silently lost on tab switch`,
      repro: [...repro, `field=${JSON.stringify(fieldValue)} stored=${JSON.stringify(stored)}`],
      evidence: await shot(page, `A5-${adapter.id}-${lane}`),
      status: "confirmed",
    });
    return;
  }
  clean("A5", [adapter.id], `A5 ${lane}: ${adapter.id} in-flight name survived or was guarded`, repro);
}

async function probeA6DeleteReferenced(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const repro = [
    `${adapter.spec.testId} → select a referenced record → click delete`,
    "must BLOCK and name the referrers (databaseReferences.ts)",
  ];

  if (adapter.id === "crops") {
    await ensureScratchRecord(page, adapter);
    const id = await selectedRecordId(page);
    const before = (await projectOf(page)).database.crops?.length ?? 0;
    await safeClick(page.getByTestId(adapter.deleteButton));
    const toastText = ((await page.getByTestId("toast").textContent().catch(() => "")) ?? "").trim();
    const armed = ((await page.getByTestId(adapter.deleteButton).textContent()) ?? "").includes("정말");
    if (armed) await safeClick(page.getByTestId(adapter.deleteButton));
    const after = (await projectOf(page)).database.crops?.length ?? 0;
    emit({
      id: "A6-crops-no-reference-guard",
      probeId: "A6",
      tabs: ["crops"],
      S: 2,
      B: 1,
      title: "A6: crop delete is never blocked — cropReferenceMessage is hard-coded null",
      repro: [
        ...repro,
        "src/editor/databaseReferences.ts cropReferenceMessage always returns null",
        "farm plots live only on the runtime save, so static DB referrers cannot be named",
        `id=${id} before=${before} after=${after} toast=${JSON.stringify(toastText)}`,
      ],
      evidence: await shot(page, "A6-crops"),
      status: "confirmed",
    });
    return;
  }

  if (adapter.id === "characters") {
    const orphan = page.locator("[data-testid='db-characters-list'] .db-list-row").first();
    await safeClick(orphan);
    await safeClick(page.getByTestId(adapter.deleteButton));
    const toastText = ((await page.getByTestId("toast").textContent().catch(() => "")) ?? "").trim();
    const namesHost = /이벤트|맵|char_/.test(toastText);
    if (!namesHost) {
      emit({
        id: "A6-characters-orphan-unnamed",
        probeId: "A6",
        tabs: ["characters"],
        S: 2,
        B: 2,
        title: "A6: deleting an event-used character does not name the referring map events",
        repro: [...repro, `toast=${JSON.stringify(toastText)}`],
        evidence: await shot(page, "A6-characters"),
        status: "confirmed",
      });
      return;
    }
    clean("A6", ["characters"], "A6: character delete named the referring hosts", [...repro, toastText]);
    return;
  }

  let targetId: string | null = null;
  if (adapter.id === "enemies") {
    const project = await projectOf(page);
    const referenced = project.database.enemies.find((enemy) =>
      project.database.troops.some(
        (troop) => troop.enemyIds?.includes(enemy.id) || troop.members?.some((member) => member.enemyId === enemy.id),
      ),
    );
    targetId = referenced?.id ?? null;
  } else if (adapter.id === "monsterSpecies") {
    const project = await projectOf(page);
    const referenced = project.database.monsterSpecies?.find((species) =>
      project.database.enemies.some((enemy) => enemy.speciesId === species.id),
    );
    targetId = referenced?.id ?? null;
  } else if (adapter.id === "troops") {
    const project = await projectOf(page);
    targetId = project.system.initialTroopId ?? project.database.troops[0]?.id ?? null;
  }

  if (!targetId) {
    emit({
      id: `A6-${adapter.id}-no-ref`,
      probeId: "A6",
      tabs: [adapter.id],
      S: 1,
      B: 0,
      title: `A6: no referenced ${adapter.id} record on freshProject`,
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }

  await safeClick(rowLocator(page, adapter, targetId));
  const beforeCount = (await listIds(page)).length;
  await safeClick(page.getByTestId(adapter.deleteButton));
  const toastText = ((await page.getByTestId("toast").textContent().catch(() => "")) ?? "").trim();
  const armed = ((await page.getByTestId(adapter.deleteButton).textContent()) ?? "").includes("정말");
  const stillThere = await visible(rowLocator(page, adapter, targetId), 1_000);
  const afterCount = (await listIds(page)).length;
  const namesReferrer = /적 그룹|몬스터|주인공|시스템|직업|아이템/.test(toastText);

  if (!stillThere || afterCount < beforeCount) {
    emit({
      id: `A6-${adapter.id}-deleted`,
      probeId: "A6",
      tabs: [adapter.id],
      S: 4,
      B: 3,
      title: `A6: referenced ${adapter.id} record was deleted`,
      repro: [...repro, `id=${targetId} toast=${JSON.stringify(toastText)} armed=${armed}`],
      evidence: await shot(page, `A6-${adapter.id}-deleted`),
      status: "confirmed",
    });
    return;
  }
  if (!namesReferrer) {
    emit({
      id: `A6-${adapter.id}-jargon`,
      probeId: "A6",
      tabs: [adapter.id],
      S: 2,
      B: 3,
      title: `A6: ${adapter.id} delete block did not name the referrers`,
      repro: [...repro, `id=${targetId} toast=${JSON.stringify(toastText)}`],
      evidence: await shot(page, `A6-${adapter.id}-msg`),
      status: "confirmed",
    });
    return;
  }
  clean("A6", [adapter.id], `A6: ${adapter.id} delete blocked and named referrers`, [...repro, toastText]);
}

async function probeA7CreateDeleteChurn(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const repro = [
    `${adapter.spec.testId} → create/delete/create x5`,
    "unique ids, new record auto-selected, no ghost selection on a deleted id",
  ];
  const created: string[] = [];
  const intercepts: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const before = await selectedRecordId(page);
    const added = await clickAdd(page, adapter);
    if (added.interceptedBy) intercepts.push(added.interceptedBy);
    if (!added.ok) break;
    const id = await selectedRecordId(page);
    if (!id || id === before && i > 0 && created.includes(id)) break;
    if (id) created.push(id);
    await safeClick(page.getByTestId(adapter.deleteButton));
    const armed = ((await page.getByTestId(adapter.deleteButton).textContent()) ?? "").includes("정말");
    if (armed) await safeClick(page.getByTestId(adapter.deleteButton));
    const toastText = ((await page.getByTestId("toast").textContent().catch(() => "")) ?? "").trim();
    if (toastText && /사용 중/.test(toastText)) {
      // created record was unexpectedly referenced — stop rather than loop on the toast
      break;
    }
  }

  if (adapter.id === "troops" && intercepts.length > 0) {
    emit({
      id: "pre-existing-troops-add-record-churn",
      probeId: "A7",
      tabs: ["troops"],
      S: 2,
      B: 2,
      title: "Pre-existing: troops +추가 is covered by a list row, so A7 churn cannot complete via the real click",
      repro: [...repro, intercepts[0]!, `created=${created.join(",")}`],
      evidence: await shot(page, "A7-troops-add"),
      status: "pre-existing",
    });
    return;
  }

  const unique = new Set(created);
  const selected = await selectedRecordId(page);
  const ghost = selected !== null && created.includes(selected) && !(await visible(rowLocator(page, adapter, selected), 400));
  if (created.length < 5 || unique.size !== created.length || ghost) {
    emit({
      id: `A7-${adapter.id}-churn`,
      probeId: "A7",
      tabs: [adapter.id],
      S: ghost ? 3 : 2,
      B: ghost ? 3 : 1,
      title: `A7: ${adapter.id} create/delete churn failed uniqueness or left a ghost selection`,
      repro: [...repro, `created=${created.join(",")}`, `selected=${selected}`, `ghost=${ghost}`],
      evidence: await shot(page, `A7-${adapter.id}`),
      status: created.length === 0 ? "seeding-limited" : "confirmed",
    });
    return;
  }
  clean("A7", [adapter.id], `A7: ${adapter.id} five create/delete cycles kept unique ids`, repro);
}

async function probeA8EscapeMidTyping(page: Page, adapter: CollectionAdapter, lane: "expert" | "beginner"): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const id = (await selectedRecordId(page)) ?? (await ensureScratchRecord(page, adapter));
  const token = `A8-${lane}`;
  const repro = [
    `${lane} → ${adapter.spec.testId}`,
    `type ${token} without blur, press Escape`,
    "dirty guard must fire exactly once; modal must not close silently",
  ];
  if (!id) {
    emit({
      id: `A8-${adapter.id}-${lane}-no-record`,
      probeId: "A8",
      tabs: [adapter.id],
      S: 2,
      B: 0,
      title: `A8 ${lane}: no record to type into`,
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await safeClick(rowLocator(page, adapter, id));
  await typeNameInFlight(page, adapter, token);
  await page.keyboard.press("Escape");
  // Timing contract under attack: leaked document keydown listeners would
  // stack N dirty prompts on one Escape. One rAF lets every queued listener run.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const promptCount = await page.getByTestId("database-dirty-prompt").count();
  const modalOpen = await visible(page.getByTestId("database-modal"), 800);

  if (!modalOpen && promptCount === 0) {
    emit({
      id: `A8-${adapter.id}-${lane}-silent-close`,
      probeId: "A8",
      tabs: [adapter.id],
      S: 4,
      B: 3,
      title: `A8 ${lane}: Escape mid-typing closed the Database modal with no dirty guard`,
      repro,
      evidence: await shot(page, `A8-${adapter.id}-${lane}-close`),
      status: "confirmed",
    });
    await reopenDatabase(page);
    return;
  }
  if (promptCount > 1) {
    emit({
      id: `A8-${adapter.id}-${lane}-stacked`,
      probeId: "A8",
      tabs: [adapter.id],
      S: 2,
      B: 2,
      title: `A8 ${lane}: Escape mid-typing stacked ${promptCount} dirty prompts`,
      repro,
      evidence: await shot(page, `A8-${adapter.id}-${lane}-stack`),
      status: "confirmed",
    });
    await dismissDirty(page, "keep");
    return;
  }
  if (promptCount === 0) {
    emit({
      id: `A8-${adapter.id}-${lane}-noop`,
      probeId: "A8",
      tabs: [adapter.id],
      S: 2,
      B: 2,
      title: `A8 ${lane}: Escape mid-typing neither guarded nor closed — no feedback`,
      repro,
      evidence: await shot(page, `A8-${adapter.id}-${lane}-noop`),
      status: "confirmed",
    });
    return;
  }
  await dismissDirty(page, "keep");
  clean("A8", [adapter.id], `A8 ${lane}: Escape mid-typing fired the 3-way guard once`, repro);
}

async function probeA9SearchZeroMatch(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const repro = [
    `${adapter.spec.testId} → search a zero-match query`,
    "empty-state hint; then query a real name, select, clear — selection must survive",
  ];
  if (!adapter.hasSearch) {
    emit({
      id: `A9-${adapter.id}-no-search`,
      probeId: "A9",
      tabs: [adapter.id],
      S: 1,
      B: 1,
      title: `A9: ${adapter.id} has no record search (zero-match hint cannot exist)`,
      repro,
      evidence: await shot(page, `A9-${adapter.id}-absent`),
      status: "confirmed",
    });
    return;
  }

  const search = page.locator(".db-body .db-search input").first();
  await expect(search).toBeVisible();
  await search.fill("zzzz-no-such-record-9f3a");
  // Search input debounces rerender at 80ms (databaseRecordViews.recordSearch).
  await expect
    .poll(async () => page.locator(".db-list-row").count(), { timeout: 3_000 })
    .toBe(0);
  const hint = page.locator(".empty-hint, .empty-state, .db-detail-form");
  const hintText = ((await hint.first().textContent().catch(() => "")) ?? "").trim();
  const hasHint = hintText.length > 0;
  if (!hasHint) {
    emit({
      id: `A9-${adapter.id}-no-hint`,
      probeId: "A9",
      tabs: [adapter.id],
      S: 2,
      B: 2,
      title: `A9: ${adapter.id} zero-match search is a blank pane with no hint`,
      repro: [...repro, `hint=${JSON.stringify(hintText)}`],
      evidence: await shot(page, `A9-${adapter.id}-blank`),
      status: "confirmed",
    });
  }

  const project = await projectOf(page);
  const sample =
    adapter.id === "enemies"
      ? project.database.enemies.find((entry) => entry.name.trim().length > 0)
      : project.database.troops.find((entry) => entry.name.trim().length > 0);
  if (!sample) {
    if (hasHint) clean("A9", [adapter.id], `A9: ${adapter.id} zero-match showed a hint`, repro);
    return;
  }
  await search.fill(sample.name);
  const row = rowLocator(page, adapter, sample.id);
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await search.fill("");
  await expect
    .poll(async () => selectedRecordId(page), { timeout: 4_000 })
    .toBe(sample.id);
  const selected = await selectedRecordId(page);
  if (selected !== sample.id) {
    emit({
      id: `A9-${adapter.id}-selection-reset`,
      probeId: "A9",
      tabs: [adapter.id],
      S: 3,
      B: 3,
      title: `A9: clearing ${adapter.id} search reset selection away from ${sample.id}`,
      repro: [...repro, `selected=${selected}`],
      evidence: await shot(page, `A9-${adapter.id}-reset`),
      status: "confirmed",
    });
    return;
  }
  if (hasHint) clean("A9", [adapter.id], `A9: ${adapter.id} search empty-hint + selection survived clear`, repro);
}

async function probeA10DuplicateEditCopy(page: Page, adapter: CollectionAdapter): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, adapter.spec);
  const repro = [
    `${adapter.spec.testId} → duplicate, edit the copy name, original must be untouched`,
  ];
  if (!adapter.duplicateButton && !adapter.duplicateText) {
    emit({
      id: `A10-${adapter.id}-no-duplicate`,
      probeId: "A10",
      tabs: [adapter.id],
      S: 2,
      B: 2,
      title: `A10: ${adapter.id} has no duplicate/copy control — beginners cannot experiment safely`,
      repro,
      evidence: await shot(page, `A10-${adapter.id}-missing`),
      status: "confirmed",
    });
    return;
  }

  const originalId = (await selectedRecordId(page)) ?? (await ensureScratchRecord(page, adapter));
  if (!originalId) {
    emit({
      id: `A10-${adapter.id}-no-record`,
      probeId: "A10",
      tabs: [adapter.id],
      S: 2,
      B: 0,
      title: `A10: no ${adapter.id} record to duplicate`,
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  const originalName = namedValue(await projectOf(page), adapter, originalId);
  const duplicated = await clickDuplicate(page, adapter);
  if (!duplicated) {
    emit({
      id: `A10-${adapter.id}-click-failed`,
      probeId: "A10",
      tabs: [adapter.id],
      S: 2,
      B: 1,
      title: `A10: ${adapter.id} duplicate control was not clickable`,
      repro,
      evidence: await shot(page, `A10-${adapter.id}-click`),
      status: adapter.id === "troops" ? "pre-existing" : "confirmed",
    });
    return;
  }
  const copyId = await selectedRecordId(page);
  if (!copyId || copyId === originalId) {
    emit({
      id: `A10-${adapter.id}-no-new-id`,
      probeId: "A10",
      tabs: [adapter.id],
      S: 3,
      B: 2,
      title: `A10: ${adapter.id} duplicate did not select a new id`,
      repro: [...repro, `original=${originalId} selected=${copyId}`],
      evidence: await shot(page, `A10-${adapter.id}-id`),
      status: "confirmed",
    });
    return;
  }
  const mutated = `${originalName ?? "copy"}-A10`;
  await typeName(page, adapter, mutated);
  await waitNamed(page, adapter, copyId, mutated);
  const afterOriginal = namedValue(await projectOf(page), adapter, originalId);
  if (afterOriginal !== originalName) {
    emit({
      id: `A10-${adapter.id}-shallow-clone`,
      probeId: "A10",
      tabs: [adapter.id],
      S: 4,
      B: 3,
      title: `A10: editing the ${adapter.id} copy mutated the original (shallow clone)`,
      repro: [...repro, `original ${originalId} ${JSON.stringify(originalName)} → ${JSON.stringify(afterOriginal)}`],
      evidence: await shot(page, `A10-${adapter.id}-shallow`),
      status: "confirmed",
    });
    return;
  }
  clean("A10", [adapter.id], `A10: ${adapter.id} copy edit left the original untouched`, repro);
}

async function probeA11EnemySpeciesJump(page: Page): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, ENEMIES_TAB);
  const project = await projectOf(page);
  const linked = project.database.enemies.find((enemy) => enemy.speciesId);
  const repro = [
    "enemies tab → select a record with speciesId",
    "dirty the enemy name",
    "click db-enemy-open-species",
    "G006: same .database-modal-window instance, species tab active, species preselected, dirty preserved",
  ];
  if (!linked) {
    emit({
      id: "A11-no-linked-enemy",
      probeId: "A11",
      tabs: ["enemies", "monsterSpecies"],
      S: 2,
      B: 0,
      title: "A11: freshProject had no enemy.speciesId to jump from",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await safeClick(page.getByTestId(`db-record-row-${linked.id}`));
  const dirtyToken = `A11-dirty-${linked.id}`;
  const nameField = page.getByTestId("db-field-name");
  await expect(nameField).toBeVisible();
  await nameField.fill(dirtyToken);
  await expect
    .poll(async () => (await projectOf(page)).database.enemies.find((entry) => entry.id === linked.id)?.name, {
      timeout: 4_000,
    })
    .toBe(dirtyToken);

  const beforeHandle = await page.evaluateHandle(() => document.querySelector(".database-modal-window"));
  const jump = page.getByTestId("db-enemy-open-species");
  if (!(await visible(jump, 2_000))) {
    emit({
      id: "A11-jump-missing",
      probeId: "A11",
      tabs: ["enemies", "monsterSpecies"],
      S: 2,
      B: 2,
      title: "A11: db-enemy-open-species was not rendered on a linked enemy",
      repro,
      evidence: await shot(page, "A11-missing-jump"),
      status: "confirmed",
    });
    return;
  }
  await safeClick(jump);
  await expect(page.getByTestId("db-tab-monster-species")).toHaveClass(/active/, { timeout: 5_000 });

  const sameInstance = await page.evaluate((el) => el === document.querySelector(".database-modal-window"), beforeHandle);
  const selectedSpecies = await selectedRecordId(page);
  const speciesField = page.getByTestId("db-monster-species-name");
  const speciesVisible = await visible(speciesField, 2_000);

  await page.keyboard.press("Escape");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const promptShown = await visible(page.getByTestId("database-dirty-prompt"), 1_000);
  if (promptShown) await dismissDirty(page, "keep");

  const defects: string[] = [];
  if (!sameInstance) defects.push("modal instance replaced (openDatabaseModal reopen)");
  if (selectedSpecies !== linked.speciesId) defects.push(`selected=${selectedSpecies} expected=${linked.speciesId}`);
  if (!speciesVisible) defects.push("species form not shown");
  if (!promptShown) defects.push("dirty baseline reset — Escape after jump did not prompt");

  if (defects.length > 0) {
    const reopened = !sameInstance || !promptShown;
    emit({
      id: "A11-g006-jump",
      probeId: "A11",
      tabs: ["enemies", "monsterSpecies"],
      S: reopened ? 4 : 3,
      B: 3,
      title: reopened
        ? "A11: enemy→species jump reopened the modal or reset the dirty baseline (G006 P0)"
        : "A11: enemy→species jump did not preselect the linked species",
      repro: [...repro, ...defects, `sameInstance=${sameInstance} prompt=${promptShown}`],
      evidence: await shot(page, "A11-g006"),
      status: "confirmed",
    });
    return;
  }
  clean("A11", ["enemies", "monsterSpecies"], "A11: G006 jump reused the modal, preselected the species, kept dirty", repro);
}

async function probeSpeciesTypeMembershipWarn(page: Page): Promise<void> {
  const repro = [
    "SEEDING_PROVEN mutatedProject: set species_wild_slime.types to ['ghost'] (not in typeChart fire/water/grass)",
    "open monsterSpecies, select that record",
    "db-monster-species-type-warn must appear; ghost must not be silently cleared",
  ];
  if (!SEEDING_PROVEN) {
    emit({
      id: "species-type-warn-seeding",
      probeId: "species-type-warn",
      tabs: ["monsterSpecies"],
      S: 0,
      B: 0,
      title: "Species type-membership warn skipped — seeding unproven",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
    return;
  }
  await mutatedProject(page, (project) => {
    const species = (project.database as { monsterSpecies?: { id: string; types?: string[] }[] }).monsterSpecies;
    const target = species?.find((entry) => entry.id === "species_wild_slime") ?? species?.[0];
    if (!target) throw new Error("no monsterSpecies to seed");
    target.types = ["ghost"];
  });
  await ensureModalOpen(page);
  await switchTabAnyMode(page, SPECIES_TAB);
  const speciesRow = page.getByTestId("db-monster-species-row-species_wild_slime");
  if (await visible(speciesRow, 1_000)) await safeClick(speciesRow);
  else await safeClick(page.locator(".db-list-row").first());
  const warn = page.getByTestId("db-monster-species-type-warn");
  const warnVisible = await visible(warn, 2_000);
  const warnText = warnVisible ? ((await warn.textContent()) ?? "") : "";
  const stored = (await projectOf(page)).database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime");
  const kept = stored?.types?.includes("ghost") === true;
  if (!kept) {
    emit({
      id: "species-type-warn-cleared",
      probeId: "species-type-warn",
      tabs: ["monsterSpecies"],
      S: 3,
      B: 3,
      title: "Species type not in the chart was silently cleared instead of warning",
      repro: [...repro, `types=${JSON.stringify(stored?.types)}`],
      evidence: await shot(page, "species-type-cleared"),
      status: "confirmed",
    });
    return;
  }
  if (!warnVisible || !/ghost/.test(warnText)) {
    emit({
      id: "species-type-warn-missing",
      probeId: "species-type-warn",
      tabs: ["monsterSpecies"],
      S: 2,
      B: 2,
      title: "Outlier species type kept in data but db-monster-species-type-warn did not appear",
      repro: [...repro, `warn=${JSON.stringify(warnText)}`],
      evidence: await shot(page, "species-type-warn"),
      status: "confirmed",
    });
    return;
  }
  clean("species-type-warn", ["monsterSpecies"], "Outlier type kept and db-monster-species-type-warn rendered", repro);
}

async function probeEnemySpeciesChips(page: Page): Promise<void> {
  const repro = [
    "unset: add (or select) an enemy with empty speciesId → db-enemy-species-unset-warn",
    "missing: seed speciesId=species_missing_audit → db-enemy-species-missing-error",
    "mismatch: seed a graphic that differs from the linked species → db-enemy-species-graphic-mismatch",
  ];
  await ensureModalOpen(page);
  await switchTabAnyMode(page, ENEMIES_TAB);

  const added = await clickAdd(page, ADAPTERS[0]!);
  const unsetVisible = await visible(page.getByTestId("db-enemy-species-unset-warn"), 2_000);
  if (!unsetVisible) {
    emit({
      id: "enemy-chip-unset-missing",
      probeId: "enemy-species-chips",
      tabs: ["enemies"],
      S: 2,
      B: 2,
      title: "Enemy with empty speciesId did not show db-enemy-species-unset-warn",
      repro: [...repro, `addOk=${added.ok}`],
      evidence: await shot(page, "enemy-chip-unset"),
      status: "confirmed",
    });
  }

  if (SEEDING_PROVEN) {
    await mutatedProject(page, (project) => {
      const enemies = (project.database as { enemies: { id: string; speciesId?: string; monsterResourceId?: string }[] }).enemies;
      const slime = enemies.find((entry) => entry.id === "enemy_slime") ?? enemies[0];
      if (slime) slime.speciesId = "species_missing_audit";
    });
    await switchTabAnyMode(page, ITEMS_TAB);
    await switchTabAnyMode(page, ENEMIES_TAB);
    await safeClick(page.getByTestId("db-record-row-enemy_slime"));
    const missingVisible = await visible(page.getByTestId("db-enemy-species-missing-error"), 2_000);
    if (!missingVisible) {
      emit({
        id: "enemy-chip-missing-absent",
        probeId: "enemy-species-chips",
        tabs: ["enemies"],
        S: 2,
        B: 2,
        title: "Enemy pointing at a deleted speciesId did not show db-enemy-species-missing-error",
        repro,
        evidence: await shot(page, "enemy-chip-missing"),
        status: "confirmed",
      });
    }

    await mutatedProject(page, (project) => {
      const enemies = (project.database as { enemies: { id: string; speciesId?: string; monsterResourceId?: string }[] }).enemies;
      const slime = enemies.find((entry) => entry.id === "enemy_slime") ?? enemies[0];
      if (slime) {
        slime.speciesId = "species_wild_slime";
        slime.monsterResourceId = "generated-enemy-dragon-01";
      }
    });
    await switchTabAnyMode(page, ITEMS_TAB);
    await switchTabAnyMode(page, ENEMIES_TAB);
    await safeClick(page.getByTestId("db-record-row-enemy_slime"));
    const mismatchVisible = await visible(page.getByTestId("db-enemy-species-graphic-mismatch"), 2_000);
    if (!mismatchVisible) {
      emit({
        id: "enemy-chip-mismatch-absent",
        probeId: "enemy-species-chips",
        tabs: ["enemies"],
        S: 2,
        B: 1,
        title: "Enemy graphic differing from its species did not show db-enemy-species-graphic-mismatch",
        repro,
        evidence: await shot(page, "enemy-chip-mismatch"),
        status: "confirmed",
      });
    }
    if (unsetVisible && missingVisible && mismatchVisible) {
      clean("enemy-species-chips", ["enemies"], "Unset / missing / graphic-mismatch chips all rendered", repro);
    }
    return;
  }

  if (unsetVisible) {
    emit({
      id: "enemy-chip-seeding-limited",
      probeId: "enemy-species-chips",
      tabs: ["enemies"],
      S: 0,
      B: 0,
      title: "Missing/mismatch chips not seeded — SEEDING_PROVEN is false",
      repro,
      evidence: [],
      status: "seeding-limited",
    });
  }
}

async function probeTroopUncapturable(page: Page): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, TROOPS_TAB);
  const repro = [
    "troops tab → toggle db-field-troop-uncapturable",
    "exportedProject.database.troops[id].uncapturable must round-trip",
  ];
  const id = await selectedRecordId(page);
  const checkbox = page.getByTestId("db-field-troop-uncapturable");
  if (!(await visible(checkbox, 2_000)) || !id) {
    emit({
      id: "troop-uncapturable-missing",
      probeId: "troop-uncapturable",
      tabs: ["troops"],
      S: 2,
      B: 1,
      title: "Troop uncapturable checkbox was not reachable",
      repro,
      evidence: await shot(page, "troop-uncapturable-missing"),
      status: "confirmed",
    });
    return;
  }
  const before = (await projectOf(page)).database.troops.find((entry) => entry.id === id)?.uncapturable === true;
  if (before) await checkbox.uncheck();
  else await checkbox.check();
  const expected = !before;
  let stored = false;
  try {
    await expect
      .poll(async () => {
        stored = (await projectOf(page)).database.troops.find((entry) => entry.id === id)?.uncapturable === true;
        return stored;
      }, { timeout: 4_000 })
      .toBe(expected);
  } catch {
    stored = (await projectOf(page)).database.troops.find((entry) => entry.id === id)?.uncapturable === true;
  }
  if (stored !== expected) {
    emit({
      id: "troop-uncapturable-no-roundtrip",
      probeId: "troop-uncapturable",
      tabs: ["troops"],
      S: 3,
      B: 2,
      title: "Troop uncapturable toggle did not persist through exportedProject",
      repro: [...repro, `id=${id} expected=${expected} stored=${stored}`],
      evidence: await shot(page, "troop-uncapturable"),
      status: "confirmed",
    });
    return;
  }
  clean("troop-uncapturable", ["troops"], "Troop uncapturable toggle round-tripped via exportedProject", repro);
}

async function probeNoDualWriteStats(page: Page): Promise<void> {
  await ensureModalOpen(page);
  await switchTabAnyMode(page, ENEMIES_TAB);
  const repro = [
    "select enemy_slime (species_wild_slime)",
    "edit db-field-enemy-max-hp",
    "exportedProject species.baseStats must stay untouched (G006 no dual-write)",
  ];
  await safeClick(page.getByTestId("db-record-row-enemy_slime"));
  const before = (await projectOf(page)).database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime");
  const beforeHp = before?.baseStats.maxHp;
  await page.getByTestId("db-field-enemy-max-hp").fill("777");
  await page.getByTestId("db-field-enemy-max-hp").blur();
  await expect
    .poll(async () => (await projectOf(page)).database.enemies.find((entry) => entry.id === "enemy_slime")?.stats.maxHp, {
      timeout: 4_000,
    })
    .toBe(777);
  const after = (await projectOf(page)).database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime");
  if (after?.baseStats.maxHp !== beforeHp) {
    emit({
      id: "no-dual-write-species-mutated",
      probeId: "no-dual-write",
      tabs: ["enemies", "monsterSpecies"],
      S: 4,
      B: 3,
      title: "Editing an enemy stat also mutated the linked species baseStats (dual-write)",
      repro: [...repro, `before=${beforeHp} after=${after?.baseStats.maxHp}`],
      evidence: await shot(page, "dual-write"),
      status: "confirmed",
    });
    return;
  }
  clean("no-dual-write", ["enemies", "monsterSpecies"], "Enemy stat edit left species.baseStats untouched", repro);
}

async function noteKnownBeginnerGaps(page: Page): Promise<void> {
  await ensureModalOpen(page);
  const titles = await page.locator(".db-tab").evaluateAll((nodes) =>
    nodes.map((node) => ({
      testid: node instanceof HTMLElement ? node.dataset.testid ?? "" : "",
      title: node instanceof HTMLElement ? node.getAttribute("title") : null,
    })),
  );
  const collectionTabs = titles.filter((entry) =>
    ["db-tab-enemies", "db-tab-monster-species", "db-tab-troops", "db-tab-crops", "db-tab-characters"].includes(
      entry.testid,
    ),
  );
  const missingTitle = collectionTabs.filter((entry) => !entry.title);
  const repro = [
    "Already-known (do not re-file as new): appendTabButton never sets title; tab labels ignore jargonStyle",
    `collection tabs missing title: ${missingTitle.map((entry) => entry.testid).join(",") || "(none)"}`,
  ];
  emit({
    id: "known-db-tab-title-and-jargon",
    probeId: "known-beginner-gaps",
    tabs: ADAPTERS.map((adapter) => adapter.id),
    S: 1,
    B: 2,
    title: "Known: collection db-tab buttons have no title and ignore jargonStyle (not a new finding)",
    repro,
    evidence: [],
    status: "pre-existing",
  });
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
    await expect(name).toBeVisible();
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
  await expect(chip).toBeVisible();
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
  await expect(search).toBeVisible();
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
    `items=${items.length} (threshold ${VIRTUALIZER_THRESHOLD}) → search offscreen record ${target.id} (${target.name})`,
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
