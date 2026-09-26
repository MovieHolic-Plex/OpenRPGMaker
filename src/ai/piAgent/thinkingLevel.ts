// 사고 강도 정규화만 들고 있는 잎 모듈.
//
// 왜 plainTurn.ts 가 아닌가: Bun 워커(`scripts/lib/piAgentRuntime.ts`)가 이 함수를 권위 경계에서 불러야 하는데,
// plainTurn.ts 는 `@/ai/sessionToolExposure`·`@/editor/tools/authorVillageScope` 같은 편집기 쪽 모듈을 끌고 온다 —
// 워커 프로세스에 편집기·브라우저 코드가 실려 임포트 시점에 깨질 수 있다. 그래서 워커는 잎 모듈만 임포트한다.
// 여기의 런타임 임포트는 `@/ai/oauth/credentials`(임포트 0개 상수 파일) 하나뿐이고, 워커는 이미 그 파일에서
// CODEX_PROVIDER_ID 를 직접 가져오고 있다.

import { ANTIGRAVITY_PROVIDER_ID } from "@/ai/oauth/credentials";
import type { PiAgentThinkingLevel } from "./protocol";

/**
 * 공급자가 받지 않는 사고 강도를 받는 값으로 낮춘다.
 *
 * 실측(2026-09-26, 동반 서비스 직결 OAuth): google-antigravity 는 "off" 를 거부한다 — HTTP 200 스트림에
 * error 이벤트 `Thinking effort off is not supported by google-antigravity/gemini-3.8-flash.
 * Supported efforts: minimal, low, medium, high` 가 실려 실행이 첫 호출에서 죽는다. 그래서 그 공급자에서만
 * "off" → "minimal" 로 낮춘다. 다른 공급자·다른 값은 사용자가 고른 그대로 보낸다(몰래 바꾸지 않는다).
 */
export function normalizePiThinkingLevel(provider: string | undefined, level: PiAgentThinkingLevel | undefined): PiAgentThinkingLevel | undefined {
  if (level !== "off") return level;
  return provider === ANTIGRAVITY_PROVIDER_ID ? "minimal" : level;
}
