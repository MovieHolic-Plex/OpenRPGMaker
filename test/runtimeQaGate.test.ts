import { describe, expect, it } from "vitest";
import { evaluateExpect } from "../scripts/lib/runtimeQa.mjs";
import type { RuntimeQaRect } from "../scripts/lib/runtimeQa.d.mts";

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

  // 런타임이 계산한 발자국 사각을 직접 단정하는 축. 이동 좌표는 판정의 **결과**라
  // 우연히 맞을 수 있고, 이건 판정의 **입력**이다.
  describe("이벤트 사각 기대치(eventRects)", () => {
    const golem = {
      footprint: { width: 3, height: 3 },
      passRows: 1,
      bodyRect: { left: 14, right: 16, top: 16, bottom: 18 },
      passRect: { left: 14, right: 16, top: 18, bottom: 18 },
    };
    const withGolem = { ...observed, events: { ev_golem: golem } };

    it("사각이 전부 맞으면 통과한다", () => {
      expect(evaluateExpect({ eventRects: { ev_golem: golem } }, withGolem)).toEqual([]);
    });

    // 이게 이 축의 존재 이유다: passRows 를 무시하는 회귀가 나면 통행 사각이 몸 사각과 같아진다.
    it("통행 사각이 몸 사각으로 되돌아가면 잡는다", () => {
      const regressed = {
        ...withGolem,
        events: { ev_golem: { ...golem, passRect: { left: 14, right: 16, top: 16, bottom: 18 } } },
      };

      expect(evaluateExpect({ eventRects: { ev_golem: golem } }, regressed)).toEqual([
        'ev_golem.passRect: 기대 {"left":14,"right":16,"top":18,"bottom":18},'
          + ' 실제 {"left":14,"right":16,"top":16,"bottom":18}',
      ]);
    });

    it("스냅샷에 없는 이벤트는 조용히 통과시키지 않는다", () => {
      expect(evaluateExpect({ eventRects: { ev_missing: golem } }, withGolem)).toEqual([
        "이벤트 스냅샷 없음: ev_missing — 활성 페이지가 없거나 다른 맵이다",
      ]);
    });

    it("사각을 안 실어 온 런에서도 조용히 통과시키지 않는다", () => {
      expect(evaluateExpect({ eventRects: { ev_golem: golem } }, observed)).toEqual([
        "이벤트 스냅샷 없음: ev_golem — 활성 페이지가 없거나 다른 맵이다",
      ]);
    });

    // 키 순서에 의존하는 JSON.stringify 비교였다면 여기서 거짓 실패가 났다.
    it("사각의 키 순서가 달라도 통과한다", () => {
      const reordered = { top: 18, bottom: 18, right: 16, left: 14 };

      expect(evaluateExpect({ eventRects: { ev_golem: { passRect: reordered } } }, withGolem)).toEqual([]);
    });

    // 네 변 중 셋만 적으면 나머지 한 변이 조용히 통과한다 — 그걸 막는다.
    // 타입(RuntimeQaRect)이 이미 네 변을 요구하므로 캐스팅으로 뚫는다. 런타임 검사도 필요한
    // 이유: 시나리오는 .mjs 라 타입 검사를 받지 않는다.
    it("사각의 변이 빠지면 거부한다", () => {
      const partial = { left: 14, right: 16, top: 18 } as unknown as RuntimeQaRect;
      const failures = evaluateExpect({ eventRects: { ev_golem: { passRect: partial } } }, withGolem);

      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain("ev_golem.passRect");
    });

    it("스칼라 필드(passRows)도 따로 판정한다", () => {
      expect(evaluateExpect({ eventRects: { ev_golem: { passRows: 3 } } }, withGolem)).toEqual([
        "ev_golem.passRows: 기대 3, 실제 1",
      ]);
    });

    // 발자국 저작이 없는 이벤트: 두 사각이 앵커 한 칸으로 같다 — 항등.
    it("1x1 이벤트의 두 사각이 같은 한 칸이면 통과한다", () => {
      const sign = {
        footprint: { width: 1, height: 1 },
        passRows: 1,
        bodyRect: { left: 4, right: 4, top: 6, bottom: 6 },
        passRect: { left: 4, right: 4, top: 6, bottom: 6 },
      };

      expect(evaluateExpect({ eventRects: { ev_sign: sign } }, { ...observed, events: { ev_sign: sign } })).toEqual([]);
    });

    it("eventRects 를 안 쓰면 아무 사유도 생기지 않는다 — 항등", () => {
      expect(evaluateExpect({ x: 3, y: 2 }, withGolem)).toEqual([]);
    });
  });
});
