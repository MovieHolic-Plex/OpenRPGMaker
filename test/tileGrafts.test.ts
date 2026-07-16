// 타일 이식(tile graft) — 데이터 모델/액션/텍스처 키 검증.
// 핵심 계약: 칩셋 넘버링 불변(덮어쓰기 or 행 단위 확장), count 의존 배열 길이 동기,
// graft 구성이 바뀌면 텍스처 캐시 키도 바뀐다.
import { beforeEach, describe, expect, it } from "vitest";
import { serialize, deserialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { addTileGraft, removeTileGraft } from "@/editor/tilesetActions";
import { tilesetTextureKey } from "@/editor/tilesetImage";
import { tilesetTextureKey as shimTilesetTextureKey } from "@/player/exportTilesetImageShim";
import {
  activeTileGrafts,
  rowAlignedTileCount,
  tileCountWithGrafts,
  tileGraftsTextureSuffix,
} from "@/assets/tileGrafts";
import type { Project, TilesetDef } from "@/project/types";

const RETRO_HOUSE = "tex_easyrpg_chipset_retro_house";

function tileset(): TilesetDef {
  const found = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
  if (!found) throw new Error("blank 프로젝트에 기본 타일셋이 없습니다");
  return found;
}

beforeEach(() => {
  store.replace(createBlankProject());
});

describe("타일 이식 직렬화 검증", () => {
  it("tileGrafts 가 직렬화 왕복 후 보존된다", () => {
    const result = addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    expect(result.ok).toBe(true);
    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.tilesets[DEFAULT_TILESET_ID].tileGrafts).toEqual([
      { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 },
    ]);
  });

  it("targetTile 이 count 를 벗어나면(확장 누락) 로드가 거부된다", () => {
    const raw = JSON.parse(serialize(store.getCurrent())) as {
      tilesets: Record<string, { count: number; tileGrafts?: unknown }>;
    };
    raw.tilesets[DEFAULT_TILESET_ID].tileGrafts = [
      { targetTile: raw.tilesets[DEFAULT_TILESET_ID].count, sourceChipset: RETRO_HOUSE, sourceTile: 1 },
    ];
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/targetTile out of range/);
  });

  it("sourceChipset 이 빈 문자열이거나 sourceTile 이 음수면 로드가 거부된다", () => {
    const base = JSON.parse(serialize(store.getCurrent())) as {
      tilesets: Record<string, { tileGrafts?: unknown }>;
    };
    const withGraft = (graft: unknown): string => {
      const clone = structuredClone(base);
      clone.tilesets[DEFAULT_TILESET_ID].tileGrafts = [graft];
      return JSON.stringify(clone);
    };
    expect(() => deserialize(withGraft({ targetTile: 1, sourceChipset: "", sourceTile: 1 }))).toThrow(
      /sourceChipset/
    );
    expect(() => deserialize(withGraft({ targetTile: 1, sourceChipset: RETRO_HOUSE, sourceTile: -1 }))).toThrow(
      /sourceTile/
    );
    expect(() => deserialize(withGraft({ targetTile: 1, sourceChipset: RETRO_HOUSE }))).toThrow(/sourceTile/);
  });
});

describe("addTileGraft — 덮어쓰기 모드 (targetTile < count)", () => {
  it("count 와 배열 길이가 변하지 않고 graft 만 추가된다", () => {
    const before = tileset().count;
    const result = addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    expect(result.ok).toBe(true);
    const after = tileset();
    expect(after.count).toBe(before);
    expect(after.passability).toHaveLength(before);
    expect(after.priority).toHaveLength(before);
    expect(after.terrain).toHaveLength(before);
    expect(after.tileGrafts).toEqual([{ targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 }]);
  });

  it("이식 슬롯에 출처 라벨 메타를 남긴다 (source: user)", () => {
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    const meta = tileset().tileMeta?.[411];
    expect(meta?.label).toBe(`이식: ${RETRO_HOUSE}#442`);
    expect(meta?.source).toBe("user");
  });

  it("같은 targetTile 에 다시 이식하면 교체된다 (중복 없음)", () => {
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 472 });
    expect(tileset().tileGrafts).toEqual([{ targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 472 }]);
  });

  it("잘못된 입력은 거부된다", () => {
    expect(addTileGraft(DEFAULT_TILESET_ID, { targetTile: -1, sourceChipset: RETRO_HOUSE, sourceTile: 1 }).ok).toBe(false);
    expect(addTileGraft(DEFAULT_TILESET_ID, { targetTile: 1, sourceChipset: "tex_unknown_chipset", sourceTile: 1 }).ok).toBe(false);
    expect(addTileGraft(DEFAULT_TILESET_ID, { targetTile: 1, sourceChipset: RETRO_HOUSE, sourceTile: 480 }).ok).toBe(false);
    expect(addTileGraft("no_such_tileset", { targetTile: 1, sourceChipset: RETRO_HOUSE, sourceTile: 1 }).ok).toBe(false);
    expect(tileset().tileGrafts).toBeUndefined();
  });
});

