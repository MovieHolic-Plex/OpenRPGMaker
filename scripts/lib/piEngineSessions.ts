// 한 사용자 요청의 워커 실행들을 같은 CLI 대화로 잇는 기록.
//
// 실측(2026-11-06): 요청 하나가 /v1/agent/run 을 3번(계획·실행·목표) 낸다. 워커는 실행마다 CLI 프로세스를 새로 열고,
// 새 대화는 지시문+도구 목록(72~89k 토큰)을 캐시에 처음부터 다시 쓴다 — 판 비용의 4.2~9.5%.
// 재개는 지시문·도구·모델이 **전부 같을 때만** 성립한다(재개된 대화는 처음 시스템 프롬프트를 그대로 쓴다, 2026-11-06 실측).
// 그래서 워커가 실행이 끝날 때 자기 지문을 이 기록에 남기고, 다음 실행이 같은 열쇠로 같은 지문을 찾으면 그 대화를 잇는다.
//
// 프로세스 수명은 워커와 같다 — 워커가 재시작하면 기록도 사라지고, 그때는 그냥 새 대화로 열린다(정확성 손실 없음).

import type { EngineSessionFingerprint } from "../../../src/ai/piAgent/sessionResume.ts";

export interface EngineSessionRecord {
  readonly fingerprint: EngineSessionFingerprint;
  readonly sessionId: string;
  readonly savedAt: number;
}

/** 열쇠 개수 상한. 프로젝트 몇 개의 요청이 겹쳐도 넘치지 않고, 넘치면 가장 오래된 것부터 버린다. */
const MAX_KEYS = 8;

const records = new Map<string, EngineSessionRecord>();

export function rememberEngineSession(key: string, fingerprint: EngineSessionFingerprint, sessionId: string): void {
  if (!key || !sessionId) return;
  records.delete(key);
  records.set(key, { fingerprint, sessionId, savedAt: Date.now() });
  while (records.size > MAX_KEYS) {
    const oldest = records.keys().next().value;
    if (oldest === undefined) break;
    records.delete(oldest);
  }
}

export function recallEngineSession(key: string | undefined): EngineSessionRecord | undefined {
  return key ? records.get(key) : undefined;
}

/** 이 열쇠의 기록을 잊는다 — 재개가 실패했을 때 낡은 대화 id 로 다시 시도하지 않게. */
export function forgetEngineSession(key: string | undefined): void {
  if (key) records.delete(key);
}

export function resetEngineSessionsForTests(): void {
  records.clear();
}
