// editor/operators/materialSlots.ts
// 재료 슬롯 — 오퍼레이터가 소비하는 재료의 전체 목록. 칩셋과 생성 알고리즘 사이의 유일한 접점이다.
//
// 왜(2026-09-01): forest 프로토타입은 combined_town 타일 번호(240·260/290·391…)를 상수로 박아
// 놓아서 칩셋 하나에서만 돌았다. 오퍼레이터를 늘릴수록 그 하드코딩이 배로 늘기 때문에,
// water·village 를 만들기 **전에** 이 층을 세운다.
//
// **슬롯은 저장하지 않고 유도한다.** 이미 승인된 어휘(tileGroups)에 역할·타일·통행·패턴이 다 있다 —
// 그걸 한 번 더 복제하면 "진실이 두 갈래" 라는, 이번 개편이 없애려던 바로 그 병이 재발한다.
// 해석 순서는 세 단:
//   ① 사용자 오버라이드(tileset.materialSlots)  — 사람이 보드에서 고친 것. 최우선.
//   ② 승인 어휘 그룹 매칭                        — 번들 칩셋은 여기서 전부 채워진다.
//   ③ 없음(null)                                 — 그 재료를 쓰는 오퍼레이터는 비활성.
//
// 매칭은 그룹 id 접미사 + 역할 + 이름 키워드로 한다. 하네스 프리픽스가 칩셋마다 다르므로
// (harness-combined-town- / harness-dungeon-v1- / harness-interior-house-v1-) 접두사에 기대지 않는다.
//
// ⚠ A-3(사용자 정의 역할 문자열 + DB 역할 탭)은 이 파일로 대체된다. 사람은 역할을 **정의**하지
// 않고 고정 슬롯에 타일을 **꽂기만** 한다. 역할 능력표(PR #435 roleCapabilities)는 그대로 유효하다.

import type { TileGroupMetadata, TilesetDef } from "@/project/types";

/** 고정 슬롯 12칸. 늘리는 것은 신중히 — 이 목록이 곧 오퍼레이터가 쓸 수 있는 재료의 상한이다. */
export const MATERIAL_SLOT_IDS = [
  "ground",
  "groundAlt",
  "path",
  "plaza",
  "water",
  "shore",
  "tree",
  "treeDead",
  "bush",
  "flower",
  "cliff",
  "fence",
] as const;

export type MaterialSlotId = typeof MATERIAL_SLOT_IDS[number];

export interface MaterialSlot {
  readonly id: MaterialSlotId;
  readonly label: string;
  /** 이 슬롯이 쓰는 타일. 순서는 대표 → 변형. */
  readonly tiles: readonly number[];
  /**
   * 한 칸을 칠할 때 쓰는 **본체** 타일. 오토타일 그룹은 tileIds[0] 이 모서리라
   * 그대로 칠하면 길 한복판에 모서리 무늬가 깔린다(실측: 흙길 390 vs 본체 391).
   */
  readonly body?: number;
  /** 세로 2칸 원자(수관/밑동, 문 상/하)라면 그 쌍. 없으면 낱개 타일 슬롯이다. */
  readonly pair?: { readonly top: number; readonly bottom: number };
  /** 같은 슬롯에 여러 종이 있을 때 전부(수종 혼합). pair 는 이 중 첫 번째다. */
  readonly pairs?: readonly { readonly top: number; readonly bottom: number }[];
  readonly layer: "lower" | "upper";
  readonly passage?: "passable" | "solid";
  /** 어디서 왔는지 — 보드 UI 가 "번들/사용자" 를 구분해 보여 준다. */
  readonly source: "user" | "bundled";
  readonly groupId?: string;
}

export type ResolvedMaterialSlots = Readonly<Partial<Record<MaterialSlotId, MaterialSlot>>>;

interface SlotMatcher {
  readonly id: MaterialSlotId;
  readonly label: string;
  readonly layer: "lower" | "upper";
  /** 그룹 id 가 이 중 하나로 끝나면 확정(프리픽스 무관). */
  readonly idSuffixes: readonly string[];
  /** 보조 매칭 — 역할이 맞고 이름이 걸리면 채택. */
  readonly roles?: readonly string[];
  readonly namePattern?: RegExp;
  /** 세로 페어로 읽을 슬롯인지. 참이면 매칭된 그룹을 **전부** 모은다(수종 혼합). */
  readonly wantsPair?: boolean;
  /** id·이름이 이것에 걸리면 제외. "tree" 접미사가 "dry-tree" 까지 삼키는 것을 막는다. */
  readonly exclude?: RegExp;
}

