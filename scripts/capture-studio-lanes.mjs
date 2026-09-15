/**
 * 에이전트 레인 스튜디오 표면 캡처 — 레인 탭 · 새 레인 폼 · 실행 중 · 검토 · 레인 하나만 적용.
 *
 *   BASE=http://127.0.0.1:<내 워크트리 포트> OUT=output/evidence/studio-agent-lanes/qa node scripts/capture-studio-lanes.mjs
 *   VIEWPORTS=1600x900,1440x900,1280x800,1024x768   (기본값)
 *
 * 포트를 반드시 내 트리의 dev 서버로 박아라 — 남의 워크트리 서버를 찍으면 다른 브랜치를 근거로 쓰게 된다
 * (openwiki/testing.md). Pi 실행은 `page.route` 로 스텁한다: 워커가 없어도 UI 흐름(실행 중 → 검토 →
 * 적용)은 실제 표면을 그대로 지나간다. 스텁이 돌려주는 프로젝트는 요청 사본에 이름 한 줄을 더한 것이라
 * 적용하면 스토어에 실제 diff 가 생긴다.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9841";
const OUT = process.env.OUT ?? "/tmp/studio-lane-shots";
const VIEWPORTS = (process.env.VIEWPORTS ?? "1600x900,1440x900,1280x800,1024x768").split(",").map((v) => v.split("x").map(Number));
const RUN_DELAY_MS = Number(process.env.RUN_DELAY_MS ?? 1400);
await mkdir(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function laneResponse(body) {
  const project = structuredClone(body.project);
  const mapIds = Array.isArray(body.mapIds) ? body.mapIds : [];
  for (const id of mapIds) {
    if (project.maps?.[id]) project.maps[id].name = `${project.maps[id].name} (AI)`;
  }
  const lines = [
    { type: "start", provider: body.provider, model: body.model, toolCount: 12 },
    { type: "turn", index: 1 },
    { type: "tool_start", id: "t1", name: "get_map_region", args: { mapId: mapIds[0] ?? null, w: 40, h: 30 } },
    { type: "tool_end", id: "t1", name: "get_map_region", ok: true, summary: "40×30 · 바위 71%" },
    { type: "tool_start", id: "t2", name: "paint_tiles", args: { mapId: mapIds[0] ?? null, tile: "dirt", count: 24 } },
    { type: "tool_end", id: "t2", name: "paint_tiles", ok: true, summary: "흙길 24칸" },
    { type: "assistant", text: "길을 냈습니다. 잔해는 입구 앞 3칸만 남겼습니다." },
    { type: "done", project, stats: { ms: RUN_DELAY_MS, turns: 2, toolCalls: 2, toolErrors: 0 }, changedKeys: mapIds.map((id) => `maps.${id}`) },
  ];
  return lines.map((line) => `${JSON.stringify(line)}\n`).join("");
}

const browser = await chromium.launch({ headless: true });
const report = [];

for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 240)));

  await page.route("**/v1/agent/run**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await sleep(RUN_DELAY_MS);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: laneResponse(body) });
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  let booted = false;
  for (let attempt = 0; attempt < 5 && !booted; attempt++) {
    try {
      await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
      const guest = page.getByTestId("login-guest");
      if (await guest.isVisible().catch(() => false)) await guest.click();
      await page.waitForFunction(() => {
        const c = document.querySelector("[data-testid=edit-canvas] canvas");
        return c && c.width > 100;
      }, null, { timeout: 60_000 });
      booted = true;
    } catch (e) { console.log(`attempt ${attempt} failed: ${String(e).slice(0, 140)}`); }
  }
  if (!booted) { report.push({ viewport: `${w}x${h}`, booted: false }); await page.close(); continue; }

  await page.waitForTimeout(1200);
  await page.getByTestId("topbar-ai-studio").click();
  await page.waitForTimeout(1200);
  const tag = `${w}x${h}`;
  const shot = async (name, options = {}) => {
    await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), ...options });
  };

  await page.getByTestId("ai-studio-tab-lanes").click();
  await page.waitForTimeout(300);
  await shot("01-lanes-idle");

  // 맵 둘 — 레인 둘을 다른 묶음에 세우기 위해서.
  await page.getByTestId("ai-studio-scene-add").click();
  await page.waitForTimeout(600);

  // 장면을 더한 뒤에는 덱이 다시 그려져야 새 맵 칩이 생긴다 — 탭을 한 번 돌려 강제한다.
  await page.getByTestId("ai-studio-tab-activity").click();
  await page.waitForTimeout(250);
  await page.getByTestId("ai-studio-tab-lanes").click();
  await page.waitForTimeout(250);
  const chips = page.getByTestId("lane-map-chip");
  const chipCount = await chips.count();
  const rowCount = async () => page.getByTestId("lane-row").count();
  const fillForm = async (agent, instruction) => {
    await page.getByTestId("lane-agent").fill(agent);
    await page.getByTestId("lane-instruction").fill(instruction);
    await page.waitForTimeout(200);
  };

  // 음 A = 첫 맵 (폼 기본값), 실행 중 → 검토.
  await fillForm("시공A", "동쪽 숲에 오두막 가는 길을 내고 나무를 정리해");
  await shot("02-lane-form");
  await page.getByTestId("lane-create").click();
  await page.waitForTimeout(350);
  await shot("03-lane-running");
  await page.waitForTimeout(RUN_DELAY_MS + 600);
  await shot("04-lane-review");
  if ((await rowCount()) !== 1) throw new Error(`레인 A 생성 실패 — 행 ${await rowCount()}개`);

  // 음 B = 둘째 맵 — 칩을 바꿔 끼운다(각 클릭 뒤 렌더를 기다려야 다음 칩이 산다).
  if (chipCount > 1) {
    await chips.nth(0).click();
    await page.waitForTimeout(300);
    await chips.nth(1).click();
    await page.waitForTimeout(300);
    await fillForm("시공B", "항구 마을에 부두 옆 시장 5노점을 세워");
    await page.getByTestId("lane-create").click();
    await page.waitForTimeout(RUN_DELAY_MS + 800);
    if ((await rowCount()) !== 2) throw new Error(`레인 B 생성 실패 — 행 ${await rowCount()}개`);
  }
  await shot("05-two-lanes-review");

  // 레인 A 만 적용 — 레인 B 는 그대로 남아야 한다(이 설계의 핵심).
  const applyButtons = page.getByTestId("lane-apply");
  const applies = await applyButtons.count();
  if (applies > 0) {
    await applyButtons.nth(0).click();
    await page.waitForTimeout(1400);
  }
  await shot("06-apply-one-keeps-other");

  // 행 클릭은 표가 스크롤·재렌더 중이면 놓칠 수 있다 — 07 은 보조 컷이라 실패해도 런을 죽이지 않는다.
  await page.locator('[data-testid=lane-row][data-status="review"]').first()
    .click({ timeout: 8000 })
    .catch((error) => console.log("07 row click skipped:", String(error).slice(0, 80)));
  await page.waitForTimeout(400);
  await shot("07-lane-inspector");

  const state = await page.evaluate(() => {
    const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const overflow = [];
    for (const e of document.querySelectorAll(".ai-lane-board *, .ai-lane-inspector *")) {
      if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0) {
        overflow.push({ cls: e.className?.toString().slice(0, 60), sw: e.scrollWidth, cw: e.clientWidth });
      }
    }
    return {
      rows: [...document.querySelectorAll("[data-testid=lane-row]")].map((row) => ({
        laneId: row.dataset.laneId,
        status: row.dataset.status,
        text: row.textContent?.slice(0, 120),
      })),
      sceneChips: [...document.querySelectorAll("[data-testid=ai-studio-lane-chip]")].map((chip) => ({ status: chip.dataset.status, text: chip.textContent })),
      notice: document.querySelector("[data-testid=lane-notice]")?.textContent ?? null,
      inspector: document.querySelector("[data-testid=lane-inspector]") ? document.querySelector("[data-testid=lane-inspector]").textContent?.slice(0, 200) : null,
      board: rect("[data-testid=lane-board]"),
      deck: rect("[data-testid=ai-studio-deck]"),
      pane: rect("[data-testid=ai-studio-deck-pane]"),
      split: rect(".ai-studio-lane-split"),
      overflow: overflow.slice(0, 8),
      mapCount: document.querySelectorAll("[data-testid=ai-studio-scene]").length,
    };
  });
  report.push({ viewport: tag, state, errors: errors.slice(0, 6) });
  console.log(`${tag}: rows=${state.rows.map((r) => r.status).join(",")} notice=${state.notice ?? "—"} chips=${state.sceneChips.length} overflow=${state.overflow.length}`);
  await page.close();
}

await browser.close();
await writeFile(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
console.log(`report → ${path.join(OUT, "capture-report.json")}`);
