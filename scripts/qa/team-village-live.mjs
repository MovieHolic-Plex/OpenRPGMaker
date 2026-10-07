// 팀 모드 + 평문 「마을을 만들어줘」 실측 — 실제 SQLite 루프백 호스트 + 실제 동반 AI.
// 2026-09-28 수정(마을 계약이 팀을 조용히 끄던 문제) 확인용. 쓰기는 새 임시 프로젝트 폴더에만 한다.
// 먼저 빌드: NODE_OPTIONS=--max-old-space-size=8192 npm run build:packaged && npm run build:electron
// 실행: OPRN_OH_MY_PI_WORKER_SCRIPT=$PWD/scripts/oh-my-pi-worker.ts E2E_BROWSER=firefox node scripts/qa/team-village-live.mjs
//   E2E_MINUTES=30  실행 대기 상한(분)
// 결과: verify-shots/team-village-live/SUMMARY.json + 스크린샷 3장
import { withTsModule } from "../ontology-ts-loader.mjs";
import { resolve } from "node:path";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { chromium, firefox } from "@playwright/test";

const minutes = Number(process.env.E2E_MINUTES ?? "30") || 30;
const task = process.env.E2E_TASK ?? "마을을 만들어줘";
const out = resolve("verify-shots/team-village-live");
await mkdir(out, { recursive: true });
const dir = await mkdtemp(tmpdir() + "/oprn-team-village-");
const summary = { projectDir: dir, task, runs: [], errors: [] };
const save = () => writeFile(out + "/SUMMARY.json", JSON.stringify(summary, null, 2) + "\n");

