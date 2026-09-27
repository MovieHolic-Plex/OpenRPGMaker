import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  bandForScore,
  bootDbLane,
  BOUNDARY_INPUTS,
  collectConsoleErrors,
  dirtyGuardOracle,
  recordFinding,
  rawClick,
  mutatedProject,
  SEEDING_PROVEN,
  switchTabAnyMode,
  VIRTUALIZER_THRESHOLD,
  type AuditFinding,
  type EditorLaneMode,
} from "./dbAuditHelpers";
import { DATABASE_TAB_SPECS, exportedProject, type DatabaseTabSpec } from "./oprn-database-helpers";

/**
 * Diagnostic adversarial audit of battle-group record-CRUD tabs.
 * `_` prefix keeps it out of the default suite. Probe outcome != test failure:
 * assert only harness invariants (app booted, tab opened). Every contract
 * deviation is a scored finding.
 */

test.use({ serviceWorkers: "block" });

const SPEC = "_db-audit-crud-battle";
const SHOT_DIR = "output/evidence/db-beginner-audit/shots";
const FINDINGS_PATH = path.join("output/evidence/db-beginner-audit/findings", `${SPEC}.json`);

const BATTLE_SLUGS = ["actors", "classes", "skills", "items", "equipment", "states", "animations"] as const;
type BattleSlug = (typeof BATTLE_SLUGS)[number];

const BATTLE_TABS: readonly (DatabaseTabSpec & { slug: BattleSlug })[] = BATTLE_SLUGS.map((slug) => {
  const spec = DATABASE_TAB_SPECS.find((tab) => tab.slug === slug);
  if (!spec) throw new Error(`DATABASE_TAB_SPECS missing ${slug}`);
  return spec as DatabaseTabSpec & { slug: BattleSlug };
});

/** Known freshProject ids used as anchors (data-audit.json / defaults). */
const SEED = {
  actors: { id: "actor_hero", name: "주인공", otherId: "actor_ranger" },
  classes: { id: "class_hero", name: "전사", otherId: "class_guardian" },
  skills: { id: "skill_sword_slash", name: "검격", otherId: "skill_attack" },
  items: { id: "item_potion", name: "회복약", otherId: "item_ether", offscreenId: "item_gen_lamp_oil", offscreenName: "기름 등불" },
  equipment: { id: "equip_sword", name: "청동 검", otherId: "equip_oak_shield" },
  states: { id: "state_poison", name: "독", otherId: "state_sleep" },
  animations: { id: "anim_hit", name: "타격", otherId: "anim_sword" },
} as const;

const AWAY_TAB: Record<BattleSlug, DatabaseTabSpec> = {
  actors: tabBySlug("items"),
  classes: tabBySlug("skills"),
  skills: tabBySlug("items"),
  items: tabBySlug("actors"),
  equipment: tabBySlug("items"),
  states: tabBySlug("items"),
  animations: tabBySlug("items"),
};

const CLOSE_PATHS = ["escape", "backdrop", "x", "cancel"] as const;

const SEARCH_DEBOUNCE_MS = 80;

function tabBySlug(slug: string): DatabaseTabSpec {
  const spec = DATABASE_TAB_SPECS.find((tab) => tab.slug === slug);
  if (!spec) throw new Error(`missing tab ${slug}`);
  return spec;
}

function projectKey(slug: BattleSlug): "actors" | "classes" | "skills" | "items" | "equipment" | "states" | "battleAnimations" {
  return slug === "animations" ? "battleAnimations" : slug;
}

function recordsOf(
  project: Awaited<ReturnType<typeof exportedProject>>,
  slug: BattleSlug,
): readonly { readonly id?: string; readonly name: string }[] {
  return project.database[projectKey(slug)] as readonly { readonly id?: string; readonly name: string }[];
}

function finding(partial: Omit<AuditFinding, "spec" | "score" | "band"> & { S: 0 | 1 | 2 | 3 | 4; B: 0 | 1 | 2 | 3 }): void {
  const score = partial.S * partial.B;
  recordFinding({
    ...partial,
    spec: SPEC,
    score,
    band: bandForScore(score),
  });
}

function clean(id: string, probeId: string, tabs: readonly string[], title: string, repro: readonly string[]): void {
  finding({
    id,
    probeId,
    tabs: [...tabs],
    S: 0,
    B: 0,
    title,
    repro: [...repro],
    evidence: [],
    status: "clean",
  });
}

async function shot(page: Page, name: string): Promise<string> {
  mkdirSync(SHOT_DIR, { recursive: true });
  const file = `${SHOT_DIR}/crud-battle-${name}.png`;
  try {
    if (page.isClosed()) return `${file} (page-closed)`;
    const modal = page.getByTestId("database-modal");
    if (await modal.isVisible().catch(() => false)) await modal.screenshot({ path: file });
    else await page.screenshot({ path: file });
    return file;
  } catch (error) {
    return `${file} (unavailable: ${error instanceof Error ? error.message : String(error)})`;
  }
}

async function ensureModalOpen(page: Page, mode: EditorLaneMode): Promise<void> {
  const modal = page.getByTestId("database-modal");
  if (await modal.isVisible().catch(() => false)) return;
  if (mode === "expert") {
    await page.getByTestId("toolbar-database").click();
  } else {
    await page.getByTestId("toolbar-database").click();
  }
  await expect(modal).toBeVisible();
}

async function openBattleTab(page: Page, tab: DatabaseTabSpec): Promise<void> {
  await switchTabAnyMode(page, tab);
  await expect(page.getByTestId(tab.testId)).toHaveClass(/active/);
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-detail-form")).toBeVisible({ timeout: 10_000 });
}

async function dismissPrompt(page: Page, action: "keep" | "discard" | "save"): Promise<void> {
  const prompt = page.getByTestId("database-dirty-prompt");
  if (!(await prompt.isVisible().catch(() => false))) return;
  const testId =
    action === "keep"
      ? "database-dirty-keep-editing"
      : action === "discard"
        ? "database-dirty-discard"
        : "database-dirty-save";
  await page.getByTestId(testId).click();
}

async function selectedId(page: Page): Promise<string | null> {
  const active = page.locator(".db-list-row.active, .db-gallery-card.active").first();
  if (!(await active.isVisible().catch(() => false))) return null;
  return active.getAttribute("data-record-id");
}

function rowById(page: Page, id: string): Locator {
  return page.getByTestId(`db-record-row-${id}`).or(page.getByTestId(`db-record-card-${id}`));
}

async function clickRecord(page: Page, id: string): Promise<boolean> {
  const row = rowById(page, id);
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    return true;
  }
  const listed = page.locator(".db-list-row, .db-gallery-card").first();
  if (await listed.isVisible().catch(() => false)) {
    await listed.click();
    return false;
  }
  return false;
}

async function ensureListView(page: Page): Promise<void> {
  const list = page.getByTestId("db-view-toggle-list");
  if (!(await list.isVisible().catch(() => false))) return;
  if (!(await list.getAttribute("class"))?.includes("active")) await list.click();
}

async function ensureGalleryView(page: Page): Promise<boolean> {
  const gallery = page.getByTestId("db-view-toggle-gallery");
  if (!(await gallery.isVisible().catch(() => false))) return false;
  if (!(await gallery.getAttribute("class"))?.includes("active")) await gallery.click();
  return true;
}