const MATCHERS: readonly SlotMatcher[] = [
  {
    id: "ground", label: "지면", layer: "lower",
    idSuffixes: ["grass-autotile", "floor-autotile", "dirt-floor-autotile"],
    roles: ["terrain"], namePattern: /잔디|풀밭|바닥|지면/,
  },
  {
    id: "groundAlt", label: "지면 변형", layer: "lower",
    idSuffixes: ["tall-grass-autotile", "dark-grass-autotile"],
    roles: ["terrain"], namePattern: /수풀|긴\s*풀|어두운|짙은/,
  },
  {
    id: "path", label: "길", layer: "lower",
    idSuffixes: ["dirt-road-autotile", "town-path-autotile", "cobble-autotile"],
    roles: ["terrain", "path"], namePattern: /흙길|길|도로|자갈/,
  },
  {
    id: "plaza", label: "광장·포장", layer: "lower",
    idSuffixes: ["stone-floor", "plaza", "pavement"],
    roles: ["terrain", "path"], namePattern: /광장|포장|석재\s*바닥/,
  },
  {
    id: "water", label: "물", layer: "lower",
    idSuffixes: ["lake-water-autotile", "water-autotile"],
    roles: ["water"], namePattern: /물|호수|바다|강/,
  },
  {
    id: "shore", label: "물가·모래", layer: "lower",
    idSuffixes: ["sand-autotile", "shore-autotile"],
    roles: ["terrain"], namePattern: /모래|물가|해변/,
  },
  {
    id: "tree", label: "나무", layer: "upper", wantsPair: true,
    idSuffixes: ["conifer-tree", "broadleaf-tree", "broadleaf-tree-2x2", "tree"],
    roles: ["prop"], namePattern: /침엽수|활엽수|나무(?!\s*상자)/,
    exclude: /dry-tree|dead-tree|마른|고사|죽은/,
  },
  {
    id: "treeDead", label: "고사목", layer: "upper", wantsPair: true,
    idSuffixes: ["dry-tree", "dead-tree"],
    roles: ["prop"], namePattern: /마른\s*나무|고사목|죽은\s*나무/,
  },
  {
    id: "bush", label: "덤불", layer: "upper",
    idSuffixes: ["bush-props", "bush"],
    roles: ["prop"], namePattern: /덤불|수풀/,
  },
  {
    id: "flower", label: "꽃·바닥 장식", layer: "upper",
    idSuffixes: ["flower-props", "flower"],
    roles: ["prop"], namePattern: /꽃|화단/,
  },
  {
    id: "cliff", label: "절벽·담", layer: "lower",
    idSuffixes: ["cliff", "plaster-wall-9slice", "stone-wall"],
    roles: ["wall"], namePattern: /절벽|담|벽/,
  },
  {
    id: "fence", label: "울타리", layer: "lower",
    idSuffixes: ["fence", "fence-autotile"],
    roles: ["fence"], namePattern: /울타리/,
  },
];

export const MATERIAL_SLOT_LABELS: Readonly<Record<MaterialSlotId, string>> =
  Object.fromEntries(MATCHERS.map((matcher) => [matcher.id, matcher.label])) as Record<MaterialSlotId, string>;

function isTrustedGroup(group: TileGroupMetadata): boolean {
  // tileVocabulary.isTrustedGroupSource 와 같은 판정 — 승인된 어휘만 재료가 된다.
  return group.origin === "user" || group.source === "bundled-default" || group.source === "user";
}

/**
 * 세로 2칸 원자에서 상/하 타일을 꺼낸다.
 * 세 가지 배치를 구분해야 한다:
 *  · vertical_expandable — parts 의 top/bottom (침엽수·마른나무)
 *  · source_rect 2×w    — 좌측 열이 세로 쌍이다. tileIds 는 행 우선이라 [0] 과 [minWidth]
 *                          (활엽수 2×2 는 [262,263,292,293] → 262/292. 앞 두 개를 쓰면 262/263,
 *                           즉 수관 좌·우를 위아래로 쌓아 나무가 깨진다.)
 *  · 그 외              — tileIds 앞 두 개
 */
function readPair(group: TileGroupMetadata): { top: number; bottom: number } | undefined {
  const grammar = group.patternGrammar;
  const parts = grammar?.parts;
  if (parts) {
    const top = parts.find((part) => part.role === "top")?.tileIds?.[0];
    const bottom = parts.find((part) => part.role === "bottom")?.tileIds?.[0];
    if (typeof top === "number" && typeof bottom === "number") return { top, bottom };
  }
  const tiles = group.tileIds ?? [];
  if (grammar?.kind === "source_rect") {
    const width = grammar.minWidth ?? 2;
    const top = tiles[0];
    const bottom = tiles[width];
    if (typeof top === "number" && typeof bottom === "number") return { top, bottom };
  }
  const [first, second] = tiles;
  if (typeof first === "number" && typeof second === "number") return { top: first, bottom: second };
  return undefined;
}

