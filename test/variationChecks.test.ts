// 변주 카드의 구조 장치·순서를 끝맺음 관문이 센다 — 카드가 이름 댄 장치가 없거나 걸음 순서(층·날)가 어긋나면 문제를 낸다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { buildWelcomeFreeTextPrompt } from "@/editor/welcomeGenrePresets";
import { gameVariation } from "@/ai/v2/request/world";
import { dayOf, floorOf, variationStructureProblems } from "@/ai/v2/judge/variationChecks";

const HORROR = buildWelcomeFreeTextPrompt("밤의 미술관에 갇힌 아이가 단서를 모아 빠져나가는 공포 게임을 만들어 줘.");
const keyWhere = (pred: (v: NonNullable<ReturnType<typeof gameVariation>["variation"]>) => boolean): string => {
  for (let i = 0; i < 400; i++) {
    const key = JSON.stringify(["project", `variation-check-${i}`]);
    const v = gameVariation(createBlankProject(), key, HORROR).variation;
    if (v && pred(v)) return key;
  }
  throw new Error("no key");
};
const withSteps = (places: readonly string[], actions: readonly string[] = places.map(() => "조사한다")): Project => {
  const p = createBlankProject() as Project;
  return { ...p, gameBlueprint: { version: 1, title: "t", steps: places.map((place, i) => ({ id: `s${i}`, kind: "find", place, event: `e${i}`, who: "", action: actions[i]!, gives: `g${i}`, feeling: "" })) } as never };
};

describe("variationStructureProblems", () => {
  it("reads floors and days from names", () => {
    expect([floorOf("1층 로비"), floorOf("지하 2층 수장고"), floorOf("지하실"), floorOf("미술관")]).toEqual([1, -2, -1, undefined]);
    expect([dayOf("첫째 날 밤"), dayOf("둘째 날"), dayOf("3일째 아침"), dayOf("그날")]).toEqual([1, 2, 3, undefined]);
  });

  it("«층을 내려간다» needs the steps to go down floor by floor", () => {
    const key = keyWhere((v) => v.structure?.order === "descend");
    const before = createBlankProject();
    const up = variationStructureProblems(before, withSteps(["1층 로비", "지하 1층 수장고", "2층 예배당"]), HORROR, key);
    expect(up.some((f) => f.ko.includes("층을 내려가지 않는다"))).toBe(true);
    const down = variationStructureProblems(before, withSteps(["1층 로비", "지하 1층 수장고", "지하 2층 감옥"]), HORROR, key);
    expect(down.some((f) => f.ko.includes("층을 내려가지 않는다"))).toBe(false);
  });

  it("a chase card needs a chaser in the game", () => {
    const key = keyWhere((v) => !!v.structure?.tools?.includes("make_chase_scene"));
    const before = createBlankProject();
    const after = withSteps(["미술관", "지하실", "감옥"]);
    expect(variationStructureProblems(before, after, HORROR, key).some((f) => f.ko.includes("make_chase_scene"))).toBe(true);
    const map = after.maps[after.startMapId]!;
    const chased = { ...after, maps: { ...after.maps, [map.id]: { ...map, events: [...(map.events ?? []), { id: "chaser_x", name: "추격자", x: 1, y: 1, pages: [{ id: "p", conditions: [], trigger: { kind: "autorun" }, movement: { type: "chase" }, commands: [] }] } as never] } } };
    expect(variationStructureProblems(before, chased, HORROR, key).some((f) => f.ko.includes("make_chase_scene"))).toBe(false);
  });

  it("no blueprint yet, or no key: nothing to check", () => {
    expect(variationStructureProblems(createBlankProject(), createBlankProject(), HORROR, keyWhere(() => true))).toEqual([]);
    expect(variationStructureProblems(createBlankProject(), withSteps(["1층"]), HORROR, undefined)).toEqual([]);
  });
});
