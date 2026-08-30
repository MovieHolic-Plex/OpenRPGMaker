// editor/assistantToolMode.ts
// 컨텍스트 모드 결정(2026-07-07 타일 시공 흐름 재설계 §2.2.2 — 원칙 0).
// AI 어시스턴트에 노출할 툴 집합(toOpenAiTools({mode}))의 mode를 **UI 상태에서만**
// 결정론으로 계산한다 — 모델 판단 금지. 우선순위:
//   1. DB 모달 열림           → "database"
//   2. 이벤트 에디터 열림      → "event"
//   3. 이벤트 레이어/도구 활성 → "event"
//   4. 타일 팔레트 활성(좌측 팔레트 보임 + 타일 레이어 편집) → "tile"
//   5. 판정 불가/일반          → "map" (기본, 넓게)

import { requestLikelyModifiesExisting, stripContextFooter } from "@/ai/modifyIntent";
import { editorState } from "@/editor/editorState";
import type { ToolDomain } from "@/editor/tools";

function modalOpen(testid: string): boolean {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  return document.querySelector(`[data-testid="${testid}"]`) !== null;
}

// 좌측 타일 팔레트가 실제로 보이는가 — 접힘(leftRoot display:none) 상태면 비활성.
function tilePaletteVisible(): boolean {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  const root = document.querySelector('[data-testid="left-palette-root"]') as HTMLElement | null;
  if (!root) return false;
  const parent = root.parentElement;
  return !(parent && parent.style && parent.style.display === "none");
}

export function computeAssistantToolMode(): ToolDomain {
  if (typeof document === "undefined") return "map";
  if (modalOpen("database-modal")) return "database";
  if (modalOpen("event-editor-content")) return "event";
  const state = editorState.get();
  if (state.layer === "event" || state.tool === "event") return "event";
  if ((state.layer === "lower" || state.layer === "upper") && tilePaletteVisible()) return "tile";
  return "map";
}

type IntentStrength = "strong" | "weak";
export type ToolDomainReason = "core" | "ui" | "intent-strong" | "intent-weak" | "recent";

export interface ActiveToolDomainInfo {
  readonly uiDomain: ToolDomain;
  readonly strongIntentDomains: ReadonlySet<ToolDomain>;
  readonly weakIntentDomains: ReadonlySet<ToolDomain>;
  readonly recentDomains: ReadonlySet<ToolDomain>;
  readonly reasons: ReadonlyMap<ToolDomain, ReadonlySet<ToolDomainReason>>;
}

