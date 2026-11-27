// Pi 조수 실행 이어 하기(B안, #5239). 앱이 실행 도중 꺼진 뒤 «남은 일만» 새 실행으로 잇는다.
//
// 무엇을 어디에 남기나:
// - 편집기: 대화 기록 끝 «실행 중» 표지(#5238)에 이 실행의 열쇠·요청을 JSON 으로 붙인다(화면에 안 보이는 status 항목).
// - 워커(v2): 쓰기 도구가 프로젝트를 바꿔 체크포인트를 보낼 때마다 그 호출의 멱등 키를 `assistantTodo.memory.resume` 에
//   더해 같은 체크포인트에 싣는다. 저장된 프로젝트가 곧 «적용된 단계»와 같은 순간의 것이라(원자적) 저장 시각을 맞출 필요가 없다.
// - 이어 하기: 새 실행이 `resume.from` 으로 옛 열쇠를 대면, 워커가 그 키의 호출을 한 번씩 건너뛴다(중복 적용 막기).
//   할 일 목록은 v2 의 «계속» 경로가 되살린다(src/ai/v2/turn/context.ts).
//
// 이 파일은 순수 모듈이다 — 워커·편집기·시험이 같은 판정을 쓴다.

/** 대화 기록 끝 «실행 중» 표지(#5238). 뒤에 공백 하나와 JSON 이 붙을 수 있다(이어 하기 기록). */
export const PI_RUN_IN_FLIGHT = "agent_run:in-flight";

/** 이어 하기 기록에 남기는 적용 호출 수 상한. 넘으면 오래된 것부터 버린다(체크포인트 줄을 작게 둔다). */
export const RESUME_MAX_APPLIED = 300;
const JOURNAL_TASK_MAX = 4000;

/** 편집기가 실행 시작 때 남기는 기록 — 다시 켰을 때 무엇을 하던 중이었는지. */
export interface PiRunJournal {
  /** 이 실행의 이어 하기 열쇠(워커 기록과 맞춰 본다). */
  readonly key: string;
  readonly task: string;
  readonly shown?: string;
  readonly mode: "single" | "team";
  readonly mapIds?: readonly string[];
  readonly startedAt: number;
  /** 원래 실행의 연결(공급자 id)·모델 — 이어 하기는 이것으로 잇는다(editor/panels/aiResumeProvider.ts). */
  readonly provider?: string;
  readonly model?: string;
  /** 팀 실행: 담당이 끝까지 해낸(agent_done ok) 맵 배정. 배정이 끝날 때마다 표지를 다시 쓴다. */
  readonly doneMaps?: readonly string[];
}

/** 워커가 프로젝트에 같이 싣는 이어 하기 기억(`assistantTodo.memory.resume`). */
export interface PiRunResumeMemory {
  readonly key: string;
  readonly task: string;
  /** 적용(체크포인트로 프로젝트에 들어간)된 쓰기 호출의 멱등 키, 오래된 것이 앞. */
  readonly applied: readonly PiAppliedCall[];
  readonly dropped?: number;
}
export interface PiAppliedCall {
  readonly k: string;
  readonly tool: string;
  readonly at: number;
}

