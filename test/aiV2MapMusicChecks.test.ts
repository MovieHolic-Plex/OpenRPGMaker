import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { mapMusicVarietyProblems } from "@/ai/v2/mapMusicChecks";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { v2ExtraToolNames } from "@/ai/v2/game";
import type { Project } from "@/project/types";

const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";

/** 이벤트가 있는 지은 맵 n장을 만든다 — bgms[i] 가 있으면 그 곡을 건다(없으면 상속·기본). */
function mapsProject(n: number, bgms: (string | undefined)[] = []): Project {
  const p = createBlankProject() as Project;
  const start = p.maps[p.startMapId]!;
  const ev = structuredClone(start.events[0] ?? ({ id: "ev", name: "사람", x: 3, y: 3, pages: [{ conditions: [], trigger: { kind: "action" }, commands: [] }] } as never));
  for (let i = 0; i < n; i += 1) {
    const id = `map_story_${i}`;
    const map = structuredClone(start);
    map.id = id; map.name = `이야기 맵 ${i}`;
    map.events = [{ ...structuredClone(ev), id: `ev_${i}`, name: `일 ${i}` } as never];
    if (bgms[i]) map.bgm = { mode: "custom", resourceId: bgms[i]! } as never;
    p.maps[id] = map;
  }
  return p;
}

describe("v2 map music variety check (fs-use-tools H5)", () => {
  it("flags three story maps that all play one track, and clears once a map plays another", () => {
    const flat = mapsProject(3, ["cc0-bgm-field", "cc0-bgm-field", "cc0-bgm-field"]);
    expect(mapMusicVarietyProblems(flat)).toHaveLength(1);
    expect(mapMusicVarietyProblems(mapsProject(3, ["cc0-bgm-field", "cc0-bgm-field", "cc0-bgm-dungeon"]))).toEqual([]);
  });

  it("counts maps that inherit the project default as one track", () => {
    expect(mapMusicVarietyProblems(mapsProject(3))).toHaveLength(1);
  });

  it("does not fire for one or two maps", () => {
    expect(mapMusicVarietyProblems(mapsProject(2, ["cc0-bgm-field", "cc0-bgm-field"]))).toEqual([]);
    expect(mapMusicVarietyProblems(mapsProject(1))).toEqual([]);
  });

  it("reaches the finish gate for a whole-game request, not for a music request or a small edit", () => {
    const after = mapsProject(3, ["cc0-bgm-field", "cc0-bgm-field", "cc0-bgm-field"]);
    const before = createBlankProject() as Project;
    const hit = (task: string) => gameContentProblems(before, after, task).some((m) => m.startsWith("[게임 검사 음악 다양성]"));
    expect(hit(WHOLE)).toBe(true);
    expect(hit("촌장 대사를 바꿔 줘")).toBe(false);
    expect(hit(`${WHOLE}. 마을은 잔잔한 음악으로 해줘`)).toBe(false);
  });
});

describe("v2 whole-game tool exposure (fs-use-tools H5)", () => {
  it("offers recommend_bgm and set_game_audio for a game request that never says music", () => {
    const names = v2ExtraToolNames("귀여운 고양이가 주인공인 탐험 게임 만들어줘");
    expect(names).toContain("recommend_bgm");
    expect(names).toContain("set_game_audio");
  });
  it("does not offer them for a small edit", () => {
    expect(v2ExtraToolNames("촌장 대사를 바꿔 줘")).not.toContain("set_game_audio");
  });
});
