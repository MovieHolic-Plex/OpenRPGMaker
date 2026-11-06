// 엔진 세션 재사용 — 한 사용자 요청이 워커 실행 여러 개로 쪼개질 때, 같은 CLI 대화를 이어 쓸지 정한다.
//
// 왜 (2026-11-06 ade-p2/A 실측): 요청 하나에 /v1/agent/run 이 3개(계획·실행·목표) 나가고 워커마다 Claude Code
// 프로세스를 새로 띄운다. 새 대화는 지시문 + 도구 목록(72~89k 토큰)을 캐시에 «처음부터 다시 쓴다».
// 그 재작성이 판 비용의 4.2~9.5% 였다(cat-explore-1 $1.28/13.39, school-romance-1 $0.94/10.06).
//
// 재개가 성립하는 조건은 실측으로 정해졌다(2026-11-06, claude 2.1.284):
// - `--resume <id>` 는 새 프로세스에서도 대화·MCP 도구·캐시를 잇는다(캐시 쓰기 19,677 → 248 토큰).
// - 그러나 **재개된 대화는 처음의 시스템 프롬프트를 그대로 쓴다** — 새 시스템 프롬프트 파일은 무시된다
//   (`PROMPT-ONE` 으로 시작한 대화에 `PROMPT-TWO` 를 주고 재개해도 `PROMPT-ONE` 이 답했다).
//   그래서 지시문이 다른 단계(읽기 전용 계획 턴 → 실행 턴)는 이어 쓸 수 없다. 모델·도구 목록도 같은 이유로 고정된다.
// - `--resume` 은 대화가 사용자 홈에 남아 있어야 한다 → claude 는 `--no-session-persistence` 를 꺼야 한다.
//   이것은 개인정보 선택이라 기본은 끄고, 재개를 실제로 쓰는 실행에서만 켠다(settings.sessionResume).
//
// 이 파일은 순수 모듈이다 — 워커·클라이언트·테스트가 같은 판정을 쓴다.

/** 재개 가능 여부를 정하는 실행 지문. 이 셋이 전부 같아야 CLI 대화를 이어 쓸 수 있다. */
export interface EngineSessionFingerprint {
  /** 워커가 만든 시스템 지시 전문(claude 는 `--system-prompt-file` 로 «바꾼다»). */
  readonly systemPrompt: string;
  /** 그 실행의 도구 이름 목록(정렬 전). */
  readonly toolNames: readonly string[];
  /** CLI 대화를 여는 모델 id. */
  readonly model: string;
}

export type SessionResumeDecision =
  | { readonly kind: "resume"; readonly sessionId: string }
  /** 이어 쓸 대화가 없거나 지문이 달라 새로 연다. `reason` 은 기록·보고용 짧은 한국어. */
  | { readonly kind: "fresh"; readonly reason: string; readonly engineCannotResume?: boolean };

/** 재개를 켜는 환경 변수(측정·문제 격리용). 기본 켜짐 — `OPRN_ENGINE_SESSION=0` 이면 예전처럼 매 실행 새 대화. */
export function engineSessionReuseOn(env: { readonly OPRN_ENGINE_SESSION?: string } | undefined): boolean {
  return env?.OPRN_ENGINE_SESSION !== "0";
}

/**
 * 두 지문이 같은 대화를 이어 쓸 수 있는가. 다르면 그 이유를 한 줄로 낸다(보고에 그대로 쓴다).
 * 순서: 지시문 → 도구 → 모델. 앞의 것이 다르면 뒤는 보지 않는다(고치는 사람이 원인을 바로 알게).
 */
export function sameEngineSession(a: EngineSessionFingerprint, b: EngineSessionFingerprint): { same: true } | { same: false; reason: string } {
  if (a.systemPrompt !== b.systemPrompt) return { same: false, reason: "시스템 지시가 달라 새 대화로 연다" };
  const left = [...new Set(a.toolNames)].sort();
  const right = [...new Set(b.toolNames)].sort();
  if (left.length !== right.length || left.some((name, i) => name !== right[i])) {
    const added = right.filter((name) => !left.includes(name));
    const removed = left.filter((name) => !right.includes(name));
    const parts = [
      ...(added.length ? [`더해짐 ${added.length}(${added.slice(0, 4).join(", ")}${added.length > 4 ? "…" : ""})`] : []),
      ...(removed.length ? [`빠짐 ${removed.length}(${removed.slice(0, 4).join(", ")}${removed.length > 4 ? "…" : ""})`] : []),
    ];
    return { same: false, reason: `도구 목록이 달라 새 대화로 연다 — ${parts.join(" · ")}` };
  }
  if (a.model !== b.model) return { same: false, reason: `모델이 달라(${a.model} → ${b.model}) 새 대화로 연다` };
  return { same: true };
}

/** 재개를 켤지 정한다. 켜지 못하면 이유를 남긴다(조용히 새 대화로 돌지 않는다). */
export function decideSessionResume(input: {
  readonly requestedSessionId: string | undefined;
  readonly previous: EngineSessionFingerprint | undefined;
  readonly current: EngineSessionFingerprint;
  /** 어댑터가 재개를 지원하는가(codex·gemini·claude 예). */
  readonly engineCanResume: boolean;
  readonly reuseEnabled: boolean;
}): SessionResumeDecision {
  if (!input.reuseEnabled) return { kind: "fresh", reason: "세션 재사용이 꺼져 있다(OPRN_ENGINE_SESSION=0)" };
  if (!input.engineCanResume) return { kind: "fresh", reason: "이 엔진은 대화를 이을 수 없어 새로 연다", engineCannotResume: true };
  if (!input.requestedSessionId) return { kind: "fresh", reason: "이어 쓸 대화가 없다(이 요청의 첫 실행)" };
  if (!input.previous) return { kind: "fresh", reason: "이전 실행의 지시문·도구 지문이 없다" };
  const verdict = sameEngineSession(input.previous, input.current);
  if (!verdict.same) return { kind: "fresh", reason: verdict.reason };
  return { kind: "resume", sessionId: input.requestedSessionId };
}
