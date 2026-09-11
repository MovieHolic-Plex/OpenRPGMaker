import { describe, expect, it } from "vitest";
import {
  HOUSE_KIT_CHIPSET_KEY,
  houseKitTileset,
  housePreviewMap,
  previewKitFor,
  villageArchetypeShotUrl,
} from "@/editor/panels/villageHousePreview";
import { templateRecordFromDef } from "@/editor/panels/databaseVillageModel";
import { HOUSE_KITS } from "@/editor/houseKit";
import { createBlankProject } from "@/project/defaults";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import type { Project } from "@/project/types";
import type { VillageHouseTemplateRecord } from "@/project/types/village";

// 「마을」탭 그림의 검증 가능한 층.
//
// 캔버스는 유닛 테스트로 못 본다 — `test/fakeDom.ts` 의 `getContext()` 가 의도적으로 null 을
// 준다. 그래서 여기서는 **스탬프된 GameMap 의 타일 배열**을 단정한다: 지붕 타일이 실제로
// 들어갔는지, 재료가 무엇으로 풀렸는지, 재료를 못 구할 때 그림인 척하지 않는지.
// 픽셀은 e2e(`test/e2e/db-village-visual.spec.ts`)가 본다.

function record(overrides: Partial<VillageHouseTemplateRecord> = {}): VillageHouseTemplateRecord {
  return {
    id: "my-house",
    name: "내 집",
    w: 6,
    h: 6,
    stories: 1,
    wings: [{ x: 0, y: 0, w: 6, h: 6 }],
    ...overrides,
  };
}

/** 합본 마을 칩셋을 쓰는 타일셋이 하나도 없는 프로젝트 — 킷 타일 번호가 통하지 않는다. */
function withoutHouseKitChipset(): Project {
  const project = createBlankProject();
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.image.type === "bundled" && tileset.image.id === HOUSE_KIT_CHIPSET_KEY) {
      tileset.image = { type: "bundled", id: "tex_easyrpg_chipset_dungeon" };
    }
  }
  return project;
}

describe("집 미리보기 — 재료 찾기", () => {
  it("기본 프로젝트에서 합본 마을 칩셋 타일셋을 찾는다", () => {
    const tileset = houseKitTileset(createBlankProject());
    expect(tileset).toBeDefined();
    expect(tileset?.image).toMatchObject({ type: "bundled", id: HOUSE_KIT_CHIPSET_KEY });
  });

  // 킷 타일 번호(406·467·374…)는 합본 마을 칩셋의 번호 체계에 종속이다. 다른 칩셋으로
  // 그리면 엉뚱한 그림이 나오므로 "집 그림인 척" 하지 않고 물러난다.
  it("합본 마을 칩셋이 없으면 재료를 못 구한다고 말한다", () => {
    expect(houseKitTileset(withoutHouseKitChipset())).toBeUndefined();
    expect(housePreviewMap(record(), withoutHouseKitChipset())).toBeUndefined();
  });
});

describe("집 미리보기 — 재료 킷 해석", () => {
  it("레코드가 킷을 정하면 그 킷을 쓴다", () => {
    expect(previewKitFor(record({ kitId: "timber-hall" }))).toBe("timber-hall");
  });

  it("모르는 킷 이름은 무시하고 안정적으로 하나 고른다", () => {
    const chosen = previewKitFor(record({ kitId: "nope" }));
    expect(Object.keys(HOUSE_KITS)).toContain(chosen);
    // 같은 레코드는 늘 같은 재료 — 카드가 다시 그려질 때마다 색이 바뀌면 안 된다.
    expect(previewKitFor(record({ kitId: "nope" }))).toBe(chosen);
  });

  it("킷이 비어 있어도 그림이 나오게 id 해시로 고른다", () => {
    const a = previewKitFor(record({ id: "house-a" }));
    const b = previewKitFor(record({ id: "house-b" }));
    expect(Object.keys(HOUSE_KITS)).toContain(a);
    expect(Object.keys(HOUSE_KITS)).toContain(b);
  });
});

