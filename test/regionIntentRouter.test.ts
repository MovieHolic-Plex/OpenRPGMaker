import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REGION_INTENT_KEYWORDS,
  regionIntentGuideLines,
  routeRegionIntent,
  type RegionIntentCategory,
} from "@/editor/regionTask/regionIntentRouter";
import { buildRegionTaskMessage } from "@/editor/regionTask/runRegionTask";

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

  it("매치 없는 지시는 기본 가이드만 (place_chest 미포함)", () => {
    const message = buildRegionTaskMessage("이 영역을 잔디로 채워줘", "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
    expect(message).not.toContain("place_chest");
    expect(message).toContain("build_house_kit"); // 기본 가이드 유지
  });
});
