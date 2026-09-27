// 프리셋 첫 생성 팀 모드 실측 — 실제 SQLite 루프백 호스트 + 실제 동반 AI.
// 환영 화면 포스터 → AI 연결 관문(로그인돼 있으면 통과) → 인터뷰 → 저장 → 첫 생성 요청.
//
// 확인하는 것:
//   - 첫 /v1/agent/run 이 mode=team 인가, 저장된 AiConfig.piTeam 은 그대로(false)인가
//   - 첫 요청 몸통 크기와 heavy 해시 전송(heavy·heavyBlobs) 여부
//   - 첫 실행 전에 의도 읽기(/v1/chat/completions)가 없었는가
//   - 실행 번호 헤더(X-Oprn-Run-Id)와 이어 받기(GET /v1/agent/run) 횟수
//   - 끝난 뒤 SQLite 를 다시 읽은 맵·이벤트 수
// 결과는 verify-shots/preset-first-team-e2e/SUMMARY.json 하나다. 중간 스크린샷은 찍지 않는다(Firefox 가 오래 멈춘다).
//
// 쓰기는 새 임시 프로젝트 폴더에만 한다. 먼저 빌드가 있어야 한다:
//   NODE_OPTIONS=--max-old-space-size=8192 npm run build:packaged && npm run build:electron
// 실행:
//   OPRN_OH_MY_PI_WORKER_SCRIPT=$PWD/scripts/oh-my-pi-worker.ts E2E_BROWSER=firefox node scripts/qa/preset-team-first-build.mjs
// 환경 변수:
//   E2E_FULL=1              팀 실행이 끝날 때까지 기다린다(기본: 첫 요청을 확인하면 중단)
//   E2E_MINUTES=40          E2E_FULL 대기 상한(분)
//   E2E_BROWSER=firefox     이 호스트에서는 Chromium 이 죽는다 — Firefox 를 쓴다
//   E2E_NETWORK_CHANGE=1    Firefox 의 네트워크 변경 감지를 켠 채 둔다. 도커 veth 가 오르내리는 호스트에서
//                           스트림이 실제로 끊기므로 이어 받기 경로를 실측할 때 쓴다(기본: 끔)
import { withTsModule } from "../ontology-ts-loader.mjs";
import { resolve } from "node:path";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { chromium, firefox } from "@playwright/test";

const full = process.env.E2E_FULL === "1";
const minutes = Number(process.env.E2E_MINUTES ?? "40") || 40;
const keepNetworkChange = process.env.E2E_NETWORK_CHANGE === "1";
const out = resolve("verify-shots/preset-first-team-e2e");
await mkdir(out, { recursive: true });
const dir = await mkdtemp(tmpdir() + "/oprn-preset-team-");
const summary = { projectDir: dir, full, keepNetworkChange, runs: [], v1Log: [], errors: [] };
const save = () => writeFile(out + "/SUMMARY.json", JSON.stringify(summary, null, 2) + "\n");
const push = (key, value, limit = 200) => { summary[key] = [...(summary[key] ?? []), value].slice(-limit); };

// 호스트가 같은 프로세스에서 워커로 넘기는 몸통(해시를 풀어 붙인 뒤)의 모양. 브라우저 → 호스트 몸통과 비교하려고 남긴다.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url ?? input);
  if (url.includes("/agent/run") && typeof init?.body === "string" && !summary.workerBodyShape) {
    try {
      const req = JSON.parse(init.body).request ?? {};
      const size = (v) => JSON.stringify(v ?? null).length;
      const top = (o, n) => Object.fromEntries(Object.keys(o).map((k) => [k, size(o[k])]).sort((a, b) => b[1] - a[1]).slice(0, n));
      summary.workerBodyShape = { total: init.body.length, mode: req.mode, requestFields: top(req, 12), projectFields: top(req.project ?? {}, 10) };
    } catch (e) { summary.workerBodyShape = { error: e.message }; }
  }
  return realFetch(input, init);
};

const firefoxPrefs = keepNetworkChange ? {} : {
  "network.notify.changed": false,
  "network.notify.IPv6": false,
  "network.captive-portal-service.enabled": false,
  "network.connectivity-service.enabled": false,
};

