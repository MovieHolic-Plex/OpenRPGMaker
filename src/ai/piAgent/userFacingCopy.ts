/** User messages describe outcomes; technical evidence stays in execution records. */
export const USER_FACING_REPORT_RULE = "사용자에게 보내는 최종 답변은 쉬운 한국어로 작성한다. 무엇을 바꿨는지, 바꾸지 않은 것, 남은 문제나 사용자가 해야 할 일을 중심으로 말한다. 도구명·내부 ID·JSON 키·모델명·턴/툴콜 수는 실행 기록에만 남긴다. 질문에는 필요한 내용을 빠짐없이 답하며 사용자 확인 질문·실패·미완료·주의사항을 생략하지 않는다. 도구 결과로 확인하지 않은 성공을 말하지 말고, 적용 전 초안과 실제 적용을 구별한다. 내부 사고 과정은 출력하지 않는다.";

export function friendlyExecutionError(message: string): string {
  // 제공자 쪽 끊김은 사용자가 멈춘 것이 아니다 — 「중단했어요」라고 하면 사용자가 자기가 멈춘 줄 안다(G12).
  // 같은 맵의 앞선 작업이 아직 예약을 쥐고 있다 — 이유를 말하지 않으면 「실행 실패 · 변경 없음」만 보였다(2026-10-25 G46).
  if (/이미 실행 중입니다|map-busy/u.test(message)) return "이 맵에서 앞선 조수 작업이 아직 끝나지 않았어요. 그 작업이 끝나거나 멈춘 뒤(최대 몇 분) 다시 보내 주세요.";
  // 편집기가 단계 적용 결과를 작업기에 돌려주지 못했다(부하로 연결이 잠깐 끊김) — 일반 문장 대신 무슨 일인지 말한다(G43).
  if (/(적용|맵 이미지) 응답을 전달하지 못했습니다/u.test(message)) return "작업 도중 편집기와 AI 작업기 사이 연결이 끊겨 멈췄어요.";
  // 작업기(bun)가 죽으면 스트림이 「terminated」로 끝난다(2026-10-25 G45 실제 강제 종료 시험) — 맵 예약은 풀린다.
  if (/^terminated$|worker (exited|crashed)|작업기가 (종료|멈)/iu.test(message.trim())) return "AI 작업기가 갑자기 멈췄어요. 같은 요청을 다시 보내면 처음부터 다시 해요.";
  if (/^Request was aborted\.?$|첫 응답이 늦어/i.test(message)) return "AI 모델의 첫 응답이 너무 늦어 요청이 끊겼어요. 같은 요청을 다시 보내면 이어서 해요.";
  if (/중단했습니다|aborted/i.test(message)) return "작업을 중단했어요.";
  // 공급자(클라우드)의 내용 검열 400 — 원문 오류나 「끝까지 받지 못했어요」만 보이면 무엇을 해야 할지 모른다(2026-10-25 Salad S1:
  // DeepSeek·InferHub 가 공포 요청 9건을 「InternalError.Algo.DataInspectionFailed: Input text data may contain inappropriate content」로 끊었다).
  if (/DataInspectionFailed|inappropriate content|moderation|content[_ ]policy|flagged by|data_inspection/iu.test(message)) return "이 AI 연결(제공자)이 요청이나 만든 내용 일부를 부적절한 표현으로 보고 막았어요. 공포·폭력 묘사가 있으면 표현을 조금 순하게 바꿔 다시 보내거나(예: 「피」 대신 「붉은 얼룩」), 설정에서 다른 AI 모델로 바꿔 보세요.";
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

const READ_ONLY_TOOL = /^(get_|find_|list_|inspect|search|read_|lookup|see$|preview|plan_|run_scene_test|run_lint|check|explain|describe|query|tile_query|show_)/u;
const WRITE_GROUPS: readonly (readonly [RegExp, string])[] = [
  [/^(make_place|edit_place|make_game|build_|stamp_|paint_|tile_)/u, "장소를 짓거나 고침"],
  [/^remove_event$/u, "이벤트를 지움"],
  [/(event|cutscene|scene|npc|people|dialogue)/u, "이벤트·장면을 만들거나 고침"],
  [/(opening|animatic)/u, "오프닝을 바꿈"],
  [/title_screen/u, "타이틀 화면을 바꿈"],
  [/ending/u, "엔딩을 바꿈"],
  [/(story_flag|switch|variable)/u, "이야기 깃발을 정함"],
  [/(time_system|clock)/u, "시간 설정을 바꿈"],
];
/**
 * 실행이 도중에 끊겼을 때 이미 반영한 것을 쉬운 말로 — 일반 오류 문장만 보이면 사용자는 무엇이 바뀌었는지 몰랐다
 * (2026-10-25 장난감 가게 G43: 이벤트 5개를 지우고 장면을 다시 쓰던 중 끊겼는데 「작업을 끝내지 못했어요」만 남았다).
 */
export function describeAppliedWrites(toolNames: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of toolNames) {
    if (READ_ONLY_TOOL.test(name)) continue;
    const label = WRITE_GROUPS.find(([pattern]) => pattern.test(name))?.[1] ?? "그 밖의 설정을 바꿈";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  if (!counts.size) return "";
  return `끊기기 전에 반영한 것: ${[...counts].map(([label, n]) => n > 1 ? `${label}(${n}번)` : label).join(", ")}. 나머지 요청은 다시 보내 주시면 이어서 해요.`;
}
