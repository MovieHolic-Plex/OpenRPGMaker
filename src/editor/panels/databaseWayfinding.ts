// 자료집 길찾기 — 탭 이름으로는 못 찾는 구획·설정 낱말, 헤더 3단 크럼의 구획 이름, 최근 연 탭.
//
// 이 파일은 데이터와 작은 상태만 가진다(DOM 없음). 탭 id·그룹 구성·저장 데이터는 건드리지 않는다.
// 도착지는 이미 있는 화면(탭 + 시스템 구획 + 카드)을 가리킬 뿐이고, 새 화면을 만들지 않는다.
import type { DatabaseTab } from "@/editor/panels/database";
import type { SystemSectionSlug } from "@/editor/panels/databaseSystemView";

export type DatabaseSearchDestination = {
  readonly id: string;
  readonly tab: DatabaseTab;
  /** 레일 검색 결과에 보이는 구획·설정 이름. 크럼의 세 번째 칸과 같은 낱말을 쓴다. */
  readonly section: string;
  /** 부분 일치(소문자). 탭 이름·그룹 이름은 기존 검색이 이미 처리하므로 여기엔 구획 안의 낱말만 둔다. */
  readonly keywords: readonly string[];
  /** 시스템 탭 안의 구획 — 착지 때 requestSystemSection 으로 연다. */
  readonly systemSection?: SystemSectionSlug;
  /** 착지 뒤 화면에 끌어 올 카드(data-testid). 시스템 구획처럼 따로 열리지 않는 한 화면 탭용. */
  readonly scrollTestId?: string;
};

// 낱말은 실제 화면에서 확인한 것만 둔다(2026-10-17, 시스템 구획 제목·fieldset 이름·메뉴·시스템 카드).
// 영어 낱말은 기존 접두 검색(retro·act·worldGen)과 겹치지 않는 것만.
export const DATABASE_SEARCH_DESTINATIONS: readonly DatabaseSearchDestination[] = [
  { id: "system-party", tab: "system", section: "초기 파티", systemSection: "party", keywords: ["시작 파티", "시작 멤버", "파티 순서"] },
  { id: "system-display", tab: "system", section: "화면", systemSection: "display", keywords: ["화면 크기", "해상도", "화면 필터", "카메라 배율"] },
  { id: "system-menu", tab: "system", section: "게임 메뉴", systemSection: "menu", keywords: ["esc", "메뉴 디자인", "메뉴 스킨"] },
  { id: "system-dialogue", tab: "system", section: "대화창", systemSection: "dialogue", keywords: ["대사", "대사창", "대화", "말풍선", "글자 소리", "이름표"] },
  { id: "system-hud", tab: "system", section: "인게임 HUD", systemSection: "hud", keywords: ["hud", "체력바", "인게임", "화면 표시"] },
  { id: "system-font", tab: "system", section: "폰트", systemSection: "font", keywords: ["글꼴", "글자 크기", "font"] },
  { id: "system-resources", tab: "system", section: "리소스", systemSection: "resources", keywords: ["공유 그래픽", "시스템 그래픽", "타이틀 그림"] },
  { id: "system-startup", tab: "system", section: "시작 설정", systemSection: "startup", keywords: ["초기 적", "전투 흐름", "참전", "도주", "전투 오디오", "기본 소리", "보상", "난이도", "몬스터 합성", "갤러리"] },
  { id: "system-optin", tab: "system", section: "기능 확장", systemSection: "optin", keywords: ["선택 기능", "생활 기능", "몬스터 돌봄"] },
  { id: "system-time", tab: "system", section: "시간", systemSection: "time", keywords: ["달력", "시계", "계절 길이", "하루 종료"] },
  { id: "system-typechart", tab: "system", section: "타입 상성", systemSection: "typechart", keywords: ["상성", "배율", "방어 타입", "공격 타입"] },
  { id: "system-title", tab: "system", section: "타이틀", systemSection: "title", keywords: ["타이틀", "타이틀 화면", "시작 화면", "새 게임", "이어하기", "자동 저장", "오프닝 효과", "시작 메뉴"] },
  { id: "menu-system-menu", tab: "menuSystem", section: "ESC 메뉴 항목", scrollTestId: "db-menu-system-menu-card", keywords: ["esc", "메뉴 항목", "항목 추가"] },
  { id: "menu-system-dialogue", tab: "menuSystem", section: "대사창 읽기 도구", scrollTestId: "db-menu-system-dialogue-card", keywords: ["대사", "백로그", "오토", "스킵", "읽기 도구", "숨기기"] },
  { id: "menu-system-look", tab: "menuSystem", section: "대사창 룩", scrollTestId: "db-menu-system-look-card", keywords: ["룩", "프리셋", "대사창 모양", "말풍선 모양"] },
  { id: "menu-system-extras", tab: "menuSystem", section: "갤러리 · 엔딩 목록 · 저장 카드", scrollTestId: "db-menu-system-extras-card", keywords: ["엔딩", "엔딩 목록", "갤러리", "저장", "저장 칸", "저장 카드", "세이브"] },
  { id: "characters-affinity", tab: "characters", section: "호감도 · 선물 기록", keywords: ["호감", "호감도", "선물", "관계도"] },
  { id: "opening-scenes", tab: "opening", section: "오프닝 장면", keywords: ["장면 시퀀스", "장면 순서", "장면 추가", "새 게임 시작"] },
  { id: "game-over-screen", tab: "gameOver", section: "게임 오버 화면", keywords: ["패배", "패배 후 처리", "암전"] },
  // 시작 위치는 자료집에서 고치는 값이 아니다(맵 속성). 개요가 지금 값을 보여 주므로 거기로 데려간다.
  { id: "overview-start", tab: "overview", section: "시작 지점 확인", keywords: ["시작 위치", "시작 지점", "시작 맵", "시작점"] },
];

