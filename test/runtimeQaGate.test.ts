import { describe, expect, it } from "vitest";
import type { RuntimeQaBattler, RuntimeQaFootprintRect } from "../scripts/lib/runtimeQa.d.mts";
import { evaluateBattlerGeometry, evaluateExpect } from "../scripts/lib/runtimeQa.mjs";

const observed = {
  state: { currentMapId: "map_town", x: 3, y: 2, gold: 100, switches: {}, variables: {} },
  testids: ["runtime-state-json", "dialogue-window"],
  playerSpriteResourceId: "charset_hero",
  playerSpriteTextureKey: "tex_easyrpg_charset_people1",
};

describe("evaluateExpect", () => {
  it("checks each requested reward count without treating missing observations as zero", () => {
    const expected = { inventoryCounts: { item_capture_orb: 5 }, ownedMonsterCounts: { species_leafling: 1 } };
    const rewarded = { ...observed, state: { ...observed.state, ...expected } };
    expect(evaluateExpect(expected, rewarded)).toEqual([]);
    const failures = evaluateExpect({
      inventoryCounts: { item_capture_orb: 10 }, ownedMonsterCounts: { species_leafling: 2 },
    }, rewarded);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain("inventoryCounts[item_capture_orb]");
    expect(failures[1]).toContain("ownedMonsterCounts[species_leafling]");
  });

  it.each([null, observed.state])("rejects zero reward expectations when counts are unavailable: %j", (state) => {
    const zero = { inventoryCounts: { item_capture_orb: 0 }, ownedMonsterCounts: { species_leafling: 0 } };
    expect(evaluateExpect(zero, { ...observed, state })).toHaveLength(2);
  });

  it("preserves existing behavior without reward expectations", () => {
    expect(evaluateExpect({}, { ...observed, state: null })).toEqual([]);
    expect(evaluateExpect({ x: 3 }, observed)).toEqual([]);
  });

  it("emote expectations require a visible sprite on the requested target", () => {
    const expected = { emoteTargets: [{ target: "npc", frame: 0 }] };
    expect(evaluateExpect(expected, { ...observed, emotes: [{ target: "npc", frame: "0", alpha: 1 }] })).toEqual([]);
    expect(evaluateExpect(expected, { ...observed, emotes: [{ target: "npc", frame: "0", alpha: 0 }] })).not.toEqual([]);
    expect(evaluateExpect(expected, observed)).not.toEqual([]);
    expect(evaluateExpect(expected, { ...observed, emotes: [{ target: "player", frame: "0", alpha: 1 }] })).not.toEqual([]);
  });

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

  it("audioObservedIncludes: 재생 지시가 기록된 리소스는 통과, 없는 리소스는 보고한다", () => {
    const withAudio = { ...observed, audioObserved: ["cc0-bgm-town", "cc0-se-osx-wooded-box-open"] };

    expect(evaluateExpect({ audioObservedIncludes: ["cc0-se-osx-wooded-box-open"] }, withAudio)).toEqual([]);
    expect(evaluateExpect({ audioObservedIncludes: ["cc0-se-orp-inventory-coin"] }, withAudio)).toEqual([
      "audio 미재생: cc0-se-orp-inventory-coin (관측: cc0-bgm-town, cc0-se-osx-wooded-box-open)",
    ]);
  });

  it("audioObservedIncludes: 관측 배열이 없으면 조용히 통과시키지 않는다", () => {
    const failures = evaluateExpect({ audioObservedIncludes: ["cc0-se-orp-inventory-coin"] }, observed);

    expect(failures).toEqual(["audio 미재생: cc0-se-orp-inventory-coin (관측: 없음)"]);
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
      const partial = { left: 14, right: 16, top: 18 } as unknown as RuntimeQaFootprintRect;
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

// 배틀러 배치 판정. 이 게이트가 조용히 통과하면 "몬스터가 필드 위로 잘려 나간" 상태가
// 증거 없이 출하된다(실측: rm2000 앞줄 적 이미지 top=-13 vs field.top=24 → 37px 잘림).
// CSS 레이아웃은 jsdom 이 계산하지 않으므로 실제 판정은 실브라우저 rect 로 하고,
// 여기서는 그 rect 를 받아 사유를 만드는 순수 로직만 고정한다.
describe("evaluateBattlerGeometry", () => {
  // 필드 0..400 → 지평선 132(33%).
  const field = { top: 0, bottom: 400, left: 0, right: 600, width: 600, height: 400 };
  /** 이미지 높이 100 + 이름표 20 의 표준 배틀러. bottom 이 곧 발 위치다. */
  const enemyAt = (id: string, bottom: number) => enemyBox(id, bottom - 100, bottom);
  /** 상자를 직접 지정하는 변형 — 발은 지면에 닿고 상단만 잘린 큰 스프라이트 등. */
  function enemyBox(id: string, top: number, bottom: number) {
    return {
      id,
      node: { top, bottom: bottom + 20, left: 100, right: 200, width: 100, height: bottom + 20 - top },
      image: { top, bottom, left: 100, right: 200, width: 100, height: bottom - top },
    };
  }
  const battlers = (enemies: readonly RuntimeQaBattler[]) => ({
    skin: "rm2000",
    directorStep: "command",
    field,
    enemies,
    allies: [],
  });

  it("필드 안 + 발이 지평선 아래면 통과한다", () => {
    expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 240)]))).toEqual([]);
  });

  it("상단이 필드 밖으로 나가면 잘린 픽셀 수를 보고한다", () => {
    expect(evaluateBattlerGeometry({}, battlers([enemyBox("enemy-1", -13, 240)]))).toEqual([
      "battlerGeometry[enemy-1]: 필드 상단 밖으로 13px 잘렸다 (image.top=-13 < field.top=0)",
    ]);
  });

  it("발이 지평선 위에 떠 있으면 보고한다", () => {
    expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 120)]))).toEqual([
      "battlerGeometry[enemy-1]: 발이 지평선 위에 떠 있다 (image.bottom=120 < 지평선=132, field=0..400)",
    ]);
  });

  // 지평선(33%) 축은 통과하지만 접지 띠(하위 40%) 축은 못 넘는 구간 — 실측으로 잡힌 진짜 결함 모양이다
  // (chrono 발 37%, mv 46%, vxace 57%: 전부 지평선 아래인데도 필드 하단 절반이 비고 몬스터가 떠 보였다).
  it("지평선은 넘었지만 접지 띠 위에 떠 있으면 보고한다", () => {
    expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 200)]))).toEqual([
      "battlerGeometry[enemy-1]: 발이 접지 띠 위에 떠 있다 (image.bottom=200 < 하위 40% 시작=240, field=0..400)",
    ]);
  });

  it("접지 띠 시작선에 정확히 닿으면 통과한다", () => {
    expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 240)]))).toEqual([]);
  });

  // 이미지는 필드 안이지만 **이름표/게이지 스택**이 밖으로 밀린 경우 — 발을 접지 띠까지 내리면
  // 실제로 생겼던 결함이다(rm2000 앞줄 node.bottom=464 > field.bottom=444).
  it("이름표/게이지가 필드 하단 밖으로 나가면 보고한다", () => {
    const enemy = enemyAt("enemy-1", 390);
    expect(evaluateBattlerGeometry({}, battlers([enemy]))).toEqual([
      "battlerGeometry[enemy-1]: 이름표/게이지가 필드 하단 밖으로 10px 잘렸다 (node.bottom=410 > field.bottom=400)",
    ]);
  });

  it("하단이 필드 밖으로 나가면 보고한다", () => {
    expect(evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 420)]))).toEqual([
      "battlerGeometry[enemy-1]: 필드 하단 밖으로 20px 잘렸다 (image.bottom=420 > field.bottom=400)",
      "battlerGeometry[enemy-1]: 이름표/게이지가 필드 하단 밖으로 40px 잘렸다 (node.bottom=440 > field.bottom=400)",
    ]);
  });

  it("적이 여러 마리면 마리마다 누적한다", () => {
    const reasons = evaluateBattlerGeometry(
      {},
      battlers([enemyBox("enemy-1", -13, 240), enemyAt("enemy-2", 340), enemyAt("enemy-3", 120)]),
    );

    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain("enemy-1");
    expect(reasons[1]).toContain("enemy-3");
  });

  it("최소 적 수를 못 채우면 보고한다 — 트룹이 안 떴는데 통과하면 안 된다", () => {
    expect(evaluateBattlerGeometry({ minEnemies: 3 }, battlers([enemyAt("enemy-1", 240)]))).toEqual([
      "battlerGeometry: 적 노드 1개 — 최소 3개 기대",
    ]);
  });

  it("스프라이트 노드가 없으면 통과시키지 않는다", () => {
    const enemy = { ...enemyAt("enemy-1", 240), image: null };

    expect(evaluateBattlerGeometry({}, battlers([enemy]))).toEqual([
      "battlerGeometry[enemy-1]: .battle-enemy-image 노드가 없다",
    ]);
  });

  it("크기 0 스프라이트는 통과시키지 않는다 — 안 그려진 것과 잘 놓인 것은 다르다", () => {
    const enemy = enemyAt("enemy-1", 240);
    const zeroSized = { ...enemy, image: { ...enemy.image, height: 0, width: 0 } };

    expect(evaluateBattlerGeometry({}, battlers([zeroSized]))).toEqual([
      "battlerGeometry[enemy-1]: 스프라이트 크기가 0 (0×0)",
    ]);
  });

  // 담기·지평선 축만으로는 통과하지만 화면에는 한 마리로 보인다(실측: rm2000/dragonquest/mv
  // 가 3마리 트룹의 세 노드를 완전히 같은 rect 에 그리면서 게이트를 통과했다).
  it("여러 마리가 같은 점에 쌓이면 보고한다", () => {
    const reasons = evaluateBattlerGeometry(
      {},
      battlers([enemyAt("enemy-1", 240), enemyAt("enemy-2", 240), enemyAt("enemy-3", 240)]),
    );

    expect(reasons).toEqual([
      "battlerGeometry[enemy-1/enemy-2]: 두 적이 같은 자리에 겹쳐 있다 (중심 거리 0×0px, 최소 25×25px)",
      "battlerGeometry[enemy-1/enemy-3]: 두 적이 같은 자리에 겹쳐 있다 (중심 거리 0×0px, 최소 25×25px)",
      "battlerGeometry[enemy-2/enemy-3]: 두 적이 같은 자리에 겹쳐 있다 (중심 거리 0×0px, 최소 25×25px)",
    ]);
  });

  it("줄만 달라도 겹침이 아니다 — 같은 열의 앞줄·뒷줄은 정상 배치다", () => {
    expect(
      evaluateBattlerGeometry({}, battlers([enemyAt("enemy-1", 260), enemyAt("enemy-2", 340)])),
    ).toEqual([]);
  });

  // 스프라이트 축과 독립이다: 간격이 넉넉해도 공용 이름표가 넓으면 글자만 겹친다
  // (실측: chrono 적 간격 38px 에 이름 18px 이 들어가 "슬라임동굴 박쥐슬라임" 으로 뭉개졌다).
  it("적 이름표 잉크 박스가 겹치면 보고한다 — 스프라이트가 안 겹쳐도 글자는 뭉개진다", () => {
    const withName = (id: string, centerX: number, nameLeft: number, nameRight: number) => ({
      ...enemyAt(id, centerX),
      name: { top: 300, bottom: 320, left: nameLeft, right: nameRight, width: nameRight - nameLeft, height: 20 },
    });

    const reasons = evaluateBattlerGeometry(
      {},
      battlers([withName("enemy-1", 260, 150, 260), withName("enemy-2", 340, 240, 350)]),
    );

    expect(reasons).toEqual([
      "battlerGeometry[enemy-1/enemy-2]: 적 이름표가 겹쳐 글자가 뭉개진다 (교차 20×20px)",
    ]);
  });

  it("이름표가 안 겹치면 통과한다 — 좁은 간격 자체는 결함이 아니다", () => {
    const withName = (id: string, centerX: number, nameLeft: number, nameRight: number) => ({
      ...enemyAt(id, centerX),
      name: { top: 300, bottom: 320, left: nameLeft, right: nameRight, width: nameRight - nameLeft, height: 20 },
    });

    expect(
      evaluateBattlerGeometry(
        {},
        battlers([withName("enemy-1", 260, 170, 230), withName("enemy-2", 340, 310, 370)]),
      ),
    ).toEqual([]);
  });

  // 적을 접지 띠까지 내리면 아군 진형 띠로 내려온다 — 실측으로 잡힌 결함(chrono y 86→48).
  it("적이 아군 스프라이트와 겹치면 보고한다", () => {
    const withAlly = {
      ...battlers([enemyAt("enemy-1", 300)]),
      allies: [{ id: "battle-actor-hero", image: { top: 250, bottom: 350, left: 150, right: 250, width: 100, height: 100 } }],
    };
    expect(evaluateBattlerGeometry({}, withAlly)).toEqual([
      "battlerGeometry[enemy-1/battle-actor-hero]: 적이 아군 스프라이트와 겹쳐 있다 (교차 50×50px)",
    ]);
  });

  it("적과 아군이 안 겹치면 통과한다", () => {
    const withAlly = {
      ...battlers([enemyAt("enemy-1", 300)]),
      allies: [{ id: "battle-actor-hero", image: { top: 250, bottom: 350, left: 300, right: 400, width: 100, height: 100 } }],
    };
    expect(evaluateBattlerGeometry({}, withAlly)).toEqual([]);
  });

  it("아군이 HUD 카드로만 표현되면(스프라이트 없음) 겹침을 보고하지 않는다", () => {
    const hudAlly = {
      ...battlers([enemyAt("enemy-1", 300)]),
      allies: [{ id: "battle-actor-hero", node: { top: 0, bottom: 400, left: 0, right: 600, width: 600, height: 400 } }],
    };
    expect(evaluateBattlerGeometry({}, hudAlly)).toEqual([]);
  });

  it("전투 화면이 아예 없으면 명시적으로 실패한다", () => {
    expect(evaluateBattlerGeometry({}, null)).toEqual([
      "battlerGeometry: 전투 화면(battle-scene/battle-field)이 없다 — 기하를 읽을 수 없다",
    ]);
  });

  it("expect 경유로도 같은 사유가 올라온다", () => {
    const reasons = evaluateExpect(
      { battlerGeometry: { minEnemies: 1 } },
      { ...observed, battlers: battlers([enemyBox("enemy-1", -13, 240)]) },
    );

    expect(reasons).toEqual([
      "battlerGeometry[enemy-1]: 필드 상단 밖으로 13px 잘렸다 (image.top=-13 < field.top=0)",
    ]);
  });
});
