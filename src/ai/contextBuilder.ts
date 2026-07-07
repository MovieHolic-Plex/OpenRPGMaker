// ai/contextBuilder.ts
// 어시스턴트 시스템 프롬프트(한국어) 조립기. 순수 함수(브라우저 접근 금지).
// 구성: ① 에디터 소개 + 툴 사용 수칙 ② get_project_summary ③ 현재 맵 get_map_region 요약
//       ④ 자주 쓰는 리소스 시맨틱 요약 ⑤ 게임 스타일 문서 발췌 ⑥ 밸런스 상수.
// 토큰 예산(문자 수 근사) 상한을 넘으면 조회 툴 안내로 대체한다.

import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools";
import type { Project, TileGroupMetadata } from "@/project/types";
import { confidenceScore } from "@/project/tilesetPalette";
import { buildWorldDigest, normalizeProjectWorld } from "@/project/world";
import { AGENT_UX_POLICY_LINES } from "./promptPolicies";

export interface ContextOptions {
  // 현재 에디터에서 열려 있는 맵(있으면 주변 영역을 요약에 포함).
  currentMapId?: string;
  // 시스템+컨텍스트 문자 예산(근사). 초과분은 조회 툴 안내로 대체.
  budgetChars?: number;
}

const DEFAULT_BUDGET = 12000;

// ⑥ 밸런스 상수(handoff 검증치). 모델이 수치 감각을 갖도록 명시한다.
const BALANCE_NOTE = [
  "## 밸런스 상수(검증됨)",
  "- 영웅 Lv1 기준: HP 514 / 공격 45 / 방어 59.",
  "- 데미지 공식: power + 공격/2 − 방어/2 (음수면 1로 클램프).",
  "- 새 적/스킬 수치는 이 곡선에 비례해 정하라. 과도한 값은 밸런스를 깨뜨린다.",
].join("\n");

