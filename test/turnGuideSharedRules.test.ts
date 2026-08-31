import { describe, expect, it } from "vitest";

import { buildTurnGuide } from "@/ai/turnGuide";
import { buildRegionTaskMessage } from "@/editor/regionTask/runRegionTask";
import type { MapId } from "@/project/types";

/**
 * PR #378 의 관찰: 도구 규칙(재료 라벨·소품/보물상자 구분·shape=circle 등)이 **영역 작업 전용**
 * 경로에만 있었다. 그래서 선택 영역 없이 조수에게 같은 말을 하면 같은 요청이 다른 규칙을 받았고,
 * 가방 그룹을 재료로 쓰거나 장식 나무상자를 place_chest 로 놓거나 원형 호수를 네모로 채우는
 * 실수가 조수 쪽에서만 반복됐다.
 *
 * #378 자체는 base 가 319커밋 뒤라 그대로 병합하면 영역작업 하위 시스템 31파일을 지운다. 그래서
 * 통합 «의견» 만 살렸다 — 가이드를 buildTurnGuide 한 곳에서 만들고, 스코프(선택 사각형)는 엔진이
 * 아니라 인자로 넘긴다.
 *
 * 이 테스트가 지키는 계약: **스코프가 없어도 재료·도구 규칙은 그대로 붙는다.** 스코프가 있을 때만
 * 사각형 제약이 더 붙는다.
 */
describe("도구 규칙은 선택 영역 없이도 붙는다", () => {
  const mapId = "map-1" as MapId;
  const region = { x: 2, y: 3, width: 12, height: 9 } as const;

  /** 선택 여부와 무관하게 지켜야 하는 규칙들 — 각각 실제 오작동에서 나왔다. */
  const ALWAYS = [
    { name: "장식 상자는 place_props (place_chest 금지)", probe: /place_props \{ material: "나무 상자"/ },
    { name: "보물상자와 보관상자 구분", probe: /place_storage_chest/ },
    { name: "원형은 shape=circle 필수", probe: /shape=circle/ },
    { name: "그룹 id 를 재료로 쓰지 말 것", probe: /그룹 id/ },
    { name: "길은 paint_road", probe: /paint_road/ },
    { name: "승인 후에만 반영", probe: /승인 후에만 반영/ },
  ];

  for (const { name, probe } of ALWAYS) {
    it(`스코프 없어도 유지: ${name}`, () => {
      const guide = buildTurnGuide({ instruction: "나무 상자 놓고 호수 만들어줘", scope: null });
      expect(guide).toMatch(probe);
    });
  }

  it("스코프가 없으면 «영역 밖 금지» 문구는 붙지 않는다", () => {
    const withScope = buildTurnGuide({ instruction: "나무 심어줘", scope: { mapId, region } });
    const noScope = buildTurnGuide({ instruction: "나무 심어줘", scope: null });
    expect(withScope).toMatch(/영역 밖/);
    expect(noScope).not.toMatch(/영역 밖/);
  });

  it("스코프가 있으면 tile_query 에 그 mapId 가 박힌다", () => {
    // 스코프가 없으면 «대상 맵» 이라고만 말하고, 있으면 그 맵 id 를 박아 오조회를 막는다.
    // (실측 배경: 기본값이 야외 타입셋이라 실내 맵에서 «가로 탁자» 를 엉버짜게 조회했다.)
    const withScope = buildTurnGuide({ instruction: "나무 심어줘", scope: { mapId, region } });
    expect(withScope).toContain(`mapId:"${mapId}"`);
    const noScope = buildTurnGuide({ instruction: "나무 심어줘", scope: null });
    expect(noScope).not.toContain(`mapId:"${mapId}"`);
    expect(noScope).toMatch(/tile_query/);
  });

  it("영역 작업 메시지는 같은 규칙을 그대로 쓴다 — 두 경로가 갈라지지 않는다", () => {
    const instruction = "나무 상자 놓고 호수 만들어줘";
    const full = buildRegionTaskMessage(instruction, "테스트 맵", mapId, region);
    const guide = buildTurnGuide({ instruction, scope: { mapId, region } });
    const rules = (text: string): string[] => text.split("\n").filter((l) => l.startsWith("- "));

    const a = rules(full);
    const b = rules(guide);
    expect(b.length).toBeGreaterThan(6);
    // 영역 작업 메시지의 규칙 줄은 가이드가 만든 것과 완전히 같아야 한다. 하나라도 다르면
    // 두 경로가 다시 갈라진 것이다.
    expect(a).toEqual(b);
  });
});
