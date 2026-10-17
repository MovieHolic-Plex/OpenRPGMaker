// 몬스터 자산 역방향 잠금 증거 스크립트(2026-10-17) — 모델 호출 없이 D1(FF6풍·CT풍 한 줄 요청)의 실제 조수 경로를 재구성해
// 「첫 요청에 모델이 받는 도구 목록·시스템 프롬프트」의 몬스터 도구 수를 센다. 같은 스크립트를 수정 전·후 체크아웃에서 돌려 비교한다.
//   npm run qa:game -- toollist [--json out.json]   (모델 호출 없음 — 같은 파일을 수정 전 체크아웃에 복사해 돌리면 전후 비교)
// 경로: classifyPlainPiTurn(평문 턴 분류, 선언자는 모델 대신 「후보 목록에서 몬스터 낱말 도구를 고르는」 결정적 모사) → composePiTask → runPiAgent(진짜 Agent 루프·레지스트리·어댑터, 모델 스트림만 대본).
// 주의: 의도 선언 모사는 실제 Argon 이 D1 에서 센터·트레이너·도감 도구를 고른 행동을 흉내 낸 것이다 — 후보 목록에 있는 것만 고를 수 있다는 점이 핵심이다.
import { writeFileSync } from "node:fs";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { classifyPlainPiTurn } from "../../src/ai/piAgent/plainTurn.ts";
import { composePiTask } from "../../src/ai/piAgent/executionRoute.ts";
import { resolveAutonomy } from "../../src/ai/autonomyLevels.ts";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { buildIntentFacts } from "../../src/ai/intentDeclarationClient.ts";
import { buildIntentUserPayload, INTENT_SYSTEM_PROMPT, intentSystemPrompt, parseIntentDeclaration } from "../../src/ai/intentDeclaration.ts";
import { activeTools } from "../../src/editor/tools/index.ts";

/** 포켓몬식 전용 도구 이름(18) — 수정 후 MONSTER_ONLY_TOOLS 와 같다. author_wild_route 는 버들항 필드 themeScene 이 일반 프로젝트도 쓰는 도구라 표에서 뺐다(허용). */
const MONSTER_TOOLS = ["build_monster_game", "build_monster_tournament", "build_monster_expedition", "configure_monster_style", "configure_monster_campaign", "read_monster_game", "review_monster_game", "configure_monster_system",
  "define_monster_species", "define_monster_families", "rename_monster_species", "give_starter_monsters", "set_type_chart", "place_trainer", "place_monster_center", "place_monster_pc", "place_badge_gate", "place_field_obstacle"];
const MONSTERISH = /monster|trainer|type_chart|badge|field_obstacle|starter/u;

const PROMPTS: readonly (readonly [string, string])[] = [
  ["FF6풍(D1)", "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로"],
  ["크로노 트리거풍(CT)", "크로노 트리거처럼 과거·현재·미래를 시간의 문으로 오가는 시간여행 JRPG 만들어 줘. 시대마다 풍경이 달랐으면 좋겠어"],
  ["대조군: 몬스터 수집", "포켓몬 같은 몬스터 수집 게임 만들어 줘. 체육관을 돌며 도감을 채우는 이야기"],
];

function scriptedStream(captured: { toolNames: string[]; system: string }) {
  return (_model: unknown, context: any) => {
    captured.toolNames = (context.tools ?? []).map((tool: { name: string }) => tool.name);
    captured.system = String(Array.isArray(context.systemPrompt) ? context.systemPrompt.join("\n") : context.systemPrompt ?? "");
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      const message: any = { role: "assistant", api: "gemini", provider: "google-antigravity", model: "scripted", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
        timestamp: Date.now(), stopReason: "stop", content: [{ type: "text", text: "완료" }] };
      stream.push({ type: "start", partial: message } as never);
      stream.push({ type: "done", reason: "stop", message } as never);
    });
    return stream;
  };
}

/**
 * --live: 실제 Argon(8319, gemini-4-argon-*)에 의도 선언 호출만 보낸다(조건당 1회 — 수정 전 후보 목록 / 수정 후 후보 목록, 최대 PROMPTS×2 = 4회).
 * 키는 환경변수 OPRN_LIVE_KEY 로만 읽고 출력하지 않는다. 헤더 x-queue-tag: monster-lock-rev.
 */