const INTRO = [
  "당신은 브라우저 기반 2D RPG 에디터(RPG ZZU)의 개발 어시스턴트입니다.",
  "맵·이벤트·데이터베이스(아이템/장비/스킬/클래스/상태/적/액터/트룹/커먼이벤트)·퀘스트를 '툴 호출'로 편집합니다.",
  "",
  AGENT_UX_POLICY_LINES,
  "",
  "## 작업 수칙(반드시 준수)",
  "1. 모든 쓰기(맵/이벤트/DB 변경)는 제안(dry-run)으로만 반영되며, 리드(사용자)가 수락해야 실제 프로젝트에 적용됩니다.",
  "2. 편집 전 필요한 정보는 조회 툴(get_project_summary, get_map_region, list_resources, get_database_records, find_events 등)로 먼저 확인하세요.",
  "   기존 레코드(아이템/스킬/액터/스위치 등)를 참조할 때는 get_database_records(collection)로 실제 id를 먼저 확인하세요.",
  "3. 쓰기 툴 결과에 issues(오류)가 있으면 그 내용을 읽고 인자를 고쳐 성공할 때까지 재시도하세요.",
  "4. 좌표·타일·리소스 ID는 추측하지 말고 조회 툴로 확인한 값을 사용하세요. 물 위/통행 불가 칸에 NPC를 두지 마세요.",
  "5. 파괴적 작업(remove_event 등)은 꼭 필요할 때만, 이유를 먼저 설명하세요.",
  "6. 툴 호출을 아끼지 마세요. 조회·검증·재시도에 필요한 만큼 깊게 사용하세요(제한은 토큰 예산뿐).",
  "7. 여러 개를 요청받으면(예: NPC 3명, 집 2채) 전부 만들 때까지 멈추지 마세요. 일부만 하고 끝내는 것은 실패입니다.",
  "8. '깊은 대화'를 요청받으면 choices(선택지)와 분기 대사로 페이지를 풍부하게 구성하세요. lines에 여러 줄을 담을 수 있습니다.",
  "9. 작업이 끝나면 무엇을 변경했는지 한국어로 간결히 요약하세요.",
  "10. 타일을 깔 때는 추측하지 말고 get_tile_info로 의미·배치 규칙(placementRules)을 먼저 확인하세요.",
  "    사용자가 가르친 메타데이터(source=user)가 최우선 근거입니다. 그룹의 placementRules가 있으면 반드시 따르세요.",
  "11. 집/구조물은 절대 벽 타일로 사각형을 채워 만들지 마세요. 크기가 지정된 집(예: 10x10)은 build_house,",
  "    ㄴ자 집은 stamp_template_house(variant=l) 또는 stamp_structure(template=l), 표준 집은 stamp_terrain_template를 쓰세요.",
  "    grammar로 직접 조립했다면 validate_structure로 검사해 위반을 전부 고치고 재검증하세요.",
  "    위반이 남았는데 '조정 중'처럼 얼버무리지 말고, 고쳤는지 남았는지를 정직하게 보고하세요.",
  "12. 기존 이벤트를 수정할 때는 get_event로 현재 페이지/커맨드를 먼저 읽고 그 위에 병합하세요.",
  "    읽지 않고 upsert_event로 덮으면 기존 대사/분기가 사라집니다.",
  "13. 잘못 깔린 타일/구조물을 지울 때는 clear_region(하위=잔디 복원, 상위=비움)을 쓰세요.",
  "    새 구조물을 찍기 전, 겹치는 이전 실패물이 있으면 먼저 clear_region으로 정리하세요.",
  "    단, '집/구조물의 주변(근처)을 청소'하라는 요청은 그 구조물을 덮지 말고 둘러싼 빈 칸만 정리하는 뜻입니다 —",
  "    방금 지은 집을 지우지 마세요. 기존 구조물을 정말 철거하려면 먼저 사용자에게 확인하고 clear 에셋에 confirmDestroy:true를 명시하세요.",
  "    스펙 검증기가 구조물을 덮는 clear를 거부하면, 영역을 구조물 바깥으로 좁혀 재제출하세요(맵의 실제 타일이 곧 '무엇이 지어져 있는지'의 기억입니다).",
  "14. 타일의 규칙(레이어/통행/지형 태그)은 set_tile_rules로 설정합니다. 레이어(auto/lower/upper) 변경은",
  "    사용자가 명시적으로 요청했을 때만 confirmedByUser=true로 호출하세요.",
  "15. 스펙 게이트(반드시 준수): 공간 쓰기 작업(집/마을/길/청소/NPC·전투 배치 등 맵에 무언가를 놓는 일)은",
  "    먼저 set_build_spec으로 밑그림(명세)을 제출해 검증을 통과해야 실행됩니다. 명세 체크리스트 —",
  "    대상 맵, 에셋 목록(종류·개수·각 영역 x,y,w,h·스타일), 통로 너비(pathWidth), 밀도(density), 배치 스타일(layoutStyle).",
  "    사용자가 정하지 않은 항목은 합리적 기본값으로 채우고, 넓은 요청(마을 등)은 명세 요약을 한 줄로 보여준 뒤 진행하세요.",
  "    검증기가 겹침·큰 경계 초과를 거부하면 좌표를 고쳐 재제출하세요. 3회 실패하면 그 계획은 폐기하고 사용자에게 [선택지]로 물으세요.",
  "    각 빌드 툴 호출은 명세에 할당된 영역 안에서만 허용됩니다(구간 격리). 경계 1~2칸 초과는 warning으로 통과하지만,",
  "    허용 slack ±2칸을 넘으면 차단됩니다. 이 slack은 페인트/배치 호출 경계에만 적용되고, clear_region 같은 정리/파괴성 호출이나",
  "    clear/overExisting 구조물 보호 규칙은 완화하지 않습니다.",
  "    사용자가 맵에서 선택한 영역은 곧 암묵적 명세입니다.",
  "    배치 전 정리 확인: 타일/구조물을 놓을 자리·주변에 기본 타일(잔디)이 아닌 것이 있으면, 그 위에 그냥 덮지 말고",
  "    먼저 사용자에게 '여기 이미 무언가 있는데 정리하고 놓을까요, 그대로 위에 놓을까요?'라고 물으세요([선택지]).",
  "    사용자가 답하면 해당 에셋에 overExisting:\"clear\"(정리하고 배치) 또는 \"keep\"(그대로 위에 배치)을 넣어 재제출하세요. 검증기가 이를 강제합니다.",
  "    건설 순서: 마을처럼 여러 구조물을 짓는 복합 건축은 먼저 순서를 정하세요 — 길을 먼저 깔지, 집 위치를 먼저 잡을지, 소품을 먼저 놓을지.",
  "    set_build_spec의 buildOrder([\"road\",\"house\",\"prop\"]처럼 kind 순서)로 계획을 제시하고 사용자에게 확인받은 뒤, 그 순서대로 빌드 툴을 호출하세요.",
  "16. 비전(반드시 준수): 당신은 show_tiles/show_tile_grid로 띄운 타일·영역 이미지를 실제로 볼 수 있습니다(멀티모달).",
  "    맵에 뭔가 깐 뒤에는 말로 단정하지 말고 show_map_region으로 결과를 눈으로 확인하세요.",
  "    타일의 의미·라벨·용도를 단정하기 전에 반드시 그 이미지를 눈으로 확인하세요. 번호나 인접 통계만으로 '탁자/침대'처럼",
  "    추측해 라벨을 지어내지 마세요. 설명이 없는(described=false) 타일은 이미지를 보고 보이는 대로 서술하고, 확신이 없으면",
  "    사용자에게 물으세요. 어떤 타일이 무엇인지 사용자에게 물을 때도 먼저 show_tiles로 그 이미지를 띄우세요.",
  "    구조(벽/나무/지붕)는 말로 설명하지 말고 render_group_sample로 조립해 이미지로 보여준 뒤 판단·질문하세요.",
  "17. 인터뷰: analyze_map_tile_usage/get_tile_info에서 이미 설명된(described=true / source=user) 타일은 다시 묻지 마세요.",
  "    기록된 메타데이터가 있으면 그대로 신뢰하고, 설명 없는 타일만 질문 대상으로 삼으세요.",
  "18. 실내 장식: 통행 불가 바닥 타일(예: 돌바닥 342, 계단 246)을 장식이라며 사람이 지나갈 칸에 깔아 길을 막지 마세요.",
  "    가구/소품 타일이 타일셋에 없으면 없다고 정직하게 말하고 대안(이벤트 소품·NPC·다른 타일셋)을 제안하세요.",
  "    장식 타일은 대개 상위(upper) 레이어입니다 — 바닥을 통행 불가로 덮지 않도록 레이어를 확인하세요.",
  "19. 시각 제안: 집을 짓기 전에 preview_house(mapId, origin, width, height, material)로 결과 이미지를 먼저 띄워",
  "    '이렇게 생긴 집을 지을까요?'처럼 그림으로 제안할 수 있습니다(프로젝트를 바꾸지 않는 읽기 툴 — 스펙 게이트 무관).",
  "20. 메타데이터 저장: 인터뷰로 확정한 타일 메타데이터(set_tile_metadata)와 지형 템플릿은 데이터베이스의 타일셋/지형 템플릿",
  "    화면에 저장되어 사용자가 직접 관찰·수정할 수 있습니다. 그러니 라벨/설명/규칙을 성실히 남기세요.",
  "21. 타일 프리셋: 타일셋에 팔레트 프리셋이 있으면 개별 tile id 대신 presetId+paletteRole을 우선 사용하세요.",
].join("\n");

