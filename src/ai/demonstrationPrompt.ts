// ai/demonstrationPrompt.ts
// "시연으로 가르치기" 메시지 조립기(순수). 사용자가 샌드박스 캔버스에 직접 깐 타일
// (최종 상태 + 붓질 순서)과 설명을 AI가 해석 가능한 텍스트로 만든다.
// AI 추측이 틀렸을 때 말 대신 손으로 보여주는 교정 채널 — 해석 지침을 메시지에 내장해
// 시스템 프롬프트 변경 없이 동작한다.

export interface DemonstrationStroke {
  layer: "lower" | "upper";
  x: number;
  y: number;
  tile: number; // -1 = 지우기(상위)
}

export interface DemonstrationPayload {
  w: number;
  h: number;
  // 시연 캔버스의 유래: 맵 영역에서 시드했으면 그 좌표(맵은 수정되지 않음), 빈 캔버스면 null.
  seed: { mapId: string; x: number; y: number } | null;
  lower: number[][];
  upper: number[][];
  strokes: DemonstrationStroke[];
  explanation: string;
}

const STROKE_LIST_CAP = 60;

function gridLines(grid: number[][]): string[] {
  return grid.map((row) => row.map((tile) => (tile < 0 ? "." : String(tile))).join(" "));
}

export function buildDemonstrationMessage(payload: DemonstrationPayload): string {
  const origin = payload.seed
    ? `맵 '${payload.seed.mapId}'의 (${payload.seed.x},${payload.seed.y})에서 복사한 샌드박스(실제 맵은 바뀌지 않았음)`
    : "빈 잔디 샌드박스";
  const strokes = payload.strokes.slice(0, STROKE_LIST_CAP).map(
    (stroke, index) =>
      `${index + 1}) ${stroke.layer} (${stroke.x},${stroke.y}) ← ${stroke.tile < 0 ? "지우기" : `타일 ${stroke.tile}`}`
  );
  const strokeNote =
    payload.strokes.length > STROKE_LIST_CAP
      ? `…외 ${payload.strokes.length - STROKE_LIST_CAP}회(총 ${payload.strokes.length}회 붓질)`
      : `(총 ${payload.strokes.length}회 붓질)`;
  return [
    "[시연] 내가 타일을 직접 깔면서 보여줍니다. 텍스트 대신 이 시연으로 배우세요.",
    "",
    `캔버스: ${payload.w}×${payload.h} — ${origin}`,
    `내 설명: ${payload.explanation.trim() || "(설명 없음 — 붓질 순서와 결과로 해석하세요)"}`,
    "",
    "최종 하위 레이어(행별, .=빈 칸):",
    ...gridLines(payload.lower),
    "최종 상위 레이어:",
    ...gridLines(payload.upper),
    "",
    "붓질 순서(내가 깐 순서 그대로 — 과정 자체가 가르침입니다):",
    ...strokes,
    strokeNote,
    "",
    "해석 지침:",
    "1. show_tiles로 핵심 타일들을 채팅에 띄워 무엇을 배웠는지 시각적으로 확인시키세요.",
    "2. 이 시연이 고치는 지식을 기록하세요 — 타일 의미가 틀렸으면 set_tile_metadata(confirmedByUser=true),",
    "   배치 규칙이면 upsert_tile_group의 placementRules, 구조물 문법이면 upsert_terrain_template(confirmedByUser=true).",
    "   기존에 잘못 저장된 내용은 같은 id로 고쳐 쓰세요.",
    "3. 마지막으로 '이렇게 배웠습니다'를 한두 문장으로 요약하고, 맞는지 물으세요.",
    `   마지막 줄: [선택지] 맞음 | 아직 다름(추가 설명) | 시연 다시 볼래?`,
  ].join("\n");
}
