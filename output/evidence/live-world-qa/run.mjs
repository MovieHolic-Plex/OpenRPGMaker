import { chromium } from "playwright-core";
import { Agent, get } from "node:http";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectId = process.env.QA_PROJECT_ID;
if (!projectId?.startsWith("rpg-zzu-qa-world-")) throw new Error("A separate QA project ID is required");
const origin = "http://127.0.0.1:9867";
const directory = path.resolve("output/evidence/live-world-qa");
const resume = process.env.QA_RESUME === "1";
const attempt = process.env.QA_ATTEMPT ?? "initial";
mkdirSync(directory, { recursive: true });
const logPath = path.join(directory, `${attempt}-events.jsonl`);
const log = (entry) => appendFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
const save = (name, value) => writeFileSync(path.join(directory, `${attempt}-${name}`), typeof value === "string" ? value : JSON.stringify(value, null, 2));

const prompt = process.env.QA_PROMPT_FILE ? readFileSync(process.env.QA_PROMPT_FILE, "utf8") : `이 별도 QA 프로젝트에서 실제로 걸어 다닐 수 있는 큰 월드맵을 완성해줘.
${resume ? "이미 만든 결과와 거점을 보존하고, 아래 원래 요구에서 미완성인 부분만 이어서 보완해라." : "현재 빈 시작 맵을 가로 128칸, 세로 128칸으로 확장하고 이름을 '여섯 지역 탐험지도'로 정해라."}

필수 결과:
1. 월드맵은 정확히 128×128이다. 한 귀퉁이만 꾸미지 말고 지도 전체에 지형과 탐험 경로를 구성해라.
2. 서로 눈으로 구분되는 여섯 지역: 초원, 침엽수숲, 바위산지, 모래황야, 설원, 해안습지. 이름만 기록하거나 타일 한 칸으로 표시하지 말고 실제 넓은 지형으로 만들어라.
3. 이름이 다른 거점 여덟 곳: 남쪽항구(부두), 초원마을(집들), 숲속마을(집들), 호수쉼터(호수와 쉼터), 산길초소(초소 구조물), 황야유적(석재 유적), 설원마을(눈 지역의 집들), 습지연구소(연구소 건물).
4. 거점은 안내 표지나 이름뿐이면 안 된다. 실제로 보이는 건물 또는 구조물이 있어야 한다. 각 거점 앞 접근 가능한 곳에 그 거점 이름을 알려주는 안내 이벤트를 두어라.
5. 시작 위치는 남쪽항구의 안전하게 걸을 수 있는 지점이다. 시작점에서 모든 거점 앞까지 길을 따라 걸어갈 수 있어야 한다. 물·절벽·건물에 막힌 길은 우회로나 실제 통행 가능한 연결로 해결해라. 순간이동이나 디버그 위치 변경으로 이동 검증을 대신하지 마라.
6. 각 지역/거점의 위치를 계획과 결과에 남기고, 실제 맵 전체를 이미지로 확인해 미완성 경계·막힌 길·겹친 구조물을 수정해라.

지역별 시공, 거점별 시공, 연결, 검수를 독립적으로 진행할 수 있는 todo로 나눠라. 개수를 줄이려고 한 항목으로 뭉개지 마라. 위 요구가 남았는데 완료라고 하지 말고 계속 수정해라. 결과는 이 QA 프로젝트에 저장하고, 재로드 후에도 동일한지 확인해라. 다른 프로젝트나 공유 갤러리는 건드리지 마라.

${process.env.QA_FEEDBACK_FILE ? readFileSync(process.env.QA_FEEDBACK_FILE, "utf8") : ""}`;
save("prompt.txt", prompt);
save("run-config.json", { projectId, attempt, resume, pid: process.pid, provider: "google-antigravity", model: "gemini-3.7-flash", autonomyLevel: "max" });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-features=LocalNetworkAccessChecks", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const agent = new Agent({ keepAlive: false, maxSockets: 12 });
let page;
let pendingCapture = Promise.resolve();
process.on("SIGUSR2", () => {
  log({ type: "operator-abort" });
  if (page && !page.isClosed()) {
    void page.evaluate(() => window.__oprnAiBridge?.abort()).catch(error => log({ type: "abort-error", message: error.message }));
  }
});
try {
  page = await context.newPage();
  page.on("crash", () => {
    log({ type: "page-crash" });
    console.error("RUN_ERROR Renderer crashed");
    void browser.close().catch(error => log({ type: "crash-close-error", message: error.message }));
  });
  page.on("pageerror", error => log({ type: "pageerror", message: error.message }));
  page.on("response", response => {
    if (response.url().includes("/v1/chat/completions")) log({ type: "model-http", status: response.status() });
  });
  page.on("request", request => {
    if (request.method() !== "POST" || !request.url().includes("/v1/chat/completions")) return;
    const body = request.postDataJSON();
    log({ type: "model-request", model: body.model, toolCount: body.tools?.length ?? 0, hasTools: Boolean(body.tools?.length), hasPreciseTilePainting: Boolean(body.tools?.some(tool => tool.function?.name === "paint_tiles")), reasoning: body.reasoning, thinking: body.thinking });
  });
  // Only static GET transport is relayed. Auth, model and DB responses remain real.
  await page.route(`${origin}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" || !(url.pathname === "/" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) return route.fallback();
    const response = await new Promise((resolve, reject) => {
      const outgoing = get(url, { agent }, incoming => {
        const chunks = [];
        incoming.on("data", chunk => chunks.push(chunk));
        incoming.once("error", reject);
        incoming.once("end", () => resolve({
          status: incoming.statusCode ?? 502,
          headers: Object.fromEntries(Object.entries(incoming.headers).filter(([, value]) => typeof value === "string")),
          body: Buffer.concat(chunks),
        }));
      });
      outgoing.once("error", reject);
      outgoing.setTimeout(120_000, () => outgoing.destroy(new Error(`Static GET deadline: ${url.pathname}`)));
    });
    await route.fulfill(response);
  });
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.fallback();
    const body = request.postDataJSON();
    const ids = [];
    for (const row of Array.isArray(body) ? body : [body]) {
      if (!row || typeof row !== "object") continue;
      for (const key of ["project_id", "projectId", "p_project_id"]) {
        if (typeof row[key] === "string") ids.push(row[key]);
      }
    }
    const projectFilter = new URL(request.url()).searchParams.get("project_id");
    if (projectFilter?.startsWith("eq.")) ids.push(projectFilter.slice(3));
    if (ids.some(id => id !== projectId)) {
      log({ type: "foreign-write-blocked", method: request.method(), ids });
      throw new Error("Refusing mutation of a non-QA project");
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(10_000);
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({
      configVersion: 2, authMode: "chatgpt", providerId: "google-antigravity",
      model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash",
      agentMode: "auto", autonomyLevel: "max", reasoningEffort: "high",
    }));
  });
  const open = async url => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.getByTestId("login-guest").or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 180_000 });
    if (await page.getByTestId("login-guest").isVisible()) await page.getByTestId("login-guest").click();
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 180_000 });
    await page.getByTestId("ai-input").waitFor({ state: "visible", timeout: 180_000 });
  };
  if (!resume) {
    await open(`${origin}/?blankProject=1&project=${encodeURIComponent(projectId)}&aiBridge=0`);
    const seeded = await page.evaluate(async id => {
      const defaultsPath = "/src/project/defaults.ts";
      const syncPath = "/src/project/legacyDbProjectSync.ts";
      const configPath = "/src/project/legacyDbProjectConfig.ts";
      const { createBlankProject } = await import(defaultsPath);
      const { saveProjectToLegacyDb, loadProjectFromLegacyDb } = await import(syncPath);
      const { legacyDbProjectConfig } = await import(configPath);
      const config = legacyDbProjectConfig();
      if (!config || config.projectId !== id || config.url !== "/legacyDb") throw new Error("QA proxy/project isolation is not active");
      if (await loadProjectFromLegacyDb(config)) throw new Error("QA project already exists; use explicit resume");
      const project = createBlankProject();
      project.meta.title = "실제 AI 대형 월드맵 QA";
      const result = await saveProjectToLegacyDb(project, config);
      if (result.kind !== "saved") throw new Error("Empty QA baseline save failed");
      const loaded = await loadProjectFromLegacyDb(config);
      if (!loaded || loaded.meta.title !== project.meta.title) throw new Error("Empty QA baseline reload failed");
      return { projectId: id, saved: true, reloaded: true, mapCount: Object.keys(loaded.maps).length };
    }, projectId);
    save("baseline-proof.json", seeded);
    console.log("BASELINE_SAVED", JSON.stringify(seeded));
  }
  await open(`${origin}/?project=${encodeURIComponent(projectId)}&aiBridge=0`);
  const liveStoreUrl = await page.evaluate(() => {
    const url = performance.getEntriesByType("resource").map(entry => entry.name)
      .findLast(name => new URL(name).pathname === "/src/project/store.ts");
    if (!url) throw new Error("Actual editor store module was not observed");
    return url;
  });
  const connected = await page.evaluate(async ({ id, storePath, resume }) => {
    const configPath = "/src/project/legacyDbProjectConfig.ts";
    const authPath = "/src/ai/chatgptOAuthClient.ts";
    const { store } = await import(storePath);
    const { legacyDbProjectConfig } = await import(configPath);
    const { fetchChatGptAuthStatus, hasStoredCompanionCredential } = await import(authPath);
    if (legacyDbProjectConfig()?.projectId !== id || !store.isRemotePersistenceEnabled()) throw new Error("Normal QA editor is not remotely persistent");
    const map = store.getCurrent().maps[store.getCurrent().startMapId];
    if (resume && (map.width !== 128 || map.height !== 128)) throw new Error("Resume did not load the authored 128x128 world");
    const auth = await fetchChatGptAuthStatus("google-antigravity");
    if (!hasStoredCompanionCredential(auth)) throw new Error("Real model provider is not connected");
    return { projectId: id, remotePersistence: true, providerConnected: true, storePath, width: map.width, height: map.height };
  }, { id: projectId, storePath: liveStoreUrl, resume });
  save("connection.json", connected);
  console.log("CONNECTED", JSON.stringify(connected));
  const failures = new Set();
  let lastProgress = "";
  await page.exposeFunction("__worldQaEvent", event => {
    log(event);
    if (event.type === "work_plan") {
      const items = event.plan.layers.flatMap(layer => layer.items);
      const done = items.filter(item => item.status === "done").length;
      const key = `${event.plan.id}:${items.length}:${Math.floor(done / 5)}`;
      if (key !== lastProgress) {
        lastProgress = key;
        console.log("PLAN", JSON.stringify({ items: items.length, done }));
        pendingCapture = pendingCapture.then(() => page.screenshot({ path: path.join(directory, `${attempt}-progress-${items.length}-${done}.png`) }));
      }
    }
    if (event.type === "tool_call" && !event.ok) {
      const key = `${event.name}:${event.summary}`;
      if (!failures.has(key)) { failures.add(key); console.log("TOOL_FAIL", key); }
    }
  });
  await page.evaluate(async () => {
    const modulePath = performance.getEntriesByType("resource").map(entry => entry.name)
      .findLast(name => new URL(name).pathname === "/src/ai/assistantSession.ts");
    if (!modulePath) throw new Error("Actual assistant module was not observed");
    const { AssistantSession } = await import(modulePath);
    const original = AssistantSession.prototype.sendUserMessage;
    AssistantSession.prototype.sendUserMessage = function (text, onEvent, signal, options) {
      return original.call(this, text, event => {
        onEvent?.(event);
        const captured = event.type === "tool_call"
          ? { type: event.type, name: event.name, args: event.args, ok: event.result.ok, summary: event.result.summary, issues: event.result.issues }
          : event.type === "assistant_token" || event.type === "reasoning_token" ? null : event;
        if (captured) void window.__worldQaEvent(captured);
      }, signal, options);
    };
  });
  console.log("RUN_STARTED", projectId);
  const result = await page.evaluate(text => window.__oprnAiBridge.send(text), prompt);
  save("result.json", result);
  await pendingCapture;
  await page.screenshot({ path: path.join(directory, `${attempt}-finished.png`) });
  const persistence = await page.evaluate(async ({ id, storePath }) => {
    const syncPath = "/src/project/legacyDbProjectSync.ts";
    const configPath = "/src/project/legacyDbProjectConfig.ts";
    const { store } = await import(storePath);
    const { saveProjectToLegacyDb, loadProjectFromLegacyDb } = await import(syncPath);
    const { legacyDbProjectConfig } = await import(configPath);
    const config = legacyDbProjectConfig();
    if (!config || config.projectId !== id || !store.isRemotePersistenceEnabled()) throw new Error("Lost QA persistence ownership");
    const map = store.getCurrent().maps[store.getCurrent().startMapId];
    if (map.width !== 128 || map.height !== 128) throw new Error("Refusing to overwrite the authored world with a different map size");
    const flushed = await store.flush();
    if (flushed.kind === "not-loaded") throw new Error("Refusing to save an uninitialized store instance");
    const saved = await saveProjectToLegacyDb(store.getCurrent(), config);
    if (saved.kind !== "saved") throw new Error("Final remote save failed");
    const project = await loadProjectFromLegacyDb(config);
    if (!project) throw new Error("Final remote reload failed");
    return { saved: true, reloaded: true, flushKind: flushed.kind, projectId: id, project, sha256: saved.sha256 };
  }, { id: projectId, storePath: liveStoreUrl });
  save("project.json", persistence.project);
  save("persistence.json", { ...persistence, project: undefined });
  console.log("RUN_FINISHED", JSON.stringify({
    ok: result.ok, completion: result.harness?.acceptance?.status, status: result.status, assistant: result.lastAssistantText,
    maps: Object.values(persistence.project.maps).map(map => ({ id: map.id, name: map.name, width: map.width, height: map.height, events: map.events.length })),
  }));
} catch (error) {
  log({ type: "runner-error", message: error.message, stack: error.stack });
  console.error("RUN_ERROR", error.message);
  process.exitCode = 1;
} finally {
  await pendingCapture.catch(error => console.error("CAPTURE_ERROR", error.message));
  await context.close();
  await browser.close();
  agent.destroy();
  save("cleanup.json", { browser: true, context: true, relay: true });
  console.log("CLEANUP_DONE");
}
