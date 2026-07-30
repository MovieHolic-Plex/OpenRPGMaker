import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { seedReferenceBattleProject, startReferenceBattle } from "./battleReferenceProject";

const evidenceDir = "output/evidence/battle-asset-equivalence-20260630/red-green";

test("battle reference scene uses equivalent enemy, party, portrait, and icon assets", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 768 });
  await mkdir(evidenceDir, { recursive: true });
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);
  await page.screenshot({ path: `${evidenceDir}/01-command-assets.png`, fullPage: true });

  const commandMetrics = await assetMetrics(page);
  await writeFile(`${evidenceDir}/01-command-assets.json`, `${JSON.stringify(commandMetrics, null, 2)}\n`, "utf8");

  expect(commandMetrics.enemyResourceIds).toEqual(["generated-enemy-sylph-hornet"]);
  expect(commandMetrics.enemyImageSources[0]).toContain("sylph-hornet-transparent.png");
  expect(commandMetrics.actorResourceIds).toEqual([
    "generated-actor-hero-01-battle",
    "generated-actor-hero-02-battle",
    "generated-actor-hero-03-battle",
    "generated-actor-hero-04-battle",
  ]);
  expect(commandMetrics.actorResourceIds).toHaveLength(new Set(commandMetrics.actorResourceIds).size);
  expect(commandMetrics.commandIconBackgrounds.every((image) => image.includes("/assets/generated/rm2k3/"))).toBe(true);
  expect(commandMetrics.textLeaks).toEqual([]);
  expect(commandMetrics.wrappedCommandLabels).toEqual([]);

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await expect(page.getByTestId("battle-target-brackets")).toBeVisible();
  await expect(page.getByTestId("battle-target-prompt")).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/02-target-assets.png`, fullPage: true });

  await page.locator(".battle-enemy[data-battle-targetable='true']").first().click();
  await expect(page.getByTestId("battle-result-panel")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/03-result-assets.png`, fullPage: true });

  const resultMetrics = await assetMetrics(page);
  await writeFile(`${evidenceDir}/03-result-assets.json`, `${JSON.stringify(resultMetrics, null, 2)}\n`, "utf8");
  expect(resultMetrics.resultIconBackgrounds.every((image) => image.includes("/assets/generated/rm2k3/"))).toBe(true);
  expect(resultMetrics.text).toContain("승리");
  // 거짓 fallback 아이템("불씨 조각") 제거 검증: 드롭 아이템이 없는 fixture 에서는
  // 가짜 아이템 이름이 결과에 나타나지 않아야 한다.
  expect(resultMetrics.text).not.toContain("불씨 조각");
});

async function assetMetrics(page: Page): Promise<{
  readonly enemyResourceIds: readonly string[];
  readonly enemyImageSources: readonly string[];
  readonly actorResourceIds: readonly string[];
  readonly commandIconBackgrounds: readonly string[];
  readonly resultIconBackgrounds: readonly string[];
  readonly text: string;
  readonly textLeaks: readonly string[];
  readonly wrappedCommandLabels: readonly string[];
}> {
  return page.getByTestId("battle-scene").evaluate((scene) => {
    const textNodes = [
      ...scene.querySelectorAll<HTMLElement>(
        ".battle-command-text strong, .battle-command-text small, .battle-actor-status .battle-actor-name, .battle-actor-status .battle-actor-state, .battle-actor-status .battle-actor-hp, .battle-actor-status .battle-actor-mp"
      ),
    ];
    const textLeaks = textNodes
      .filter((node) => {
        const owner = node.closest<HTMLElement>(".battle-command, .battle-actor-status");
        if (!owner) return false;
        const rect = node.getBoundingClientRect();
        const ownerRect = owner.getBoundingClientRect();
        const tolerance = 3;
        return (
          rect.left < ownerRect.left - tolerance ||
          rect.right > ownerRect.right + tolerance ||
          rect.top < ownerRect.top - tolerance ||
          rect.bottom > ownerRect.bottom + tolerance
        );
      })
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    const wrappedCommandLabels = [...scene.querySelectorAll<HTMLElement>(".battle-command-text strong")]
      .filter((node) => {
        return node.scrollHeight > node.clientHeight + 2;
      })
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    return {
      enemyResourceIds: [...scene.querySelectorAll<HTMLElement>("[data-monster-resource-id]")]
        .map((node) => node.dataset.monsterResourceId ?? ""),
      enemyImageSources: [...scene.querySelectorAll<HTMLImageElement>(".battle-enemy-image")]
        .map((node) => node.src),
      actorResourceIds: [...scene.querySelectorAll<HTMLElement>("[data-battle-charset-resource-id]")]
        .map((node) => node.dataset.battleCharsetResourceId ?? ""),
      commandIconBackgrounds: [...scene.querySelectorAll<HTMLElement>(".battle-command-icon")]
        .map((node) => getComputedStyle(node).backgroundImage),
      resultIconBackgrounds: [...scene.querySelectorAll<HTMLElement>(".battle-result-reward-icon")]
        .map((node) => getComputedStyle(node).backgroundImage),
      text: scene.textContent?.replace(/\s+/g, " ").trim() ?? "",
      textLeaks,
      wrappedCommandLabels,
    };
  });
}