function summarySection(project: Project): string {
  const result = runTool({ project }, "get_project_summary", {});
  if (!result.ok || result.data === undefined) return "## 프로젝트 요약\n(요약 조회 실패 — get_project_summary 툴을 호출하세요.)";
  return ["## 프로젝트 요약", "```json", JSON.stringify(result.data, null, 2), "```"].join("\n");
}

function mapRegionSection(project: Project, mapId: string | undefined): string {
  const id = mapId && project.maps[mapId] ? mapId : project.startMapId;
  const map = project.maps[id];
  if (!map) return "";
  // 맵 전체가 크면 좌상단 일부만(상세는 get_map_region으로 조회하도록 유도).
  const w = Math.min(map.width, 20);
  const h = Math.min(map.height, 20);
  const ctx: ToolContext = { project };
  const result = runTool(ctx, "get_map_region", { mapId: id, x: 0, y: 0, w, h });
  if (!result.ok || result.data === undefined) return "";
  return [
    `## 현재 맵 요약(${map.name}, ${map.width}×${map.height})`,
    "좌상단 일부만 표시. 다른 영역은 get_map_region으로 조회하세요.",
    "```json",
    JSON.stringify(result.data, null, 2),
    "```",
  ].join("\n");
}

function worldDigestSection(project: Project): string {
  const world = normalizeProjectWorld(project);
  if (world.entities.length === 0) return "";
  const digest = buildWorldDigest(world, { maxTokens: 700 });
  if (digest === "세계관 없음") return "";
  return [
    "## 세계관 다이제스트",
    "새 NPC/맵/명명 아이템을 만들거나 바꾸면 upsert_world_entities와 link_world_ref로 세계관도 같은 제안에 갱신하세요.",
    digest,
  ].join("\n");
}

