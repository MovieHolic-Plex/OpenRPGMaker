import { describe, expect, it } from "vitest";
import { evaluateExpect } from "../scripts/lib/runtimeQa.mjs";

const observed = {
  state: { currentMapId: "map_town", x: 3, y: 2, gold: 100, switches: {}, variables: {} },
  testids: ["runtime-state-json", "dialogue-window"],
  playerSpriteResourceId: "charset_hero",
  playerSpriteTextureKey: "tex_easyrpg_charset_people1",
};

describe("evaluateExpect", () => {
  it("맵 ID 가 다르면 실패 사유를 낸다", () => {
    const failures = evaluateExpect({ mapId: "map_dungeon" }, observed);

    expect(failures).toEqual(["mapId: 기대 map_dungeon, 실제 map_town"]);
  });

  it("기대치가 전부 맞으면 빈 배열을 낸다", () => {
    const failures = evaluateExpect(
      { mapId: "map_town", x: 3, y: 2, gold: 100, testidPresent: ["dialogue-window"] },
      observed,
    );

    expect(failures).toEqual([]);
  });

  it("좌표가 다르면 x·y 를 각각 보고한다", () => {
    const failures = evaluateExpect({ x: 9, y: 8 }, observed);

    expect(failures).toEqual(["x: 기대 9, 실제 3", "y: 기대 8, 실제 2"]);
  });

  it("골드가 다르면 실패 사유를 낸다", () => {
    const failures = evaluateExpect({ gold: 250 }, observed);

    expect(failures).toEqual(["gold: 기대 250, 실제 100"]);
  });

  it("있어야 할 testid 가 없으면 보고한다", () => {
    const failures = evaluateExpect({ testidPresent: ["battle-command", "shop-window"] }, observed);

    expect(failures).toEqual(["testid 누락: battle-command", "testid 누락: shop-window"]);
  });

  it("없어야 할 testid 가 있으면 보고한다", () => {
    const failures = evaluateExpect({ testidAbsent: ["dialogue-window"] }, observed);

    expect(failures).toEqual(["testid 잔존: dialogue-window"]);
  });

  it("플레이어 스프라이트 리소스가 비면 보고한다", () => {
    const failures = evaluateExpect(
      { playerSpriteResourceNonEmpty: true },
      { ...observed, playerSpriteResourceId: "" },
    );

    expect(failures).toEqual(["playerSprite: 리소스 ID 가 비어 있다(스프라이트 누락)"]);
  });

  it("스프라이트 훅이 null 을 주면 누락으로 본다", () => {
    const failures = evaluateExpect(
      { playerSpriteResourceNonEmpty: true },
      { ...observed, playerSpriteResourceId: null },
    );

    expect(failures).toEqual(["playerSprite: 리소스 ID 가 비어 있다(스프라이트 누락)"]);
  });

  // resourceId 만 보면 "스프라이트 있음"으로 통과하지만 Phaser 는 __MISSING
  // 플레이스홀더(초록 와이어프레임)를 그린다. 실측으로 겪은 오탐이라 별도 축으로 잡는다.
  it("텍스처가 __MISSING 이면 resourceId 가 있어도 실패로 잡는다", () => {
    const failures = evaluateExpect(
      { playerSpriteTextureLoaded: true },
      { ...observed, playerSpriteTextureKey: "__MISSING" },
    );

    expect(failures).toEqual([
      "playerSprite: 텍스처가 로드되지 않았다(__MISSING) — resourceId=charset_hero",
    ]);
  });

  it("텍스처가 로드돼 있으면 통과한다", () => {
    expect(evaluateExpect({ playerSpriteTextureLoaded: true }, observed)).toEqual([]);
  });

  it("텍스처 키가 없으면 실패로 잡는다", () => {
    const failures = evaluateExpect(
      { playerSpriteTextureLoaded: true },
      { ...observed, playerSpriteTextureKey: null },
    );

    expect(failures).toEqual([
      "playerSprite: 텍스처가 로드되지 않았다(없음) — resourceId=charset_hero",
    ]);
  });

  it("훅이 없어 상태를 못 읽으면 조용히 통과시키지 않는다", () => {
    const failures = evaluateExpect({ mapId: "map_town" }, { ...observed, state: null });

    expect(failures).toEqual(["런타임 훅 없음 — 상태를 읽을 수 없다(mapId 확인 불가)"]);
  });

  it("상태를 못 읽어도 DOM 기대치는 그대로 판정한다", () => {
    const failures = evaluateExpect(
      { testidPresent: ["title-screen"] },
      { ...observed, state: null },
    );

    expect(failures).toEqual(["testid 누락: title-screen"]);
  });

  it("실패가 여러 축이면 모두 누적한다", () => {
    const failures = evaluateExpect({ mapId: "map_x", gold: 1 }, observed);

    expect(failures).toEqual(["mapId: 기대 map_x, 실제 map_town", "gold: 기대 1, 실제 100"]);
  });

  // 부등 기대치 — 대조군을 자동 단정으로 바꾸는 축. "안 움직였다" 만 검사하면 입력이 죽어도
  // 통과하므로, 골렘 없는 런에서 "움직였다" 를 단정할 수단이 필요하다.
  describe("부등 기대치(xNot/yNot)", () => {
    it("x 가 금지값과 같으면 실패로 잡는다", () => {
      expect(evaluateExpect({ xNot: 3 }, observed)).toEqual(["xNot: 기대 ≠ 3, 실제 3"]);
    });

    it("x 가 금지값과 다르면 통과한다", () => {
      expect(evaluateExpect({ xNot: 9 }, observed)).toEqual([]);
    });

    it("y 도 같은 방식으로 판정하고 x 와 함께 누적한다", () => {
      expect(evaluateExpect({ xNot: 3, yNot: 2 }, observed)).toEqual([
        "xNot: 기대 ≠ 3, 실제 3",
        "yNot: 기대 ≠ 2, 실제 2",
      ]);
    });

    it("훅이 없으면 조용히 통과시키지 않는다", () => {
      expect(evaluateExpect({ xNot: 3 }, { ...observed, state: null })).toEqual([
        "런타임 훅 없음 — 상태를 읽을 수 없다(xNot 확인 불가)",
      ]);
    });

    // 0 은 falsy 다. `if (!expected[key])` 로 썼다면 "x 가 0 이면 안 된다" 가 조용히 사라진다.
    it("금지값 0 도 검사한다", () => {
      const atOrigin = { ...observed, state: { ...observed.state, x: 0 } };
      expect(evaluateExpect({ xNot: 0 }, atOrigin)).toEqual(["xNot: 기대 ≠ 0, 실제 0"]);
    });

    it("동등 기대치와 섞여도 서로 간섭하지 않는다", () => {
      expect(evaluateExpect({ x: 3, yNot: 5 }, observed)).toEqual([]);
    });
  });
});
