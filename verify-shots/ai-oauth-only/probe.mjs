// AI OAuth 전용 배선 실측 프로브.
// 에디터를 실제 브라우저로 띄워 ① 부팅 설정이 OAuth 인지 ② 현재 설정 표면이 어떤 제공자를
// 가리키는지 ③ 실제 LLM 턴이 도는지를 네트워크 레벨에서 확인하고 스샷을 남긴다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
mkdirSync(OUT, { recursive: true });

const log = [];
const say = (line) => {
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const llmCalls = [];
page.on("request", (req) => {
  const url = req.url();
  if (/\/chat\/completions/.test(url)) llmCalls.push({ method: req.method(), url });
});
page.on("response", async (res) => {
  const url = res.url();
  if (/\/chat\/completions/.test(url)) {
    const hit = llmCalls.find((c) => c.url === url && c.status === undefined);
    if (hit) hit.status = res.status();
  }
});
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
// 에디터 셸이 붙을 시간.
await page.waitForTimeout(6000);

// ① 부팅 설정 — llmClient 가 브라우저에서 실제로 무엇을 골랐는지.
const cfg = await page.evaluate(async () => {
  const mod = await import("/src/ai/llmClient.ts");
  const c = mod.loadAiConfig();
  return {
    authMode: c.authMode,
    providerId: c.providerId,
    baseUrl: c.baseUrl,
    model: c.model,
    liteModel: c.liteModel,
    apiKeyEmpty: !c.apiKey,
    storedRaw: localStorage.getItem("rpg-zzu:ai-config"),
  };
});
say(`[config] authMode=${cfg.authMode} providerId=${cfg.providerId} baseUrl="${cfg.baseUrl}" model=${cfg.model} lite=${cfg.liteModel} apiKeyEmpty=${cfg.apiKeyEmpty}`);
say(`[config] localStorage=${cfg.storedRaw ?? "(none)"}`);

// ② 현재 설정의 제공자.
const provider = await page.evaluate(async () => {
  const config = await import("/src/ai/llmClient.ts");
  const registry = await import("/src/ai/ohMyPiProviders.ts");
  const c = config.loadAiConfig();
  return registry.getOhMyPiProvider(registry.parseOhMyPiProvider(c.providerId))?.label ?? c.providerId;
});
say(`[provider] ${provider}`);

// ③ 실제 턴 — 에디터가 쓰는 클라이언트로 한 번 호출한다(툴 없이 최소 본문).
const turn = await page.evaluate(async () => {
  try {
    const mod = await import("/src/ai/llmClient.ts");
    const cfg = mod.loadAiConfig();
    const res = await mod.chatCompletion(
      { ...cfg, maxTokens: 256 },
      { messages: [{ role: "user", content: "reply with the single word OK" }] },
    );
    const content = res?.message?.content;
    return { ok: true, content: typeof content === "string" ? content.slice(0, 120) : JSON.stringify(res).slice(0, 200) };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 400) };
  }
});
say(`[turn] ${turn.ok ? `OK → "${turn.content}"` : `FAIL → ${turn.error}`}`);
say(`[network] chat/completions calls: ${JSON.stringify(llmCalls)}`);
if (consoleErrors.length) say(`[console errors] ${consoleErrors.slice(0, 6).join(" || ")}`);

await page.screenshot({ path: join(OUT, "editor-oauth.png"), fullPage: false });
writeFileSync(join(OUT, "probe-log.txt"), `${log.join("\n")}\n`, "utf8");
await browser.close();
