// 문 달린 건물 킷의 크기 단(소형·중형·대형·초대형) — 집 안을 몇 방짜리로 지을지 고르는 자료(src/ai/v2/place/builders/interiorTier.ts).
// 킷이 `tier:` 태그를 들고 있으면 그것(참고 건물은 그린 사람이 적었다). 없으면 킷 자료에서 센다: 문 하나에 딸린 그림 넓이 = 폭 × 높이 ÷ 문 수.
//   이름·요청 낱말은 보지 않는다. 굽기(scripts/content/beodeul-interiors/kit-tiers.mts)가 이 규칙으로 번들 킷 전부에 태그를 적고,
//   태그 없는 옛 프로젝트 사본의 킷은 읽을 때 같은 규칙으로 센다.
//
//   | 문 하나에 딸린 넓이(칸) | 단 | 그런 킷 |
//   |---|---|---|
//   | 40 미만 | small | 3×6·4×8·5×6·6×6 집, 줄지은 집 블록의 한 채, 오두막·헛간 |
//   | 40 ~ 71 | medium | 5×8·6×7·7×8·8×8 집, 여관·방앗간·광산 회관 |
//   | 72 ~ 149 | large | 9×8·9×9 집, 13×11 저택, 작은 귀족 저택 |
//   | 150 이상 | xlarge | 대성당 12×13, 큰 귀족 저택 17×12, 성당 블록, 곶 등대, 마법사의 탑 |
import type { StructureKitDef } from "./types";

export type KitTier = "small" | "medium" | "large" | "xlarge";
export const KIT_TIERS: readonly KitTier[] = ["small", "medium", "large", "xlarge"];
/** 문 하나에 딸린 넓이의 아래 금(칸): medium · large · xlarge. */
export const KIT_TIER_FLOORS = { medium: 40, large: 72, xlarge: 150 } as const;

type KitLike = Pick<StructureKitDef, "width" | "height" | "parts"> & { readonly ai?: { readonly tags?: readonly string[] } };

/** 그 킷의 문(입구) 수. */
export function kitEntranceCount(kit: Pick<StructureKitDef, "parts">): number {
  return (kit.parts ?? []).filter((p) => (p as { kind?: string }).kind === "entrance").length;
}

/** 킷 자료로 센 단(태그를 보지 않는다). 문이 없으면 undefined. */
export function kitTierByFootprint(kit: Pick<StructureKitDef, "width" | "height" | "parts">): KitTier | undefined {
  const doors = kitEntranceCount(kit);
  if (!doors) return undefined;
  const area = (kit.width * kit.height) / doors;
  return area >= KIT_TIER_FLOORS.xlarge ? "xlarge" : area >= KIT_TIER_FLOORS.large ? "large" : area >= KIT_TIER_FLOORS.medium ? "medium" : "small";
}

/** 그 킷의 단 — `tier:` 태그가 먼저, 없으면 킷 자료로 센다. */
export function kitTier(kit: KitLike | undefined): KitTier | undefined {
  if (!kit) return undefined;
  const tag = kit.ai?.tags?.find((t) => t.startsWith("tier:"))?.slice(5) as KitTier | undefined;
  return tag && KIT_TIERS.includes(tag) ? tag : kitTierByFootprint(kit);
}

/** 이야기가 청한 건물: 안의 방 종류(kinds 가운데 하나) · 단(tiers 가운데 하나) · 갈래(cat — 안이 적히지 않은 킷은 갈래로 맞춘다). */
export interface BuildingNeed { readonly kinds: readonly string[]; readonly tiers: readonly string[]; readonly cat?: string }

const tagOf = (kit: KitLike, head: string): string | undefined => kit.ai?.tags?.find((t) => t.startsWith(head))?.slice(head.length);

/** 그 킷이 청한 건물에 맞나 — 단이 맞고, 안의 방 종류(interior: 태그)가 겹친다. 갈래를 적은 주문은 갈래(cat: 태그)도 같아야 하고, 그때는 안이 적히지 않은 킷도 받는다. */
export function kitServesBuilding(kit: KitLike, need: BuildingNeed): boolean {
  const tier = kitTier(kit);
  if (!tier || !need.tiers.includes(tier)) return false;
  // 갈래를 적은 주문(성)은 그 갈래의 킷만 받는다.
  if (need.cat && tagOf(kit, "cat:") !== need.cat) return false;
  const inside = tagOf(kit, "interior:")?.split("+");
  return inside ? inside.some((k) => need.kinds.includes(k)) : !!need.cat;
}
