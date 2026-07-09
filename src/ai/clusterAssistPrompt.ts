import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import type { TileGroupLayer, TileGroupRole } from "@/project/types";

export interface ClusterGroupSnapshot {
  readonly id: string;
  readonly name: string;
  readonly role: TileGroupRole;
  readonly defaultLayer: TileGroupLayer;
  readonly tileIds: readonly number[];
  readonly description: string;
  readonly placementRules: string;
  readonly patternGrammar: { readonly kind: string } | null;
}

export interface ClusterEditKickoff {
  readonly tilesetId: string;
  readonly groupId: string;
  readonly group: ClusterGroupSnapshot | null;
}

export interface UnclassifiedAnalysisKickoff {
  readonly tilesetId: string;
  readonly sampleTiles: readonly number[];
  readonly total: number;
}

export interface RangeClassifyKickoff {
  readonly tilesetId: string;
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly tileIds: readonly number[];
}

export function buildClusterEditKickoff(args: ClusterEditKickoff): string {
  return [
    "지금부터 '클러스터 수정'을 진행합니다. 목표: 글을 줄이고, 현재/수정 후 클러스터를 이미지로 보며 원탭으로 고치는 것.",
    "",
    "현재 클러스터 스냅샷(JSON):",
    jsonBlock(args),
    "",
    "루프 프로토콜(반드시 준수):",
    "1. 먼저 render_group_sample({tilesetId, groupId})로 현재 클러스터를 조립 이미지로 보여주세요. 캡션은 한 줄만.",
    `2. 바로 다음 줄은 이것만: ${QUICK_REPLY_MARKER} 이름 변경 | 역할 변경 | 타일 추가·제거 | 구조 규칙 저작 | 그룹 해체 | 구성 수정(위/아래·좌우 배치)`,
    "3. 수정 제안이 생기면 적용 전 render_group_sample({tilesetId, groupId, proposed})로 수정 전/후 이미지를 보여주세요.",
    `4. 전/후 이미지 아래에는 이것만: ${QUICK_REPLY_MARKER} 적용 | 다시`,
    "5. 의도 구분: '위/아래로 배치·구성·이어지게 해줘'는 구성(set_group_layout)이고, '반드시 위/아래여야 한다(제약·검증)'는 규칙(set_cluster_rule)이다. '위/아래'는 레이어(상위/하위)가 아니라 세로 인접 칸을 뜻한다.",
    "6. 사용자가 '260 위, 290 아래처럼 이어지게'처럼 말하면 구성(set_group_layout)으로 라우팅하고, '반드시/항상 ~여야 한다'처럼 말하면 규칙(set_cluster_rule)으로 라우팅하세요.",
    "7. '구성 수정(위/아래·좌우 배치)' 선택 시 먼저 render_group_sample({tilesetId, groupId})로 현재 구성을 한 줄 캡션과 함께 보여주세요.",
    `8. 바로 다음 줄은 이것만: ${QUICK_REPLY_MARKER} 세로(위/아래) | 가로(좌/우) | 취소`,
    "9. 세로면 최소 입력만 물으세요: 어느 타일이 **위**? 어느 타일이 **아래**? 예: 위 260 / 아래 290.",
    "10. 가로면 최소 입력만 물으세요: 어느 타일이 **왼쪽**? 어느 타일이 **오른쪽**? 예: 왼쪽 260 / 오른쪽 290.",
    "11. 입력을 받으면 render_group_sample({tilesetId, groupId, proposed.patternGrammar})로 전/후 이미지를 보여주세요.",
    `12. 전/후 이미지 아래에는 이것만: ${QUICK_REPLY_MARKER} 적용 | 다시`,
    "13. 적용 확정 시 세로는 set_group_layout(tilesetId, groupId, axis:\"vertical\", top:[260], bottom:[290]), 가로는 set_group_layout(tilesetId, groupId, axis:\"horizontal\", left:[260], right:[290])로 저장하고 한 줄 요약만 남기세요.",
    "14. '구조 규칙 저작' 선택 시 먼저 render_group_sample({tilesetId, groupId})로 현재 구조를 한 줄 캡션과 함께 보여주세요.",
    `15. 바로 다음 줄은 이것만: ${QUICK_REPLY_MARKER} 규칙 추가 | 기존 규칙 보기 | 취소`,
    "16. 규칙 강도 의미는 한 줄만 안내하세요: 강함=커밋에서 거부됨, 중간=경고, 느슨함=참고.",
    ...clusterRuleAuthoringInstructions(args.group),
    "21. 가능하면 render_group_sample({tilesetId, groupId, proposed})로 위반 예시를 전/후 이미지로 보여주세요.",
    `22. 확정 전/후 이미지 아래에는 이것만: ${QUICK_REPLY_MARKER} 적용 | 다시`,
    "23. 적용 확정 시 set_cluster_rule(tilesetId, groupId, rule)로 저장하고 한 줄 요약만 남기세요.",
    `24. 기존 구조 보조 규칙이 필요할 때만 ${QUICK_REPLY_MARKER} 경계 규칙 추가(지붕-벽 등) | 오버레이 추가(사선 등) | 취소 를 사용하세요.`,
    `25. 경계 규칙은 ${QUICK_REPLY_MARKER} 아래에 벽 | 위에 지붕 | 왼쪽에 벽 | 오른쪽에 벽 으로 좁힌 뒤 proposed.junctions=[{withRole, side, action:"omit", atRoles:["bottomLeft","bottom","bottomRight"]}] 형태로 render_group_sample을 호출해 전/후 이미지로 보여주세요.`,
    `26. 오버레이는 ${QUICK_REPLY_MARKER} 사선 모서리 | 안쪽 모서리 | 용마루 | 처마 끝 으로 좁힌 뒤 proposed.overlays=[{when, tileIds}] 형태로 render_group_sample을 호출해 전/후 이미지로 보여주세요.`,
    `27. 전/후 이미지 아래에는 이것만: ${QUICK_REPLY_MARKER} 적용 | 다시`,
    "28. 구조 보조 규칙 적용 확정 시 경계 규칙은 set_group_junction, 오버레이는 set_group_overlay로 저장하고 한 줄 요약만 남기세요.",
    "29. 일반 메타데이터 적용은 upsert_tile_group으로 저장하세요. 그룹 해체는 delete_tile_group(tilesetId, groupId)만 사용하세요.",
    "30. 장황한 산문 금지. 캡션 한 줄 + 선택지 한 줄.",
  ].join("\n");
}

