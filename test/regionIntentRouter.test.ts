import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REGION_INTENT_KEYWORDS,
  regionIntentGuideLines,
  routeRegionIntent,
  type RegionIntentCategory,
} from "@/editor/regionTask/regionIntentRouter";
import { buildScopedTurnMessage as buildRegionTaskMessage } from "./helpers/scopedTurnMessage";

// 코퍼스 needs → 라우터 카테고리 기대값 매핑. null = 기본 가이드로 충분(기대 없음).
const NEEDS_TO_CATEGORY: Record<string, RegionIntentCategory | null> = {
  "structure-template": "structure",
  "wall-fence": "structure",
  "npc-place": "npc-shop",
  "shop": "npc-shop",
  "npc-schedule": "npc-shop",
  "teleport": "door-transfer",
  "quest-logic": "quest-trigger",
  "story-flag": "quest-trigger",
  "cutscene-script": "quest-trigger",
  "event-logic": "quest-trigger",
  "item-give": "quest-trigger",
  "battle-encounter": "battle-trap",
  "trap": "battle-trap",
  "chase-scene": "battle-trap",
  "lighting-mood": "mood",
  "mirror-symmetry": "transform",
  "repeat-pattern": "transform",
  "clear-region": "transform",
  "move-event": "transform",
  "duplicate-event": "transform",
  "tile-paint": null,
  "prop-scatter": null,
  "road": null,
  "multi-step": null,
  "passability": null,
};

interface CorpusRow { id: string; command: string; needs: string[] }

function loadCorpusRows(): CorpusRow[] {
  const md = readFileSync(
    resolve(__dirname, "../docs/superpowers/research/2026-07-10-region-task-command-corpus.md"),
    "utf8",
  );
  const start = md.indexOf("## 50개 명령어 전체");
  const rows: CorpusRow[] = [];
  for (const line of md.slice(start).split("\n")) {
    if (!line.startsWith("| ") || line.startsWith("| id") || line.startsWith("| ---")) continue;
    const cols = line.split("|").map((col) => col.trim());
    // | id | command | category | needs | feasibility | → cols[1..5]
    if (cols.length < 6) continue;
    rows.push({ id: cols[1], command: cols[2], needs: cols[4].split(",").map((need) => need.trim()) });
  }
  return rows;
}

describe("routeRegionIntent — 코퍼스 50개 전수", () => {
  const rows = loadCorpusRows();

  it("코퍼스 표를 50행 파싱한다", () => {
    expect(rows.length).toBe(50);
  });

  for (const row of rows) {
    const expected = [...new Set(
      row.needs.map((need) => NEEDS_TO_CATEGORY[need] ?? null).filter((category): category is RegionIntentCategory => category !== null),
    )];
    it(`${row.id}: [${expected.join(",") || "기본"}] ⊆ routed`, () => {
      const routed = routeRegionIntent(row.command);
      for (const category of expected) expect(routed).toContain(category);
    });
  }
});