function tileVocabularySection(project: Project, mapId: string | undefined): string {
  const tilesetIds = currentTilesetIds(project, mapId);
  const lines: string[] = [];
  for (const tilesetId of tilesetIds) {
    const tileset = project.tilesets[tilesetId];
    if (!tileset || (tileset.palettePresets ?? []).length === 0) continue;
    lines.push(`### ${tileset.name} (${tileset.id})`);
    for (const preset of tileset.palettePresets ?? []) {
      const slots = preset.slots.map((slot) => `${slot.role}:${slot.tileIds.length}`).join(", ");
      lines.push(`- ${preset.name} (${preset.id}${preset.locked ? ", locked" : ""}, ${preset.origin}) — ${slots || "slot 없음"}`);
    }
    const lowConfidence = (tileset.tileMeta ?? []).filter((meta) => {
      const score = confidenceScore(meta?.confidence);
      return score !== null && score < 0.5;
    }).length;
    if (lowConfidence > 0) lines.push(`- 낮은 신뢰(confidence<0.5) 타일 ${lowConfidence}개`);
  }
  if (lines.length === 0) return "";
  return [
    "## 타일 어휘 다이제스트",
    "프리셋이 있으면 tile_road/tile_scatter/tile_structure에서 개별 tile id보다 presetId+paletteRole을 우선 사용하세요. 칠할 타일을 모르면 tile_query(ask=palette)로 먼저 찾으세요.",
    trimDigestLines(lines, 700),
  ].join("\n");
}

function styleSection(project: Project, remaining: number, hasWorldDigest: boolean): string {
  const docs = project.villageInfoDocuments ?? [];
  if (docs.length === 0) return "";
  if (hasWorldDigest) {
    return [
      "## 게임 스타일 문서(원문 보존)",
      "세계관 다이제스트가 우선입니다. 기존 세계관 원문 문서는 롤백을 위해 프로젝트에 보존됩니다.",
      ...docs.slice(0, 12).map((doc) => `- ${doc.title} (${doc.mapId})`),
      docs.length > 12 ? `- …외 ${docs.length - 12}개` : "",
    ].filter((line) => line.length > 0).join("\n");
  }
  const lines: string[] = ["## 게임 스타일 문서(발췌)"];
  for (const doc of docs) {
    const excerpt = doc.markdown.slice(0, 400);
    lines.push(`### ${doc.title}`, excerpt);
    if (lines.join("\n").length > remaining) break;
  }
  return lines.join("\n");
}

// 자주 쓰는 리소스 시맨틱 안내(전체 목록은 list_resources로 조회 유도).
const RESOURCE_HINT = [
  "## 리소스 조회",
  "타일/차셋/배경/BGM/SE는 list_resources(kind, query)로 시맨틱 검색하세요.",
  "예: list_resources(kind='charset', query='마을 사람'), list_resources(kind='tile', query='물').",
  "차셋 질의는 한국어(주민/전사/노파)와 시트명(people1~5, actor1~4, monster1~3, animal, object1~2) 모두 지원합니다.",
  "결과가 0개면 query='*'로 전체 목록을 훑어본 뒤 정확한 라벨로 다시 검색하세요.",
].join("\n");

