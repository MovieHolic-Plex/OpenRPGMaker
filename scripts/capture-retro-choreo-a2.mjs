// A2 증거 촬영. 사용: npm run dev:worktree (9807) 를 띄운 뒤  node scripts/capture-retro-choreo-a2.mjs [baseUrl]
// 결과: verify-shots/retro-choreo-a2/*.png + results.json  (메모리 세션 ?freshProject=1 — 정본 저장 증거 아님)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:9807";
const OUT = path.resolve("verify-shots/retro-choreo-a2");
fs.mkdirSync(OUT, { recursive: true });
const results = {};
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
await p.goto(`${BASE}/?freshProject=1`);
await p.waitForSelector("[data-testid='edit-canvas']", { timeout: 90000 });
await p.waitForTimeout(2000);
const wait = (ms = 700) => p.waitForTimeout(ms);
const tid = (id) => p.locator(`[data-testid="${id}"]`);
const shot = (name) => p.screenshot({ path: path.join(OUT, name), timeout: 120000, animations: "allow" });
const jsClick = (id) => p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`).click(), id);
const setValue = (id, value) => p.evaluate(([x, v]) => {
  const host = document.querySelector(`[data-testid="${x}"]`);
  const input = host.matches("input,select,textarea") ? host : host.querySelector("input,select,textarea");
  input.value = v;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}, [id, String(value)]);
const search = (id, value) => setValue(id, value);

await tid("toolbar-database").click();
await tid("database-modal").waitFor({ timeout: 30000 });
await wait(1200);

// a) 탭 목록: 기본 배지
await jsClick("db-tab-retro-choreographies");
await wait(2500);
results.tabLabel = await tid("db-tab-retro-choreographies").textContent();
results.defaultBadgeCount = await tid("db-retro-choreo-badge-default").count();
await shot("a-tab-list-default-badge.png");

// b) 기본 연출을 골라 복제
await tid("db-retro-choreo-list").locator(".db-list-row").first().click();
await wait(1500);
results.cloneButton = await tid("db-retro-choreo-clone").count();
await shot("b0-default-readonly.png");
await jsClick("db-retro-choreo-clone");
await wait(1800);
results.afterClone = await p.evaluate(() => window.__oprnEditorStore.getCurrent().database.skillChoreographies.map((r) => ({ id: r.id, name: r.name, layers: r.layers.length })));
await shot("b1-cloned-before.png");

// 층 추가 → 시트 갤러리에서 「번개」 검색
await jsClick("db-retro-choreo-add-layer");
await wait(1200);
await search("db-retro-gallery-query", "번개");
await wait(1200);
results.thunderSheetCards = await p.locator("[data-testid^='db-retro-sheet-']").count();
results.thunderCount = await tid("db-retro-gallery-count").first().textContent();
await p.evaluate(() => document.querySelector("[data-testid='db-retro-choreo-sheet-picker']")?.scrollIntoView({ block: "center" }));
await wait(600);
await shot("b2-lightning-search.png");
const firstSheet = await p.locator("[data-testid^='db-retro-sheet-']").first().getAttribute("data-testid");
await p.locator("[data-testid^='db-retro-sheet-']").first().click();
await wait(1500);
const lastIdx = await p.evaluate(() => window.__oprnEditorStore.getCurrent().database.skillChoreographies.at(-1).layers.length - 1);
results.newLayerIndex = lastIdx;
results.pickedSheet = firstSheet;
await p.evaluate((i) => document.querySelector(`[data-testid="db-retro-choreo-layer-${i}"]`)?.scrollIntoView({ block: "center" }), lastIdx);
await wait(500);
await shot("b3-layer-added-before-edit.png");
const layerState = () => p.evaluate(() => window.__oprnEditorStore.getCurrent().database.skillChoreographies.at(-1).layers.map((l) => ({ sheet: l.sheet, anchor: l.anchor, startMs: l.startMs, scale: l.scale })));
results.layersBefore = await layerState();
await setValue(`db-retro-choreo-layer-${lastIdx}-start`, 400);
await setValue(`db-retro-choreo-layer-${lastIdx}-scale`, 2);
await wait(1200);
results.layersAfter = await layerState();
await shot("b4-layer-edited-after.png");

// c) 무대 재생
await p.evaluate(() => document.querySelector("[data-testid='db-retro-choreo-stage']")?.scrollIntoView({ block: "center" }));
await wait(300);
const frames = [];
for (let i = 0; i < 4; i++) {
  await p.locator("[data-testid='db-retro-choreo-stage']").screenshot({ path: path.join(OUT, `c-stage-${i}.png`), animations: "allow" });
  await wait(220);
}
results.stageHtmlLen = await p.evaluate(() => document.querySelector("[data-testid='db-retro-choreo-stage']")?.innerHTML.length);
await shot("c-stage-playing.png");

// d) 스킬 탭 갤러리에서 새 연출 고르기
const newId = results.afterClone.at(-1).id;
const skillId = await p.evaluate(async () => {
  const a = await import("/src/editor/databaseActions.ts");
  const id = a.duplicateDatabaseRecord("skills", "skill_attack");
  a.updateDatabaseRecord("skills", id, { retroChoreographyId: undefined, name: "새 스킬" });
  return id;
});
await jsClick("db-tab-skills");
await wait(2200);
await p.evaluate(() => {
  const input = [...document.querySelectorAll("input[type=search]")].find((i) => i.placeholder === "이름 또는 ID 검색");
  input.value = "새 스킬";
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await wait(900);
await p.locator(`[data-record-id="${skillId}"].db-list-row`).click({ timeout: 8000 });
await wait(1500);
await p.evaluate(() => document.querySelector("[data-testid='db-skill-retro-picker']")?.scrollIntoView({ block: "center" }));
await wait(600);
await shot("d0-skill-tab-picker.png");
// 프로젝트 연출은 「내 연출」 이름으로 찾는다
await p.evaluate(() => { const i = document.querySelector("[data-testid='db-skill-retro-picker'] [data-testid='db-retro-gallery-query']"); if (i) { i.value = "사본"; i.dispatchEvent(new Event("input", { bubbles: true })); } });
await wait(1200);
results.skillPickerCards = await p.locator("[data-testid='db-skill-retro-picker'] [data-testid^='db-retro-choreo-card-']").count();
await p.locator(`[data-testid='db-skill-retro-picker'] [data-testid="db-retro-choreo-card-${newId}"]`).click({ timeout: 8000 });
await wait(900);
await shot("d1-skill-picker-selected.png");
await jsClick("db-retro-gallery-pick");
await wait(1500);
results.skillAfterPick = await p.evaluate((id) => window.__oprnEditorStore.getCurrent().database.skills.find((s) => s.id === id)?.retroChoreographyId, skillId);
results.pickerStatus = await tid("db-skill-retro-picker-status").textContent();
await p.evaluate(() => document.querySelector("[data-testid='db-skill-retro-picker-status']")?.scrollIntoView({ block: "center" }));
await wait(600);
await shot("d2-skill-picker-picked.png");

// e) preview_choreography 이미지
const e = await p.evaluate(async (id) => {
  const tools = await import("/src/editor/tools/retroChoreographyTools.ts");
  const mod = await import("/src/assets/retroChoreographyPreviewImage.ts");
  const tool = tools.RETRO_CHOREOGRAPHY_TOOLS.find((t) => t.name === "preview_choreography");
  const res = await tool.run(window.__oprnEditorStore.getCurrent(), { id });
  const imgs = await mod.retroChoreographyPreviewImages(res.data);
  return { summary: res.summary, data: res.data, images: imgs.map((i) => ({ label: i.label, dataUrl: i.dataUrl })) };
}, newId);
results.previewSummary = e.summary; results.previewLayers = e.data.layers;
e.images.forEach((im, i) => {
  fs.writeFileSync(path.join(OUT, `e-preview-choreography-${i}.png`), Buffer.from(im.dataUrl.split(",")[1], "base64"));
  results[`previewImage${i}`] = im.label;
});
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