describe("집 미리보기 — 스크래치 맵", () => {
  it("집 둘레에 잔디 여백을 한 칸 남긴다", () => {
    const scratch = housePreviewMap(record(), createBlankProject())!;
    expect(scratch.map.width).toBe(8);
    expect(scratch.map.height).toBe(8);
  });

  it("지붕과 벽 타일이 실제로 들어간다", () => {
    const scratch = housePreviewMap(record({ kitId: "blue-stone" }), createBlankProject())!;
    const kit = HOUSE_KITS["blue-stone"];
    const tiles = new Set([...scratch.map.lowerTiles, ...scratch.map.upperTiles]);
    // 파랑 평지붕 몸통·처마와 벽 9분할 하단행은 이 킷의 정본 타일 번호다.
    expect(kit.roof.kind).toBe("blue");
    if (kit.roof.kind !== "blue") return;
    expect(tiles.has(kit.roof.body), "지붕 몸통").toBe(true);
    expect(tiles.has(kit.roof.eave), "처마").toBe(true);
    for (const tile of kit.wall.bottom) expect(tiles.has(tile), `벽 하단 ${tile}`).toBe(true);
    // 여백 칸은 집이 아니라 잔디다 — 스탬프가 맵 전체를 덮지 않았다.
    expect(kit.wall.bottom).not.toContain(scratch.map.lowerTiles[0]!);
  });

  it("날개가 없거나 치수가 망가진 레코드는 반쯤 그린 집을 내지 않는다", () => {
    const project = createBlankProject();
    expect(housePreviewMap(record({ wings: [] }), project)).toBeUndefined();
    expect(housePreviewMap(record({ wings: [{ x: 0, y: 0, w: Number.NaN, h: 6 }] }), project)).toBeUndefined();
  });

  // 규약 위반 레코드는 스탬프가 거절한다. 화면은 그때 추상 격자로 내려앉으므로,
  // 여기서 undefined 를 내는 것이 계약이다.
  it("규약을 어긴 형태는 undefined 를 낸다", () => {
    const tooThin = housePreviewMap(record({ w: 2, h: 6, wings: [{ x: 0, y: 0, w: 2, h: 6 }] }), createBlankProject());
    expect(tooThin).toBeUndefined();
  });

  // 옥상은 지붕 위에 판자(상위 레이어)를 얹는 별도 패스다. 미리보기가 그 패스를 안 부르면
  // 「옥상」 체크박스를 켜도 그림이 그대로여서 사용자는 값이 먹었는지 알 수 없다.
  it("옥상 레코드는 옥상 데크까지 얹는다", () => {
    const project = createBlankProject();
    const deck = HOUSE_TEMPLATE_DEFS.find((def) => def.roofDeck === true);
    expect(deck, "내장에 옥상 형태가 있어야 이 테스트가 의미를 갖는다").toBeDefined();
    const withDeck = housePreviewMap(templateRecordFromDef(deck!, "my-deck"), project)!;
    const noDeck = housePreviewMap({ ...templateRecordFromDef(deck!, "my-plain"), roofDeck: undefined }, project)!;
    // 데크·사다리는 상위 레이어에만 쓴다 — 하위(지붕 자체)는 그대로여야 한다.
    expect(withDeck.map.lowerTiles.join(",")).toBe(noDeck.map.lowerTiles.join(","));
    expect(withDeck.map.upperTiles.join(",")).not.toBe(noDeck.map.upperTiles.join(","));
  });

  // 내장 34종은 하네스가 실제로 잘 짓는 형태들이다 — 갤러리가 그 34장을 다 그려야
  // "그림으로 고르기" 가 성립한다. 한 장이라도 못 그리면 카드가 빈 칸으로 남는다.
  it("내장 34종을 전부 그릴 수 있다", () => {
    const project = createBlankProject();
    const failed = HOUSE_TEMPLATE_DEFS.filter(
      (def) => housePreviewMap(templateRecordFromDef(def, def.id, def.name), project) === undefined,
    ).map((def) => def.id);
    expect(failed).toEqual([]);
  });
});

describe("마을 원형 전경 그림 경로", () => {
  it("구운 PNG 를 상대 경로로 가리킨다", () => {
    expect(villageArchetypeShotUrl("farm-rural")).toBe("assets/village-preview/farm-rural.png");
  });
});
