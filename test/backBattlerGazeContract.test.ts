// 뒷모습 배틀러의 **시선 방향 계약**을 못박는다.
//
// 왜 필요한가: 포켓몬 스킨은 아군을 좌하단, 적을 우상단에 세운다. 아군 뒷모습이 적을 보게
// 하려면 방법이 둘인데 — CSS 로 좌우 반전하거나, 방향을 자산에 굽거나 — 이 저장소는 **후자**를
// 고른다(`_battlers.css:32-36` 이 레거시 `scaleX(-1)` 을 `transform: none !important` 로 취소).
//
// 초기 구현은 미러링이 걸린다고 **잘못 보고** 프롬프트에 "적은 좌상단" 이라 적었다. 그러면
// 재생성 때 등을 보인 채 적 반대쪽을 보는 그림이 나온다. 실제 전투 화면 QA 로 computed
// `transform: none` 을 확인해 바로잡았고(2026-08-29), 그 전제가 다시 뒤집히지 않게 여기서 잠근다.
//
// 이 테스트는 **프롬프트 문구와 CSS 를 함께** 본다. 둘 중 하나만 바뀌면 실패해야 한다 —
// 서로가 서로의 전제이기 때문이다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPOSITION_BACK, NEGATIVE_BACK } from "../scripts/asset-gen/battlerPrompt.mjs";

const battlersCss = readFileSync(new URL("../src/styles/runtime/battle-skins/_battlers.css", import.meta.url), "utf8");

describe("뒷모습 배틀러 시선 계약", () => {
  it("프롬프트는 적을 우상단으로 지시한다 — 좌상단이면 적 반대쪽을 본다", () => {
    expect(COMPOSITION_BACK).toContain("UPPER RIGHT");
    expect(COMPOSITION_BACK).not.toContain("UPPER LEFT");
    // 머리 각도 서술도 같은 방향이어야 한다.
    expect(COMPOSITION_BACK).toContain("angled right");
    expect(COMPOSITION_BACK).not.toContain("angled left");
  });

  it("CSS 가 포켓몬 아군 이미지의 좌우 반전을 취소한다 — 프롬프트가 이 전제로 그린다", () => {
    // `.battle-skin-actor-image` 를 잡는 포켓몬 규칙 안에 transform 취소가 있어야 한다.
    const pokemonActorRules = battlersCss.match(
      /\.battle-scene\[data-battle-skin="pokemon"\][^{]*\.battle-skin-actor-image\s*\{[^}]*\}/g,
    );
    expect(pokemonActorRules, "포켓몬 아군 이미지 규칙을 못 찾았다").not.toBeNull();
    const cancelsMirror = (pokemonActorRules ?? []).some((rule) => /transform:\s*none\s*!important/.test(rule));
    expect(
      cancelsMirror,
      "미러링 취소가 사라졌다. CSS 가 다시 scaleX(-1) 를 적용한다면 COMPOSITION_BACK 의 방향을 좌상단으로 되돌려야 한다.",
    ).toBe(true);
  });

  it("얼굴 금지 문구가 남아 있다 — 이게 빠지면 정면 얼굴이 나온다", () => {
    // 실측: 공통 NEGATIVE 는 정면 *보행* 스프라이트만 막아서 정면 전투 포즈가 통과했다.
    expect(NEGATIVE_BACK).toMatch(/face|eyes/i);
    expect(COMPOSITION_BACK).toContain("THE FACE IS COMPLETELY HIDDEN");
  });
});