await withTsModule(resolve("electron/serve/runtime.ts"), "preset-team-e2e.mjs", async ({ startLocalProjectServer }) => {
  const host = await startLocalProjectServer({
    projectDir: dir, distDir: resolve("dist"),
    browserBridgeSource: await readFile("dist-electron/browser-bridge.js", "utf8"),
  });
  summary.hostUrl = host.url;
  const browser = process.env.E2E_BROWSER === "firefox"
    ? await firefox.launch({ firefoxUserPrefs: firefoxPrefs })
    : await chromium.launch({ channel: "chromium", args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const started = Date.now();
    const t = () => Math.round((Date.now() - started) / 1000);
    page.on("pageerror", (e) => summary.errors.push("pageerror: " + e.message.slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") push("console", { t: t(), text: m.text().slice(0, 400) }, 40); });

    page.on("request", (req) => {
      const url = req.url();
      if (!url.includes("/v1/")) return;
      const path = new URL(url).pathname;
      if (path === "/v1/chat/completions" && summary.runs.length === 0) summary.chatBeforeFirstRun = (summary.chatBeforeFirstRun ?? 0) + 1;
      if (path !== "/v1/agent/run") return;
      if (req.method() === "GET") { summary.resumeRequests = (summary.resumeRequests ?? 0) + 1; return; }
      try {
        const buf = req.postDataBuffer();
        const raw = buf && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : (buf?.toString("utf8") ?? "{}");
        const body = JSON.parse(raw);
        summary.runs.push({
          t: t(), wireBytes: buf?.length ?? 0, jsonBytes: raw.length,
          mode: body.mode, mapIds: body.mapIds, readOnly: body.readOnly, runId: body.runId ?? null,
          heavyKeys: Object.keys(body.heavy ?? {}), heavyBlobs: Object.keys(body.heavyBlobs ?? {}).length,
          taskHead: String(body.task ?? "").slice(0, 80),
        });
      } catch (e) { summary.runs.push({ t: t(), parse: "failed " + e.message }); }
    });
    page.on("response", (res) => {
      if (!res.url().includes("/v1/agent/run")) return;
      push("runResponses", { t: t(), method: res.request().method(), status: res.status(), runId: res.headers()["x-oprn-run-id"] ?? null });
    });
    page.on("requestfinished", async (req) => {
      if (!req.url().includes("/v1/")) return;
      const res = await req.response().catch(() => null);
      push("v1Log", { t: t(), m: req.method(), u: new URL(req.url()).pathname, s: res?.status() ?? null });
    });
    page.on("requestfailed", (req) => {
      if (req.url().includes("/v1/")) push("v1Log", { t: t(), m: req.method(), u: new URL(req.url()).pathname, fail: req.failure()?.errorText ?? null });
    });

    await page.goto(host.url + "/?forceWelcome=1");
    try {
      await page.getByTestId("editor-welcome").waitFor({ timeout: 90_000 });
    } catch (error) {
      summary.bootBody = (await page.locator("body").innerText().catch(() => "")).slice(0, 1500);
      throw error;
    }
    await page.getByTestId("editor-welcome-template-card-0").click({ timeout: 20_000 });
    // 로그인돼 있으면 관문이 뜨지 않고 인터뷰가 바로 열린다.
    await page.getByTestId("project-interview").waitFor({ timeout: 30_000 });
    summary.gateShownWhenConnected = (await page.getByTestId("ai-connect-gate").count()) > 0;
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("project-interview-option-0").click();
      await page.getByTestId("project-interview-next").click();
    }
    await page.getByTestId("project-interview-summary").waitFor();
    await page.getByTestId("project-interview-confirm").click();
    await page.waitForFunction(() => document.querySelectorAll("[data-testid='editor-welcome']").length === 0, null, { timeout: 180_000 });
    const deadline = Date.now() + 240_000;
    while (!summary.runs.length && Date.now() < deadline) await page.waitForTimeout(1000);
    summary.firstRun = summary.runs[0] ?? null;
    summary.savedPiTeam = await page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}").piTeam ?? null);
    await page.waitForTimeout(8000);
    summary.chatTail = (await page.getByTestId("ai-chat-log").innerText().catch(() => "")).slice(-600);
    await save();

    if (full) {
      const end = Date.now() + minutes * 60_000;
      while (Date.now() < end) {
        const done = await page.getByTestId("ai-abort").evaluate((n) => n.hidden).catch(() => true);
        if (done) break;
        await page.waitForTimeout(15_000);
        await save();
      }
      summary.finishedWithin = Date.now() < end;
      summary.elapsedSeconds = t();
      summary.chatTailFinal = (await page.getByTestId("ai-chat-log").innerText().catch(() => "")).slice(-1500);
      summary.resumeMentions = (await page.locator("body").innerText().catch(() => "")).split("이어 받는 중").length - 1;
    } else {
      await page.getByTestId("ai-abort").click().catch(() => undefined);
      await page.waitForTimeout(3000);
    }
    await page.reload();
    await page.waitForTimeout(15_000);

    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dir + "/project.sqlite", { readOnly: true });
    const row = db.prepare("SELECT project_id, title, revision, current_json FROM project WHERE id = 1").get();
    const p = row ? JSON.parse(row.current_json) : null;
    const mapRows = db.prepare("SELECT map_id, map_json FROM maps").all();
    db.close();
    summary.sqlite = row ? {
      projectId: row.project_id, title: row.title, revision: row.revision,
      genre: p?.system?.genre, briefPreset: p?.gameDesignBrief?.presetId,
      generationPending: p?.gameDesignBrief?.generationPending ?? null,
      maps: mapRows.length,
      events: mapRows.reduce((n, m) => n + (JSON.parse(m.map_json).events?.length ?? 0), 0),
    } : null;
  } finally {
    await save();
    await browser.close();
    await host.close();
  }
});
const { v1Log: _log, ...brief } = summary;
console.log(JSON.stringify(brief, null, 2));
