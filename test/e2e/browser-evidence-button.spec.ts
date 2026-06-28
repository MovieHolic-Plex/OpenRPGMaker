import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const evidenceDir = "output/evidence/browser-evidence-button";

test("evidence packet button produces browser screenshot evidence", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    `${evidenceDir}/scenario.json`,
    JSON.stringify(
      {
        name: "browser-evidence-button",
        route: "/?freshProject=1&evidenceButton=1",
        acceptance: ["browse real editor UI", "click toolbar evidence button", "capture desktop and mobile screenshots"],
      },
      null,
      2
    ),
    "utf8"
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&evidenceButton=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("toolbar-evidence-packet")).toHaveAttribute("title", "브라우저 증거 패킷");
  await page.screenshot({ path: `${evidenceDir}/desktop-entry.png`, fullPage: true });

  await page.getByTestId("toolbar-evidence-packet").click();
  await expect(page.getByTestId("toast")).toContainText("브라우저 증거 패킷 준비됨");
  await page.screenshot({ path: `${evidenceDir}/desktop-after-click.png`, fullPage: true });

  const projectExport = await page.getByTestId("project-export-json").textContent();
  if (!projectExport) throw new Error("Missing project export evidence");
  await writeFile(`${evidenceDir}/project-export.json`, projectExport, "utf8");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("toolbar-evidence-packet")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/mobile-after-click.png`, fullPage: true });
});