export const INTENT_KEYWORDS: Readonly<Record<ToolDomain, { strong: readonly string[]; weak: readonly string[] }>> = {
  core: { strong: [], weak: [] },
  battle: {
    strong: ["전투", "배틀", "적", "몬스터", "enemy", "troop", "트룹", "시뮬", "드롭", "hp", "상성", "상성표", "속성"],
    weak: ["스킬", "밸런스", "행동"],
  },
  quest: { strong: ["퀘스트", "quest", "플래그", "보상", "목표", "단계", "튜토리얼", "tutorial", "분기", "branch", "반전", "twist", "서사", "story", "엔딩", "ending", "결말", "의뢰", "미션", "반지를", "찾아오", "촌장", "quest-giver"], weak: [] },
  database: {
    strong: ["아이템", "포션", "물약", "무기", "방어구", "장비", "액터", "캐릭터", "직업", "클래스", "상태이상", "데이터베이스", "데이터 베이스", "db", "능력치", "상성", "상성표", "속성", "생활", "생활 스킬", "레시피", "제작", "가축", "날씨", "전투 애니메이션"],
    weak: ["스킬", "적"],
  },
  tile: {
    strong: [
      "벽", "길", "타일", "지붕", "문", "바닥", "오토타일", "도로", "페인트",
      "물", "호수", "연못", "강", "수역", "지형", "지면",
      "나무", "소품", "집", "건물", "숲", "꽃", "바위", "산포", "겨울", "눈", "winter", "snow",
      "마을", "도시", "정착지", "village", "city", "town", "settlement",
      "실내", "인테리어", "침실", "서재", "주방", "식당", "예배당", "강당", "강의실",
      // 가구/자리 어휘 — 없으면 "의자를 깔아라"에 tile 도메인이 안 켜져 배치 툴이 0개 노출된다.
      "가구", "의자", "벤치", "탁자", "책상", "침대", "좌석", "신도석", "책장",
      "교회", "성당", "극장", "furniture", "chair", "bench", "table", "desk", "pew", "church",
    ],
    weak: [],
  },
  // 엔딩 툴(define_ending/list_endings)은 event 도메인으로 태깅돼 있으므로 엔딩 키워드도 event 를 켠다.
  event: { strong: ["이벤트", "npc", "대사", "전송", "스위치", "변수", "트리거", "주민", "상점", "상인", "재고", "shop", "merchant", "stock", "튜토리얼", "tutorial", "분기", "branch", "반전", "twist", "서사", "story", "컷신", "cutscene", "회상", "플래시백", "과거", "무비", "동영상", "연출", "선택지", "엔딩", "ending", "결말", "동료", "동행", "펫", "따라오", "따라다니", "companion", "follower", "pet"], weak: [] },
  // 세계관(project.world) 툴은 배제됐다 — 여기 남은 world 도메인은 맵 연결 그래프(plan_world/build_world) 전용이다.
  world: { strong: ["월드", "지역", "맵 연결", "대륙"], weak: [] },
  system: {
    strong: [
      "린트", "타이틀", "시작위치", "시작 위치", "히스토리", "플레이테스트",
      "새 프로젝트", "새 게임", "처음부터", "프로젝트 초기화", "new project", "new game", "start project", "start over", "reset project",
      "시간 시스템", "낮", "밤", "아침", "저녁", "day night", "day/night", "time system",
      "품질", "quality", "평가", "evaluate",
      "포획", "몬스터 시스템", "몬스터 도감",
    ],
    weak: [],
  },
  map: { strong: ["맵", "지도", "마을", "던전", "필드", "실내", "도시", "정착지", "city", "town", "settlement", "사냥터"], weak: [] },
};

const NEGATION_WORDS = ["말고", "제외", "빼고", "말고서", "아니라"] as const;
/**
 * "주제 전환" 신호 — 최근 도메인 기억(recentDomains)을 비운다.
 *
 * 옛 구현은 `RESET_WORDS = ["이제맵","다른작업","초기화","그만"]` 를 공백·구두점을 전부 제거한
 * 문자열에 `includes` 로 걸었다. 실측 대조쌍(2026-08-29 modify 진단 근본원인 12):
 *   "이 맵 상점 재고를 **초기화**해줘" → tile 소실 / "…리셋해줘" → tile 유지
 *   "**그만**큼 더 넓혀줘" → tile+event 둘 다 소실 / "이만큼 더 넓혀줘" → 유지
 *   "**다른 작업** 하기 전에 이 벽만 고쳐줘" → event 소실
 * 공백을 보존하고 앵커를 걸어 부분일치 오탐을 없앤다.
 */
const RESET_PATTERNS: readonly RegExp[] = [
  /^이제 맵/,
  /^다른 작업/,
  /프로젝트 초기화/,
  /처음부터 다시/,
  /그만하/,
  /그만해/,
];
const RECENT_DOMAIN_TTL = 2;
const recentDomains = new Map<ToolDomain, number>();
const activeInfoBySet = new WeakMap<ReadonlySet<ToolDomain>, ActiveToolDomainInfo>();

/**
 * 안내문에 박힌 툴 이름(snake_case) — 의도 스캔 전에 지운다.
 *
 * 아래 정규화는 `_` 를 공백으로 바꾸므로 `evaluate_interior_room` 이 "evaluate interior room" 이
 * 되고, `INTENT_KEYWORDS.system.strong` 의 "evaluate" 에 걸려 **툴 이름 하나가 system 도메인을
 * 열었다**. 그러면 핀된 system 툴 3종(reset_project·configure_time_system·evaluate_game_quality)이
 * 노출 상한(40) 라운드로빈에 끼어들어, 정작 그 도메인을 연 `evaluate_interior_room` 이 밀려났다
 * (실측: test/regionIntentExposure.test.ts interior 보장 실패). 영역 작업 요청마다 reset_project 가
 * 손에 잡히던 것도 같은 원인이다 — 2026-08-29 modify 진단의 근본원인 13(폐기 툴 노출)과 같은 계열.
 *
 * 툴 이름은 ASCII snake_case 뿐이고 한국어 사용자 발화에는 등장하지 않으므로, 이 토큰을 지워도
 * 사용자 의도 신호는 잃지 않는다. 사용자가 툴 이름을 직접 적는 경우는 이름 기반 능력 승격
 * (capabilityEscalation)이 따로 처리한다.
 */
