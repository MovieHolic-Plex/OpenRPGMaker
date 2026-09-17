// 측정 전용: 좌측 사이드바 맵 목록 클릭 → 새 맵이 완전히 드러날 때까지의 구간 시간.
// 계약 검증이 아니라 «어디가 느린가» 를 재는 도구다. BASE_URL 로 워크트리 dev 서버를 가리킨다.
//
// 왜 표본 루프가 아니라 WAAPI 시계인가: 맵 재구축은 메인 스레드를 동기로 수십~수백 ms 잡아먹어
// getComputedStyle 을 도는 폴링 루프가 그 구간을 놓친다(실측: «커버 시작» 이 «교체» 보다 늦게
// 찍혔다). Element.prototype.animate 호출과 animation.finished 를 기록하면 각 페이드의 시작·
// 종료가 document.timeline 위에 정확히 남는다 — 표본이 굶어도 값이 흔들리지 않는다.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://127.0.0.1:9848";
const out = process.env.EVIDENCE_DIR ?? ".omo/evidence/sidebar-map-transition-speed";
const label = process.env.MEASURE_LABEL ?? "run";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
});
await context.route("**/*", async (route) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
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

await page.evaluate(async () => {
  const moduleUrl = (suffix) => performance.getEntriesByType("resource")
    .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
  const { store } = await import(moduleUrl("/src/project/store.ts"));
  const { createBlankMap } = await import(moduleUrl("/src/project/defaults.ts"));
  const { editorState } = await import(moduleUrl("/src/editor/editorState.ts"));
  const { revealMapInDock } = await import(moduleUrl("/src/editor/panels/mapList.ts"));
  const project = structuredClone(store.getCurrent());
  const a = createBlankMap("Speed QA A", 60, 40);
  const b = createBlankMap("Speed QA B", 40, 30);
  a.id = "speed-a";
  b.id = "speed-b";
  // 두 맵이 눈으로도 달라야 스크린샷이 증거가 된다.
  for (let index = 0; index < b.lowerTiles.length; index += 1) b.lowerTiles[index] = a.lowerTiles[0] ?? 0;
  project.maps = { [a.id]: a, [b.id]: b };
  project.startMapId = a.id;
  project.mapTree = { mapId: a.id, children: [{ mapId: b.id, children: [] }] };
  store.replace(project);
  editorState.set({ currentMapId: a.id, zoom: 2, tool: "select" });
  revealMapInDock(a.id);
  window.__speedQA = { editorState, store };
});

// 베일 페이드만 골라 담는다. 각 페이드의 startTime(계획된 시작)과 finished(실제 종료)를 남긴다.
await page.evaluate(() => {
  const w = window;
  w.__fades = [];
  const original = Element.prototype.animate;
  Element.prototype.animate = function patched(keyframes, options) {
    const animation = original.call(this, keyframes, options);
    if (this instanceof HTMLElement && this.classList.contains("map-dissolve-veil")) {
      const record = {
        node: this,
        animation,
        calledAt: performance.now(),
        to: String(keyframes?.[1]?.opacity ?? ""),
        duration: Number(options?.duration ?? 0),
        finishedAt: null,
      };
      w.__fades.push(record);
      animation.finished.then(() => { record.finishedAt = performance.now(); }, () => {});
    }
    return animation;
  };
});

await page.getByTestId("map-tree").waitFor({ state: "visible", timeout: 30_000 });
await page.getByTestId("map-tree-node-speed-a").waitFor({ state: "visible", timeout: 15_000 });

async function measure(rounds) {
  const results = [];
  for (let round = 0; round < rounds; round += 1) {
    const to = round % 2 === 0 ? "speed-b" : "speed-a";
    const from = round % 2 === 0 ? "speed-a" : "speed-b";
    await page.evaluate(({ to }) => {
      const w = window;
      w.__fades.length = 0;
      const state = { clickAt: 0, swapAt: 0 };
      w.__speed = state;
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest(`[data-testid='map-tree-node-${to}']`)) return;
        state.clickAt = performance.now();
      }, true);
      const unsubscribe = w.__speedQA.editorState.subscribe((next) => {
        if (state.swapAt || next.currentMapId !== to) return;
        state.swapAt = performance.now();
        unsubscribe();
      });
    }, { to });
    await page.getByTestId(`map-tree-node-${to}`).click();
    // 새 맵이 실제로 보일 때까지: 베일의 걷기 페이드가 끝나는 순간을 WAAPI 가 알려 준다.
    await page.waitForFunction(() => {
      const fades = window.__fades ?? [];
      const reveal = fades.find((fade) => fade.to === "0");
      return Boolean(reveal && reveal.finishedAt !== null);
    }, null, { timeout: 25_000 });
    const record = await page.evaluate(({ to, from }) => {
      const w = window;
      const t0 = w.__speed.clickAt;
      const rel = (value) => (value === null || value === undefined ? null : Math.round(value - t0));
      const fades = w.__fades.map((fade) => ({
        calledAt: rel(fade.calledAt),
        to: fade.to,
        duration: fade.duration,
        startTime: fade.animation.startTime === null ? null : rel(fade.animation.startTime),
        finishedAt: rel(fade.finishedAt),
      }));
      const cover = fades.find((fade) => fade.to === "1");
      const reveal = fades.find((fade) => fade.to === "0");
      return {
        to,
        from,
        clickToSwap: rel(w.__speed.swapAt),
        cover,
        reveal,
        // 사람이 «덮여 있다» 고 느끼는 구간: 커버가 끝난 뒤 걷기가 시작될 때까지.
        holdMs: cover?.finishedAt !== null && cover !== undefined && reveal ? reveal.startTime - cover.finishedAt : null,
        // 클릭 → 새 화면이 다 드러남. 이 값이 «전환 속도» 다.
        clickToRevealed: reveal?.finishedAt ?? null,
        mapAfter: w.__oprnEditMapViewport().mapId,
      };
    }, { to, from });
    results.push(record);
    await page.waitForTimeout(350);
  }
  return results;
}

const rounds = await measure(6);
await writeFile(`${out}/${label}.json`, JSON.stringify({ label, rounds, errors }, null, 2));
for (const r of rounds) {
  console.log(
    `${r.from} → ${r.to}: swap ${r.clickToSwap}ms | cover ${r.cover?.startTime}→${r.cover?.finishedAt}ms (${r.cover?.duration}ms)`
    + ` | hold ${r.holdMs}ms | reveal ${r.reveal?.startTime}→${r.reveal?.finishedAt}ms (${r.reveal?.duration}ms)`
    + ` | click→revealed ${r.clickToRevealed}ms | mapAfter=${r.mapAfter}`
  );
}
const avg = (key) => Math.round(rounds.reduce((sum, r) => sum + (r[key] ?? 0), 0) / rounds.length);
const fadeTotal = Math.round(rounds.reduce((sum, r) => sum + (r.cover?.duration ?? 0) + (r.reveal?.duration ?? 0), 0) / rounds.length);
console.log(`AVG hold=${avg("holdMs")}ms fades=${fadeTotal}ms click→revealed=${avg("clickToRevealed")}ms`);
console.log("errors:", errors);
await browser.close();
