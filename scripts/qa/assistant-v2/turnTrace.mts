// 조수 v2 턴 구동기 흔적 — 모델·그림 없이 runAssistantV2 를 대본 모델로 돌려, 턴이 낸 실행 상태·재주입 글·상태 카드·최종 보고를 찍는다.
// 왜(2026-11-11 리팩토링 R3): golden.mts 는 지시문과 도구 목록만 본다. 턴 구동기(판정자 차례 · 항목 수명 · 최종 보고)를 옮기는 조각은
// 이 흔적을 앞·뒤로 찍어 한 글자도 안 바뀌었는지 대조한다. 테스트 러너가 아니다 — 출력만 한다.
//
//   bun scripts/qa/assistant-v2/turnTrace.mts <out.json>               찍기
//   bun scripts/qa/assistant-v2/turnTrace.mts --diff <a.json> <b.json>   대조(다르면 exit 1, 처음 어긋난 줄을 찍는다)
//
// 대본 모델: 첫 차례는 글만 쓰고 멈춘다(할 일 없이 멈춤) → todo init → 그 뒤로는 재주입 글의 열린 항목을 id 끝자리로 갈라 done/block 한다.
// 검토자·화면 검수자도 대본이다(막음 하나 → 없음, 결함 넷 → 둘 → 없음). 시간·난수 id 는 가린다.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { plugin } from "bun";
import { createBlankProject } from "../../../src/project/defaults";
import type { Project } from "../../../src/project/types";

const sha = (value: unknown): string => createHash("sha1").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 10);
// fp = 프로젝트 지문 — 끝맺음 단계가 실행마다 다른 id 를 만들어 달라진다(턴 구동기의 일이 아니다).
const VOLATILE_KEYS = new Set(["ms", "at", "durationMs", "criticMs", "fp"]);
const mask = (text: string): string => text.replace(/\d+(?:\.\d+)?초/gu, "#초").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu, "#uuid");
const stable = (value: unknown): string => mask(JSON.stringify(value, (key, v) => (VOLATILE_KEYS.has(key) ? 0 : v)) ?? "");

type Call = { name: string; args: unknown };
interface Scenario { readonly name: string; readonly task: string; readonly project: () => Project; readonly readOnly?: boolean }
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** 재주입 글의 할 일 표에서 열린 항목 id 를 읽는다(« ○ g3 …» · « → t1 …»). */
const openIds = (prompt: string): string[] => [...prompt.matchAll(/^ (?:○|→) (\S+) /gmu)].map((m) => m[1]!);

function scriptedModel(task: string, mapId: string) {
  let turn = 0, advisorCalls = 0, vqaCalls = 0;
  return {
    next(prompt: string): { calls: Call[]; text: string } {
      turn += 1;
      if (turn === 1) return { calls: [], text: "마을을 지었습니다. 엔딩까지 연결했습니다." };
      if (prompt.includes("[No tool ran]")) return { calls: [{ name: "todo", args: { op: "init", list: [{ phase: "짓기", items: [{ content: "보스 방을 짓는다", id: "boss", check: { kind: "place", name: "보스 방" } }, { content: "분위기를 다듬는다", id: "mood" }] }] } }], text: "목록을 적었습니다." };
      // 차례마다 실제로 저장되는 쓰기 하나(시작 칸 옮기기)를 먼저 한다 — 쓰기 없이 done 만 부르면 고리가 «그대로»로 멈춰 뒤 판정자까지 가지 못한다.
      const ids = openIds(prompt);
      const calls: Call[] = [{ name: "set_start_position", args: { mapId, x: 2 + (turn % 6), y: 3 + (turn % 4) } },
        ...ids.map((id): Call => (/[13579]$/u.test(id) || id === "mood" ? { name: "todo", args: { op: "done", task: id } } : { name: "todo", args: { op: "block", task: id, reason: `${id} 를 고칠 방법을 찾지 못했습니다` } }))];
      return { calls, text: `최종 보고(앞 보고를 고침): ${task.slice(0, 20)} — 항목 ${ids.length}개를 처리했습니다. 엔딩을 연결했습니다.` };
    },
    advisor(): string {
      advisorCalls += 1;
      return advisorCalls === 1
        ? JSON.stringify({ claims: [{ claim: "엔딩을 연결했습니다", status: "contradicted", evidence: "변경에 엔딩이 없다" }], removals: [], unreachable: [], missing: [], notes: [{ level: "concern", what: "목표 줄이 없다", evidence: "-" }] })
        : JSON.stringify({ claims: [], removals: [], unreachable: [], missing: [], notes: [] });
    },
    vqa(messages: readonly unknown[]): string {
      vqaCalls += 1;
      const text = String(((messages[0] as { content?: { text?: string }[] })?.content ?? [])[0]?.text ?? "");
      const image = (label: RegExp) => Number(new RegExp(`\\[(\\d+)\\] ${label.source}`, "u").exec(text)?.[1] ?? 1);
      const map = image(/맵 «/u), title = image(/타이틀/u), opening = image(/오프닝/u);
      const rounds: unknown[][] = [
        [{ image: map, where: "오른쪽 위", what: "붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", severity: "blocker" },
          { image: map, where: "아래쪽 절반", what: "방 아래쪽 절반이 가구 없이 빈 바닥이라 휑하다.", severity: "polish" },
          { image: map, where: "위쪽", what: "배가 물 위가 아니라 눈밭과 나무 사이에 놓여 있어 배치가 어색하다.", severity: "polish" },
          { image: title, where: "전체", what: "타이틀 그림이 회화풍이라 도트 게임과 화풍이 어긋난다.", severity: "polish" },
          { image: opening, where: "전체", what: "오프닝 그림이 기본 왕국 그림이라 이 게임과 맞지 않는다.", severity: "blocker" }],
        [{ image: map, where: "오른쪽 위", what: "붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다.", severity: "blocker" },
          { image: map, where: "오른쪽 가장자리", what: "보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다.", severity: "blocker" }],
        [],
      ];
      return JSON.stringify({ defects: rounds[Math.min(vqaCalls - 1, rounds.length - 1)] });
    },
  };
}

