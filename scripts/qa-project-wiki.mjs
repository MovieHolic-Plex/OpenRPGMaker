// Live OAuth/editor proof. No LLM responses or project saves are mocked.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(key);
  return index < 0 ? fallback : args[index + 1];
};
const baseUrl = option("--base-url", "http://127.0.0.1:9857");
const scenario = option("--scenario", "oauth-combat");
const projectId = option("--project-id", `qa-project-wiki-${Date.now()}`);
const out = resolve("output/evidence/project-wiki");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const transcript = [];
const failures = [];
const wikiReplies = [];
page.on("pageerror", (error) => failures.push(error.message));
// Same upstream bytes, using Node transport for this host's Chromium netlink churn.
await page.route("**/*", async (route) => {
  const request = route.request();
  if (!/^https?:/.test(request.url())) return route.continue();
  if (new URL(request.url()).port === "17831") return route.continue();
  const response = await fetch(request.url(), {
    method: request.method(), headers: request.headers(),
    body: ["GET", "HEAD"].includes(request.method()) ? undefined : request.postDataBuffer(),
  });
  const headers = Object.fromEntries(response.headers);
  delete headers["content-encoding"]; delete headers["content-length"];
  headers["access-control-allow-origin"] = "*";
  const body = Buffer.from(await response.arrayBuffer());
  if (request.url().endsWith("/v1/chat/completions")) {
    const input = request.postDataJSON();
    try {
      const payload = JSON.parse(input.messages?.at(-1)?.content ?? "null");
      if (Array.isArray(payload?.sources)) wikiReplies.push({ model: input.model, userText: payload.userText, status: response.status, response: body.toString("utf8") });
    } catch { /* Non-wiki chat messages are not JSON input. */ }
  }
  await route.fulfill({ status: response.status, headers, body });
});
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
});
const state = () => page.evaluate(() => {
  const store = window.__oprnEditorStore;
  const project = store.getCurrent();
  return {
    identity: store.getProjectIdentity(),
    world: project.world,
    actionCombat: project.system.actionCombat,
    maps: Object.values(project.maps).map((map) => ({
      id: map.id, name: map.name, actionCombat: map.actionCombat,
      encounterRate: map.encounterRate, fieldSpawns: map.fieldSpawns,
    })),
  };
});
async function send(text) {
  const done = page.waitForRequest((request) => request.url().endsWith("/__oprn/ai-activity")
    && request.method() === "POST" && request.postDataJSON().instruction === text
    && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 240_000 });
  await page.getByTestId("ai-input").fill(text);
  await page.getByTestId("ai-send").click();
  const result = (await done).postDataJSON().result;
  // The activity record precedes proposal application. Subscribe to the panel's
  // actual busy-to-idle DOM state instead of assuming the final model text saved.
  await page.evaluate(() => new Promise((resolveIdle, reject) => {
    let timeout;
    const observer = new MutationObserver(check);
    function check() {
      const abort = document.querySelector('[data-testid="ai-abort"]');
      const busy = abort instanceof HTMLButtonElement && !abort.disabled && abort.getClientRects().length > 0;
      if (!busy) { observer.disconnect(); clearTimeout(timeout); resolveIdle(); }
    }
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
    timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Editor did not finish applying")); }, 120_000);
    check();
  }));
  transcript.push({ prompt: text, result: { stoppedReason: result.stoppedReason, error: result.error, assistantText: result.assistantText }, state: await state() });
  console.log(`TURN ${transcript.length}: ${result.stoppedReason}`);
  if (result.stoppedReason !== "final") throw new Error(result.error || result.stoppedReason);
}
try {
  if (scenario !== "oauth-combat") throw new Error(`Unknown scenario ${scenario}`);
  await page.goto(`${baseUrl}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    if (await page.getByTestId(id).isVisible()) await page.getByTestId(id).click();
  }
  await page.evaluate(async ({ projectId }) => {
    const { createBlankProject } = await import("/src/project/defaults.ts");
    const { defaultAiConfig, saveAiConfig } = await import("/src/ai/llmClient.ts");
    saveAiConfig({ ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 24 });
    const store = window.__oprnEditorStore;
    await store.loadNewRemoteProject(createBlankProject(), { projectId, title: "프로젝트 위키 전투 검증" });
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error(`Initial remote save: ${saved.kind}`);
  }, { projectId });
  await send("이 게임은 몬스터에 닿으면 전투 화면에서 명령을 골라 싸우는 JRPG야. 왕국 이름은 푸른별이야. 지금은 설정만 기록하고 맵은 바꾸지 마.");
  const first = await state();
  if (!first.world?.entities.some((entity) => entity.wiki?.combatMode === "contact")) throw new Error("Contact decision missing");
  await page.getByTestId("ai-new-chat").click();
  await send("이 게임의 왕국 이름과 전투 방식을 알려줘. 변경은 하지 마.");
  if (!transcript.at(-1).result.assistantText?.includes("푸른별")) throw new Error("New chat did not recall kingdom");
  await send("현재 빈 맵에 슬라임을 한 마리 배치해줘. 전투 방식은 기존 설정을 따라. 출현 영역은 x=6,y=5,w=1,h=1, 최대 한 마리, 추격하지 않고 제자리에 있게 해줘. 시작 위치는 5,5로 하고 지형은 바꾸지 마.");
  await page.screenshot({ path: `${out}/live-contact-editor.png` });
  const contact = (await state()).maps.find((map) => map.id === "map_blank_start");
  if (!contact?.fieldSpawns?.length || contact.actionCombat === true || contact.encounterRate !== 0) throw new Error("Contact authoring mismatch");
  await send("이제 게임의 기본 전투는 맵 위에서 직접 칼로 공격하는 액션 RPG로 바꿀게. 단 기존 '빈 맵'만 몬스터 접촉 시 전투 화면으로 가는 방식을 유지해. 새 '액션 검증장' 20x15 맵을 만들고, x=6,y=5,w=1,h=1 영역에 HP 10000인 훈련 슬라임 한 마리를 제자리에 배치해. 추격하지 않고 최대 한 마리만 나오게 해. 직접 공격과 스태미나 표시도 켜줘.");
  const final = await state();
  const action = final.maps.find((map) => map.name === "액션 검증장");
  if (!action?.actionCombat || !final.actionCombat?.enabled || !action.fieldSpawns?.length) throw new Error("Action authoring mismatch");
  if (final.maps.find((map) => map.id === "map_blank_start")?.actionCombat === true) throw new Error("Map exception lost");
  const persisted = await page.evaluate(async () => {
    const store = window.__oprnEditorStore;
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error(`Remote save: ${saved.kind}`);
    const before = JSON.stringify(store.getCurrent().world);
    await store.reloadFromRemote();
    if (JSON.stringify(store.getCurrent().world) !== before) throw new Error("Remote wiki mismatch");
    return { project: store.getCurrent(), identity: store.getProjectIdentity(), sha256: saved.sha256 };
  });
  const serialized = JSON.stringify(persisted.project);
  await writeFile(`${out}/qa-project.json`, serialized);
  await page.screenshot({ path: `${out}/live-action-editor.png` });
  await writeFile(`${out}/live-oauth.json`, JSON.stringify({
    projectId, transcript, final, remote: { identity: persisted.identity, sha256: persisted.sha256 },
    artifactSha256: createHash("sha256").update(serialized).digest("hex"), failures,
  }, null, 2));
  console.log(`PASS OAuth wiki/save/reload: ${projectId}`);
} finally {
  await writeFile(`${out}/live-transcript.json`, JSON.stringify({ projectId, transcript, wikiReplies, failures }, null, 2));
  await context.close();
  await browser.close();
  console.log("CLEANUP browser/context closed");
}
