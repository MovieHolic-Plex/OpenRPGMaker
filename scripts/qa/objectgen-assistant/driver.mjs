// 없는 기물 그리기(generate_missing_object) 실화면 시험 구동기 — 편집기 dev 빌드 한 장을 띄워 두고 HTTP 로 명령을 받는다.
//
//   BASE=http://127.0.0.1:<dev 포트> PORT=9861 OUT=<증거 폴더> node scripts/qa/objectgen-assistant/driver.mjs
//
// - 공방 그리기 모델: dev 빌드의 window.__oprnWorkshopChat 을 이 프로세스의 relay 로 잇는다 → `claude -p --model sonnet`
//   (조수 대용: Argon 쿼터 소진 시의 문서화된 Sonnet 5.5 대역 — openwiki/editor-workshop.md 「조수 요청」 절). 유료 이미지 대체 경로 없음.
// - 카드: 실제 aiObjectGenCard.ts 를 화면에 붙인다(공방 실행기·검수·굽기 전부 실제 코드). 후속 요청 글은 window.__ogFollowUp 에 받는다.
// - 그림: 실제 show_map_region 데이터 + toolImageRenderer(조수가 보는 그림과 같은 렌더러).
// 명령: POST /load {path,mapId} · /render {mapId,x,y,w,h,out} · /card {request,autopick} · GET /card · POST /click {testid,letter?} · /shot {out} · /export {path}
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9846";
const port = Number(process.env.PORT ?? 9861);
const out = resolve(process.env.OUT ?? "/tmp/ogt/evidence");
mkdirSync(out, { recursive: true });
const relayLog = resolve(out, "relay-log.jsonl");
const effort = process.env.RELAY_EFFORT ?? "medium";

/** 공방 ChatRequest → claude -p stream-json 한 턴. 이전 대화(고치기)는 한 메시지 안에 차례로 적는다. */
function relay(surface, raw) {
  const request = JSON.parse(raw);
  const system = request.messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("\n"))).join("\n\n");
  const blocks = [];
  for (const message of request.messages.filter((m) => m.role !== "system")) {
    const prefix = message.role === "assistant" ? "[너의 지난 답]\n" : blocks.length ? "[사용자]\n" : "";
    const parts = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    let first = true;
    for (const part of parts) {
      if (part.type === "text") blocks.push({ type: "text", text: (first ? prefix : "") + part.text });
      else if (part.type === "image_url") {
        const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(part.image_url.url);
        if (match) blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
      }
      first = false;
    }
  }
  blocks.push({ type: "text", text: "JSON 객체 하나만 답하라. 코드 울타리·설명 글 없이." });
  const started = Date.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn("claude", ["-p", "--bare", "--model", "sonnet", "--effort", effort, "--system-prompt", system || "JSON 하나만 답한다.",
      "--tools", "", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--no-session-persistence"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      const result = stdout.trim().split("\n").map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean).find((e) => e.type === "result");
      const text = String(result?.result ?? "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      appendFileSync(relayLog, JSON.stringify({ at: new Date().toISOString(), surface, ms: Date.now() - started, code, model: Object.keys(result?.modelUsage ?? {})[0] ?? null, images: blocks.filter((b) => b.type === "image").length, answerChars: text.length, error: result?.is_error ? result.result : (code ? stderr.slice(0, 300) : null) }) + "\n");
      if (code !== 0 || !result || result.is_error) reject(Object.assign(new Error(`relay 실패: ${String(result?.result ?? stderr).slice(0, 200)}`), { status: 500 }));
      else resolvePromise(text);
    });
    child.stdin.end(JSON.stringify({ type: "user", message: { role: "user", content: blocks } }) + "\n");
  });
}

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(180_000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.exposeFunction("__ogRelay", relay);
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  window.__oprnWorkshopChat = (surface, request) => window.__ogRelay(surface, JSON.stringify({ messages: request.messages, temperature: request.temperature }));
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__oprnEditorStore), null, { timeout: 240_000 });
console.log("editor ready");

