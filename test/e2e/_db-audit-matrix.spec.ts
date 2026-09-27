import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  bandForScore,
  bootDbLane,
  collectConsoleErrors,
  dirtyGuardOracle,
  mutatedProject,
  recordFinding,
  switchTabAnyMode,
  VIRTUALIZER_THRESHOLD,
  type AuditFinding,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject, type DatabaseTabSpec } from "./oprn-database-helpers";

/**
 * Diagnostic adversarial audit of Database matrix/grid editors (todo 10).
 * `_` prefix keeps it out of the default suite. Probe outcomes are findings,
 * never suite failures — wrap each probe so one broken surface cannot abort
 * the rest. Assert only harness invariants (app booted, tab opened).
 */

test.use({ serviceWorkers: "block" });

const SPEC = "_db-audit-matrix";
const SHOT_DIR = "output/evidence/db-beginner-audit/shots";
const FINDINGS_PATH = `output/evidence/db-beginner-audit/findings/${SPEC}.json`;

const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;
const ELEMENTS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "elements")!;
const ANIMATIONS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "animations")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;
const SPECIES_TAB = {
  label: "Monster Species",
  slug: "monster-species",
  testId: "db-tab-monster-species",
} as const satisfies DatabaseTabSpec;

const TYPE_CHART_CYCLE = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4] as const;
const B8_TYPES = ["alpha", "beta", "gamma", "delta", "epsilon"] as const;
const B10_TYPES = Array.from({ length: 32 }, (_, i) => `t${String(i).padStart(2, "0")}`);
const OFFSCREEN_ITEM = { id: "item_gen_lamp_oil", name: "기름 등불" } as const;

type ExtraProject = {
  system: {
    typeChart?: { types?: string[]; multipliers?: Record<string, Record<string, number>> };
  };
  database: {
    actors: { id: string; name: string; elementRates?: Record<string, string> }[];
    elements?: { id: string; name: string }[];
    monsterSpecies?: { id: string; name: string; types?: string[] }[];
    battleAnimations: {
      id: string;
      name: string;
      frames?: { cells: { pattern: number; x: number; y: number; zoom: number; opacity: number }[] }[];
    }[];
  };
};

type FindingDraft = Omit<AuditFinding, "spec" | "score" | "band">;

test.describe("DB audit — matrix/grid editors", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
    mkdirSync("output/evidence/db-beginner-audit/findings", { recursive: true });
    writeFileSync(FINDINGS_PATH, "[]\n", "utf8");
  });

  test("expert lane B1–B10 + X2/X3/X6/X13; beginner B3", async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await switchTabAnyMode(page, SYSTEM_TAB);
    await expect(page.getByTestId("db-tab-system")).toHaveClass(/active/);

    await runProbe(page, errors, "X2", () => probeX2(page));
    await runProbe(page, errors, "B1", () => probeB1(page));
    await runProbe(page, errors, "B2", () => probeB2(page));
    await runProbe(page, errors, "B8", () => probeB8(page));
    await runProbe(page, errors, "B10", () => probeB10(page));
    await runProbe(page, errors, "B9", () => probeB9(page));
    await runProbe(page, errors, "B3-expert", () => probeB3(page, "expert"));
    await runProbe(page, errors, "B4", () => probeB4(page));
    await runProbe(page, errors, "B6", () => probeB6(page));
    await runProbe(page, errors, "B5", () => probeB5(page));
    await runProbe(page, errors, "B7", () => probeB7(page));
    await runProbe(page, errors, "X6", () => probeX6(page));
    await runProbe(page, errors, "X13", () => probeX13(page));
    await runProbe(page, errors, "X3", () => probeX3(page));

    await bootDbLane(page, { mode: "beginner" });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await switchTabAnyMode(page, SYSTEM_TAB);
    await expect(page.getByTestId("db-tab-system")).toHaveClass(/active/);
    await runProbe(page, errors, "B3-beginner", () => probeB3(page, "beginner"));
  });
});

