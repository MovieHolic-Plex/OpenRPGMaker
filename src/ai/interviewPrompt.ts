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
    "10. 여러 타일이 구조물(집/울타리/다리 등)을 이루고 있으면 템플릿 학습을 제안하세요:",
    "    show_tile_grid로 영역을 그림으로 보여주고 extract_terrain_template로 초안을 뽑으세요.",
    "    추출하면 '구조물 검토' 창이 자동으로 열려 내가 행별 추측(guessSummary)을 그림으로 확인·수정·저장합니다.",
    "    좌표/타일 번호/행 목록을 채팅에 나열하지 마세요 — 창이 이미 보여줍니다. 이름 제안 + 한두 문장 안내면 충분합니다.",
    "",
    "기록 툴콜과 다음 질문은 같은 턴에 이어서 해도 됩니다. 지금 1번부터 시작하세요.",
  ].join("\n");
}

// 📐 버튼: 에디터에서 선택한 영역을 구조물 템플릿으로 학습시키는 킥오프.
// 원칙: 이미지(그리드)와 AI의 구성 추측을 "질문보다 먼저" 보여준다 — 사용자는 확인만 한다.
export function buildStructureLearnKickoff(
  mapId: string,
  region: { x: number; y: number; width: number; height: number }
): string {
  const rect = `x=${region.x}, y=${region.y}, w=${region.width}, h=${region.height}`;
  return [
    `내가 맵(mapId="${mapId}")에서 영역(${rect})을 선택했습니다. 이 구조물을 지형 템플릿으로 배우세요.`,
    "",
    "절차(반드시 이 순서로):",
    `1. show_tile_grid(mapId="${mapId}", ${rect})로 영역을 채팅에 그림으로 먼저 보여주세요.`,
    `2. highlight_map_region으로 같은 영역을 맵에서도 강조하세요.`,
    "3. extract_terrain_template로 초안을 추출하세요. 추출하면 '구조물 검토' 창이 자동으로 열리고,",
    "   나는 거기서 행별 추측(guessSummary)을 그림·썸네일로 확인하고 수정·저장합니다.",
    "4. 중요: 좌표, 타일 번호, 행별 목록을 채팅에 나열하지 마세요 — 검토 창이 이미 다 보여줍니다.",
    "   당신은 템플릿 이름 1개를 제안하고, \"검토 창에서 확인한 뒤 '확정 저장'을 눌러 주세요\"라고 한두 문장만 말하세요.",
    "5. 저장은 검토 창에서 이뤄지므로 upsert_terrain_template를 직접 호출하지 마세요.",
    "   (예외: 내가 창 없이 채팅으로 확정해 달라고 명시적으로 요청할 때만 upsert_terrain_template(confirmedByUser=true)를 쓰세요.)",
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