const body = (req) => new Promise((resolveBody) => { let s = ""; req.on("data", (d) => { s += d; }); req.on("end", () => resolveBody(s ? JSON.parse(s) : {})); });
const writeDataUrl = (path, dataUrl) => writeFileSync(path, Buffer.from(dataUrl.split(",")[1], "base64"));

const handlers = {
  async "POST /load"({ path, mapId }) {
    const json = readFileSync(path, "utf8");
    return page.evaluate(async ({ json, mapId }) => {
      const project = JSON.parse(json);
      window.__oprnEditorStore.replaceProject(project);
      if (mapId) {
        const { editorState } = await import("/src/editor/editorState.ts");
        editorState.set({ currentMapId: mapId });
      }
      return { maps: Object.keys(window.__oprnEditorStore.getCurrent().maps) };
    }, { json, mapId });
  },
  async "POST /render"({ mapId, x, y, w, h, out: file }) {
    const result = await page.evaluate(async ({ mapId, x, y, w, h }) => {
      const { getTool } = await import("/src/editor/tools/toolRegistry.ts");
      const { renderToolImages } = await import("/src/ai/toolImageRenderer.ts");
      const project = window.__oprnEditorStore.getCurrent();
      const data = getTool("show_map_region").run(project, { mapId, x, y, w, h }).data;
      const images = await renderToolImages(project, "show_map_region", data);
      return images[0]?.dataUrl ?? null;
    }, { mapId, x, y, w, h });
    if (!result) throw new Error("렌더 실패");
    writeDataUrl(file, result);
    return { file };
  },
  async "POST /card"({ request, autopick }) {
    return page.evaluate(async ({ request, autopick }) => {
      localStorage.setItem("oprn:assistant-objectgen-autopick", autopick ? "1" : "0");
      document.querySelector("#og-card-host")?.remove();
      const host = document.createElement("div");
      host.id = "og-card-host";
      host.style.cssText = "position:fixed;right:16px;top:16px;width:440px;max-height:92vh;overflow:auto;z-index:99999;background:var(--bg-base,#17151d);padding:4px;border-radius:14px;box-shadow:0 8px 40px #0008";
      document.body.append(host);
      window.__ogFollowUp = null;
      const { createObjectGenCard } = await import("/src/editor/panels/aiObjectGenCard.ts");
      host.append(createObjectGenCard(request, (text) => { window.__ogFollowUp = text; }));
      return { ok: true };
    }, { request, autopick });
  },
  async "GET /card"() {
    return page.evaluate(() => {
      const card = document.querySelector('[data-testid="ai-objectgen-card"]');
      return {
        status: card?.querySelector('[role="status"]')?.textContent ?? null,
        runs: [...(card?.querySelectorAll(".ai-objectgen-candidate") ?? [])].map((node) => ({ letter: node.dataset.letter, status: node.dataset.status, verdict: node.dataset.verdict })),
        followUp: window.__ogFollowUp,
      };
    });
  },
  async "POST /click"({ testid, letter }) {
    const selector = letter ? `.ai-objectgen-candidate[data-letter="${letter}"] [data-testid="${testid}"]` : `[data-testid="${testid}"]`;
    await page.locator(selector).first().click();
    return { clicked: selector };
  },
  async "POST /shot"({ out: file, selector }) {
    if (selector) await page.locator(selector).first().screenshot({ path: file });
    else await page.screenshot({ path: file });
    return { file };
  },
  async "POST /export"({ path }) {
    const json = await page.evaluate(() => JSON.stringify(window.__oprnEditorStore.getCurrent()));
    writeFileSync(path, json);
    return { path, bytes: json.length };
  },
  async "GET /errors"() { return { pageErrors }; },
};

createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split("?")[0]}`;
  try {
    const handler = handlers[key];
    if (!handler) throw new Error(`모르는 명령 ${key}`);
    const result = await handler(req.method === "POST" ? await body(req) : {});
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(error?.message ?? error) }));
  }
}).listen(port, "127.0.0.1", () => console.log(`driver on ${port}`));
