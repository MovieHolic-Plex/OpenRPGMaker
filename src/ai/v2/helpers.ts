// 조수 v2 의 잔일 일꾼(ask_helpers) — 주 모델이 계획·검수하고, 짧고 틀이 정해진 일(NPC 대사 여러 줄 초안·이름 짓기·긴 글 요약·
// 아이템 설명·후보 고르기)을 잔일 모델(src/ai/assistantRoles.ts 의 smol 칸, 예: Gemini Flash)에게 맡긴다.
//
// 일꾼은 도구가 없다 — 프로젝트를 읽거나 고치지 않고, 받은 글(context)만 보고 글/JSON 을 돌려준다. 결과는 «초안»이고 쓰기는 주 모델이 한다.
// 일마다 따로 작은 문맥에서 돈다(서로 섞이지 않는다). fields 를 주면 그 열쇠를 가진 JSON 을 요구하고, 틀리면 한 번만 다시 묻는다.
// 순수 모듈 — 호출(chat)은 밖에서 넣는다(scripts/lib/piAgentRuntime.ts 의 roleChat / sideChat).

export interface HelperJob {
  readonly id?: string;
  /** 무엇을 해 달라는지(한국어 한두 문장). */
  readonly task: string;
  /** 일꾼이 볼 재료(인물 설명·장면 요약·말투 예시 등). 프로젝트를 못 보므로 필요한 것은 여기 다 넣는다. */
  readonly context?: string;
  /** 주면 이 열쇠들을 가진 JSON 을 돌려받는다(count 가 있으면 그런 객체의 배열). */
  readonly fields?: readonly string[];
  /** 같은 모양의 결과를 몇 개(예: 대사 5줄 = 5). fields 와 같이 쓴다. */
  readonly count?: number;
}

export interface HelperResult {
  readonly id: string;
  readonly ok: boolean;
  readonly text?: string;
  readonly data?: unknown;
  readonly problem?: string;
  readonly ms: number;
}

/** ask_helpers 를 싣는가 — A/B(잔일 일꾼 있음/없음) 전에는 환경 변수로만 켠다(다른 시험의 도구 목록을 바꾸지 않게, make_game 과 같은 관례). */
export function helpersOn(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPRN_V2_HELPERS === "1";
}

export const HELPER_LIMITS = { jobs: 8, task: 2_000, context: 8_000, fields: 12, count: 20, parallel: 4, reply: 12_000 } as const;

