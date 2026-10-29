// 화면 검수 고치기 차례의 상한 — 순수 모듈(실행기 scripts/lib/assistantV2Runtime.ts 가 도구 실행 앞에 끼운다).
//
// 왜(2026-10-29 vm1 argon escape 001): 화면 검수 1판(결함 6건) 뒤 고치기 차례 하나가 move_object 를 20번 넘게 불렀다.
// 절반 이상이 「옮기면 길이나 이벤트가 막혀 되돌렸다」 같은 같은 거절이었고, 차례 안에서는 판 상한(VQA_MAX_ROUNDS)·
// 「두 판 연속 그대로」 검사가 돌지 않아 45분 턴 상한까지 끝나지 않았다(호출당 1분+ 지연이라 더 길었다).
// 이제 고치기 차례마다 도구 호출 수·시간·같은 실패 되풀이를 세고, 넘으면 도구를 실행하지 않고 «남은 결함을 보고하라»는 거절을 돌려준다.

export interface VqaFixBudgetLimits {
  /** 고치기 차례 하나에서 실행할 도구 호출 최대 수. */
  readonly maxCalls: number;
  /** 고치기 차례 하나의 최대 시간(ms). */
  readonly maxMs: number;
  /** 같은 도구·같은 인자가 이만큼 실패하면 그 호출을 다시 실행하지 않는다. */
  readonly maxSameFailures: number;
  /** 같은 도구가 이 차례에서 이만큼 실패하면 그 도구를 더 실행하지 않는다(인자를 조금씩 바꿔 되풀이하는 경우). */
  readonly maxToolFailures: number;
}

const intEnv = (raw: string | undefined, fallback: number): number => {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/** OPRN_V2_VQA_FIX_MAX_CALLS(기본 12) · OPRN_V2_VQA_FIX_MAX_MS(기본 600000) · OPRN_V2_VQA_FIX_SAME_FAILS(기본 2) · OPRN_V2_VQA_FIX_TOOL_FAILS(기본 4). */
export function vqaFixBudgetLimits(env: Record<string, string | undefined> = process.env): VqaFixBudgetLimits {
  return {
    maxCalls: intEnv(env.OPRN_V2_VQA_FIX_MAX_CALLS, 12),
    maxMs: intEnv(env.OPRN_V2_VQA_FIX_MAX_MS, 600_000),
    maxSameFailures: intEnv(env.OPRN_V2_VQA_FIX_SAME_FAILS, 2),
    maxToolFailures: intEnv(env.OPRN_V2_VQA_FIX_TOOL_FAILS, 4),
  };
}

/** 인자 지문 — 키 순서와 상관없이 같은 인자면 같은 글. */
export function argsSignature(name: string, args: unknown): string {
  const norm = (v: unknown): unknown => Array.isArray(v) ? v.map(norm)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])])) : v;
  try { return `${name}:${JSON.stringify(norm(args))}`; } catch { return `${name}:?`; }
}

/** 읽기 도구는 세지 않는다 — 고치기 전에 살펴보는 것은 낭비가 아니다(실패 되풀이 검사도 쓰기 도구에만). */
const READ_ONLY = /^(inspect|list_|find_|get_|read_|inspect_)/u;

export class VqaFixBudget {
  #active = false;
  #startedAt = 0;
  #calls = 0;
  #sameFails = new Map<string, number>();
  #toolFails = new Map<string, number>();
  #capped: string | undefined;
  constructor(readonly limits: VqaFixBudgetLimits = vqaFixBudgetLimits()) {}

  /** 고치기 지시를 낼 때. 앞 차례 기록은 버린다. */
  start(now = Date.now()): void {
    this.#active = true; this.#startedAt = now; this.#calls = 0; this.#capped = undefined;
    this.#sameFails.clear(); this.#toolFails.clear();
  }
  /** 고치기 차례가 끝났을 때(다음 afterMain). */
  stop(): void { this.#active = false; }
  get active(): boolean { return this.#active; }
  /** 이 차례에서 상한에 닿았으면 그 사유(실행 기록용). */
  get capped(): string | undefined { return this.#capped; }
  get calls(): number { return this.#calls; }

  /** 도구를 실행하기 전에. 실행하면 안 되면 거절 사유를 돌려준다. 쓰기 도구는 여기서 센다. */
  check(name: string, args: unknown, now = Date.now()): string | undefined {
    if (!this.#active || READ_ONLY.test(name)) return undefined;
    const L = this.limits;
    const why = now - this.#startedAt >= L.maxMs ? `고치기 차례 시간 상한 ${Math.round(L.maxMs / 60000)}분`
      : this.#calls >= L.maxCalls ? `고치기 차례 도구 상한 ${L.maxCalls}회`
      : (this.#sameFails.get(argsSignature(name, args)) ?? 0) >= L.maxSameFailures ? `같은 ${name} 호출이 이미 ${L.maxSameFailures}번 실패`
      : (this.#toolFails.get(name) ?? 0) >= L.maxToolFailures ? `${name} 가 이 고치기 차례에서 ${L.maxToolFailures}번 실패`
      : undefined;
    if (why) { this.#capped ??= why; return why; }
    this.#calls += 1;
    return undefined;
  }
  /** 도구가 끝난 뒤(실패 되풀이 세기). */
  record(name: string, args: unknown, ok: boolean): void {
    if (!this.#active || ok || READ_ONLY.test(name)) return;
    const sig = argsSignature(name, args);
    this.#sameFails.set(sig, (this.#sameFails.get(sig) ?? 0) + 1);
    this.#toolFails.set(name, (this.#toolFails.get(name) ?? 0) + 1);
  }
}

/** 상한에 닿은 호출에 돌려줄 글 — 도구는 실행하지 않았다. */
export function vqaFixCapRefusal(why: string): string {
  return JSON.stringify({ ok: false, summary: `실행하지 않음 — 화면 검수 고치기 상한(${why}). 더 고치지 말고, 고치지 못한 결함을 최종 보고의 「남은 결함」으로 그대로 적고 이 차례를 끝낸다.` });
}