/** 최소 글자 수 — 한 글자 검색은 거의 모든 구획에 걸려 길찾기가 아니라 소음이 된다. */
const MIN_QUERY_LENGTH = 2;
export const MAX_SEARCH_DESTINATIONS = 6;

/** 구획·설정 낱말 검색. 낱말이 정확히 같으면 먼저, 앞이 같으면 다음, 포함은 마지막. 같은 순위는 표 순서. */
export function matchSearchDestinations(rawQuery: string, limit = MAX_SEARCH_DESTINATIONS): DatabaseSearchDestination[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < MIN_QUERY_LENGTH) return [];
  const ranked: { readonly destination: DatabaseSearchDestination; readonly rank: number; readonly index: number }[] = [];
  DATABASE_SEARCH_DESTINATIONS.forEach((destination, index) => {
    const names = [destination.section.toLowerCase(), ...destination.keywords];
    let best = Number.POSITIVE_INFINITY;
    for (const name of names) {
      if (name === query) best = Math.min(best, 0);
      else if (name.startsWith(query)) best = Math.min(best, 1);
      else if (name.includes(query)) best = Math.min(best, 2);
    }
    if (Number.isFinite(best)) ranked.push({ destination, rank: best, index });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((entry) => entry.destination);
}

// ── 크럼의 세 번째 칸 ─────────────────────────────────────────────────────────────
// 구획을 가진 탭(지금은 시스템 탭)이 보고 있는 구획 이름을 적는다. 활성 탭이 바뀌면 그 탭의 것만 읽힌다.
type SubLocation = { readonly tab: DatabaseTab; readonly label: string };
let subLocation: SubLocation | null = null;
const subLocationListeners = new Set<() => void>();

export function setDatabaseSubLocation(tab: DatabaseTab, label: string | null): void {
  const next = label ? { tab, label } : null;
  if (subLocation?.tab === next?.tab && subLocation?.label === next?.label) return;
  subLocation = next;
  for (const listener of subLocationListeners) listener();
}

export function getDatabaseSubLocation(tab: DatabaseTab): string | null {
  return subLocation && subLocation.tab === tab ? subLocation.label : null;
}

export function subscribeDatabaseSubLocation(listener: () => void): () => void {
  subLocationListeners.add(listener);
  return () => {
    subLocationListeners.delete(listener);
  };
}

// ── 최근 연 탭 ─────────────────────────────────────────────────────────────────────
// 프로젝트와 무관한 편집기 습관이라 localStorage 에만 둔다(저장 데이터·프로젝트 파일에 안 들어간다).
export const DATABASE_RECENT_TABS_KEY = "oprn:database.recentTabs";
/** 지금 보는 탭을 빼고도 3개가 남도록 4개를 기억한다. */
const RECENT_TABS_STORED = 4;
export const RECENT_TABS_SHOWN = 3;

let recentTabs: string[] | null = null;

function loadRecentTabs(): string[] {
  if (recentTabs) return recentTabs;
  recentTabs = [];
  if (typeof window === "undefined") return recentTabs;
  try {
    const raw = window.localStorage.getItem(DATABASE_RECENT_TABS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const id of parsed) if (typeof id === "string" && !recentTabs.includes(id)) recentTabs.push(id);
    }
  } catch {
    // 읽기 실패는 「최근 없음」 으로 둔다.
  }
  recentTabs = recentTabs.slice(0, RECENT_TABS_STORED);
  return recentTabs;
}

/** 방금 연 탭을 맨 앞으로. 개요는 레일 맨 위에 늘 있으므로 적지 않는다. */
export function recordRecentDatabaseTab(tab: DatabaseTab): void {
  if (tab === "overview") return;
  const next = [tab as string, ...loadRecentTabs().filter((id) => id !== tab)].slice(0, RECENT_TABS_STORED);
  recentTabs = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATABASE_RECENT_TABS_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패해도 이번 세션의 기록은 메모리에 남는다.
  }
}

/** 최근 연 순서로, 지금 보는 탭과 더는 없는 탭 id 를 뺀 목록. */
export function recentDatabaseTabs(current: DatabaseTab, isKnownTab: (id: string) => boolean): DatabaseTab[] {
  return loadRecentTabs()
    .filter((id) => id !== current && isKnownTab(id))
    .slice(0, RECENT_TABS_SHOWN) as DatabaseTab[];
}

/** 테스트·프로젝트 전환 후에도 같은 모듈 상태를 되돌릴 때 쓴다(저장소는 건드리지 않는다). */
export function resetDatabaseWayfindingMemory(): void {
  recentTabs = null;
  subLocation = null;
}
