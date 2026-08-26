import { afterEach, describe, expect, it } from "vitest";
import {
  findEntityMentions,
  renderEntityMentionStrip,
  type EntityMention,
} from "@/editor/panels/aiEntityMentions";
import { createBlankProject } from "@/project/defaults";
import type { EnemyRecord, ItemRecord } from "@/project/types";
import {
  findByTestId,
  installFakeDom,
  renderWithFakeDom,
  type FakeElement,
} from "./fakeDom";

describe("findEntityMentions", () => {
  it("finds an enemy and an item mentioned in one sentence, in text order", () => {
    const project = createBlankProject();
    project.database.enemies = [
      {
        id: "enemy_goblin",
        name: "고블린",
      } as EnemyRecord,
    ];
    project.database.items = [
      {
        id: "item_potion",
        name: "체력 물약",
      } as ItemRecord,
    ];

    const mentions = findEntityMentions(
      "상점에서 체력 물약을 사고 숲에서 고블린을 처치했다.",
      project
    );

    expect(mentions).toHaveLength(2);
    expect(mentions[0]).toEqual({
      collection: "items",
      id: "item_potion",
      name: "체력 물약",
      record: project.database.items[0],
    });
    expect(mentions[1]).toEqual({
      collection: "enemies",
      id: "enemy_goblin",
      name: "고블린",
      record: project.database.enemies[0],
    });
  });

  it("returns [] for text mentioning nothing, and [] for empty text", () => {
    const project = createBlankProject();
    project.database.enemies = [
      {
        id: "enemy_slime",
        name: "슬라임",
      } as EnemyRecord,
    ];

    expect(findEntityMentions("아무것도 일치하지 않는 문장입니다.", project)).toEqual([]);
    expect(findEntityMentions("", project)).toEqual([]);
    expect(findEntityMentions("   ", project)).toEqual([]);
  });

  it("prefers the longer name: a project with enemies named '슬라임' and '슬라임 왕' and text '슬라임 왕이 나타났다' yields exactly one mention, '슬라임 왕'", () => {
    const project = createBlankProject();
    project.database.enemies = [
      {
        id: "enemy_slime",
        name: "슬라임",
      } as EnemyRecord,
      {
        id: "enemy_king_slime",
        name: "슬라임 왕",
      } as EnemyRecord,
    ];

    const mentions = findEntityMentions("슬라임 왕이 나타났다", project);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]?.name).toBe("슬라임 왕");
    expect(mentions[0]?.id).toBe("enemy_king_slime");
  });

  it("honours the limit argument", () => {
    const project = createBlankProject();
    project.database.items = [
      { id: "item_1", name: "사과 물약" } as ItemRecord,
      { id: "item_2", name: "바나나 물약" } as ItemRecord,
      { id: "item_3", name: "포도 물약" } as ItemRecord,
    ];

    const text = "사과 물약, 바나나 물약, 포도 물약 중 하나를 고르세요.";
    const mentions = findEntityMentions(text, project, 2);
    expect(mentions).toHaveLength(2);
    expect(mentions.map((m) => m.name)).toEqual(["사과 물약", "바나나 물약"]);
  });
});

describe("renderEntityMentionStrip", () => {
  let restoreFakeDom: (() => void) | undefined;

  afterEach(() => {
    restoreFakeDom?.();
    restoreFakeDom = undefined;
  });

  it("returns null for [] and, for two mentions, produces a container with testid ai-mention-strip holding two chips whose names match", () => {
    restoreFakeDom = installFakeDom();
    const project = createBlankProject();

    expect(renderEntityMentionStrip([], project)).toBeNull();

    const mentions: EntityMention[] = [
      {
        collection: "enemies",
        id: "enemy_1",
        name: "불도깨비",
        record: { id: "enemy_1", name: "불도깨비" } as EnemyRecord,
      },
      {
        collection: "items",
        id: "item_1",
        name: "마나 포션",
        record: { id: "item_1", name: "마나 포션" } as ItemRecord,
      },
    ];

    const node = renderWithFakeDom(() =>
      renderEntityMentionStrip(mentions, project)!
    ) as FakeElement;

    expect(node).not.toBeNull();
    expect(node.dataset.testid).toBe("ai-mention-strip");
    expect(node.getAttribute("role")).toBe("list");
    expect(node.getAttribute("aria-label")).toBe("언급된 자료");

    const chip1 = findByTestId(node, "ai-mention-enemies-enemy_1");
    const chip2 = findByTestId(node, "ai-mention-items-item_1");

    expect(chip1).not.toBeNull();
    expect(chip2).not.toBeNull();

    expect(chip1?.getAttribute("role")).toBe("listitem");
    expect(chip1?.getAttribute("title")).toBe("불도깨비");
    expect(chip1?.querySelector(".ai-mention-name")?.textContent).toBe("불도깨비");

    expect(chip2?.getAttribute("role")).toBe("listitem");
    expect(chip2?.getAttribute("title")).toBe("마나 포션");
    expect(chip2?.querySelector(".ai-mention-name")?.textContent).toBe("마나 포션");
  });
});

// 라이브 턴에서 실측한 오탐(2026-08-26): 기본 프로젝트에는 "map", "ale", "egg", "bell",
// "bone", "coal" 같은 짧은 순수 ASCII 아이템 이름이 수십 개 있다. 부분 문자열 포함만으로
// 매칭하면 어시스턴트가 "현재 맵: 이슬 장터 마을 (mapvillage30_100x100)" 이라고 말하는
// 순간 아이템 "map" 썸네일이 붙는다 — 실제로 브라우저에서 붙는 것을 확인했다.
// 단어 경계가 없다는 근거는 **한글에만** 해당하므로, ASCII 이름은 경계를 요구한다.
describe("짧은 ASCII 이름 오탐", () => {
  function projectWithNames(itemNames: string[], enemyNames: string[] = []) {
    const project = createBlankProject();
    project.database.items = itemNames.map((name, i) => ({ id: `item_ascii_${i}`, name }) as ItemRecord);
    project.database.enemies = enemyNames.map((name, i) => ({ id: `enemy_ascii_${i}`, name }) as EnemyRecord);
    return project;
  }

  it('맵 id 문자열 안의 "map" 은 아이템 map 으로 보지 않는다', () => {
    const project = projectWithNames(["map"]);

    expect(findEntityMentions("현재 맵: 이슬 장터 마을 (mapvillage30_100x100)", project)).toEqual([]);
  });

  it("다른 영어 단어에 숨은 짧은 이름도 잡지 않는다", () => {
    const project = projectWithNames(["ale", "egg", "bell", "bone"]);

    const found = findEntityMentions("The female scale bellows; bones remain. eggplant.", project);

    expect(found.map((m) => m.name)).toEqual([]);
  });

  it("독립된 단어로 나오면 ASCII 이름도 정상 매칭한다", () => {
    const project = projectWithNames(["map", "ale"]);

    const found = findEntityMentions("상자에 map 과 ale 을 넣었습니다.", project);

    expect(found.map((m) => m.name).sort()).toEqual(["ale", "map"]);
  });

  it("한글 이름은 그대로 부분 문자열로 매칭한다(경계가 없으므로)", () => {
    const project = projectWithNames([], ["슬라임"]);

    expect(findEntityMentions("슬라임을 광장에 두었습니다.", project).map((m) => m.name)).toEqual(["슬라임"]);
  });
});
