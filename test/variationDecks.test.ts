// 장르 변주 데크·뽑기·카드 — 짓는 길이 실제 코드의 표에 있는지, 같은 씨앗은 같은 결과인지, 사용자 말이 이기는지, 카드가 600자 안인지.
// 지시문 글(문장)은 못박지 않는다 — 기계가 읽는 값(길 낱말·개수·순서·길이)만 본다.
import { describe, expect, it } from "vitest";
import { DECKS, type PlaceCandidate } from "@/ai/variation/decks";
import { deckFor, hash32, pickVariation } from "@/ai/variation/pick";
import { VARIATION_CARD_MAX, VARIATION_MARK, buildPath, variationCard } from "@/ai/variation/card";
import { WORLDS } from "@/ai/v2/place/world";
import { INTERIOR_CARD } from "@/ai/v2/place/builders/interior";
import { MODERN_KR_CARD } from "@/ai/v2/place/builders/modernCity";
import { JP_CITY_CARD } from "@/ai/v2/place/builders/jpCity";
import { VILLAGE_CARD } from "@/ai/v2/place/builders/village";
import { FACILITY_CATALOG } from "@/editor/handInterior/facilityVenues";
import { KR_DISTRICT_KINDS } from "@/project/modernCityDistrictKinds";
import { DUNGEON_TYPES } from "@/editor/dungeonKit/types";

const ALL_WORLDS = WORLDS.map((w) => w.id);
const keyOf = (i: number) => JSON.stringify(["project", `variation-${i}`]);
const deck = (id: string) => DECKS.find((d) => d.id === id)!;

describe("variation decks — every place has a build path that exists in code", () => {
  const places = DECKS.flatMap((d) => d.places.map((p) => [`${d.id}/${p.id}`, p] as const));

  it.each(places)("%s", (_label, place: PlaceCandidate) => {
    const b = place.build;
    switch (b.via) {
      case "world": {
        const world = WORLDS.find((w) => w.id === b.world);
        expect(world, `world ${b.world}`).toBeDefined();
        const kind = world!.kinds.find((k) => k.id === b.kind);
        expect(kind, `kind ${b.world}/${b.kind}`).toBeDefined();
        expect(!!place.indoor).toBe(!!kind!.indoor);
        break;
      }
      case "interior": expect(new RegExp(`\\b${b.room}\\b`, "u").test(INTERIOR_CARD), `interior room ${b.room}`).toBe(true); break;
      case "house": expect(MODERN_KR_CARD.includes(b.word) || FACILITY_CATALOG.some((f) => f.ko === b.word || f.aliases?.includes(b.word)), `house ${b.word}`).toBe(true); break;
      case "street":
        if (b.style === "kr-modern") expect(KR_DISTRICT_KINDS.map((k) => k.id), `district ${b.hint}`).toContain(b.hint);
        else expect(JP_CITY_CARD.includes(b.hint), `jp district ${b.hint}`).toBe(true);
        break;
      case "village": expect(VILLAGE_CARD.includes(b.theme), `village theme ${b.theme}`).toBe(true); break;
      case "dungeon": expect(DUNGEON_TYPES as readonly string[], `dungeon theme ${b.theme}`).toContain(b.theme); break;
    }
  });

  it("deck sizes follow the plan: places ≥12 (recall ≥16), events 10-15, moods 8-12, structures 5-8, unique ids", () => {
    for (const d of DECKS) {
      expect(d.places.length, `${d.id} places`).toBeGreaterThanOrEqual(d.id === "recall" ? 16 : 12);
      expect(d.events.length, `${d.id} events`).toBeGreaterThanOrEqual(10);
      expect(d.events.length, `${d.id} events`).toBeLessThanOrEqual(15);
      expect(d.moods.length, `${d.id} moods`).toBeGreaterThanOrEqual(8);
      expect(d.moods.length, `${d.id} moods`).toBeLessThanOrEqual(12);
      expect(d.structures.length, `${d.id} structures`).toBeGreaterThanOrEqual(5);
      expect(d.structures.length, `${d.id} structures`).toBeLessThanOrEqual(8);
      expect(new Set(d.places.map((p) => p.id)).size).toBe(d.places.length);
    }
    expect(DECKS.map((d) => d.id).sort()).toEqual(["adventure", "horror", "mystery", "recall", "romance", "warm"]);
  });

  it("a world used by a deck has at least 3 distinct kinds, one of them outdoors (a game is one world: the first place must be outdoors)", () => {
    for (const d of DECKS) {
      const byWorld = new Map<string, PlaceCandidate[]>();
      for (const p of d.places) if (p.build.via === "world") byWorld.set(p.build.world, [...(byWorld.get(p.build.world) ?? []), p]);
      for (const [world, list] of byWorld) {
        expect(new Set(list.map((p) => p.kind)).size, `${d.id}/${world} kinds`).toBeGreaterThanOrEqual(3);
        expect(list.some((p) => !p.indoor), `${d.id}/${world} outdoor`).toBe(true);
      }
    }
  });
});

