import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { unbuiltGameSigns, wholeGameRekickPrompt } from "@/ai/v2/shipChecks";
import type { Project } from "@/project/types";

// 2026-10-25 Salad S3: 9/58 builds stopped with only the skeleton 「기억의 조각 → 첫 구간 끝」.
describe("whole-game rekick signs", () => {
  it("skeleton-only endings and events count as unbuilt; a real ending clears it", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "ending_segment", name: "첫 구간 끝", conditions: [], priority: 0 }];
    p.maps[p.startMapId!]!.events.push({ id: "ev_seg", name: "기억의 조각", x: 2, y: 2, pages: [] } as never);
    const signs = unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.");
    expect(signs.length).toBe(2);
    expect(wholeGameRekickPrompt(signs)).toContain("이어 짓기");
    p.endings.push({ id: "ending_stay", name: "항구에 남는 두 사람", conditions: [], priority: 10 });
    expect(unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.")).toHaveLength(0);
  });
  it("no ending at all when the request asks for one", () => {
    const p = createBlankProject() as Project;
    expect(unbuiltGameSigns(p, "짧은 모험 게임 만들어 줘. 엔딩까지.")).toEqual(["엔딩이 하나도 없다"]);
    expect(unbuiltGameSigns(p, "짧은 모험 게임 만들어 줘")).toEqual([]);
  });
});
