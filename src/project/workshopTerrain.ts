// src/project/workshopTerrain.ts
/**
 * 공방 「한 번에 만들기」 지형(2026-10-23): tile-gen 묶음의 지형 칸을 **지금 맵 칩셋**에 덧붙인다 — 새 칩셋으로만 들어가면
 * 지금 맵에서 칠할 수 없었다(openwiki/editor-workshop.md 남은 일 「지형 묶음을 지금 맵 칩셋에 합치기」).
 *
 * - 칸: 묶음 칩셋(가져오기가 만든 업로드 칩셋)의 칸 k → 대상 칩셋의 base+k 로 tileGrafts(그림은 업로드 자산에서 이식).
 *   base 는 대상의 번들 끝·다른 이식 끝 뒤 새 줄(번들 칸 번호는 하나도 안 바뀐다). 통행·층·지형 값은 묶음 칩셋 것을 그대로.
 * - 자동 타일 그룹(variantMap·phaseVariants·interiorVariants·composer 칸 번호)과 움직이는 칸(animationStrips)도 같은 만큼 민다.
 * - 같은 묶음 칩셋을 다시 합치면 아무것도 늘지 않는다(그룹 id 로 알아본다).
 * project 를 제자리에서 고친다 — 호출자는 store.update 초안에 대고 부른다.
 */
import type { AutotileGroup, PassFlag, TileAiMetadata, TilesetDef } from "./types";

const PASS: PassFlag = { up: true, down: true, left: true, right: true };
const rowAligned = (count: number, perRow: number): number => Math.ceil(Math.max(0, count) / Math.max(1, perRow)) * Math.max(1, perRow);

export interface MergedTerrain {
  readonly base: number;
  readonly groupIds: readonly string[];
  /** 붓으로 들 칸(첫 그룹의 「사방이 이어진」 속 칸) */
  readonly brushTile: number | null;
  readonly added: number;
}

function shift(value: number, base: number, count: number): number {
  return Number.isInteger(value) && value >= 0 && value < count ? value + base : value;
}

function shiftGroup(group: AutotileGroup, base: number, count: number, suffix: string): AutotileGroup {
  const s = (v: number) => shift(v, base, count);
  const map = (record: Record<string, number>) => Object.fromEntries(Object.entries(record).map(([k, v]) => [k, s(v)]));
  const out: AutotileGroup = {
    ...group,
    id: `${group.id}${suffix}`,
    memberTileIds: group.memberTileIds.map(s),
    variantMap: map(group.variantMap),
    ...(group.connectTileIds ? { connectTileIds: group.connectTileIds.map(s) } : {}),
    ...(group.triggerTileIds ? { triggerTileIds: group.triggerTileIds.map(s) } : {}),
    ...(group.interiorVariants ? { interiorVariants: group.interiorVariants.map((row) => row.map(s)) } : {}),
    ...(group.phaseVariants ? { phaseVariants: { ...group.phaseVariants, maps: group.phaseVariants.maps.map(map) } } : {}),
  };
  if (group.composer) {
    out.composer = {
      ...group.composer,
      overhangOnTiles: group.composer.overhangOnTiles.map(s),
      sprites: group.composer.sprites.map((sprite) => ({ ...sprite, tiles: sprite.tiles.map(s) })),
      ...(group.composer.ground ? {
        ground: {
          ...group.composer.ground,
          floorTiles: group.composer.ground.floorTiles.map(s),
          apronBases: group.composer.ground.apronBases.map(s),
          apronTiles: group.composer.ground.apronTiles.map(s),
        },
      } : {}),
    };
  }
  return out;
}

/** 그룹이 칠할 대표 칸 — 사방 8칸이 다 이어진 마스크(255)의 칸, 없으면 첫 멤버. */
export function autotileBrushTile(group: AutotileGroup): number | null {
  return group.variantMap["255"] ?? group.memberTileIds[0] ?? null;
}

export function mergeTerrainIntoTileset(project: { tilesets: Record<string, TilesetDef> }, targetId: string, sourceId: string): MergedTerrain {
  const target = project.tilesets[targetId];
  const source = project.tilesets[sourceId];
  if (!target) throw new Error(`칩셋이 없습니다: ${targetId}`);
  if (!source || source.image.type !== "uploaded") throw new Error("합칠 지형 칩셋이 없습니다.");
  if (target.tileSize !== source.tileSize) throw new Error(`칸 크기가 달라 합칠 수 없어요(${target.tileSize}px ← ${source.tileSize}px).`);
  const asset = source.image.id;
  const suffix = `@${targetId === sourceId ? "self" : asset.slice(-10)}`;
  const groups = source.autotileGroups ?? [];
  const existing = (target.autotileGroups ?? []).filter((group) => group.id.endsWith(suffix));
  if (existing.length) {
    const graft = (target.tileGrafts ?? []).find((g) => g.sourceChipset === asset && g.sourceTile === 0);
    return { base: graft?.targetTile ?? 0, groupIds: existing.map((g) => g.id), brushTile: autotileBrushTile(existing[0]!), added: 0 };
  }
  const others = (target.tileGrafts ?? []).reduce((max, g) => Math.max(max, g.targetTile + 1), 0);
  const base = rowAligned(Math.max(others, target.count), target.tilesPerRow);
  const count = source.count;
  while (target.passability.length < base) target.passability.push({ ...PASS });
  while (target.priority.length < base) target.priority.push("lower");
  while (target.terrain.length < base) target.terrain.push(0);
  if (target.tileMeta) while (target.tileMeta.length < base) target.tileMeta.push({ label: "지형 칸 자리(빈 칸)", description: "", source: "user" } as TileAiMetadata);
  target.tileGrafts ??= [];
  for (let k = 0; k < count; k++) {
    const id = base + k;
    target.tileGrafts.push({ sourceChipset: asset, sourceTile: k, targetTile: id });
    target.passability[id] = { ...(source.passability[k] ?? PASS) };
    target.priority[id] = source.priority[k] ?? "lower";
    target.terrain[id] = source.terrain[k] ?? 0;
    if (target.tileMeta) {
      const meta = source.tileMeta?.[k];
      target.tileMeta[id] = { ...(meta ?? { label: `${source.name} ${k}`, description: "", source: "user" }), label: `${meta?.label ?? source.name} · 공방 지형` } as TileAiMetadata;
    }
  }
  target.count = Math.max(target.count, base + count);
  const shifted = groups.map((group) => shiftGroup(group, base, count, suffix));
  target.autotileGroups = [...(target.autotileGroups ?? []), ...shifted];
  const strips = (source.animationStrips ?? []).map((strip) => ({ ...strip, baseTile: strip.baseTile + base }));
  if (strips.length) target.animationStrips = [...(target.animationStrips ?? []), ...strips];
  return { base, groupIds: shifted.map((g) => g.id), brushTile: shifted[0] ? autotileBrushTile(shifted[0]) : count ? base : null, added: count };
}
