// editor/tools/mapVariantLook.ts
// derive_map_variant 의 「시대 겉모습」 — 같은 지리의 변형 맵이 눈으로 구별되게 한다.
//
// 왜: jrpg-real-1 J03 에서 과거·미래·붕괴 후 세계 맵이 현재 맵과 타일 한 칸도 다르지 않았다(복제만 하고 지형 편집을 안 함,
// 날씨만 바뀌었는데 안개도 거의 안 보였다). 이제 변형 한 칸마다 시대별 프리셋을 자동으로 건다 — 새 그림 없이 기존 칩셋 조각만 쓴다.
//  ① 분위기: 맵 조명(색조·어둡기)과 안개 — 칩셋과 무관하게 항상 먹는다.
//  ② 건물 철거: 마을을 지을 때 기록된 건물 배치(structurePlacements)의 일부를 원래 땅으로 되돌리고(찍기 전 타일 복원),
//     그 자리에 칩셋에 이미 있는 폐허·야영·유물 킷 조각을 흩뿌린다. 킷이 없는 칩셋이면 ①만 한다.
// `look` 은 "ruin"(붕괴·폐허) | "past"(과거) | "future"(미래) | "none"(끔). 생략하면 era·name·id 낱말로 고른다.
// 조수가 준 tileRemap·tileOverrides 는 이 프리셋 뒤에 적용되므로 항상 이긴다.

import { clearTileStack } from "@/project/mapOverlayTiles";
import { appendStructurePlacement, captureStructureTiles, removeStructurePlacement, restoreStructurePlacementTiles, structurePlacementsOf } from "@/project/structurePlacements";
import type { GameEvent, GameMap, Project, SectionStructureKitDef } from "@/project/types";

export const VARIANT_LOOKS = ["ruin", "past", "future"] as const;
export type VariantLook = (typeof VARIANT_LOOKS)[number];

type LookSpec = {
  readonly label: string;
  /** 철거할 건물 비율(0~1). */
  readonly demolishRatio: number;
  /** 철거한 건물 자리 하나에 흩뿌릴 조각 수 [최소, 최대]. */
  readonly stampsPerSite: readonly [number, number];
  /** 어둡기(0~1, 클수록 어둡다)와 색조. */
  readonly ambient: number;
  readonly color: string;
  /** 안개를 깔 때만. */
  readonly fog?: number;
  /** 흩뿌릴 킷(칩셋에 있는 것만 쓴다). */
  readonly kitIds: readonly string[];
};

const LOOKS: Readonly<Record<VariantLook, LookSpec>> = {
  ruin: {
    label: "붕괴·폐허",
    // jrpg-loop-1(D8): 0.6·ambient 0.4 로는 「세계의 붕괴」가 안개 낀 마을 정도로만 보였다 — 건물 4채 중 3채를 무너뜨리고 한 단계 더 어둡게.
    demolishRatio: 0.75,
    stampsPerSite: [5, 8],
    ambient: 0.5,
    color: "#2e2a3c",
    fog: 0.9,
    kitIds: [
      "bd-pick-temple-ruins-rubble-temple", "bd-pick-aqueduct-sewer-rubble", "bd-pick-castle-catacombs-rubble",
      "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-shipwreck-reef-plank-pile",
      "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-aqueduct-sewer-column-sewer-broken", "bd-pick-shipwreck-reef-broken-barrel",
    ],
  },
  past: {
    label: "과거",
    // jrpg-loop-1(D16): 시대 변형이 색조뿐이라 같은 마을로 읽혔다 — 건물을 더 걷어 내고(60%) 옛 야영·돌무더기를 자리마다 2~4개 놓고 옅은 아침 안개를 깐다.
    demolishRatio: 0.6,
    stampsPerSite: [2, 4],
    ambient: 0.56,
    color: "#8a4608",
    fog: 0.25,
    kitIds: [
      "bd-pick-deep-forest-path-campfire", "bd-pick-deep-forest-path-cairn", "bd-pick-deep-forest-path-cairn-s",
      "bd-pick-desert-oasis-rock", "bd-pick-coast-cliff-road-heath-a", "bd-pick-coast-cliff-road-heath-b", "bd-pick-deep-forest-path-stones-a",
    ],
  },
  future: {
    label: "미래",
    demolishRatio: 0.55,
    stampsPerSite: [2, 3],
    ambient: 0.56,
    color: "#0c2c70",
    kitIds: [
      "bd-pick-volcano-cave-fire-crystal", "bd-pick-wizard-tower-moon-obelisk", "bd-pick-snowfield-lamp",
      "bd-pick-wizard-tower-armillary", "bd-pick-aqueduct-sewer-lantern-post",
    ],
  },
};