/** 실행 요청에 싣는 이어 하기 열쇠. key = 이 실행의 열쇠, from = 이어 받을 앞 실행의 열쇠(이어 하기일 때만). */
export interface PiRunResumeRequest {
  readonly key: string;
  readonly from?: string;
  /** 앞 팀 실행에서 끝난 맵 배정 — 팀장이 같은 맵을 다시 맡기면 한 번 돌려보낸다(piTeamRuntime startAssign). */
  readonly doneMapIds?: readonly string[];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

/** cyrb53 — 짧고 충돌이 드문 53비트 해시(암호용 아님). */
function hash53(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * 쓰기 호출 하나의 멱등 키 = 도구 이름 + 키를 정렬한 인자의 해시. `todoId` 는 뺀다 — 같은 시공을 다른 할 일 번호로 불러도 같은 호출이다.
 * 키 순서만 다른 인자는 같은 키다(repeatBreaker.ts 와 같은 정규화).
 */
export function appliedCallKey(name: string, args: unknown): string {
  const plain = args && typeof args === "object" && !Array.isArray(args)
    ? Object.fromEntries(Object.entries(args as Record<string, unknown>).filter(([key]) => key !== "todoId"))
    : args ?? null;
  return `${name}:${hash53(JSON.stringify(canonical(plain)))}`;
}

/** 적용 호출 하나를 더한다(같은 키가 이미 있으면 그대로). 상한을 넘으면 오래된 것을 버리고 버린 수를 센다. */
export function withAppliedCall(memory: PiRunResumeMemory, call: PiAppliedCall): PiRunResumeMemory {
  if (memory.applied.some((entry) => entry.k === call.k)) return memory;
  const applied = [...memory.applied, call];
  const over = applied.length - RESUME_MAX_APPLIED;
  if (over <= 0) return { ...memory, applied };
  return { ...memory, applied: applied.slice(over), dropped: (memory.dropped ?? 0) + over };
}

function isAppliedCall(value: unknown): value is PiAppliedCall {
  const v = value as Partial<PiAppliedCall> | null;
  return !!v && typeof v.k === "string" && typeof v.tool === "string" && typeof v.at === "number";
}

/** 프로젝트의 `assistantTodo` 에서 이어 하기 기억을 읽는다. 모양이 틀리면 undefined. */
export function readResumeMemory(assistantTodo: unknown): PiRunResumeMemory | undefined {
  const resume = (assistantTodo as { memory?: { resume?: unknown } } | undefined)?.memory?.resume as Partial<PiRunResumeMemory> | undefined;
  if (!resume || typeof resume.key !== "string" || typeof resume.task !== "string" || !Array.isArray(resume.applied)) return undefined;
  return { key: resume.key, task: resume.task, applied: resume.applied.filter(isAppliedCall),
    ...(typeof resume.dropped === "number" && resume.dropped > 0 ? { dropped: resume.dropped } : {}) };
}

/** 표지 status 글. 기록이 없으면 옛 표지 그대로(#5238 과 같은 글). */
export function inFlightMarkerText(journal?: PiRunJournal): string {
  if (!journal) return PI_RUN_IN_FLIGHT;
  const task = journal.task.length > JOURNAL_TASK_MAX ? journal.task.slice(0, JOURNAL_TASK_MAX) : journal.task;
  return `${PI_RUN_IN_FLIGHT} ${JSON.stringify({ ...journal, task })}`;
}

/** status 글이 «실행 중» 표지인가. 맞으면 붙은 기록(없거나 깨졌으면 null)을, 아니면 undefined. */
export function parseInFlightMarker(text: string): PiRunJournal | null | undefined {
  if (text === PI_RUN_IN_FLIGHT) return null;
  if (!text.startsWith(`${PI_RUN_IN_FLIGHT} `)) return undefined;
  try {
    const raw = JSON.parse(text.slice(PI_RUN_IN_FLIGHT.length + 1)) as Partial<PiRunJournal>;
    if (typeof raw.key !== "string" || typeof raw.task !== "string" || typeof raw.startedAt !== "number") return null;
    return {
      key: raw.key, task: raw.task, startedAt: raw.startedAt,
      mode: raw.mode === "team" ? "team" : "single",
      ...(typeof raw.shown === "string" ? { shown: raw.shown } : {}),
      ...(Array.isArray(raw.mapIds) ? { mapIds: raw.mapIds.filter((id): id is string => typeof id === "string") } : {}),
      ...(typeof raw.provider === "string" ? { provider: raw.provider } : {}),
      ...(typeof raw.model === "string" ? { model: raw.model } : {}),
      ...(Array.isArray(raw.doneMaps) ? { doneMaps: raw.doneMaps.filter((id): id is string => typeof id === "string") } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * 다시 켰을 때 앞 실행이 적용한 단계 수. 프로젝트의 기억이 다른 실행 것이면(이 실행이 첫 체크포인트 전에 꺼졌다) 0 이다 —
 * 그 기억은 앞서 끝난 실행이 남긴 것이다. 앱이 꺼진 뒤 이 알림을 보기 전에는 사람이 편집할 틈이 없다.
 */
export function appliedByInterruptedRun(journal: PiRunJournal, memory: PiRunResumeMemory | undefined): number {
  return memory && memory.key === journal.key ? memory.applied.length : 0;
}

/** 팀 실행의 맵 배정 진행 — agent_spawn 으로 담당→맵을 알고, 그 담당의 agent_done 이 ok 면 그 맵을 끝난 배정으로 센다. 끝난 맵이 늘었으면 true. */
export interface TeamProgress { readonly spawned: Map<string, string>; readonly done: Set<string> }
export function noteTeamProgress(progress: TeamProgress, event: { readonly type: string; readonly agentId?: string; readonly mapId?: string | null; readonly ok?: boolean }): boolean {
  if (event.type === "agent_spawn" && event.agentId && event.mapId) { progress.spawned.set(event.agentId, event.mapId); return false; }
  if (event.type !== "agent_done" || !event.ok || !event.agentId) return false;
  const mapId = progress.spawned.get(event.agentId);
  if (!mapId || progress.done.has(mapId)) return false;
  progress.done.add(mapId);
  return true;
}

/** 이어 하기 실행의 요청 글. 마지막 문장 «이어서 해 줘.» 가 v2 의 «계속» 판정(할 일 되살리기)을 켠다(src/ai/v2/request/scope.ts asksToContinue). */
export function resumeTaskText(journal: PiRunJournal, applied: number, doneMapNames: readonly string[] = []): string {
  const done = (applied > 0 ? ` 그 실행에서 이미 적용된 단계 ${applied}개는 프로젝트에 남아 있으니 다시 하지 말고 남은 일만 해라.` : "")
    + (doneMapNames.length ? ` 그 실행에서 끝난 맵: ${doneMapNames.join(", ")} — 이 맵들은 다시 짓지 말고 남은 맵·일만 해라.` : "");
  return `[이어 하기] 앱이 꺼져 앞 실행이 중단됐다. 원래 요청: «${journal.task}».${done}\n이어서 해 줘.`;
}
