/**
 * AI 조수 실패 모드 수정(F1·F2·F3)의 실제 편집기 증거.
 * 사용: BASE=http://127.0.0.1:<포트> node scripts/capture-ai-failure-mode-fixes.mjs
 * 출력: verify-shots/ai-failure-modes/*.png + results.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9827";
const OUT = join(process.cwd(), "verify-shots", "ai-failure-modes");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (message) => { if (message.type() === "error") console.log("[page error]", message.text().slice(0, 200)); });

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
});
await page.goto(`${BASE}/?devProject=1`, { waitUntil: "domcontentloaded" });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible({ timeout: 5000 }).catch(() => false)) await guest.click();
await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 90_000 });
for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
  const button = page.getByTestId(testid);
  if (await button.isVisible().catch(() => false)) await button.click().catch(() => {});
}
await page.waitForTimeout(1500);
await page.screenshot({ path: join(OUT, "01-before.png") });

const results = await page.evaluate(async () => {
  const { runTool } = await import("/src/editor/tools/index.ts");
  const { store } = await import("/src/project/store.ts");
  const { resolveMaterialByLabel } = await import("/src/project/tileVocabulary.ts");
  const { selectEditorMap } = await import("/src/editor/mapSelection.ts");
  const mapId = "map_f_fix_evidence";
  const out = [];
  const call = (label, name, args) => {
    let result;
    store.update((draft) => {
      const ctx = { project: draft };
      result = runTool(ctx, name, args);
      Object.assign(draft, ctx.project);
    }, { scope: "project" });
    out.push({ label, tool: name, ok: result.ok, summary: result.summary,
      issues: (result.issues ?? []).map((issue) => issue.message) });
    return result;
  };

  call("빈 맵 준비", "create_map", { id: mapId, name: "실패 모드 수정 검증", width: 20, height: 14 });
  const tilesetId = store.getCurrent().maps[mapId].tilesetId;
  const flower = resolveMaterialByLabel(store.getCurrent().tilesets[tilesetId], "꽃", { preferGroup: true });
  out.push({ label: "F3 어휘 해석", tool: 'resolveMaterialByLabel("꽃")', ok: flower.status !== "missing",
    summary: flower.status === "missing" ? flower.message
      : `${flower.status} · ${flower.kind === "group" ? flower.group.name : flower.matchedLabel}`, issues: [] });

  call("F3 꽃 소품 배치", "place_props", { mapId, material: "꽃", area: { x: 2, y: 2, w: 16, h: 5 }, count: 18, minGap: 1, seed: 7 });
  call("F2 밑그림 없이 NPC 배치", "place_npc", { mapId, x: 4, y: 9, id: "npc_gate_guide", name: "안내원",
    graphic: { transparent: false }, pages: [{ lines: ["밑그림 없이도 세워졌습니다."] }] });
  call("F1 단일 객체 dialogue", "make_villager", { mapId, x: 9, y: 9, id: "npc_villager_f1", name: "주민",
    dialogue: { text: "한 개짜리 객체도 받습니다." } });
  call("F3 없는 재료(실패 문구)", "place_props", { mapId, material: "붉은 카펫", area: { x: 2, y: 11, w: 6, h: 2 }, count: 4, seed: 3 });
  selectEditorMap(mapId);
  return out;
});

await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, "02-after.png") });
const canvas = page.locator('[data-testid="edit-canvas"]').first();
await canvas.screenshot({ path: join(OUT, "03-canvas.png") });
writeFileSync(join(OUT, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
for (const entry of results) console.log(entry.ok ? "OK  " : "FAIL", entry.label, "—", entry.summary.slice(0, 160));
await browser.close();
