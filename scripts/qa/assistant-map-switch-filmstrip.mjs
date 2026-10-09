// scripts/qa/assistant-map-switch-filmstrip.mjs
// 맵 전환을 **눈으로** 확인하는 필름스트립. 계약 검증은 e2e 스펙이 한다
// (조수 경로 test/e2e/assistant-map-switch-dissolve.spec.ts, 목록 클릭 test/e2e/map-list-switch-dissolve.spec.ts).
// 여기서는 사람이 볼 프레임을 남긴다 — 드라이버가 둘이다.
//
//   BASE_URL=http://127.0.0.1:9251 node scripts/qa/assistant-map-switch-filmstrip.mjs
//   BASE_URL=http://127.0.0.1:9251 FILMSTRIP_DRIVER=map-list node scripts/qa/assistant-map-switch-filmstrip.mjs
//
// blankProject 로만 돌고 쓰기 요청은 전부 막는다 — 사용자 프로젝트를 건드리지 않는다.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://127.0.0.1:9251";
const driver = process.env.FILMSTRIP_DRIVER === "map-list" ? "map-list" : "assistant";
const out = process.env.EVIDENCE_DIR
  ?? (driver === "map-list" ? ".omo/evidence/map-list-switch-dissolve/filmstrip" : ".omo/evidence/assistant-map-switch-dissolve/filmstrip");
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const blockedWrites = [];
await context.route("**/*", async (route) => {
  const request = route.request();
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
    await route.abort("blockedbyclient");
    return;
  }
  await route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(`${base}/?freshProject=1`, { waitUntil: "domcontentloaded" });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForFunction(() => Boolean(window.__oprnEditVisibleArea?.()));

// 두 맵이 한눈에 달라야 프레임이 증거가 된다 — 지붕/바닥 타일로 서로 다른 무늬를 깐다.
await page.evaluate(async (driverName) => {
  const { store } = await import("/src/project/store.ts");
  const { createBlankMap } = await import("/src/project/defaults.ts");
  const { editorState } = await import("/src/editor/editorState.ts");
  const { focusEditorRegion } = await import("/src/editor/editorReferenceNavigation.ts");
  const viaMapList = driverName === "map-list";
  const project = structuredClone(store.getCurrent());
  const a = createBlankMap(viaMapList ? "Switch QA A" : "숲 광장", 40, 30);
  const b = createBlankMap(viaMapList ? "Switch QA B" : "여관 내부", 24, 18);
  a.id = viaMapList ? "qa-a" : "qa-outdoor";
  b.id = viaMapList ? "qa-b" : "qa-indoor";
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) a.lowerTiles[y * a.width + x] = (x + y) % 7 === 0 ? 47 : 4;
  }
  for (let y = 0; y < b.height; y += 1) {
    for (let x = 0; x < b.width; x += 1) b.lowerTiles[y * b.width + x] = (x * y) % 5 === 0 ? 160 : 132;
  }
  project.maps = { [a.id]: a, [b.id]: b };
  project.startMapId = a.id;
  project.mapTree = { mapId: a.id, children: [{ mapId: b.id, children: [] }] };
  store.replace(project);
  editorState.set({ currentMapId: a.id, zoom: 2, tool: "select" });
  window.__filmstrip = { editorState, focusEditorRegion, clickAt: 0 };
  if (viaMapList) {
    const { revealMapInDock } = await import("/src/editor/panels/mapList.ts");
    revealMapInDock(a.id);
  }
}, driver);
if (driver === "map-list") {
  await page.getByTestId("map-tree-node-qa-b").waitFor({ state: "visible", timeout: 60_000 });
}
await page.waitForTimeout(600);