describe("REGION_INTENT_KEYWORDS — 단음절 재유입 방지", () => {
  it("모든 카테고리의 모든 키워드는 길이 2 이상이다(단음절은 무관한 문장에 오탐한다)", () => {
    for (const [category, keywords] of Object.entries(REGION_INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        expect(keyword.length, `${category}: "${keyword}"`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("routeRegionIntent — 오탐 방지 네거티브 케이스", () => {
  it("'전체적으로 예쁘게 꾸며줘'는 battle-trap으로 라우팅되지 않는다", () => {
    expect(routeRegionIntent("전체적으로 예쁘게 꾸며줘")).not.toContain("battle-trap");
  });

  it("'완벽하게 다듬어줘'는 structure로 라우팅되지 않는다", () => {
    expect(routeRegionIntent("완벽하게 다듬어줘")).not.toContain("structure");
  });

  it("'주민에게 주문서에 대해 질문하는 이벤트 만들어줘'는 door-transfer로 라우팅되지 않는다", () => {
    expect(routeRegionIntent("주민에게 주문서에 대해 질문하는 이벤트 만들어줘")).not.toContain("door-transfer");
  });
});

describe("regionIntentGuideLines / buildRegionTaskMessage 통합", () => {
  it("카테고리별 가이드에 대표 도구명이 들어간다", () => {
    const lines = regionIntentGuideLines(["quest-trigger", "transform"]).join("\n");
    expect(lines).toContain("place_chest");
    expect(lines).toContain("place_savepoint");
    expect(lines).toContain("mirror_region");
  });

  it("메시지에 의도 가이드와 정직 지시가 붙는다", () => {
    const message = buildRegionTaskMessage("보물상자를 하나 숨겨줘", "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
    expect(message).toContain("place_chest");
    expect(message).toContain("못 한 것");
  });

  it("매치 없는 지시는 quest-trigger 전용 상호작용 가이드 없이 기본+박스 구분 줄만", () => {
    const message = buildRegionTaskMessage("이 영역을 잔디로 채워줘", "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
    // place_chest는 박스 vs 보물 구분 고정 문구에만 등장 — 상호작용 가이드 블록(place_examine_hotspots 등)은 없음
    expect(message).not.toContain("place_examine_hotspots");
    expect(message).toContain("공식 시공 facade");
    expect(message).toContain("나무 상자");
    expect(message).not.toContain("wood-box");
  });

  it("'박스 2개'는 quest-trigger(place_chest)로 가지 않고 wood-box place_props를 안내한다", () => {
    expect(routeRegionIntent("박스 2개 설치해줘")).not.toContain("quest-trigger");
    const message = buildRegionTaskMessage("박스 2개 설치해줘", "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
    expect(message).toContain("나무 상자");
    expect(message).not.toContain("harness-combined-town-wood-box");
    expect(message).toMatch(/small-props 가방|마을 소품\/small-props/);
    expect(message).toContain("place_chest 금지");
  });

  it("'상자 2개' bare는 더 이상 quest-trigger로 오탐하지 않는다", () => {
    expect(routeRegionIntent("상자 2개")).not.toContain("quest-trigger");
  });

  it("'보물상자'·'상자를 열면'은 quest-trigger로 간다", () => {
    expect(routeRegionIntent("보물상자를 하나 숨겨줘")).toContain("quest-trigger");
    expect(routeRegionIntent("상자를 열면 포션을 주게")).toContain("quest-trigger");
  });

  it("한국어 야외 집·필지·마을은 각각 하나의 공식 시공 루트만 선택한다", () => {
    const single = buildRegionTaskMessage("이 영역에 야외 집 한 채 지어줘", "맵", "m1", { x: 1, y: 2, width: 12, height: 10 });
    expect(single.match(/author_house/g)).toHaveLength(1);
    expect(single).toContain('kind:"single"');
    expect(single).toContain('mapId:"m1"');
    expect(single).toContain("정확히 1채");

    const lots = buildRegionTaskMessage("이 영역에 야외 집 3채 지어줘", "맵", "m1", { x: 1, y: 2, width: 30, height: 20 });
    expect(lots.match(/author_house/g)).toHaveLength(1);
    expect(lots).toContain('kind:"lots"');
    expect(lots).toContain("정확히 3채");

    const village = buildRegionTaskMessage("현재 영역에 집 4채인 마을을 만들어줘", "맵", "m1", { x: 1, y: 2, width: 40, height: 40 });
    expect(village.match(/author_village/g)).toHaveLength(1);
    expect(village).toContain('target:{kind:"existing",mapId:"m1"');
    expect(village).toContain("houseCount:4");
    expect(village).toContain('countPolicy:"exact"');
    expect(village).not.toMatch(/build_house_kit|build_house_lots|build_village|run_village_session|run_village_pipeline/);
  });

  // 수량 표기가 없어도 마을 작업은 "이 맵" 대상이어야 한다 — 옛 구현은 수량 정규식이 걸릴 때만
  // target 을 적어줘서 "이 마을 정리해줘"가 author_village 기본값(새 맵)으로 갔다.
  it("수량 없는 마을 작업도 기존 맵·선택 영역을 못박는다", () => {
    const message = buildRegionTaskMessage("이 마을을 좀 더 아기자기하게 채워줘", "맵", "m1", { x: 3, y: 4, width: 20, height: 16 });
    expect(message).toContain('target:{kind:"existing",mapId:"m1"');
    expect(message).toContain("bounds:{x:3,y:4,w:20,h:16}");
  });
});

describe("영역 작업 — 수정 요청", () => {
  const REGION = { x: 2, y: 3, width: 10, height: 8 };

  it("실내 수정은 새 맵 시공 지시 없이 선택 영역 안으로 제한된다", () => {
    const message = buildRegionTaskMessage("이 침실 가구 배치 좀 고쳐줘", "침실", "map_bedroom", REGION);
    expect(message).not.toContain("새 맵 전체를 시공하라");
    expect(message).toContain("선택 영역 안에서만 수행하라");
    expect(message).toContain("실내 수정");
    expect(message).toContain("furnish_interior_space");
    expect(message).toContain("start_interior_room_session·run_interior_room_pipeline 금지");
  });

  it("실내 신규는 종전처럼 새 맵 시공을 허용한다", () => {
    const message = buildRegionTaskMessage("실내 맵 하나 만들어줘", "마을", "m1", REGION);
    expect(message).toContain("새 맵 전체를 시공하라");
    expect(message).toContain("start_interior_room_session");
  });

  it("수정 요청은 대상 맵을 못박고 시공 facade 시그니처를 붙이지 않는다", () => {
    const message = buildRegionTaskMessage("이 집 외벽 타일 좀 바꿔줘", "마을", "m1", REGION);
    expect(message).toContain("대상 맵 고정");
    expect(message).toContain("`m1`");
    expect(message).toContain("create_map·duplicate_map 으로 새 맵을 만들지 말고");
    expect(message).not.toContain("야외 집 시공");
    expect(message).toContain("선택 영역 안에서만 수행하라");
  });

  it("수정 요청에는 modify 가이드가 먼저 붙고 실내 신축 가이드는 빠진다", () => {
    const routed = routeRegionIntent("이 침실 좀 수정해줘");
    expect(routed[0]).toBe("modify");
    expect(routed).not.toContain("interior");
  });
});
