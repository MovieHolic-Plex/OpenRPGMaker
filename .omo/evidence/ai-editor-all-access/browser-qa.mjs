import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const origin = "http://127.0.0.1:9845";
const outDir = fileURLToPath(new URL("./browser/", import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const actions = [];
const log = (step, detail = {}) => {
  actions.push({ t: new Date().toISOString(), step, ...detail });
};

try {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:hint-selection-chips-v1", "1");
  });
  await page.goto(`${origin}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  log("boot", { url: page.url(), title: await page.title() });
  await page.screenshot({ path: join(outDir, "01-boot.png"), fullPage: true });

  const toolProof = await page.evaluate(async () => {
    const mod = await import("/src/editor/tools/index.ts");
    const ctx = { project: mod.createEmptyToolProject("browser-qa") };
    const names = [
      "upsert_life_skill",
      "upsert_life_system",
      "upsert_battle_animation",
      "upsert_resource",
      "delete_resource",
      "register_structure_kit",
      "shift_map",
      "set_map_properties",
      "set_project_settings",
    ];
    const present = Object.fromEntries(names.map((name) => [name, Boolean(mod.getTool(name))]));
    const life = mod.runTool(ctx, "upsert_life_skill", {
      skill: { id: "life_farming", name: "농사", skillType: "farming", maxLevel: 10 },
    });
    const found = mod.runTool(ctx, "find_tools", { query: "생활 스킬" });
    const project = mod.runTool(ctx, "set_project_settings", { title: "브라우저 QA" });
    return {
      present,
      lifeOk: life.ok,
      lifeSummary: life.summary,
      find: found.data,
      projectOk: project.ok,
      projectTitle: ctx.project.meta.title,
    };
  });
  log("typed-tools-in-browser", toolProof);
  await writeFile(join(outDir, "assistant-audit.json"), JSON.stringify(toolProof, null, 2));

  const input = page.locator("[data-testid='ai-input']").first();
  const composerVisible = await input.isVisible().catch(() => false);
  log("composer-visible", { composerVisible });
  if (composerVisible) {
    await input.fill("생활 스킬이랑 전투 애니메이션, 맵 설정을 바꿔줘");
    const send = page.locator("[data-testid='ai-send']").first();
    if (await send.isVisible().catch(() => false)) await send.click();
    await page.waitForTimeout(4000);
    await page.locator(".ai-composer-actions").getByText("생각 중").waitFor({ state: "hidden", timeout: 90_000 }).catch(() => {});
    const reply = (await page.locator("[data-testid='ai-panel']").innerText().catch(() => "")).slice(0, 2000);
    log("assistant-reply", { reply });
  }
  await page.screenshot({ path: join(outDir, "02-assistant.png"), fullPage: true });

  const missing = Object.entries(toolProof.present).filter(([, ok]) => !ok).map(([name]) => name);
  if (missing.length > 0 || !toolProof.lifeOk || !toolProof.projectOk) {
    throw new Error(`browser QA failed: missing=${missing.join(",")} life=${toolProof.lifeOk} project=${toolProof.projectOk}`);
  }
  await writeFile(join(outDir, "..", "browser-actions.json"), JSON.stringify({ pass: true, actions }, null, 2));
  console.log("BROWSER_QA_PASS");
} catch (error) {
  await page.screenshot({ path: join(outDir, "99-fail.png"), fullPage: true }).catch(() => {});
  await writeFile(join(outDir, "..", "browser-actions.json"), JSON.stringify({ pass: false, actions, error: String(error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
