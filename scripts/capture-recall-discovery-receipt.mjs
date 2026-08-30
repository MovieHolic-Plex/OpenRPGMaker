// 회상 요청의 "발견 계층" 입력측 영수증 + 비주얼 QA — 2026-08-30.
//
// 무엇을 증명하는가: 회상 요청을 받은 모델이 **실제로 손에 쥐는 것**이 무엇인가.
// 네 층(도메인 키워드+40상한 / 능력 색인 / capabilityEscalation / find_tools)을 각각
// 실제 앱 모듈로 돌려 script_cutscene 이 잡히는지 층별로 기록한다.
//
// 왜 LLM 을 부르지 않는가: 모델 응답을 받으려면 공급자·크레덴셜 결정이 필요하고 그건 대기 중이다.
// 다만 "모델이 발견에 필요한 정보를 받았는가"는 입력측만으로 결정적으로 답할 수 있다 —
// 받았는데 못 썼다면 그건 발견 계층 결함이 아니라 다른 결함이다.
import playwrightPkg from "/home/main/z-project/rpg-zzu/node_modules/playwright/index.js";
import fs from "node:fs";
import path from "node:path";

const { chromium } = playwrightPkg;

const PORT = process.env.CAP_PORT ?? "9632";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve("reports/shots/recall-discovery-2026-08-30");
fs.mkdirSync(OUT, { recursive: true });

const log = (...args) => console.log("[recall]", ...args);
const shot = async (page, name, locator) => {
  await (locator ?? page).screenshot({ path: path.join(OUT, `${name}.png`) });
  log("shot", name);
};

/** 실측 대상 문구 — 짧은 것부터 긴 것까지. 짧은 요청이 통과선에서 떨어지는 것을 보려고 섞었다. */
const REQUESTS = [
  "회상 장면 하나 넣어줘. 플레이어는 아무것도 못 하고 보기만 하게.",
  "회상 장면 하나 넣어줘",
  "플래시백 넣어줘",
  "시네마틱 하나 넣어줘",
  "오프닝 무비 만들어줘",
  "주인공이 과거를 떠올리는 장면 만들어줘",
];

const TARGETS = ["script_cutscene", "script_cutscene_preset", "upsert_event"];

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 300)));

await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(9000);
await shot(page, "00-editor-boot");

// ── 층별 실측: 실제 앱 모듈을 그대로 돌린다 ────────────────────────────────────
const layers = await page.evaluate(
  async ({ requests, targets }) => {
    const mode = await import("/src/editor/assistantToolMode.ts");
    const registry = await import("/src/editor/tools/toolRegistry.ts");
    const index = await import("/src/ai/toolCapabilityIndex.ts");
    const escalation = await import("/src/ai/capabilityEscalation.ts");
    const discovery = await import("/src/editor/tools/discoveryTools.ts");
    const ctx = await import("/src/ai/contextBuilder.ts");
    const { store } = await import("/src/project/store.ts");

    const capabilityIndex = index.buildToolCapabilityIndex();
    const systemPrompt = ctx.buildSystemPrompt(store.getCurrent(), {});

    const rows = requests.map((text) => {
      const domains = [...mode.computeActiveToolDomains(text)].sort();
      const exposed = registry.toOpenAiTools(undefined, { domains: mode.computeActiveToolDomains(text) })
        .map((t) => t.function.name);
      const escalated = escalation.capabilityEscalatedToolNames(text, new Set(exposed));
      // find_tools 는 모델이 직접 부르는 층 — 요청 문구를 그대로 질의로 넣었을 때의 점수.
      const findScores = targets.map((name) => {
        const tool = registry.allTools().find((t) => t.name === name);
        return { name, score: tool ? discovery.matchScore(tool.name, tool.description, text) : null };
      });
      return {
        request: text,
        domains,
        exposedCount: exposed.length,
        layer1_exposed: targets.filter((n) => exposed.includes(n)),
        layer2_inCapabilityIndex: targets.filter((n) => capabilityIndex.includes(n)),
        layer3_escalated: targets.filter((n) => escalated.includes(n)),
        layer4_findToolsScore: findScores,
      };
    });

    return {
      capabilityIndexChars: capabilityIndex.length,
      capabilityIndexHasTargets: targets.filter((n) => capabilityIndex.includes(n)),
      systemPromptChars: systemPrompt.length,
      systemPromptHasIndexHeading: systemPrompt.includes(index.TOOL_CAPABILITY_INDEX_HEADING),
      systemPromptHasTargets: targets.filter((n) => systemPrompt.includes(n)),
      minEscalationScore: escalation.MIN_CAPABILITY_MATCH_SCORE,
      rows,
    };
  },
  { requests: REQUESTS, targets: TARGETS },
);

log("capability index chars:", layers.capabilityIndexChars);
log("system prompt chars:", layers.systemPromptChars, "· 색인 포함:", layers.systemPromptHasIndexHeading);
log("system prompt 안의 대상 툴:", layers.systemPromptHasTargets.join(", ") || "(없음)");
for (const row of layers.rows) {
  log(
    `"${row.request}"`,
    `\n    도메인=${row.domains.join("+")} 노출=${row.exposedCount}`,
    `\n    1 노출: ${row.layer1_exposed.join(",") || "-"}`,
    `\n    2 색인: ${row.layer2_inCapabilityIndex.join(",") || "-"}`,
    `\n    3 승격: ${row.layer3_escalated.join(",") || "-"}`,
    `\n    4 find_tools 점수: ${row.layer4_findToolsScore.map((s) => `${s.name}=${s.score}`).join(" ")}`,
  );
}

// ── 비주얼 QA: AI 패널에 실제 요청이 들어간 화면 ────────────────────────────────
const composer = page.getByTestId("ai-input").first();
if (await composer.count()) {
  await composer.fill(REQUESTS[0]);
  await page.waitForTimeout(600);
  await shot(page, "01-ai-panel-request-typed");
  const panel = page.locator("[data-testid='ai-panel'], .ai-assistant-panel").first();
  if (await panel.count()) await shot(page, "01b-ai-panel-only", panel);
} else {
  log("경고: ai-input 을 못 찾았다 — 패널 캡처 생략");
}

fs.writeFileSync(
  path.join(OUT, "discovery-receipt.json"),
  JSON.stringify({ port: PORT, generatedAt: new Date().toISOString(), pageErrors, ...layers }, null, 2),
);
log("wrote discovery-receipt.json · pageErrors:", pageErrors.length);

await browser.close();
log("done →", OUT);