describe("addTileGraft — 확장 모드 (targetTile >= count)", () => {
  it("count 가 행 단위(tilesPerRow 배수)로 늘고 기존 id 는 불변, 배열 길이도 동기된다", () => {
    const before = tileset();
    const baseCount = before.count;
    const perRow = before.tilesPerRow;
    const passability0 = before.passability[0];
    const result = addTileGraft(DEFAULT_TILESET_ID, { targetTile: baseCount, sourceChipset: RETRO_HOUSE, sourceTile: 472 });
    expect(result.ok).toBe(true);

    const after = tileset();
    const expected = rowAlignedTileCount(baseCount + 1, perRow);
    expect(expected % perRow).toBe(0);
    expect(after.count).toBe(expected);
    expect(after.count).toBeGreaterThan(baseCount);
    // 기존 0..baseCount-1 데이터는 그대로 (넘버링/속성 보존).
    expect(after.passability[0]).toEqual(passability0);
    // count 의존 배열 전부 확장.
    expect(after.passability).toHaveLength(expected);
    expect(after.priority).toHaveLength(expected);
    expect(after.terrain).toHaveLength(expected);
    if (after.tileMeta) expect(after.tileMeta).toHaveLength(expected);
    // 확장분 기본값: 전방향 통과 / lower / 지형 0.
    expect(after.passability[expected - 1]).toEqual({ up: true, down: true, left: true, right: true });
    expect(after.priority[expected - 1]).toBe("lower");
    expect(after.terrain[expected - 1]).toBe(0);
    // 확장 후에도 직렬화 검증 통과(길이 일관성).
    expect(() => deserialize(serialize(store.getCurrent()))).not.toThrow();
  });

  it("tileCountWithGrafts 가 확장 요구 count 를 계산한다", () => {
    const base = tileset();
    expect(tileCountWithGrafts(base)).toBe(base.count);
    const grafted = { ...base, tileGrafts: [{ targetTile: base.count, sourceChipset: RETRO_HOUSE, sourceTile: 1 }] };
    expect(tileCountWithGrafts(grafted)).toBe(rowAlignedTileCount(base.count + 1, base.tilesPerRow));
  });
});

describe("텍스처 캐시 키 (graft 해시 suffix)", () => {
  it("graft 유무/구성에 따라 tilesetTextureKey 가 달라진다", () => {
    const bare = tilesetTextureKey(tileset());
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    const withOne = tilesetTextureKey(tileset());
    expect(withOne).not.toBe(bare);
    expect(withOne.startsWith(bare)).toBe(true); // baseKey 유지 + suffix
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 413, sourceChipset: RETRO_HOUSE, sourceTile: 472 });
    const withTwo = tilesetTextureKey(tileset());
    expect(withTwo).not.toBe(withOne);
    // 에디터/플레이어 셔임 두 벌이 같은 키를 만든다.
    expect(shimTilesetTextureKey(tileset())).toBe(withTwo);
  });

  it("suffix 는 graft 배열 순서와 무관하게 안정적이다", () => {
    const a = { tileGrafts: [
      { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 },
      { targetTile: 480, sourceChipset: RETRO_HOUSE, sourceTile: 472 },
    ] };
    const b = { tileGrafts: [...a.tileGrafts].reverse() };
    expect(tileGraftsTextureSuffix(a)).toBe(tileGraftsTextureSuffix(b));
    expect(tileGraftsTextureSuffix({ tileGrafts: [] })).toBe("");
    expect(tileGraftsTextureSuffix({})).toBe("");
  });

  it("activeTileGrafts 는 targetTile 중복을 마지막 항목으로 정리한다", () => {
    const grafts = activeTileGrafts({ tileGrafts: [
      { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 },
      { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 7 },
    ] });
    expect(grafts).toEqual([{ targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 7 }]);
  });
});

describe("removeTileGraft", () => {
  it("덮어쓰기 graft 제거: 필드 정리 + 라벨 원복, count 불변", () => {
    const baseCount = tileset().count;
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    const result = removeTileGraft(DEFAULT_TILESET_ID, 411);
    expect(result.ok).toBe(true);
    const after = tileset();
    expect(after.tileGrafts).toBeUndefined();
    expect(after.count).toBe(baseCount);
    expect(after.tileMeta?.[411]?.label).toBe("");
    expect(after.tileMeta?.[411]?.source).toBe("unknown");
  });

  it("확장 graft 제거: 확장분에 남은 graft 가 없으면 count/배열이 원상 복귀된다", () => {
    const baseCount = tileset().count;
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: baseCount, sourceChipset: RETRO_HOUSE, sourceTile: 472 });
    expect(tileset().count).toBeGreaterThan(baseCount);
    removeTileGraft(DEFAULT_TILESET_ID, baseCount);
    const after = tileset();
    expect(after.count).toBe(baseCount);
    expect(after.passability).toHaveLength(baseCount);
    expect(after.priority).toHaveLength(baseCount);
    expect(after.terrain).toHaveLength(baseCount);
    expect(() => deserialize(serialize(store.getCurrent()))).not.toThrow();
  });

  it("없는 이식을 지우면 에러를 반환한다", () => {
    expect(removeTileGraft(DEFAULT_TILESET_ID, 411).ok).toBe(false);
  });
});

describe("프로젝트 전체 무결성", () => {
  it("두 모드 graft(411 덮어쓰기 + 480 확장)를 가진 프로젝트가 왕복 무손실이다", () => {
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 411, sourceChipset: RETRO_HOUSE, sourceTile: 442 });
    addTileGraft(DEFAULT_TILESET_ID, { targetTile: 480, sourceChipset: RETRO_HOUSE, sourceTile: 472 });
    const before: Project = store.getCurrent();
    const restored = deserialize(serialize(before));
    expect(serialize(restored)).toBe(serialize(before));
  });
});
