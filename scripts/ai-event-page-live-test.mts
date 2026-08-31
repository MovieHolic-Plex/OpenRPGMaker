/**
 * 라이브 검증: 에디터 AI 가 이벤트 '페이지' 개념을 이해하는가.
 *
 *   OPENROUTER_API_KEY=... npx tsx scripts/ai-event-page-live-test.mts --label after --model google/gemini-3.7-flash
 *
 * 실제 AssistantSession 툴 루프에 사용자가 실제로 말하는 문장을 그대로 먹이고, 세션이 만든
 * draft 프로젝트의 이벤트 페이지를 기계적으로 판정한다. 키는 env 에서만 읽고 출력하지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { AssistantSession } from "../src/ai/assistantSession.ts";
import { chatCompletion, type AiConfig } from "../src/ai/llmClient.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { Command, GameEvent, Project } from "../src/project/types.ts";

// 판정을 스크립트에 내장한다 — fix 가 없는 base 트리에서도 **같은 자로** 재야 비교가 성립한다.
function canonicalKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalKey).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalKey(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function flatten(conditions: readonly unknown[]): readonly unknown[] {
  const flat: unknown[] = [];
  for (const condition of conditions) {
    const record = condition as { kind?: string; conditions?: readonly unknown[] };
    if (record?.kind === "all" && Array.isArray(record.conditions)) {
      flat.push(...flatten(record.conditions));
      continue;
    }
    flat.push(condition);
  }
  return flat;
}

function findShadowedPages(pages: readonly { id: string; conditions?: readonly unknown[] }[] | undefined) {
  const list = pages ?? [];
  const keys = list.map((page) => new Set(flatten(page.conditions ?? []).map(canonicalKey)));
  const shadowed: { index: number; byIndex: number }[] = [];
  for (let index = 0; index < list.length - 1; index += 1) {
    for (let later = list.length - 1; later > index; later -= 1) {
      const laterKeys = keys[later];
      const own = keys[index];
      if (!laterKeys || !own) continue;
      if ([...laterKeys].every((key) => own.has(key))) {
        shadowed.push({ index, byIndex: later });
        break;
      }
    }
  }
  return shadowed;
}

interface Scenario {
  readonly id: string;
  readonly ask: string;
  readonly prompt: string;
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: "random-dialogue-npc",
    ask: "말할 때마다 대사가 랜덤으로 바뀌는 NPC (사용자가 실제로 신고한 시나리오)",
    prompt:
      "지금 맵에 잡화상 아저씨 NPC 를 한 명 만들어줘. 말을 걸 때마다 대사가 랜덤으로 바뀌어야 해 — " +
      "대사 후보는 3~4개 정도면 되고, 같은 대사가 계속 나오면 안 돼.",
  },
  {
    id: "night-only-npc",
    ask: "등장 조건(밤에만 다른 대사) 이해 여부",
    prompt:
      "마을 광장에 야경꾼 NPC 를 만들어줘. 낮에 말을 걸면 '해가 밝으니 나는 쉬어야지' 라고 하고, " +
      "밤에 말을 걸면 순찰 이야기를 해야 해.",
  },
  {
    id: "progress-npc",
    ask: "단계 진행(말 걸 때마다 다음 대사) 이해 여부",
    prompt:
      "할머니 NPC 를 만들어줘. 처음 말을 걸면 인사를 하고, 두 번째로 말을 걸면 손녀 이야기를 하고, " +
      "세 번째부터는 계속 같은 작별 인사만 반복해야 해.",
  },
];

interface PageVerdict {
  readonly eventId: string;
  readonly pageCount: number;
  readonly conditionsPerPage: readonly number[];
  readonly unconditionalPages: number;
  readonly shadowedPages: readonly string[];
  readonly usesWeightedBranch: boolean;
  readonly usesFork: boolean;
  readonly usesSelfSwitchWrite: boolean;
  readonly textCommandCount: number;
  readonly conditionKindsPerPage: readonly string[][];
  readonly commandKindsPerPage: readonly string[][];
}

function walkCommands(commands: readonly Command[], visit: (command: Command) => void): void {
  for (const command of commands) {
    visit(command);
    for (const value of Object.values(command as Record<string, unknown>)) {
      if (Array.isArray(value) && value.every((entry) => entry && typeof entry === "object" && "kind" in entry)) {
        walkCommands(value as Command[], visit);
      } else if (value && typeof value === "object") {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (Array.isArray(nested) && nested.every((entry) => entry && typeof entry === "object" && "kind" in entry)) {
            walkCommands(nested as Command[], visit);
          }
        }
      }
    }
  }
}

function judgeEvent(event: GameEvent): PageVerdict {
  const pages = event.pages ?? [];
  let weighted = false;
  let fork = false;
  let selfSwitchWrite = false;
  let texts = 0;
  for (const page of pages) {
    walkCommands(page.commands ?? [], (command) => {
      if (command.kind === "text") texts += 1;
      if (command.kind === "fork") fork = true;
      if (command.kind === "setSelfSwitch") selfSwitchWrite = true;
      if (command.kind === "m2Command" && String((command as { commandId?: string }).commandId ?? "").includes("weighted-branch")) weighted = true;
    });
  }
  return {
    eventId: event.id,
    conditionKindsPerPage: pages.map((page) => (page.conditions ?? []).map((condition) => {
      const record = condition as Record<string, unknown>;
      const detail = [record.switchId, record.key, record.variableId, record.phase, record.season, record.activity]
        .filter((entry) => typeof entry === "string")
        .join("/");
      return detail ? `${String(record.kind)}:${detail}` : String(record.kind);
    })),
    commandKindsPerPage: pages.map((page) => {
      const kinds: string[] = [];
      walkCommands(page.commands ?? [], (command) => {
        kinds.push(command.kind === "m2Command" ? `m2:${String((command as { commandId?: string }).commandId ?? "?")}` : command.kind);
      });
      return kinds;
    }),
    pageCount: pages.length,
    conditionsPerPage: pages.map((page) => (page.conditions ?? []).length),
    unconditionalPages: pages.filter((page) => (page.conditions ?? []).length === 0).length,
    shadowedPages: findShadowedPages(pages).map((shadow) => `${shadow.index + 1}→${shadow.byIndex + 1}`),
    usesWeightedBranch: weighted,
    usesFork: fork,
    usesSelfSwitchWrite: selfSwitchWrite,
    textCommandCount: texts,
  };
}

function authoredEvents(before: Project, after: Project): readonly GameEvent[] {
  const seen = new Set<string>();
  for (const map of Object.values(before.maps)) for (const event of map.events) seen.add(`${map.id}:${event.id}`);
  const fresh: GameEvent[] = [];
  for (const map of Object.values(after.maps)) {
    for (const event of map.events) {
      if (!seen.has(`${map.id}:${event.id}`)) fresh.push(event);
    }
  }
  return fresh;
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const next = argv[index + 1];
    flags[token.slice(2)] = next && !next.startsWith("--") ? (index += 1, next) : "true";
  }
  return flags;
}

function loadKey(): string {
  const fromEnv = (process.env.OPENROUTER_API_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  const envPath = path.resolve(import.meta.dirname, "..", ".env.local");
  const line = fs.readFileSync(envPath, "utf8").split("\n").find((entry) => entry.startsWith("OPENROUTER_API_KEY="));
  const key = (line ?? "").slice("OPENROUTER_API_KEY=".length).trim();
  if (!key) throw new Error("OPENROUTER_API_KEY 가 없습니다.");
  return key;
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  const label = flags.label ?? "run";
  const model = flags.model ?? "google/gemini-3.7-flash";
  const outDir = path.resolve(flags.out ?? path.join("reports", "ai-event-pages"));
  fs.mkdirSync(outDir, { recursive: true });
  const noKeyNeeded = (flags.base ?? "").includes("127.0.0.1");
  const config: AiConfig = {
    authMode: "apiKey",
    baseUrl: flags.base ?? "https://openrouter.ai/api/v1",
    model,
    liteModel: model,
    apiKey: noKeyNeeded ? "shim" : loadKey(),
    maxToolCalls: 24,
    maxTokens: 8000,
    reasoningEffort: "low",
  } as AiConfig;

  const results = [];
  for (const scenario of SCENARIOS) {
    const baseline = createBlankProject();
    const session = new AssistantSession(structuredClone(baseline), { config, chat: chatCompletion });
    const startedAt = Date.now();
    let assistantText = "";
    let stoppedReason = "error";
    let error: string | undefined;
    try {
      const turn = await session.sendUserMessage(scenario.prompt, () => {}, undefined, { autonomous: false });
      assistantText = turn.assistantText;
      stoppedReason = turn.stoppedReason;
      error = turn.error;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    const proposed = session.getProposedProject();
    const events = authoredEvents(baseline, proposed).map(judgeEvent);
    const audit = JSON.parse(session.exportAudit()) as { entries?: { kind: string; name?: string; ok?: boolean; summary?: string; warnings?: string[] }[] };
    const toolCalls = (audit.entries ?? []).filter((entry) => entry.kind === "tool");
    results.push({
      scenario: scenario.id,
      ask: scenario.ask,
      prompt: scenario.prompt,
      model,
      stoppedReason,
      error,
      durationMs: Date.now() - startedAt,
      assistantText: assistantText.slice(0, 1200),
      toolNames: toolCalls.map((entry) => entry.name ?? "?"),
      events,
      verdict: {
        authoredAnyEvent: events.length > 0,
        deadPages: events.reduce((sum, event) => sum + event.shadowedPages.length, 0),
        multiUnconditionalPages: events.some((event) => event.unconditionalPages > 1),
        usesRandomPrimitive: events.some((event) => event.usesWeightedBranch),
        usesConditions: events.some((event) => event.conditionsPerPage.some((count) => count > 0)),
      },
    });
    fs.writeFileSync(path.join(outDir, `${label}-${scenario.id}-project.json`), JSON.stringify(proposed, null, 2));
    process.stdout.write(`[${label}] ${scenario.id}: pages=${JSON.stringify(events.map((e) => e.pageCount))} dead=${events.reduce((s, e) => s + e.shadowedPages.length, 0)} weighted=${events.some((e) => e.usesWeightedBranch)}\n`);
  }

  const outFile = path.join(outDir, `${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ label, model, startedAt: new Date().toISOString(), results }, null, 2));
  process.stdout.write(`[${label}] wrote ${outFile}\n`);
}

await main();
