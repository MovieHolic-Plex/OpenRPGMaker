import { expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exportedProject, type DatabaseTabSpec } from "./rm2k3-database-helpers";

export type EditorLaneMode = "beginner" | "expert";

export type BootDbLaneOpts = {
  readonly mode: EditorLaneMode;
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Applied after the standard onboarding-key clear. `null` removes the key. */
  readonly localStorageSeed?: Readonly<Record<string, string | null>>;
};

export const EDITOR_UI_MODE_KEY = "oprn:editor-ui-mode";
export const ONBOARDING_STORAGE_KEYS = [
  "oprn:coachmarks-basic-v1",
  "rpgzzu:standard-welcome-seen",
  "oprn:editor-welcome-dismissed",
  "oprn:db-dock-mode",
  "oprn:database.activeTab",
] as const;

export const COMMON_DB_TAB_TEST_IDS = [
  "db-tab-overview",
  "db-tab-actors",
  "db-tab-items",
  "db-tab-enemies",
  "db-tab-troops",
  "db-tab-system",
] as const;

export const VIRTUALIZER_THRESHOLD = 80;

export const DATA_AUDIT_PATH = "output/evidence/db-beginner-audit/data-audit.json";
export const SEEDING_SPIKE_PATH = "output/evidence/db-beginner-audit/seeding-spike.json";
export const FINDINGS_DIR = "output/evidence/db-beginner-audit/findings";

const ALLOWED_CONSOLE_ERROR = "Failed to load resource: net::ERR_CONNECTION_REFUSED";

const DIRTY_PROMPT_BUTTONS = [
  "database-dirty-save",
  "database-dirty-discard",
  "database-dirty-keep-editing",
] as const;

export const BOUNDARY_INPUTS = {
  empty: "",
  whitespace: "   ",
  longCjk: "가나다라마바사아자차".repeat(10),
  emojiZwj: "🧙‍♂️🗡️😀",
  htmlInjection: '"><img src=x onerror=1>',
  boldTag: "<b>x</b>",
  minus1: "-1",
  zero: "0",
  huge: "9999999",
  abc: "abc",
  leadingZeros: "007",
  scientific: "1e6",
} as const;

export type FindingStatus =
  | "confirmed"
  | "unconfirmed-vqa"
  | "seeding-limited"
  | "pre-existing"
  | "clean";

export type FindingBand = "P0" | "P1" | "P2" | "backlog";

export type AuditFinding = {
  readonly spec: string;
  readonly id: string;
  readonly probeId: string;
  readonly tabs: readonly string[];
  readonly S: 0 | 1 | 2 | 3 | 4;
  readonly B: 0 | 1 | 2 | 3;
  readonly score: number;
  readonly band: FindingBand;
  readonly title: string;
  readonly repro: readonly string[];
  readonly evidence: readonly string[];
  readonly status: FindingStatus;
};

export type DataAuditCounts = {
  readonly items: number;
  readonly switches: number;
  readonly variables: number;
  readonly enemies: number;
  readonly skills: number;
  readonly actors: number;
  readonly classes: number;
  readonly equipment: number;
  readonly states: number;
  readonly troops: number;
  readonly animations: number;
  readonly elements: number;
  readonly characters: number;
  readonly crops: number;
  readonly monsterSpecies: number;
  readonly commonEvents: number;
};

export type DataAuditReport = {
  readonly counts: DataAuditCounts;
  readonly exceedsVirtualizerThreshold: readonly string[];
  readonly threshold: typeof VIRTUALIZER_THRESHOLD;
};

export type SeedingSpikeReport = {
  readonly proven: boolean;
  readonly reason: string;
  readonly bridge: string;
};

