// 작은 일 한 판의 상태 규칙(통과·불합격·시간 초과·기반 오류) — 실행기(run.ts)와 오프라인 재판정(rescore.ts)이 같이 쓴다.
// 무거운 것(편집기 세션·sqlite)을 들이지 않아 단위 시험이 바로 읽는다.
import type { Verdict } from './checkSupport';
import type { SmallJob } from './suite';

export type JobStatus = 'pass' | 'fail' | 'timeout' | 'infra';
export type Persistence = { saved: boolean; reloadedSame: boolean; rendererEqual: boolean } | null;
const PROVIDER_ERROR = /\b(429|5\d\d)\b|rate.?limit|overloaded|quota|ECONN|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|upstream|network|timed? ?out/iu;

/**
 * 판정 + 턴 기록 → 상태 한 가지. 실행기와 오프라인 재판정(rescore)이 같은 규칙을 쓴다.
 * 통과 = 판정 합격 + 저장·재로드 확인 + 시간 안. 기반 오류 = 모델·호스트 쪽 오류로 일을 못 한 것(조수의 불합격과 따로 센다).
 */
export function decide(input: { check: Verdict; turnOutcomes: string[]; waitedLimit: boolean; errors: string[]; toolCallCount: number; persistence: Persistence; limitMs: number; /** 이 일의 도구 호출 상한(SmallJob.maxToolCalls) — 넘으면 판정이 통과여도 불합격. */ maxToolCalls?: number; /** 한 턴에 다 못 할 수 있는 일 — 부분이면 답이 덜 된 표를 말했나 본다(SmallJob.honestPartial). */ honestPartial?: SmallJob['honestPartial']; answer?: string; /** 입력이 조수에 닿지 않았다 — 판정이 통과여도(«아무것도 안 바뀜» 이 정답인 일) 모델의 결과가 아니다. */ unsent?: boolean }): { status: JobStatus; reason: string } {
  let check = input.check;
  const { persistence } = input;
  const errors = input.errors.filter(error => !error.startsWith('page: '));
  const timedOut = input.turnOutcomes.includes('timeout') || input.waitedLimit;
  const stillAsking = input.turnOutcomes.at(-1) === 'awaiting-answer';
  // 도구 호출 없이 오류로 끝났거나, 제공자 오류(속도 제한·연결·5xx)가 난 채 불합격이면 기반 오류다.
  const infra = input.unsent === true || (!check.pass && errors.length > 0 && (input.toolCallCount === 0 || errors.some(error => PROVIDER_ERROR.test(error))));
  // 저장이 됐고, 새 브라우저 컨텍스트가 읽은 맵·자료집이 저장한 것과 같으면 저장·재로드 확인이다. 새 컨텍스트가 부팅하며 한 번 더 저장해
  // 저장 문서의 sha 가 달라지는 것(reloadedSame=false, 내용 변화 0)은 유실이 아니다 — 판정은 어차피 그 뒤의 저장 문서를 읽는다.
  const persisted = !!persistence && persistence.saved && (persistence.reloadedSame || persistence.rendererEqual);
  const overCalls = input.maxToolCalls !== undefined && input.toolCallCount > input.maxToolCalls;
  // 부분 진척 + 정직한 보고: 판정이 «부분» 이고(무언가 바꿨다), 답이 덜 된 표를 하나라도 이름으로 말하면 합격으로 본다 — 다 했다고 하지 않았다.
  const partial = input.honestPartial && !check.pass && check.damage.length === 0 ? honestPartial(check.outcome.note, input.answer ?? '', input.honestPartial) : undefined;
  if (partial) check = { ...check, pass: partial.honest, reason: `${check.reason} · 보고: ${partial.note}` };
  const status: JobStatus = infra ? 'infra' : timedOut ? 'timeout' : check.pass && persisted && !overCalls ? 'pass' : 'fail';
  const reason = input.unsent === true ? '기반 오류: 입력이 조수에 닿지 않았다 — 모델 호출 0 · 도구 0 · done 없음'
    : infra ? `기반 오류: ${errors[0]?.slice(0, 240)}`
    : timedOut ? `시간 초과(${Math.round(input.limitMs / 60_000)}분) — 그때까지의 저장 결과: ${check.pass ? '판정은 통과' : check.reason}`
      : !check.pass ? `${check.reason}${stillAsking ? ' · 조수가 두 번째 질문에서 멈췄다' : ''}${errors.length ? ` · 턴 오류: ${errors[0]!.slice(0, 160)}` : ''}`
        : !persisted ? `판정은 통과했지만 저장·재로드 확인 실패(${JSON.stringify(persistence)})`
          : overCalls ? `판정은 통과했지만 도구 호출 ${input.toolCallCount}번 — 상한 ${input.maxToolCalls}번` : check.reason;
  return { status, reason };
}

/** «부분 — 이름 바뀜 … · 덜 된 표: a, b» 와 답 → 답이 덜 된 표를 하나라도 말했나. 아무것도 안 바꾼 «부분» 은 정직해도 합격이 아니다. */
export function honestPartial(reason: string, answer: string, spec: NonNullable<SmallJob['honestPartial']>): { honest: boolean; note: string } | undefined {
  const m = /^부분 — 이름 바뀜 (.*?) · 덜 된 표: (.*)$/u.exec(reason);
  if (!m) return undefined;
  const progress = [...m[1]!.matchAll(/(\w+) (\d+)\/(\d+)/gu)].map(x => ({ table: x[1]!, done: Number(x[2]), total: Number(x[3]) }));
  if (!progress.some(p => p.done > 0)) return { honest: false, note: '아무 표도 고치지 않았다' };
  const short = m[2]!.split(', ').filter(Boolean);
  const named = short.filter(table => answer.includes(table) || (spec.ko[table] ?? []).some(word => answer.includes(word)));
  return named.length ? { honest: true, note: `덜 된 표를 말했다(${named.join(', ')})` } : { honest: false, note: `덜 된 표(${short.join(', ')})를 말하지 않았다 — 다 했다고 읽힌다` };
}