const TOOL_NAME_TOKEN_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

function normalizeForIntent(text: string): string {
  // `[컨텍스트]` footer 는 aiChatPanel/runRegionTask 가 붙이는 기계 생성 텍스트인데 사용자 발화와
  // 같은 문자열로 온다. 걷어내지 않으면 **맵 이름이 도메인 키워드로 오인된다** — 같은
  // "여기 좀 고쳐줘"가 맵 이름이 "언덕"일 때와 "호숫가 마을"일 때 서로 다른 툴 집합을 열었다
  // (2026-08-29 modify 진단 실측 A/B). LLM 에 보내는 원문은 footer 를 포함한 그대로 둔다.
  return stripContextFooter(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(TOOL_NAME_TOKEN_RE, " ")
    .replace(/[\s\p{P}\p{S}_]+/gu, " ")
    .trim();
}

function hasResetTrigger(userMessage: string): boolean {
  // 공백을 보존한 정규화 문자열에 앵커 패턴을 건다(compactIntentText 기반 includes 폐기).
  const normalized = normalizeForIntent(userMessage);
  if (!normalized) return false;
  // 수정 요청은 주제 전환이 아니다 — 진행 중인 작업을 이어 고치는 것이라 도메인 기억을 지우면
  // 방금 쓰던 tile/event 툴이 노출에서 사라진다.
  if (requestLikelyModifiesExisting(userMessage)) return false;
  return RESET_PATTERNS.some((pattern) => pattern.test(normalized));
}

function addReason(map: Map<ToolDomain, Set<ToolDomainReason>>, domain: ToolDomain, reason: ToolDomainReason): void {
  const reasons = map.get(domain) ?? new Set<ToolDomainReason>();
  reasons.add(reason);
  map.set(domain, reasons);
}

function containsDomainKeyword(text: string): boolean {
  for (const keywords of Object.values(INTENT_KEYWORDS)) {
    for (const keyword of [...keywords.strong, ...keywords.weak]) {
      const token = normalizeForIntent(keyword);
      if (token && text.includes(token)) return true;
    }
  }
  return false;
}

function keywordNegated(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 8), start);
  const after = text.slice(end, Math.min(text.length, end + 8));
  if (NEGATION_WORDS.some((word) => after.includes(word))) return true;
  return NEGATION_WORDS.some((word) => {
    const index = before.lastIndexOf(word);
    if (index < 0) return false;
    return !containsDomainKeyword(before.slice(0, index));
  });
}

function findIntentDomains(userMessage: string): {
  readonly strong: Set<ToolDomain>;
  readonly weak: Set<ToolDomain>;
} {
  const normalized = normalizeForIntent(userMessage);
  const strong = new Set<ToolDomain>();
  const weak = new Set<ToolDomain>();
  if (!normalized) return { strong, weak };

  const scan = (domain: ToolDomain, strength: IntentStrength, keywords: readonly string[]): void => {
    for (const keyword of keywords) {
      const token = normalizeForIntent(keyword);
      if (!token) continue;
      let from = 0;
      while (from < normalized.length) {
        const index = normalized.indexOf(token, from);
        if (index < 0) break;
        const end = index + token.length;
        if (!keywordNegated(normalized, index, end)) {
          if (strength === "strong") strong.add(domain);
          else weak.add(domain);
          break;
        }
        from = end;
      }
    }
  };

  for (const [domain, keywords] of Object.entries(INTENT_KEYWORDS) as [ToolDomain, { strong: readonly string[]; weak: readonly string[] }][]) {
    scan(domain, "strong", keywords.strong);
    scan(domain, "weak", keywords.weak);
  }

  if (strong.has("battle") && (normalized.includes("적") || normalized.includes("몬스터") || normalized.includes("enemy") || normalized.includes("troop") || normalized.includes("트룹"))) {
    strong.add("database");
  }

  // 수정 요청은 대상 명사가 없어도 편집 툴이 손에 잡혀야 한다 — 실측: "여기 좀 고쳐줘" 는
  // tile 도메인이 열리지 않아 tile_erase/fill_region 이 노출에서 빠졌다(진단 근본원인 4).
  // weak 로 여는 이유: 도메인을 강하게 켜면 상한(40) 트림에서 실제 주제 도메인을 밀어낸다.
  if (requestLikelyModifiesExisting(userMessage)) {
    weak.add("tile");
    weak.add("map");
    weak.add("event");
  }

  for (const domain of strong) weak.delete(domain);
  return { strong, weak };
}

