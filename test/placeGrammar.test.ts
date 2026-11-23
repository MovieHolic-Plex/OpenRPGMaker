// 장소 구성 문법(placeGrammar): 낱말·계획·해시로 문법을 고르고, 문법이 설계·마을 손잡이가 된다.
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { grammarDesign, pickGrammar, userWordsOf, villageGrammarArgs } from "@/ai/v2/place/placeGrammar";
import { INTENT_NOTE_BOUNDARY } from "@/ai/piAgent/monsterGameRequest";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const cave = (name: string, request: string, key = "g1"): PlaceSpec => ({ type: "cave", size: "small", name, salt: 0, variety: `${key}|${request}` });
const village = (name: string, request: string, key = "g1"): PlaceSpec => ({ type: "village", theme: "river", size: "small", name, salt: 0, variety: `${key}|${request}` });

describe("pickGrammar", () => {
  it("reads the place name before the request", () => {
    expect(pickGrammar(cave("지하 호수 동굴", "갈래길 미로 탈출 게임"), "cave").grammar).toBe("lake");
    expect(pickGrammar(cave("메아리 동굴", "갈래길이 많은 미로 동굴에서 탈출"), "cave")).toMatchObject({ grammar: "branch", why: "words" });
  });

  it("reads only the user's words, not the assembled guidance after the intent note", () => {
    const spec = village("별빛 마을", `용사의 모험 게임${INTENT_NOTE_BOUNDARY}광장 장터 교역 체크리스트`);
    expect(userWordsOf(spec)).not.toMatch(/광장/u);
    expect(pickGrammar(spec, "village", ["harbor"]).why).toBe("hash");
  });

  it("takes a planned grammar from hints.grammar", () => {
    expect(pickGrammar({ ...village("마을", "광장 마을"), hints: { grammar: "scatter" } }, "village")).toMatchObject({ grammar: "scatter", why: "plan" });
  });

  it("moves to another grammar when the worded one is avoided", () => {
    const spec = village("광장 마을", "광장 한가운데 우물");
    expect(pickGrammar(spec, "village").grammar).toBe("plaza");
    expect(pickGrammar(spec, "village", ["plaza"]).grammar).not.toBe("plaza");
  });

  it("spreads requests without place words over several grammars", () => {
    const picked = new Set(Array.from({ length: 24 }, (_, i) => pickGrammar(cave("동굴", "모험 게임", `game-${i}`), "cave").grammar));
    expect(picked.size).toBeGreaterThanOrEqual(3);
  });
});

describe("grammarDesign", () => {
  it("puts the entrance on the picked side and keeps one entrance and one boss", () => {
    const pick = { ...pickGrammar(cave("미로 동굴", ""), "cave"), side: "west" as const };
    const d = grammarDesign(pick);
    expect(d.entrance).toBe("west");
    expect(d.rooms?.filter((r) => r.role === "entrance")).toHaveLength(1);
    expect(d.rooms?.filter((r) => r.role === "boss")).toHaveLength(1);
    const [x] = String(d.rooms?.find((r) => r.role === "entrance")?.at).split(",").map(Number);
    expect(x).toBeGreaterThan(0.7);
  });

  it("gives the lake grammar a lake room", () => {
    expect(grammarDesign(pickGrammar(cave("지하 호수 동굴", ""), "cave")).rooms?.some((r) => r.water === "lake")).toBe(true);
  });
});

describe("villageGrammarArgs", () => {
  it("maps grammars to different town forms", () => {
    const form = (g: string) => villageGrammarArgs({ kind: "village", grammar: g, why: "plan", side: "south", seed: 1 }).form;
    expect(new Set(["riverline", "plaza", "crossroads", "scatter"].map(form)).size).toBe(4);
  });
});
