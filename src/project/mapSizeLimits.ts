// project/mapSizeLimits.ts
// 맵 지원 상한의 **유일한** 선언 지점.
//
// 왜 한 곳인가(OPRN-OUT-018 실측): create_map·resize_map·generate_map·author_village 는 256을
// 상한으로 거부했는데 build_world 만 상한이 없어 257×257 셀 배열을 실제로 할당했고, lint 는
// 그 맵을 warning 으로만 보고했다. 그래서 "스튜디오는 256이 최대라고 안내하는데 조수가 만든
// 257 맵이 프로젝트에 남는" 어긋난 상태가 생겼다(라이브 재현: 맵 제안은 성공, 이어진 검토가
// 입력 크기 HTTP 400 으로 실패해 커밋 전에 멈췄다). 숫자와 문구를 여기서만 정해 생성·크기변경·
// lint 가 같은 계약을 말하게 한다.

export const MAX_TOOL_MAP_DIMENSION = 256;

export function exceedsMapDimensionLimit(width: number, height: number): boolean {
  return width > MAX_TOOL_MAP_DIMENSION || height > MAX_TOOL_MAP_DIMENSION;
}

/**
 * 거부/진단 문구. 상한과 회복 수단(맵 분할 + transfer 연결)을 항상 함께 말한다 —
 * 상한만 알려 주면 "그럼 어떻게 넓은 월드를 만드나"에 답이 없어 모델이 같은 크기로 재시도한다.
 *
 * @param subject 앞에 붙일 대상 설명(예: `"생성 맵 크기"`). 생략하면 `"맵 크기"`.
 */
export function mapSizeLimitMessage(subject = "맵 크기"): string {
  return `${subject}는 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}까지 가능합니다.`
    + " 더 넓은 월드는 여러 맵으로 나누고 transfer 이벤트로 연결하세요.";
}