/**
 * 통행성. 하네스 그룹(CombinedTownHarnessGroup)은 런타임에 `passage` 를 싣지만 공유 타입
 * TileGroupMetadata 는 그 필드를 선언하지 않는다. 공유 타입을 넓히면 파급이 크므로 여기서만
 * 좁게 읽는다 — 없으면 undefined 로 두고, 통행 판정은 기존 passability 표가 계속 담당한다.
 */
function readPassage(group: TileGroupMetadata): "passable" | "solid" | undefined {
  const value = (group as { passage?: unknown }).passage;
  return value === "passable" || value === "solid" ? value : undefined;
}

/** 한 칸 칠하기용 본체 타일. 오토타일은 중앙(center) 파트가 본체다. */
function readBody(group: TileGroupMetadata): number | undefined {
  const center = group.patternGrammar?.parts?.find((part) => part.role === "center")?.tileIds?.[0];
  if (typeof center === "number") return center;
  return group.tileIds?.[0];
}

function matchScore(group: TileGroupMetadata, matcher: SlotMatcher): number {
  const id = group.id ?? "";
  if (matcher.exclude && (matcher.exclude.test(id) || matcher.exclude.test(group.name ?? ""))) return 0;
  // id 접미사가 가장 강한 신호다 — 하네스가 심은 그룹은 이름이 번역돼도 id 는 안정적이다.
  if (matcher.idSuffixes.some((suffix) => id.endsWith(suffix))) return 3;
  const roleOk = !matcher.roles || matcher.roles.includes(String(group.role));
  const nameOk = matcher.namePattern?.test(group.name ?? "") ?? false;
  if (roleOk && nameOk) return 2;
  return 0;
}

/**
 * 타일셋에서 재료 슬롯을 해석한다. 저장된 것을 읽는 게 아니라 **매번 유도**하므로,
 * 사용자가 어휘를 고치면 다음 생성부터 바로 반영된다.
 */
export function resolveMaterialSlots(tileset: TilesetDef | undefined): ResolvedMaterialSlots {
  if (!tileset) return {};
  const slots: Partial<Record<MaterialSlotId, MaterialSlot>> = {};
  const groups = (tileset.tileGroups ?? []).filter(isTrustedGroup);

  for (const matcher of MATCHERS) {
    // ① 사용자 오버라이드가 있으면 그것으로 끝낸다.
    const override = tileset.materialSlots?.[matcher.id];
    if (override && override.tiles.length > 0) {
      slots[matcher.id] = {
        id: matcher.id,
        label: matcher.label,
        tiles: [...override.tiles],
        ...(override.pair ? { pair: override.pair } : {}),
        layer: override.layer ?? matcher.layer,
        ...(override.passage ? { passage: override.passage } : {}),
        source: "user",
      };
      continue;
    }
    // ② 승인 어휘에서 매칭. 페어 슬롯은 **전부** 모은다 — 수종이 하나뿐이면 숲이 다시 뻔해진다.
    const scored = groups
      .map((group) => ({ group, score: matchScore(group, matcher) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) continue;
    const tiles = (best.group.tileIds ?? []).filter((tile) => Number.isInteger(tile));
    if (tiles.length === 0) continue;
    const pairs = matcher.wantsPair
      ? scored.map((entry) => readPair(entry.group)).filter((pair): pair is { top: number; bottom: number } => Boolean(pair))
      : [];
    const body = readBody(best.group);
    slots[matcher.id] = {
      id: matcher.id,
      label: matcher.label,
      tiles,
      ...(typeof body === "number" ? { body } : {}),
      ...(pairs.length > 0 ? { pair: pairs[0]!, pairs } : {}),
      layer: matcher.layer,
      ...(readPassage(best.group) ? { passage: readPassage(best.group)! } : {}),
      source: "bundled",
      ...(best.group.id ? { groupId: best.group.id } : {}),
    };
  }
  return slots;
}

/** 보드 UI·진단용 — 채워진 슬롯 / 전체. */
export function materialSlotCoverage(slots: ResolvedMaterialSlots): { filled: number; total: number } {
  return { filled: MATERIAL_SLOT_IDS.filter((id) => slots[id]).length, total: MATERIAL_SLOT_IDS.length };
}
