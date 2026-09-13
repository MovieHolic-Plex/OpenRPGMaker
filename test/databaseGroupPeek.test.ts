// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { TAB_GROUPS } from "@/editor/panels/database";

/**
 * 데이터베이스 탭 레일은 **한 번에 그룹 하나만** 펼친다(`database.ts` 의 `openOnlyGroup`).
 * 탭이 37개인데 보이는 것은 6개뿐이라, 헤더에 그룹 이름만 있으면 쓰는 사람은 나머지가 사라진
 * 줄 안다 — 실제로 «구조물» 탭이 없어졌다는 보고를 받았다. 원인은 「세계」 그룹이 접혀 있어
 * 그 안의 타일셋·구조물·지형·공용이벤트 버튼이 전부 `hidden` 이었던 것이다.
 *
 * 그래서 접힌 동안에만 속한 탭 이름을 헤더 부제로 보여 어디를 눌러야 하는지 답한다.
 * 이 테스트는 그 부제가 **모든 그룹에 대해 실제 탭 이름을 담는지**를 고정한다.
 */

const CSS = readFileSync(resolve(__dirname, "../src/styles/database/sidebar.css"), "utf8");

describe("접힌 그룹 헤더 부제", () => {
  it("맵은 두 주 진입점을 부제로 보여 준다", () => {
    const world = TAB_GROUPS.find((group) => group.slug === "world");
    expect(world, "맵 그룹이 사라졌다").toBeTruthy();
    expect(world?.label).toBe("맵");
    expect(world!.tabs).toEqual(["spatialTiles", "spatialObjects", "spatialPlaces", "spatialRegions", "spatialWorlds"]);
  });

  it("세계관 그룹이 레일 맨 앞에 있다", () => {
    expect(TAB_GROUPS[0]?.slug).toBe("lore");
    expect(TAB_GROUPS[0]?.tabs).toEqual(["worldCanon", "worldCodex"]);
  });

  it("모든 탭이 정확히 한 그룹에 속한다 — 어느 그룹도 안 여는 탭은 닿을 수 없다", () => {
    const seen = new Map<string, number>();
    for (const group of TAB_GROUPS) {
      for (const tab of group.tabs) seen.set(tab, (seen.get(tab) ?? 0) + 1);
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1);
    expect(duplicated, `두 그룹에 걸친 탭: ${JSON.stringify(duplicated)}`).toEqual([]);
  });

  it("부제 요소가 스타일을 갖는다 — 클래스만 붙고 안 보이면 없는 것과 같다", () => {
    expect(CSS).toMatch(/\.db-tab-group-peek\s*\{/);
    expect(CSS).toMatch(/\.db-tab-group-label\s*\{/);
  });

  it("헤더가 줄바꿈을 허용한다 — nowrap 이면 부제가 잘려 한 글자도 안 보인다", () => {
    const headerBlock = /\.db-tab-group \{[^}]*\}/g;
    const blocks = CSS.match(headerBlock) ?? [];
    expect(blocks.some((block) => block.includes("flex-wrap: wrap"))).toBe(true);
  });

  it("부제는 그룹 라벨과 다른 글자 크기다 — 같으면 탭 이름으로 오인한다", () => {
    const peek = /\.db-tab-group-peek \{[^}]*\}/.exec(CSS)?.[0] ?? "";
    // v2(2026-09-03): 11px. 10px 은 모달 안 유일한 11px 미달 글자였다. 그룹 라벨은 12px/600.
    expect(peek).toMatch(/font:\s*400 11px/);
  });
});