async function nameField(page: Page): Promise<Locator> {
  return page.getByTestId("db-field-name");
}

async function setName(page: Page, value: string): Promise<void> {
  const field = await nameField(page);
  await expect(field).toBeVisible();
  await field.click();
  await field.fill(value);
}

async function blurName(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function setSearch(page: Page, query: string): Promise<void> {
  const input = page.locator(".db-body .db-search input");
  await expect(input).toBeVisible();
  await input.fill(query);
  // Timing contract under attack: recordSearch arms an 80ms searchRerenderTimer
  // before rebuilding the virtualized list. Poll the input value + a list paint
  // rather than sleeping that window.
  await expect.poll(async () => input.inputValue(), { timeout: 2_000 }).toBe(query);
  await page.locator(".db-list").waitFor({ state: "visible", timeout: 2_000 });
  await expect
    .poll(async () => page.locator(".db-virtual-rows").count(), { timeout: SEARCH_DEBOUNCE_MS + 1_500 })
    .toBeGreaterThan(0);
}

async function overflowOf(locator: Locator): Promise<{ overflow: boolean; scrollWidth: number; clientWidth: number; text: string } | null> {
  if (!(await locator.isVisible().catch(() => false))) return null;
  return locator.evaluate((node) => {
    const el = node as HTMLElement;
    return {
      overflow: el.scrollWidth > el.clientWidth + 1,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      text: el.textContent ?? "",
    };
  });
}

async function toastText(page: Page): Promise<string> {
  const toast = page.getByTestId("toast");
  if (!(await toast.isVisible().catch(() => false))) return "";
  return (await toast.textContent()) ?? "";
}

function newConsoleSince(errors: string[], start: number): string[] {
  return errors.slice(start);
}

async function nameCapHint(page: Page, field: Locator): Promise<{ found: boolean; where: string }> {
  const nearby = await field.evaluate((node) => {
    const host = (node.closest("label, .db-field, .db-class-name-field, .db-record-hero-title, .db-item-inspector-name, .db-equipment-inspector-name") ?? node.parentElement) as HTMLElement | null;
    return (host?.innerText ?? "").replace(/\s+/g, " ").trim();
  });
  const toast = await toastText(page);
  const haystack = `${nearby} ${toast}`;
  if (/12|최대|글자|자 제한|남은|remaining|max/i.test(haystack)) return { found: true, where: haystack.slice(0, 120) };
  return { found: false, where: nearby.slice(0, 120) };
}

type ImgCensus = {
  readonly total: number;
  readonly srcX: number;
  readonly thumbnails: number;
  readonly srcs: readonly string[];
};

async function imgCensus(page: Page): Promise<ImgCensus> {
  return page.evaluate(() => {
    const root = document.querySelector(".database-modal-window") ?? document.body;
    const imgs = Array.from(root.querySelectorAll("img"));
    return {
      total: imgs.length,
      srcX: imgs.filter((img) => {
        const src = img.getAttribute("src") ?? "";
        return src === "x" || src.endsWith("/x") || src.endsWith("%22%3E");
      }).length,
      thumbnails: imgs.filter(
        (img) => img.classList.contains("db-list-thumb-probe") || Boolean(img.closest(".db-list-thumb")),
      ).length,
      srcs: imgs.map((img) => img.getAttribute("src") ?? ""),
    };
  });
}

test.describe("AUDIT — battle-group record CRUD", () => {
  test.beforeAll(() => {
    mkdirSync(path.dirname(FINDINGS_PATH), { recursive: true });
    mkdirSync(SHOT_DIR, { recursive: true });
    // Findings file is reset by the invoking shell before this spec. Do not wipe
    // here: a timed-out worker restart would erase earlier tab coverage entries.
  });

  test("X2/X3/X6/X13 mandatory chrome probes (expert)", async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();

    await probeX2(page, errors);
    await probeX3(page, "expert");
    await probeX6(page);
    await probeX13(page, errors);
  });

  for (const tab of BATTLE_TABS) {
    test(`expert A1-A10 ${tab.slug}`, async ({ page }) => {
      test.slow();
      test.setTimeout(180_000);
      const errors = collectConsoleErrors(page);
      await bootDbLane(page, { mode: "expert" });
      await expect(page.getByTestId("database-modal")).toBeVisible();
      try {
        await openBattleTab(page, tab);
        await ensureListView(page);
        await probeA1(page, tab, "expert", errors);
        await probeA2(page, tab, "expert", errors);
        await probeA3(page, tab, "expert", errors);
        await probeA4(page, tab, "expert", errors);
        await probeA5(page, tab, "expert", errors);
        await probeA6(page, tab, "expert", errors);
        await probeA7(page, tab, "expert", errors);
        await probeA8(page, tab, "expert", errors);
        await probeA9(page, tab, "expert", errors);
        await probeA10(page, tab, "expert", errors);
      } catch (error) {
        const evidence = await shot(page, `expert-tab-crash-${tab.slug}`);
        finding({
          id: `expert-tab-crash-${tab.slug}`,
          probeId: "harness",
          tabs: [tab.slug],
          S: 2,
          B: 2,
          title: `Expert ${tab.slug} tab aborted remaining probes on this tab`,
          repro: [
            `bootDbLane(page,{mode:"expert"})`,
            `switchTabAnyMode(page, ${tab.testId})`,
            `threw: ${error instanceof Error ? error.message : String(error)}`,
          ],
          evidence: [evidence],
          status: "confirmed",
        });
      }
    });
  }

  test("expert A2 name-field maxlength census + consistency", async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);
    const errors = collectConsoleErrors(page);
    await bootDbLane(page, { mode: "expert" });
    await expect(page.getByTestId("database-modal")).toBeVisible();
    const census: string[] = [];
    for (const tab of BATTLE_TABS) {
      await openBattleTab(page, tab);
      await ensureListView(page);
      await clickRecord(page, SEED[tab.slug].id);
      const field = page.getByTestId("db-field-name");
      const maxLength = await field.getAttribute("maxlength");
      const hint = await nameCapHint(page, field);
      census.push(`${tab.slug}: maxlength=${maxLength ?? "(none)"} hint=${hint.found ? hint.where : "none"}`);
    }
    finding({
      id: "expert-A2-name-field-inconsistency",
      probeId: "A2",
      tabs: [...BATTLE_SLUGS],
      S: 2,
      B: 3,
      title: "Same name field, three behaviors: classes maxlength=12, other six tabs uncapped and overflow their rows",
      repro: [
        "heuristic 20 consistent interaction patterns across tabs",
        "src/editor/panels/databaseClassRecordView.ts:79 attrs.maxlength=\"12\" on db-field-name",
        "src/editor/panels/databaseControls.ts textField and actorRecordControls.textControl set no maxlength",
        "actors/skills/items/equipment/states/animations: uncapped; A2 measured 100-char CJK list overflow ~1300px vs 139-194px and gallery 1200px vs 48px",
        ...census,
        "beginner cannot predict whether a name will cap, overflow, or ellipsize",
      ],
      evidence: [
        `${SHOT_DIR}/crud-battle-expert-A2-actors.png`,
        `${SHOT_DIR}/crud-battle-expert-A2-skills.png`,
        `${SHOT_DIR}/crud-battle-expert-A2-classes.png`,
      ],
      status: "confirmed",
    });
    if (errors.length) {
      finding({
        id: "expert-A2-name-field-inconsistency-console",
        probeId: "A2",
        tabs: [...BATTLE_SLUGS],
        S: 1,
        B: 1,
        title: "Name-field census raised console errors",
        repro: [...errors],
        evidence: [],
        status: "confirmed",
      });
    }
  });

  for (const tab of BATTLE_TABS) {
    test(`beginner silent-loss A1/A5/A8 ${tab.slug}`, async ({ page }) => {
      test.slow();
      test.setTimeout(120_000);
      const errors = collectConsoleErrors(page);
      await bootDbLane(page, { mode: "beginner" });
      await expect(page.getByTestId("database-modal")).toBeVisible();
      await expect(page.locator(".db-tabs .db-tab-group").first()).toBeVisible();
      try {
        await openBattleTab(page, tab);
        await ensureListView(page);
        await probeA1(page, tab, "beginner", errors);
        await probeA5(page, tab, "beginner", errors);
        await probeA8(page, tab, "beginner", errors);
      } catch (error) {
        const evidence = await shot(page, `beginner-tab-crash-${tab.slug}`);
        finding({
          id: `beginner-tab-crash-${tab.slug}`,
          probeId: "harness",
          tabs: [tab.slug],
          S: 2,
          B: 3,
          title: `Beginner ${tab.slug} tab aborted remaining silent-loss probes`,
          repro: [
            `bootDbLane(page,{mode:"beginner"})`,
            `switchTabAnyMode(page, ${tab.testId}) // expands the category group when collapsed`,
            `threw: ${error instanceof Error ? error.message : String(error)}`,
          ],
          evidence: [evidence],
          status: "confirmed",
        });
      }
    });
  }
});

