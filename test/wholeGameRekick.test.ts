import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { unbuiltGameSigns, wantsWholeGame, wholeGameRekickPrompt } from "@/ai/v2/shipChecks";
import { INTENT_NOTE_BOUNDARY } from "@/ai/piAgent/monsterGameRequest";
import type { Project } from "@/project/types";

/** A game that already has its own title and no opening, so only the signs under test fire. */
function finishFirstScreen(p: Project): void {
  p.meta.title = "바닷가 카페";
  (p.system as { titleScreen?: { title?: string } }).titleScreen = { ...(p.system as { titleScreen?: object }).titleScreen, title: "바닷가 카페" };
  p.system.opening = { ...p.system.opening!, enabled: false };
}

// 2026-10-25 Salad S3: 9/58 builds stopped with only the skeleton 「기억의 조각 → 첫 구간 끝」.
describe("whole-game rekick signs", () => {
  it("skeleton-only endings and events count as unbuilt; a real ending clears it", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "ending_segment", name: "첫 구간 끝", conditions: [], priority: 0 }];
    p.maps[p.startMapId!]!.events.push({ id: "ev_seg", name: "기억의 조각", x: 2, y: 2, pages: [] } as never);
    finishFirstScreen(p);
    const signs = unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.");
    expect(signs.length).toBe(2);
    expect(wholeGameRekickPrompt(signs)).toContain("이어 짓기");
    p.endings.push({ id: "ending_stay", name: "항구에 남는 두 사람", conditions: [], priority: 10 });
    expect(unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.")).toHaveLength(0);
  });
  // 2026-11-05 gpt-only-game (Terra alone): 「좀비 생존 게임 만들어줘」 ended with an opening only — no ending, only the blank start map.
  it("a whole-game build with no ending or only the blank start map is unbuilt, ending word or not", () => {
    const p = createBlankProject() as Project;
    finishFirstScreen(p);
    const noMap = "플레이할 맵이 없다 — 손대지 않은 빈 시작 맵뿐이다";
    expect(unbuiltGameSigns(p, "짧은 모험 게임 만들어 줘. 엔딩까지.")).toEqual(["엔딩이 하나도 없다", noMap]);
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual(["엔딩이 하나도 없다", noMap]);
    p.maps[p.startMapId!]!.events.push({ id: "ev_gate", name: "대피소 문", x: 2, y: 2, pages: [] } as never);
    p.endings = [{ id: "ending_escape", name: "대피 성공", conditions: [], priority: 0 }];
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
  });
  // 2026-11-05 gpt-only-game: 「마을부터」 had an ending but no healing (game over in the 2nd forest battle);
  // fantasy and cat kept the factory opening, the village kept the 「새 프로젝트」 title.
  it("combat with no healing and a factory title or opening count as unbuilt", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "ending_home", name: "집으로", conditions: [], priority: 0 }];
    const map = p.maps[p.startMapId!]!;
    map.events.push({ id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [] } as never);
    const signs = unbuiltGameSigns(p, "마을 모험 게임 만들어줘");
    expect(signs.some((s) => s.includes("편집기 기본") && s.includes("제목"))).toBe(true);
    expect(signs.some((s) => s.includes("오프닝"))).toBe(true);
    finishFirstScreen(p);
    expect(unbuiltGameSigns(p, "마을 모험 게임 만들어줘")).toEqual([]);
    (map as { encounterTable?: unknown; encounterRate?: number }).encounterTable = [{ troopId: p.database.troops[0]!.id, weight: 1 }];
    (map as { encounterRate?: number }).encounterRate = 20;
    const heal = unbuiltGameSigns(p, "마을 모험 게임 만들어줘");
    expect(heal).toHaveLength(1);
    expect(heal[0]).toContain("회복 수단이 하나도 없다");
  });
  it("a request ending in …게임으로 is a whole game; an edit that mentions 게임 is not", () => {
    expect(wantsWholeGame("마을 하나 만들어줘. 거기서 시작하는 모험 게임으로")).toBe(true);
    expect(wantsWholeGame(`마을 하나 만들어줘. 거기서 시작하는 모험 게임으로${INTENT_NOTE_BOUNDARY}[새로하기 오프닝·타이틀] …`)).toBe(true);
    expect(wantsWholeGame("마을 이름을 게임으로 바꿔")).toBe(false);
    expect(wantsWholeGame("이 상점을 미니게임으로")).toBe(false);
    expect(wantsWholeGame("대사를 게임으로")).toBe(false);
  });
});