describe("pickVariation", () => {
  const recall = "회상 형 게임 만들어 줘";

  it("same seed → same result; another key or regeneration → another result", () => {
    const a = pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS });
    expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS })).toEqual(a);
    const others = Array.from({ length: 20 }, (_, i) => pickVariation({ text: recall, key: keyOf(i + 2), allowedWorlds: ALL_WORLDS })!.places.map((p) => p.id).join("|"));
    expect(new Set(others).size).toBeGreaterThan(10);
    const regen = Array.from({ length: 10 }, (_, i) => pickVariation({ text: recall, key: keyOf(1), regen: i, allowedWorlds: ALL_WORLDS })!.places.map((p) => p.id).join("|"));
    expect(new Set(regen).size).toBeGreaterThan(5);
  });

  it("an empty key draws nothing; a request without a genre deck draws nothing", () => {
    expect(pickVariation({ text: recall, key: "  " })).toBeUndefined();
    expect(pickVariation({ text: "카페 경영 게임 만들어 줘", key: keyOf(1) })).toBeUndefined();
    expect(deckFor("카페 경영 게임 만들어 줘", true)?.id).toBe("adventure");
    expect(deckFor("회상 추리 게임", true)?.id).toBe("recall");
    // 장르 이름이 다른 덱의 낱말(단서)보다 먼저다 — 공포 요청이 추리 카드를 받던 것(2026-11-24 assistant-measure).
    expect(deckFor("밤의 미술관에 갇힌 아이가 단서를 모아 빠져나가는 공포 게임을 만들어 줘.")?.id).toBe("horror");
    expect(deckFor("가족의 비밀을 파헤치는 추리 게임")?.id).toBe("mystery");
  });

  it("the three places have distinct kinds, the first is never an indoor kind of a world, and a world first place pulls the others from the same world", () => {
    for (const d of DECKS) {
      for (let i = 0; i < 60; i++) {
        const v = pickVariation({ text: d.id === "adventure" ? "판타지 모험 게임" : d.match.source.split("|")[0]!, key: keyOf(i), allowedWorlds: ALL_WORLDS, adventureOk: true });
        if (!v) continue;
        expect(v.places.length).toBeGreaterThanOrEqual(1);
        expect(new Set(v.places.map((p) => p.kind)).size).toBe(v.places.length);
        expect(v.places[0]!.indoor).toBeUndefined();
        const worlds = new Set(v.places.map((p) => (p.build.via === "world" ? p.build.world : "")));
        expect(worlds.size).toBe(1);
        if (v.world) expect(worlds.has(v.world)).toBe(true);
      }
    }
  });

  it("no allowed world → no world-bound place; a fixed world or a stated place theme → no place axis", () => {
    for (let i = 0; i < 40; i++) {
      const v = pickVariation({ text: recall, key: keyOf(i) })!;
      expect(v.world).toBeUndefined();
      expect(v.places.every((p) => p.build.via !== "world")).toBe(true);
    }
    expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS, worldFixed: true })!.places).toEqual([]);
    expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS, placeStated: true })!.places).toEqual([]);
    expect(pickVariation({ text: recall, key: keyOf(1), allowedWorlds: ALL_WORLDS, worldFixed: true })!.skipped).toContain("places");
  });

  it("the user's words win: a named place stays first, a stated season/event/structure is not drawn", () => {
    for (let i = 0; i < 30; i++) {
      const v = pickVariation({ text: "마을이 나오는 회상 게임 만들어 줘", key: keyOf(i), allowedWorlds: ALL_WORLDS })!;
      expect(v.places[0]!.kind).toBe("village");
      expect(v.pinned.length).toBeGreaterThan(0);
    }
    const season = pickVariation({ text: "비 오는 날의 회상 게임", key: keyOf(3), allowedWorlds: ALL_WORLDS })!;
    expect(season.mood).toBeUndefined();
    expect(season.skipped).toContain("mood");
    const event = pickVariation({ text: "유품 속 편지를 따라가는 회상 게임", key: keyOf(3), allowedWorlds: ALL_WORLDS })!;
    expect(event.event).toBeUndefined();
    const structure = pickVariation({ text: "갈림길 회상 게임", key: keyOf(3), allowedWorlds: ALL_WORLDS })!;
    expect(structure.structure).toBeUndefined();
  });

  it("a recall story spreads over many places (plan acceptance, keys 0..99)", () => {
    const firsts = new Map<string, number>();
    const combos = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const v = pickVariation({ text: "회상 스토리", key: keyOf(i), allowedWorlds: ALL_WORLDS })!;
      firsts.set(v.places[0]!.kind, (firsts.get(v.places[0]!.kind) ?? 0) + 1);
      combos.add(v.places.map((p) => p.kind).sort().join("|"));
    }
    expect(firsts.size).toBeGreaterThanOrEqual(8);
    expect(Math.max(...firsts.values())).toBeLessThanOrEqual(25);
    expect(firsts.get("village") ?? 0).toBeLessThanOrEqual(30);
    expect(combos.size).toBeGreaterThanOrEqual(60);
  });

  it("hash32 is stable", () => {
    expect(hash32("a")).toBe(hash32("a"));
    expect(hash32("a")).not.toBe(hash32("b"));
    expect(deck("recall").places.length).toBeGreaterThan(0);
  });
});