async function runProbe(
  page: Page,
  errors: string[],
  probeId: string,
  body: () => Promise<void>,
): Promise<void> {
  const before = errors.length;
  try {
    await body();
  } catch (error) {
    const evidence = await shot(page, `${probeId.toLowerCase()}-threw`);
    emit({
      id: `MAT-${probeId}-threw`,
      probeId,
      tabs: ["system"],
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
    const evidence = await shot(page, `${probeId.toLowerCase()}-console`);
    emit({
      id: `MAT-${probeId}-console`,
      probeId,
      tabs: ["system"],
      S: 1,
      B: 1,
      title: `${probeId} emitted console errors`,
      repro: [`run ${probeId}`, ...fresh.slice(0, 6)],
      evidence: [evidence],
      status: "confirmed",
    });
  }
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

async function shot(page: Page, name: string): Promise<string> {
  const path = `${SHOT_DIR}/${SPEC}-${name}.png`;
  mkdirSync(SHOT_DIR, { recursive: true });
  const modal = page.getByTestId("database-modal");
  if (await modal.isVisible().catch(() => false)) {
    await modal.screenshot({ path });
  } else {
    await page.screenshot({ path });
  }
  return path;
}

async function projectOf(page: Page): Promise<ExtraProject> {
  return (await exportedProject(page)) as unknown as ExtraProject;
}

async function openTypeChart(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, SYSTEM_TAB);
  await page.getByTestId("db-system-nav-typechart").click();
  await expect(page.getByTestId("db-field-system-type-chart-types")).toBeVisible();
}

async function setTypeList(page: Page, types: string): Promise<void> {
  await openTypeChart(page);
  const input = page.getByTestId("db-field-system-type-chart-types");
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(types);
  // change-handler (not input) writes the store; dispatch+Tab commit even when
  // fill() lands on an already-matching value or a just-cleared field.
  await input.dispatchEvent("change");
  await input.press("Tab");
  const expected = types.split(",").map((part) => part.trim()).filter(Boolean);
  await expect
    .poll(async () => {
      const live = page.getByTestId("db-field-system-type-chart-types");
      return (await live.inputValue()).trim();
    }, { timeout: 3_000 })
    .toBe(expected.join(", "));
  if (expected.length === 0) {
    await expect(page.getByTestId("db-type-chart-matrix")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("db-type-chart-matrix")).toBeVisible();
  }
}

async function ensureModal(page: Page): Promise<void> {
  if (await page.getByTestId("database-modal").isVisible().catch(() => false)) return;
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByTestId("toolbar-database").click();
  }
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

async function dismissDirtyIfAny(page: Page, decision: "keep" | "discard" | "save" = "keep"): Promise<void> {
  const prompt = page.getByTestId("database-dirty-prompt");
  if (!(await prompt.isVisible().catch(() => false))) return;
  const id =
    decision === "discard"
      ? "database-dirty-discard"
      : decision === "save"
        ? "database-dirty-save"
        : "database-dirty-keep-editing";
  await page.getByTestId(id).click();
}

async function chipValue(page: Page, testId: string): Promise<string> {
  return (await page.getByTestId(testId).getAttribute("data-value")) ?? "";
}

async function chipState(page: Page, testId: string): Promise<string> {
  return (await page.getByTestId(testId).getAttribute("data-state")) ?? "";
}

function expectedStateFor(value: number): "up" | "down" | "neutral" {
  if (value > 1) return "up";
  if (value < 1) return "down";
  return "neutral";
}

function nextCycle(current: number): number {
  return TYPE_CHART_CYCLE.find((value) => value > current + 1e-9) ?? TYPE_CHART_CYCLE[0];
}

function snap025(value: number): number {
  return Math.round(value / 0.25) * 0.25;
}

// ---------------------------------------------------------------------------
// B1 — chip cycle + transposition
// ---------------------------------------------------------------------------
async function probeB1(page: Page): Promise<void> {
  await setTypeList(page, "fire, water, grass");
  const chip = page.getByTestId("db-type-chart-fire-water");
  await expect(chip).toBeVisible();

  await chip.click({ button: "right" });
  await page.getByTestId("db-type-chart-popover-input").fill("0");
  await page.getByTestId("db-type-chart-popover-confirm").click();
  await expect(chip).toHaveAttribute("data-value", "0");

  const seen: { value: string; state: string }[] = [];
  const mismatches: string[] = [];
  for (let i = 0; i < 9; i += 1) {
    const before = Number(await chipValue(page, "db-type-chart-fire-water"));
    await chip.click();
    const value = await chipValue(page, "db-type-chart-fire-water");
    const state = await chipState(page, "db-type-chart-fire-water");
    seen.push({ value, state });
    const numeric = Number(value);
    const expected = nextCycle(before);
    if (Math.abs(numeric - expected) > 1e-9) {
      mismatches.push(`click ${i + 1}: got ${value}, expected ${expected}`);
    }
    const stateExpected = expectedStateFor(numeric);
    if (state !== stateExpected) {
      mismatches.push(`click ${i + 1}: data-state=${state}, expected ${stateExpected}`);
    }
  }
  const evidence = await shot(page, "b1-cycle");
  if (mismatches.length === 0) {
    emit({
      id: "MAT-B1-cycle",
      probeId: "B1",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "typeChart chip cycles 0→0.25→0.5→1→1.5→2→3→4→0 and data-state agrees",
      repro: [
        "system → typechart → set types fire, water",
        "right-click db-type-chart-fire-water, set 0, confirm",
        "left-click 9 times, read data-value + data-state each click",
        `observed ${JSON.stringify(seen)}`,
      ],
      evidence: [evidence],
      status: "clean",
    });
  } else {
    emit({
      id: "MAT-B1-cycle",
      probeId: "B1",
      tabs: ["system"],
      S: 3,
      B: 2,
      title: "typeChart chip cycle or data-state desynced from documented 0→4 wrap",
      repro: [
        "system → typechart → db-type-chart-fire-water click ×9 from 0",
        ...mismatches,
      ],
      evidence: [evidence],
      status: "confirmed",
    });
  }

  await chip.click({ button: "right" });
  await page.getByTestId("db-type-chart-popover-input").fill("3");
  await page.getByTestId("db-type-chart-popover-confirm").click();
  const ab = await chipValue(page, "db-type-chart-fire-water");
  const ba = await chipValue(page, "db-type-chart-water-fire");
  const transposeShot = await shot(page, "b1-transpose");
  if (ab === "3" && ba !== "3") {
    emit({
      id: "MAT-B1-transpose",
      probeId: "B1",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "asymmetric typeChart edit does not swap attacker/defender",
      repro: [
        "set db-type-chart-fire-water to 3 via popover",
        `read fire-water=${ab} water-fire=${ba} (must differ)`,
      ],
      evidence: [transposeShot],
      status: "clean",
    });
  } else {
    emit({
      id: "MAT-B1-transpose",
      probeId: "B1",
      tabs: ["system"],
      S: 3,
      B: 3,
      title: "typeChart attacker/defender appear transposed or write leaked",
      repro: [
        "set db-type-chart-fire-water to 3",
        `fire-water=${ab} water-fire=${ba}`,
      ],
      evidence: [transposeShot],
      status: "confirmed",
    });
  }
}

// ---------------------------------------------------------------------------
// B2 — popover clamp
// ---------------------------------------------------------------------------
async function probeB2(page: Page): Promise<void> {
  await openTypeChart(page);
  const chip = page.getByTestId("db-type-chart-fire-grass");
  await expect(chip).toBeVisible();
  await chip.click({ button: "right" });
  await page.getByTestId("db-type-chart-popover-input").fill("1.5");
  await page.getByTestId("db-type-chart-popover-confirm").click();
  await expect(chip).toHaveAttribute("data-value", "1.5");

  const cases: { input: string; expectClamp?: number; rejectWithoutWipe?: boolean }[] = [
    { input: "-1", expectClamp: 0 },
    { input: "5", expectClamp: 4 },
    { input: "0.33", expectClamp: snap025(0.33) },
    { input: "abc", rejectWithoutWipe: true },
  ];
  const deviations: string[] = [];
  let wiped = false;
  let unsnapped: string | undefined;

  for (const trial of cases) {
    const prior = await chipValue(page, "db-type-chart-fire-grass");
    await chip.click({ button: "right" });
    const input = page.getByTestId("db-type-chart-popover-input");
    if (trial.input === "abc") {
      // type=number rejects letters via fill(); force the parse path the confirm handler uses.
      await input.evaluate((node) => {
        (node as HTMLInputElement).value = "abc";
      });
    } else {
      await input.fill(trial.input);
    }
    await page.getByTestId("db-type-chart-popover-confirm").click();
    const after = await chipValue(page, "db-type-chart-fire-grass");
    const numeric = Number(after);
    if (trial.rejectWithoutWipe) {
      if (after !== prior) {
        wiped = true;
        deviations.push(`abc changed data-value ${prior} → ${after} (must reject without wipe)`);
      }
    } else if (trial.expectClamp !== undefined) {
      if (trial.input === "0.33") {
        const inRange = numeric >= 0 && numeric <= 4;
        const snapped = Math.abs(numeric - trial.expectClamp) < 1e-9;
        if (!inRange) deviations.push(`0.33 stored out of [0,4]: ${after}`);
        else if (!snapped) {
          unsnapped = after;
          deviations.push(`0.33 stored as ${after}, expected snap to ${trial.expectClamp}`);
        }
      } else if (Math.abs(numeric - trial.expectClamp) > 1e-9) {
        deviations.push(`${trial.input} stored as ${after}, expected clamp ${trial.expectClamp}`);
      }
    }
  }

  const evidence = await shot(page, "b2-popover");
  if (deviations.length === 0) {
    emit({
      id: "MAT-B2-clamp",
      probeId: "B2",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "typeChart popover clamps [-1,5] to [0,4], snaps 0.33, rejects abc without wipe",
      repro: [
        "right-click db-type-chart-fire-grass",
        "enter -1, 5, 0.33, abc into db-type-chart-popover-input and confirm each",
      ],
      evidence: [evidence],
      status: "clean",
    });
    return;
  }

  if (wiped) {
    emit({
      id: "MAT-B2-abc-wipe",
      probeId: "B2",
      tabs: ["system"],
      S: 3,
      B: 1,
      title: "typeChart popover abc input wipes the prior multiplier",
      repro: [
        "set db-type-chart-fire-grass to 1.5",
        "right-click, set input to abc, confirm",
        "data-value must stay 1.5",
        ...deviations.filter((line) => line.startsWith("abc")),
      ],
      evidence: [evidence],
      status: "confirmed",
    });
  }
  if (unsnapped !== undefined) {
    emit({
      id: "MAT-B2-unsnapped",
      probeId: "B2",
      tabs: ["system"],
      S: 3,
      B: 0,
      title: "typeChart popover stores 0.33 without snapping to a 0.25 step",
      repro: [
        "right-click db-type-chart-fire-grass",
        "enter 0.33, confirm",
        `stored data-value=${unsnapped} (contract: snap to 0.25)`,
      ],
      evidence: [evidence],
      status: "confirmed",
    });
  }
  const rangeHits = deviations.filter((line) => !line.startsWith("abc") && !line.startsWith("0.33"));
  if (rangeHits.length > 0) {
    emit({
      id: "MAT-B2-range",
      probeId: "B2",
      tabs: ["system"],
      S: 3,
      B: 1,
      title: "typeChart popover did not clamp -1/5 into [0,4]",
      repro: ["popover inputs -1 and 5", ...rangeHits],
      evidence: [evidence],
      status: "confirmed",
    });
  }
}

// ---------------------------------------------------------------------------
// B3 — blank type list (expert + beginner)
// ---------------------------------------------------------------------------
async function probeB3(page: Page, lane: "expert" | "beginner"): Promise<void> {
  await setTypeList(page, "fire, water, grass");
  await expect(page.getByTestId("db-type-chart-matrix")).toBeVisible();

  const before = await projectOf(page);
  expect(before.system.typeChart, "harness: typeChart must exist before blanking").toBeTruthy();

  const warningBefore = await visibleTypeWipeWarning(page);
  await setTypeList(page, "");
  await expect
    .poll(async () => (await page.getByTestId("db-field-system-type-chart-types").inputValue()).trim(), { timeout: 3_000 })
    .toBe("");
  const after = await projectOf(page);
  const deleted = after.system.typeChart === undefined;
  const warningAfter = await visibleTypeWipeWarning(page);
  const hadWarning = warningBefore || warningAfter;
  const evidence = await shot(page, `b3-blank-${lane}`);

  if (!deleted) {
    emit({
      id: `MAT-B3-not-deleted-${lane}`,
      probeId: "B3",
      tabs: ["system"],
      S: 3,
      B: 1,
      title: `${lane}: blank type list did not delete system.typeChart (documented contract)`,
      repro: [
        `${lane} lane, system → typechart`,
        "clear db-field-system-type-chart-types, blur",
        `typeChart still ${JSON.stringify(after.system.typeChart?.types ?? null)}`,
      ],
      evidence: [evidence],
      status: "confirmed",
    });
    return;
  }

  if (!hadWarning) {
    emit({
      id: `MAT-B3-no-warning-${lane}`,
      probeId: "B3",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: `${lane}: blank type list deletes typeChart with no visible warning`,
      repro: [
        `${lane} lane, system → typechart`,
        "fill db-field-system-type-chart-types with fire, water, grass and blur",
        "clear the field and blur",
        "assert system.typeChart is deleted",
        "assert no confirm/warning dialog or inline warning preceded the wipe",
      ],
      evidence: [evidence],
      status: "confirmed",
    });
    return;
  }

  emit({
    id: `MAT-B3-warned-${lane}`,
    probeId: "B3",
    tabs: ["system"],
    S: 0,
    B: 0,
    title: `${lane}: blank type list deletes typeChart after a visible warning`,
    repro: [
      `${lane} lane, clear db-field-system-type-chart-types`,
      "typeChart deleted and a warning was visible",
    ],
    evidence: [evidence],
    status: "clean",
  });
}

async function visibleTypeWipeWarning(page: Page): Promise<boolean> {
  // Only count UI that actually precedes destroying the chart. The modal dirty
  // prompt, footer copy, and unrelated 삭제 buttons are not a type-wipe warning.
  const dialog = page.getByRole("alertdialog");
  if (await dialog.isVisible().catch(() => false)) return true;
  const typed = page.locator(".db-field-hint, .db-type-chart-warn, [data-testid='db-type-chart-wipe-warn']");
  if (await typed.first().isVisible().catch(() => false)) return true;
  const toast = page.getByTestId("toast");
  if (await toast.isVisible().catch(() => false)) {
    const text = ((await toast.textContent()) ?? "");
    if (/타입|상성|삭제|사라|비우/.test(text)) return true;
  }
  const copy = page.locator(".db-system-sections").getByText(/경고|삭제되면|사라집니다|되돌릴 수 없|상성이 사라|타입 목록을 비우/);
  if (await copy.first().isVisible().catch(() => false)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// B4 — referenced-type deletion
// ---------------------------------------------------------------------------
async function probeB4(page: Page): Promise<void> {
  await setTypeList(page, "fire, water, grass");
  const before = await projectOf(page);
  const referenced = (before.database.monsterSpecies ?? []).find((species) => (species.types ?? []).includes("fire"));
  if (!referenced) {
    emit({
      id: "MAT-B4-seeding",
      probeId: "B4",
      tabs: ["system", "monster-species"],
      S: 0,
      B: 0,
      title: "B4 seeding-limited: no species referenced fire after restoring the default chart",
      repro: ["exportedProject.database.monsterSpecies has no types including fire"],
      evidence: [await shot(page, "b4-seeding")],
      status: "seeding-limited",
    });
    return;
  }

  await setTypeList(page, "water, grass");
  await switchTabAnyMode(page, SPECIES_TAB);
  await page.getByTestId(`db-monster-species-row-${referenced.id}`).click();
  const warn = page.getByTestId("db-monster-species-type-warn");
  const warnVisible = await warn.isVisible().catch(() => false);
  const after = await projectOf(page);
  const still = (after.database.monsterSpecies ?? []).find((species) => species.id === referenced.id);
  const preserved = (still?.types ?? []).includes("fire");
  const evidence = await shot(page, "b4-referenced-type");

  if (warnVisible && preserved) {
    emit({
      id: "MAT-B4-warn",
      probeId: "B4",
      tabs: ["system", "monster-species"],
      S: 0,
      B: 0,
      title: "deleting a still-referenced type keeps the outlier and shows db-monster-species-type-warn",
      repro: [
        `species ${referenced.id} types include fire`,
        "system type list → water, grass",
        `open db-monster-species-row-${referenced.id}`,
        "assert db-monster-species-type-warn visible and types still include fire",
      ],
      evidence: [evidence],
      status: "clean",
    });
    return;
  }

  emit({
    id: "MAT-B4-silent",
    probeId: "B4",
    tabs: ["system", "monster-species"],
    S: preserved ? 2 : 4,
    B: 3,
    title: warnVisible
      ? "referenced type cleared from species despite warn chip"
      : preserved
        ? "referenced type preserved but db-monster-species-type-warn is absent"
        : "deleting a chart type silently cleared the species outlier",
    repro: [
      `select species ${referenced.id} (${referenced.name}) which stored fire`,
      "set db-field-system-type-chart-types to water, grass",
      `warnVisible=${warnVisible} preserved=${preserved} types=${JSON.stringify(still?.types ?? [])}`,
    ],
    evidence: [evidence],
    status: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// B5 — documented-seam attack (99 → grade on element_0050 → 10 → 99)
// ---------------------------------------------------------------------------
async function probeB5(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ELEMENTS_TAB);
  await expect(page.getByTestId("db-elements-classic")).toBeVisible();

  await resizeElements(page, 99);
  let snap = await projectOf(page);
  const grown = (snap.database.elements ?? []).map((el) => el.id);
  if (!grown.includes("element_0050")) {
    emit({
      id: "MAT-B5-no-id",
      probeId: "B5",
      tabs: ["elements", "actors"],
      S: 0,
      B: 0,
      title: "B5 could not obtain element_0050 after resizing to 99",
      repro: [`elements after resize 99: ${grown.slice(-8).join(",")}`],
      evidence: [await shot(page, "b5-no-id")],
      status: "seeding-limited",
    });
    return;
  }

  await mutatedProject(page, (project) => {
    const db = project.database as { actors?: { elementRates?: Record<string, string> }[] } | undefined;
    const actor = db?.actors?.[0];
    if (!actor) throw new Error("freshProject has no actors");
    actor.elementRates = { ...(actor.elementRates ?? {}), element_0050: "A" };
  });

  snap = await projectOf(page);
  const planted = snap.database.actors[0]?.elementRates?.element_0050;
  if (planted !== "A") {
    emit({
      id: "MAT-B5-plant-failed",
      probeId: "B5",
      tabs: ["elements", "actors"],
      S: 0,
      B: 0,
      title: "B5 seeding-limited: could not plant element_0050=A on actor[0]",
      repro: [`planted=${String(planted)}`],
      evidence: [await shot(page, "b5-plant-failed")],
      status: "seeding-limited",
    });
    return;
  }

  await resizeElements(page, 10);
  const shrunk = await projectOf(page);
  const afterShrink = shrunk.database.actors[0]?.elementRates?.element_0050;
  const idsAfterShrink = (shrunk.database.elements ?? []).map((el) => el.id);

  await resizeElements(page, 99);
  const regrown = await projectOf(page);
  const revived = regrown.database.actors[0]?.elementRates?.element_0050;
  const idsAfterGrow = (regrown.database.elements ?? []).map((el) => el.id);
  const evidence = await shot(page, "b5-seam");

  const notes = [
    "elements maximum → 99",
    "mutatedProject: actors[0].elementRates.element_0050 = A",
    "elements maximum → 10",
    "elements maximum → 99",
    `afterShrink grade=${String(afterShrink)} idsHas50=${idsAfterShrink.includes("element_0050")}`,
    `afterRegrow grade=${String(revived)} idsHas50=${idsAfterGrow.includes("element_0050")}`,
  ];

  // Neutral means the key is absent (defaults to C) or explicitly C. A revived A is S4.
  if (revived === "A") {
    emit({
      id: "MAT-B5-revived",
      probeId: "B5",
      tabs: ["elements", "actors"],
      S: 4,
      B: 3,
      title: "stale element_0050 grade A revived after 99→10→99 resize (documented B4 seam)",
      repro: notes,
      evidence: [evidence],
      status: "confirmed",
    });
    return;
  }

  emit({
    id: "MAT-B5-neutral",
    probeId: "B5",
    tabs: ["elements", "actors"],
    S: 0,
    B: 0,
    title: "regrown element_0050 came back neutral (stale grade scrubbed)",
    repro: notes,
    evidence: [evidence],
    status: "clean",
  });
}

async function resizeElements(page: Page, count: number): Promise<void> {
  await switchTabAnyMode(page, ELEMENTS_TAB);
  await page.getByTestId("db-elements-maximum-number").click();
  const dialog = page.getByTestId("db-elements-max-dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("db-elements-max-count-input").fill(String(count));
  await page.getByTestId("db-elements-max-ok").click();
  await expect(dialog).toBeHidden();
}

// ---------------------------------------------------------------------------
// B6 — element count boundary
// ---------------------------------------------------------------------------
async function probeB6(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ELEMENTS_TAB);
  const outcomes: string[] = [];
  let crashed = false;
  let emptyGrid = false;
  let missingFeedback = false;

  for (const raw of ["0", "100", "-5"] as const) {
    try {
      await switchTabAnyMode(page, ELEMENTS_TAB);
      await page.getByTestId("db-elements-maximum-number").click();
      await expect(page.getByTestId("db-elements-max-dialog")).toBeVisible();
      await page.getByTestId("db-elements-max-count-input").fill(raw);
      await page.getByTestId("db-elements-max-ok").click();
      await expect(page.getByTestId("db-elements-max-dialog")).toBeHidden();
      const expected = raw === "100" ? 99 : 1;
      const toast = page.getByTestId("toast");
      const toastText = (await toast.textContent().catch(() => "")) ?? "";
      const count = await page.locator("[data-testid^='db-elements-row-']").count();
      const form = page.getByTestId("db-elements-classic");
      if (!(await form.isVisible().catch(() => false))) emptyGrid = true;
      if (count === 0) emptyGrid = true;
      if (count !== expected) outcomes.push(`${raw}: list count=${count} expected ${expected}`);
      if (!toastText.includes(String(expected))) {
        missingFeedback = true;
        outcomes.push(`${raw}: toast="${toastText}" missing clamped ${expected}`);
      }
    } catch (error) {
      crashed = true;
      outcomes.push(`${raw}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const evidence = await shot(page, "b6-boundary");
  if (crashed || emptyGrid) {
    emit({
      id: "MAT-B6-crash",
      probeId: "B6",
      tabs: ["elements"],
      S: 4,
      B: 2,
      title: "element count 0/100/-5 crashed or emptied the grid",
      repro: ["db-elements-maximum-number → fill 0, 100, -5", ...outcomes],
      evidence: [evidence],
      status: "confirmed",
    });
    return;
  }
  if (outcomes.length > 0) {
    emit({
      id: "MAT-B6-clamp",
      probeId: "B6",
      tabs: ["elements"],
      S: missingFeedback ? 1 : 3,
      B: missingFeedback ? 1 : 1,
      title: missingFeedback
        ? "element count 0/100/-5 clamps but without visible feedback"
        : "element count 0/100/-5 did not clamp to 1..99",
      repro: ["open db-elements-max-count-input", "enter 0, 100, -5", ...outcomes],
      evidence: [evidence],
      status: "confirmed",
    });
    return;
  }
  emit({
    id: "MAT-B6-ok",
    probeId: "B6",
    tabs: ["elements"],
    S: 0,
    B: 0,
    title: "element count 0/100/-5 clamps to 1..99 with toast feedback and a non-empty grid",
    repro: ["db-elements-max-count-input 0 → 1, 100 → 99, -5 → 1"],
    evidence: [evidence],
    status: "clean",
  });
}

// ---------------------------------------------------------------------------
// B7 — animation batch / interpolate with 0 then 1 frame
// ---------------------------------------------------------------------------
async function probeB7(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ANIMATIONS_TAB);
  await expect(page.getByTestId("db-animation-rm2003-editor")).toBeVisible();

  const before = await projectOf(page);
  const anim = before.database.battleAnimations[0];
  if (!anim) {
    emit({
      id: "MAT-B7-seeding",
      probeId: "B7",
      tabs: ["animations"],
      S: 0,
      B: 0,
      title: "B7 seeding-limited: freshProject has no battleAnimations",
      repro: ["exportedProject.database.battleAnimations is empty"],
      evidence: [await shot(page, "b7-seeding")],
      status: "seeding-limited",
    });
    return;
  }

  // Collapse to a single frame so interpolate has no neighbors.
  const deleteBtn = page.getByTestId("db-animation-frame-delete");
  for (let i = 0; i < 20; i += 1) {
    const numbered = await page.locator("[data-testid^='db-animation-frame-']").evaluateAll((nodes) =>
      nodes.filter((node) => /^db-animation-frame-\d+$/.test((node as HTMLElement).dataset.testid ?? "")).length,
    );
    if (numbered <= 1) break;
    if (await deleteBtn.isDisabled().catch(() => true)) break;
    await deleteBtn.click();
  }

  const single = await projectOf(page);
  const framesBefore = single.database.battleAnimations.find((entry) => entry.id === anim.id)?.frames ?? [];
  const interpolate = page.getByTestId("db-animation-cell-interpolate");
  const batch = page.getByTestId("db-animation-cell-batch");
  const interpDisabled = await interpolate.isDisabled().catch(() => false);
  await interpolate.click({ force: true }).catch(() => undefined);
  const toastAfterInterp = ((await page.getByTestId("toast").textContent().catch(() => "")) ?? "").trim();
  const afterInterp = await projectOf(page);
  const framesAfterInterp = afterInterp.database.battleAnimations.find((entry) => entry.id === anim.id)?.frames ?? [];

  await batch.click();
  const batchDialog = page.getByTestId("db-animation-cell-batch-dialog");
  const batchOpened = await batchDialog.isVisible().catch(() => false);
  if (batchOpened) {
    await page.getByTestId("db-animation-batch-pattern").fill("7");
    await page.getByTestId("db-animation-cell-batch-ok").click();
  }
  const afterBatch = await projectOf(page);
  const framesAfterBatch = afterBatch.database.battleAnimations.find((entry) => entry.id === anim.id)?.frames ?? [];
  const evidence = await shot(page, "b7-anim");

  const interpWrote =
    JSON.stringify(framesAfterInterp) !== JSON.stringify(framesBefore) && framesBefore.length <= 1;
  const batchWroteOther =
    framesAfterBatch.length > 1 &&
    JSON.stringify(framesAfterBatch.slice(1)) !== JSON.stringify((framesBefore.slice(1)));
  const hintOk = interpDisabled || /보간|프레임|필요/.test(toastAfterInterp) || toastAfterInterp.length > 0;

  if (interpWrote || batchWroteOther) {
    emit({
      id: "MAT-B7-wrong-write",
      probeId: "B7",
      tabs: ["animations"],
      S: 3,
      B: 2,
      title: "animation interpolate/batch wrote cells with 0 neighbors or to the wrong frame",
      repro: [
        "animations tab, delete down to 1 frame",
        "click db-animation-cell-interpolate",
        "click db-animation-cell-batch, set pattern 7, OK",
        `interpWrote=${interpWrote} batchWroteOther=${batchWroteOther} toast=${toastAfterInterp}`,
      ],
      evidence: [evidence],
      status: "confirmed",
    });
    return;
  }

  emit({
    id: "MAT-B7-ok",
    probeId: "B7",
    tabs: ["animations"],
    S: 0,
    B: 0,
    title: hintOk
      ? "animation interpolate/batch with a single frame is a disabled control or a hinted no-op"
      : "animation interpolate/batch with a single frame did not write the wrong frame (no hint observed)",
    repro: [
      "collapse to 1 frame",
      `interpolate disabled=${interpDisabled} toast=${toastAfterInterp || "(none)"}`,
      `batchOpened=${batchOpened}`,
    ],
    evidence: [evidence],
    status: hintOk ? "clean" : "unconfirmed-vqa",
  });
}

// ---------------------------------------------------------------------------
// B8 — rapid 20-chip persistence
// ---------------------------------------------------------------------------
async function probeB8(page: Page): Promise<void> {
  await setTypeList(page, B8_TYPES.join(", "));
  await expect(page.getByTestId("db-type-chart-matrix")).toBeVisible();

  const pairs: { a: string; b: string; testId: string }[] = [];
  for (const a of B8_TYPES) {
    for (const b of B8_TYPES) {
      if (a === b) continue;
      pairs.push({ a, b, testId: `db-type-chart-${a}-${b}` });
    }
  }
  const targets = pairs.slice(0, 20);
  const started = Date.now();
  // In-page click dispatch — locator clicks + re-render waits cannot hit the
  // <2s coalescing window the probe is attacking.
  await page.evaluate((ids) => {
    for (const id of ids) {
      const node = document.querySelector(`[data-testid="${id}"]`);
      if (node instanceof HTMLElement) node.click();
    }
  }, targets.map((target) => target.testId));
  const elapsed = Date.now() - started;

  const afterClicks = await projectOf(page);
  const dropped: string[] = [];
  for (const target of targets) {
    const stored = afterClicks.system.typeChart?.multipliers?.[target.a]?.[target.b];
    const attr = await chipValue(page, target.testId);
    if (stored === undefined || Number(attr) === 1 || stored === 1) {
      dropped.push(`${target.testId} stored=${String(stored)} attr=${attr}`);
    }
  }

  // freshProject disables remote persist; Apply still marks the dirty session clean
  // when flush returns. Poll the footer rather than sleeping the grace window.
  await page.getByTestId("database-footer-apply").click();
  await expect(page.getByTestId("db-footer-status")).toContainText(/적용|저장|온라인|브라우저/, { timeout: 8_000 });
  await dismissDirtyIfAny(page, "keep");
  await page.getByTestId("database-modal-close").click();
  if (await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false)) {
    await page.getByTestId("database-dirty-save").click();
  }
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await ensureModal(page);
  await openTypeChart(page);
  const afterReopen = await projectOf(page);
  const lostOnReopen: string[] = [];
  for (const target of targets) {
    const stored = afterReopen.system.typeChart?.multipliers?.[target.a]?.[target.b];
    if (stored === undefined || stored === 1) lostOnReopen.push(`${target.testId}=${String(stored)}`);
  }
  const evidence = await shot(page, "b8-rapid");

  if (dropped.length === 0 && lostOnReopen.length === 0) {
    emit({
      id: "MAT-B8-ok",
      probeId: "B8",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: `all 20 rapid typeChart chip edits survived (${elapsed}ms, save + reopen)`,
      repro: [
        `set types ${B8_TYPES.join(",")}`,
        `dispatch click on 20 off-diagonal chips in ${elapsed}ms`,
        "database-footer-apply, close, reopen, read multipliers",
      ],
      evidence: [evidence],
      status: elapsed <= 2_000 ? "clean" : "unconfirmed-vqa",
    });
    return;
  }

  emit({
    id: "MAT-B8-drop",
    probeId: "B8",
    tabs: ["system"],
    S: 4,
    B: 3,
    title: "rapid typeChart clicks dropped edits (coalescing or reopen loss)",
    repro: [
      `clicked 20 chips in ${elapsed}ms`,
      `dropped immediately: ${dropped.join("; ") || "(none)"}`,
      `lost after save/reopen: ${lostOnReopen.join("; ") || "(none)"}`,
    ],
    evidence: [evidence],
    status: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// B9 — grid dirty guard
// ---------------------------------------------------------------------------
async function probeB9(page: Page): Promise<void> {
  // Snapshot must be taken AFTER the type list exists, otherwise Discard restores
  // a different chart. Apply on freshProject returns saved-local and markClean()
  // still runs, so the next chip click is the only dirty write.
  await ensureModal(page);
  await setTypeList(page, "fire, water, grass");
  await page.getByTestId("database-footer-apply").click();
  await expect(page.getByTestId("db-footer-status")).toContainText(/적용|저장|온라인|브라우저/, { timeout: 8_000 });
  await openTypeChart(page);
  const chip = page.getByTestId("db-type-chart-fire-water");
  await expect(chip).toBeVisible();
  const original = await chipValue(page, "db-type-chart-fire-water");
  await chip.click();
  const edited = await chipValue(page, "db-type-chart-fire-water");
  const close = await dirtyGuardOracle(page, "escape");
  const evidence = await shot(page, "b9-dirty");

  if (!close.promptShown) {
    emit({
      id: "MAT-B9-no-prompt",
      probeId: "B9",
      tabs: ["system"],
      S: 4,
      B: 3,
      title: "typeChart chip edit + Escape skipped the 3-way dirty prompt (grid write outside snapshot)",
      repro: [
        `read db-type-chart-fire-water data-value=${original}`,
        "click the chip once",
        "press Escape",
        "assert database-dirty-prompt is visible",
      ],
      evidence: [evidence],
      status: "confirmed",
    });
    await dismissDirtyIfAny(page, "keep");
    return;
  }

  const threeWay =
    close.buttons.includes("database-dirty-save") &&
    close.buttons.includes("database-dirty-discard") &&
    close.buttons.includes("database-dirty-keep-editing");
  await page.getByTestId("database-dirty-discard").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await ensureModal(page);
  await openTypeChart(page);
  const restored = await chipValue(page, "db-type-chart-fire-water");
  const restoreShot = await shot(page, "b9-discard");

  if (!threeWay) {
    emit({
      id: "MAT-B9-buttons",
      probeId: "B9",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: "typeChart dirty prompt appeared without the full 3-way button set",
      repro: [`buttons=${close.buttons.join(",")}`],
      evidence: [evidence],
      status: "confirmed",
    });
  }

  if (restored === original && edited !== original) {
    emit({
      id: "MAT-B9-ok",
      probeId: "B9",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "typeChart chip edit + Escape shows 3-way prompt; Discard restores data-value",
      repro: [
        `original=${original} edited=${edited} restored=${restored}`,
        "Escape → database-dirty-discard → reopen → data-value matches original",
      ],
      evidence: [restoreShot],
      status: "clean",
    });
    return;
  }

  emit({
    id: "MAT-B9-no-restore",
    probeId: "B9",
    tabs: ["system"],
    S: 4,
    B: 3,
    title: "Discard after a typeChart chip edit did not restore the original data-value",
    repro: [
      `original=${original} edited=${edited} restored=${restored}`,
      "Escape → database-dirty-discard → reopen system typechart",
    ],
    evidence: [restoreShot],
    status: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// B10 — VQA type chart at 1024x768
// ---------------------------------------------------------------------------
async function probeB10(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1024, height: 768 });
  await ensureModal(page);
  await setTypeList(page, B10_TYPES.join(", "));
  await expect(page.getByTestId("db-type-chart-matrix")).toBeVisible();
  const evidence = await shot(page, "b10-typechart-1024x768");

  const metrics = await page.getByTestId("db-type-chart-matrix").evaluate((node) => {
    const wrap = node as HTMLElement;
    const legend = wrap.querySelector(".db-type-chart-preview-legend");
    const corner = wrap.querySelector("thead th");
    const firstChip = wrap.querySelector(".db-type-chip") as HTMLElement | null;
    const chipBox = firstChip?.getBoundingClientRect();
    return {
      legend: legend?.textContent ?? "",
      corner: corner?.textContent ?? "",
      scrollWidth: wrap.scrollWidth,
      clientWidth: wrap.clientWidth,
      chipW: chipBox?.width ?? 0,
      chipH: chipBox?.height ?? 0,
    };
  });

  const unreadable =
    !metrics.legend.includes("공격") ||
    metrics.corner.trim().length === 0 ||
    metrics.chipW < 16 ||
    metrics.chipH < 16 ||
    metrics.scrollWidth > metrics.clientWidth + 8;

  if (unreadable) {
    emit({
      id: "MAT-B10-unreadable",
      probeId: "B10",
      tabs: ["system"],
      S: 2,
      B: 2,
      title: "type chart at 1024x768 makes attacker-vs-defender hard to read",
      repro: [
        "viewport 1024x768",
        "system typechart types = t00..t31",
        `legend=${metrics.legend} corner=${metrics.corner} chip=${metrics.chipW}x${metrics.chipH} scroll=${metrics.scrollWidth}/${metrics.clientWidth}`,
      ],
      evidence: [evidence],
      status: "unconfirmed-vqa",
    });
  } else {
    emit({
      id: "MAT-B10-ok",
      probeId: "B10",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "type chart at 1024x768 keeps attacker/defender headers readable",
      repro: ["viewport 1024x768, screenshot db-type-chart-matrix"],
      evidence: [evidence],
      status: "clean",
    });
  }

  await page.setViewportSize({ width: 1400, height: 900 });
  await setTypeList(page, "fire, water, grass");
}

// ---------------------------------------------------------------------------
// X2 — false-dirty on open
// ---------------------------------------------------------------------------
async function probeX2(page: Page): Promise<void> {
  const paths = ["escape", "backdrop", "x", "cancel"] as const;
  const hits: string[] = [];
  for (const path of paths) {
    await ensureModal(page);
    await dismissDirtyIfAny(page, "discard");
    await ensureModal(page);
    const result = await dirtyGuardOracle(page, path);
    if (result.promptShown) hits.push(path);
    if (result.promptShown) await dismissDirtyIfAny(page, "discard");
    await ensureModal(page);
  }
  const evidence = await shot(page, "x2-false-dirty");
  if (hits.length === 0) {
    emit({
      id: "MAT-X2-ok",
      probeId: "X2",
      tabs: ["system"],
      S: 0,
      B: 0,
      title: "opening the Database and touching nothing does not raise a dirty prompt on any close path",
      repro: ["boot, open Database, close via Escape / backdrop / X / footer 닫기"],
      evidence: [evidence],
      status: "clean",
    });
    return;
  }
  emit({
    id: "MAT-X2-false-dirty",
    probeId: "X2",
    tabs: ["system"],
    S: 2,
    B: 3,
    title: "false-dirty on open: close prompt with zero edits",
    repro: [
      "bootDbLane expert, touch nothing",
      `dirty prompt on: ${hits.join(", ")}`,
    ],
    evidence: [evidence],
    status: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// X3 — listener leak
// ---------------------------------------------------------------------------
async function probeX3(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await ensureModal(page);
    await switchTabAnyMode(page, ITEMS_TAB);
    const name = page.getByTestId("db-field-name");
    await expect(name).toBeVisible();
    await name.fill(`leak-${i}`);
    const close = await dirtyGuardOracle(page, "escape");
    if (close.promptShown) await page.getByTestId("database-dirty-discard").click();
    else await expect(page.getByTestId("database-modal")).toBeHidden();
    await expect(page.getByTestId("database-modal")).toBeHidden();
  }

  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  await page.getByTestId("db-field-name").fill("leak-final");
  await page.keyboard.press("Escape");
  const prompts = await page.getByTestId("database-dirty-prompt").count();
  const evidence = await shot(page, "x3-leak");
  if (prompts > 1) {
    emit({
      id: "MAT-X3-leak",
      probeId: "X3",
      tabs: ["items"],
      S: 3,
      B: 2,
      title: "Escape after five dirty-Discard cycles raised more than one dirty prompt (leaked keydown)",
      repro: [
        "open → edit db-field-name → Escape → Discard → reopen, five times",
        "edit once more, press Escape once",
        `database-dirty-prompt count=${prompts}`,
      ],
      evidence: [evidence],
      status: "confirmed",
    });
  } else {
    emit({
      id: "MAT-X3-ok",
      probeId: "X3",
      tabs: ["items"],
      S: 0,
      B: 0,
      title: "five dirty-Discard cycles leave a single Escape listener",
      repro: [`prompt count after one Escape=${prompts}`],
      evidence: [evidence],
      status: "clean",
    });
  }
  await dismissDirtyIfAny(page, "discard");
}

// ---------------------------------------------------------------------------
// X6 — filter-chip persistence
// ---------------------------------------------------------------------------
async function probeX6(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const chip = page.getByTestId("db-filter-chip-medicine");
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveClass(/active/);

  await page.getByTestId("database-modal-close").click();
  await dismissDirtyIfAny(page, "discard");
  await expect(page.getByTestId("database-modal")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click();
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  const restored = page.getByTestId("db-filter-chip-medicine");
  const visible = await restored.isVisible().catch(() => false);
  const active = visible && (await restored.getAttribute("class"))?.includes("active") === true;
  const pressed = visible && (await restored.getAttribute("aria-pressed")) === "true";
  const evidence = await shot(page, "x6-filter");

  if (visible && (active || pressed)) {
    emit({
      id: "MAT-X6-ok",
      probeId: "X6",
      tabs: ["items"],
      S: 0,
      B: 0,
      title: "items medicine filter chip stays visibly active across close/reload/reopen",
      repro: [
        "items → db-filter-chip-medicine",
        "close, page.reload, reopen items",
        "chip has .active / aria-pressed=true",
      ],
      evidence: [evidence],
      status: "clean",
    });
    return;
  }

  emit({
    id: "MAT-X6-invisible",
    probeId: "X6",
    tabs: ["items"],
    S: 3,
    B: 3,
    title: "persisted items filter is not visibly active after reload (records look deleted)",
    repro: [
      "select db-filter-chip-medicine",
      "close modal, reload, reopen items",
      `visible=${visible} active=${active} aria-pressed=${pressed}`,
    ],
    evidence: [evidence],
    status: "confirmed",
  });
}

// ---------------------------------------------------------------------------
// X13 — virtualizer offscreen selection
// ---------------------------------------------------------------------------
async function probeX13(page: Page): Promise<void> {
  await ensureModal(page);
  await switchTabAnyMode(page, ITEMS_TAB);
  // X6 leaves a persisted medicine chip; AND-combined with search it hides every
  // non-medicine row and looks like the offscreen record was deleted.
  const allChip = page.getByTestId("db-filter-chip-all");
  if (await allChip.isVisible().catch(() => false)) await allChip.click();
  const search = page.locator(".db-body .db-search input").first();
  await expect(search).toBeVisible();
  await search.fill(OFFSCREEN_ITEM.name);
  const row = page.getByTestId(`db-record-row-${OFFSCREEN_ITEM.id}`);
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.click();
  await search.fill("");
  // Search debounce is 80ms; poll the DOM instead of sleeping that window.
  await expect
    .poll(async () => page.locator(".db-body .db-search input").first().inputValue(), { timeout: 2_000 })
    .toBe("");

  const selectedInDom = await page.getByTestId(`db-record-row-${OFFSCREEN_ITEM.id}`).count();
  const active = page.locator(".db-list-row.active");
  const activeId = (await active.getAttribute("data-record-id").catch(() => null)) ?? "";
  const evidence = await shot(page, "x13-virtualizer");

  if (selectedInDom > 0) {
    emit({
      id: "MAT-X13-ok",
      probeId: "X13",
      tabs: ["items"],
      S: 0,
      B: 0,
      title: `virtualizer (items>${VIRTUALIZER_THRESHOLD}) keeps the selected offscreen row in the DOM after clearing search`,
      repro: [
        `items search "${OFFSCREEN_ITEM.name}"`,
        `click db-record-row-${OFFSCREEN_ITEM.id}`,
        "clear search",
        "assert the selected row is in the DOM",
      ],
      evidence: [evidence],
      status: "clean",
    });
    return;
  }

  emit({
    id: "MAT-X13-missing",
    probeId: "X13",
    tabs: ["items"],
    S: 3,
    B: 2,
    title: "virtualizer dropped the selected offscreen row from the DOM after clearing search",
    repro: [
      `search ${OFFSCREEN_ITEM.name}, select ${OFFSCREEN_ITEM.id}, clear search`,
      `selectedInDom=${selectedInDom} activeId=${activeId}`,
    ],
    evidence: [evidence],
    status: "confirmed",
  });
}
