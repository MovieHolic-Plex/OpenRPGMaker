// find_tools 가 방금 생긴 저작 도구 대신 더 넓은 옛 도구를 집던 것.
// 「파티」 별칭이 set_party 에 보너스를 주고, 「설원」 별칭이 마을 구성기를 집어 「파티 분할」「설원 길」이 정본 도구에서 밀렸다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function ranked(query: string): string[] {
  const result = runTool({ project: createBlankProject() }, "find_tools", { query });
  expect(result.ok, result.summary).toBe(true);
  return (result.data as { matches: { name: string }[] }).matches.map((match) => match.name);
}

/** winner 가 결과 안에 있고, loser 보다 앞이거나 loser 가 상위 6에 없다. */
function ahead(query: string, winner: string, loser: string): void {
  const names = ranked(query);
  const winAt = names.indexOf(winner);
  const loseAt = names.indexOf(loser);
  expect(winAt, `${query} → ${names.join(", ")}`).toBeGreaterThanOrEqual(0);
  expect(loseAt === -1 || winAt < loseAt, `${query}: ${winner} should rank above ${loser} in ${names.join(", ")}`).toBe(true);
}

describe("find_tools routes recently added authoring tools", () => {
  it("맵을 나눠 걷는 파티 분할은 author_party_split 이고, 파티 구성·팀 교대는 set_party 다", () => {
    ahead("파티 분할", "author_party_split", "set_party");
    ahead("split party", "author_party_split", "set_party");
    ahead("파티", "set_party", "author_party_split");
    ahead("3팀", "set_party", "author_party_split");
    ahead("팀 교대", "set_party", "author_party_split");
  });

  it("설원 고갯길은 author_snow_route 이고, 눈 마을은 설원 구성기다", () => {
    ahead("설원 길", "author_snow_route", "compose_snow_north_map");
    ahead("고갯길", "author_snow_route", "compose_snow_north_map");
    ahead("눈보라", "author_snow_route", "compose_snow_north_map");
    ahead("눈 마을", "compose_snow_north_map", "author_snow_route");
  });

  it("이야기 일지와 제한 시간 탈출은 그 도구가 첫 결과다", () => {
    expect(ranked("이야기 일지")[0]).toBe("configure_story_journal");
    expect(ranked("일지")[0]).toBe("configure_story_journal");
    expect(ranked("제한 시간 탈출")[0]).toBe("make_timed_escape");
    expect(ranked("무너지는 얼음")[0]).toBe("make_timed_escape");
    expect(ranked("갈라지는 바닥")[0]).toBe("make_timed_escape");
  });
});
