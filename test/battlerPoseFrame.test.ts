/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { POSE_FRAME, type BattleBattlerPose } from "@/battle/battlePose";
import { createBattleRuntime } from "@/battle/runtime";
import { applyBattlerPoseForTest, battleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 이 테스트가 지키는 것: **backgroundPosition 산식**.
//
// 왜 픽셀이 아니라 산식인가: 2026-08-29 까지 계약 테스트에는 "행 0 아래 8px 띠가 투명하다" 는
// 가드가 있었다. 그건 런타임이 Y 를 절대 움직이지 않는다는 전제의 구조적 방어선이었고,
// 오슬라이스 회귀(발밑에 아랫행 머리 16px 이 따라오던 증상)를 그림 쪽에서 막았다.
// 행 1(defend/dead)을 쓰기 시작하면 그 전제가 깨져 띠 가드를 유지할 수 없다.
// 그래서 방어선을 그림에서 **산식**으로 옮긴다 — 5포즈가 각각 정확히 어느 칸을 가리키는지
// 문자열로 못 박으면, 열·행이 어긋나는 회귀는 여기서 즉시 걸린다.
//
// 96px 은 실제 값이다: BATTLE_SHEET_CELL(48) × BATTLE_ASSET_PIXEL_SCALE(2).
const FRAME = 96;

// 0 은 "0px" 로 쓴다 — CSSOM 이 "-0px" 를 "0px" 로 정규화해서, 음수 부호를 붙이면
// 우리가 쓴 값과 읽히는 값이 달라진다.
const EXPECTED: Record<BattleBattlerPose, string> = {
  idle: "0px 0px",
  attack: `-${FRAME}px 0px`,
  hit: `-${FRAME * 2}px 0px`,
  defend: `0px -${FRAME}px`,
  dead: `-${FRAME}px -${FRAME}px`,
};

function makeNode(): HTMLElement {
  const node = document.createElement("div");
  const sprite = document.createElement("span");
  sprite.className = "battle-actor-sprite";
  sprite.style.setProperty("--battle-sprite-frame-width", `${FRAME}px`);
  sprite.style.setProperty("--battle-sprite-frame-height", `${FRAME}px`);
  sprite.style.backgroundPosition = "0 0";
  node.append(sprite);
  return node;
}

describe("applyBattlerPose background position", () => {
  let node: HTMLElement;

  beforeEach(() => {
    node = makeNode();
  });

  it.each(Object.keys(POSE_FRAME) as BattleBattlerPose[])("%s 포즈가 지정된 칸을 가리킨다", (pose) => {
    applyBattlerPoseForTest(node, pose);

    const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
    expect(sprite?.style.backgroundPosition).toBe(EXPECTED[pose]);
    expect(node.dataset.battlePose).toBe(pose);
  });

  it("defend 와 dead 가 행 1 을 쓴다 — 예전처럼 idle/hit 칸을 돌려 쓰지 않는다", () => {
    expect(POSE_FRAME.defend).not.toEqual(POSE_FRAME.idle);
    expect(POSE_FRAME.dead).not.toEqual(POSE_FRAME.hit);
    expect(POSE_FRAME.defend.row).toBe(1);
    expect(POSE_FRAME.dead.row).toBe(1);
  });

  it("다섯 포즈가 서로 다른 칸을 쓴다", () => {
    const keys = Object.values(POSE_FRAME).map((frame) => `${frame.col},${frame.row}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // 여기까지는 산식만 잰다. 아래는 **실제 전투 필드를 렌더해서** 스냅샷의 포즈가 시트의
  // 어느 칸으로 이어지는지 본다 — 런타임 스크린샷(Playwright)이 이 환경에서 안 돌아가므로,
  // DOM 레벨에서 같은 경로를 태우는 것이 가장 강한 증거다.
  it.each([
    ["defend", `0px -${FRAME}px`],
    ["dead", `-${FRAME}px -${FRAME}px`],
  ] as const)("전투 필드 렌더에서 %s 포즈가 행 1 을 가리킨다", (pose, expected) => {
    const project = deserialize(JSON.stringify(battleFixture));
    // 48px 전투 시트(.battle-actor-sprite)는 **정면(front) 파티 스킨**에서만 필드에 선다. 픽스처 기본
    // 스킨(rm2000)은 뒷모습 <img> 를 쓰므로 여기서는 사이드뷰 스킨을 명시한다.
    (project.system as { battleUiStyle?: string }).battleUiStyle = "retro2003";
    store.replace(project);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      rng: () => 0.5,
    });
    const snapshot = runtime.snapshot();
    const actor = snapshot.actors[0];
    expect(actor, "픽스처에 아군 배틀러가 있다").toBeTruthy();
    // 스냅샷은 타입만 readonly 인 순수 객체다. 포즈만 바꿔 렌더 경로를 태운다.
    (actor as { pose: BattleBattlerPose }).pose = pose;

    const field = battleField(snapshot);
    const sprite = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor-sprite");

    expect(sprite, "아군이 생성 전투 시트로 그려진다").toBeTruthy();
    expect(sprite?.style.backgroundPosition).toBe(expected);
    // 시트 전체가 (프레임×3)×(프레임×8) 로 깔려야 행 1 이 프레임 안에 들어온다.
    expect(sprite?.style.backgroundSize).toBe(`${FRAME * 3}px ${FRAME * 8}px`);
  });

  it("커스텀 프로퍼티가 없으면 기본 프레임 크기로 떨어진다", () => {
    const bare = document.createElement("div");
    const sprite = document.createElement("span");
    sprite.className = "battle-actor-sprite";
    bare.append(sprite);

    applyBattlerPoseForTest(bare, "dead");

    // 기본값도 BATTLE_SHEET_CELL × BATTLE_ASSET_PIXEL_SCALE = 96 이다.
    expect(sprite.style.backgroundPosition).toBe(`-${FRAME}px -${FRAME}px`);
  });
});
