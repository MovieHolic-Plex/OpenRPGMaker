/**
 * 라이브 에디터 AI → 제안 수락 → Supabase 저장 경로를 직렬로 실행한다.
 * 현재 회귀 시나리오는 다중 대사 페이지 상인의 재고를 다시 설정해 모든 활성 페이지에서
 * 상점이 열리는지 확인한다. 실행 후 verify-ai-editor-project.mts 로 재로드·런타임을 검증한다.
 *
 * 사용:
 *   node scripts/run-ai-editor-composite-e2e.mjs <project-id> --execute
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const projectId = process.argv[2]?.trim();
if (!projectId || projectId.startsWith("--") || !process.argv.includes("--execute")) {
  throw new Error("사용: node scripts/run-ai-editor-composite-e2e.mjs <project-id> --execute");
}

function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
const supabase = {
  source: "custom",
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId,
};
if (!supabase.url || !supabase.anonKey) throw new Error("Supabase 설정이 없습니다.");

const baseUrl = process.env.RPGZZU_EDITOR_URL ?? "http://127.0.0.1:9999";
const outputDir = path.resolve(".omo/evidence/editor-ai-phase2");
fs.mkdirSync(outputDir, { recursive: true });
const prompt = [
  "현재 원격 프로젝트의 상점 런타임 회귀를 고쳐.",
  "먼저 map_blank_start의 npc_mina_merchant를 get_event로 읽어.",
  "그 다음 set_shop_stock 도구로 item_ether와 item_antidote 두 재고를 다시 설정해.",
  "기존 이벤트와 다른 프로젝트 콘텐츠는 모두 보존해.",
  "마지막에 get_event로 다시 읽어 상점 커맨드가 보존됐는지 확인하고 적용 가능한 제안으로 끝내.",
].join(" ");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ remote, aiConfig }) => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
    localStorage.setItem("oprn:supabase-project-config", JSON.stringify(remote));
    localStorage.setItem("oprn:ai-config", JSON.stringify(aiConfig));
  },
  {
    remote: supabase,
    aiConfig: {
      authMode: "chatgpt",
      providerId: "openai-codex",
      baseUrl: "",
      model: "gpt-5.6-sol",
      liteModel: "gpt-5.6-sol",
      apiKey: "",
      maxToolCalls: 200,
      maxTokens: 32768,
      reasoningEffort: "low",
      // 수동 채팅 모드는 변경안을 제안으로 남겨 승인 버튼까지 E2E로 검증한다.
      agentMode: "chat",
      autoApprove: false,
    },
  },
);

const page = await context.newPage();
page.setDefaultTimeout(90_000);
await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}&aiBridge=0`, {
  waitUntil: "domcontentloaded",
  timeout: 90_000,
});
const guest = page.getByTestId("login-guest");
if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
await page.waitForFunction(() => typeof window.__oprnAiBridge?.send === "function", null, { timeout: 60_000 });

await page.waitForFunction(
  () => document.querySelector("[data-testid='ai-connection-status']")?.textContent?.includes("OpenAI Codex") === true,
  null,
  { timeout: 30_000 },
);
let providerLabel = (await page.getByTestId("ai-connection-status").textContent())?.trim() ?? "";
if (!providerLabel.includes("OpenAI Codex")) throw new Error(`예상하지 않은 제공자 상태: ${providerLabel}`);
await page.screenshot({ path: path.join(outputDir, "live-composite-before.png"), animations: "disabled" });

const turn = await page.evaluate(
  async ({ text, timeoutMs }) => {
    const bridge = window.__oprnAiBridge;
    if (!bridge?.send) return { ok: false, error: "AI bridge missing" };
    return await Promise.race([
      bridge.send(text),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "AI turn timeout" }), timeoutMs)),
    ]);
  },
  { text: prompt, timeoutMs: 420_000 },
);
if (!turn?.ok) throw new Error(`AI 턴 실패: ${turn?.error ?? "unknown"}`);

const accept = page.getByTestId("ai-proposal-accept").first();
if (!(await accept.isVisible({ timeout: 15_000 }).catch(() => false))) {
  throw new Error("AI 응답은 끝났지만 적용 가능한 제안을 만들지 않았습니다.");
}
await accept.click();
await page.waitForTimeout(1_000);

const projectSnapshot = await page.evaluate(() => {
  const raw = document.querySelector("[data-testid='project-export-json']")?.textContent ?? "{}";
  const parsed = JSON.parse(raw);
  return parsed.project;
});
const merchant = projectSnapshot?.maps?.map_blank_start?.events?.find((event) => event.id === "npc_mina_merchant");
if (!merchant) throw new Error("적용 뒤 npc_mina_merchant가 없습니다.");
const pageShopCoverage = (merchant.pages ?? []).map((eventPage) =>
  (eventPage.commands ?? []).some((command) => command.kind === "shop"),
);
if (pageShopCoverage.length === 0 || pageShopCoverage.some((covered) => !covered)) {
  throw new Error(`적용 뒤 상점 페이지 커버리지 실패: ${JSON.stringify(pageShopCoverage)}`);
}

await page.getByTestId("toolbar-save").click();
await page.waitForTimeout(3_000);
providerLabel = (await page.getByTestId("ai-connection-status").textContent())?.trim() ?? providerLabel;
await page.screenshot({ path: path.join(outputDir, "live-composite-applied-and-saved.png"), animations: "disabled" });

const audit = Array.isArray(turn.audit) ? turn.audit : [];
const receipt = {
  projectId,
  providerLabel,
  prompt,
  turnOk: turn.ok,
  toolNames: audit.filter((entry) => entry.kind === "tool").map((entry) => entry.name).filter(Boolean),
  assistantFinal: turn.lastAssistantText,
  proposalApplied: true,
  pageShopCoverage,
  saveClicked: true,
};
fs.writeFileSync(path.join(outputDir, "live-composite-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
await browser.close();
