/**
 * 전투 애니메이션 앵커 계약 — 순수 함수 단위.
 *
 * 왜 여기서 재나: 예전 배치는 대상 노드의 `--battle-node-x/y`(배틀러의 **발** 을 가리키는
 * 백분율)를 문자열로 복사하고, `.battle-animation` 이 240×240 박스에 `translate(-50%, -55%)`
 * 를 걸어 시트 중심을 발에서 12px 위에 뒀다. 스프라이트가 144px 급이므로 이펙트는 몸통이
 * 아니라 발목 높이에 찍혔고, 저작 스키마의 `position`/`scope` 는 배치에 쓰이지 않았다.
 *
 * 이 계약을 브라우저로만 재면 애니메이션이 짧아 프레임을 놓치는 타이밍 운에 걸린다.
 * 산식을 순수 함수로 빼 rect 리터럴로 재면 운이 개입할 자리가 없다. 브라우저 쪽 증거는
 * `test/e2e/battle-animation-anchor.spec.ts` 가 실제 플레이 경로에서 따로 잡는다.
 */
import { describe, expect, it } from "vitest";
import {
  battleAnimationAnchor,
  isScreenAnchoredAnimation,
  type BattleAnchorBox,
} from "@/player/battleAnimationAnchor";

/** 무대(레이어) 400×300, 원점 (100, 50). 원점이 0 이 아니어야 좌표 빼기 누락이 드러난다. */
const LAYER: BattleAnchorBox = { left: 100, top: 50, width: 400, height: 300 };

/** 스프라이트 64×144. 레이어 안에서 가로 중심 (200), 상단 100, 하단 244. */
const SPRITE: BattleAnchorBox = { left: 168, top: 100, width: 64, height: 144 };

describe("battleAnimationAnchor — 저작된 position 이 세로 위치를 정한다", () => {
  it("center 는 스프라이트 세로 중심에 놓는다", () => {
    // 중심 y = 100 + 72 = 172 → 레이어 기준 (172 - 50) / 300 = 40.667%
    expect(battleAnimationAnchor({ position: "center", spriteBox: SPRITE, layerBox: LAYER })).toEqual({
      left: "25%",
      top: "40.667%",
      anchor: "center",
    });
  });

  it("head 는 스프라이트 상단에 놓는다", () => {
    // (100 - 50) / 300 = 16.667%
    expect(battleAnimationAnchor({ position: "head", spriteBox: SPRITE, layerBox: LAYER })?.top).toBe("16.667%");
  });

  it("feet 는 스프라이트 하단(접지선)에 놓는다", () => {
    // (244 - 50) / 300 = 64.667%
    expect(battleAnimationAnchor({ position: "feet", spriteBox: SPRITE, layerBox: LAYER })?.top).toBe("64.667%");
  });

  it("저작이 없으면 center 로 떨어진다 — RM2K3 기본값", () => {
    const resolved = battleAnimationAnchor({ spriteBox: SPRITE, layerBox: LAYER });
    expect(resolved).toEqual(battleAnimationAnchor({ position: "center", spriteBox: SPRITE, layerBox: LAYER }));
    expect(resolved?.anchor).toBe("center");
  });

  it("세 위치는 서로 다른 값이어야 한다 — 하나로 뭉개지면 계약이 죽은 것이다", () => {
    const tops = (["head", "center", "feet"] as const).map(
      (position) => battleAnimationAnchor({ position, spriteBox: SPRITE, layerBox: LAYER })?.top
    );
    expect(new Set(tops).size).toBe(3);
  });

  it("가로는 언제나 스프라이트 가로 중심이다", () => {
    for (const position of ["head", "center", "feet"] as const) {
      expect(battleAnimationAnchor({ position, spriteBox: SPRITE, layerBox: LAYER })?.left).toBe("25%");
    }
  });
});

describe("battleAnimationAnchor — screen 은 대상을 무시하고 무대 중심에 놓는다", () => {
  it("scope 가 screen 이면 스프라이트를 보지 않는다", () => {
    expect(battleAnimationAnchor({ scope: "screen", position: "center", layerBox: LAYER })).toEqual({
      left: "50%",
      top: "50%",
      anchor: "screen",
    });
  });

  it("position 이 screen 이어도 무대 중심이다", () => {
    expect(battleAnimationAnchor({ position: "screen", spriteBox: SPRITE, layerBox: LAYER })).toEqual({
      left: "50%",
      top: "50%",
      anchor: "screen",
    });
  });

  it("isScreenAnchoredAnimation 은 두 축 중 하나만 screen 이어도 참이다", () => {
    expect(isScreenAnchoredAnimation("screen", "center")).toBe(true);
    expect(isScreenAnchoredAnimation("singleTarget", "screen")).toBe(true);
    expect(isScreenAnchoredAnimation("singleTarget", "center")).toBe(false);
    expect(isScreenAnchoredAnimation(undefined, undefined)).toBe(false);
  });
});

describe("battleAnimationAnchor — 잴 수 없으면 폴백에 양보한다", () => {
  it("레이어를 못 재면 undefined", () => {
    expect(
      battleAnimationAnchor({ spriteBox: SPRITE, layerBox: { left: 0, top: 0, width: 0, height: 0 } })
    ).toBeUndefined();
  });

  it("스프라이트가 없으면 undefined — 대상 앵커 연출은 대상 없이 정의되지 않는다", () => {
    expect(battleAnimationAnchor({ position: "center", layerBox: LAYER })).toBeUndefined();
  });

  it("스프라이트 rect 가 0×0(아직 로드 전)이면 undefined", () => {
    expect(
      battleAnimationAnchor({ spriteBox: { left: 168, top: 100, width: 0, height: 0 }, layerBox: LAYER })
    ).toBeUndefined();
  });

  it("screen 연출은 스프라이트가 없어도 성립한다", () => {
    expect(battleAnimationAnchor({ scope: "screen", layerBox: LAYER })).toBeDefined();
  });
});

describe("battleAnimationAnchor — 무대 배율은 약분된다", () => {
  /**
   * `.battle-scene` 에는 `transform: scale(var(--battle-stage-scale))` 이 걸려 있어
   * `getBoundingClientRect` 는 배율이 곱해진 시각 px 을 준다. px 로 심으면 배율만큼
   * 어긋나지만, 같은 레이어 rect 로 나눈 비율에서는 배율이 사라진다. 이 성질이 깨지면
   * 창 크기에 따라 이펙트가 미끄러진다.
   */
  it("모든 rect 를 같은 배율로 확대·평행이동해도 같은 백분율이 나온다", () => {
    const scale = 1.75;
    const shift = 37;
    const scaled = (box: BattleAnchorBox): BattleAnchorBox => ({
      left: box.left * scale + shift,
      top: box.top * scale + shift,
      width: box.width * scale,
      height: box.height * scale,
    });
    for (const position of ["head", "center", "feet"] as const) {
      expect(battleAnimationAnchor({ position, spriteBox: scaled(SPRITE), layerBox: scaled(LAYER) })).toEqual(
        battleAnimationAnchor({ position, spriteBox: SPRITE, layerBox: LAYER })
      );
    }
  });
});
