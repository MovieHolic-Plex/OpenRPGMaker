// ai/interviewPrompt.ts
// "맵 인터뷰" 킥오프 프롬프트(순수 모듈). 사람이 깐 맵을 보고 AI가 소크라테스식으로
// 사용자에게 타일 의미를 묻고, 답을 set_tile_metadata/upsert_tile_group으로 기록하는 프로토콜.
// 챗 패널의 🎓 버튼이 이 텍스트를 사용자 메시지로 보내 세션을 인터뷰 모드로 만든다.

export const QUICK_REPLY_MARKER = "[선택지]";

export function buildInterviewKickoff(mapId: string | null): string {
  const target = mapId ? `mapId="${mapId}"` : "get_project_summary로 확인한 시작 맵";
  return [
    "지금부터 '맵 인터뷰'를 진행합니다. 목표: 내가 직접 깐 이 맵을 보고, 타일의 의미를 나에게 물어서 메타데이터로 기록하는 것.",
    "",
    "절차(소크라테스식 산파법 — 반드시 준수):",
    `1. analyze_map_tile_usage(${target})로 사용된 타일과 설명 없는(described=false) 타일을 파악하세요.`,
    "2. 설명 없는 타일 중 가장 많이 쓰인 것부터, 한 턴에 하나씩만 질문하세요.",
    "3. 질문 직전에 반드시 두 가지를 호출하세요: show_tiles([타일번호])로 타일 이미지를 채팅에 띄우고,",
    "   highlight_map_region으로 그 타일의 sampleRegion을 맵에서 강조하세요. 번호만 말하면 나는 어떤 타일인지 모릅니다.",
    "4. 질문은 짧게. 인접 통계(mostCommonBelow/Above)와 레이어로 답을 추측해 후보를 제시하세요.",
    `5. 매 질문의 마지막 줄은 반드시 이 형식으로: ${QUICK_REPLY_MARKER} 후보1 | 후보2 | 후보3 | 모름/건너뛰기`,
    "6. 내가 답하면 즉시 set_tile_metadata(confirmedByUser=true)로 기록하세요(label/description/tags/role).",
    "   통행성 답이면 set_tile_passability도 함께. 같은 의미의 타일 여러 개는 entries로 묶어 한 번에.",
    "7. 여러 타일이 하나의 구조(지붕/울타리/길 등)를 이루면 upsert_tile_group으로 그룹과 placementRules(어디에 어떻게 배치하는지)를 기록하세요.",
    "   인접 통계에서 발견한 규칙(예: '이 타일은 항상 벽 위에 있음')은 나에게 맞는지 확인한 뒤 규칙으로 저장하세요.",
    "8. 매 질문에 진행률을 표시하세요: (설명됨 n/전체 m)",
    "9. 내가 '중단'/'그만'이라고 하면 지금까지 기록한 내용을 요약하고 종료하세요.",
    "10. 여러 타일이 구조물(집/울타리/다리 등)을 이루고 있으면 show_tile_grid로 영역을 그림으로 보여주고,",
    "    타일 의미/그룹 규칙만 메타데이터로 보강하세요. 집은 칩셋 건물 킷(stamp_object)이 담당하므로 별도 템플릿을 저장하지 않습니다.",
    "",
    "기록 툴콜과 다음 질문은 같은 턴에 이어서 해도 됩니다. 지금 1번부터 시작하세요.",
  ].join("\n");
}

// 📐 버튼: 에디터에서 선택한 영역을 집 키트/타일 메타 관점으로 분석하는 킥오프.
// 원칙: 이미지(그리드)를 먼저 보여주고, 필요한 타일 의미만 질문한다.
export function buildStructureLearnKickoff(
  mapId: string,
  region: { x: number; y: number; width: number; height: number }
): string {
  const rect = `x=${region.x}, y=${region.y}, w=${region.width}, h=${region.height}`;
  return [
    `내가 맵(mapId="${mapId}")에서 영역(${rect})을 선택했습니다. 이 영역을 집 외장/타일 메타 관점으로 분석하세요.`,
    "",
    "절차(반드시 이 순서로):",
    `1. show_tile_grid(mapId="${mapId}", ${rect})로 영역을 채팅에 그림으로 먼저 보여주세요.`,
    `2. highlight_map_region으로 같은 영역을 맵에서도 강조하세요.`,
    "3. 영역이 집이면 이 칩셋의 기존 건물 킷(stamp_object)으로 재현 가능한지 판단하고, 없는 재질은 학습되지 않았다고 말하세요.",
    "4. 저장이 필요한 것은 타일 의미(set_tile_metadata)나 그룹 규칙(upsert_tile_group)뿐입니다. 지형 템플릿은 만들지 마세요.",
    "5. 좌표/타일 번호/행 목록을 길게 나열하지 말고, 핵심 타일을 show_tiles로 확인한 뒤 필요한 질문만 하세요.",
  ].join("\n");
}

// 어시스턴트 메시지 마지막의 "[선택지] a | b | c" 줄을 원탭 답변 칩으로 파싱한다.
// 마커가 없으면 빈 배열(칩 없음).
export function parseQuickReplies(text: string): string[] {
  const lines = text.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!line.startsWith(QUICK_REPLY_MARKER)) return [];
    return line
      .slice(QUICK_REPLY_MARKER.length)
      .split("|")
      .map((option) => option.trim())
      .filter((option) => option.length > 0)
      .slice(0, 6);
  }
  return [];
}

/** 말풍선에는 선택지 줄을 남기지 않는다 — 칩이 그 자리를 대신한다. */
export function stripQuickReplyLine(text: string): string {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim().startsWith(QUICK_REPLY_MARKER)) {
      lines.splice(i, 1);
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
      return lines.join("\n");
    }
  }
  return text;
}
