// test/assistantToolModeModify.test.ts
// 수정 요청의 도메인 활성 — 2026-08-29 modify 진단 근본원인 4·11·12 회귀 가드.

import { beforeEach, describe, expect, it } from "vitest";
import {
  beginAssistantToolDomainTurn,
  computeActiveToolDomains,
  getActiveToolDomainInfo,
  recordAssistantToolDomainUse,
  resetAssistantToolDomainMemory,
} from "@/editor/assistantToolMode";

function footer(mapName: string, mapId = "m1"): string {
  return `\n\n[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (2,3) 10×8`;
}

beforeEach(() => {
  resetAssistantToolDomainMemory();
});

describe("수정 요청은 편집 도메인을 연다", () => {
  // 대상 명사가 없으면 어떤 INTENT_KEYWORDS 도 걸리지 않아 tile_erase/fill_region 이 노출에서 빠졌다.
  it.each([
    "여기 좀 고쳐줘",
    "이거 좀 다듬어줘",
    "방금 깐 거 지워줘",
    "이 배치 좀 조정해줘",
    "여기 좀 정리해줘",
  ])("'%s' 는 tile·map·event 를 weak 로 연다", (message) => {
    const domains = computeActiveToolDomains(message);
    expect(domains.has("tile")).toBe(true);
    expect(domains.has("map")).toBe(true);
    expect(domains.has("event")).toBe(true);
    const info = getActiveToolDomainInfo(domains);
    // weak 여야 한다 — strong 이면 40개 상한 트림에서 실제 주제 도메인을 밀어낸다.
    expect(info?.strongIntentDomains.has("tile")).toBe(false);
    expect(info?.weakIntentDomains.has("tile")).toBe(true);
  });

  it("신규 생성 요청에는 수정 축이 열리지 않는다", () => {
    const info = getActiveToolDomainInfo(computeActiveToolDomains("새 마을 하나 만들어줘"));
    expect(info?.weakIntentDomains.has("event")).toBe(false);
  });
});

describe("컨텍스트 footer 의 맵 이름은 도메인 스캔에서 제외된다", () => {
  // 같은 발화가 맵 이름 때문에 다른 툴 집합을 여는 것은 재현 불가능한 동작이다.
  it.each([
    ["언덕", "호숫가 마을"],
    ["빈 들판", "지하 전투 투기장"],
    ["방 1", "상점 창고"],
  ])("맵 이름 '%s' vs '%s' 는 같은 도메인 집합을 준다", (nameA, nameB) => {
    const a = computeActiveToolDomains(`여기 좀 고쳐줘${footer(nameA)}`);
    resetAssistantToolDomainMemory();
    const b = computeActiveToolDomains(`여기 좀 고쳐줘${footer(nameB)}`);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it("footer 유무도 도메인 집합을 바꾸지 않는다", () => {
    const bare = computeActiveToolDomains("이 벽 좀 고쳐줘");
    resetAssistantToolDomainMemory();
    const withFooter = computeActiveToolDomains(`이 벽 좀 고쳐줘${footer("호숫가 마을")}`);
    expect([...withFooter].sort()).toEqual([...bare].sort());
  });
});

describe("주제 전환 판정 — 부분일치 오탐 제거", () => {
  // 옛 구현은 공백을 전부 지운 문자열에 ["이제맵","다른작업","초기화","그만"] includes 를 걸어
  // 아래 왼쪽 문장들이 모두 도메인 기억을 날렸다.
  const PAIRS: readonly [string, string][] = [
    ["이 맵 상점 재고를 초기화해줘", "이 맵 상점 재고를 리셋해줘"],
    ["그만큼 더 넓혀줘", "이만큼 더 넓혀줘"],
    ["다른 작업 하기 전에 이 벽만 고쳐줘", "이 벽만 고쳐줘"],
    ["이제 맵보다 이벤트를 고쳐줘", "이벤트를 고쳐줘"],
    ["초기화 이벤트 대사를 바꿔줘", "시작 이벤트 대사를 바꿔줘"],
    ["그만 좀 겹치게 옮겨줘", "겹치지 않게 옮겨줘"],
  ];

  it.each(PAIRS)("'%s' 와 '%s' 는 최근 도메인 기억을 똑같이 보존한다", (suspicious, control) => {
    recordAssistantToolDomainUse(["tile", "event"]);
    beginAssistantToolDomainTurn(suspicious);
    const afterSuspicious = [...computeActiveToolDomains(suspicious)].sort();

    resetAssistantToolDomainMemory();
    recordAssistantToolDomainUse(["tile", "event"]);
    beginAssistantToolDomainTurn(control);
    const afterControl = [...computeActiveToolDomains(control)].sort();

    expect(afterSuspicious).toEqual(afterControl);
    expect(afterSuspicious).toContain("tile");
    expect(afterSuspicious).toContain("event");
  });

  it("진짜 주제 전환은 여전히 기억을 비운다", () => {
    recordAssistantToolDomainUse(["battle"]);
    beginAssistantToolDomainTurn("프로젝트 초기화하고 처음부터 다시 갈게");
    const info = getActiveToolDomainInfo(computeActiveToolDomains("프로젝트 초기화하고 처음부터 다시 갈게"));
    expect(info?.recentDomains.has("battle")).toBe(false);
  });
});
