/**
 * 스튜디오 오버레이 드로워 캡처 — 닫힘(맵이 세로를 다 쓴다) → 열기(새 레인·도구) → Esc 닫기 → 레인 흐름.
 *
 *   BASE=http://127.0.0.1:<내 워크트리 포트> OUT=output/evidence/studio-drawer/qa node scripts/capture-studio-drawer.mjs
 *   VIEWPORTS=1600x900,1024x768   (기본값)
 *
 * 맵 기하는 드로워를 여닫아도 변하지 않아야 한다 — 열림/닫힘 각각에서 모니터 스테이지 rect 를 재서 보고한다.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9841";
const OUT = process.env.OUT ?? "/tmp/studio-drawer-shots";
const VIEWPORTS = (process.env.VIEWPORTS ?? "1600x900,1024x768").split(",").map((v) => v.split("x").map(Number));
const RUN_DELAY_MS = Number(process.env.RUN_DELAY_MS ?? 1100);
await mkdir(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function laneBody(body) {
  const project = structuredClone(body.project);
  const mapIds = Array.isArray(body.mapIds) ? body.mapIds : [];
  for (const id of mapIds) if (project.maps?.[id]) project.maps[id].name = project.maps[id].name + " (AI)";
  const lines = [
    { type: "start", provider: body.provider, model: body.model, toolCount: 12 },
    { type: "turn", index: 1 },
    { type: "tool_start", id: "t1", name: "get_map_region", args: { mapId: mapIds[0] ?? null, w: 40, h: 30 } },
    { type: "tool_end", id: "t1", name: "get_map_region", ok: true, summary: "40x30 바위 71%" },
    { type: "assistant", text: "길을 냈습니다." },
    { type: "done", project, stats: { ms: RUN_DELAY_MS, turns: 2, toolCalls: 2, toolErrors: 0 }, changedKeys: mapIds.map((id) => "maps." + id) },
  ];
  return lines.map((line) => JSON.stringify(line) + "\n").join("");
}

const browser = await chromium.launch({ headless: true });
const report = [];

for (const pair of VIEWPORTS) {
  const w = pair[0], h = pair[1];
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_REFUSED")) errors.push(m.text().slice(0, 180)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
  await page.route("**/v1/agent/run**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await sleep(RUN_DELAY_MS);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: laneBody(body) });
  });
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  const tag = w + "x" + h;
  const shot = (name) => page.screenshot({ path: path.join(OUT, tag + "-" + name + ".png") });
  const state = () => page.evaluate(() => {
    const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const deck = document.querySelector("[data-testid=ai-studio-deck]");
    const clipped = [];
    for (const sel of ["[data-testid=ai-studio-tab-newLane]", "[data-testid=ai-studio-tab-tools]", ".ai-studio-drawer-handle", "[data-testid=lane-create]"]) {
      for (const e of document.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > window.innerWidth + 1 || r.left < -1 || r.bottom > window.innerHeight + 1 || r.top < -1) clipped.push(sel);
      }
    }
    return {
      shellClass: document.querySelector("[data-testid=ai-studio-shell]") ? document.querySelector("[data-testid=ai-studio-shell]").className : "",
      deckClass: deck ? deck.className : "",
      deckRect: rect("[data-testid=ai-studio-deck]"),
      stage: rect("[data-testid=ai-studio-monitor-stage]"),
      handle: rect("[data-testid=ai-studio-deck-handle]"),
      laneForm: Boolean(document.querySelector("[data-testid=lane-form]")),
      agents: document.querySelectorAll("[data-testid=ai-studio-agent-row]").length,
      laneThread: Boolean(document.querySelector("[data-testid=lane-thread]")),
      mapName: (document.querySelector("[data-testid=ai-studio-monitor-label]") || {}).textContent ?? "",
      clipped,
    };
  });

  let booted = false;
  for (let attempt = 0; attempt < 5 && !booted; attempt++) {
    try {
      await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90000 });
      const guest = page.getByTestId("login-guest");
      if (await guest.isVisible().catch(() => false)) await guest.click();
      await page.waitForTimeout(1100);
      booted = true;
    } catch (error) { console.log("attempt " + attempt + ": " + String(error).slice(0, 100)); }
  }
  if (!booted) { report.push({ viewport: tag, booted: false }); await page.close(); continue; }

  await page.getByTestId("topbar-ai-studio").click();
  await page.waitForTimeout(900);

  const closed = await state();
  await shot("01-drawer-closed");

  await page.getByTestId("ai-studio-deck-handle").click();
  await page.waitForTimeout(500);
  const openNewLane = await state();
  await shot("02-drawer-newlane");

  await page.getByTestId("ai-studio-tab-tools").click();
  await page.waitForTimeout(400);
  const openTools = await state();
  await shot("03-drawer-tools");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const afterEscape = await state();
  await shot("04-after-escape");

  await page.getByTestId("ai-studio-new-lane").click();
  await page.waitForTimeout(400);
  await page.getByTestId("lane-agent").fill("시공A");
  await page.getByTestId("lane-instruction").fill("동쪽 숲에 오두막 가는 길을 내고 나무를 정리해");
  await page.waitForTimeout(150);
  await page.getByTestId("lane-create").click();
  await page.waitForTimeout(350);
  const running = await state();
  await shot("05-lane-running");
  await page.waitForTimeout(RUN_DELAY_MS + 800);
  const review = await state();
  await shot("06-lane-review");

  report.push({ viewport: tag, closed, openNewLane, openTools, afterEscape, running, review, errors: errors.slice(0, 5) });
  console.log(tag + ": closed=" + closed.deckClass.includes("is-collapsed") + " openForm=" + openNewLane.laneForm + " afterEsc=" + afterEscape.deckClass.includes("is-collapsed") + " stage " + JSON.stringify(closed.stage) + " -> " + JSON.stringify(openTools.stage) + " clipped=" + openTools.clipped.length + " agents=" + review.agents);
  await page.close();
}

await browser.close();
await writeFile(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
console.log("report -> " + path.join(OUT, "capture-report.json"));