const RUIN_WORDS = /ruin|collaps|devast|wreck|destroy|apocal|폐허|붕괴|잔해|황폐|파멸|멸망|몰락|파괴/iu;
const PAST_WORDS = /past|ancient|medieval|prehistor|primitive|과거|고대|옛날|옛 |선사|원시|중세|태고/iu;
const FUTURE_WORDS = /future|futur|미래|근미래|서기 ?\d{4}/iu;

/** `look` 인자 해석. undefined 면 era·name·id 낱말로 고른다(해당 없으면 null = 프리셋 없음). 잘못된 값은 오류 문자열. */
export function resolveVariantLook(raw: { readonly look?: unknown; readonly era?: unknown; readonly name?: unknown; readonly id?: unknown }): VariantLook | null | { readonly error: string } {
  if (raw.look !== undefined && raw.look !== null && raw.look !== "") {
    if (raw.look === "none") return null;
    if ((VARIANT_LOOKS as readonly unknown[]).includes(raw.look)) return raw.look as VariantLook;
    return { error: `look 은 ${[...VARIANT_LOOKS, "none"].join("|")} 중 하나여야 합니다(받은 값: ${String(raw.look)}).` };
  }
  const text = [raw.era, raw.name, raw.id].filter((part): part is string => typeof part === "string").join(" ");
  if (RUIN_WORDS.test(text)) return "ruin";
  if (FUTURE_WORDS.test(text)) return "future";
  if (PAST_WORDS.test(text)) return "past";
  return null;
}

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 시드 고정 난수(mulberry32) — 같은 변형 id 는 언제나 같은 철거·배치가 나온다. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOT_A_BUILDING = /bonfire|bench|waterwheel|lamp|tree|well|fountain|bridge|gate|fence|stair|rock|stone|shrine-path|campfire/iu;

function isTransferDoor(event: GameEvent): boolean {
  const visit = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(visit);
    if (!node || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    if (record.kind === "transfer") return true;
    return Object.values(record).some(visit);
  };
  return visit(event.pages ?? []) || visit(event.commands ?? []);
}

function isWaterCell(map: GameMap, tileset: { readonly tileMeta?: Readonly<Record<number, { readonly tags?: readonly string[] } | undefined>> } | undefined, index: number): boolean {
  const tile = map.lowerTiles[index];
  return tile !== undefined && tile >= 0 && (tileset?.tileMeta?.[tile]?.tags ?? []).includes("water");
}

function eventAt(map: GameMap, x: number, y: number): GameEvent | undefined {
  return map.events.find((event) => event.x === x && event.y === y);
}

export type VariantLookReport = {
  look: VariantLook;
  label: string;
  lighting: { ambient: number; color: string };
  fog?: number;
  demolishedBuildings: number;
  stampedPieces: number;
  removedDoorEvents: string[];
  note?: string;
};

/**
 * 변형 맵 `copy` 에 시대 프리셋을 건다. `copy` 는 cloneMapIntoProject 로 방금 복제한 맵이고,
 * 건물 철거는 복제본이 가진 structurePlacements 의 `before` 로 한다.
 */