async function liveDeclarations(): Promise<Record<string, unknown>[]> {
  const key = process.env.OPRN_LIVE_KEY;
  if (!key) throw new Error("OPRN_LIVE_KEY 환경변수가 필요하다(키는 인자·파일로 받지 않는다).");
  const base = process.env.QA_COMPAT_BASE ?? "http://127.0.0.1:8319/v1";
  const model = process.env.QA_COMPAT_MODEL ?? "gemini-4-argon-high";
  if (!/^gemini-4-argon/u.test(model)) throw new Error(`허용 모델은 gemini-4-argon* 뿐이다: ${model}`);
  const out: Record<string, unknown>[] = [];
  for (const [label, text] of PROMPTS.slice(0, 2)) {
    const project = createBlankProject();
    const lockedFacts = buildIntentFacts({ project, userText: text, currentMapId: project.startMapId, hasActivePlan: false });
    // 수정 전 모양 재현: 후보 목록 전체(몬스터 도구 포함) + 몬스터 안내가 든 선언 프롬프트.
    const legacyFacts = { ...lockedFacts, monsterLocked: undefined, toolNames: activeTools().map((tool) => tool.name) };
    for (const [variant, facts, system] of [["수정 전(몬스터 도구 후보 포함)", legacyFacts, INTENT_SYSTEM_PROMPT], ["수정 후(잠금)", lockedFacts, intentSystemPrompt(lockedFacts)]] as const) {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-queue-tag": "monster-lock-rev" },
        body: JSON.stringify({ model, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: buildIntentUserPayload(facts as never) }] }),
      });
      const body = await response.json() as { choices?: { message?: { content?: string } }[]; error?: unknown };
      const content = body.choices?.[0]?.message?.content ?? "";
      const parsed = parseIntentDeclaration(content, facts as never);
      const tools = parsed.intent?.tools ?? [];
      out.push({ label, variant, status: response.status, ...(response.ok ? {} : { error: JSON.stringify(body.error ?? body).slice(0, 160) }), declaredTools: tools, monsterTools: tools.filter((name) => MONSTER_TOOLS.includes(name)) });
    }
  }
  return out;
}

export async function toollistMain(args: readonly string[]): Promise<number> {
const rows: Record<string, unknown>[] = [];
for (const [label, text] of PROMPTS) {
  const project = createBlankProject();
  let offered: readonly string[] = [];
  const classification = await classifyPlainPiTurn({
    project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, piTeam: false, autonomy: resolveAutonomy("balanced"),
    declarer: () => async (facts) => {
      offered = facts.toolNames;
      // 모사: 후보 목록에서 몬스터 낱말 도구를 모두 고르고 일반 도구 둘을 더한다(후보에 없는 것은 못 고른다).
      const picked = [...facts.toolNames.filter((name) => MONSTERISH.test(name)), ...["upsert_enemy", "upsert_troop"].filter((name) => facts.toolNames.includes(name))].slice(0, 12);
      return { intent: { mode: "create", space: "none", facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: true, resetsContext: false, tools: picked, summary: facts.userText, source: "llm" } as never, elapsedMs: 0 };
    },
  });
  const task = composePiTask(text, classification.intentNote);
  const captured = { toolNames: [] as string[], system: "" };
  const request: PiAgentRequest = { provider: "google-antigravity", mode: "single", task, mapIds: [], project, maxTurns: 1, applyMode: "default",
    ...(classification.initialToolNames ? { initialToolNames: classification.initialToolNames } : {}) };
  await runPiAgent(request, { streamFn: scriptedStream(captured) as never });
  const monsterTools = captured.toolNames.filter((name) => MONSTER_TOOLS.includes(name));
  const promptHits = MONSTER_TOOLS.filter((name) => captured.system.includes(name));
  rows.push({
    label, monsterKit: classification.monsterKit === true, declaredCandidatesMonster: offered.filter((name) => MONSTER_TOOLS.includes(name)).length,
    initialToolNames: classification.initialToolNames?.length ?? null, initialMonsterTools: (classification.initialToolNames ?? []).filter((name) => MONSTER_TOOLS.includes(name)),
    modelToolCount: captured.toolNames.length, modelMonsterTools: monsterTools, systemPromptMonsterToolMentions: promptHits.length, systemPromptChars: captured.system.length,
    monsterRecipeLines: (captured.system.match(/^- monster-[a-z-]+: READ/gmu) ?? []).length,
    intentNoteMonsterKit: /몬스터 키트|포켓몬풍/u.test(classification.intentNote ?? ""),
  });
}
console.table(rows.map((row) => ({ ...row, initialMonsterTools: (row.initialMonsterTools as string[]).length, modelMonsterTools: (row.modelMonsterTools as string[]).length })));
if (args.includes("--live")) { const live = await liveDeclarations(); console.table(live.map((row) => ({ ...row, declaredTools: (row.declaredTools as string[]).join(","), monsterTools: (row.monsterTools as string[]).length }))); rows.push(...live.map((row) => ({ live: true, ...row }))); }
const out = args.indexOf("--json");
if (out >= 0) writeFileSync(args[out + 1]!, JSON.stringify(rows, null, 2));
return 0;
}

if (import.meta.main) process.exit(await toollistMain(process.argv.slice(2)));