type ClusterRuleStrength = "hard" | "medium" | "soft";
type ClusterRuleKind = "adjacency" | "spacing" | "count";

interface ClusterRuleHint {
  readonly id: string;
  readonly kind: ClusterRuleKind;
  readonly strength: ClusterRuleStrength;
  readonly message?: string;
}

// 사용자가 가르친 타일 지식(맵 인터뷰 결과) 요약 — 챗봇 타일 깔기의 근거.
// 상세는 get_tile_info로 조회하게 유도하고, 여기서는 존재와 핵심 규칙만 알린다.
function tileSemanticsSection(project: Project): string {
  const lines: string[] = [];
  for (const tileset of Object.values(project.tilesets)) {
    const userTiles = (tileset.tileMeta ?? [])
      .map((meta, tile) => ({ meta, tile }))
      .filter(({ meta }) => meta.source === "user" && (meta.label.trim() || meta.description.trim()));
    // 사용자가 만든(인터뷰로 확정한) 그룹만 — 번들 기본 그룹 규칙은 검색/조회 툴로 충분하다.
    const ruleGroups = (tileset.tileGroups ?? []).filter((group) => group.source === "user" && group.placementRules.trim().length > 0);
    if (userTiles.length === 0 && ruleGroups.length === 0) continue;
    lines.push(`### ${tileset.id} — 사용자가 가르친 타일 ${userTiles.length}개`);
    for (const { meta, tile } of userTiles.slice(0, 20)) {
      const desc = meta.description.trim();
      lines.push(`- ${tile}: ${meta.label.trim() || "(라벨 없음)"}${desc ? ` — ${desc.slice(0, 80)}` : ""}`);
    }
    if (userTiles.length > 20) lines.push(`- …외 ${userTiles.length - 20}개(get_tile_info로 조회)`);
    for (const group of ruleGroups.slice(0, 10)) {
      lines.push(`- [그룹 ${group.name}/${group.role}] 타일 ${group.tileIds.slice(0, 8).join(",")}${group.tileIds.length > 8 ? "…" : ""} — 규칙: ${group.placementRules.slice(0, 120)}`);
    }
  }
  if (lines.length === 0) return "";
  return ["## 타일 지식(사용자가 가르침 — 타일 깔 때 최우선 근거)", ...lines].join("\n");
}

// 지형 템플릿(구조물 지식뱅크) 한 줄 목록 — 상세는 get_terrain_template로 조회 유도.
function terrainTemplateSection(project: Project): string {
  const lines: string[] = [];
  for (const tileset of Object.values(project.tilesets)) {
    for (const template of tileset.terrainTemplates ?? []) {
      lines.push(`- ${template.id}: ${template.name}${template.buildPlan ? " (stamp_terrain_template 가능)" : " (grammar 조립)"}`);
    }
  }
  if (lines.length === 0) return "";
  return [
    "## 지형 템플릿(구조물 교과서)",
    ...lines,
    "구조물을 짓기 전 get_terrain_template로 문법을 읽고, 조립했다면 validate_structure로 검사하세요.",
  ].join("\n");
}

function clusterRulePreferenceSection(project: Project, mapId: string | undefined): string {
  const tilesetIds = currentTilesetIds(project, mapId);
  const lines: string[] = [];
  let hardCount = 0;
  for (const tilesetId of tilesetIds) {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) continue;
    for (const group of tileset.tileGroups ?? []) {
      for (const rule of clusterRules(group)) {
        if (rule.strength === "hard") {
          hardCount += 1;
          continue;
        }
        lines.push(`- ${tileset.id}/${group.name}: ${strengthLabel(rule.strength)} ${ruleText(rule)}`);
      }
    }
  }
  if (hardCount === 0 && lines.length === 0) return "";
  return [
    "## 클러스터 규칙 선호 힌트",
    "강함 규칙 위반은 커밋이 거부됩니다.",
    "맵을 편집한 뒤 run_lint로 규칙 위반을 확인하세요.",
    ...lines.slice(0, 16),
    lines.length > 16 ? `- …외 ${lines.length - 16}개 규칙은 get_tile_info/run_lint로 확인` : "",
  ].filter((line) => line.length > 0).join("\n");
}

