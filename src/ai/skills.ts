// ai/skills.ts
// 사용자가 의식하고 쓰는 "스킬" 레지스트리 — 이름/아이콘/인자/킥오프 프롬프트 템플릿.
// 맵 인터뷰 버튼의 성공 공식(긴 프로토콜을 버튼 하나로 주입)을 일반화한다.
// 슬래시("/집")와 스킬 서랍([+]) 양쪽에서 호출되고, 사용자 정의 스킬(localStorage)도 담는다.
import { buildInterviewKickoff, buildStructureLearnKickoff } from "@/ai/interviewPrompt";
import {
  buildClusterEditKickoff,
  buildRangeClassifyKickoff,
  buildUnclassifiedAnalysisKickoff,
  type ClusterGroupSnapshot,
} from "@/ai/clusterAssistPrompt";
import { store } from "@/project/store";
import { deleteSupabaseUserSkill, recordSupabaseUserSkill } from "@/project/supabaseProjectSync";

export type SkillParamType = "enum" | "number" | "text";
export interface SkillRectArg {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}
export type SkillArgValue = string | number | readonly number[] | SkillRectArg;

export interface SkillParam {
  readonly key: string;
  readonly label: string;
  readonly type: SkillParamType;
  readonly options?: readonly { value: string; label: string }[];
  readonly min?: number;
  readonly max?: number;
  readonly defaultValue?: string | number;
  readonly placeholder?: string;
  /**
   * 컨텍스트 자동 주입 — 인자 폼의 초기값을 SkillRunContext에서 채운다(사용자 덮어쓰기 가능).
   * undefined를 반환하면 defaultValue/placeholder 현행 동작으로 폴백.
   */
  readonly autoFill?: (ctx: SkillRunContext) => string | number | undefined;
}

/** 타일 팔레트/시트에서 파생한 타일셋 컨텍스트 — 타일 지식 스킬 인자 자동 주입용. */
export interface SkillTilesetContext {
  readonly id: string;
  /** 팔레트에서 선택된 타일이 속한 그룹(있으면). */
  readonly selectedGroupId?: string;
  /** 팔레트 시트 드래그 선택 사각형(타일 단위 x,y,w,h — 있으면). */
  readonly sheetRect?: SkillRectArg;
}

