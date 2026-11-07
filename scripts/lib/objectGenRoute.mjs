// 없는 기물 그리기(화면 없는 공방)의 모델 경로 고르기 — 순수 함수. 환경 변수 없이도 고른다.
//
// 오너(2026-11-07): 「terra 밖에 없는 사람들 입장에선 저거라도 해야 ... opus 가 있으면 우선해야겟지만」.
// 순서: ① Claude Code(claude) 가 있으면 Opus 5.5 medium(`claude -p`) — 그리기·검수, 3/4 관문 영수증까지.
//       ② 없으면 ChatGPT 구독 — 명시한 OpenAI 호환 주소(OPRN_OBJECTGEN_CHAT_URL)가 있으면 그것, 없으면 참고 그림 단계가
//          이미 요구하는 Codex 로그인(~/.codex/auth.json)으로 GPT 6.1 Terra high 가 그리기·검수.
//          3/4 관문 영수증 판정자는 프로필에 묶인 claude -p 라 이 경로에는 없다 — 건너뛰는 것이 아니라 「영수증 없음」으로 알린다.
//       ③ 둘 다 없으면 그리지 않고 크게 실패.

export const OPUS_DRAW_MODEL = "claude-opus-5-5";
export const TERRA_DRAW_MODEL = "gpt-6.1-terra";

/**
 * @param {{ hasClaude: boolean, codexLogin: boolean, chatUrl?: string, gateOff?: boolean, model?: string, effort?: string }} env
 * @returns {{ ok: true, route: "claude" | "openai-compat" | "codex", model: string, effort: string, gate: "receipt" | "off" | "unavailable", label: string, note: string | null }
 *         | { ok: false, reason: string }}
 */
export function chooseObjectGenRoute(env) {
  if (!env.codexLogin) {
    return { ok: false, reason: "참고 그림을 그릴 ChatGPT(Codex) 로그인이 없다 — `codex login` 으로 로그인한다(Google·유료 API 로 대신 그리지 않는다)." };
  }
  if (env.hasClaude && !env.chatUrl) {
    const model = env.model || OPUS_DRAW_MODEL;
    const effort = env.effort || "medium";
    return { ok: true, route: "claude", model, effort, gate: env.gateOff ? "off" : "receipt", label: `claude -p ${model} ${effort}`, note: env.gateOff ? "3/4 관문 영수증을 껐다(OPRN_OBJECTGEN_GATE=off)." : null };
  }
  const model = env.model || TERRA_DRAW_MODEL;
  const effort = env.effort || "high";
  const route = env.chatUrl ? "openai-compat" : "codex";
  const where = env.chatUrl ? `OpenAI 호환 ${env.chatUrl}` : "ChatGPT(Codex) 로그인";
  return {
    ok: true, route, model, effort,
    gate: env.hasClaude && !env.gateOff ? "receipt" : "unavailable",
    label: `${where} ${model} ${effort}`,
    note: env.hasClaude && !env.gateOff ? null : "3/4 관문 영수증 판정자(Claude Code)가 없어 영수증 없이 공방 독립 검수만으로 굽는다 — 번들·공용·스토어 출구는 이 기물을 받지 않는다.",
  };
}
