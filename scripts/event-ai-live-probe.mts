/**
 * 이벤트 에디터 「AI로 명령 만들기」 실측 프로브.
 *
 * 이벤트 도크가 실제로 모델에게 보내는 프롬프트(buildEventAssistPrompt)를 그대로 뽑아
 * 임의의 OpenAI 호환 모델에 먹이고, 돌아온 응답을 에디터와 **같은 검증기**
 * (parseAndValidate)로 채점한다. 즉 "허접하다"를 감으로 말하지 않고 실측으로 말한다.
 *
 *   npx vite-node --script scripts/event-ai-live-probe.mts emit  --out reports/event-ai-probe/run
 *   # (responses.json 을 채운 뒤)
 *   npx vite-node --script scripts/event-ai-live-probe.mts score --in  reports/event-ai-probe/run
 *   npx vite-node --script scripts/event-ai-live-probe.mts run   --out reports/event-ai-probe/run   # 라이브 1콜/시나리오
 *
 * run 모드는 env 로만 키를 읽고 저장하지 않는다.
 *   EVENT_AI_PROBE_BASE_URL  OpenAI 호환 baseUrl
 *   EVENT_AI_PROBE_API_KEY   위 엔드포인트의 키
 *   EVENT_AI_PROBE_MODEL     모델 id
 */
import fs from "node:fs";
import path from "node:path";
import { buildEventAssistPrompt, parseAndValidate, resolveAssistScope } from "../src/ai/eventCommandAssist.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { Command, EventPage, Project } from "../src/project/types.ts";
import { PROBE_SCENARIOS, type ProbeScenario } from "../src/benchmark/eventAi/scenarios.ts";

interface EmittedPrompt {
  readonly id: string;
  readonly title: string;
  readonly intent: ProbeScenario["intent"];
  readonly scope: "page" | "append";
  readonly user: string;
  readonly system: string;
  readonly systemChars: number;
  readonly before: readonly Command[];
}

interface ScoredResult {
  readonly id: string;
  readonly title: string;
  readonly intent: ProbeScenario["intent"];
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly after: readonly Command[] | null;
  readonly expectationFailures: readonly string[];
  readonly rawChars: number;
}

function scenarioProject(scenario: ProbeScenario): { project: Project; page: EventPage } {
  const project = createBlankProject();
  scenario.seed?.(project);
  const mapId = Object.keys(project.maps)[0];
  const page: EventPage = {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: structuredClone(scenario.before) as Command[],
  };
  project.maps[mapId].events = [
    { id: "ev_probe", x: 5, y: 5, pages: [page] },
  ] as Project["maps"][string]["events"];
  return { project, page };
}

function emit(outDir: string): EmittedPrompt[] {
  const prompts: EmittedPrompt[] = PROBE_SCENARIOS.map((scenario) => {
    const { project, page } = scenarioProject(scenario);
    const mapId = Object.keys(project.maps)[0];
    const system = buildEventAssistPrompt({
      project,
      mapId,
      event: project.maps[mapId].events[0],
      page,
      selection: scenario.selection ?? null,
      selectionLabel: scenario.selectionLabel,
    });
    return {
      id: scenario.id,
      title: scenario.title,
      intent: scenario.intent,
      scope: resolveAssistScope(page),
      user: scenario.prompt,
      system,
      systemChars: system.length,
      before: page.commands,
    };
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "prompts.json"), JSON.stringify(prompts, null, 2));
  return prompts;
}