/** runPiAgent 자리에 끼우는 가짜 — 실제 실행기처럼 갈고리를 차례로 부르되 모델·렌더·체크포인트는 대본이다. */
function fakeRunner(lines: string[], finalProject: { project?: Project }) {
  return async (request: { task: string; project: Project; currentMapId?: string }, options: { onEvent?: (e: unknown) => void; v2?: Record<string, (...a: never[]) => unknown> & { maxRounds?: number } }) => {
    const model = scriptedModel(request.task, request.project.startMapId);
    const ctx = { project: structuredClone(request.project), currentMapId: request.currentMapId ?? request.project.startMapId, assistantRun: true };
    const env = {
      ctx, request,
      emit: (event: Record<string, unknown>) => options.onEvent?.({ ...event, at: 0 }),
      record: () => {},
      sideChat: async () => model.advisor(),
      roleChat: async (_role: unknown, messages: readonly unknown[]) => model.vqa(messages),
      render: async () => PIXEL, renderArt: async () => PIXEL,
      checkpoint: async (label: string) => { lines.push(`checkpoint ${label}`); },
      keyedProviders: new Set(["local-cli:claude"]),
      requireToolNextTurn: (name?: string) => { lines.push(`requireTool ${name ?? "(any)"}`); },
      freshContextNextTurn: () => { lines.push("freshContext"); },
      preferToolNextTurn: () => {}, clearToolPreference: () => {},
    };
    const v2 = options.v2!;
    const tools = (v2.tools as (e: unknown) => { name: string; execute: (id: string, args: unknown) => Promise<{ content: { type: string; text?: string }[] }> }[])(env);
    lines.push(`tools ${tools.length} ${sha(tools.map((t) => t.name))}`);
    (v2.beforeFirstPrompt as ((e: unknown) => void) | undefined)?.(env);
    const suffix = await (v2.firstPromptSuffix as ((e: unknown) => Promise<string | undefined>) | undefined)?.(env);
    lines.push(`suffix ${suffix ?? "-"}`);
    let prompt: string | undefined = request.task, callNo = 0;
    for (let round = 0; prompt !== undefined && round < (v2.maxRounds ?? 2); round++) {
      lines.push(`card ${mask(String((v2.stateCard as ((e: unknown) => string | undefined) | undefined)?.(env) ?? "-"))}`);
      lines.push(`keepToolsOn ${String((v2.keepToolsOn as ((e: unknown) => boolean) | undefined)?.(env))}`);
      const turn = model.next(prompt);
      for (const call of turn.calls) {
        const id = `call_${++callNo}`;
        options.onEvent?.({ type: "tool_start", id, name: call.name, args: call.args });
        const tool = tools.find((t) => t.name === call.name) ?? (v2.lazyTool as (n: string) => typeof tools[number] | undefined)(call.name);
        const text = tool ? (await tool.execute(id, call.args)).content.find((c) => c.type === "text")?.text ?? "" : (v2.unknownToolText as (n: string) => string)(call.name);
        lines.push(`tool ${call.name} ${stable(call.args).slice(0, 200)} → ${mask(text).slice(0, 600)}`);
        options.onEvent?.({ type: "tool_end", id, name: call.name, ok: !/"ok":false/u.test(text.slice(0, 80)), summary: text.slice(0, 200) });
      }
      options.onEvent?.({ type: "assistant", text: turn.text });
      prompt = (await (v2.afterMain as (e: unknown, r: number) => Promise<string | undefined>)(env, round)) ?? undefined;
      lines.push(`afterMain → ${prompt === undefined ? "(end)" : mask(prompt)}`);
    }
    finalProject.project = ctx.project;
    return { type: "done", ok: true, project: ctx.project };
  };
}