export interface SkillRunContext {
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly selection: { readonly mapId: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  /** 현재 타일셋 컨텍스트 — 구성처가 채우지 않으면 자동 주입 없이 동작(하위호환). */
  readonly tileset?: SkillTilesetContext | null;
}

export interface SkillDef {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
  readonly source: "system" | "user";
  /** action 스킬은 프롬프트 대신 UI를 연다(예: 시연 캔버스). */
  readonly kind: "action" | "prompt";
  readonly params: readonly SkillParam[];
  /** 선택 영역이 필수인 스킬(없으면 안내). */
  readonly needsSelection?: boolean;
  readonly buildPrompt?: (args: Record<string, SkillArgValue>, ctx: SkillRunContext) => string;
  readonly displayAs?: (args: Record<string, SkillArgValue>) => string;
}

const HONEST_REPORT_RULE =
  "작업이 끝나면 실제로 한 것만 보고하세요. 실패/위반이 남았으면 '조정 중' 같은 얼버무림 없이 남은 문제를 그대로 알리세요.";
const SPEC_RULE =
  "공간 작업 규칙(스펙 게이트): 실행 전 set_build_spec으로 밑그림을 제출하세요 — 대상 맵, 에셋별 영역(x,y,w,h)과 종류·스타일, 통로 너비, 밀도, 배치 스타일. 검증 오류(겹침)는 좌표·buildOrder·맵 크기를 고쳐 재제출하고, 3회 실패하면 계획을 폐기해 스스로 새 배치를 설계하세요. 페인트/배치 툴이 명세 밖 빈 영역을 쓰면 게이트가 명세를 자동 확장하고 warning으로 통과합니다. 기존 구조물 파괴 위험은 자동 보정하지 않습니다. 사용자가 선택한 영역은 암묵적 명세입니다.";
const CONSTRUCTION_ORDER_RULE =
  "시공 공정: 길 paint_road → 집+마당 build_house_lots → 숲 등 place_props → NPC. **집:** LLM은 wings 위치·kitId·yard 꾸밈 태그만 정하고 build_house_lots 한 번(또는 소수)에 넘긴다. 마당 타일 좌표는 코드. yard 태그: firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|chair|sign. 집 앞 소품을 place_props로 직접 몰아넣지 말 것. 숲/들/묘지 산포만 place_props(넓은 area, naturalness 0.55~0.7, minGap≥2, 구역 분할). 나무 material: \"침엽수\". place_props 동일 인자 턴당 1회. 미합의 재료는 목업 확인.";

function regionText(ctx: SkillRunContext): string {
  return ctx.selection ? `(${ctx.selection.x},${ctx.selection.y}) ${ctx.selection.width}×${ctx.selection.height}` : "(선택 영역 없음)";
}

function textArg(args: Record<string, SkillArgValue>, key: string): string {
  const value = args[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function numberArg(args: Record<string, SkillArgValue>, key: string, fallback: number): number {
  const value = args[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberArrayArg(args: Record<string, SkillArgValue>, key: string): readonly number[] {
  const value = args[key];
  if (Array.isArray(value)) return value.filter((entry) => Number.isInteger(entry));
  if (typeof value === "number" && Number.isInteger(value)) return [value];
  if (typeof value !== "string") return [];
  return value
    .split(/[,\s]+/u)
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSkillRectArg(value: SkillArgValue): value is SkillRectArg {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && "x" in value
    && "y" in value
    && "w" in value
    && "h" in value
    && isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.w)
    && isFiniteNumber(value.h);
}

function rectArg(args: Record<string, SkillArgValue>, key: string): SkillRectArg | null {
  const value = args[key];
  if (isSkillRectArg(value)) return value;
  if (typeof value !== "string") return null;
  const parts = value.split(/[,\s]+/u).map((entry) => Number(entry.trim()));
  if (parts.length !== 4) return null;
  const [x, y, w, h] = parts;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) return null;
  return { h, w, x, y };
}

function rectText(rect: SkillRectArg): string {
  return `${rect.x},${rect.y},${rect.w},${rect.h}`;
}

function clusterGroupSnapshot(tilesetId: string, groupId: string): ClusterGroupSnapshot | null {
  const group = store.getCurrent().tilesets[tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    role: group.role,
    defaultLayer: group.defaultLayer,
    tileIds: [...group.tileIds],
    description: group.description,
    placementRules: group.placementRules,
    patternGrammar: group.patternGrammar ? { kind: group.patternGrammar.kind } : null,
  };
}

export const SYSTEM_SKILLS: readonly SkillDef[] = [
  {
    id: "interview",
    icon: "🎓",
    name: "맵 인터뷰",
    description: "현재 맵의 타일 의미를 AI가 질문으로 배웁니다. 답은 원탭 선택지로.",
    source: "system",
    kind: "prompt",
    params: [],
    buildPrompt: (_args, ctx) => buildInterviewKickoff(ctx.mapId),
    displayAs: () => "🎓 맵 인터뷰 시작 — 현재 맵의 타일 의미를 가르쳐 주세요.",
  },
  {
    id: "learn-structure",
    icon: "📐",
    name: "선택 영역 학습",
    description: "맵에서 선택한 구조물을 템플릿(교과서)으로 배웁니다.",
    source: "system",
    kind: "prompt",
    params: [],
    needsSelection: true,
    buildPrompt: (_args, ctx) => {
      if (!ctx.selection) return "";
      return buildStructureLearnKickoff(ctx.selection.mapId, ctx.selection);
    },
    displayAs: () => "📐 선택 영역 학습 — 구조물을 배워 주세요.",
  },
  {
    id: "cluster-edit",
    icon: "🧩",
    name: "클러스터 수정",
    description: "선택한 타일 클러스터를 이미지로 확인하며 이름·역할·위/아래·좌우 구성·구조 규칙을 수정합니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "tilesetId", label: "타일셋 ID", type: "text", placeholder: "tiles_default", autoFill: (ctx) => ctx.tileset?.id },
      { key: "groupId", label: "그룹 ID", type: "text", placeholder: "roof_main", autoFill: (ctx) => ctx.tileset?.selectedGroupId },
    ],
    buildPrompt: (args) => {
      const tilesetId = textArg(args, "tilesetId");
      const groupId = textArg(args, "groupId");
      return buildClusterEditKickoff({ tilesetId, groupId, group: clusterGroupSnapshot(tilesetId, groupId) });
    },
    displayAs: (args) => `🧩 클러스터 수정 — ${textArg(args, "groupId")}`,
  },
  {
    id: "range-classify",
    icon: "▦",
    name: "범위 분류",
    description: "시트에서 선택한 사각형 범위를 이미지로 확인하며 그룹 이름·역할을 원탭으로 저장합니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "tilesetId", label: "타일셋 ID", type: "text", placeholder: "tiles_default", autoFill: (ctx) => ctx.tileset?.id },
      { key: "rect", label: "범위", type: "text", placeholder: "x,y,w,h", autoFill: (ctx) => (ctx.tileset?.sheetRect ? rectText(ctx.tileset.sheetRect) : undefined) },
      { key: "tileIds", label: "타일 ID", type: "text", placeholder: "예: 12,13,14" },
    ],
    buildPrompt: (args) => {
      const rect = rectArg(args, "rect");
      if (!rect) return "";
      return buildRangeClassifyKickoff({
        rect,
        tileIds: numberArrayArg(args, "tileIds"),
        tilesetId: textArg(args, "tilesetId"),
      });
    },
    displayAs: (args) => `▦ 범위 분류 — ${numberArrayArg(args, "tileIds").length}개`,
  },
  {
    id: "unclassified-analysis",
    icon: "🔎",
    name: "미분류 분석",
    description: "설명되지 않은 타일을 이미지로 보며 의미를 확정하고 메타데이터로 기록합니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "tilesetId", label: "타일셋 ID", type: "text", placeholder: "tiles_default", autoFill: (ctx) => ctx.tileset?.id },
      { key: "sampleTiles", label: "첫 배치", type: "text", placeholder: "예: 12,13,14" },
      { key: "total", label: "총 미분류", type: "number", min: 0, max: 10000, defaultValue: 0 },
    ],
    buildPrompt: (args) =>
      buildUnclassifiedAnalysisKickoff({
        tilesetId: textArg(args, "tilesetId"),
        sampleTiles: numberArrayArg(args, "sampleTiles"),
        total: numberArg(args, "total", numberArrayArg(args, "sampleTiles").length),
      }),
    displayAs: (args) => `🔎 미분류 분석 — ${numberArg(args, "total", 0)}개`,
  },
  {
    id: "demo-teach",
    icon: "✍️",
    name: "시연으로 가르치기",
    description: "샌드박스에 직접 타일을 깔아 AI를 교정합니다. 실제 맵은 불변.",
    source: "system",
    kind: "action",
    params: [],
  },
  {
    id: "build-house",
    icon: "🏠",
    name: "집 짓기",
    description: "크기·재질·모양을 정해 집을 짓습니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "width", label: "가로", type: "number", min: 5, max: 30, defaultValue: 10 },
      { key: "height", label: "세로", type: "number", min: 6, max: 24, defaultValue: 10 },
      {
        key: "material",
        label: "재질",
        type: "enum",
        defaultValue: "plaster",
        options: [
          { value: "plaster", label: "회벽" },
          { value: "wood", label: "목재" },
          { value: "stone", label: "석재" },
        ],
      },
      {
        key: "shape",
        label: "모양",
        type: "enum",
        defaultValue: "rect",
        options: [
          { value: "rect", label: "직사각형" },
          { value: "l", label: "ㄴ자" },
        ],
      },
      { key: "where", label: "위치(비우면 자동)", type: "text", placeholder: "예: 마을 동쪽 빈터" },
    ],
    buildPrompt: (args, ctx) => [
      `현재 맵(${ctx.mapName ?? "현재 맵"})에 집을 지어주세요.`,
      `- 크기: ${args.width}×${args.height}, 재질: ${args.material}, 모양: ${args.shape === "l" ? "ㄴ자" : "직사각형"}`,
      `- 위치: ${args.where ? String(args.where) : "get_map_region으로 빈터를 찾아 자동 선정(기존 구조물·물·이벤트와 겹치지 않게)"}`,
      "",
      "절차(준수 — 공정 순서: 벽→문/창→지붕):",
      args.shape === "l"
        ? "1. ㄴ자 집은 build_wall(mapId, rect, material)을 직교 rect 2개로 겹쳐 호출해 조합하세요. 절대 벽 타일을 직접 칠하지 마세요."
        : "1. build_wall(mapId, rect{x,y,w,h}, material)로 벽을 지으세요. 절대 벽 타일을 직접 칠해 사각형을 만들지 마세요.",
      "2. place_door(mapId, at, material)로 문을, place_window(mapId, at, material)로 창문을 벽 셀에 다세요.",
      "3. build_roof(mapId, material)로 지붕을 얹으세요(wallRect 생략 시 벽 자동 감지).",
      "4. 완성 후 문 좌표를 보고하고, 문 앞이 통행 가능한지 get_map_region으로 확인하세요.",
      CONSTRUCTION_ORDER_RULE,
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🏠 집 짓기 — ${args.width}×${args.height} ${args.material}${args.shape === "l" ? " (ㄴ자)" : ""}`,
  },
  {
    id: "map-audit",
    icon: "✅",
    name: "맵 검증 리포트",
    description: "린트+도달성+구조 검사를 일괄 실행하고 고치거나 정직하게 보고합니다.",
    source: "system",
    kind: "prompt",
    params: [],
    buildPrompt: (_args, ctx) => [
      `현재 맵(${ctx.mapName ?? "현재 맵"})을 전면 검증해 주세요.`,
      "",
      "절차(준수):",
      "1. run_lint로 프로젝트 전반 문제를 확인하세요.",
      "2. check_reachability로 현재 맵의 도달 불가 지점을 확인하세요.",
      "3. 집 키트로 지은 구조물은 문/길 연결과 통행성을 실제 맵 조회로 확인하세요.",
      "4. 발견한 문제를 심각도 순으로 나열하고, 자동으로 고칠 수 있는 것은 고친 뒤 같은 검사를 재실행해 해소를 증명하세요.",
      "5. 고칠 수 없는 것은 이유와 함께 남기세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: () => "✅ 맵 검증 리포트 — 린트/도달성/구조 일괄 검사",
  },
  {
    id: "build-village",
    icon: "🏘️",
    name: "마을 생성",
    description: "집 여러 채 + 길 + NPC를 단계별로 만듭니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "theme", label: "테마", type: "text", placeholder: "예: 강가의 어촌, 광산 마을" },
      { key: "houses", label: "집 수", type: "number", min: 2, max: 6, defaultValue: 3 },
      { key: "npcs", label: "NPC 수", type: "number", min: 0, max: 8, defaultValue: 3 },
      { key: "naturalness", label: "자연스러움", type: "enum", defaultValue: "보통", options: [{ value: "정갈", label: "정갈" }, { value: "보통", label: "보통" }, { value: "야생", label: "야생" }] },
    ],
    buildPrompt: (args, ctx) => [
      `현재 맵(${ctx.mapName ?? "현재 맵"})에 '${args.theme || "평범한"}' 테마의 마을을 만들어 주세요. 집 ${args.houses}채, NPC ${args.npcs}명.`,
      `- 자연스러움: ${args.naturalness || "보통"} (정갈=정원/minimal, 보통=mixed/market, 야생=dense 나무+workshop/garden)`,
      "",
      "LLM이 고를 것(의도)과 코드가 할 일(시공)을 나누세요. 단계별로 한 줄 보고하며 끝까지 진행:",
      "1. 의도 결정 — theme/query, pathStyle, yardStyle, plazaStyle, 집 kitId+yard, NPC 대사.",
      "2. 시공 순서 기획(LLM) — buildOrder 예: 호수/강촌 [plan,map,water,settlement,forest_conifer,forest_big,critique,look], 산골은 water 없이 settlement 먼저.",
      "   settlement 내부는 코드가 집→길(얽기설기)→울타리→소품·NPC 고정.",
      "3. 멀티턴 시공 — run_village_session({ theme, query, buildOrder, houses, npcs }) 또는 start+advance 반복.",
      "   나무 카탈로그 list_village_tree_assets, 대목 plant_tree_clusters({ style:\"broadleaf-2x2\" }).",
      "   NPC 대사는 place_npc가 faceset changeFace를 자동 삽입한다.",
      "4. 빠른 bulk 숏컷 — run_village_pipeline 또는 build_village(의도 채움). 2×2 대목은 세션 경로가 더 확실.",
      "5. 검증 — evaluate_village_layer / evaluate_village_look / check_reachability.",
      "빈 build_village() 호출 금지 — 테마·마당·NPC 의도 없이 돌리면 단조로운 기본 레시피만 나온다.",
      CONSTRUCTION_ORDER_RULE,
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🏘️ 마을 생성 — ${args.theme || "기본"} / 집 ${args.houses}채 / NPC ${args.npcs}명`,
  },
  {
    id: "build-interior",
    icon: "🛏️",
    name: "실내 방 시공",
    description: "villager-room-v1 하네스로 실내 맵을 짓습니다 — 공간(방·복도) 역할별 시공 + 평가·자가수정 루프.",
    source: "system",
    kind: "prompt",
    params: [
      {
        key: "brief",
        label: "요구사항",
        type: "text",
        placeholder: "예: 석재 벽 연금술사의 집 — 공방(돌바닥)·서재·접객 홀",
      },
      { key: "width", label: "가로", type: "number", min: 10, max: 40, defaultValue: 18 },
      { key: "height", label: "세로", type: "number", min: 9, max: 40, defaultValue: 14 },
      {
        key: "wallMaterial",
        label: "벽 재질",
        type: "enum",
        defaultValue: "cream",
        options: [
          { value: "cream", label: "크림(민가)" },
          { value: "stone-brick", label: "석재" },
          { value: "gold-brick", label: "금장(귀족 — 붉은 카펫)" },
        ],
      },
      { key: "rooms", label: "방 수(1=단일 홀)", type: "number", min: 1, max: 6, defaultValue: 3 },
    ],
    buildPrompt: (args, ctx) => [
      `실내 맵을 새로 지어주세요. 요구사항: ${args.brief || "아늑한 주민 집"} (${args.width}×${args.height}, 벽=${args.wallMaterial}, 방 ${args.rooms}개)`,
      ctx.mapName ? `현재 맵(${ctx.mapName})은 건드리지 말고 새 mapId(예: map_interior_<슬러그>_v1)로 만드세요.` : "새 mapId(예: map_interior_<슬러그>_v1)로 만드세요.",
      "",
      "절차(준수 — 실내 하네스 villager-room-v1):",
      "1. 플랜 설계(당신의 역할) — '실내'는 상위 개념, 배치는 공간 단위다. rooms[]에 방마다 역할 테마를 부여:",
      "   bedroom|study|dining|kitchen|storage|tavern|corridor. corridor는 복도(바닥 점유물 없음, 전시물만).",
      "   좌표 문법: 좌우 인접 방은 1열 파티션(방 사이 x 간격 1), 상하 인접 방은 3행 파티션(y 간격 3).",
      "   innerDoors는 파티션 개구부 — 수평 파티션은 트림 행(위 방 바닥 최하단+1) 좌표, 수직 파티션은 그 열의 바닥 행.",
      "   door는 남측 바닥 경계 셀. 바닥 재질은 room.floorTile(돌 12, 널 102, 짚 돗자리 139; 기본 나무 72).",
      "   벽 재질 gold-brick은 귀족 전용(식당 러그가 붉은 카펫이 됨). 붉은 카펫 계단(465~467)도 귀족 전용.",
      "2. start_interior_room_session({ mapId, name, width, height, rooms, innerDoors, door, theme, wallMaterial })",
      "3. advance_interior_room_build({ sessionId }) 반복 — floor→walls→furniture→entrance→critique 순서로 done까지.",
      "4. evaluate_interior_room({ sessionId }) — 불합격이면 feedbackForLlm 지침을 따르세요:",
      "   방 하나가 문제면 furnish_interior_space({ sessionId, roomId, theme?, seed? })로 그 방만 재시공(테마 교체/재추첨),",
      "   전반 문제면 advance_interior_room_build({ forceLayer: \"furniture\" })로 가구층 재실행. 최대 3회 재평가.",
      "5. 합격 후 show_map_region으로 결과를 확인하고 방별 구성(테마·좌표)을 한 줄씩 보고하세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🛏️ 실내 방 시공 — ${args.width}×${args.height} ${args.wallMaterial} / 방 ${args.rooms}개`,
  },
  {
    id: "build-dungeon",
    icon: "⛏️",
    name: "던전 시공",
    description: "dungeon-room-v1 하네스로 테마 던전 방(용암/석재/얼음)을 짓습니다 — 쿼터뷰 천장·벽·위험지형+다리 원샷 시공.",
    source: "system",
    kind: "prompt",
    params: [
      {
        key: "brief",
        label: "요구사항",
        type: "text",
        placeholder: "예: 보스전 직전의 용암 동굴 — 다리 건너 제단",
      },
      {
        key: "theme",
        label: "테마",
        type: "enum",
        defaultValue: "lava",
        options: [
          { value: "lava", label: "용암 동굴(붉은 암반·용암)" },
          { value: "stone", label: "석재 홀(돌바닥·구덩이)" },
          { value: "ice", label: "얼음 동굴(빙판·급류)" },
        ],
      },
      { key: "width", label: "가로", type: "number", min: 8, max: 60, defaultValue: 26 },
      { key: "height", label: "세로", type: "number", min: 8, max: 60, defaultValue: 18 },
      {
        key: "hazard",
        label: "위험지형",
        type: "enum",
        defaultValue: "with",
        options: [
          { value: "with", label: "있음(중앙 위험지형 + 판자 다리)" },
          { value: "without", label: "없음(빈 방)" },
        ],
      },
    ],
    buildPrompt: (args, ctx) => [
      `던전 방을 새로 지어주세요. 요구사항: ${args.brief || "테마 던전 방"} (테마=${args.theme}, ${args.width}×${args.height}, 위험지형 ${args.hazard === "without" ? "없음" : "있음"})`,
      ctx.mapName ? `현재 맵(${ctx.mapName})은 건드리지 말고 새 mapId(예: map_dungeon_<슬러그>)로 만드세요.` : "새 mapId(예: map_dungeon_<슬러그>)로 만드세요.",
      "",
      "절차(준수 — 던전 하네스 dungeon-room-v1):",
      "1. (선택) list_dungeon_room_themes 로 테마 3종과 데모 플랜을 확인하세요.",
      `2. run_dungeon_room_pipeline({ mapId, name, width, height, theme: "${args.theme}", hazard: ${args.hazard === "without" ? "false" : "true"} }) — 원샷 시공.`,
      "   테마별 구성 — lava: 붉은 암반 바닥+용암 호수, stone: 돌바닥+구덩이, ice: 빙판+급류. 위험지형 위에 상위 레이어 판자 다리가 걸립니다.",
      "3. 이후 수동 확장 시 2D 쿼터뷰 규칙을 지키세요(2026-07-14 사용자 확정):",
      "   테마 천장(공허)이 방을 감싸고, 벽 면은 천장 하단(남향)에만 직선 [좌끝·가로증식·우끝] 2단으로 보입니다.",
      "   좌/우/하단은 벽 면 없이 천장이 바닥과 바로 만납니다. 대각 절벽 타일을 벽 밴드에 쓰지 마세요.",
      "4. show_map_region 으로 결과를 확인하고 구성(천장/벽/바닥/위험지형+다리)을 한 줄씩 보고하세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `⛏️ 던전 시공 — ${args.theme} ${args.width}×${args.height}`,
  },
  {
    id: "quest-builder",
    icon: "📜",
    name: "퀘스트 빌더",
    description: "개요 한 줄로 스위치/변수/NPC/보상이 연결된 퀘스트를 만듭니다.",
    source: "system",
    kind: "prompt",
    params: [{ key: "outline", label: "퀘스트 개요", type: "text", placeholder: "예: 촌장이 잃어버린 반지를 우물에서 찾아오면 100G" }],
    buildPrompt: (args) => [
      `다음 개요로 퀘스트를 만들어 주세요: "${args.outline}"`,
      "",
      "절차(준수):",
      "1. create_quest_flags/create_quest로 시작·완료 스위치와 퀘스트 정의를 만드세요(기존 스위치는 find_switch_usage로 중복 확인).",
      "2. 퀘스트를 주는 NPC와 목표 지점 이벤트를 만들거나, 기존 이벤트를 get_event로 읽어 분기를 병합하세요.",
      "3. 진행 상태별 대사 분기(시작 전/진행 중/완료)를 반드시 넣으세요.",
      "4. 보상(아이템/골드)은 실제 존재하는 id를 get_database_records로 확인해 지급하세요.",
      "5. 완성 후 퀘스트 흐름(누구에게 받고 → 어디서 무엇을 → 보상)을 요약하세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `📜 퀘스트 빌더 — ${String(args.outline).slice(0, 40)}`,
  },
  {
    id: "build-road",
    icon: "🛤️",
    name: "도로 건설",
    description: "두 지점/시설을 잇는 길을 오토타일로 깝니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "route", label: "경로 설명", type: "text", placeholder: "예: 남쪽 입구에서 광장을 지나 여관 문 앞까지" },
      {
        key: "style",
        label: "스타일",
        type: "enum",
        defaultValue: "sand",
        options: [
          { value: "sand", label: "모래(베이지)" },
          { value: "dirt", label: "흙길" },
        ],
      },
    ],
    buildPrompt: (args, ctx) => [
      `현재 맵(${ctx.mapName ?? "현재 맵"})에 길을 깔아 주세요: ${args.route}`,
      "",
      "절차(준수):",
      "1. get_map_region으로 출발/경유/도착 지점의 실제 좌표를 파악하세요(추측 금지).",
      `2. lay_path(mapId, points, material)로 폴리라인을 깔되, 건물·물을 관통하지 않게 꺾으세요(스타일 힌트: ${args.style}). 존재하는 길 어휘는 바로 쓸 수 있습니다(미합의는 목업 확인). 어휘에 없는 새 길 재료가 필요할 때만 propose_tile_vocabulary.`,
      "3. 길이 문 앞과 이어지는지, 끊긴 곳이 없는지 get_map_region으로 재확인하세요.",
      CONSTRUCTION_ORDER_RULE,
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🛤️ 도로 건설 — ${String(args.route).slice(0, 40)}`,
  },
  {
    id: "place-npcs",
    icon: "🧍",
    name: "NPC 배치",
    description: "테마에 맞는 이름·대사를 가진 NPC들을 배치합니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "brief", label: "설명", type: "text", placeholder: "예: 시장 골목에 상인 2명과 아이 1명" },
      { key: "count", label: "인원", type: "number", min: 1, max: 8, defaultValue: 2 },
    ],
    buildPrompt: (args, ctx) => [
      `현재 맵(${ctx.mapName ?? "현재 맵"})에 NPC ${args.count}명을 배치해 주세요: ${args.brief}`,
      "",
      "절차(준수):",
      "1. get_map_region으로 통행 가능한 칸을 확인하고, 문 앞·길목을 막지 않는 위치를 고르세요.",
      "2. place_npc로 배치하되 이름은 서로 다르게, 대사는 각자 2줄 이상 개성 있게 쓰세요.",
      "3. 요청 인원을 전부 배치할 때까지 멈추지 마세요. 배치 후 좌표 목록을 보고하세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🧍 NPC 배치 — ${args.count}명 (${String(args.brief).slice(0, 30)})`,
  },
  {
    id: "npc-motion",
    icon: "🚶",
    name: "NPC 움직임",
    description: "기존 NPC에게 이동 패턴(고정/랜덤/접근 등)을 부여합니다.",
    source: "system",
    kind: "prompt",
    params: [{ key: "brief", label: "대상과 움직임", type: "text", placeholder: "예: 주민들은 랜덤으로 거닐고, 경비병은 제자리" }],
    buildPrompt: (args, ctx) => [
      `현재 맵(${ctx.mapName ?? "현재 맵"})의 NPC 움직임을 설정해 주세요: ${args.brief}`,
      "",
      "절차(준수):",
      "1. find_events로 대상 NPC들을 찾고, get_event로 각 이벤트의 현재 페이지를 읽으세요.",
      "2. movement(type: fixed/random/approach/custom/living, speed, frequency)만 수정해 upsert_event로 병합하세요.",
      "   기존 대사/분기를 절대 잃어버리지 마세요(읽지 않고 덮어쓰기 금지).",
      "3. 움직이는 NPC가 좁은 길·문 앞을 막을 수 있으면 speed/frequency를 낮추거나 fixed로 두세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🚶 NPC 움직임 — ${String(args.brief).slice(0, 40)}`,
  },
  {
    id: "make-items",
    icon: "🎒",
    name: "아이템 생성",
    description: "컨셉에 맞는 아이템을 밸런스 고려해 DB에 추가합니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "concept", label: "컨셉", type: "text", placeholder: "예: 화산 지역에서 나올 화염 저항 물약 시리즈" },
      { key: "count", label: "개수", type: "number", min: 1, max: 5, defaultValue: 2 },
    ],
    buildPrompt: (args) => [
      `아이템 ${args.count}개를 만들어 주세요: ${args.concept}`,
      "",
      "절차(준수):",
      "1. get_database_records(items)로 기존 아이템의 가격·효과 스케일을 먼저 파악하세요(밸런스 기준).",
      "2. upsert_item으로 생성하되 이름·설명은 세계관(잿불의 유산)에 어울리게, 효과 수치는 기존 스케일 안에서.",
      "3. 생성 후 각 아이템의 이름/가격/효과를 표로 요약하세요.",
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🎒 아이템 생성 — ${args.count}개 (${String(args.concept).slice(0, 30)})`,
  },
  {
    id: "battle-balance",
    icon: "⚔️",
    name: "전투 밸런스 리포트",
    description: "트룹 전투를 시뮬레이션해 승률·평균 타수를 측정하고, 목표 승률에 맞게 적을 튜닝합니다.",
    source: "system",
    kind: "prompt",
    params: [
      { key: "troopId", label: "트룹 ID(비우면 전체)", type: "text", placeholder: "예: troop_slime" },
      { key: "heroLevel", label: "영웅 레벨", type: "number", min: 1, max: 99, defaultValue: 5 },
      { key: "targetWinRate", label: "목표 승률(%)", type: "number", min: 1, max: 100, defaultValue: 85 },
    ],
    buildPrompt: (args) => {
      const troopId = textArg(args, "troopId").trim();
      const heroLevel = numberArg(args, "heroLevel", 5);
      const targetWinRate = numberArg(args, "targetWinRate", 85);
      return [
        troopId
          ? `트룹 '${troopId}'의 전투 밸런스를 점검해 주세요(영웅 Lv${heroLevel}, 목표 승률 ${targetWinRate}%).`
          : `모든 트룹의 전투 밸런스를 점검해 주세요(영웅 Lv${heroLevel}, 목표 승률 ${targetWinRate}%).`,
        "",
        "절차(준수):",
        `1. get_database_records(troops)와 get_database_records(enemies)로 ${troopId ? `트룹 '${troopId}'` : "모든 트룹"}과 소속 적(enemyId·스탯)을 파악하세요.`,
        `2. 트룹마다 simulate_battle({ troopId, heroLevel: ${heroLevel}, n: 50, seed: 42 })로 승률/평균 타수를 측정하세요(n=50, seed 고정 — 재실행해도 같은 결과가 나와야 합니다).`,
        `3. 승률이 목표 ${targetWinRate}%에서 크게 벗어난 트룹은 tune_enemy({ enemyId, targetHitsToKill, targetDamageToHeroPerHit, heroLevel: ${heroLevel} })로 소속 적의 maxHp/attack을 조정한 뒤, 같은 seed로 simulate_battle을 재실행해 개선을 증명하세요.`,
        "4. 트룹별 승률/평균 타수를 before/after 표로 요약하세요(조정하지 않은 트룹은 사유를 명기).",
        HONEST_REPORT_RULE,
      ].join("\n");
    },
    displayAs: (args) => {
      const troopId = textArg(args, "troopId").trim();
      return `⚔️ 전투 밸런스 — ${troopId || "전체 트룹"} · Lv${numberArg(args, "heroLevel", 5)} · 목표 ${numberArg(args, "targetWinRate", 85)}%`;
    },
  },
];

// ── 사용자 정의 스킬(localStorage) ────────────────────────────────
export interface UserSkill {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
  readonly template: string;
  /** 인자 폼(단순화: text/number/enum) — 템플릿의 {{인자키}}로 치환된다. 없으면 기존 동작. */
  readonly params?: readonly SkillParam[];
  /** 선택 영역 필수(시스템 스킬과 동일한 안내 경로 재사용). */
  readonly needsSelection?: boolean;
}

const USER_SKILLS_KEY = "rpg-zzu:user-skills";
const USER_PARAM_TYPES: readonly SkillParamType[] = ["text", "number", "enum"];

// 사용자 스킬 파라미터 정화 — 저장 포맷이 손상됐어도 유효한 행만 살린다(하위호환).
function sanitizeUserSkillParam(entry: unknown): SkillParam | null {
  if (typeof entry !== "object" || entry === null) return null;
  const source = entry as Partial<SkillParam>;
  if (typeof source.key !== "string" || !source.key.trim()) return null;
  const type = USER_PARAM_TYPES.includes(source.type as SkillParamType) ? (source.type as SkillParamType) : "text";
  const options = Array.isArray(source.options)
    ? source.options.filter(
        (option): option is { value: string; label: string } =>
          typeof option === "object" && option !== null && typeof option.value === "string" && typeof option.label === "string"
      )
    : [];
  return {
    key: source.key,
    label: typeof source.label === "string" && source.label.trim() ? source.label : source.key,
    type,
    ...(type === "enum" && options.length > 0 ? { options } : {}),
    ...(typeof source.defaultValue === "string" || typeof source.defaultValue === "number" ? { defaultValue: source.defaultValue } : {}),
    ...(typeof source.placeholder === "string" ? { placeholder: source.placeholder } : {}),
  };
}

// 하위호환 정규화 — params/needsSelection 없는 기존 레코드는 그대로 동작한다.
function normalizeUserSkill(entry: UserSkill): UserSkill {
  const params = Array.isArray(entry.params)
    ? entry.params.map(sanitizeUserSkillParam).filter((param): param is SkillParam => param !== null)
    : [];
  return {
    id: entry.id,
    icon: typeof entry.icon === "string" && entry.icon ? entry.icon : "⭐",
    name: typeof entry.name === "string" ? entry.name : entry.id,
    description: typeof entry.description === "string" ? entry.description : "",
    template: entry.template,
    ...(params.length > 0 ? { params } : {}),
    ...(entry.needsSelection === true ? { needsSelection: true } : {}),
  };
}

export function loadUserSkills(): UserSkill[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_SKILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is UserSkill =>
        typeof entry === "object" && entry !== null && typeof (entry as UserSkill).id === "string" && typeof (entry as UserSkill).template === "string"
      )
      .map(normalizeUserSkill);
  } catch {
    return [];
  }
}

export function saveUserSkill(skill: Omit<UserSkill, "id"> & { id?: string }): UserSkill {
  const skills = loadUserSkills();
  const id = skill.id ?? `user-${Math.abs(hashText(skill.name + skill.template)).toString(36)}`;
  const next: UserSkill = {
    id,
    icon: skill.icon || "⭐",
    name: skill.name,
    description: skill.description,
    template: skill.template,
    ...(skill.params && skill.params.length > 0 ? { params: skill.params } : {}),
    ...(skill.needsSelection ? { needsSelection: true } : {}),
  };
  const index = skills.findIndex((entry) => entry.id === id);
  if (index >= 0) skills[index] = next;
  else skills.push(next);
  if (typeof localStorage !== "undefined") localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(skills));
  // 원격 미러는 best-effort — 미설정/미마이그레이션/네트워크 실패는 조용히 무시(로컬이 정본).
  void recordSupabaseUserSkill({
    id: next.id,
    icon: next.icon,
    name: next.name,
    description: next.description,
    template: next.template,
    skill: next,
  }).catch(() => undefined);
  return next;
}

export function deleteUserSkill(id: string): void {
  const skills = loadUserSkills().filter((entry) => entry.id !== id);
  if (typeof localStorage !== "undefined") localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(skills));
  void deleteSupabaseUserSkill(id).catch(() => undefined);
}

function skillArgText(value: SkillArgValue): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(",");
  if (isSkillRectArg(value)) return rectText(value);
  return "";
}

// 템플릿 플레이스홀더: {{맵}}(이름), {{맵id}}, {{영역}}((x,y) w×h) + {{인자키}}(사용자 params).
// 내장 3종을 먼저 치환하므로 같은 이름의 인자 키보다 내장이 우선한다.
export function expandUserSkillTemplate(template: string, ctx: SkillRunContext, args: Record<string, SkillArgValue> = {}): string {
  let expanded = template
    .replaceAll("{{맵}}", ctx.mapName ?? "현재 맵")
    .replaceAll("{{맵id}}", ctx.mapId ?? "")
    .replaceAll("{{영역}}", regionText(ctx));
  for (const [key, value] of Object.entries(args)) {
    expanded = expanded.replaceAll(`{{${key}}}`, skillArgText(value));
  }
  return expanded;
}

function userSkillToDef(skill: UserSkill): SkillDef {
  return {
    id: skill.id,
    icon: skill.icon,
    name: skill.name,
    description: skill.description || "사용자 정의 스킬",
    source: "user",
    kind: "prompt",
    params: skill.params ?? [],
    ...(skill.needsSelection ? { needsSelection: true } : {}),
    buildPrompt: (args, ctx) => expandUserSkillTemplate(skill.template, ctx, args),
    displayAs: () => `${skill.icon} ${skill.name}`,
  };
}

export function listAllSkills(): SkillDef[] {
  return [...SYSTEM_SKILLS, ...loadUserSkills().map(userSkillToDef)];
}

// ── 스킬 사용 이력(핀 바 최근 사용순 정렬) ────────────────────────
const RECENT_SKILLS_KEY = "rpg-zzu:skill-recent";
// 사용 이력이 없을 때의 기본 핀 — 가장 자주 쓰일 흐름 순.
const DEFAULT_PIN_ORDER = ["interview", "build-house", "map-audit", "demo-teach", "build-village"];

export function recordSkillUse(id: string): void {
  if (typeof localStorage === "undefined") return;
  const recent = loadRecentSkillIds().filter((entry) => entry !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_SKILLS_KEY, JSON.stringify(recent.slice(0, 12)));
}

export function loadRecentSkillIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SKILLS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

// 입력창 위 핀 바에 올릴 스킬 — 최근 사용순, 부족하면 기본 순서로 채운다.
export function pinnedSkills(limit = 5): SkillDef[] {
  const all = listAllSkills();
  const byId = new Map(all.map((skill) => [skill.id, skill]));
  const picked: SkillDef[] = [];
  for (const id of [...loadRecentSkillIds(), ...DEFAULT_PIN_ORDER]) {
    const skill = byId.get(id);
    if (skill && !picked.includes(skill)) picked.push(skill);
    if (picked.length >= limit) break;
  }
  return picked;
}

// 슬래시 자동완성 필터 — "/집", "집 짓", "house" 모두 매칭.
export function filterSkills(query: string): SkillDef[] {
  const needle = query.trim().replace(/^\//, "").toLowerCase();
  const skills = listAllSkills();
  if (!needle) return skills;
  return skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(needle) ||
      skill.id.toLowerCase().includes(needle) ||
      skill.description.toLowerCase().includes(needle)
  );
}

function hashText(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return hash;
}
