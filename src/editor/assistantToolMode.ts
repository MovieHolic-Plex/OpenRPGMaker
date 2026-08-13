// editor/assistantToolMode.ts
// 컨텍스트 모드 결정(2026-07-07 타일 시공 흐름 재설계 §2.2.2 — 원칙 0).
// AI 어시스턴트에 노출할 툴 집합(toOpenAiTools({mode}))의 mode를 **UI 상태에서만**
// 결정론으로 계산한다 — 모델 판단 금지. 우선순위:
//   1. DB 모달 열림           → "database"
//   2. 이벤트 에디터 열림      → "event"
//   3. 이벤트 레이어/도구 활성 → "event"
//   4. 타일 팔레트 활성(좌측 팔레트 보임 + 타일 레이어 편집) → "tile"
//   5. 판정 불가/일반          → "map" (기본, 넓게)

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
    strong: ["전투", "배틀", "적", "몬스터", "enemy", "troop", "트룹", "시뮬", "드롭", "hp"],
    weak: ["스킬", "밸런스", "행동"],
  },
  quest: { strong: ["퀘스트", "quest", "플래그", "보상", "목표", "단계", "튜토리얼", "tutorial", "분기", "branch", "반전", "twist", "서사", "story"], weak: [] },
  database: {
    strong: ["아이템", "포션", "물약", "무기", "방어구", "장비", "액터", "캐릭터", "직업", "클래스", "상태이상", "데이터베이스", "데이터 베이스", "db", "능력치"],
    weak: ["스킬", "적"],
  },
  tile: {
    strong: [
      "벽", "길", "타일", "지붕", "문", "바닥", "오토타일", "도로", "페인트",
      "물", "호수", "연못", "강", "수역", "지형", "지면",
      "나무", "소품", "집", "건물", "숲", "꽃", "바위", "산포",
      "실내", "인테리어", "침실", "서재", "주방",
    ],
    weak: [],
  },
  event: { strong: ["이벤트", "npc", "대사", "전송", "스위치", "변수", "트리거", "주민", "튜토리얼", "tutorial", "분기", "branch", "반전", "twist", "서사", "story"], weak: [] },
  world: { strong: ["세계관", "월드", "지역", "관계", "엔티티"], weak: [] },
  system: { strong: ["린트", "타이틀", "시작위치", "시작 위치", "히스토리", "플레이테스트", "품질", "quality", "평가", "evaluate"], weak: [] },
  map: { strong: ["맵", "지도", "마을", "던전", "필드", "실내"], weak: [] },
};

const NEGATION_WORDS = ["말고", "제외", "빼고", "말고서", "아니라"] as const;
const RESET_WORDS = ["이제맵", "다른작업", "초기화", "그만"] as const;
const RECENT_DOMAIN_TTL = 2;
const recentDomains = new Map<ToolDomain, number>();
const activeInfoBySet = new WeakMap<ReadonlySet<ToolDomain>, ActiveToolDomainInfo>();

function normalizeForIntent(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, " ")
    .trim();
}

function compactIntentText(text: string): string {
  return normalizeForIntent(text).replace(/\s+/g, "");
}

function hasResetTrigger(userMessage: string): boolean {
  const normalized = compactIntentText(userMessage);
  return RESET_WORDS.some((word) => normalized.includes(word));
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
  world: "🌍 세계관",
  quest: "📜 퀘스트",
  battle: "⚔ 전투",
  system: "⚙ 시스템",
};