type Chat = (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;

/** 입력 검사. 틀리면 이유 하나(그 일은 돌리지 않는다). */
export function helperJobProblem(job: HelperJob): string | undefined {
  if (!job || typeof job.task !== "string" || !job.task.trim()) return "task 가 비었다";
  if (job.task.length > HELPER_LIMITS.task) return `task 가 ${job.task.length}자 — ${HELPER_LIMITS.task}자 이하로`;
  if (job.context !== undefined && (typeof job.context !== "string" || job.context.length > HELPER_LIMITS.context)) return `context 는 ${HELPER_LIMITS.context}자 이하 글`;
  if (job.fields !== undefined && (!Array.isArray(job.fields) || !job.fields.length || job.fields.length > HELPER_LIMITS.fields || job.fields.some((f) => typeof f !== "string" || !f.trim()))) return `fields 는 열쇠 이름 1~${HELPER_LIMITS.fields}개`;
  if (job.count !== undefined && (!Number.isInteger(job.count) || job.count < 1 || job.count > HELPER_LIMITS.count)) return `count 는 1~${HELPER_LIMITS.count}`;
  if (job.count !== undefined && !job.fields) return "count 는 fields 와 같이 쓴다";
  return undefined;
}

export function helperPrompt(job: HelperJob): string {
  const shape = job.fields
    ? job.count
      ? `JSON 배열만 답한다(설명·코드 울타리 없이). 원소 ${job.count}개, 각 원소는 열쇠 ${job.fields.map((f) => `"${f}"`).join(", ")} 를 가진 객체.`
      : `JSON 객체 하나만 답한다(설명·코드 울타리 없이). 열쇠: ${job.fields.map((f) => `"${f}"`).join(", ")}.`
    : "답만 쓴다(머리말·맺음말 없이).";
  return [
    "너는 한국어 RPG 를 만드는 주 조수를 돕는 일꾼이다. 아래 일 하나만 한다. 프로젝트는 볼 수 없다 — 재료에 있는 것만 쓴다. 재료에 없는 고유명사(인물·장소·아이템 이름)를 지어내지 않는다(일이 이름 짓기면 예외).",
    `# 일\n${job.task.trim()}`,
    ...(job.context?.trim() ? [`# 재료\n${job.context.trim()}`] : []),
    `# 답 모양\n${shape}`,
  ].join("\n\n");
}

/** 답에서 JSON 을 꺼내 모양을 검사한다. */
export function parseHelperReply(job: HelperJob, reply: string): { ok: true; data: unknown } | { ok: false; problem: string } {
  const body = reply.replace(/^\s*```(?:json)?\s*/u, "").replace(/\s*```\s*$/u, "").trim();
  const start = job.count ? body.indexOf("[") : body.indexOf("{");
  const end = job.count ? body.lastIndexOf("]") : body.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, problem: job.count ? "JSON 배열이 없다" : "JSON 객체가 없다" };
  let data: unknown;
  try { data = JSON.parse(body.slice(start, end + 1)); } catch (error) { return { ok: false, problem: `JSON 이 깨졌다: ${error instanceof Error ? error.message.slice(0, 80) : "?"}` }; }
  const fields = job.fields ?? [];
  const checkObj = (o: unknown, where: string): string | undefined => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return `${where} 가 객체가 아니다`;
    const missing = fields.filter((f) => (o as Record<string, unknown>)[f] === undefined || (o as Record<string, unknown>)[f] === "");
    return missing.length ? `${where} 에 ${missing.join(",")} 가 없다` : undefined;
  };
  if (job.count) {
    if (!Array.isArray(data)) return { ok: false, problem: "배열이 아니다" };
    if (data.length !== job.count) return { ok: false, problem: `원소가 ${data.length}개 — ${job.count}개여야 한다` };
    const bad = data.map((o, i) => checkObj(o, `${i}번째`)).find(Boolean);
    return bad ? { ok: false, problem: bad } : { ok: true, data };
  }
  const bad = checkObj(data, "답");
  return bad ? { ok: false, problem: bad } : { ok: true, data };
}

async function runOne(job: HelperJob, index: number, chat: Chat, signal?: AbortSignal): Promise<HelperResult> {
  const id = job.id?.trim() || `job${index + 1}`;
  const t0 = Date.now();
  const problem = helperJobProblem(job);
  if (problem) return { id, ok: false, problem, ms: 0 };
  const prompt = helperPrompt(job);
  try {
    const first = (await chat([{ role: "user", content: prompt }], signal)).slice(0, HELPER_LIMITS.reply);
    if (!job.fields) return first.trim() ? { id, ok: true, text: first.trim(), ms: Date.now() - t0 } : { id, ok: false, problem: "빈 답", ms: Date.now() - t0 };
    const parsed = parseHelperReply(job, first);
    if (parsed.ok) return { id, ok: true, data: parsed.data, ms: Date.now() - t0 };
    // 한 번만 다시 — 무엇이 틀렸는지 말해 준다.
    const again = (await chat([
      { role: "user", content: prompt },
      { role: "assistant", content: first },
      { role: "user", content: `답 모양이 틀렸다(${parsed.problem}). 같은 일을 「답 모양」대로 JSON 만 다시 답한다.` },
    ], signal)).slice(0, HELPER_LIMITS.reply);
    const second = parseHelperReply(job, again);
    return second.ok ? { id, ok: true, data: second.data, ms: Date.now() - t0 } : { id, ok: false, problem: second.problem, text: again.slice(0, 400), ms: Date.now() - t0 };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { id, ok: false, problem: `일꾼 호출 실패: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`, ms: Date.now() - t0 };
  }
}

/** 일 여러 개를 최대 HELPER_LIMITS.parallel 개씩 동시에. 결과 순서는 입력 순서. */
export async function runHelperJobs(jobs: readonly HelperJob[], chat: Chat, signal?: AbortSignal): Promise<HelperResult[]> {
  const list = jobs.slice(0, HELPER_LIMITS.jobs);
  const out: HelperResult[] = new Array(list.length);
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < list.length) {
      const i = next++;
      out[i] = await runOne(list[i]!, i, chat, signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(HELPER_LIMITS.parallel, list.length) }, lane));
  return out;
}
