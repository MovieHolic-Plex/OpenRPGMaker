/** User messages describe outcomes; technical evidence stays in execution records. */
export const USER_FACING_REPORT_RULE = "사용자에게 보내는 최종 답변은 쉬운 한국어로 작성한다. 무엇을 바꿨는지, 바꾸지 않은 것, 남은 문제나 사용자가 해야 할 일을 중심으로 말한다. 도구명·내부 ID·JSON 키·모델명·턴/툴콜 수는 실행 기록에만 남긴다. 질문에는 필요한 내용을 빠짐없이 답하며 사용자 확인 질문·실패·미완료·주의사항을 생략하지 않는다. 도구 결과로 확인하지 않은 성공을 말하지 말고, 적용 전 초안과 실제 적용을 구별한다. 내부 사고 과정은 출력하지 않는다.";

export function friendlyExecutionError(message: string): string {
  if (/중단했습니다|aborted/i.test(message)) return "작업을 중단했어요.";
  if (/PROHIBITED_CONTENT|content.filter|safety/i.test(message)) return "AI 제공자가 응답을 중단했어요. 답변을 끝까지 받지 못했어요.";
  if (/401|403|auth|credential|로그인|인증/i.test(message)) return "AI 연결을 확인하지 못했어요. 설정에서 로그인 상태를 확인해 주세요.";
  if (/429|rate.limit|quota|한도/i.test(message)) return "AI 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.";
  if (/timeout|timed.out|시간.*상한/i.test(message)) return "응답을 기다리다가 작업이 멈췄어요. 다시 시도해 주세요.";
  if (/fetch|network|connection|503|연결/i.test(message)) return "AI에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.";
  return "작업을 끝내지 못했어요. 작업 과정에서 자세한 내용을 확인할 수 있어요.";
}
