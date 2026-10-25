// 스토어 업데이트 글 재료(gameUpdateDraft.ts): 대본 차이·바뀐 점 요약.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { briefChanges, screenplayChanges } from "@/editor/assetStore/gameUpdateDraft";

describe("gameUpdateDraft", () => {
  it("첫 판본(비교할 것 없음)은 대본 변화가 없다", () => {
    expect(screenplayChanges(null, createBlankProject())).toEqual({ added: [], addedTotal: 0, removedTotal: 0, scenes: [] });
  });
  it("같은 프로젝트끼리는 바뀐 대사가 없다", () => {
    const p = createBlankProject();
    expect(screenplayChanges(p, p).addedTotal).toBe(0);
  });
  it("바뀐 점 요약은 내부 id 같은 이름을 빼고 개수는 그대로 센다", () => {
    const brief = briefChanges({
      maps: { added: ["동굴"], changed: [], removed: [] },
      events: { added: ["왕도 · ev_gate_fa00850b-1bc7", "왕도 · 빵집 아주머니"], changed: [], removed: [] },
      characters: { added: [], changed: [], removed: [] },
    }) as Record<string, { added: { count: number; names: string[] } }>;
    expect(brief.events!.added).toEqual({ count: 2, names: ["왕도 · 빵집 아주머니"] });
    expect(brief.maps!.added.names).toEqual(["동굴"]);
  });
});