function score(inDir: string): ScoredResult[] {
  const responsesPath = path.join(inDir, "responses.json");
  if (!fs.existsSync(responsesPath)) {
    console.error(`responses.json 이 없습니다: ${responsesPath}`);
    process.exit(2);
  }
  const responses = JSON.parse(fs.readFileSync(responsesPath, "utf8")) as Record<string, string>;
  const results: ScoredResult[] = PROBE_SCENARIOS.map((scenario) => {
    const { project, page } = scenarioProject(scenario);
    const raw = responses[scenario.id] ?? "";
    const allowEmpty = page.commands.length > 0;
    const parsed = parseAndValidate(project, raw, { allowEmpty });
    const after = parsed.ok ? parsed.commands : null;
    const expectationFailures = after
      ? scenario.expectations.filter((expectation) => !expectation.check(after)).map((expectation) => expectation.label)
      : scenario.expectations.map((expectation) => expectation.label);
    return {
      id: scenario.id,
      title: scenario.title,
      intent: scenario.intent,
      ok: parsed.ok,
      errors: parsed.ok ? [] : parsed.errors,
      after,
      expectationFailures,
      rawChars: raw.length,
    };
  });
  fs.writeFileSync(path.join(inDir, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(inDir, "REPORT.md"), renderReport(results));
  return results;
}

function renderReport(results: readonly ScoredResult[]): string {
  const parsedOk = results.filter((result) => result.ok).length;
  const fullyOk = results.filter((result) => result.ok && result.expectationFailures.length === 0).length;
  const lines = [
    "# 이벤트 AI 실측 프로브",
    "",
    `- 시나리오 ${results.length}개`,
    `- 검증 통과(스키마+참조): ${parsedOk}/${results.length}`,
    `- 의도까지 맞음: ${fullyOk}/${results.length}`,
    "",
    "| 시나리오 | 의도 | 검증 | 못 맞춘 기대 |",
    "| --- | --- | --- | --- |",
    ...results.map((result) => {
      const misses = result.expectationFailures.length ? result.expectationFailures.join("<br>") : "-";
      return `| ${result.title} | ${result.intent} | ${result.ok ? "통과" : "실패"} | ${misses} |`;
    }),
    "",
    "## 검증 실패 원문",
    "",
    ...results
      .filter((result) => !result.ok)
      .flatMap((result) => [`### ${result.title}`, "", ...result.errors.map((error) => `- ${error}`), ""]),
  ];
  return lines.join("\n");
}

async function runLive(outDir: string): Promise<void> {
  const baseUrl = (process.env.EVENT_AI_PROBE_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.EVENT_AI_PROBE_API_KEY ?? "").trim();
  const model = (process.env.EVENT_AI_PROBE_MODEL ?? "").trim();
  if (!baseUrl || !apiKey || !model) {
    console.error("EVENT_AI_PROBE_BASE_URL / EVENT_AI_PROBE_API_KEY / EVENT_AI_PROBE_MODEL 이 필요합니다.");
    process.exit(2);
  }
  const prompts = emit(outDir);
  const responses: Record<string, string> = {};
  for (const prompt of prompts) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0,
      }),
    });
    if (!response.ok) {
      console.error(`[${prompt.id}] HTTP ${response.status}`);
      responses[prompt.id] = "";
      continue;
    }
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    responses[prompt.id] = payload.choices?.[0]?.message?.content ?? "";
    console.log(`[${prompt.id}] ${responses[prompt.id].length}자`);
  }
  fs.writeFileSync(path.join(outDir, "responses.json"), JSON.stringify(responses, null, 2));
  score(outDir);
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const command = process.argv[2] ?? "emit";
const dir = argValue("--out") ?? argValue("--in") ?? path.join("reports", "event-ai-probe", "run");
if (command === "emit") {
  const prompts = emit(dir);
  const chars = prompts.map((prompt) => prompt.systemChars);
  console.log(`${prompts.length}개 프롬프트 → ${path.join(dir, "prompts.json")}`);
  console.log(`시스템 프롬프트 크기: 최소 ${Math.min(...chars)}자 / 최대 ${Math.max(...chars)}자`);
} else if (command === "score") {
  const results = score(dir);
  const ok = results.filter((result) => result.ok && result.expectationFailures.length === 0).length;
  console.log(`의도까지 맞은 시나리오: ${ok}/${results.length} → ${path.join(dir, "REPORT.md")}`);
} else if (command === "run") {
  await runLive(dir);
} else {
  console.error(`알 수 없는 명령: ${command}`);
  process.exit(2);
}
