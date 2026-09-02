/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 이 테스트가 지키는 것: **아군 스프라이트 선택 순서**.
//
// 후면 구도 스킨(포켓몬 등)은 여태 파티 전원에게 `bskin-ally-creature-back` 한 장을 돌려 줬다.
// 어느 액터를 넣어도 같은 보라색 생물이 뒤통수를 보였다는 뜻이다. 2026-08-29 부터 액터별
// 뒷모습(`generated-actor-<slug>-back`)이 있으면 그걸 먼저 쓴다.
//
// 순서가 네 단계라 회귀가 조용히 난다 — 액터별 뒷모습이 빠져도 공용 한 장으로 "그려지긴"
// 하므로 렌더 성공만 보는 테스트는 통과한다. 그래서 **어느 파일이 붙었는지**를 못 박는다.

type Skin = "pokemon" | "rm2000";

function renderField(options: {
  readonly skin: Skin;
  readonly battleCharacterResourceId?: string;
}): HTMLElement {
  const project = deserialize(JSON.stringify(battleFixture));
  // system.battleUiStyle 이 스킨을 정한다(resolveSkinId). 픽스처는 비어 있어 기본 스킨이다.
  (project.system as { battleUiStyle?: string }).battleUiStyle = options.skin;
  store.replace(project);
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    rng: () => 0.5,
  });
  const snapshot: BattleSnapshot = runtime.snapshot();
  const actor = snapshot.actors[0];
  expect(actor, "픽스처에 아군 배틀러가 있다").toBeTruthy();
  if (options.battleCharacterResourceId !== undefined) {
    // 스냅샷은 타입만 readonly 인 순수 객체다. 시트 id 만 갈아 선택 경로를 태운다.
    (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId =
      options.battleCharacterResourceId;
  }
  return battleField(snapshot);
}

function allyImage(field: HTMLElement): HTMLImageElement | null {
  return field.querySelector<HTMLImageElement>(".battle-actor-group .battle-actor-image");
}

describe("아군 배틀러 스프라이트 선택", () => {
  it.each(["hero-01", "hero-03", "hero-06"])(
    "후면 스킨에서 %s 는 자기 뒷모습을 쓴다",
    (slug) => {
      const field = renderField({
        skin: "pokemon",
        battleCharacterResourceId: `generated-actor-${slug}-battle`,
      });

      const image = allyImage(field);
      expect(image?.getAttribute("src")).toBe(
        `/assets/generated/battle-skins/sprites/${slug}-back.png`,
      );
      const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
      expect(node?.dataset.actorBackBattler).toBe("true");
      expect(node?.dataset.partyFacing).toBe("back");
    },
  );

  it("여섯 액터가 서로 다른 뒷모습을 쓴다 — 예전처럼 한 장을 돌려 쓰지 않는다", () => {
    const sources = ["hero-01", "hero-02", "hero-03", "hero-04", "hero-05", "hero-06"].map((slug) => {
      const field = renderField({
        skin: "pokemon",
        battleCharacterResourceId: `generated-actor-${slug}-battle`,
      });
      return allyImage(field)?.getAttribute("src");
    });

    expect(sources.every((src) => typeof src === "string")).toBe(true);
    expect(new Set(sources).size).toBe(6);
  });

  it("뒷모습이 없는 시트는 예전 공용 스프라이트로 떨어진다", () => {
    // 픽스처의 원래 값("hero")은 generated-actor-<slug>-battle 형식이 아니라 슬러그를 못 뽑는다.
    const field = renderField({ skin: "pokemon" });

    const image = allyImage(field);
    expect(image?.getAttribute("src")).toBe(
      "/assets/generated/battle-skins/sprites/ally-creature-back.png",
    );
    const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
    expect(node?.dataset.actorBackBattler).toBeUndefined();
  });

  it("리졸브되지 않는 슬러그도 공용 스프라이트로 떨어진다", () => {
    // 형식은 맞지만 그림이 없는 경우. id 를 만들었다는 이유만으로 깨진 src 를 붙이면 안 된다.
    const field = renderField({
      skin: "pokemon",
      battleCharacterResourceId: "generated-actor-hero-99-battle",
    });

    const image = allyImage(field);
    expect(image?.getAttribute("src")).toBe(
      "/assets/generated/battle-skins/sprites/ally-creature-back.png",
    );
    const node = field.querySelector<HTMLElement>(".battle-actor-group .battle-actor");
    expect(node?.dataset.actorBackBattler).toBeUndefined();
  });

  it("rm2000 전면 구도는 아군 스프라이트 노드를 만들지 않는다", () => {
    const field = renderField({
      skin: "rm2000",
      battleCharacterResourceId: "generated-actor-hero-03-battle",
    });

    const group = field.querySelector<HTMLElement>(".battle-actor-group");
    expect(group?.dataset.partyFacing).toBe("hidden");
    expect(group?.dataset.hidden).toBe("true");
    expect(field.querySelector(".battle-actor-group .battle-actor")).toBeNull();
  });
});
