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
}

export interface SkillRunContext {
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly selection: { readonly mapId: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
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
  "공간 작업 규칙(스펙 게이트): 실행 전 set_build_spec으로 밑그림을 제출하세요 — 대상 맵, 에셋별 영역(x,y,w,h)과 종류·스타일, 통로 너비, 밀도, 배치 스타일. 검증 오류(겹침/큰 경계 초과)는 좌표를 고쳐 재제출하고, 3회 실패하면 계획을 폐기하고 사용자에게 물으세요. 페인트/배치 툴은 명세에 할당된 영역 안에서만 호출하되 경계 1~2칸 초과는 warning으로 통과합니다. 지우기(erase)는 slack 없이 명세 안에서만 호출하세요. 사용자가 선택한 영역은 암묵적 명세입니다.";
const CONSTRUCTION_ORDER_RULE =
  "시공 공정 순서(준수): 벽(build_wall) → 문/창(place_door/place_window) → 지붕(build_roof) → 길(lay_path) → 소품(place_props). 배치 프리미티브는 승인된 어휘만 소비합니다. 미승인 어휘로 시공하려면: (1) propose_tile_vocabulary로 어휘를 제안하고, (2) **같은 턴에 곧바로** 그 그룹 id를 wallVocabId 등으로 넣어 시공 프리미티브(build_wall 등)를 호출하세요. 미승인 상태의 첫 호출은 실패하지만 그건 정상입니다 — 시스템이 그 시공을 승인 카드에 '보류 시공'으로 묶어, 사용자가 [승인하고 시공]을 한 번 누르면 어휘 승인과 시공이 함께 끝납니다. **제안만 하고 승인을 기다리며 턴을 끝내지 마세요 — 반드시 같은 턴에 시공 프리미티브까지 호출하세요.**";

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
      { key: "tilesetId", label: "타일셋 ID", type: "text", placeholder: "tiles_default" },
      { key: "groupId", label: "그룹 ID", type: "text", placeholder: "roof_main" },
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
      { key: "tilesetId", label: "타일셋 ID", type: "text", placeholder: "tiles_default" },
      { key: "rect", label: "범위", type: "text", placeholder: "x,y,w,h" },
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
      { key: "tilesetId", label: "타일셋 ID", type: "text", placeholder: "tiles_default" },
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
        ? "1. ㄴ자 집은 build_wall(mapId, rect, wallVocabId)을 직교 rect 2개로 겹쳐 호출해 조합하세요. 절대 벽 타일을 직접 칠하지 마세요."
        : "1. build_wall(mapId, rect{x,y,w,h}, wallVocabId)로 벽을 지으세요. 절대 벽 타일을 직접 칠해 사각형을 만들지 마세요.",
      "2. place_door(mapId, at, doorVocabId)로 문을, place_window(mapId, at, windowVocabId)로 창문을 벽 셀에 다세요.",
      "3. build_roof(mapId, roofVocabId)로 지붕을 얹으세요(wallRect 생략 시 벽 자동 감지).",
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
      "3. 하네싱 집 키트로 지은 구조물은 문/길 연결과 통행성을 실제 맵 조회로 확인하세요.",
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
      `- 자연스러움: ${args.naturalness || "보통"} (정갈=naturalness 0~0.2, 보통=0.5, 야생=0.8+)`,
      "",
      "단계별로 진행하고, 각 단계가 끝날 때마다 한 줄로 보고하세요(전부 끝날 때까지 멈추지 마세요):",
      "1. 부지 계획 — get_map_region으로 지형을 읽고 집·길 배치를 정하세요.",
      "2. 집 — 공정 순서대로 집마다 build_wall(크기 다양하게) → place_door/place_window → build_roof로 겹치지 않게 지으세요.",
      "3. 길 — lay_path로 집 문 앞들을 잇는 길을 깔고, 문 앞 통행을 확인하세요.",
      "4. 소품·NPC — place_props로 나무/소품을 산포하고, place_npc로 테마에 맞는 이름·대사(2줄 이상)를 붙여 통행 가능 칸에 배치하세요.",
      "5. 검증 — check_reachability로 모든 문 앞이 도달 가능한지 확인하고 문제를 고치세요.",
      CONSTRUCTION_ORDER_RULE,
      SPEC_RULE,
      HONEST_REPORT_RULE,
    ].join("\n"),
    displayAs: (args) => `🏘️ 마을 생성 — ${args.theme || "기본"} / 집 ${args.houses}채 / NPC ${args.npcs}명`,
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
      `2. lay_path(mapId, points, pathVocabId)로 폴리라인을 깔되, 건물·물을 관통하지 않게 꺾으세요(스타일 힌트: ${args.style}). 길 어휘가 미승인이면 propose_tile_vocabulary로 먼저 합의하세요.`,
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
];

// ── 사용자 정의 스킬(localStorage) ────────────────────────────────
export interface UserSkill {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
  readonly template: string;
}

const USER_SKILLS_KEY = "rpg-zzu:user-skills";

export function loadUserSkills(): UserSkill[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_SKILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is UserSkill =>
      typeof entry === "object" && entry !== null && typeof (entry as UserSkill).id === "string" && typeof (entry as UserSkill).template === "string"
    );
  } catch {
    return [];
  }
}

export function saveUserSkill(skill: Omit<UserSkill, "id"> & { id?: string }): UserSkill {
  const skills = loadUserSkills();
  const id = skill.id ?? `user-${Math.abs(hashText(skill.name + skill.template)).toString(36)}`;
  const next: UserSkill = { id, icon: skill.icon || "⭐", name: skill.name, description: skill.description, template: skill.template };
  const index = skills.findIndex((entry) => entry.id === id);
  if (index >= 0) skills[index] = next;
  else skills.push(next);
  if (typeof localStorage !== "undefined") localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(skills));
  return next;
}

export function deleteUserSkill(id: string): void {
  const skills = loadUserSkills().filter((entry) => entry.id !== id);
  if (typeof localStorage !== "undefined") localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(skills));
}

// 템플릿 플레이스홀더: {{맵}}(이름), {{맵id}}, {{영역}}((x,y) w×h).
export function expandUserSkillTemplate(template: string, ctx: SkillRunContext): string {
  return template
    .replaceAll("{{맵}}", ctx.mapName ?? "현재 맵")
    .replaceAll("{{맵id}}", ctx.mapId ?? "")
    .replaceAll("{{영역}}", regionText(ctx));
}

function userSkillToDef(skill: UserSkill): SkillDef {
  return {
    id: skill.id,
    icon: skill.icon,
    name: skill.name,
    description: skill.description || "사용자 정의 스킬",
    source: "user",
    kind: "prompt",
    params: [],
    buildPrompt: (_args, ctx) => expandUserSkillTemplate(skill.template, ctx),
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