function clusterRuleAuthoringInstructions(group: ClusterGroupSnapshot | null): readonly string[] {
  const patternKind = group?.patternGrammar?.kind;
  if (patternKind === "autotile_3x3" || patternKind === "animated_terrain") {
    return [
      "17. '규칙 추가' 선택 시 먼저 한 줄로 안내하세요: 이 그룹은 오토타일이라 가장자리를 자동 계산합니다 — 타일쌍(인접성/간격) 규칙은 적용되지 않습니다.",
      `18. 바로 다음 줄은 이것만: ${QUICK_REPLY_MARKER} 개수 | 취소`,
      `19. 다음 줄에서 강도를 이것만으로 고르세요: ${QUICK_REPLY_MARKER} 강함(반드시) | 중간(권장) | 느슨함(선호)`,
      "20. 개수 파라미터는 원탭/최소 입력으로 영역당 최소/최대 개수만 묻습니다. 취소를 고르면 규칙 추가를 중단하세요.",
    ];
  }
  return [
    `17. '규칙 추가' 선택 시 kind를 이것만으로 고르세요: ${QUICK_REPLY_MARKER} 인접성 | 간격 | 개수`,
    `18. 다음 줄에서 강도를 이것만으로 고르세요: ${QUICK_REPLY_MARKER} 강함(반드시) | 중간(권장) | 느슨함(선호)`,
    "19. kind별 파라미터는 원탭/최소 입력으로 받으세요. 인접성은 '어느 타일/역할이 어느 타일/역할의 위/아래/왼쪽/오른쪽', 간격은 최소/최대 칸, 개수는 영역당 최소/최대 개수만 묻습니다.",
    "20. 규칙 파라미터를 받은 뒤 다음 단계로 진행하세요.",
  ];
}

export function buildRangeClassifyKickoff(args: RangeClassifyKickoff): string {
  const sourceRect = { height: args.rect.h, width: args.rect.w, x: args.rect.x, y: args.rect.y };
  return [
    "지금부터 '범위 분류'를 진행합니다. 목표: 사용자가 고른 시트 범위를 AI가 초안 분류하고, 조립 이미지를 본 뒤 원탭으로 저장하는 것.",
    "",
    "선택 범위(JSON):",
    jsonBlock({ ...args, sourceRect }),
    "",
    "루프 프로토콜(반드시 준수):",
    "1. 먼저 suggest_group_from_range({tilesetId, rect, tileIds})로 kind/role/name/parts 초안을 받으세요.",
    "2. 이어서 render_group_sample({tilesetId, tileIds, role, name, parts, sourceRect})로 조립 이미지 제안을 보여주세요. 사용자가 그림으로 판단하게 하세요.",
    `3. 이미지 아래에는 캡션 한 줄과 ${QUICK_REPLY_MARKER} 이 분류로 저장 | 이름 바꿔 | 역할 바꿔 | 다시 만 표시하세요.`,
    "4. '이 분류로 저장' 확정 시 upsert_tile_group({tilesetId, name, role, tileIds, parts, sourceRect})으로 저장하세요.",
    "5. 이름/역할 변경은 타이핑을 강요하지 말고 2~4개 후보를 원탭 선택지로 제시하세요.",
    "6. 장황한 산문 금지. 캡션 한 줄 + 선택지 한 줄.",
  ].join("\n");
}

export function buildUnclassifiedAnalysisKickoff(args: UnclassifiedAnalysisKickoff): string {
  return [
    "지금부터 '미분류 분석'을 진행합니다. 목표: 미분류 타일을 조립 이미지로 보고 의미/묶음을 원탭으로 확정하는 것.",
    "",
    "첫 배치(JSON):",
    jsonBlock(args),
    "",
    "루프 프로토콜(반드시 준수):",
    "1. sampleTiles를 3~6개씩 나누고, 각 배치마다 먼저 render_group_sample({tilesetId, tileIds, role})로 조립 이미지를 보여주세요.",
    `2. 이미지 아래에는 캡션 한 줄과 ${QUICK_REPLY_MARKER} 역할 확정 | 타일 빼기 | 규칙 수정 | 건너뛰기 만 표시하세요.`,
    "3. 수정 제안이 생기면 render_group_sample({tilesetId, tileIds, role, proposed})로 수정 전/후 이미지를 보여주고 선택지만 물으세요.",
    `4. 전/후 이미지 아래에는 이것만: ${QUICK_REPLY_MARKER} 적용 | 다시`,
    "5. 적용 확정 시 set_tile_metadata(confirmedByUser=true)와 필요하면 upsert_tile_group을 호출하세요.",
    "6. 첫 배치를 다 쓰면 list_unclassified_tiles(tilesetId, limit=24, offset=처리한개수)로 다음 배치를 가져오세요.",
    "7. 장황한 산문 금지. 캡션 한 줄 + 선택지 한 줄.",
  ].join("\n");
}

function jsonBlock(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}
