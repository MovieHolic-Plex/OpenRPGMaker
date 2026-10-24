/** User messages describe outcomes; technical evidence stays in execution records. */
export const USER_FACING_REPORT_RULE = "사용자에게 보내는 최종 답변은 쉬운 한국어로 작성한다. 무엇을 바꿨는지, 바꾸지 않은 것, 남은 문제나 사용자가 해야 할 일을 중심으로 말한다. 도구명·내부 ID·JSON 키·모델명·턴/툴콜 수는 실행 기록에만 남긴다. 질문에는 필요한 내용을 빠짐없이 답하며 사용자 확인 질문·실패·미완료·주의사항을 생략하지 않는다. 도구 결과로 확인하지 않은 성공을 말하지 말고, 적용 전 초안과 실제 적용을 구별한다. 내부 사고 과정은 출력하지 않는다.";

export function friendlyExecutionError(message: string): string {
  // 제공자 쪽 끊김은 사용자가 멈춘 것이 아니다 — 「중단했어요」라고 하면 사용자가 자기가 멈춘 줄 안다(G12).
  if (/^Request was aborted\.?$|첫 응답이 늦어/i.test(message)) return "AI 모델의 첫 응답이 너무 늦어 요청이 끊겼어요. 같은 요청을 다시 보내면 이어서 해요.";
  if (/중단했습니다|aborted/i.test(message)) return "작업을 중단했어요.";
  if (/PROHIBITED_CONTENT|content.filter|safety/i.test(message)) return "AI 제공자가 응답을 중단했어요. 답변을 끝까지 받지 못했어요.";
  if (/401|403|auth|credential|로그인|인증/i.test(message)) return "AI 연결을 확인하지 못했어요. 설정에서 로그인 상태를 확인해 주세요.";
  if (/429|rate.limit|quota|한도/i.test(message)) return "AI 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.";
  if (/timeout|timed.out|시간.*상한/i.test(message)) return "응답을 기다리다가 작업이 멈췄어요. 다시 시도해 주세요.";
  if (/fetch|network|connection|503|연결/i.test(message)) return "AI에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.";
  return GENERIC_EXECUTION_ERROR;
}
export const GENERIC_EXECUTION_ERROR = "작업을 끝내지 못했어요. 작업 과정에서 자세한 내용을 확인할 수 있어요.";
/**
 * 적용 거절의 화면 문장. 사유 코드(`commit-rejected`)와 도구 이름(`set_start_position`·`tile_query`)은 실행 기록에만 남긴다.
 * 이슈 문장에서 영문 식별자를 걷고도 한국어 설명이 남으면 그것을 이유로 붙인다.
 */
export function friendlyApplyFailure(reason: string, issue?: string): string {
  const head = reason === "stale-base" || reason === "stale-baseline" ? "그사이 맵이 바뀌어 변경을 적용하지 못했어요."
    : reason === "retired-run" ? "이미 끝난 작업이라 변경을 적용하지 않았어요."
    : reason === "map-destruction-unapproved" ? "맵을 지우는 변경이라 확인 없이는 적용하지 않았어요."
    : "변경 내용을 적용하지 못했어요.";
  const cleaned = (issue ?? "")
    .replace(/`[^`]*`/gu, "")
    .replace(/\b[a-z][a-z0-9]*(?:[_-][a-z0-9]+)+\b/gu, "")
    .replace(/\(\s*\)|\[\s*\]/gu, "")
    .replace(/\s+/gu, " ").trim();
  return /[가-힣]/u.test(cleaned) ? `${head} ${cleaned}` : head;
}