describe("variationCard", () => {
  it(`stays within ${VARIATION_CARD_MAX} characters for every deck and key, in both languages`, () => {
    let longest = 0;
    for (const d of DECKS) {
      for (let i = 0; i < 100; i++) {
        const v = pickVariation({ text: d.id === "adventure" ? "판타지 모험 게임" : d.match.source.split("|")[0]!, key: keyOf(i), allowedWorlds: ALL_WORLDS, adventureOk: true });
        if (!v) continue;
        for (const lang of ["en", "ko"] as const) {
          const card = variationCard(v, { lang });
          if (!card) continue;
          expect(card.startsWith(VARIATION_MARK)).toBe(true);
          longest = Math.max(longest, card.length);
          expect(card.length, `${d.id} ${i} ${lang}`).toBeLessThanOrEqual(VARIATION_CARD_MAX);
          for (const p of v.places) expect(card).toContain(buildPath(p.build));
        }
      }
    }
    expect(longest).toBeGreaterThan(200);
  });

  it("has no card when the user's words settled every axis", () => {
    const v = pickVariation({ text: "비 오는 날 유품 편지를 따라 갈림길 선택으로 가는 회상 게임", key: keyOf(1), allowedWorlds: ALL_WORLDS, worldFixed: true })!;
    expect([...v.skipped].sort()).toEqual(["event", "mood", "places", "structure"]);
    expect(variationCard(v, { lang: "en" })).toBeUndefined();
  });
});