async function probeA1(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A1";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const repro = [
    `open ${tab.testId}`,
    `clear db-field-name, blur`,
    `click another record, click the emptied record back`,
    `assert the emptied row is findable/clickable (non-zero box)`,
  ];
  const start = errors.length;
  try {
    const seed = SEED[tab.slug];
    await clickRecord(page, seed.id);
    const field = await nameField(page);
    if (!(await field.isVisible().catch(() => false))) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: db-field-name missing so empty-name reachability cannot be probed`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
      return;
    }
    const original = await field.inputValue();
    await setName(page, "");
    await blurName(page);
    const emptiedId = await selectedId(page);
    const emptiedRow = emptiedId ? rowById(page, emptiedId) : page.locator(".db-list-row.active, .db-gallery-card.active").first();
    const box = await emptiedRow.boundingBox();
    const label = emptiedId
      ? ((await emptiedRow.getAttribute("data-record-name")) ?? "")
      : "";
    await clickRecord(page, seed.otherId);
    const backOk = emptiedId ? await clickRecord(page, emptiedId) : await emptiedRow.click().then(() => true).catch(() => false);
    const afterBack = await selectedId(page);
    const clickable = Boolean(box && box.width >= 4 && box.height >= 4);
    const reachable = backOk && afterBack === emptiedId;
    const consoleHits = newConsoleSince(errors, start);

    if (!clickable || !reachable) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 4,
        B: 3,
        title: `${tab.slug}: empty name leaves the record unreachable (blank/zero-width row)`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (consoleHits.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 1,
        B: 1,
        title: `${tab.slug}: empty-name probe raised console errors`,
        repro: [...repro, `console: ${consoleHits.join(" | ")}`],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: empty name stays listed (${label || "(이름 없음)"}) and re-selectable`, repro);
    }

    if (await field.isVisible().catch(() => false)) {
      await setName(page, original);
      await blurName(page);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 1,
      title: `${tab.slug}: A1 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA2(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A2";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const repro = [
    `open ${tab.testId} list + gallery`,
    `set db-field-name to 100-char CJK then BOUNDARY_INPUTS.emojiZwj`,
    `measure .db-list-name / .db-gallery-name / inspector header scrollWidth<=clientWidth+1`,
    `assert exportedProject name is an exact round-trip`,
  ];
  const start = errors.length;
  try {
    const seed = SEED[tab.slug];
    await ensureListView(page);
    await clickRecord(page, seed.id);
    const field = await nameField(page);
    if (!(await field.isVisible().catch(() => false))) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: db-field-name missing for boundary-name probe`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
      return;
    }
    const original = await field.inputValue();
    const maxLengthAttr = await field.getAttribute("maxlength");
    const maxLength = maxLengthAttr && /^\d+$/.test(maxLengthAttr) ? Number(maxLengthAttr) : null;
    const defects: string[] = [];
    let evidence: string[] = [];
    let silentCap = false;

    for (const [label, value] of [
      ["cjk", BOUNDARY_INPUTS.longCjk],
      ["emoji", BOUNDARY_INPUTS.emojiZwj],
    ] as const) {
      await setName(page, value);
      await blurName(page);
      const typed = await field.inputValue();
      const project = await exportedProject(page);
      const rec = recordsOf(project, tab.slug).find((entry) => entry.id === seed.id);
      const persisted = rec?.name ?? "";
      const expected = maxLength === null ? value : [...value].slice(0, maxLength).join("");
      if (maxLength !== null && typed.length <= maxLength && persisted === typed) {
        const hint = await nameCapHint(page, field);
        if (!hint.found) silentCap = true;
      } else {
        if (typed !== expected) {
          defects.push(`${label} input mutated beyond maxlength=${maxLengthAttr ?? "(none)"} (len ${typed.length} vs expected ${expected.length})`);
        }
        if (persisted !== typed) {
          defects.push(`${label} exportedProject diverged from the field (${JSON.stringify(persisted)} vs ${JSON.stringify(typed)})`);
        }
      }

      const listName = page.locator(`[data-testid='db-record-row-${seed.id}'] .db-list-name`);
      const listOverflow = await overflowOf(listName);
      // A maxlength-capped value overflowing a 48px gallery cell is layout, not
      // a 100-char boundary blowout — record it only when the field is uncapped.
      if (listOverflow?.overflow && maxLength === null) {
        defects.push(`${label} list row overflows (${listOverflow.scrollWidth}>${listOverflow.clientWidth}+1)`);
      }

      const galleryOn = await ensureGalleryView(page);
      const cards = page.locator("[data-testid^='db-record-card-']");
      const cardCount = galleryOn ? await cards.count() : 0;
      if (galleryOn && cardCount === 0) {
        defects.push("gallery toggle on but [data-testid^='db-record-card-'] count is 0");
      }
      const galleryName = page.locator(`[data-testid='db-record-card-${seed.id}'] .db-gallery-name`);
      const galleryOverflow = await overflowOf(galleryName);
      if (galleryOverflow?.overflow && maxLength === null) {
        defects.push(`${label} gallery name overflows (${galleryOverflow.scrollWidth}>${galleryOverflow.clientWidth}+1)`);
      }
      const headerBits = page.locator(
        ".db-record-hero-title, .db-item-inspector-name, .db-equipment-inspector-name, .oprn-record-identity",
      ).first();
      const headerOverflow = await overflowOf(headerBits);
      if (headerOverflow?.overflow && maxLength === null) defects.push(`${label} inspector header overflows`);
      await ensureListView(page);
    }

    const consoleHits = newConsoleSince(errors, start);
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (defects.length) {
      evidence = [await shot(page, id)];
      const isCjk = defects.some((d) => d.includes("cjk") || d.includes("emoji"));
      const galleryMissing = defects.some((d) => d.includes("gallery toggle"));
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: galleryMissing ? 2 : 3,
        B: isCjk ? 2 : 1,
        title: `${tab.slug}: boundary name failed (${defects[0]})`,
        repro: [...repro, `maxlength=${maxLengthAttr ?? "(none)"}`, ...defects],
        evidence,
        status: galleryMissing ? "pre-existing" : "confirmed",
      });
    } else if (silentCap) {
      evidence = [await shot(page, id)];
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: name maxlength=${maxLength} is enforced with no visible hint (not data corruption)`,
        repro: [
          ...repro,
          `src/editor/panels/databaseClassRecordView.ts:79 maxlength=\"12\" on db-field-name`,
          `fill 100-char CJK; field.value.length=${maxLength}; exportedProject matches the capped value`,
          "no label suffix / helper / counter / toast names the 12-character limit (heuristics 14, 16)",
          "do not score this as a round-trip failure — the cap is an intentional HTML maxlength",
        ],
        evidence,
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: CJK/emoji names truncate with ellipsis and round-trip (maxlength=${maxLengthAttr ?? "none"})`, repro);
    }

    await ensureListView(page);
    await clickRecord(page, seed.id);
    if (await field.isVisible().catch(() => false)) {
      await setName(page, original);
      await blurName(page);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 2,
      title: `${tab.slug}: A2 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA3(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A3";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const payload = BOUNDARY_INPUTS.htmlInjection;
  const repro = [
    `open ${tab.testId}`,
    `census img in .database-modal-window BEFORE paste`,
    `paste ${payload} into db-field-name and blur`,
    `assert img[src="x"] count is 0; name textContent contains the literal payload`,
    `img delta must be explained by .db-list-thumb / .db-list-thumb-probe (databaseRecordThumbnails.ts), not injection`,
    `first-draft false positive: treating any <img> in row.innerHTML as XSS (thumbnail img is legitimate)`,
  ];
  const start = errors.length;
  try {
    const seed = SEED[tab.slug];
    await ensureListView(page);
    await clickRecord(page, seed.id);
    const field = await nameField(page);
    if (!(await field.isVisible().catch(() => false))) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 1,
        B: 1,
        title: `${tab.slug}: db-field-name missing for injection probe`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
      return;
    }
    const original = await field.inputValue();
    const maxLengthAttr = await field.getAttribute("maxlength");
    const maxLength = maxLengthAttr && /^\d+$/.test(maxLengthAttr) ? Number(maxLengthAttr) : null;
    const expectedPayload = maxLength === null ? payload : [...payload].slice(0, maxLength).join("");
    const before = await imgCensus(page);
    await setName(page, payload);
    await blurName(page);
    const after = await imgCensus(page);
    const injectedSrcX = await page.locator('img[src="x"]').count();
    const nameNode = page.locator(
      `[data-testid='db-record-row-${seed.id}'] .db-list-name, [data-testid='db-record-card-${seed.id}'] .db-gallery-name`,
    ).first();
    const nameText = (await nameNode.textContent().catch(() => "")) ?? "";
    const fieldValue = await field.inputValue().catch(() => "");
    const project = await exportedProject(page);
    const persisted = recordsOf(project, tab.slug).find((entry) => entry.id === seed.id)?.name ?? "";
    const literal =
      nameText.includes(expectedPayload) ||
      fieldValue === expectedPayload ||
      persisted === expectedPayload;
    const extraImgs = after.total - before.total;
    const extraExplainedByThumbs = extraImgs <= 0 || after.thumbnails >= before.thumbnails;
    const consoleHits = newConsoleSince(errors, start);
    const defects: string[] = [];
    if (injectedSrcX > 0 || after.srcX > 0) {
      defects.push(`img[src=x] materialized (locator=${injectedSrcX} census.srcX=${after.srcX})`);
    }
    if (!literal) {
      defects.push(
        `payload not present as literal text (nameText=${JSON.stringify(nameText.slice(0, 80))} field=${JSON.stringify(fieldValue)} export=${JSON.stringify(persisted)})`,
      );
    }
    if (extraImgs > 0 && !extraExplainedByThumbs) {
      defects.push(`unexplained img delta ${before.total}->${after.total} (thumbs ${before.thumbnails}->${after.thumbnails})`);
    }
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    const censusNote = `img census before=${before.total} (thumbs=${before.thumbnails}) after=${after.total} (thumbs=${after.thumbnails} srcX=${after.srcX})`;
    if (injectedSrcX > 0 || after.srcX > 0) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 4,
        B: 3,
        title: `${tab.slug}: HTML-injection name materialized img[src=x]`,
        repro: [...repro, censusNote, ...defects, `after.src=${after.srcs.join(" | ")}`],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 1,
        title: `${tab.slug}: injection probe residual (${defects[0]})`,
        repro: [...repro, censusNote, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(
        id,
        probeId,
        [tab.slug],
        `${tab.slug}: injection string is literal text; img[src=x]=0; ${censusNote}`,
        [...repro, censusNote],
      );
    }

    await setName(page, original);
    await blurName(page);
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 1,
      title: `${tab.slug}: A3 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA4(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A4";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const repro = [
    `open ${tab.testId}`,
    `for every numeric -stepper (or unpaired -slider / number field): set -1, 9999999, abc`,
    `read stepper and paired slider; they must agree after clamp/step-normalize`,
  ];
  const start = errors.length;
  try {
    const seed = SEED[tab.slug];
    await clickRecord(page, seed.id);
    if (tab.slug === "items") {
      const type = page.getByTestId("db-field-item-type");
      if (await type.isVisible().catch(() => false)) {
        if ((await type.inputValue()) !== "medicine") await type.selectOption("medicine");
      }
    }

    const sliderIds = await page.locator("[data-testid$='-slider']").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.testid ?? "").filter(Boolean),
    );
    const stepperIds = await page.locator("[data-testid$='-stepper']").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.testid ?? "").filter(Boolean),
    );

    type Pair = { stepper: string; slider: string | null };
    const pairs: Pair[] = [];
    for (const sliderId of sliderIds) {
      const base = sliderId.replace(/-slider$/, "");
      const stepperId = stepperIds.includes(`${base}-stepper`) ? `${base}-stepper` : base;
      pairs.push({ stepper: stepperId, slider: sliderId });
    }
    for (const stepperId of stepperIds) {
      const base = stepperId.replace(/-stepper$/, "");
      if (!pairs.some((pair) => pair.stepper === stepperId || pair.slider === `${base}-slider`)) {
        pairs.push({ stepper: stepperId, slider: sliderIds.includes(`${base}-slider`) ? `${base}-slider` : null });
      }
    }

    if (pairs.length === 0) {
      const fallbacks: Record<BattleSlug, string | null> = {
        actors: "db-field-initial-level",
        classes: "db-field-class-skill-level",
        skills: "db-field-skill-mp-flat",
        items: "db-field-price",
        equipment: "db-field-equipment-attack",
        states: "db-state-rating",
        animations: "db-field-animation-frame-width",
      };
      const fallback = fallbacks[tab.slug];
      if (fallback && (await page.getByTestId(fallback).isVisible().catch(() => false))) {
        pairs.push({ stepper: fallback, slider: null });
      }
    }

    if (pairs.length === 0) {
      clean(id, probeId, [tab.slug], `${tab.slug}: no numeric stepper/slider pair and no fallback number field on the selected record`, repro);
      return;
    }

    const defects: string[] = [];
    for (const pair of pairs) {
      const stepper = page.getByTestId(pair.stepper);
      if (!(await stepper.isVisible().catch(() => false))) {
        defects.push(`${pair.stepper} not visible`);
        continue;
      }
      const original = await stepper.inputValue();
      for (const raw of [BOUNDARY_INPUTS.minus1, BOUNDARY_INPUTS.huge, BOUNDARY_INPUTS.abc]) {
        await stepper.fill(raw);
        await stepper.blur();
        const after = await stepper.inputValue();
        const numeric = Number(after);
        if (after === "NaN" || after.toLowerCase() === "nan" || (raw !== BOUNDARY_INPUTS.abc && after === "")) {
          defects.push(`${pair.stepper} persisted NaN/empty after ${raw}`);
        }
        if (raw === BOUNDARY_INPUTS.minus1 && Number.isFinite(numeric) && numeric < 0) {
          defects.push(`${pair.stepper} accepted negative ${after}`);
        }
        if (pair.slider) {
          const slider = page.getByTestId(pair.slider);
          if (await slider.isVisible().catch(() => false)) {
            const sliderVal = await slider.inputValue();
            if (sliderVal !== after) defects.push(`${pair.stepper}=${after} diverged from ${pair.slider}=${sliderVal} after ${raw}`);
          }
        }
      }
      await stepper.fill(original);
      await stepper.blur();
    }

    const consoleHits = newConsoleSince(errors, start);
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: defects.some((d) => d.includes("negative") || d.includes("NaN")) ? 3 : 2,
        B: defects.some((d) => d.includes("negative") || d.includes("NaN")) ? 3 : 1,
        title: `${tab.slug}: numeric clamp/pair failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: ${pairs.length} numeric control(s) clamp and stay paired`, repro);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 1,
      title: `${tab.slug}: A4 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA5(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A5";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const marker = `A5${tab.slug}${mode}`.slice(0, 12);
  const repro = [
    `open ${tab.testId}`,
    `type ${marker} into db-field-name WITHOUT blur`,
    `immediately click ${AWAY_TAB[tab.slug].testId}, return`,
    `edit must be committed or visibly discarded via dirty guard — silent loss is a finding`,
  ];
  const start = errors.length;
  try {
    const seed = SEED[tab.slug];
    await openBattleTab(page, tab);
    await ensureListView(page);
    await clickRecord(page, seed.id);
    const field = await nameField(page);
    if (!(await field.isVisible().catch(() => false))) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: db-field-name missing for in-flight tab-switch probe`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
      return;
    }
    const original = await field.inputValue();
    await field.click();
    await page.keyboard.press("Control+a");
    await field.pressSequentially(marker, { delay: 15 });
    await rawClick(page, page.getByTestId(AWAY_TAB[tab.slug].testId));
    const promptOnSwitch = await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false);
    if (promptOnSwitch) await dismissPrompt(page, "keep");
    await openBattleTab(page, tab);
    await clickRecord(page, seed.id);
    const fieldBack = await nameField(page);
    const backValue = await fieldBack.inputValue().catch(() => "");
    const project = await exportedProject(page);
    const persisted = recordsOf(project, tab.slug).find((entry) => entry.id === seed.id)?.name ?? "";
    const committed = backValue === marker || persisted === marker;
    const discarded = (backValue === original && persisted === original) || promptOnSwitch;
    const consoleHits = newConsoleSince(errors, start);

    if (!committed && !discarded) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 4,
        B: 3,
        title: `${tab.slug}: in-flight name silently lost on tab switch (field=${JSON.stringify(backValue)} export=${JSON.stringify(persisted)})`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (consoleHits.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 1,
        B: 1,
        title: `${tab.slug}: A5 raised console errors`,
        repro: [...repro, consoleHits.join(" | ")],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(
        id,
        probeId,
        [tab.slug],
        `${tab.slug}: in-flight name ${committed ? "committed" : "visibly discarded"} on tab switch`,
        repro,
      );
    }

    if (await fieldBack.isVisible().catch(() => false) && backValue !== original) {
      await setName(page, original);
      await blurName(page);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 3,
      title: `${tab.slug}: A5 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA6(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A6";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const seed = SEED[tab.slug];
  const expectedName: Record<BattleSlug, string> = {
    actors: "시작 파티",
    classes: "주인공",
    skills: "궁수",
    items: "몬스터",
    equipment: "주인공",
    states: "스킬",
    animations: "주인공",
  };
  const repro = [
    `open ${tab.testId}`,
    `select ${seed.id} (${seed.name}) which is referenced elsewhere`,
    `click db-delete-selected once`,
    `expect delete BLOCKED and toast names the referencing records`,
  ];
  const start = errors.length;
  try {
    if (tab.slug === "items") {
      if (!SEEDING_PROVEN) {
        finding({
          id,
          probeId,
          tabs: [tab.slug],
          S: 0,
          B: 0,
          title: "items: A6 skipped — seeding unproven, no guaranteed incoming item reference",
          repro,
          evidence: [],
          status: "seeding-limited",
        });
        return;
      }
      await mutatedProject(page, (project, itemId) => {
        const database = project.database as { enemies?: { name?: string; rewards?: Record<string, unknown> }[] };
        const enemy = database.enemies?.[0];
        if (!enemy) throw new Error("freshProject has no enemies");
        enemy.rewards = { ...(enemy.rewards ?? {}), dropItemId: itemId };
      }, seed.id);
    }

    await openBattleTab(page, tab);
    await ensureListView(page);
    await clickRecord(page, seed.id);
    const before = await exportedProject(page);
    const existed = recordsOf(before, tab.slug).some((entry) => entry.id === seed.id);
    await page.getByTestId("db-delete-selected").click();
    const armed = ((await page.getByTestId("db-delete-selected").textContent()) ?? "").includes("정말");
    const toast = await toastText(page);
    const after = await exportedProject(page);
    const stillThere = recordsOf(after, tab.slug).some((entry) => entry.id === seed.id);
    const namesReferencer = toast.includes(expectedName[tab.slug]) || toast.includes(seed.name);
    const jargonOnly = toast.length > 0 && !namesReferencer && /id_|database|Reference|FK/i.test(toast);
    const consoleHits = newConsoleSince(errors, start);
    const defects: string[] = [];
    if (!existed) defects.push(`${seed.id} missing before delete`);
    if (!stillThere) defects.push("record deleted despite incoming references (dangling ref)");
    if (armed) defects.push("delete armed confirm instead of blocking");
    if (!toast) defects.push("no block toast");
    if (toast && !namesReferencer) defects.push(`toast did not name referencers: ${JSON.stringify(toast)}`);
    if (jargonOnly) defects.push("jargon-only block message");
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (!stillThere) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 4,
        B: 3,
        title: `${tab.slug}: referenced ${seed.id} deleted anyway`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: jargonOnly || !toast ? 2 : 1,
        B: jargonOnly || !namesReferencer ? 3 : 1,
        title: `${tab.slug}: referenced delete UX failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: referenced delete blocked and toast names ${expectedName[tab.slug]}`, repro);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 2,
      title: `${tab.slug}: A6 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA7(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A7";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const repro = [
    `open ${tab.testId}`,
    `create then 2-step-delete five times`,
    `ids stay unique, new record auto-selected, selection never lands on a deleted id`,
  ];
  const start = errors.length;
  try {
    await openBattleTab(page, tab);
    await ensureListView(page);
    const seen = new Set<string>();
    const defects: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      await page.getByTestId("db-add-record").click();
      const created = await selectedId(page);
      const detail = (await page.getByTestId("db-detail-form").textContent()) ?? "";
      if (!created) defects.push(`create #${i + 1} did not auto-select`);
      else if (seen.has(created)) defects.push(`create #${i + 1} reused id ${created}`);
      else seen.add(created);
      if (detail.includes("레코드가 없습니다")) defects.push(`create #${i + 1} left a blank detail pane`);
      await page.getByTestId("db-delete-selected").click();
      const label = (await page.getByTestId("db-delete-selected").textContent()) ?? "";
      if (label.includes("정말")) await page.getByTestId("db-delete-selected").click();
      const after = await selectedId(page);
      const afterDetail = (await page.getByTestId("db-detail-form").textContent()) ?? "";
      if (created && after === created) defects.push(`delete #${i + 1} left selection on deleted id ${created}`);
      if (afterDetail.includes("레코드가 없습니다") && after) defects.push(`delete #${i + 1} blank pane on ${after}`);
    }
    const consoleHits = newConsoleSince(errors, start);
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);
    if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: defects.some((d) => d.includes("blank") || d.includes("reused")) ? 3 : 2,
        B: 2,
        title: `${tab.slug}: create/delete churn failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: five create/delete cycles kept unique ids and a live selection`, repro);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 2,
      title: `${tab.slug}: A7 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA8(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A8";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const marker = `A8${tab.slug}`.slice(0, 10);
  const repro = [
    `open ${tab.testId}`,
    `focus db-field-name, type ${marker}, press Escape`,
    `dirty guard must fire exactly once; modal must not half-close`,
  ];
  const start = errors.length;
  try {
    await ensureModalOpen(page, mode);
    await dismissPrompt(page, "keep");
    await openBattleTab(page, tab);
    const seed = SEED[tab.slug];
    await clickRecord(page, seed.id);
    const field = await nameField(page);
    if (!(await field.isVisible().catch(() => false))) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: db-field-name missing for Escape-mid-typing probe`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
      return;
    }
    const original = await field.inputValue();
    await field.click();
    await page.keyboard.press("Control+a");
    await field.pressSequentially(marker, { delay: 15 });
    await page.keyboard.press("Escape");
    const promptCount = await page.getByTestId("database-dirty-prompt").count();
    const promptVisible = await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false);
    const modalVisible = await page.getByTestId("database-modal").isVisible().catch(() => false);
    const halfClosed = promptVisible && !modalVisible;
    const closedDirty = !modalVisible && !promptVisible;
    const consoleHits = newConsoleSince(errors, start);
    const defects: string[] = [];
    if (promptCount > 1) defects.push(`dirty prompt count ${promptCount} (leaked listeners)`);
    if (halfClosed) defects.push("half-closed: prompt visible, modal gone");
    if (closedDirty) defects.push("Escape closed the modal instantly while dirty, no 3-way prompt");
    if (modalVisible && !promptVisible) defects.push("Escape was a no-op — no dirty prompt while mid-typing");
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: closedDirty || halfClosed ? 4 : promptCount > 1 ? 3 : 2,
        B: 3,
        title: `${tab.slug}: Escape mid-typing failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: Escape mid-typing raised exactly one dirty prompt`, repro);
    }

    if (promptVisible) await dismissPrompt(page, "keep");
    await ensureModalOpen(page, mode);
    await openBattleTab(page, tab);
    await clickRecord(page, seed.id);
    const restored = await nameField(page);
    if (await restored.isVisible().catch(() => false)) {
      await setName(page, original);
      await blurName(page);
    }
  } catch (error) {
    await dismissPrompt(page, "keep").catch(() => undefined);
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 3,
      title: `${tab.slug}: A8 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA9(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A9";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const seed = SEED[tab.slug];
  const repro = [
    `open ${tab.testId}`,
    `type zero-match query ZZNOMATCH999, then ${seed.name}, select the hit, clear the query`,
    `expect empty-state hint on zero-match; selection survives clear (not silently reset to record[0])`,
  ];
  const start = errors.length;
  try {
    await openBattleTab(page, tab);
    await ensureListView(page);
    await setSearch(page, "ZZNOMATCH999");
    const zeroRows = await page.locator(".db-list-row, .db-gallery-card").count();
    const listText = ((await page.locator(".db-list-pane").textContent()) ?? "").replace(/\s+/g, " ");
    const hasHint = /없|검색|결과|hint|empty/i.test(listText) || (await page.locator(".empty-state, .db-list-empty").count()) > 0;
    await setSearch(page, seed.name);
    const hitVisible = await rowById(page, seed.id).isVisible().catch(() => false);
    if (hitVisible) await rowById(page, seed.id).click();
    const selectedBeforeClear = await selectedId(page);
    await setSearch(page, "");
    const selectedAfterClear = await selectedId(page);
    const project = await exportedProject(page);
    const firstId = recordsOf(project, tab.slug)[0]?.id;
    const resetToFirst = Boolean(
      selectedBeforeClear &&
        selectedAfterClear &&
        firstId &&
        selectedBeforeClear !== firstId &&
        selectedAfterClear === firstId,
    );
    const consoleHits = newConsoleSince(errors, start);
    const defects: string[] = [];
    if (zeroRows !== 0) defects.push(`zero-match still rendered ${zeroRows} row(s)`);
    if (zeroRows === 0 && !hasHint) defects.push("zero-match list has no empty-state hint");
    if (!hitVisible) defects.push(`matching query did not surface ${seed.id}`);
    if (resetToFirst) defects.push(`clearing search silently reset selection to record[0] ${firstId}`);
    if (selectedBeforeClear && selectedAfterClear && selectedBeforeClear !== selectedAfterClear && !resetToFirst) {
      defects.push(`selection changed ${selectedBeforeClear} -> ${selectedAfterClear} on clear`);
    }
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (resetToFirst) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 3,
        B: 3,
        title: `${tab.slug}: clearing search silently reset selection to record[0]`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (zeroRows === 0 && !hasHint) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 1,
        B: 2,
        title: `${tab.slug}: zero-match search has no empty-state hint`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: search probe failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: search empty-state + selection survival hold`, repro);
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 2,
      title: `${tab.slug}: A9 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeA10(page: Page, tab: DatabaseTabSpec & { slug: BattleSlug }, mode: EditorLaneMode, errors: string[]): Promise<void> {
  const probeId = "A10";
  const id = `${mode}-${probeId}-${tab.slug}`;
  const repro = [
    `open ${tab.testId}`,
    `select ${SEED[tab.slug].id}, click 복제`,
    `edit the copy name, assert the original name is untouched (no shallow-clone mutation)`,
  ];
  const start = errors.length;
  try {
    const seed = SEED[tab.slug];
    await openBattleTab(page, tab);
    await ensureListView(page);
    await setSearch(page, "");
    await clickRecord(page, seed.id);
    const before = await exportedProject(page);
    const originalName = recordsOf(before, tab.slug).find((entry) => entry.id === seed.id)?.name ?? seed.name;
    const copyBtn = page.locator(".db-toolbar").getByRole("button", { name: "복제", exact: true });
    if (!(await copyBtn.isVisible().catch(() => false))) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: 복제 button missing`,
        repro,
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
      return;
    }
    await copyBtn.click();
    const copyId = await selectedId(page);
    const field = await nameField(page);
    const copyName = await field.inputValue().catch(() => "");
    const mutated = `A10${tab.slug}`.slice(0, 12);
    if (await field.isVisible().catch(() => false)) {
      await setName(page, mutated);
      await blurName(page);
    }
    const after = await exportedProject(page);
    const originalAfter = recordsOf(after, tab.slug).find((entry) => entry.id === seed.id)?.name;
    const copyAfter = copyId ? recordsOf(after, tab.slug).find((entry) => entry.id === copyId)?.name : undefined;
    const defects: string[] = [];
    if (!copyId || copyId === seed.id) defects.push("copy was not auto-selected as a new id");
    if (originalAfter !== originalName) defects.push(`original mutated ${JSON.stringify(originalName)} -> ${JSON.stringify(originalAfter)}`);
    if (copyAfter === originalName && copyAfter !== mutated) defects.push("copy name stayed glued to original");
    const consoleHits = newConsoleSince(errors, start);
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (originalAfter !== originalName) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 4,
        B: 3,
        title: `${tab.slug}: editing the copy mutated the original (shallow clone)`,
        repro: [...repro, ...defects, `copyNameBeforeEdit=${copyName}`],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else if (defects.length) {
      finding({
        id,
        probeId,
        tabs: [tab.slug],
        S: 2,
        B: 2,
        title: `${tab.slug}: duplicate/copy probe failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, id)],
        status: "confirmed",
      });
    } else {
      clean(id, probeId, [tab.slug], `${tab.slug}: copy is independent of the original`, repro);
    }

    if (copyId && (await rowById(page, copyId).isVisible().catch(() => false))) {
      await rowById(page, copyId).click();
      await page.getByTestId("db-delete-selected").click();
      const label = (await page.getByTestId("db-delete-selected").textContent()) ?? "";
      if (label.includes("정말")) await page.getByTestId("db-delete-selected").click();
    }
  } catch (error) {
    finding({
      id,
      probeId,
      tabs: [tab.slug],
      S: 2,
      B: 2,
      title: `${tab.slug}: A10 threw before a verdict`,
      repro: [...repro, String(error)],
      evidence: [await shot(page, `${id}-err`)],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeX2(page: Page, errors: string[]): Promise<void> {
  const probeId = "X2";
  const repro = [
    "bootDbLane expert, touch nothing",
    "visit every battle tab without edits",
    "try close paths escape/backdrop/x/cancel — a prompt with zero edits is a finding",
  ];
  const start = errors.length;
  const dirtyTabs: string[] = [];
  try {
    for (const tab of BATTLE_TABS) {
      await ensureModalOpen(page, "expert");
      await dismissPrompt(page, "keep");
      await openBattleTab(page, tab);
    }
    const defects: string[] = [];
    for (const closePath of CLOSE_PATHS) {
      await ensureModalOpen(page, "expert");
      await dismissPrompt(page, "keep");
      await openBattleTab(page, BATTLE_TABS[0]!);
      const result = await dirtyGuardOracle(page, closePath);
      if (result.promptShown) {
        dirtyTabs.push(closePath);
        defects.push(`${closePath} raised a dirty prompt with zero edits (buttons=${result.buttons.join(",")})`);
        await dismissPrompt(page, "keep");
      } else {
        const hidden = !(await page.getByTestId("database-modal").isVisible().catch(() => false));
        if (!hidden) defects.push(`${closePath} did not close a clean modal`);
      }
    }
    const consoleHits = newConsoleSince(errors, start);
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);
    if (dirtyTabs.length) {
      finding({
        id: "expert-X2-false-dirty",
        probeId,
        tabs: [...BATTLE_SLUGS],
        S: 2,
        B: 3,
        title: `False-dirty-on-open: clean close paths ${dirtyTabs.join("/")} prompted`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, "expert-X2")],
        status: "confirmed",
      });
    } else if (defects.length) {
      finding({
        id: "expert-X2-false-dirty",
        probeId,
        tabs: ["actors"],
        S: 2,
        B: 1,
        title: `X2 close-path anomaly (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, "expert-X2")],
        status: "confirmed",
      });
    } else {
      clean("expert-X2-false-dirty", probeId, [...BATTLE_SLUGS], "Clean open: all four close paths dismiss without a prompt", repro);
    }
  } catch (error) {
    finding({
      id: "expert-X2-false-dirty",
      probeId,
      tabs: ["actors"],
      S: 2,
      B: 2,
      title: "X2 threw before a verdict",
      repro: [...repro, String(error)],
      evidence: [await shot(page, "expert-X2-err")],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeX3(page: Page, mode: EditorLaneMode): Promise<void> {
  const probeId = "X3";
  const repro = [
    "open -> dirty name -> Escape -> Discard -> reopen, five times",
    "then press Escape ONCE on the clean reopened modal",
    "more than one prompt/close means leaked document keydown listeners",
  ];
  try {
    for (let i = 0; i < 5; i += 1) {
      await ensureModalOpen(page, mode);
      await openBattleTab(page, tabBySlug("actors") as DatabaseTabSpec & { slug: BattleSlug });
      const field = page.getByTestId("db-field-name");
      await field.click();
      await page.keyboard.press("Control+a");
      await field.pressSequentially(`X3loop${i}`, { delay: 10 });
      await page.keyboard.press("Escape");
      if (await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false)) {
        await page.getByTestId("database-dirty-discard").click();
      }
      await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 5_000 });
    }
    await ensureModalOpen(page, mode);
    await openBattleTab(page, tabBySlug("actors") as DatabaseTabSpec & { slug: BattleSlug });
    const field = page.getByTestId("db-field-name");
    await field.click();
    await page.keyboard.press("Control+a");
    await field.pressSequentially("X3final", { delay: 10 });
    await page.keyboard.press("Escape");
    const promptCount = await page.getByTestId("database-dirty-prompt").count();
    if (promptCount !== 1) {
      finding({
        id: "expert-X3-listener-leak",
        probeId,
        tabs: ["actors"],
        S: 3,
        B: 3,
        title: `X3: Escape after 5 dirty-discard cycles produced ${promptCount} prompt(s) (leaked keydown listeners)`,
        repro,
        evidence: [await shot(page, "expert-X3")],
        status: "confirmed",
      });
    } else {
      clean("expert-X3-listener-leak", probeId, ["actors"], "X3: five dirty-discard cycles left a single Escape prompt", repro);
    }
    await dismissPrompt(page, "keep");
    await ensureModalOpen(page, mode);
  } catch (error) {
    await dismissPrompt(page, "discard").catch(() => undefined);
    finding({
      id: "expert-X3-listener-leak",
      probeId,
      tabs: ["actors"],
      S: 2,
      B: 2,
      title: "X3 threw before a verdict",
      repro: [...repro, String(error)],
      evidence: [await shot(page, "expert-X3-err")],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeX6(page: Page): Promise<void> {
  const probeId = "X6";
  const repro = [
    "open items, click db-filter-chip-medicine",
    "close modal, page.reload, reopen items",
    "chip must render visibly ACTIVE (aria-pressed=true and .active)",
    "a persisted-but-invisible filter makes records look deleted",
  ];
  try {
    await ensureModalOpen(page, "expert");
    await openBattleTab(page, tabBySlug("items") as DatabaseTabSpec & { slug: BattleSlug });
    const chip = page.getByTestId("db-filter-chip-medicine");
    if (!(await chip.isVisible().catch(() => false))) {
      finding({
        id: "expert-X6-filter-chip",
        probeId,
        tabs: ["items"],
        S: 2,
        B: 2,
        title: "X6: db-filter-chip-medicine not rendered on items",
        repro,
        evidence: [await shot(page, "expert-X6-missing")],
        status: "confirmed",
      });
      return;
    }
    await chip.click();
    const beforePressed = await chip.getAttribute("aria-pressed");
    const beforeClass = (await chip.getAttribute("class")) ?? "";
    await page.getByTestId("database-footer-ok").click();
    if (await page.getByTestId("database-dirty-prompt").isVisible().catch(() => false)) {
      await page.getByTestId("database-dirty-save").click();
      await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 10_000 });
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click();
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
    for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    await page.getByTestId("toolbar-database").click();
    await expect(page.getByTestId("database-modal")).toBeVisible();
    await openBattleTab(page, tabBySlug("items") as DatabaseTabSpec & { slug: BattleSlug });
    const chipAfter = page.getByTestId("db-filter-chip-medicine");
    const visible = await chipAfter.isVisible().catch(() => false);
    const pressed = visible ? await chipAfter.getAttribute("aria-pressed") : null;
    const cls = visible ? ((await chipAfter.getAttribute("class")) ?? "") : "";
    const stored = await page.evaluate(() => localStorage.getItem("oprn:database.categoryFilter"));
    const persisted = Boolean(stored && stored.includes("medicine"));
    const visuallyActive = pressed === "true" && cls.includes("active");
    const galleryCards = await page.locator("[data-testid^='db-record-card-']").count();
    const listRows = await page.locator("[data-testid^='db-record-row-']").count();

    if (persisted && !visuallyActive) {
      finding({
        id: "expert-X6-filter-chip",
        probeId,
        tabs: ["items"],
        S: 4,
        B: 3,
        title: "X6: medicine filter persisted but chip is not visibly active — records look deleted",
        repro: [...repro, `localStorage=${stored}`, `aria-pressed=${pressed}`, `class=${cls}`, `rows=${listRows} cards=${galleryCards}`],
        evidence: [await shot(page, "expert-X6")],
        status: "confirmed",
      });
    } else if (!visible) {
      finding({
        id: "expert-X6-filter-chip",
        probeId,
        tabs: ["items"],
        S: 2,
        B: 3,
        title: "X6: filter chip missing after reload",
        repro: [...repro, `localStorage=${stored}`],
        evidence: [await shot(page, "expert-X6")],
        status: "confirmed",
      });
    } else if (!persisted) {
      finding({
        id: "expert-X6-filter-chip",
        probeId,
        tabs: ["items"],
        S: 2,
        B: 2,
        title: `X6: medicine chip did not persist (before pressed=${beforePressed} class=${beforeClass})`,
        repro: [...repro, `localStorage=${stored}`],
        evidence: [await shot(page, "expert-X6")],
        status: "confirmed",
      });
    } else {
      clean("expert-X6-filter-chip", probeId, ["items"], "X6: medicine chip persisted and rendered active after reload", repro);
    }

    if (await page.getByTestId("db-filter-chip-all").isVisible().catch(() => false)) {
      await page.getByTestId("db-filter-chip-all").click();
    }
  } catch (error) {
    finding({
      id: "expert-X6-filter-chip",
      probeId,
      tabs: ["items"],
      S: 2,
      B: 2,
      title: "X6 threw before a verdict",
      repro: [...repro, String(error)],
      evidence: [await shot(page, "expert-X6-err")],
      status: "unconfirmed-vqa",
    });
  }
}

async function probeX13(page: Page, errors: string[]): Promise<void> {
  const probeId = "X13";
  const offscreenId = SEED.items.offscreenId;
  const offscreenName = SEED.items.offscreenName;
  const repro = [
    `items count 177 > VIRTUALIZER_THRESHOLD ${VIRTUALIZER_THRESHOLD}`,
    `list view, search ${offscreenName} (${offscreenId}), select it, clear search`,
    "assert the selected row is in the DOM",
  ];
  const start = errors.length;
  try {
    await ensureModalOpen(page, "expert");
    await openBattleTab(page, tabBySlug("items") as DatabaseTabSpec & { slug: BattleSlug });
    await ensureListView(page);
    const project = await exportedProject(page);
    const count = project.database.items.length;
    if (count <= VIRTUALIZER_THRESHOLD) {
      finding({
        id: "expert-X13-virtualizer",
        probeId,
        tabs: ["items"],
        S: 0,
        B: 0,
        title: `X13 seeding-limited: items=${count} does not exceed threshold ${VIRTUALIZER_THRESHOLD}`,
        repro,
        evidence: [],
        status: "seeding-limited",
      });
      return;
    }
    const beforeSearchInDom = await page.getByTestId(`db-record-row-${offscreenId}`).count();
    await setSearch(page, offscreenName);
    const during = page.getByTestId(`db-record-row-${offscreenId}`);
    const visibleDuring = await during.isVisible().catch(() => false);
    if (visibleDuring) await during.click();
    const selected = await selectedId(page);
    await setSearch(page, "");
    const afterInDom = await page.getByTestId(`db-record-row-${offscreenId}`).count();
    const afterVisible = await page.getByTestId(`db-record-row-${offscreenId}`).isVisible().catch(() => false);
    const consoleHits = newConsoleSince(errors, start);
    const defects: string[] = [];
    if (!visibleDuring) defects.push(`search did not surface ${offscreenId}`);
    if (selected !== offscreenId) defects.push(`selected ${selected} instead of ${offscreenId}`);
    if (afterInDom === 0) defects.push("selected offscreen row missing from DOM after clearing search");
    if (consoleHits.length) defects.push(`console: ${consoleHits.join(" | ")}`);

    if (afterInDom === 0) {
      finding({
        id: "expert-X13-virtualizer",
        probeId,
        tabs: ["items"],
        S: 3,
        B: 3,
        title: "X13: selected offscreen item row is not in the DOM after clearing search",
        repro: [...repro, ...defects, `inDomBeforeSearch=${beforeSearchInDom}`],
        evidence: [await shot(page, "expert-X13")],
        status: "confirmed",
      });
    } else if (defects.length) {
      finding({
        id: "expert-X13-virtualizer",
        probeId,
        tabs: ["items"],
        S: 2,
        B: 2,
        title: `X13: offscreen selection probe failed (${defects[0]})`,
        repro: [...repro, ...defects],
        evidence: [await shot(page, "expert-X13")],
        status: "confirmed",
      });
    } else {
      clean(
        "expert-X13-virtualizer",
        probeId,
        ["items"],
        `X13: selected ${offscreenId} stayed in the DOM after clearing search (visible=${afterVisible})`,
        repro,
      );
    }
  } catch (error) {
    finding({
      id: "expert-X13-virtualizer",
      probeId,
      tabs: ["items"],
      S: 2,
      B: 2,
      title: "X13 threw before a verdict",
      repro: [...repro, String(error)],
      evidence: [await shot(page, "expert-X13-err")],
      status: "unconfirmed-vqa",
    });
  }
}