await withTsModule(resolve("electron/serve/runtime.ts"), "team-village-live.mjs", async ({ startLocalProjectServer }) => {
  const host = await startLocalProjectServer({
    projectDir: dir, distDir: resolve("dist"),
    browserBridgeSource: await readFile("dist-electron/browser-bridge.js", "utf8"),
  });
  summary.hostUrl = host.url;
  const browser = process.env.E2E_BROWSER === "firefox"
    ? await firefox.launch({ firefoxUserPrefs: { "network.notify.changed": false, "network.notify.IPv6": false } })
    : await chromium.launch({ channel: "chromium", args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
    // 라이브러리 기본 액션 타임아웃은 무한이다 — 막힌 클릭이 조용히 수십 분을 먹지 않게 한다.
    page.setDefaultTimeout(30_000);
    const started = Date.now();
    const t = () => Math.round((Date.now() - started) / 1000);
    page.on("pageerror", (e) => summary.errors.push("pageerror: " + e.message.slice(0, 300)));
    page.on("request", (req) => {
      if (!req.url().includes("/v1/agent/run") || req.method() !== "POST") return;
      try {
        const buf = req.postDataBuffer();
        const raw = buf && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : (buf?.toString("utf8") ?? "{}");
        const body = JSON.parse(raw);
        const size = (v) => JSON.stringify(v ?? null).length;
        const top = (o, n) => Object.fromEntries(Object.keys(o ?? {}).map((k) => [k, size(o[k])]).sort((a, b) => b[1] - a[1]).slice(0, n));
        summary.runs.push({
          t: t(), mode: body.mode, readOnly: body.readOnly ?? false, taskHead: String(body.task ?? "").slice(0, 60),
          wireBytes: buf?.length ?? 0, jsonBytes: raw.length, gzip: buf?.[0] === 0x1f,
          heavyKeys: Object.keys(body.heavy ?? {}), heavyBlobBytes: size(body.heavyBlobs), requestFields: top(body, 8), projectFields: top(body.project, 8),
        });
      } catch (e) { summary.runs.push({ t: t(), parse: "failed " + e.message }); }
    });

    // 첫 방문 환영 화면은 건너뛴다 — 이 검증은 빈 프로젝트의 일반 채팅 경로다.
    await page.addInitScript(() => { localStorage.setItem("oprn:editor-welcome-dismissed", "1"); });
    // /v1/agent/run POST 몸통을 페이지 안에서 잰다(Firefox 는 스트림 몸통을 Playwright 에 넘기지 않는다).
    await page.addInitScript(() => {
      const real = window.fetch;
      window.__qaRunBodies = [];
      window.fetch = async (input, init) => {
        const url = String(input?.url ?? input);
        if (url.includes("/v1/agent/run") && init?.method === "POST") {
          const b = init.body;
          const bytes = typeof b === "string" ? b.length : b?.byteLength ?? null;
          let shape = null;
          try {
            const text = typeof b === "string" ? b : await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
            const j = JSON.parse(text); const sz = (v) => JSON.stringify(v ?? null).length;
            const top = (o) => Object.fromEntries(Object.keys(o ?? {}).map((k) => [k, sz(o[k])]).sort((x, y) => y[1] - x[1]).slice(0, 8));
            const blobs = Object.entries(j.heavyBlobs ?? {}).map(([h, v]) => [h.slice(0, 8), v.length]);
            const heavyTop = {};
            for (const [h, v] of Object.entries(j.heavyBlobs ?? {})) {
              if (v.length < 10_000_000) continue;
              const o = JSON.parse(v);
              const rows = Object.entries(o).map(([k, x]) => [k, sz(x), (JSON.stringify(x).match(/data:image/g) || []).length]).sort((a, b) => b[1] - a[1]).slice(0, 8);
              heavyTop[h.slice(0, 8)] = rows;
              if (o.uploaded) heavyTop[h.slice(0, 8) + ".uploaded"] = Object.entries(o.uploaded).map(([k, x]) => [k, sz(x)]).sort((a, b) => b[1] - a[1]).slice(0, 8);
              if (o.sprites) heavyTop[h.slice(0, 8) + ".sprites"] = Object.entries(o.sprites).map(([k, x]) => [k, sz(x)]).sort((a, b) => b[1] - a[1]).slice(0, 8);
            }
            let tilesetCount = null, hasInterior = null;
            for (const v of Object.values(j.heavyBlobs ?? {})) { try { const o = JSON.parse(v); if (o && !o.uploaded && !o.actors && typeof o === "object") { const vals = Object.values(o); if (vals[0]?.tileSize) { tilesetCount = vals.length; hasInterior = Boolean(o.easyrpg_chipset_interior); } } } catch {} }
            shape = { json: text.length, mode: j.mode, req: top(j), project: top(j.project), heavy: j.heavy ?? null, blobs,
              heavyTop, team: sz(j.team), tilesetCount, hasInterior, dataUrls: (text.match(/data:image/g) || []).length };
          } catch (e) { shape = { error: String(e) }; }
          window.__qaRunBodies.push({ bytes, gzip: init.headers?.["Content-Encoding"] === "gzip", shape });
        }
        return real(input, init);
      };
    });
    // 스트림 줄 크기와 페이지 주 스레드 멈춤을 잰다 — 워치독(30초)이 어디서 울리는지 보려고.
    await page.addInitScript(() => {
      // 큰 직렬화와 그 실패를 잰다 — 적용 뒤 자동 저장이 어느 JSON.stringify 에서 터지는지(allocation size overflow).
      // 저장·다시 받기·호스트 리비전을 시각과 함께 남긴다 — 실행 중 호스트 문서 교체가 적용 기준을 무너뜨리는지 보려고.
      window.__qaHost = [];
      const wrapBridge = () => {
        const p = window.oprn?.project;
        if (!p || p.__qaWrapped) return !!p;
        for (const name of ["loadFolded", "save", "saveMapPatch"]) {
          const real = p[name];
          if (typeof real !== "function") continue;
          p[name] = async function (...args) {
            const e = { name, at: Math.round(performance.now() / 1000), from: String(new Error().stack).split("\n").slice(1, 5).map((l) => l.split("@")[0]).join("<") };
            window.__qaHost.push(e);
            const out = await real.apply(this, args);
            e.doneAt = Math.round(performance.now() / 1000); e.kind = out?.kind; e.revision = out?.revision;
            return out;
          };
        }
        const team = window.oprn.team;
        const status = team?.status;
        if (typeof status === "function") {
          let last;
          team.status = async (...a) => { const out = await status.apply(team, a); if (out?.revision !== last) { last = out?.revision; window.__qaHost.push({ name: "revision", at: Math.round(performance.now() / 1000), revision: last }); } return out; };
        }
        p.__qaWrapped = true;
        return true;
      };
      const wrapTimer = setInterval(() => { if (wrapBridge()) clearInterval(wrapTimer); }, 5);
      window.__qaStringify = [];
      const realStringify = JSON.stringify;
      const shape = (v) => {
        if (!v || typeof v !== "object") return typeof v;
        try { return Object.fromEntries(Object.keys(v).slice(0, 40).map((k) => { let n = null; try { n = realStringify(v[k])?.length ?? null; } catch { n = "overflow"; } return [k, n]; })); } catch { return "?"; }
      };
      JSON.stringify = function (value, ...rest) {
        try {
          const out = realStringify.call(this, value, ...rest);
          if (typeof out === "string" && out.length > 50_000_000) window.__qaStringify.push({ at: Math.round(performance.now() / 1000), chars: out.length, stack: String(new Error().stack).slice(0, 600) });
          return out;
        } catch (e) {
          window.__qaStringify.push({ at: Math.round(performance.now() / 1000), error: String(e), stack: String(new Error().stack).slice(0, 1200), shape: shape(value) });
          throw e;
        }
      };
      window.__qaStalls = [];
      let last = performance.now();
      setInterval(() => { const now = performance.now(); if (now - last > 3000) window.__qaStalls.push({ at: Math.round(now / 1000), gapMs: Math.round(now - last) }); last = now; }, 500);
      const realDecode = TextDecoder.prototype.decode;
      window.__qaBigChunks = [];
      TextDecoder.prototype.decode = function (input, opts) {
        const out = realDecode.call(this, input, opts);
        if (out.length > 1_000_000) window.__qaBigChunks.push({ at: Math.round(performance.now() / 1000), chars: out.length, head: out.slice(0, 80) });
        return out;
      };
    });
    await page.goto(host.url + "/");
    const guest = page.getByTestId("login-guest");
    await page.locator('[data-testid="edit-canvas"] canvas, [data-testid="editor-welcome"]').first().waitFor({ timeout: 120_000 });
    if (await guest.isVisible().catch(() => false)) await guest.click();
    const skip = page.getByTestId("editor-welcome-skip");
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.getByTestId("ai-input").waitFor({ timeout: 60_000 });

    // 사용자와 같은 길: 작업 설정 → 작업 인원 → 팀으로(E2E_SOLO=1 이면 혼자).
    await page.getByTestId("ai-composer-settings").click();
    await page.getByTestId("ai-composer-team").click();
    await page.getByTestId("ai-team-menu").getByRole("button", { name: process.env.E2E_SOLO === "1" ? "혼자" : "팀으로", exact: true }).click();
    summary.savedPiTeam = await page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}").piTeam ?? null);
    summary.teamLabel = (await page.getByTestId("ai-composer-team").innerText()).trim();
    await page.screenshot({ path: out + "/01-team-on.png" });
    // 팝오버를 닫는다 — 열린 채면 입력창을 덮는다. 설정 버튼을 다시 눌러 토글로 닫고, 남았으면 Escape.
    for (let i = 0; i < 3 && await page.getByTestId("ai-team-menu").isVisible().catch(() => false); i++) await page.keyboard.press("Escape");
    for (let i = 0; i < 3 && await page.getByTestId("ai-composer-settings-popover").isVisible().catch(() => false); i++) await page.keyboard.press("Escape");
    summary.popoverOpenBeforeSend = await page.locator(".ai-composer-popover:not([hidden])").count();

    await page.getByTestId("ai-input").click();
    await page.getByTestId("ai-input").fill(task);
    await page.getByTestId("ai-send").click();
    // 마을 요청은 제작 전에 그래픽 조합을 고르게 한다. 사람처럼 첫(추천) 조합을 고른다.
    const pick = page.getByTestId("ai-creation-select-0");
    if (await pick.waitFor({ timeout: 90_000 }).then(() => true, () => false)) {
      summary.creationChoice = "01 추천";
      await pick.click();
      const start = page.getByTestId("ai-creation-start");
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="ai-creation-start"]'); return b && !b.disabled; }, null, { timeout: 60_000 });
      await start.click();
    }
    const firstDeadline = Date.now() + 180_000;
    while (!summary.runs.length && Date.now() < firstDeadline) await page.waitForTimeout(1000);
    summary.firstRun = summary.runs[0] ?? null;
    summary.pageBodies = await page.evaluate(() => window.__qaRunBodies ?? []);
    await page.waitForTimeout(20_000);
    summary.badgeEarly = await page.locator(".ai-team-badge").last().innerText().catch(() => null);
    await page.screenshot({ path: out + "/02-running.png" });
    await save();

    const end = Date.now() + minutes * 60_000;
    // 끝 판정: 보드 단계가 끝 단계이고 중단 버튼도 숨었을 때. 적용 중에는 중단 버튼이 잠깐 숨는다.
    const terminal = new Set(["적용됨", "완료", "검토 대기", "버림", "중단", "실패"]);
    let idleStreak = 0;
    while (Date.now() < end) {
      const busy = await page.getByTestId("ai-abort").evaluate((n) => !n.hidden).catch(() => false);
      const phase = (await page.getByTestId("ai-team-phase").last().innerText().catch(() => "")).trim();
      idleStreak = !busy && terminal.has(phase) ? idleStreak + 1 : 0;
      if (idleStreak >= 2) break;
      await page.waitForTimeout(15_000);
      summary.agentsSeen = await page.locator(".ai-team-agents > li").allInnerTexts().then((rows) => rows.map((r) => r.replace(/\s+/g, " ").slice(0, 120))).catch(() => []);
      summary.hostTrace = await page.evaluate(() => (window.__qaHost ?? []).slice(-40)).catch(() => null);
      summary.pageSeconds = await page.evaluate(() => Math.round(performance.now() / 1000)).catch(() => null);
      await save();
    }
    summary.finishedWithin = Date.now() < end;
    summary.elapsedSeconds = t();
    summary.phase = await page.getByTestId("ai-team-phase").last().innerText().catch(() => null);
    // 실패 원인 추적 — 사용자 화면에 없는 원문(작업 과정)과 도구 오류 줄.
    summary.processNotes = await page.locator(".ai-work-process-note").allInnerTexts().then((rows) => rows.map((r) => r.slice(0, 600))).catch(() => []);
    summary.stalls = await page.evaluate(() => window.__qaStalls ?? []).catch(() => null);
    summary.bigChunks = await page.evaluate(() => (window.__qaBigChunks ?? []).slice(-12)).catch(() => null);
    summary.bigStringify = await page.evaluate(() => (window.__qaStringify ?? []).slice(-20)).catch(() => null);
    summary.hostTrace = await page.evaluate(() => (window.__qaHost ?? []).slice(-40)).catch(() => null);
    summary.chatTail = (await page.getByTestId("ai-chat-log").innerText().catch(() => "")).slice(-1500);
    await page.screenshot({ path: out + "/03-finished.png", timeout: 90_000 }).catch((e) => summary.errors.push("screenshot: " + e.message.slice(0, 120)));
    if (!summary.finishedWithin) await page.getByTestId("ai-abort").click().catch(() => undefined);
    await page.waitForTimeout(5000);

    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dir + "/project.sqlite", { readOnly: true });
    const row = db.prepare("SELECT project_id, revision FROM project WHERE id = 1").get();
    const mapRows = db.prepare("SELECT map_id, map_json FROM maps").all();
    const log = db.prepare("SELECT payload_json FROM ai_activity_logs WHERE channel='pi' ORDER BY created_at DESC LIMIT 1").get();
    db.close();
    const payload = log ? JSON.parse(log.payload_json) : null;
    summary.sqlite = row ? {
      projectId: row.project_id, revision: row.revision, maps: mapRows.length,
      events: mapRows.reduce((n, m) => n + (JSON.parse(m.map_json).events?.length ?? 0), 0),
      lastPiRun: payload ? { result: payload.result, toolCalls: payload.toolCalls?.map((c) => c.name + ":" + c.ok), ending: payload.audit?.at(-1)?.text } : null,
    } : null;
  } finally {
    await save();
    await browser.close();
    await host.close();
  }
});
console.log(JSON.stringify(summary, null, 2));
