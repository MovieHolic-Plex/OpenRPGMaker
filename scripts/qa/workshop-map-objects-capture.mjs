// 공방 「맵 기물」을 모델 없이 끝까지 돈다: 새 기물 정의(지금 맵 칩셋 팔레트) → 후보 → 고르기 → 그 칩셋에 굽기.
// window.__oprnWorkshopChat 가짜 채팅(dev 빌드 전용)이 c:N 팔레트 키로 격자와 검수 답을 낸다.
// BASE=http://127.0.0.1:<포트> node scripts/qa/workshop-map-objects-capture.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9803";
const out = resolve("verify-shots/workshop-map-objects");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(180_000);
const errors = [];
const shots = [];
const facts = [];
page.on("pageerror", (error) => errors.push(error.message));
const shot = async (name, note) => { await page.screenshot({ path: resolve(out, `${name}.png`) }); shots.push({ name, note }); };

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  window.__oprnWorkshopChat = async (surface, request) => {
    await new Promise((r) => setTimeout(r, 200));
    const text = JSON.stringify(request.messages);
    window.__mapObjectsPrompts = [...(window.__mapObjectsPrompts ?? []), { surface, images: (text.match(/data:image\/png/g) ?? []).length, chipset: /칩셋: ([^\\"]+)/.exec(text)?.[1] ?? null }];
    if (surface === "workshop-review") return JSON.stringify({ verdict: "PASS", codes: [], top: "윗면 3행", top_rows: 3, reasons: "칩셋과 같은 결", fix: "", worse: false });
    const m = /캔버스 (\d+)×(\d+)px/.exec(text);
    const w = Number(m?.[1] ?? 16), h = Number(m?.[2] ?? 16);
    const pad = Number(/맨 위 (\d+)줄은 비운다/.exec(text)?.[1] ?? 0);
    const keys = [...new Set([...text.matchAll(/(c:\d+) #/g)].map((x) => x[1]))];
    const dark = keys[0] ?? "c:0", mid = keys[Math.floor(keys.length / 2)] ?? dark, light = keys[keys.length - 2] ?? mid;
    const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
      if (y < pad || x < 2 || x >= w - 2) return ".";
      if (y < pad + 4) return x === 2 || x === w - 3 ? "o" : "t";
      return x === 2 || x === w - 3 || y === h - 1 ? "o" : "f";
    }).join(""));
    return JSON.stringify({ legend: { t: light, f: mid, o: dark }, rows, note: "가짜 돌 이정표", topRows: 4 });
  };
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByTestId("sidebar-workshop").click();
  await page.getByTestId("left-workshop-pane").waitFor();
  await shot("01-left-pane", "왼쪽 막대 「공방」 — 맵 기물이 보인다");
  await page.getByTestId("left-workshop-open-map-objects").click();
  await page.getByTestId("workshop").waitFor();
  await page.getByTestId("workshop-new-item").click();
  const form = page.getByTestId("workshop-item-form");
  await form.waitFor();
  await page.waitForFunction(() => !/읽는 중/.test(document.querySelector('[data-testid="workshop-form-target"]')?.textContent ?? ""));
  facts.push(`폼 대상: ${await page.getByTestId("workshop-form-target").textContent()}`);
  await form.locator("input").first().fill("돌 이정표");
  await form.locator("textarea").fill("이끼 낀 돌 이정표, 위에 작은 등불");
  await shot("02-form", "새 기물 폼 — 지금 맵 칩셋 이름");
  await page.getByTestId("workshop-item-save").click();
  await page.getByTestId("workshop-start-round").waitFor();
  await page.getByTestId("workshop-start-round").click();
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('[data-testid="workshop-card"]')];
    return cards.length > 0 && cards.every((card) => ["done", "failed"].includes(card.getAttribute("data-status")));
  });
  await shot("03-round-done", "후보 3장(칩셋 팔레트 색)");
  await page.keyboard.press("1");
  await page.keyboard.press("Enter");
  await page.getByTestId("workshop-bake").waitFor();
  const tilesetId = await page.evaluate(async () => {
    const project = window.__oprnEditorStore?.getCurrent?.();
    const target = document.querySelector(".workshop-bake")?.textContent ?? "";
    const entry = Object.entries(project?.tilesets ?? {}).find(([, t]) => target.includes(`「${t.name}」`));
    return { id: entry?.[0], count: entry?.[1]?.tileGrafts?.length ?? 0, label: target };
  });
  facts.push(`굽기 전 칩셋 ${tilesetId.id} 이식 ${tilesetId.count}칸`);
  await page.getByTestId("workshop-bake").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="workshop-bake"]')?.hasAttribute("disabled"));
  const after = await page.evaluate((id) => {
    const tileset = window.__oprnEditorStore?.getCurrent?.().tilesets?.[id];
    return { count: tileset?.tileGrafts?.length ?? 0, kits: (tileset?.structureKits ?? []).filter((k) => k.learnedFrom === "workshop").map((k) => `${k.id} ${k.width}×${k.height}`) };
  }, tilesetId.id);
  facts.push(`굽기 뒤 이식 ${after.count}칸, 공방 물체 ${after.kits.join(", ")}`);
  facts.push(`모델 호출: ${JSON.stringify(await page.evaluate(() => window.__mapObjectsPrompts))}`);
  await shot("04-baked", "고른 후보를 그 칩셋에 넣음");
} finally {
  writeFileSync(resolve(out, "SUMMARY.md"), [
    "# 공방 「맵 기물」 캡처 (가짜 모델)", "",
    `- 기준: ${base}`, `- 페이지 오류: ${errors.length ? errors.join(" / ") : "없음"}`, "",
    ...facts.map((f) => `- ${f}`), "",
    ...shots.map((s) => `- \`${s.name}.png\` — ${s.note}`), "",
    "즉시 확인: 03-round-done.png, 04-baked.png",
  ].join("\n"));
  await browser.close();
}
if (errors.length) process.exitCode = 1;