// 전환은 200ms 다(덮기 80 + 걷기 120). `element.screenshot()` 한 장이 그보다 오래 걸려서
// 실제 속도로는 중간 프레임을 못 뜬다. 스크린캐스트는 렌더러가 프레임을 **밀어 주므로**
// 메인 스레드를 막지 않는다 — 찍히는 것은 손대지 않은 진짜 전환이다.
//
// 다만 페이드 200ms 는 «전체» 가 아니다: 베일은 새 맵이 실제로 그려질 때까지(rAF 2회 +
// 탈출구) 불투명하게 더 머문다. 실측(swiftshader)에서 클릭 → 새 화면이 다 드러나기까지
// 847ms 중 순수 페이드가 330ms 였고, 지금은 200ms + 같은 유지 구간이다.
const cdp = await context.newCDPSession(page);
const shots = [];
cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
  shots.push({ data, at: metadata.timestamp });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

await page.evaluate(() => {
  // 베일 불투명도를 프레임마다 기록해 둔다 — 그림과 수치를 같이 남겨야 증거가 된다.
  const trace = [];
  window.__veilTrace = trace;
  const tick = () => {
    const node = document.querySelector("[data-testid='map-dissolve-veil']");
    trace.push({
      t: performance.now(),
      veil: node ? Number.parseFloat(getComputedStyle(node).opacity) : 0,
      mapId: window.__oprnEditMapViewport().mapId,
    });
    if (trace.length < 400) setTimeout(tick, 8);
  };
  tick();
});

await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
await page.waitForTimeout(250);
let startedAt;
if (driver === "map-list") {
  // 시계는 «클릭 이벤트가 행에 닿은 순간» 부터 잰다. 표본 시작부터 재면 플레이라이트의
  // 클릭 디스패치(이 브라우저에서 1초 남짓)가 섞여 상품 지연을 못 본다.
  await page.evaluate(() => {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-testid='map-tree-node-qa-b']")) return;
      if (!window.__filmstrip.clickAt) window.__filmstrip.clickAt = performance.now();
    }, true);
  });
  await page.getByTestId("map-tree-node-qa-b").click();
  startedAt = await page.evaluate(() => window.__filmstrip.clickAt);
  if (!startedAt) throw new Error("맵 목록 행 클릭이 관찰되지 않았다");
} else {
  startedAt = await page.evaluate(() => {
    window.__filmstrip.focusEditorRegion({ mapId: "qa-indoor", x: 18, y: 13, w: 4, h: 3 });
    return performance.now();
  });
}
await page.waitForTimeout(1600);
await cdp.send("Page.stopScreencast");

const trace = await page.evaluate(() => ({ trace: window.__veilTrace, started: window.performance.timeOrigin }));
const timeOrigin = trace.started;
const veilSamples = trace.trace.filter((s) => s.t >= startedAt - 50 && s.t <= startedAt + 900)
  .map((s) => ({ t: Math.round(s.t - startedAt), veil: s.veil, mapId: s.mapId }));

// 스크린캐스트 프레임의 wall-clock 을 페이지 시계로 옮겨 그 순간의 베일 불투명도를 함께 남긴다 —
// 그래야 «덮인 프레임» 을 눈이 아니라 숫자로 고를 수 있다.
const sampleAt = (pageMs) => trace.trace.reduce((best, s) => (
  best === null || Math.abs(s.t - pageMs) < Math.abs(best.t - pageMs) ? s : best
), null);

const base0 = shots.length > 0 ? shots[0].at : 0;
const frames = [];
for (const [index, shot] of shots.entries()) {
  const relMs = Math.round((shot.at - base0) * 1000);
  const name = `${String(index).padStart(2, "0")}-t${String(relMs).padStart(4, "0")}ms`;
  await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, "base64"));
  const pageMs = shot.at * 1000 - timeOrigin;
  const near = sampleAt(pageMs);
  frames.push({ name, relMs, pageMs: Math.round(pageMs), veil: near ? Number(near.veil.toFixed(3)) : null, mapId: near?.mapId ?? null });
}

await writeFile(`${out}/frames.json`, JSON.stringify({ frames, veilSamples, errors, blockedWrites }, null, 2));
console.log(`프레임 ${frames.length}장 → ${out}`);
console.log(veilSamples.filter((_, i) => i % 3 === 0).map((s) => `${String(s.t).padStart(4)}ms  veil=${s.veil.toFixed(3)}  ${s.mapId}`).join("\n"));
if (errors.length > 0) console.log("PAGE_ERRORS", errors);
await browser.close();
