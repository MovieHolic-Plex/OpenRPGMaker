/**
 * 구조 킷 ↔ ObjectSpec v1 (2026-10-20). 킷의 설명서를 읽고, 공방이 옛날에 태그로 우겨넣은 정보를 정식 칸으로 옮긴다.
 *
 * 옛 공방 킷: `ai.tags = [stampKind, "workshop", "hand:floor", "foot:1", "rise:8", "grid:…", "use:sit"]`.
 * 새 공방 킷: `spec` 에 같은 정보(placement.anchor · view.footRows · view.risePx · art.gridHash · placement.use).
 * 읽는 쪽은 spec 을 먼저 보고, 없으면 옛 태그를 읽는다 — 이미 저장된 프로젝트는 그대로 동작한다.
 * 위키: openwiki/object-spec.md
 */
import type { SectionStructureKitDef, TilesetDef } from "./types";
import { OBJECT_SPEC_SCHEMA, validateObjectSpec, type ObjectSpecAnchor, type ObjectSpecCategory, type ObjectSpecV1 } from "./objectSpec";

/** 옛 공방 태그의 머리. 이 머리로 시작하는 태그는 정보를 인코딩한 것이라 찾기 낱말이 아니다. */
export const LEGACY_WORKSHOP_TAG_PREFIXES = ["hand:", "foot:", "rise:", "grid:", "use:"] as const;
const HAND_ANCHORS: readonly ObjectSpecAnchor[] = ["floor", "wall", "hang", "flat"];

const tagValue = (kit: SectionStructureKitDef, prefix: string): string | undefined =>
  kit.ai?.tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
const isLegacyTag = (tag: string): boolean => LEGACY_WORKSHOP_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));
const clip = (text: string, max: number): string => [...text].slice(0, max).join("");

/** 손 도트 기물 종류(공방·실내 사양) → 설명서 분류·층. */
export function handKindCategory(anchor: ObjectSpecAnchor): { category: ObjectSpecCategory; layer: "lower" | "upper" } {
  return anchor === "flat" ? { category: "decor", layer: "lower" } : anchor === "hang" ? { category: "decor", layer: "upper" } : { category: "furniture", layer: "upper" };
}

/** 공방 옛 태그 → 설명서. `hand:` 태그가 없으면 null. */
export function specFromLegacyWorkshopTags(kit: SectionStructureKitDef, tileSize: number): ObjectSpecV1 | null {
  const hand = tagValue(kit, "hand:") as ObjectSpecAnchor | undefined;
  if (!hand || !HAND_ANCHORS.includes(hand)) return null;
  const foot = Math.max(0, Math.min(kit.height, Number(tagValue(kit, "foot:") ?? 0) || 0));
  const rise = Math.max(0, Number(tagValue(kit, "rise:") ?? 0) || 0);
  const grid = tagValue(kit, "grid:");
  const use = (kit.ai?.tags ?? []).filter((tag) => tag.startsWith("use:")).map((tag) => tag.slice(4)).filter(Boolean);
  const { category, layer } = handKindCategory(hand);
  return {
    schema: OBJECT_SPEC_SCHEMA,
    id: kit.id,
    name: clip(kit.name ?? kit.id, 80) || kit.id,
    ...(kit.ai?.description ? { summary: clip(kit.ai.description, 160) } : {}),
    category,
    tags: (kit.ai?.tags ?? []).filter((tag) => !isLegacyTag(tag)).map((tag) => clip(tag, 24)).filter(Boolean).slice(0, 16),
    tileSize: kit.tileSize ?? tileSize,
    size: { w: kit.width, h: kit.height },
    view: { footRows: hand === "floor" || hand === "wall" ? foot : 0, risePx: Math.round(rise) },
    layer,
    placement: {
      anchor: hand,
      ...(use.length ? { use: use.slice(0, 8) } : {}),
      ...(kit.ai?.placementRules ? { rule: clip(kit.ai.placementRules, 240) } : {}),
      repeat: kit.ai?.repeatability === "repeat" ? "repeat" : "fixed",
    },
    ...(grid ? { art: { gridHash: clip(grid, 160) } } : {}),
    provenance: { aiGenerated: true, tool: "oprn-workshop" },
  };
}

/**
 * 킷의 설명서. 정식 spec(검사 통과)이 먼저, 없으면 공방 옛 태그, 그것도 없으면 null.
 * (번들·팩 킷처럼 설명서가 아직 없는 킷을 여기서 추측해 만들지 않는다 — 추측한 값이 정본처럼 퍼지지 않게.)
 */
export function objectSpecOfKit(kit: SectionStructureKitDef, tileset?: Pick<TilesetDef, "tileSize">): ObjectSpecV1 | null {
  if (kit.spec && validateObjectSpec(kit.spec).ok) return kit.spec;
  return specFromLegacyWorkshopTags(kit, kit.tileSize ?? tileset?.tileSize ?? 16);
}

/** 손 도트 종류(floor·wall·hang·flat)로 읽을 수 있으면 그 값. 실내 방 짓기가 쓴다. */
export function objectSpecHandKind(spec: ObjectSpecV1 | null | undefined): "floor" | "wall" | "hang" | "flat" | null {
  const anchor = spec?.placement.anchor;
  return anchor === "floor" || anchor === "wall" || anchor === "hang" || anchor === "flat" ? anchor : null;
}

/**
 * 옛 공방 태그를 정식 칸으로 옮긴다: spec 을 채우고 인코딩 태그를 ai.tags 에서 뺀다. 바뀌었으면 true.
 * 공방 킷(learnedFrom "workshop")만 다룬다. spec 이 이미 있으면 태그만 정리한다.
 */
export function migrateLegacyWorkshopKit(kit: SectionStructureKitDef, tileSize: number): boolean {
  if (kit.learnedFrom !== "workshop") return false; // 다른 킷의 `use:` 태그(방 짓기 역할표)는 찾기 낱말로 남긴다
  const legacy = (kit.ai?.tags ?? []).some(isLegacyTag);
  if (!legacy) return false;
  if (!kit.spec) {
    const spec = specFromLegacyWorkshopTags(kit, tileSize);
    if (!spec) return false;
    kit.spec = spec;
  }
  if (kit.ai?.tags) kit.ai = { ...kit.ai, tags: kit.ai.tags.filter((tag) => !isLegacyTag(tag)) };
  return true;
}
