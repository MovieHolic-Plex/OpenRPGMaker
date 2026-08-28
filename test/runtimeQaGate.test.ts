import { describe, expect, it } from "vitest";
import type { RuntimeQaBattler } from "../scripts/lib/runtimeQa.d.mts";
import { evaluateBattlerGeometry, evaluateExpect } from "../scripts/lib/runtimeQa.mjs";

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
});

// 배틀러 배치 판정. 이 게이트가 조용히 통과하면 "몬스터가 필드 위로 잘려 나간" 상태가
// 증거 없이 출하된다(실측: rm2003 앞줄 적 이미지 top=-13 vs field.top=24 → 37px 잘림).
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
    skin: "rm2003",
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
  // 실제로 생겼던 결함이다(rm2003 앞줄 node.bottom=464 > field.bottom=444).
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
