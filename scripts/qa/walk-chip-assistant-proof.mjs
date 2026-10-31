// 조수 실제 입력창 → 새 인물 → generate_walk_chip → 걷기 칩이 그 인물에 붙는지 증명 (2026-10-31).
//   ENGINE_CLI=claude ENGINE_MODEL=sonnet node scripts/qa/walk-chip-assistant-proof.mjs --url http://127.0.0.1:9977 --out /tmp/walkchip-qa/assistant
// 요청 글에는 「칩을 만들어라」를 쓰지 않는다 — 생김새만 준다. 조수가 스스로 generate_walk_chip 을 부르는지,
// 그 뒤 공방 작업(호스트 char-gen 「글로」)이 끝나 외형·이벤트가 새 칩으로 바뀌는지 본다.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const base = arg("url", "http://127.0.0.1:9977");
const out = arg("out", "/tmp/walkchip-qa/assistant");
const timeoutMs = Number(arg("timeout-min", "50")) * 60_000;
const request = arg("request", "시작 맵 (5,5) 칸에 대장장이 NPC 「브론」을 놓아줘. 생김새: 중년 남성, 짧은 갈색 머리, 덥수룩한 갈색 수염, 소매를 걷은 흰 셔츠, 갈색 가죽 앞치마, 어두운 바지. 말을 걸면 「쇠는 뜨거울 때 두드려야지.」라고 한 줄 말해.");
await mkdir(out, { recursive: true });
const engine = { kind: "local-cli", cli: process.env.ENGINE_CLI ?? "claude", routineModel: process.env.ENGINE_MODEL ?? "sonnet", deepModel: process.env.ENGINE_MODEL ?? "sonnet", effort: "high" };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snap = () => page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const { workshopQueue } = await import("/src/editor/workshop/queue/workshopQueue.ts");
  const { resolveEventAppearanceGraphic } = await import("/src/project/characterAppearances.ts");
  const p = store.getCurrent();
  const events = Object.values(p.maps).flatMap((map) => map.events.map((event) => ({ map: map.id, id: event.id, name: event.name ?? "", graphic: event.pages?.[0]?.graphic ?? null })));
  const linked = events.filter((e) => e.graphic?.appearanceId).map((e) => ({ ...e, resolved: resolveEventAppearanceGraphic(p, e.graphic).sprite ?? null }));
  return {
    appearances: (p.database.characterAppearances ?? []).map((a) => ({ id: a.id, name: a.name, charset: a.charset ?? null, uploaded: a.charset ? p.assets.uploaded[a.charset.resourceId]?.kind ?? null : null })),
    jobs: workshopQueue().snapshot().jobs.filter((v) => v.job.remote?.appearanceId).map((v) => ({ source: v.job.source, appearanceId: v.job.remote.appearanceId, mode: v.job.remote.mode, state: v.state, progress: Math.round(v.progress * 100), error: v.job.error ?? null })),
    linked, eventCount: events.length,
  };
});
try {
  await page.addInitScript((engineJson) => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:locale", "ko");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
    localStorage.setItem("oprn:assistant-engine", engineJson);
  }, JSON.stringify(engine));
  await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("ai-input").waitFor({ state: "attached", timeout: 180000 });
  // 로컬 CLI 연결 확인은 실제 왕복 한 번이라 다른 작업이 CLI 를 쓰는 동안 닿지 못함으로 남을 수 있다 — 잠기면 다시 확인한다.
  for (let i = 0; ; i++) {
    const ready = await page.getByTestId("ai-input").evaluate((n) => n.getAttribute("aria-disabled") !== "true" && n.getClientRects().length > 0);
    if (ready) break;
    if (i >= 12) throw new Error("조수 입력창이 열리지 않는다(AI 연결 잠금)");
    if (i % 3 === 0) await page.evaluate(async () => (await import("/src/editor/panels/aiConnectionStatus.ts")).refreshAiConnectionStatus());
    await page.waitForTimeout(10000);
  }
  await page.screenshot({ path: `${out}/01-before.png` });
  await page.getByTestId("ai-input").fill(request);
  await page.getByTestId("ai-send").click();
  console.log("ASSISTANT_SENT");
  const started = Date.now();
  let state;
  let shot = 0;
  for (;;) {
    await page.waitForTimeout(20000);
    state = await snap();
    const job = state.jobs.find((j) => j.source === "assistant");
    console.log("ASSISTANT_WAIT", JSON.stringify({ appearances: state.appearances.length, jobs: state.jobs, linked: state.linked.length }));
    if (++shot % 6 === 0) await page.screenshot({ path: `${out}/progress-${shot}.png` });
    if (job && (job.state === "installed" || job.state === "failed")) break;
    if (Date.now() - started > timeoutMs) break;
  }
  const transcript = await page.locator("body").innerText();
  await page.screenshot({ path: `${out}/02-after.png` });
  await writeFile(`${out}/proof.json`, JSON.stringify({ request, engine, state, errors: errors.slice(0, 10) }, null, 2));
  await writeFile(`${out}/transcript.txt`, transcript);
  const job = state.jobs.find((j) => j.source === "assistant");
  assert.ok(job, "조수가 generate_walk_chip 을 부르지 않았다(공방 작업 없음)");
  assert.equal(job.state, "installed", `걷기 칩 작업이 끝나지 않았다: ${JSON.stringify(job)}`);
  const app = state.appearances.find((a) => a.id === job.appearanceId);
  assert.equal(app?.uploaded, "charset", "외형 칩이 생성된 업로드 캐릭터칩이 아니다");
  const ev = state.linked.find((e) => e.graphic.appearanceId === job.appearanceId);
  assert.equal(ev?.resolved?.id, app.charset.resourceId, "NPC 이벤트가 새 칩으로 풀리지 않는다");
  console.log("WALKCHIP_ASSISTANT_PASS", JSON.stringify({ appearance: app, event: ev }));
} catch (error) {
  console.error("WALKCHIP_ASSISTANT_FAIL", error instanceof Error ? error.message : String(error));
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await browser.close();
  console.log(`cleanup: closed browser; evidence in ${out}`);
}