export function applyVariantLook(draft: Project, copy: GameMap, look: VariantLook, warnings: string[], label: string): VariantLookReport {
  const spec = LOOKS[look];
  copy.defaultLighting = { ambient: spec.ambient, color: spec.color, sources: [] };
  if (spec.fog !== undefined) copy.climate = { mode: "fixed", weather: "fog", intensity: spec.fog };
  const report: VariantLookReport = {
    look, label: spec.label, lighting: { ambient: spec.ambient, color: spec.color },
    ...(spec.fog !== undefined ? { fog: spec.fog } : {}),
    demolishedBuildings: 0, stampedPieces: 0, removedDoorEvents: [],
  };

  const tileset = draft.tilesets[copy.tilesetId];
  const kitsById = new Map<string, SectionStructureKitDef>((tileset?.structureKits ?? []).filter((kit) => kit.kind === "section").map((kit) => [kit.id, kit]));
  const kits = spec.kitIds.map((id) => kitsById.get(id)).filter((kit): kit is SectionStructureKitDef => kit !== undefined);
  const buildings = [...structurePlacementsOf(copy)]
    .filter((placement) => placement.w * placement.h >= 12 && Math.min(placement.w, placement.h) >= 3 && !NOT_A_BUILDING.test(placement.kitId))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (buildings.length === 0) {
    report.note = "건물 배치 기록(structurePlacements)이 없어 조명·안개만 적용했습니다 — 지형 변화를 더하려면 tileRemap·tileOverrides 로 건물·나무를 바꾸세요.";
    warnings.push(`${label}: ${report.note}`);
    return report;
  }

  const random = rng(hash32(`${copy.id}:${look}`));
  const wanted = Math.max(1, Math.round(buildings.length * spec.demolishRatio));
  // 시드 순서로 섞어 앞에서 wanted 채를 고른다 — 비율이 같아도 어떤 건물이 사라지는지는 변형마다 다르다.
  const order = buildings.map((placement, index) => ({ placement, key: random() + index * 1e-9 })).sort((a, b) => a.key - b.key).map((entry) => entry.placement);
  const taken = new Set<number>();
  for (const placement of order) {
    if (report.demolishedBuildings >= wanted) break;
    const inside = copy.events.filter((event) => event.x >= placement.x && event.y >= placement.y && event.x < placement.x + placement.w && event.y < placement.y + placement.h);
    // 건물 안에 문이 아닌 이벤트(NPC·상자·세이브)가 있으면 그 건물은 남긴다.
    if (inside.some((event) => !isTransferDoor(event))) continue;
    for (const door of inside) report.removedDoorEvents.push(door.id);
    const doorIds = new Set(inside.map((event) => event.id));
    copy.events = copy.events.filter((event) => !doorIds.has(event.id));
    restoreStructurePlacementTiles(copy, placement);
    removeStructurePlacement(copy, placement.id);
    report.demolishedBuildings += 1;

    if (kits.length === 0) continue;
    const [minStamps, maxStamps] = spec.stampsPerSite;
    const count = minStamps + Math.floor(random() * (maxStamps - minStamps + 1));
    for (let n = 0; n < count; n += 1) {
      const kit = kits[Math.min(kits.length - 1, Math.floor(random() * kits.length))]!;
      if (kit.width > placement.w || kit.height > placement.h) continue;
      const x = placement.x + Math.floor(random() * (placement.w - kit.width + 1));
      const y = placement.y + Math.floor(random() * (placement.h - kit.height + 1));
      let blocked = false;
      for (let row = 0; row < kit.height && !blocked; row += 1) {
        for (let col = 0; col < kit.width; col += 1) {
          // 물 칸 위에는 폐허 조각을 놓지 않는다 — 받침 없는 물체로 커밋이 거절돼 변형 도구가 통째로 실패했다(jrpg-loop-2: 해안 건물 자리).
          if (taken.has((y + row) * copy.width + x + col) || eventAt(copy, x + col, y + row) || isWaterCell(copy, tileset, (y + row) * copy.width + x + col)) { blocked = true; break; }
        }
      }
      if (blocked) continue;
      const rect = { x, y, w: kit.width, h: kit.height };
      const before = captureStructureTiles(copy, rect);
      for (let row = 0; row < kit.height; row += 1) {
        for (let col = 0; col < kit.width; col += 1) {
          const index = (y + row) * copy.width + x + col;
          taken.add(index);
          const lower = kit.rows[row]?.tiles[col];
          const upper = kit.rows[row]?.upperTiles?.[col];
          if (lower !== undefined && lower >= 0) { clearTileStack(copy, "lower", index); copy.lowerTiles[index] = lower; }
          if (upper !== undefined && upper >= 0) { clearTileStack(copy, "upper", index); copy.upperTiles[index] = upper; }
        }
      }
      appendStructurePlacement(copy, { kitId: kit.id, rect, before });
      report.stampedPieces += 1;
    }
  }
  if (kits.length === 0) {
    report.note = "이 타일셋에는 시대 소품 킷이 없어 건물 철거와 조명·안개만 적용했습니다.";
    warnings.push(`${label}: ${report.note}`);
  }
  return report;
}
