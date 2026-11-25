import { describe, expect, it } from "vitest";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroHouse";
import { bundledTileSemantics } from "@/assets/resourceSearch";
import { bundledTileLabels } from "@/editor/tools/tileMetadataTools";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsDungeon";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroDungeon";
import { RETRO_WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroWorld";
import { SHIP_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsWorld";
import type { TilesetDef } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// 픽셀이 거의 같은 칩셋끼리는 라벨도 거의 같아야 한다.
//
// 왜 이 테스트가 존재하는가 (실측): 번들 칩셋 PNG 를 전수 대조해 보니
// easyrpg-chipset-retro-exterior-transparent.png 와 retro-house-transparent.png 는
// **RGB 차이가 0.4%** 다. 사실상 같은 그림이다. 그런데 출하되던 두 시맨틱 테이블은
// 공통 478칸에서 **role 일치 24.5%, label 일치 0.0%** 였다.
// 같은 그림을 설명하는 두 표가 4분의 3이 어긋난다는 건 최소 하나가 그림을 안 보고 쓰였다는 뜻이다.
// 실제로 같은 픽셀(12~17)을 한쪽은 "갈아엎은 흙밭", 다른 쪽은 "나무 침대 머리"라고 적어 놨고,
// 그림에서는 조석 벽판 위 목조 머리보였다.
//
// 이 불일치는 색·통행성만 보던 기존 감사로는 잡히지 않았다. 두 표를 서로 비교해야만 드러난다.
// 그래서 "중복 시트 간 role 합치도" 를 불변식으로 고정한다. 다시 24% 로 주저앉으면 빨간불이다.
//
// 임계값 70%: 재감사 후 실측 82.0%(출하 24.5%). 100% 를 요구하지 않는 이유가 둘 있다.
//   1) 두 시트가 완전히 같은 그림은 아니다 — 0.4% 픽셀은 실제로 다른 타일이다.
//   2) 판독이 갈린 688칸은 지어내지 않고 기존 라벨을 그대로 두는데, 기존 라벨이 두 표에서
//      서로 다르므로 그만큼은 구조적으로 어긋난 채 남는다.
// 이 테스트가 잡아야 하는 건 미세한 변동이 아니라 24% 수준으로 되돌아가는 붕괴다.
// 그래서 실측값에 딱 붙이지 않고 여유를 둔다.
describe("tileSemanticsDuplicateSheetConsistency", () => {
  isolateTimers();
  describe("중복 칩셋 시트의 라벨 합치도", () => {
    it("같은 그림이므로 두 테이블의 role 이 70% 이상 일치한다", () => {
      const house = new Map(RETRO_HOUSE_TILE_SEMANTICS.map((e) => [e.index, e]));
      let shared = 0;
      let sameRole = 0;
      const drift: string[] = [];
      for (const ext of RETRO_EXTERIOR_TILE_SEMANTICS) {
        const hou = house.get(ext.index);
        if (!hou) continue;
        shared += 1;
        if (ext.role === hou.role) sameRole += 1;
        else if (drift.length < 12) drift.push(`${ext.index}: exterior=${ext.label}(${ext.role}) house=${hou.label}(${hou.role})`);
      }
      expect(shared).toBeGreaterThan(400);
      const ratio = sameRole / shared;
      expect(
        ratio,
        `같은 그림인데 role 이 ${(100 * ratio).toFixed(1)}% 만 일치한다. 한쪽 표가 그림을 안 보고 쓰였을 수 있다.\n` +
          `어긋난 칸 예시:\n  ${drift.join("\n  ")}`,
      ).toBeGreaterThanOrEqual(0.7);
    });

    it("두 테이블 모두 12~17 을 침대나 흙밭이 아니라 벽으로 본다", () => {
      // 실측 회귀 지점: 이 여섯 칸은 조석/회벽 벽판 위의 목조 머리보다.
      // 3x2 크롭만 보면 2단 침대로 읽히고(PR #86 이 그렇게 읽었다), 아래 4행까지 붙여 보면 벽이다.
      for (const table of [RETRO_EXTERIOR_TILE_SEMANTICS, RETRO_HOUSE_TILE_SEMANTICS]) {
        const byIndex = new Map(table.map((e) => [e.index, e]));
        for (const index of [12, 13, 14, 15, 16, 17]) {
          const entry = byIndex.get(index);
          expect(entry, `${index} 칸이 표에 없다`).toBeDefined();
          expect(entry!.role, `${index} 은 "${entry!.label}"(${entry!.role}) 로 적혀 있다`).toBe("wall");
        }
      }
    });
  });
});

// 렌더된 그림을 실제로 보고 판정한 사실만 단정한다.
//
// 왜 이 테스트가 존재하는가: 이 시트들의 라벨은 두 번 틀렸고, 두 번 다 기존 게이트를 통과했다.
//
// 1차 오류(PR #81) — 판독자가 타일을 볼 수 없었다. 샤드 shard-retro_exterior-08-11 은
//   카테고리 unspecified-low 로 갔고 그 1순위 모델(cliproxy/deepseek-v4-flash-0731)은 비전이 없다.
//   그 샤드는 완료 보고에 "the model couldn't render them as images" 라 적고 픽셀 통계로
//   119칸을 추론했다. audit-tile-semantics-grounding.mts 는 색·통행성 모순만 보므로
//   "가구를 벽이라 부르는" 종류를 원리적으로 못 잡고 위반 2/2856 으로 통과시켰다.
//
// 2차 오류(PR #86) — 교정하던 내가 3x2 크롭만 보고 아래 행을 잘라냈다. retro_house 12-17 을
//   "나무 침대"+role=furniture 로 바꿨는데, 10배 확대 + 아래 4행 맥락으로 보면 그 여섯 칸은
//   건물 벽 상단 목재 머리보이고 아래로 42-44/72-74=분홍 조석 벽판, 45-47/75-77=크림 회벽판이
//   아치로 이어진다. 침대가 아니다. #86 의 "roof slot now resolves to 42-44" 도 같은 이유로 틀렸다.
//   증거: .omo/evidence/tile-reaudit/vision-probe/house-cols10-19-rows0-4.png
//
// 그래서 이 테스트는 "라벨 문구"가 아니라 **그림이 반증한 주장**만 못 박는다. 문구 자체를
// 고정하면 저작 자유를 죽이고 동어반복이 된다. 반증 가능한 명제만 단정한다.
describe("tileSemanticsReauditEvidence", () => {
  isolateTimers();
  interface Entry {
    readonly index: number;
    readonly label: string;
    readonly role: string;
    readonly passage: "passable" | "solid";
    readonly tags: readonly string[];
  }
  function at(table: readonly Entry[], index: number): Entry {
    const found = table.find((entry) => entry.index === index);
    expect(found, `인덱스 ${index} 엔트리가 있어야 한다`).toBeDefined();
    return found!;
  }
  describe("retro_house 12-17 — 벽 상단 머리보이고 침대가 아니다", () => {
    const BEAM_SLOTS = [12, 13, 14, 15, 16, 17] as const;

    it.each(BEAM_SLOTS)("타일 %i 를 가구로 부르지 않는다", (index) => {
      const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
      // 아래로 벽판이 이어지므로 이 칸은 벽 구조의 일부다. 독립 가구가 아니다.
      expect(entry.role).not.toBe("furniture");
    });

    it.each(BEAM_SLOTS)("타일 %i 라벨이 침대를 주장하지 않는다", (index) => {
      const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
      expect(entry.label).not.toContain("침대");
      expect(entry.tags.join(" ")).not.toContain("침대");
    });

    it("42-44 는 지붕이 아니라 벽판이다 — #86 의 roof 재배정도 틀렸다", () => {
      for (const index of [42, 43, 44]) {
        const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
        expect(entry.role, `타일 ${index} 는 분홍 조석 벽판이다`).not.toBe("roof");
      }
    });
  });
  describe("retro_exterior 179 — 금빛 문장 든 붉은 깃발이고 지붕이 아니다", () => {
    it("179 를 지붕으로 부르지 않는다", () => {
      const entry = at(RETRO_EXTERIOR_TILE_SEMANTICS, 179);
      // 179 는 5행 29열(맨 오른쪽 끝)이라 180·181 은 다음 행으로 넘어가 이웃이 아니다.
      // 아래 209 와 이어져 제비꼬리 하단이 드러난다 = 깃발/페넌트.
      expect(entry.role).not.toBe("roof");
      expect(entry.label).not.toContain("지붕");
      expect(entry.label).not.toContain("처마");
    });

    it("179 와 209 가 같은 깃발의 위아래로 읽힌다", () => {
      const top = at(RETRO_EXTERIOR_TILE_SEMANTICS, 179);
      const bottom = at(RETRO_EXTERIOR_TILE_SEMANTICS, 209);
      expect(`${top.label} ${top.tags.join(" ")}`).toContain("깃발");
      expect(`${bottom.label} ${bottom.tags.join(" ")}`).toContain("깃발");
    });
  });
});

// EasyRPG 번들 칩셋 6종(retro_dungeon/retro_exterior/retro_house/retro_world/ship/world)의
// 시맨틱 테이블이 **칩셋별로 정확히 배선**되는지 단정한다.
//
// 왜 이 테스트가 존재하는가: resourceSearch.ts 의 폴백이
//   if (tileset?.image.type === "bundled") return COMBINED_TOWN_TILE_SEMANTICS;
// 였기 때문에, interior/dungeon 이 아닌 모든 번들 칩셋(배·월드맵·레트로 4종)이 **마을 라벨을
// 오답으로** 받아 갔다. AI 검색과 타일 라벨 조회가 전부 다른 칩셋의 사실을 인용하게 된다.
// 이 테스트는 그 오답을 재발 시 즉시 빨간불로 만든다.
describe("tileSemanticsSixChipsets", () => {
  isolateTimers();
  function bundledTileset(textureKey: string): TilesetDef {
    return {
      id: `test-${textureKey}`,
      name: textureKey,
      image: { type: "bundled", id: textureKey },
      tileSize: 16,
      columns: 30,
      rows: 16,
    } as unknown as TilesetDef;
  }
  /** 6종 + 기존 3종 = 배선이 정확히 9갈래로 갈라져야 한다. */
  const WIRING = [
    { textureKey: "tex_easyrpg_chipset_retro_dungeon", table: RETRO_DUNGEON_TILE_SEMANTICS, drawable: 478 },
    { textureKey: "tex_easyrpg_chipset_retro_exterior", table: RETRO_EXTERIOR_TILE_SEMANTICS, drawable: 478 },
    { textureKey: "tex_easyrpg_chipset_retro_house", table: RETRO_HOUSE_TILE_SEMANTICS, drawable: 478 },
    { textureKey: "tex_easyrpg_chipset_retro_world", table: RETRO_WORLD_TILE_SEMANTICS, drawable: 480 },
    { textureKey: "tex_easyrpg_chipset_ship", table: SHIP_TILE_SEMANTICS, drawable: 464 },
    { textureKey: "tex_easyrpg_chipset_world", table: WORLD_TILE_SEMANTICS, drawable: 478 },
  ] as const;
  describe("6종 번들 칩셋 시맨틱 배선", () => {
    it.each(WIRING)("$textureKey 는 자기 전용 테이블을 돌려준다", ({ textureKey, table }) => {
      const resolved = bundledTileSemantics(bundledTileset(textureKey));
      expect(resolved).toBe(table);
    });

    it.each(WIRING)("$textureKey 는 마을 테이블을 돌려주지 않는다", ({ textureKey }) => {
      const resolved = bundledTileSemantics(bundledTileset(textureKey));
      expect(resolved).not.toBe(COMBINED_TOWN_TILE_SEMANTICS);
      expect(resolved).not.toBe(INTERIOR_TILE_SEMANTICS);
      expect(resolved).not.toBe(DUNGEON_TILE_SEMANTICS);
    });

    it.each(WIRING)("$textureKey 는 도화 가능 칸 전수를 라벨로 노출한다", ({ textureKey, drawable }) => {
      const labels = bundledTileLabels(bundledTileset(textureKey));
      expect(labels.size).toBe(drawable);
    });

    it("기존 3종 배선은 그대로다", () => {
      expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_interior"))).toBe(INTERIOR_TILE_SEMANTICS);
      expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_dungeon"))).toBe(DUNGEON_TILE_SEMANTICS);
      expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_combined_town"))).toBe(COMBINED_TOWN_TILE_SEMANTICS);
    });
  });
});