function currentTilesetIds(project: Project, mapId: string | undefined): readonly string[] {
  const id = mapId && project.maps[mapId] ? mapId : project.startMapId;
  const tilesetId = project.maps[id]?.tilesetId;
  if (tilesetId) return [tilesetId];
  return Object.keys(project.tilesets);
}

function clusterRules(group: TileGroupMetadata): readonly ClusterRuleHint[] {
  if (!("rules" in group)) return [];
  const rules = group.rules;
  if (!Array.isArray(rules)) return [];
  return rules.filter(isClusterRuleHint);
}

function isClusterRuleHint(rule: unknown): rule is ClusterRuleHint {
  if (typeof rule !== "object" || rule === null) return false;
  if (!("id" in rule) || typeof rule.id !== "string") return false;
  if (!("kind" in rule) || !isClusterRuleKind(rule.kind)) return false;
  if (!("strength" in rule) || !isClusterRuleStrength(rule.strength)) return false;
  return !("message" in rule) || rule.message === undefined || typeof rule.message === "string";
}

function isClusterRuleKind(value: unknown): value is ClusterRuleKind {
  return value === "adjacency" || value === "spacing" || value === "count";
}

function isClusterRuleStrength(value: unknown): value is ClusterRuleStrength {
  return value === "hard" || value === "medium" || value === "soft";
}

function strengthLabel(strength: ClusterRuleStrength): string {
  return strength === "medium" ? "중간(권장)" : strength === "soft" ? "느슨함(선호)" : "강함(반드시)";
}

function kindLabel(kind: ClusterRuleKind): string {
  return kind === "adjacency" ? "인접성" : kind === "spacing" ? "간격" : "개수";
}

function ruleText(rule: ClusterRuleHint): string {
  const message = rule.message?.trim();
  return message ? message.slice(0, 120) : `${kindLabel(rule.kind)} 규칙 ${rule.id}`;
}

// 시스템 프롬프트 전체 조립. 예산 초과 섹션은 잘라내고 조회 안내로 대체.
export function buildSystemPrompt(project: Project, options: ContextOptions = {}): string {
  const budget = options.budgetChars ?? DEFAULT_BUDGET;
  const sections: string[] = [INTRO, summarySection(project), BALANCE_NOTE, RESOURCE_HINT];
  const tileSemantics = tileSemanticsSection(project);
  if (tileSemantics) sections.push(tileSemantics);
  const tileVocabulary = tileVocabularySection(project, options.currentMapId);
  if (tileVocabulary) sections.push(tileVocabulary);
  const templateSection = terrainTemplateSection(project);
  if (templateSection) sections.push(templateSection);
  const clusterRulePreferences = clusterRulePreferenceSection(project, options.currentMapId);
  if (clusterRulePreferences) sections.push(clusterRulePreferences);
  const worldDigest = worldDigestSection(project);
  if (worldDigest) sections.push(worldDigest);

  const mapSection = mapRegionSection(project, options.currentMapId);
  if (mapSection) sections.push(mapSection);

  let assembled = sections.join("\n\n");
  const remaining = budget - assembled.length;
  if (remaining > 200) {
    const style = styleSection(project, remaining - 100, worldDigest.length > 0);
    if (style) assembled += `\n\n${style}`;
  }

  if (assembled.length > budget) {
    assembled = `${assembled.slice(0, budget)}\n\n(컨텍스트가 예산을 초과해 일부 생략됨 — 필요한 정보는 조회 툴을 사용하세요.)`;
  }
  return assembled;
}

function trimDigestLines(lines: readonly string[], maxTokens: number): string {
  const full = lines.join("\n");
  if (estimateTokens(full) <= maxTokens) return full;
  const included: string[] = [];
  for (const line of lines) {
    const remaining = lines.length - included.length - 1;
    const candidate = [...included, line, ...(remaining > 0 ? [`…외 ${remaining}개`] : [])].join("\n");
    if (estimateTokens(candidate) > maxTokens) break;
    included.push(line);
  }
  const omitted = lines.length - included.length;
  if (omitted <= 0) return included.join("\n");
  return [...included, `…외 ${omitted}개`].join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
