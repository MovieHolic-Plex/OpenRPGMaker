// 기물 찾기 공통 — list_spatial_designs({kind:"object"}) 와 list_tileset_objects 가 같은 필터·순위·요약을 쓴다.
// 조사(~/claude-viz/object-findability.html): 낱말 부분 일치 + 카탈로그 순서라 「조선 장터」의 1등이 버들항 행이었고,
// 맞는 행이 40행 밖으로 밀렸다. 순위 = 이름·태그 정확 일치 → 이름에 낱말 → 자기 태그에 낱말 → 그 밖.
import type { SectionStructureKitDef } from "@/project/types";
import { ToolError } from "./types";

export type ObjectSurface = "floor" | "water" | "wall";
export const OBJECT_SURFACES: readonly ObjectSurface[] = ["floor", "water", "wall"];

export interface ObjectFilter {
  readonly place?: string;
  readonly surface?: ObjectSurface;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
}

export interface SearchableObject {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly surface?: ObjectSurface;
  readonly description?: string;
}

export const OBJECT_FILTER_PROPERTIES = {
  place: { type: "string", description: "선택. 장소·용도 낱말(예: \"버스 정류장\", \"수산시장\", \"교실\") — 태그나 이름에 그 말이 든 기물을 앞에 보인다(거르지 않는다)" },
  surface: { type: "string", enum: OBJECT_SURFACES, description: "선택. 놓는 면: floor 바닥 · water 물 위 · wall 벽에 붙임" },
  maxWidth: { type: "integer", minimum: 1, maximum: 64, description: "선택. 가로 칸 수 상한" },
  maxHeight: { type: "integer", minimum: 1, maximum: 64, description: "선택. 세로 칸 수 상한" },
} as const;

function optionalSize(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 64) {
    throw new ToolError(`${name} 는 1~64 정수여야 합니다: ${String(value)}`, { code: "invalid-args" });
  }
  return value as number;
}

export function parseObjectFilter(args: Record<string, unknown>): ObjectFilter {
  const place = typeof args.place === "string" && args.place.trim() ? args.place.trim() : undefined;
  let surface: ObjectSurface | undefined;
  if (args.surface !== undefined) {
    if (!OBJECT_SURFACES.includes(args.surface as ObjectSurface)) {
      throw new ToolError(`surface 는 ${OBJECT_SURFACES.join("|")} 중 하나: ${String(args.surface)}`, { code: "invalid-args" });
    }
    surface = args.surface as ObjectSurface;
  }
  const maxWidth = optionalSize(args.maxWidth, "maxWidth");
  const maxHeight = optionalSize(args.maxHeight, "maxHeight");
  return { ...(place ? { place } : {}), ...(surface ? { surface } : {}), ...(maxWidth ? { maxWidth } : {}), ...(maxHeight ? { maxHeight } : {}) };
}

export function describeObjectFilter(filter: ObjectFilter): string {
  return [
    filter.place && `장소 「${filter.place}」 먼저`, filter.surface && `면 ${filter.surface}`,
    filter.maxWidth && `가로≤${filter.maxWidth}`, filter.maxHeight && `세로≤${filter.maxHeight}`,
  ].filter(Boolean).join(" · ");
}

export function kitSurface(kit: Pick<SectionStructureKitDef, "ai" | "spec">): ObjectSurface {
  const tags = kit.ai?.tags ?? [];
  if (tags.includes("wallmount") || kit.spec?.placement?.anchor === "hang") return "wall";
  if (tags.includes("물 위") || kit.ai?.placementRules?.startsWith("물 위")) return "water";
  return "floor";
}

const lower = (value: string) => value.toLocaleLowerCase();

export function matchesObjectFilter(object: SearchableObject, filter: ObjectFilter): boolean {
  if (filter.maxWidth !== undefined && object.width > filter.maxWidth) return false;
  if (filter.maxHeight !== undefined && object.height > filter.maxHeight) return false;
  if (filter.surface !== undefined && (object.surface ?? "floor") !== filter.surface) return false;
  return true;
}