export type MutableProject = {
  database?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Wave-1 seeding spike verdict. `__rpgzzuEditorStore.update` is exposed on the
 * DEV window (src/main.ts) and the smoke spec verified that `exportedProject`
 * reflects an in-page mutation. Seed-dependent probes may use `mutatedProject`.
 */
export const SEEDING_PROVEN = true;

const DEFAULT_VIEWPORT = { width: 1400, height: 900 } as const;

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

async function dismissCoachMarks(page: Page): Promise<void> {
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}

async function openDatabaseAnyMode(page: Page): Promise<void> {
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByTestId("menu-tools").click();
    await page.getByTestId("menu-tools-database").click();
  }
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

export async function bootDbLane(page: Page, opts: BootDbLaneOpts): Promise<void> {
  const viewport = opts.viewport ?? DEFAULT_VIEWPORT;
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ({ mode, onboardingKeys, modeKey, seed }) => {
      localStorage.setItem(modeKey, mode);
      for (const key of onboardingKeys) localStorage.removeItem(key);
      if (!seed) return;
      for (const [key, value] of Object.entries(seed)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    },
    {
      mode: opts.mode,
      onboardingKeys: ONBOARDING_STORAGE_KEYS,
      modeKey: EDITOR_UI_MODE_KEY,
      seed: opts.localStorageSeed ?? null,
    },
  );
  await page.goto("/?freshProject=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissCoachMarks(page);
  await openDatabaseAnyMode(page);
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

export async function switchTabAnyMode(page: Page, tab: DatabaseTabSpec): Promise<void> {
  const button = page.getByTestId(tab.testId);
  if (!(await button.isVisible().catch(() => false))) {
    const all = page.getByTestId("db-nav-all");
    await expect(all, `db-nav-all must exist to reach ${tab.testId} in beginner nav`).toBeVisible();
    if ((await all.getAttribute("open")) === null) {
      await all.locator("summary").click();
    }
    await expect(button).toBeVisible();
  }
  await button.click({ force: true });
  await expect(button).toHaveClass(/active/);
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.text() === ALLOWED_CONSOLE_ERROR) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

/** Raw mouse click with zero actionability waiting — a re-render between down/up kills the click. */
export async function rawClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("rawClick target has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

export async function dirtyGuardOracle(
  page: Page,
  closePath: "escape" | "backdrop" | "x" | "cancel",
): Promise<{ promptShown: boolean; buttons: string[] }> {
  switch (closePath) {
    case "escape":
      await page.keyboard.press("Escape");
      break;
    case "backdrop":
      // databaseModal.ts listens for mousedown on the backdrop host and only
      // closes when event.target === backdrop (not the inner window).
      await page.getByTestId("database-modal").dispatchEvent("mousedown");
      break;
    case "x":
      await page.getByTestId("database-modal-close").click();
      break;
    case "cancel":
      await page.getByTestId("database-footer-ok").click();
      break;
  }

  const prompt = page.getByTestId("database-dirty-prompt");
  const promptShown = await prompt.isVisible().catch(() => false);
  const buttons: string[] = [];
  if (promptShown) {
    for (const testId of DIRTY_PROMPT_BUTTONS) {
      if (await page.getByTestId(testId).isVisible().catch(() => false)) buttons.push(testId);
    }
  }
  return { promptShown, buttons };
}

export function bandForScore(score: number): FindingBand {
  if (score >= 9) return "P0";
  if (score >= 6) return "P1";
  if (score >= 3) return "P2";
  return "backlog";
}

function assertStringArray(value: unknown, field: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`recordFinding: ${field} must be a string[]`);
  }
}

export function validateFinding(finding: AuditFinding): void {
  if (typeof finding.spec !== "string" || !/^[\w.-]+$/.test(finding.spec)) {
    throw new Error(`recordFinding: spec must be a filename-safe token, got ${JSON.stringify(finding.spec)}`);
  }
  if (typeof finding.id !== "string" || finding.id.length === 0) {
    throw new Error("recordFinding: id must be a non-empty string");
  }
  if (typeof finding.probeId !== "string" || finding.probeId.length === 0) {
    throw new Error("recordFinding: probeId must be a non-empty string");
  }
  assertStringArray(finding.tabs, "tabs");
  if (![0, 1, 2, 3, 4].includes(finding.S)) {
    throw new Error(`recordFinding: S must be 0..4, got ${String(finding.S)}`);
  }
  if (![0, 1, 2, 3].includes(finding.B)) {
    throw new Error(`recordFinding: B must be 0..3, got ${String(finding.B)}`);
  }
  if (finding.score !== finding.S * finding.B) {
    throw new Error(`recordFinding: score must equal S*B (${finding.S * finding.B}), got ${finding.score}`);
  }
  const expectedBand = bandForScore(finding.score);
  if (finding.band !== expectedBand) {
    throw new Error(`recordFinding: band must be ${expectedBand} for score ${finding.score}, got ${finding.band}`);
  }
  if (typeof finding.title !== "string" || finding.title.length === 0) {
    throw new Error("recordFinding: title must be a non-empty string");
  }
  assertStringArray(finding.repro, "repro");
  assertStringArray(finding.evidence, "evidence");
  const statuses: readonly FindingStatus[] = [
    "confirmed",
    "unconfirmed-vqa",
    "seeding-limited",
    "pre-existing",
    "clean",
  ];
  if (!statuses.includes(finding.status)) {
    throw new Error(`recordFinding: invalid status ${JSON.stringify(finding.status)}`);
  }
}

export function recordFinding(finding: AuditFinding): void {
  validateFinding(finding);
  mkdirSync(FINDINGS_DIR, { recursive: true });
  const file = path.join(FINDINGS_DIR, `${finding.spec}.json`);
  let existing: unknown[] = [];
  try {
    const raw = readFileSync(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`recordFinding: ${file} exists but is not a JSON array`);
    }
    existing = parsed;
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }
  existing.push(finding);
  writeFileSync(file, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
}

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "ENOENT";
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function countRecord(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

export async function collectFreshProjectDataAudit(page: Page): Promise<DataAuditReport> {
  await expect
    .poll(async () => page.getByTestId("project-export-json").textContent(), { timeout: 5_000 })
    .not.toBe("");
  const project = await exportedProject(page);
  const extra = project as typeof project & {
    characters?: Record<string, unknown>;
    database: typeof project.database & {
      crops?: unknown[];
      monsterSpecies?: unknown[];
    };
  };
  const counts: DataAuditCounts = {
    items: countArray(extra.database.items),
    switches: countArray(extra.switches),
    variables: countArray(extra.variables),
    enemies: countArray(extra.database.enemies),
    skills: countArray(extra.database.skills),
    actors: countArray(extra.database.actors),
    classes: countArray(extra.database.classes),
    equipment: countArray(extra.database.equipment),
    states: countArray(extra.database.states),
    troops: countArray(extra.database.troops),
    animations: countArray(extra.database.battleAnimations),
    elements: countArray(extra.database.elements),
    characters: countRecord(extra.characters),
    crops: countArray(extra.database.crops),
    monsterSpecies: countArray(extra.database.monsterSpecies),
    commonEvents: countArray(extra.commonEvents),
  };
  const exceedsVirtualizerThreshold = (Object.entries(counts) as [keyof DataAuditCounts, number][])
    .filter(([, count]) => count > VIRTUALIZER_THRESHOLD)
    .map(([name]) => name);
  return { counts, exceedsVirtualizerThreshold, threshold: VIRTUALIZER_THRESHOLD };
}

export function writeDataAudit(report: DataAuditReport): void {
  mkdirSync(path.dirname(DATA_AUDIT_PATH), { recursive: true });
  writeFileSync(DATA_AUDIT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function writeSeedingSpike(report: SeedingSpikeReport): void {
  mkdirSync(path.dirname(SEEDING_SPIKE_PATH), { recursive: true });
  writeFileSync(SEEDING_SPIKE_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

/**
 * Mutate the in-memory project via the DEV store bridge and wait until the
 * hidden export oracle (`project-export-json`) is rewritten.
 *
 * `mutator` is serialized into the page, so it must not close over outer
 * locals — pass those through `payload`.
 */
export async function mutatedProject<T = unknown>(
  page: Page,
  mutator: (project: MutableProject, payload: T) => void,
  payload?: T,
): Promise<void> {
  const before = await page.getByTestId("project-export-json").textContent();
  const result = await page.evaluate(
    ({ src, data }) => {
      const store = (window as unknown as {
        __rpgzzuEditorStore?: {
          update?: (fn: (draft: MutableProject) => void, change?: { scope: string }) => void;
        };
      }).__rpgzzuEditorStore;
      if (!store || typeof store.update !== "function") return "missing-bridge";
      // Playwright cannot structured-clone functions; reconstruct from source.
      const fn = new Function(
        "project",
        "payload",
        `"use strict"; return (${src})(project, payload);`,
      ) as (project: MutableProject, payload: T) => void;
      store.update((draft) => {
        fn(draft, data as T);
      }, { scope: "database" });
      return "ok";
    },
    { src: mutator.toString(), data: payload },
  );
  if (result !== "ok") {
    throw new Error("mutatedProject: window.__rpgzzuEditorStore.update is not available");
  }

  // Timing contract under attack: editor.ts updateProjectExport uses a 150ms
  // trailing debounce, so the hidden oracle lags store.update. Poll the node
  // itself instead of sleeping that window.
  await expect
    .poll(async () => page.getByTestId("project-export-json").textContent(), { timeout: 2_000 })
    .not.toBe(before);
}

export async function runSeedingSpike(page: Page): Promise<SeedingSpikeReport> {
  const bridge = await page.evaluate(() => {
    const store = (window as unknown as { __rpgzzuEditorStore?: { update?: unknown } }).__rpgzzuEditorStore;
    return typeof store?.update === "function" ? "window.__rpgzzuEditorStore.update" : "missing";
  });
  if (bridge === "missing") {
    const report: SeedingSpikeReport = {
      proven: false,
      reason: "No in-page store mutation bridge: window.__rpgzzuEditorStore.update is not exposed.",
      bridge,
    };
    writeSeedingSpike(report);
    return report;
  }

  const sentinel = "SEEDING_SPIKE_OK";
  try {
    await mutatedProject(page, (project, name) => {
      const database = project.database as { actors?: { name: string }[] } | undefined;
      if (!database || !database.actors || !database.actors[0]) {
        throw new Error("freshProject has no actors to mutate");
      }
      database.actors[0].name = name;
    }, sentinel);
    const after = await exportedProject(page);
    const proven = after.database.actors[0]?.name === sentinel;
    const report: SeedingSpikeReport = {
      proven,
      reason: proven
        ? "store.update mutation is visible through exportedProject"
        : `exportedProject.database.actors[0].name was ${JSON.stringify(after.database.actors[0]?.name)} after mutation`,
      bridge,
    };
    writeSeedingSpike(report);
    return report;
  } catch (error) {
    const report: SeedingSpikeReport = {
      proven: false,
      reason: error instanceof Error ? error.message : String(error),
      bridge,
    };
    writeSeedingSpike(report);
    return report;
  }
}
