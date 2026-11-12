// 게임마다 한 가지 모습 — 같은 종류의 다른 그림(킷 ai.variantOf)을 게임 열쇠로 고른다.
//
// 왜(오너 2026-11-12): 조수가 지은 게임이 다 비슷해 보였다 — 종류마다 그림이 한 장이고(우물·벤치·이정표 …) 빌더가 늘 그 id 를 찍었다.
// 변형 킷은 원본과 발밑·통행이 같아(굽기가 맞춘다) 찍는 순간에 갈아 끼워도 배치·통행·도달이 그대로다. 고르는 자리는 킷 id 를 푸는
// 두 곳(stamp_object·stamp_tileset_object)뿐이라 마을 구성기·v2 빌더·이름으로 찾은 기물(«우물»)이 모두 같은 그림을 받는다.
// 한 게임은 한 모습이다: 열쇠 + 원본 id 로 고르므로 그 게임의 우물은 어느 맵에서나 같은 우물이다.
import type { StructureKitDef, TilesetDef } from "./types";

let activeKey: string | undefined;

/** 도구 실행 구간 동안 게임 열쇠를 켠다 — run(draft,args) 는 ctx 를 못 받아서 실행기가 이 값으로 넘긴다(withMonsterTurn 과 같은 방식). */
export function withKitLook<T>(key: string | undefined, run: () => T): T {
  const previous = activeKey;
  activeKey = key?.trim() ? key : undefined;
  try { return run(); } finally { activeKey = previous; }
}

/** 지금 도구 실행 구간의 게임 열쇠(없으면 사람 편집·스크립트 — 그림을 갈아 끼우지 않는다). */
export function activeKitLook(): string | undefined {
  return activeKey;
}

/**
 * 글자열 해시(FNV-1a) + 끝 섞기. 끝 섞기가 없으면 낮은 비트가 열쇠의 낮은 비트만 따라간다 — 변형 수가 같은(2·4장) 종류들이
 * 게임마다 늘 같은 짝으로 갈려 «모습» 이 서너 가지뿐이 된다(실측: 우물·벤치가 여섯 게임에서 같은 순번으로 갈렸다).
 */
export function lookHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

const filled = (kit: StructureKitDef, x: number, y: number): boolean => (kit.rows[y]?.tiles?.[x] ?? -1) >= 0 || (kit.rows[y]?.upperTiles?.[x] ?? -1) >= 0;

/** 원본이 들어가는 자리면 그 킷도 들어가는가 — 칸 크기가 같고, 원본이 비운 칸에는 그림을 두지 않는다. */
function fitsWhereBaseFits(kit: StructureKitDef, base: StructureKitDef): boolean {
  if (kit.width !== base.width || kit.height !== base.height) return false;
  for (let y = 0; y < kit.height; y += 1) for (let x = 0; x < kit.width; x += 1) if (filled(kit, x, y) && !filled(base, x, y)) return false;
  return true;
}

/** 원본 킷의 변형들(원본 자리에 그대로 들어가는 것만) — 킷 순서. 원본 자신은 들어 있지 않다. */
export function kitVariants(tileset: Pick<TilesetDef, "structureKits"> | undefined, baseId: string): StructureKitDef[] {
  const base = tileset?.structureKits?.find((kit) => kit.id === baseId);
  if (!base) return [];
  return (tileset?.structureKits ?? []).filter((kit) => kit.ai?.variantOf === baseId && fitsWhereBaseFits(kit, base));
}

/**
 * 이 게임이 그 킷 자리에 쓰는 그림. 열쇠가 없거나 변형이 없으면 그 킷 그대로.
 * 변형 id 를 직접 댄 요청(ai.variantOf 가 있는 킷)은 바꾸지 않는다 — 고른 것은 원본 id 로 온 요청뿐이다.
 */
export function lookKit(tileset: Pick<TilesetDef, "structureKits"> | undefined, kit: StructureKitDef, key: string | undefined = activeKey): StructureKitDef {
  if (!key || kit.ai?.variantOf) return kit;
  const variants = kitVariants(tileset, kit.id);
  if (!variants.length) return kit;
  const options = [kit, ...variants];
  // 함께 바뀌는 가족(변형의 ai.lookWith = 으뜸 원본)은 으뜸의 이름으로 뽑는다 — 벽면과 창 난 벽면이 한 게임에서 같은 순번이 된다.
  return options[lookHash(`look|${key}|${variants[0]!.ai?.lookWith ?? kit.id}`) % options.length]!;
}
