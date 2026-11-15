// 조수 v2 던전 종류 고르기(2026-11-15 감독): 닫힌 집합의 값(spec.theme · hints.type)과 게임 열쇠·이야기 역할로 정한다.
// 모델이 쓴 자유 낱말·이름을 정규식 표로 읽지 않는다 — 한 게임은 늘 같은 종류, 게임끼리는 다르다.
import { describe, expect, it } from "vitest";
import { DUNGEON_CARD, DUNGEON_KINDS, dungeonArgs, dungeonRole, pickDungeonKind } from "@/ai/v2/place/builders/dungeon";
import { DUNGEON_TYPES } from "@/editor/dungeonKit/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const spec = (over: Partial<PlaceSpec>): PlaceSpec => ({ type: "dungeon", name: "던전", ...over }) as PlaceSpec;

describe("조수 v2 던전 종류 — 닫힌 집합 + 게임 열쇠", () => {
  it("닫힌 값은 그대로: theme · hints.type, 깃발 붙은 둘은 종류 + 깃발", () => {
    for (const t of DUNGEON_TYPES) expect(dungeonArgs(spec({ theme: t })).type).toBe(t);
    expect(dungeonArgs(spec({ theme: " Ice " })).type).toBe("ice");
    expect(dungeonArgs(spec({ theme: "cave", hints: { type: "mine" } })).type).toBe("mine");
    const sunken = dungeonArgs(spec({ theme: "sunken" }));
    expect([sunken.type, sunken.args.flooded]).toEqual(["temple", true]);
    const hideout = dungeonArgs(spec({ theme: "hideout" }));
    expect([hideout.type, hideout.args.lair]).toEqual(["cave", true]);
  });

  it("카드가 닫힌 집합을 빠짐없이 적는다", () => {
    for (const k of DUNGEON_KINDS) expect(DUNGEON_CARD).toContain(k);
  });

  it("자유 낱말·이름은 읽지 않는다 — 열쇠가 고른다(무너지지 않는다)", () => {
    const key = "game-a|던전 하나 만들어 줘";
    const plain = pickDungeonKind(spec({ variety: key }));
    // 옛 명세의 자유 theme, 이름에 든 종류 낱말 모두 같은 열쇠면 같은 종류
    expect(pickDungeonKind(spec({ variety: key, theme: "얼음 동굴 같은 곳" }))).toBe(plain);
    expect(pickDungeonKind(spec({ variety: key, theme: "frozen lava pyramid" }))).toBe(plain);
    expect(() => dungeonArgs(spec({ variety: key, theme: "???", features: ["함정", "레버가 있는 방"] }))).not.toThrow();
    expect(dungeonArgs(spec({ variety: key, theme: "cave", name: "레버 동굴" })).args.gimmick).toBeUndefined();
  });

  it("한 게임은 늘 같은 종류, 게임끼리는 갈린다", () => {
    const pick = (game: string) => pickDungeonKind(spec({ variety: `${game}|던전 만들어 줘`, name: "깊은 곳" }));
    expect(pick("game-a")).toBe(pick("game-a"));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pick(`game-${i}`)));
    expect(seen.size).toBeGreaterThanOrEqual(4);
    for (const k of seen) expect(DUNGEON_KINDS).toContain(k);
  });

  it("이야기 역할: 보스가 있는 끝 던전과 곁 던전은 후보가 다르다", () => {
    expect(dungeonRole(spec({ features: ["boss", "chests"] }))).toBe("final");
    expect(dungeonRole(spec({ floors: 3 }))).toBe("final");
    expect(dungeonRole(spec({ features: ["chests"] }))).toBe("side");
    const finals = new Set(Array.from({ length: 60 }, (_, i) => pickDungeonKind(spec({ variety: `g${i}`, features: ["boss"] }))));
    const sides = new Set(Array.from({ length: 60 }, (_, i) => pickDungeonKind(spec({ variety: `g${i}` }))));
    expect(finals.has("sewer")).toBe(false);
    expect(sides.has("volcano")).toBe(false);
    expect(finals.has("castle") && sides.has("sewer")).toBe(true);
  });

  it("cave 장소는 동굴, 다시 지을 때는 앞 종류를 지킨다", () => {
    expect(pickDungeonKind({ type: "cave", name: "굴", variety: "k" } as PlaceSpec)).toBe("cave");
    expect(pickDungeonKind(spec({ variety: "k" }), "pyramid")).toBe("pyramid");
    expect(pickDungeonKind(spec({ variety: "k", theme: "ice" }), "pyramid")).toBe("ice");
  });

  it("장치·깃발은 features 의 닫힌 값으로만", () => {
    expect(dungeonArgs(spec({ theme: "catacomb", features: ["Lever"] })).args.gimmick).toBe("lever");
    expect(dungeonArgs(spec({ theme: "mine", features: ["minecart"] })).args.gimmick).toBe("minecart");
    expect(dungeonArgs(spec({ theme: "temple", features: ["flooded"] })).args.flooded).toBe(true);
    expect(dungeonArgs(spec({ theme: "cave", features: ["goblin lair"] })).args.lair).toBe(true);
    // 종류 기본 장치는 그대로
    expect(dungeonArgs(spec({ theme: "volcano" })).args.gimmick).toBe("bridge");
    expect(dungeonArgs(spec({ theme: "pyramid" })).args.gimmick).toBe("sandpit");
  });
});
