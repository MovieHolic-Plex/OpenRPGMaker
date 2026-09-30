// 스킬 탭 「도트 연출」 고르기 증거 촬영. 사용: npm run dev:worktree (9807) 를 띄운 뒤
//   node scripts/capture-retro-picker.mjs [baseUrl]
// 결과: verify-shots/retro-assistant/editor-*.png + editor-results.json
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:9807";
const OUT = path.resolve("verify-shots/retro-assistant");
fs.mkdirSync(OUT, { recursive: true });
const results = {};
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await p.goto(`${BASE}/?freshProject=1`);
await p.waitForSelector("[data-testid='edit-canvas']", { timeout: 90000 });
await p.waitForTimeout(2000);
p.on("pageerror", (e) => console.log("PAGEERROR", e.message, (e.stack || "").split("\n").slice(0, 4).join(" | "))); p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
const wait = (ms = 700) => p.waitForTimeout(ms);
const tid = (id) => p.locator(`[data-testid="${id}"]`);
const shot = (name, sel) => (sel ? tid(sel).first() : p).screenshot({ path: path.join(OUT, name), timeout: 120000, animations: "disabled" });
const jsClick = (id) => p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`).click(), id);
const center = async (id) => { await p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.scrollIntoView({ block: "center" }), id); await wait(400); };

// 계약이 없는 새 스킬: 기본 스킬을 복제해 연출 빌림을 지우면 기본 베기 연출로 돌아간다.
const cloneId = await p.evaluate(async () => {
  const { duplicateDatabaseRecord } = await import("/src/editor/databaseActions.ts");
  const { updateDatabaseRecord } = await import("/src/editor/databaseActions.ts");
  const id = duplicateDatabaseRecord("skills", "skill_attack");
  // 복제는 원본 연출을 빌려 오므로, 「계약이 없는 새 스킬」 상태로 되돌린다.
  updateDatabaseRecord("skills", id, { retroChoreographyId: undefined, name: "새 스킬" });
  return id;
});
results.cloneId = cloneId;

await tid("toolbar-database").click();
await tid("database-modal").waitFor({ timeout: 30000 }).catch(async (e) => { await p.screenshot({ path: "/tmp/dbfail.png" }); console.log(await p.evaluate(() => document.body.innerText.slice(0, 600))); throw e; });
await wait(1200);
await jsClick("db-tab-skills");
await wait(2200);
await p.evaluate(() => {
  const input = [...document.querySelectorAll("input[type=search]")].find((i) => i.placeholder === "이름 또는 ID 검색");
  input.value = "새 스킬";
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await wait(900);
await p.locator(`[data-record-id="${cloneId}"].db-list-row`).click({ timeout: 8000 }).catch(async (e) => { console.log(await p.evaluate(() => [...document.querySelectorAll(".db-list-row")].slice(0, 8).map((r) => r.dataset.recordId + " " + r.textContent.slice(0, 30)).concat([String([...document.querySelectorAll(".db-list-row")].map((r) => r.dataset.recordId).slice(-3)), String(document.querySelectorAll(".db-list-row").length), document.querySelector("[data-testid=database-modal]")?.innerText.slice(0,200)]))); throw e; });
await wait(1500);
await center("db-skill-retro-picker");
const state = () => p.evaluate(async (id) => {
  const s = window.__oprnEditorStore.getCurrent().database.skills.find((x) => x.id === id);
  const stage = document.querySelector('[data-testid="db-skill-retro-stage"]');
  return {
    retroChoreographyId: s?.retroChoreographyId ?? null,
    status: document.querySelector('[data-testid="db-skill-retro-picker-status"]')?.textContent,
    motion: stage?.dataset.motion ?? null,
    layers: [...document.querySelectorAll('[data-testid="db-skill-retro-layer"]')].map((n) => n.dataset.key),
  };
}, cloneId);
results.before = await state();
await shot("editor-picker-before.png", "db-skill-retro-picker");
await center("db-skill-retro-stage");
await shot("editor-preview-before.png", "db-skill-retro-preview");

// 필터: 모션 = 돌진 베기, 속성 = 불 -> 목록에서 첫 후보 선택
const optionValues = async (id) => p.evaluate((x) => [...document.querySelector(`[data-testid="${x}"]`).options].map((o) => o.value + "|" + o.textContent), id);
results.motionOptions = (await optionValues("db-skill-retro-picker-motion")).slice(0, 12);
await center("db-skill-retro-picker");
await tid("db-skill-retro-picker-motion").selectOption("dash-strike");
await wait(300);
await tid("db-skill-retro-picker-element").selectOption("fire");
await wait(300);
results.countAfterFilter = await tid("db-skill-retro-picker-count").textContent();
await shot("editor-picker-filtered.png", "db-skill-retro-picker");
const firstValue = await p.evaluate(() => [...document.querySelector('[data-testid="db-skill-retro-picker-list"]').options].find((o) => o.value)?.value);
results.picked = firstValue;
await tid("db-skill-retro-picker-list").selectOption(firstValue);
await wait(1500);
await center("db-skill-retro-picker");
results.after = await state();
await shot("editor-picker-after.png", "db-skill-retro-picker");
await center("db-skill-retro-stage");
await jsClick("db-skill-retro-play");
await wait(350);
await shot("editor-preview-playing.png", "db-skill-retro-preview");
results.playing = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="db-skill-retro-stage"]');
  return { running: s?.dataset.running, pose: s?.dataset.retroPose, motion: s?.dataset.motion, time: document.querySelector('[data-testid="db-skill-retro-time"]')?.textContent };
});
fs.writeFileSync(path.join(OUT, "editor-results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
