/**
 * 스튜디오 3분할 표면 캡처 — 좌: 조수 실시간 활동 + 채팅 목록 / 중앙: 맵 / 우: 지금 보는 채팅.
 *
 *   BASE=http://127.0.0.1:<내 워크트리 포트> OUT=output/evidence/studio-3col/qa node scripts/capture-studio-3col.mjs
 *   VIEWPORTS=1600x900,1440x900,1280x800,1024x768   (기본값)
 *
 * Pi 실행은 `page.route` 로 스텁한다 — 워커가 없어도 UI 흐름(실행 중 → 검토 → 적용)은 실제 표면을 지난다.
 * 스텁이 돌려주는 프로젝트는 요청 사본의 맵 이름 한 줄을 바꾼 것이라 적용하면 스토어에 실제 diff 가 생긴다.
 * `loads` 카운터를 함께 보고한다: 장면 추가가 문서를 다시 적재하면(=loads 증가) 레인 세션이 날아가므로,
 * 그 사실 자체가 QA 결과다.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9841";
const OUT = process.env.OUT ?? "/tmp/studio-3col-shots";
const VIEWPORTS = (process.env.VIEWPORTS ?? "1600x900,1440x900,1280x800,1024x768").split(",").map((v) => v.split("x").map(Number));
const RUN_DELAY_MS = Number(process.env.RUN_DELAY_MS ?? 1200);
await mkdir(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function laneBody(body) {
  const project = structuredClone(body.project);
  const mapIds = Array.isArray(body.mapIds) ? body.mapIds : [];
  for (const id of mapIds) if (project.maps?.[id]) project.maps[id].name = `${project.maps[id].name} (AI)`;
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
  let loads = 0;
  page.on("load", () => { loads += 1; });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_REFUSED")) errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 240)));

  await page.route("**/v1/agent/run**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await sleep(RUN_DELAY_MS);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: laneBody(body) });
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  const openStudio = async () => {
    if (await page.locator('[data-testid="ai-studio-shell"]').count() > 0) return;
    await page.getByTestId("topbar-ai-studio").click();
    await page.waitForTimeout(900);
  };

  let booted = false;
  for (let attempt = 0; attempt < 5 && !booted; attempt++) {
    try {
      await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
      const guest = page.getByTestId("login-guest");
      if (await guest.isVisible().catch(() => false)) await guest.click();
      await page.waitForTimeout(1200);
      booted = true;
    } catch (error) { console.log(`attempt ${attempt}: ${String(error).slice(0, 120)}`); }
  }
  if (!booted) { report.push({ viewport: `${w}x${h}`, booted: false }); await page.close(); continue; }

  const tag = `${w}x${h}`;
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  const snapshot = () => page.evaluate(() => ({
    left: Boolean(document.querySelector("[data-testid=ai-studio-left]")),
    agents: document.querySelectorAll("[data-testid=ai-studio-agent-row]").length,
    agentText: [...document.querySelectorAll("[data-testid=ai-studio-agent-row]")].map((r) => r.textContent?.slice(0, 90)),
    threads: [...document.querySelectorAll("[data-testid=ai-studio-threads] button")].map((b) => b.textContent?.slice(0, 40)),
    chatClass: document.querySelector("[data-testid=ai-studio-chat]")?.className ?? "",
    laneThread: Boolean(document.querySelector("[data-testid=lane-thread]")),
    deckTab: document.querySelector(".ai-studio-tab.is-on")?.textContent?.slice(0, 12) ?? "",
    maps: document.querySelectorAll("[data-testid=ai-studio-scene]").length,
  }));

  await openStudio();
  await page.waitForTimeout(700);
  await shot("01-three-column");
  const idle = await snapshot();

  // 장면을 **먼저** 만든다 — 레인이 출발한 뒤에 장면을 더하면 그 맵이 레인 묶음에 들어가
  // 다음 적용이 «이 묶음이 도는 동안 바뀌었다» 로 거절된다(2026-09-16 실측).
  // 장면 하나 더 — 이 클릭이 문서를 다시 적재하는지 본다(loads).
  const loadsBefore = loads;
  await page.getByTestId("ai-studio-scene-add").click();
  await page.waitForTimeout(1500);
  const sceneAddReloaded = loads > loadsBefore;
  if (sceneAddReloaded) { await openStudio(); await page.waitForTimeout(700); }

  // 레인 A — 첫 맵.
  await page.getByTestId("ai-studio-tab-lanes").click();
  await page.waitForTimeout(250);
  await page.getByTestId("lane-agent").fill("시공A");
  await page.getByTestId("lane-instruction").fill("동쪽 숲에 오두막 가는 길을 내고 나무를 정리해");
  await page.waitForTimeout(150);
  await page.getByTestId("lane-create").click();
  await page.waitForTimeout(300);
  await shot("02-lane-running");
  const running = await snapshot();
  await page.waitForTimeout(RUN_DELAY_MS + 700);
  await shot("03-lane-review");

  // 레인 B — 둘째 맵.
  await page.getByTestId("ai-studio-tab-lanes").click().catch(() => undefined);
  await page.waitForTimeout(250);
  const chips = page.getByTestId("lane-map-chip");
  const chipCount = await chips.count();
  if (chipCount > 1) {
    await chips.nth(0).click();
    await page.waitForTimeout(300);
    await chips.nth(1).click();
    await page.waitForTimeout(300);
    await page.getByTestId("lane-agent").fill("시공B");
    await page.getByTestId("lane-instruction").fill("항구 마을에 부두 옆 시장 5노점을 세워");
    await page.waitForTimeout(150);
    await page.getByTestId("lane-create").click();
    await page.waitForTimeout(RUN_DELAY_MS + 900);
  }
  await shot("04-two-lanes");
  const twoLanes = await snapshot();

  // 오른쪽 열이 그 레인 스레드로 바뀌는지.
  const threadButtons = page.locator("[data-testid=ai-studio-threads] button");
  if ((await threadButtons.count()) > 1) {
    await threadButtons.nth(1).click();
    await page.waitForTimeout(400);
  }
  await shot("05-lane-thread");
  const laneThread = await snapshot();

  // 좌 레일에서 바로 적용 — 레인 하나만 적용되고 다른 레인은 그대로인지.
  const applyButtons = page.getByTestId("agent-row-apply");
  if ((await applyButtons.count()) > 0) {
    await applyButtons.nth(0).click();
    await page.waitForTimeout(1500);
  }
  await shot("06-apply-one");
  const applied = await snapshot();

  // 감독 스레드로 돌아오기.
  await page.getByTestId("ai-studio-thread-director").click().catch(() => undefined);
  await page.waitForTimeout(300);
  await shot("07-back-to-director");
  const back = await snapshot();

  report.push({ viewport: tag, loads, sceneAddReloaded, idle, running, twoLanes, laneThread, applied, back, errors: errors.slice(0, 5) });
  console.log(`${tag}: loads=${loads} sceneReload=${sceneAddReloaded} agents=${applied.agents} agentText="${(applied.agentText ?? []).join(" / ").slice(0, 80)}" threads=${(applied.threads ?? []).length} laneThreadClass=${laneThread.chatClass.includes("is-lane-thread")} maps=${twoLanes.maps}`);
  await page.close();
}

await browser.close();
await writeFile(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
console.log(`report → ${path.join(OUT, "capture-report.json")}`);
