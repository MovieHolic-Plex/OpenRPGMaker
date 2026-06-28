import { expect, test } from "@playwright/test";
import type { Project } from "@/project/types";
import type { SupabaseResourceCacheReport } from "@/assets/supabaseResourceCache";

declare const process: { readonly env: Record<string, string | undefined> };

const ROOT_RESOURCE_IDS = [
  "hero",
  "rpg-zzu-title-blue",
  "generated-enemy-ontology-8da61312",
  "generated-enemy-sylph-hornet",
  "generated-actor-hero-01-face",
  "generated-actor-hero-01-charset",
  "generated-actor-hero-01-battle",
  "generated-enemy-slime-01",
  "generated-actor-hero-02-face",
  "generated-actor-hero-02-charset",
  "generated-actor-hero-02-battle",
  "generated-actor-hero-03-battle",
  "generated-actor-hero-04-battle",
  "generated-enemy-bat-01",
  "generated-enemy-golem-01",
  "generated-enemy-dragon-01",
  "generated-item-potion-red-image",
  "generated-item-potion-red-icon",
  "generated-equipment-bronze-sword-image",
  "generated-equipment-bronze-sword-icon",
  "generated-item-ether-blue-image",
  "generated-item-ether-blue-icon",
  "generated-equipment-oak-shield-image",
  "generated-equipment-oak-shield-icon",
  "generated-troop-preview-slime",
] as const;

const supabaseRootCacheTest = process.env.RPG_ZZU_SUPABASE_ROOT_BROWSER_QA === "1" ? test : test.skip;

supabaseRootCacheTest("Supabase-root generated resources are available and locally cacheable in the browser", async ({ page }, testInfo) => {
  await page.goto("/?supabaseRecovered=1&supabaseRootCacheEvidence=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

  await expect.poll(async () => page.evaluate(async () => {
    const storePath = "/src/project/store.ts";
    const { store } = await import(storePath) as typeof import("@/project/store");
    return Object.keys(store.getCurrent().assets.uploaded).length;
  }), { timeout: 10_000 }).toBeGreaterThanOrEqual(ROOT_RESOURCE_IDS.length);

  const facts = await page.evaluate(async (rootResourceIds) => {
    type CacheEntry = { readonly resourceId: string };
    type CacheModule = {
      readonly SUPABASE_RESOURCE_CACHE_NAME: string;
      readonly cacheSupabaseRootResources: (project: Pick<Project, "assets">) => Promise<SupabaseResourceCacheReport>;
      readonly uploadedAssetIsSupabaseRooted: (asset: Project["assets"]["uploaded"][string] | undefined) => boolean;
    };
    type ResolverModule = {
      readonly resolveAssetResourceUrl: (resourceId: string, options: { readonly project: Project }) => string | null;
    };
    const storePath = "/src/project/store.ts";
    const cachePath = "/src/assets/supabaseResourceCache.ts";
    const resolverPath = "/src/assets/generatedAssetResourceResolver.ts";
    const [{ store }, cacheModule, resolverModule] = await Promise.all([
      import(storePath) as Promise<typeof import("@/project/store")>,
      import(cachePath) as Promise<CacheModule>,
      import(resolverPath) as Promise<ResolverModule>,
    ]);
    const project = store.getCurrent();
    const report = await cacheModule.cacheSupabaseRootResources(project);
    const rootedIds = rootResourceIds.filter((id) => cacheModule.uploadedAssetIsSupabaseRooted(project.assets.uploaded[id]));
    const cached = report.cached as readonly CacheEntry[];
    const cachedRootIds = rootResourceIds.filter((id) => cached.some((entry) => entry.resourceId === id));
    const resolvedSamples = Object.fromEntries(
      rootResourceIds.slice(0, 5).map((id) => [id, resolverModule.resolveAssetResourceUrl(id, { project })?.slice(0, 22) ?? null]),
    );
    return {
      projectTitle: project.meta.title,
      uploadedCount: Object.keys(project.assets.uploaded).length,
      expectedCount: rootResourceIds.length,
      rootedIds,
      cachedRootIds,
      skipped: report.skipped,
      resolvedSamples,
    };
  }, ROOT_RESOURCE_IDS);

  expect(facts.rootedIds).toHaveLength(ROOT_RESOURCE_IDS.length);
  expect(facts.cachedRootIds).toHaveLength(ROOT_RESOURCE_IDS.length);
  expect(facts.skipped).toEqual([]);
  expect(Object.values(facts.resolvedSamples)).toEqual(expect.arrayContaining(["data:image/png;base64,"]));

  await page.screenshot({ path: testInfo.outputPath("browser-supabase-root-cache-editor.png"), fullPage: true });
  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("browser-supabase-root-cache-resource-manager.png"), fullPage: true });
  await testInfo.attach("supabase-root-cache-facts", {
    body: JSON.stringify(facts, null, 2),
    contentType: "application/json",
  });
});
