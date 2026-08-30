// QA over-fire probe (temporary). Checks constructionFacadeLine / buildRegionTaskMessage
// for whether "author_house" wrongly appears for non-house building requests.
import { describe, it, expect } from "vitest";
import { buildScopedTurnMessage as buildRegionTaskMessage } from "./helpers/scopedTurnMessage";

function msgFor(instruction: string): string {
  return buildRegionTaskMessage(instruction, "맵", "m1", { x: 0, y: 1, width: 7, height: 8 });
}

describe("QA over-fire: constructionFacadeLine bare /집|건물/ fallback", () => {
  it("탑 건물 지어줘 — should route to build_wall, NOT author_house single", () => {
    const msg = msgFor("탑 건물 지어줘");
    const hasHouseSingle = msg.includes('author_house { kind:"single"');
    // report both signals regardless of pass/fail
    console.log("[탑 건물 지어줘]\n" + extractFacade(msg));
    expect(hasHouseSingle, "탑 should NOT get author_house single facade (over-fire)").toBe(false);
  });

  it("성벽 건물 지어 — should route to build_wall, NOT author_house single", () => {
    const msg = msgFor("성벽 건물 지어");
    const hasHouseSingle = msg.includes('author_house { kind:"single"');
    console.log("[성벽 건물 지어]\n" + extractFacade(msg));
    expect(hasHouseSingle, "성벽 should NOT get author_house single facade (over-fire)").toBe(false);
  });

  it("대장간 건물 — author_house acceptable (guide lists 대장간 as author_house)", () => {
    const msg = msgFor("대장간 건물");
    console.log("[대장간 건물]\n" + extractFacade(msg));
    // acceptable either way; just report
    expect(true).toBe(true);
  });

  it("마을 지어 — should be author_village, NOT author_house single", () => {
    const msg = msgFor("마을 지어");
    const hasHouseSingle = msg.includes('author_house { kind:"single"');
    console.log("[마을 지어]\n" + extractFacade(msg));
    expect(hasHouseSingle, "마을 should NOT get author_house single facade").toBe(false);
  });

  it("집 5채 지어 — should be kind:lots", () => {
    const msg = msgFor("집 5채 지어");
    const hasLots = msg.includes('kind:"lots"');
    console.log("[집 5채 지어]\n" + extractFacade(msg));
    expect(hasLots, "N채 should be kind:lots").toBe(true);
  });

  it("실내 집 만들어 — should NOT route to author_house", () => {
    const msg = msgFor("실내 집 만들어");
    const hasHouseFacade = /author_house\s*\{/.test(msg);
    console.log("[실내 집 만들어]\n" + extractFacade(msg));
    expect(hasHouseFacade, "실내 should NOT get author_house facade").toBe(false);
  });
});

function extractFacade(msg: string): string {
  // pull the facade + bareHouse + structure-guide lines for evidence
  const lines = msg.split("\n").filter((l) =>
    /author_house|author_village|build_wall|kind:"|야외 집|집 요청|실내/.test(l),
  );
  return lines.join("\n");
}