async function shoot(): Promise<Record<string, string[]>> {
  // 실행기의 모델 고리(runPiAgent)만 가짜로 바꾼다 — 턴 구동기(runAssistantV2)는 저장소의 것 그대로다.
  const slot: { run?: ReturnType<typeof fakeRunner> } = {};
  (globalThis as { __turnTraceRunPiAgent?: unknown }).__turnTraceRunPiAgent = (...args: never[]) => (slot.run as (...a: never[]) => unknown)(...args);
  plugin({ name: "turn-trace-fake-runner", setup(build) {
    build.onLoad({ filter: /scripts[\\/]lib[\\/]piAgentRuntime\.ts$/u }, () => ({ loader: "ts", contents: "export const runPiAgent = (...args: unknown[]) => (globalThis as any).__turnTraceRunPiAgent(...args);" }));
  } });
  const { runAssistantV2 } = await import(join(import.meta.dir, "../../lib/assistantV2Runtime.ts"));
  const out: Record<string, string[]> = {};
  let carried: Project | undefined;
  const scenarios: Scenario[] = [
    { name: "whole-game", task: "판타지 RPG 게임 하나 만들어 줘.", project: () => createBlankProject() },
    { name: "continue", task: "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을 처음부터 엔딩까지 실제로 플레이할 수 있게 해 줘.", project: () => carried ?? createBlankProject() },
    { name: "small-write", task: "이 맵에 상점 주인 한 명 세워 줘.", project: () => createBlankProject() },
    { name: "question", task: "이 게임 뭐가 부족한지 알려 줘", project: () => createBlankProject() },
  ];
  for (const scenario of scenarios) {
    let seed = 20261111;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
    const lines: string[] = [];
    const final: { project?: Project } = {};
    slot.run = fakeRunner(lines, final);
    const project = scenario.project();
    await runAssistantV2({ task: scenario.task, provider: "local-cli:claude", model: "trace-model", mapIds: [], project, projectKey: "trace-key", currentMapId: project.startMapId, ...(scenario.readOnly ? { readOnly: true } : {}) } as never, {
      onEvent: (event: { type: string; name?: string; ok?: boolean; summary?: string; text?: string; data?: unknown }) => {
        if (event.type === "execution_status") lines.push(`status ${event.name} ok=${String(event.ok)} ${mask(event.summary ?? "")}${event.data === undefined ? "" : ` data#${sha(stable(event.data))}`}`);
        else if (event.type === "assistant") lines.push(`assistant ${mask(event.text ?? "")}`);
      },
    } as never);
    lines.push(`todo ${stable((final.project as { assistantTodo?: unknown } | undefined)?.assistantTodo ?? null)}`);
    if (scenario.name === "whole-game") carried = final.project;
    out[scenario.name] = lines;
  }
  return out;
}

function diff(aPath: string, bPath: string): number {
  const a = JSON.parse(readFileSync(aPath, "utf8")) as Record<string, string[]>, b = JSON.parse(readFileSync(bPath, "utf8")) as Record<string, string[]>;
  let changed = 0;
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[name] ?? [], y = b[name] ?? [];
    const at = x.findIndex((line, i) => line !== y[i]);
    if (at < 0 && x.length === y.length) continue;
    changed += 1;
    const i = at < 0 ? Math.min(x.length, y.length) : at;
    console.log(`${name}: ${x.length}줄 → ${y.length}줄, 처음 어긋난 줄 ${i + 1}\n  - ${(x[i] ?? "(없음)").slice(0, 400)}\n  + ${(y[i] ?? "(없음)").slice(0, 400)}`);
  }
  const total = Object.values(a).reduce((n, lines) => n + lines.length, 0);
  console.log(changed ? `다르다 (${changed}개 장면)` : `같다 (${Object.keys(a).length}개 장면 · ${total}줄)`);
  return changed ? 1 : 0;
}

const args = process.argv.slice(2);
if (args[0] === "--diff") process.exit(diff(args[1]!, args[2]!));
const shot = await shoot();
writeFileSync(args[0] ?? "/dev/stdout", JSON.stringify(shot, null, 1));
console.error(Object.entries(shot).map(([name, lines]) => `${name}: ${lines.length}줄`).join(" · "));
process.exit(0);
