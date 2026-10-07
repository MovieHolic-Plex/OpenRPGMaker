#!/usr/bin/env node
// 편집기에서 jp_city 실내가 실제로 깔리는지 — 사람 손 경로 그대로.
//   자료집 → 장소 → 공용 → 「일본 2층 단독주택」 카드 → 「맵에 놓기」 → 1층·2층 두 맵 + 계단 이동이 생기는지,
//   두 층을 맵 목록에서 열어 편집 화면에 그려지는지, 자료집 → 오브젝트에서 일본 실내 가구가 방 분류(부제)로 보이는지.
//
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/editor-place.probe.mjs http://127.0.0.1:9928'
//
// 원격 쓰기는 막는다. blankProject 세션이라 정본 저장 증거가 아니다 — 코드(가져오기·갤러리) 검증용이다.
// 증거: verify-shots/jp-city/editor/{SUMMARY.md, *.png, proof.json}
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:9928";
const out = "verify-shots/jp-city/editor";
fs.mkdirSync(out, { recursive: true });
const PLACE = "jp-city-house-interior-21x15";
const APT = "jp-city-apartment-1k-12x13";

const browser = await chromium.launch({ args: ["--disable-features=NetworkService,NetworkServiceInProcess", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

async function openPlaces() {
  await openWorldTab("db-tab-spatial-places");
  await page.getByTestId("place-filter-search").fill("일본");
  await page.waitForTimeout(800);
}
async function openWorldTab(testid) {
  if (!(await page.getByTestId("db-group-strip-world").isVisible().catch(() => false))) await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-group-strip-world").click();
  await page.getByTestId(testid).click();
}
async function closeDatabase() {
  await page.keyboard.press("Escape");
  if (await page.getByTestId("db-group-strip-world").isVisible().catch(() => false)) await page.getByRole("button", { name: "닫기" }).last().click();
}
const maps = () => page.evaluate(() => {
  const p = window.__oprnEditorStore.getCurrent();
  return Object.values(p.maps).map((m) => ({ id: m.id, name: m.name, w: m.width, h: m.height, tileset: m.tilesetId,
    painted: m.lowerTiles.filter((t) => t >= 0).length,
    events: (m.events ?? []).map((e) => `${e.name}@${e.x},${e.y}`),
    transfers: JSON.stringify(m.events ?? []).match(/"mapId":"[^"]+"/g) ?? [] }));
});
async function place(id) {
  const card = page.getByTestId(`spatial-card-region-reference:${id}`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const before = (await maps()).length;
  await page.getByTestId("spatial-cell-build").first().click();
  await page.waitForFunction((n) => Object.keys(window.__oprnEditorStore.getCurrent().maps).length > n, before);
  await page.waitForTimeout(500);
}
async function showMap(mapId, file) {
  if (!(await page.getByTestId("map-tree").isVisible().catch(() => false))) await page.getByTestId("sidebar-maps").click();
  const node = page.getByTestId(`map-tree-node-${mapId}`);
  await node.scrollIntoViewIfNeeded();
  await node.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${file}` });
}

try {
  await page.route("**/*", (route) => {
    const r = route.request();
    return !["GET", "HEAD", "OPTIONS"].includes(r.method()) && /\/rest\/v1\/|\/rpc\//.test(r.url()) ? route.abort() : route.continue();
  });
  await page.addInitScript(() => {
    for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(k, "1");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__oprnEditorStore);

  // ① 장소 카드 → 맵에 놓기 (집: 1·2층)
  await openPlaces();
  await page.screenshot({ path: `${out}/01-places-tab.png` });
  await place(PLACE);
  await page.screenshot({ path: `${out}/02-house-placed.png` });
  const house = (await maps()).filter((m) => m.id.startsWith(`preset:${PLACE}`));
  log(`집 가져오기 → 맵 ${house.length}장: ${house.map((m) => `${m.id}(${m.w}×${m.h}, 칠한 칸 ${m.painted}, 이벤트 ${m.events.join(" ")}, 이동 ${m.transfers.join(" ")})`).join(" / ")}`);
  assert.equal(house.length, 2, "1층·2층 두 맵");
  const [f1, f2] = house;
  assert.ok(f1.transfers.some((t) => t.includes(f2.id)), "1층 계단 → 2층");
  assert.ok(f2.transfers.some((t) => t.includes(f1.id)), "2층 계단통 → 1층");
  assert.ok(house.every((m) => m.tileset === "jp_city" && m.painted > 0), "jp_city 로 칠해짐");

  // ② 원룸 한 장
  await place(APT);
  const apt = (await maps()).filter((m) => m.id.startsWith(`preset:${APT}`));
  log(`원룸 가져오기 → 맵 ${apt.length}장: ${apt.map((m) => `${m.id}(${m.w}×${m.h})`).join(" ")}`);
  assert.equal(apt.length, 1);

  // ③ 맵 목록에서 열어 편집 화면에 그려지는지
  await closeDatabase();
  await showMap(f1.id, "03-editor-house-1f.png");
  await showMap(f2.id, "04-editor-house-2f.png");
  await showMap(apt[0].id, "05-editor-apartment.png");
  const current = await page.evaluate(() => document.querySelector("canvas") !== null);
  assert.ok(current, "편집 캔버스");

  // ④ 오브젝트 라이브러리 — 일본 실내 가구가 공용 + 방 분류
  await openWorldTab("db-tab-spatial-objects");
  await page.getByTestId("spatial-browser-search").fill("일본 실내");
  await page.waitForTimeout(800);
  const objCards = await page.locator("[data-testid^='spatial-card-tileset-kit/jp_city/jp-in-']").evaluateAll((els) =>
    els.map((el) => ({ source: el.dataset.source, text: el.innerText.replace(/\s+/g, " ").trim() })));
  await page.screenshot({ path: `${out}/06-objects-jp-interior.png` });
  const total = await page.locator(".asset-browser-count").innerText();
  log(`오브젝트 「일본 실내」 검색: ${total}, 첫 쪽 ${objCards.length}장 — ${objCards.slice(0, 6).map((c) => `${c.text}[${c.source}]`).join(" | ")}`);
  assert.ok(objCards.length > 0 && objCards.every((c) => c.source === "default" && c.text.includes("일본 실내 · ")), "공용 + 방 분류 부제");
  await page.getByTestId("spatial-browser-search").fill("계단");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/07-objects-stairs.png` });

  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/proof.json`, JSON.stringify({ base, house, apt, objectCards: objCards, errors }, null, 2));
  fs.writeFileSync(`${out}/SUMMARY.md`, `# 편집기에서 일본 실내 깔기 (${new Date().toISOString()})\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\n즉시 확인: 03-editor-house-1f.png · 04-editor-house-2f.png · 06-objects-jp-interior.png\n`);
  console.log("PASS");
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  console.log((await page.locator("body").innerText().catch(() => "")).slice(-1500));
  throw e;
} finally {
  await browser.close();
}
