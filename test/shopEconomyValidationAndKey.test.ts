import { describe, expect, it } from "vitest";

import { createSampleAdventureProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { shopKeyOf } from "@/player/playSceneShopVisit";

/**
 * PR #300 병합 시 고친 차단 결함 2건의 계약.
 *
 * 둘 다 "조용히 잘못 동작한다" 부류다 — 오류도 경고도 없이 저자 의도와 다르게 굴러간다.
 * 그래서 눈으로는 못 잡고 테스트로 고정해야 한다.
 *
 * 페이지를 손으로 만들지 않고 **실제 프로젝트의 이벤트 페이지를 복제해** 명령만 갈아 끼운다.
 * 손 리터럴은 검증기가 요구하는 필드(name·conditions·graphic·movement…)를 계속 놓쳐서
 * 정작 재려는 것과 무관한 실패를 낸다 — 빌더를 우회하는 리터럴이 함정이라는 기록 그대로다.
 */

function projectWithShopCommand(economy?: unknown, restockPolicy?: unknown): string {
  const project = createSampleAdventureProject();
  const map = project.maps[project.startMapId];
  const page = map.events[0].pages[0];
  page.commands = [
    {
      kind: "shop",
      itemIds: ["item_potion"],
      ...(economy === undefined ? {} : { economy }),
      ...(restockPolicy === undefined ? {} : { restockPolicy }),
    } as never,
  ];
  return JSON.stringify(JSON.parse(serialize(project)));
}

describe("저작된 상점 economy 는 로드 경계에서 검사된다", () => {
  it("정상 값은 통과한다", () => {
    const raw = projectWithShopCommand(
      { haggleEnabled: true, shopkeeperEnabled: false, haggle: { patience: 3, insultRatio: 0.4, maxDiscount: 0.3 } },
      "daily",
    );
    expect(() => deserialize(raw)).not.toThrow();
  });

  // 런타임이 `=== true` 로 엄격히 보므로 참 같은 문자열은 기능을 조용히 끈다.
  // 저자가 켠 기능이 오류도 경고도 없이 꺼지는 것이 이 검사가 막는 실패다.
  it("참 같은 문자열을 boolean 자리에 넣으면 막는다", () => {
    expect(() => deserialize(projectWithShopCommand({ haggleEnabled: "yes" }))).toThrow(/haggleEnabled/);
  });

  it("boolean 자리의 배열도 막는다", () => {
    expect(() => deserialize(projectWithShopCommand({ shopkeeperEnabled: [] }))).toThrow(/shopkeeperEnabled/);
  });

  it("무한대에 가까운 흥정 수치를 막는다", () => {
    expect(() => deserialize(projectWithShopCommand({ haggle: { insultRatio: 1.79e308 } }))).toThrow(/insultRatio/);
  });

  it("음수 인내심을 막는다", () => {
    expect(() => deserialize(projectWithShopCommand({ haggle: { patience: -999 } }))).toThrow(/patience/);
  });

  // 런타임 shouldRestock 은 유니온 밖이면 false 로 떨어진다 = "재입고 안 함".
  // 오타가 조용히 기능을 끄는 같은 부류다.
  it("유니온 밖 restockPolicy 를 막는다", () => {
    expect(() => deserialize(projectWithShopCommand(undefined, "hourly"))).toThrow(/restockPolicy/);
  });
});

describe("상점 원장 키는 상점마다 다르다", () => {
  it("맵+이벤트가 다르면 키가 다르다 — 대장간과 잡화점이 지갑을 공유하지 않는다", () => {
    expect(shopKeyOf({}, { mapId: "map_town", eventId: "ev_smith" })).not.toBe(
      shopKeyOf({}, { mapId: "map_town", eventId: "ev_store" }),
    );
  });

  it("같은 이벤트를 다시 방문하면 같은 키다 — 지갑이 이어진다", () => {
    expect(shopKeyOf({}, { mapId: "map_town", eventId: "ev_smith" })).toBe(
      shopKeyOf({}, { mapId: "map_town", eventId: "ev_smith" }),
    );
  });

  it("다른 맵의 같은 이벤트 id 도 갈린다", () => {
    expect(shopKeyOf({}, { mapId: "map_town", eventId: "ev_shop" })).not.toBe(
      shopKeyOf({}, { mapId: "map_port", eventId: "ev_shop" }),
    );
  });

  it("loyaltyTierId 가 있으면 그것이 이긴다 — 여러 이벤트가 한 상인을 공유하는 저작", () => {
    expect(shopKeyOf({ loyaltyTierId: "tier_gil" }, { mapId: "map_town", eventId: "ev_a" })).toBe(
      shopKeyOf({ loyaltyTierId: "tier_gil" }, { mapId: "map_port", eventId: "ev_b" }),
    );
  });

  it("신원을 모르면 전역으로 떨어지되 맵만 알면 맵으로 가른다", () => {
    expect(shopKeyOf({})).toBe("global");
    expect(shopKeyOf({}, { mapId: "map_town" })).toBe("map:map_town");
  });
});
