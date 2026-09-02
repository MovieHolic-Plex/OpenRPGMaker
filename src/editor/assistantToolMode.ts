// editor/assistantToolMode.ts
// 컨텍스트 모드 결정(2026-07-07 타일 시공 흐름 재설계 §2.2.2 — 원칙 0).
// AI 어시스턴트에 노출할 툴 집합(toOpenAiTools({mode}))의 mode를 **UI 상태에서만**
// 결정론으로 계산한다 — 모델 판단 금지. 우선순위:
//   1. DB 모달 열림           → "database"
//   2. 이벤트 에디터 열림      → "event"
//   3. 이벤트 레이어/도구 활성 → "event"
//   4. 타일 팔레트 활성(좌측 팔레트 보임 + 타일 레이어 편집) → "tile"
//   5. 판정 불가/일반          → "map" (기본, 넓게)
//
// 활성 도메인 = 코어 + UI 도메인 + **의도 선언이 여는 도메인** + 최근 쓴 툴의 도메인.
// 예전에는 여기 221개 키워드 표(INTENT_KEYWORDS)가 사용자 문장을 substring 으로 훑어 도메인을 열었다 —
// 「낮게」가 시간 시스템을, 「적게」가 전투·DB 를, 「이 지역에」가 월드 그래프를 열었다(2026-09-03 감사).
// 이제 문장은 모델이 한 번 읽어 선언하고(intentDeclaration), 이 모듈은 선언 필드를 도메인으로 옮기기만 한다.

import { intentToolDomains, type IntentDeclaration } from "@/ai/intentDeclaration";
import { editorState } from "@/editor/editorState";
import type { ToolDomain } from "@/editor/tools";
import { getTool } from "@/editor/tools/toolRegistry";

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

export type ToolDomainReason = "core" | "ui" | "intent" | "recent";

export interface ActiveToolDomainInfo {
  readonly uiDomain: ToolDomain;
  readonly intentDomains: ReadonlySet<ToolDomain>;
  readonly recentDomains: ReadonlySet<ToolDomain>;
  readonly reasons: ReadonlyMap<ToolDomain, ReadonlySet<ToolDomainReason>>;
}

const RECENT_DOMAIN_TTL = 2;
const recentDomains = new Map<ToolDomain, number>();
const activeInfoBySet = new WeakMap<ReadonlySet<ToolDomain>, ActiveToolDomainInfo>();

function addReason(map: Map<ToolDomain, Set<ToolDomainReason>>, domain: ToolDomain, reason: ToolDomainReason): void {
  const reasons = map.get(domain) ?? new Set<ToolDomainReason>();
  reasons.add(reason);
  map.set(domain, reasons);
}

/**
 * 턴 시작: 선언이 「새 작업/처음부터」라고 했으면 최근 도메인 기억을 비우고, 아니면 TTL 을 하나 줄인다.
 * 옛 구현은 「이제 맵」「그만하」 같은 앵커 정규식으로 주제 전환을 추측했다.
 */
export function beginAssistantToolDomainTurn(intent: IntentDeclaration | null): void {
  if (intent?.resetsContext) {
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

export function computeActiveToolDomains(intent: IntentDeclaration | null): Set<ToolDomain> {
  const domains = new Set<ToolDomain>(["core"]);
  const reasons = new Map<ToolDomain, Set<ToolDomainReason>>();
  addReason(reasons, "core", "core");

  const uiDomain = computeAssistantToolMode();
  domains.add(uiDomain);
  addReason(reasons, uiDomain, "ui");

  const fromIntent = intent ? intentToolDomains(intent, (name) => getTool(name)?.domains) : new Set<ToolDomain>();
  for (const domain of fromIntent) {
    domains.add(domain);
    addReason(reasons, domain, "intent");
  }
  for (const domain of recentDomains.keys()) {
    domains.add(domain);
    addReason(reasons, domain, "recent");
  }

  activeInfoBySet.set(domains, {
    uiDomain,
    intentDomains: fromIntent,
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
    ["intent", "의도"],
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
