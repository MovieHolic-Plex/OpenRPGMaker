// jrpg-loop-1 ct2: 걷기 칩 시트를 전투 시트로 적으면 전투 화면에 시트 전체가 작은 칸 수백 개로 깔렸다.
import { describe, expect, it } from "vitest";
import { resolvePartyBattleCharset } from "@/assets/charsetBattlers";

describe("resolvePartyBattleCharset — 걷기 칩 시트는 저작 전투 시트가 아니다", () => {
  it("전투 시트가 걷기 칩과 같은 oprn 시트면 무시한다(호출자 기본 도트로 물러남)", () => {
    expect(resolvePartyBattleCharset({ characterResourceId: "oprn-charset-heroes1", characterIndex: 0, battleCharacterResourceId: "oprn-charset-heroes1" }, true)).toBeUndefined();
  });
  it("easyrpg 걷기 칩 시트를 적어도 대응 전투 칩으로 바꾼다", () => {
    expect(resolvePartyBattleCharset({ characterResourceId: "easyrpg-charset-actor1", characterIndex: 0, battleCharacterResourceId: "easyrpg-charset-actor1" }, true)).toBe("charset-battler-actor1-0");
  });
  it("전투 전용 칩과 업로드 시트는 그대로 통과한다", () => {
    expect(resolvePartyBattleCharset({ characterResourceId: "oprn-charset-heroes1", characterIndex: 0, battleCharacterResourceId: "charset-battler-actor1-5" }, true)).toBe("charset-battler-actor1-5");
    expect(resolvePartyBattleCharset({ characterResourceId: "oprn-charset-heroes1", battleCharacterResourceId: "uploaded-battle-sheet" }, true)).toBe("uploaded-battle-sheet");
  });
});