export function beginAssistantToolDomainTurn(userMessage: string): void {
  if (hasResetTrigger(userMessage)) {
    recentDomains.clear();
    return;
  }
  for (const [domain, ttl] of [...recentDomains]) {
    const next = ttl - 1;
    if (next < 0) recentDomains.delete(domain);
    else recentDomains.set(domain, next);
  }
}

export function recordAssistantToolDomainUse(domains: readonly ToolDomain[] | undefined): void {
  for (const domain of domains ?? []) {
    if (domain === "core") continue;
    recentDomains.set(domain, RECENT_DOMAIN_TTL);
  }
}

export function resetAssistantToolDomainMemory(): void {
  recentDomains.clear();
}

export function computeActiveToolDomains(userMessage: string): Set<ToolDomain> {
  const domains = new Set<ToolDomain>(["core"]);
  const reasons = new Map<ToolDomain, Set<ToolDomainReason>>();
  addReason(reasons, "core", "core");

  const uiDomain = computeAssistantToolMode();
  domains.add(uiDomain);
  addReason(reasons, uiDomain, "ui");

  const intent = findIntentDomains(userMessage);
  for (const domain of intent.strong) {
    domains.add(domain);
    addReason(reasons, domain, "intent-strong");
  }
  for (const domain of intent.weak) {
    domains.add(domain);
    addReason(reasons, domain, "intent-weak");
  }
  for (const domain of recentDomains.keys()) {
    domains.add(domain);
    addReason(reasons, domain, "recent");
  }

  activeInfoBySet.set(domains, {
    uiDomain,
    strongIntentDomains: new Set(intent.strong),
    weakIntentDomains: new Set(intent.weak),
    recentDomains: new Set(recentDomains.keys()),
    reasons,
  });
  return domains;
}

export function getActiveToolDomainInfo(domains: ReadonlySet<ToolDomain>): ActiveToolDomainInfo | undefined {
  return activeInfoBySet.get(domains);
}

export function describeActiveToolDomains(domains: ReadonlySet<ToolDomain>): string {
  const info = getActiveToolDomainInfo(domains);
  if (!info) return "활성 도메인";
  const labels = new Map<ToolDomainReason, string>([
    ["core", "기본"],
    ["ui", "UI"],
    ["intent-strong", "의도"],
    ["intent-weak", "약한 의도"],
    ["recent", "최근 툴"],
  ]);
  return [...domains]
    .filter((domain) => domain !== "core")
    .map((domain) => {
      const reason = [...(info.reasons.get(domain) ?? [])].map((item) => labels.get(item) ?? item).join("+");
      return `${TOOL_MODE_LABELS[domain]}(${reason})`;
    })
    .join(" · ") || "코어만";
}

// 모드 배지 라벨(§2.2.3) — dock 헤더가 소비한다.
export const TOOL_MODE_LABELS: Readonly<Record<ToolDomain, string>> = {
  core: "코어",
  tile: "🀫 타일",
  map: "🗺 맵",
  event: "⚑ 이벤트",
  database: "🗃 DB",
  world: "🌍 월드",
  quest: "📜 퀘스트",
  battle: "⚔ 전투",
  system: "⚙ 시스템",
};
