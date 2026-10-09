import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { bootDbLane, switchTabAnyMode } from "./dbAuditHelpers";
import type { DatabaseTabSpec } from "./oprn-database-helpers";

const SHOT_DIR = "verify-shots/world-lore-ux";

const TABS: readonly (DatabaseTabSpec & { expect: string; file: string })[] = [
  { label: "WorldCanon", slug: "world-canon", testId: "db-tab-world-canon", expect: "db-world-canon-workspace", file: "world-canon" },
  { label: "WorldCodex", slug: "world-codex", testId: "db-tab-world-codex", expect: "db-world-codex-lead", file: "world-codex" },
  { label: "WorldGen", slug: "world-gen", testId: "db-tab-world-gen", expect: "db-worldgen-workspace", file: "world-gen" },
];

for (const mode of ["beginner", "expert"] as const) {
  test(`world lore tabs render (${mode})`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOT_DIR, { recursive: true });
    await bootDbLane(page, { mode });
    for (const tab of TABS) {
      await switchTabAnyMode(page, tab);
      await expect(page.getByTestId(tab.expect)).toBeVisible();
      await page.getByTestId("database-modal").screenshot({ path: `${SHOT_DIR}/${tab.file}-${mode}.png` });
    }
  });
}
