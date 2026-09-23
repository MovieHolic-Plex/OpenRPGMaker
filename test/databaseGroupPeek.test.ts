// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { TAB_GROUPS } from "@/editor/panels/database";

/**
 * 데이터베이스 탭 레일은 모든 그룹을 펼친 구획으로 둔다(2026-09-24 개선안 C). 예전 아코디언은
 * 한 그룹만 열어서 «구조물» 탭이 사라진 줄 알았다는 보고를 받았고, 접힌 머리에 부제를 달아
 * 답했지만 부제는 늘 잘렸다. 이제 탭이 숨는 경우는 **레코드 0 인 목록 탭** 하나뿐이고, 그 탭들은
 * 그룹마다 「빈 탭 N개」 줄(`.db-tab-fold`)에 이름이 적힌다. 이 테스트는 그 구조를 고정한다.
 */

const CSS = readFileSync(resolve(__dirname, "../src/styles/database/sidebar.css"), "utf8");

describe("그룹 구획과 빈 탭 접기", () => {
  it("맵 그룹의 탭 구성", () => {
    const world = TAB_GROUPS.find((group) => group.slug === "world");
    expect(world, "맵 그룹이 사라졌다").toBeTruthy();
    expect(world?.label).toBe("맵");
    expect(world!.tabs).toEqual(["spatialTiles", "spatialObjects", "spatialPlaces", "spatialRegions", "spatialWorlds"]);
  });

  it("세계관 그룹이 레일 맨 앞에 있다", () => {
    expect(TAB_GROUPS[0]?.slug).toBe("lore");
    expect(TAB_GROUPS[0]?.tabs).toEqual(["worldCanon", "worldCodex"]);
  });

  it("모든 탭이 정확히 한 그룹에 속한다 — 어느 그룹에도 없는 탭은 닿을 수 없다", () => {
    const seen = new Map<string, number>();
    for (const group of TAB_GROUPS) {
      for (const tab of group.tabs) seen.set(tab, (seen.get(tab) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1);
    expect(duplicated, `두 그룹에 걸친 탭: ${JSON.stringify(duplicated)}`).toEqual([]);
  });

  it("빈 탭 줄이 스타일을 갖는다 — 클래스만 붙고 안 보이면 없는 것과 같다", () => {
    expect(CSS).toMatch(/\.db-tab-fold\s*\{/);
    expect(CSS).toMatch(/\.db-tab-fold-names\s*\{/);
    expect(CSS).toMatch(/\.db-tab-group-label\s*\{/);
  });

  it("그룹 머리에 셰브론·합계 배지가 없다 — 접고 펴지 않으므로 셰브론은 거짓말이다", () => {
    expect(CSS).not.toMatch(/\.db-tab-group::after/);
    expect(CSS).not.toMatch(/data-tab-count/);
    expect(CSS).not.toMatch(/\.db-tab-group-peek/);
  });
});
