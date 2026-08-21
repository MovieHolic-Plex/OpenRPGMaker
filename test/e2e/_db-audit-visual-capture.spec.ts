import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { DATABASE_TAB_SPECS, type DatabaseTabSpec } from "./oprn-database-helpers";
import {
  bootDbLane,
  COMMON_DB_TAB_TEST_IDS,
  switchTabAnyMode,
  type EditorLaneMode,
} from "./dbAuditHelpers";

/**
 * Diagnostic visual-capture matrix (todo 14). `_` prefix keeps it out of the
 * default suite. Capture only — a failed surface is a manifest row, not a
 * reason to abort the remaining tabs.
 */

test.use({ serviceWorkers: "block" });

const SHOT_DIR = "output/evidence/db-beginner-audit/shots";
const MANIFEST_PATH = `${SHOT_DIR}/manifest.json`;

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const MODES: readonly EditorLaneMode[] = ["beginner", "expert"];

/** Pinned overview + 23 tabs from the campaign plan / `TAB_GROUPS` registry. */
const SURFACE_IDS = [
  "overview",
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "elements",
  "states",
  "animations",
  "battleScreen",
  "battleCommands",
  "enemies",
  "monsterSpecies",
  "troops",
  "crops",
  "characters",
  "terrain",
  "tilesets",
  "structureKits",
  "commonEvents",
  "system",
  "terms",
  "switches",
  "variables",
] as const;

type SurfaceId = (typeof SURFACE_IDS)[number];

/**
 * Surfaces that are not yet in `DATABASE_TAB_SPECS`. Testids match
 * `src/editor/panels/database.ts` and the `db-tabs-sweep.spec.ts` probe list —
 * they are looked up from `DATABASE_TAB_SPECS` first so we never invent a
 * testid that the helper already owns.
 */
const EXTRA_TAB_SPECS: readonly DatabaseTabSpec[] = [
  { label: "Overview", slug: "overview", testId: "db-tab-overview" },
  { label: "Crops", slug: "crops", testId: "db-tab-crops" },
  { label: "Characters", slug: "characters", testId: "db-tab-characters" },
  { label: "Monster Species", slug: "monster-species", testId: "db-tab-monster-species" },
  { label: "Structure Kits", slug: "structure-kits", testId: "db-tab-structure-kits" },
];

type Viewport = (typeof VIEWPORTS)[number];

type ManifestEntry = {
  tab: string;
  mode: EditorLaneMode;
  viewport: string;
  path: string;
  bodyTextLen: number;
  ok: boolean;
  note?: string;
};

const manifest: ManifestEntry[] = [];

function persistManifest(): void {
  mkdirSync(SHOT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function surfaceSlug(id: SurfaceId): string {
  return id.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

function specForSurface(id: SurfaceId): DatabaseTabSpec {
  const slug = surfaceSlug(id);
  const fromCanon = DATABASE_TAB_SPECS.find((tab) => tab.slug === slug);
  if (fromCanon) return fromCanon;
  const extra = EXTRA_TAB_SPECS.find((tab) => tab.slug === slug);
  if (extra) return extra;
  throw new Error(`No DatabaseTabSpec for surface ${id} (slug ${slug})`);
}

const SURFACES: readonly { id: SurfaceId; spec: DatabaseTabSpec }[] = SURFACE_IDS.map((id) => ({
  id,
  spec: specForSurface(id),
}));

const COMMON_SURFACES = SURFACES.filter((surface) =>
  (COMMON_DB_TAB_TEST_IDS as readonly string[]).includes(surface.spec.testId),
);

function shotRelPath(mode: EditorLaneMode, viewport: string, tab: string, dock: boolean): string {
  const suffix = dock ? "-dock" : "";
  return `${SHOT_DIR}/${mode}-${viewport}-${tab}${suffix}.png`;
}

async function rafSettle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function measureBodyTextLen(page: Page): Promise<number> {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="database-modal"]');
    if (!modal) return 0;
    const body = modal.querySelector(".db-body") ?? modal;
    return (body.textContent ?? "").trim().length;
  });
}

async function captureSurface(
  page: Page,
  surface: { id: SurfaceId; spec: DatabaseTabSpec },
  mode: EditorLaneMode,
  viewport: Viewport,
  dock: boolean,
): Promise<void> {
  const vp = `${viewport.width}x${viewport.height}`;
  const relPath = shotRelPath(mode, vp, surface.id, dock);
  const entry: ManifestEntry = {
    tab: surface.id,
    mode,
    viewport: dock ? `${vp}-dock` : vp,
    path: relPath,
    bodyTextLen: 0,
    ok: false,
  };
  if (dock) entry.note = "dock-mode";

  try {
    await switchTabAnyMode(page, surface.spec);
    if (surface.id === "overview") {
      await expect(page.getByTestId("db-overview-curve")).toBeVisible({ timeout: 10_000 });
    }
    await rafSettle(page);
    entry.bodyTextLen = await measureBodyTextLen(page);
    await page.getByTestId("database-modal").screenshot({ path: relPath });
    entry.ok = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    entry.note = dock ? `dock-mode; ${message}` : message;
    try {
      if (await page.getByTestId("database-modal").isVisible().catch(() => false)) {
        entry.bodyTextLen = await measureBodyTextLen(page).catch(() => 0);
        await page.getByTestId("database-modal").screenshot({ path: relPath });
      }
    } catch (shotError) {
      const shotMessage = shotError instanceof Error ? shotError.message : String(shotError);
      entry.note = `${entry.note}; screenshot: ${shotMessage}`;
    }
  }

  manifest.push(entry);
  persistManifest();
}

test.describe("DB visual capture matrix", () => {
  test.beforeAll(() => {
    // Generated-artifacts class: never let a leftover PNG ride into this run's manifest.
    if (existsSync(SHOT_DIR)) {
      for (const name of readdirSync(SHOT_DIR)) {
        rmSync(`${SHOT_DIR}/${name}`, { recursive: true, force: true });
      }
    }
    mkdirSync(SHOT_DIR, { recursive: true });
    persistManifest();
  });

  for (const mode of MODES) {
    for (const viewport of VIEWPORTS) {
      const vp = `${viewport.width}x${viewport.height}`;
      test(`${mode} ${vp}`, async ({ page }) => {
        test.slow();
        test.setTimeout(300_000);

        await bootDbLane(page, { mode, viewport });

        for (const surface of SURFACES) {
          await captureSurface(page, surface, mode, viewport, false);
        }

        if (mode === "beginner" && viewport.width === 1024 && viewport.height === 768) {
          try {
            await page.getByTestId("database-dock-toggle").click();
            await expect(page.getByTestId("database-modal")).toHaveClass(/is-docked/);
            await rafSettle(page);
            for (const surface of COMMON_SURFACES) {
              await captureSurface(page, surface, mode, viewport, true);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            for (const surface of COMMON_SURFACES) {
              manifest.push({
                tab: surface.id,
                mode,
                viewport: `${vp}-dock`,
                path: shotRelPath(mode, vp, surface.id, true),
                bodyTextLen: 0,
                ok: false,
                note: `dock-mode; ${message}`,
              });
            }
            persistManifest();
          }
        }
      });
    }
  }
});
