import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { thinGameSign, unbuiltGameSigns, wholeGameRekickPrompt, widenGamePrompt } from "@/ai/v2/shipChecks";
import { wantsWholeGame } from "@/ai/v2/request/readers";
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
    // 엔딩을 부르는 이벤트가 있어야 끝낼 수 있는 게임이다(615f5a3e60) — 뼈대 이벤트의 한 줄을 실제 엔딩 호출로 바꾼다.
    const seg = p.maps[p.startMapId!]!.events.find((ev) => ev.id === "ev_seg")!;
    seg.name = "항구의 이별"; seg.pages = [{ commands: [{ kind: "triggerEnding", endingId: "ending_stay" }] }] as never;
    expect(unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.")).toHaveLength(0);
  });
  // 2026-11-05 gpt-only-game (Terra alone): 「좀비 생존 게임 만들어줘」 ended with an opening only — no ending, only the blank start map.
  it("a whole-game build with no ending or only the blank start map is unbuilt, ending word or not", () => {
    const p = createBlankProject() as Project;
    finishFirstScreen(p);
    const noMap = "플레이할 맵이 없다 — 손대지 않은 빈 시작 맵뿐이다";
    expect(unbuiltGameSigns(p, "짧은 모험 게임 만들어 줘. 엔딩까지.")).toEqual(["엔딩이 하나도 없다", noMap]);
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual(["엔딩이 하나도 없다", noMap]);
    p.maps[p.startMapId!]!.events.push({ id: "ev_gate", name: "대피소 문", x: 2, y: 2, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] }] } as never);
    p.endings = [{ id: "ending_escape", name: "대피 성공", conditions: [], priority: 0 }];
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
  });
  // 2026-11-05 gpt-only-game r9 zombie: the last stretch (chests, battles, gate, escape ending) sat on the untouched blank start map.
  it("events on a bare blank canvas count as unbuilt once another map is built", () => {
    const p = createBlankProject() as Project;
    finishFirstScreen(p);
    p.endings = [{ id: "ending_escape", name: "탈출", conditions: [], priority: 0 }];
    const start = p.maps[p.startMapId!]!;
    start.events.push({ id: "ev_gate", name: "봉쇄문", x: 2, y: 2, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] }] } as never);
    // Only the blank map: the one-map game is thinGameSign's job, not this sign.
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
    const built = { ...structuredClone(start), id: "map_camp", name: "야영지", events: [] };
    built.lowerTiles = built.lowerTiles.map((t, i) => (i === 0 ? t + 1 : t));
    p.maps.map_camp = built;
    const signs = unbuiltGameSigns(p, "좀비 생존 게임 만들어줘");
    expect(signs).toHaveLength(1);
    expect(signs[0]).toContain(p.startMapId!);
    start.lowerTiles = start.lowerTiles.map((t, i) => (i === 1 ? t + 1 : t));
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
  });
  // 2026-11-05 gpt-only-game: 「마을부터」 had an ending but no healing (game over in the 2nd forest battle);
  // fantasy and cat kept the factory opening, the village kept the 「새 프로젝트」 title.
  it("combat with no healing and a factory title or opening count as unbuilt", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "ending_home", name: "집으로", conditions: [], priority: 0 }];
    const map = p.maps[p.startMapId!]!;
    map.events.push({ id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_home" }] }] } as never);
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
  // 2026-11-05 round 4: zombie survival lost its exit event to a dungeon rebuild (ending left, nothing triggers it);
  // the village had endless forest encounters and one chest potion as its only heal.
  it("an ending nobody triggers and one-shot healing against random encounters count as unbuilt", () => {
    const p = createBlankProject() as Project;
    finishFirstScreen(p);
    p.endings = [{ id: "ending_rescue", name: "새벽의 구조", conditions: [], priority: 0 }];
    const map = p.maps[p.startMapId!]!;
    map.events.push({ id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [] } as never);
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘").some((s) => s.includes("어떤 이벤트도 부르지 않는다"))).toBe(true);
    map.events.push({ id: "ev_exit", name: "출구", x: 3, y: 3, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_rescue" }] }] } as never);
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
    (map as { encounterTable?: unknown; encounterRate?: number }).encounterTable = [{ troopId: p.database.troops[0]!.id, weight: 1 }];
    (map as { encounterRate?: number }).encounterRate = 18;
    p.session.inventory = { ...p.session.inventory, item_potion: 1 };
    const signs = unbuiltGameSigns(p, "좀비 생존 게임 만들어줘");
    expect(signs).toHaveLength(1);
    expect(signs[0]).toContain("회복은 한 번 주는 것뿐");
    map.events.push({ id: "ev_rest", name: "쉬터", x: 4, y: 4, pages: [{ commands: [{ kind: "recoverAll" }] }] } as never);
    expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
  });
  // 2026-11-05 rounds 1-7: 「학교 연애」 and 「좀비 생존」 kept ending on one map with 1-4 events.
  it("a finished but one-map, one-character game is thin; two maps, two talkers and five events are not", () => {
    const p = createBlankProject() as Project;
    const talker = (id: string, x: number) => ({ id, name: id, x, y: 2, pages: [{ graphic: { sprite: { type: "bundled", id: "tex" } }, commands: [{ kind: "text", body: "안녕" }] }] });
    const start = p.maps[p.startMapId!]!;
    start.events.push(talker("ev_seoa", 2) as never);
    expect(thinGameSign(p)).toContain("맵이 1장");
    expect(widenGamePrompt(thinGameSign(p)!)).toContain("다시 묻지 않는다");
    const second = { ...structuredClone(start), id: "map_hall", name: "복도", events: [] as unknown[] };
    p.maps.map_hall = second as never;
    second.events.push(talker("ev_friend", 3), { id: "ev_note", name: "쪽지", x: 4, y: 4, pages: [] }, { id: "ev_door", name: "문", x: 5, y: 5, pages: [] }, { id: "ev_box", name: "상자", x: 6, y: 6, pages: [] });
    expect(thinGameSign(p)).toBeUndefined();
  });
  it("a one-room escape request only needs enough to do, and a busy one-talker game is not thin", () => {
    const p = createBlankProject() as Project;
    const start = p.maps[p.startMapId!]!;
    for (let i = 0; i < 5; i++) start.events.push({ id: `ev_clue${i}`, name: `단서${i}`, x: 2 + i, y: 2, pages: [] } as never);
    expect(thinGameSign(p, "방 하나만 있는 방탈출 게임 만들어줘")).toBeUndefined();
    expect(thinGameSign(p, "좀비 생존 게임 만들어줘")).toContain("맵이 1장");
    const hall = { ...structuredClone(start), id: "map_hall", name: "복도", events: [] as unknown[] };
    p.maps.map_hall = hall as never;
    for (let i = 0; i < 3; i++) hall.events.push({ id: `ev_box${i}`, name: `상자${i}`, x: 2 + i, y: 3, pages: [] });
    expect(thinGameSign(p, "좀비 생존 게임 만들어줘")).toBeUndefined();
  });
  it("a request ending in …게임으로 is a whole game; an edit that mentions 게임 is not", () => {
    expect(wantsWholeGame("마을 하나 만들어줘. 거기서 시작하는 모험 게임으로")).toBe(true);
    expect(wantsWholeGame(`마을 하나 만들어줘. 거기서 시작하는 모험 게임으로${INTENT_NOTE_BOUNDARY}[새로하기 오프닝·타이틀] …`)).toBe(true);
    expect(wantsWholeGame("마을 이름을 게임으로 바꿔")).toBe(false);
    expect(wantsWholeGame("이 상점을 미니게임으로")).toBe(false);
    expect(wantsWholeGame("대사를 게임으로")).toBe(false);
  });
});