/**
 * place 는 거르지 않고 앞으로 올린다. Sonnet 측정(2026-11-23): 「항구」「캠핑장」「정비소」로 거르니 그 낱말이 태그에 없는
 * 말뚝·나무 상자·텐트·기름통이 목록에서 사라졌다(놓친 개념 82개 중 6). 맞는 행이 먼저, 나머지는 뒤에 그대로 남는다.
 */
export function matchesPlace(object: Pick<SearchableObject, "name" | "tags">, place: string | undefined): boolean {
  if (place === undefined) return true;
  const words = lower(place).split(/\s+/u).filter(Boolean);
  const fields = [object.name, ...object.tags].map(lower);
  return words.every(word => fields.some(field => field.includes(word)));
}

const VARIANT_SUFFIX = /^(.*\S)\s+(?:[A-Z]|\d{1,2})$/u;

/**
 * 같은 칩셋의 「이름 A·B·C」「… 1·2」 변형을 첫 행 하나로 접고 나머지 id 를 variantIds 로 붙인다.
 * 측정(2026-11-23): 편의점 A·B·C, 주유소(대형 캐노피) A·B 가 40행과 10개 선택을 나눠 먹어 쓰레기통·파라솔 탁자를 밀어냈다.
 */
export function collapseVariants<T extends { id: string; name: string; tilesetId?: string | null }>(rows: readonly T[]): (T & { variantIds?: string[] })[] {
  const groups = new Map<string, T & { variantIds?: string[] }>();
  const out: (T & { variantIds?: string[] })[] = [];
  for (const row of rows) {
    const base = VARIANT_SUFFIX.exec(row.name)?.[1];
    const key = base === undefined ? undefined : `${row.tilesetId ?? ""}|${base}`;
    const head = key === undefined ? undefined : groups.get(key);
    if (head) { (head.variantIds ??= []).push(row.id); continue; }
    const kept: T & { variantIds?: string[] } = { ...row };
    if (key !== undefined) groups.set(key, kept);
    out.push(kept);
  }
  return out;
}

/**
 * 낮을수록 앞. `sheetTags` 는 칩셋 이름처럼 그 칩셋의 모든 행에 붙는 태그 — 거기만 맞는 행은 뒤로 간다.
 * 0 이름이 질의와 같음, 1 이름에 모든 낱말, 2 자기 태그가 질의와 같음(장소 태그 정확 일치), 3 이름·자기 태그에 모든 낱말,
 * 4 id·설명·칩셋 태그까지 봐야 모든 낱말, 5+ 일부 낱말만(빠진 낱말 수만큼 더).
 * 이름을 태그보다 앞에 두는 까닭: 「부두」 정확 태그는 창고 적재장 소품에도 붙어, 이름에 부두가 든 기물을 10위 밖으로 밀었다(측정 q06).
 */
export function objectQueryRank(object: SearchableObject, query: string, sheetTags: ReadonlySet<string> = new Set()): number {
  const q = lower(query.trim());
  if (!q) return 0;
  const name = lower(object.name);
  if (name === q) return 0;
  const words = q.split(/\s+/u).filter(Boolean);
  if (words.every(word => name.includes(word))) return 1;
  const ownTags = object.tags.filter(tag => !sheetTags.has(tag)).map(lower);
  if (ownTags.includes(q)) return 2;
  const own = [name, ...ownTags];
  if (words.every(word => own.some(field => field.includes(word)))) return 3;
  const all = [...own, lower(object.id), lower(object.description ?? ""), ...object.tags.map(lower)];
  const missing = words.filter(word => !all.some(field => field.includes(word))).length;
  return missing === 0 ? 4 : 4 + missing;
}

export function topCounts(values: Iterable<string>, top = 5): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top).map(([value, count]) => ({ value, count }));
}

export const formatCounts = (counts: readonly { value: string; count: number }[]) => counts.map(({ value, count }) => `${value} ${count}`).join(", ");
