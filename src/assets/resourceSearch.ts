// 리소스 시맨틱 텍스트 검색. Phase 1 `list_resources` 툴(핸드오프 0.4 DoD)이 사용할 조회 함수.
// 부분 문자열 + 태그 매칭, 한국어 질의 기준.

import { listAudioResources } from "@/assets/audioResourceCatalog";
import type { AudioDescriptionSource, AudioResourceProject } from "@/assets/audioResourceCatalog";
import { applyCharsetLabelOverrides, CHARSET_SEMANTICS } from "@/assets/charsetSemantics";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { EASYRPG_BACKDROP_ASSETS, EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { koreanMonsterTags } from "@/assets/monsterResourceSemantics";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { SCARLOXY_BACKDROP_ASSETS, SCARLOXY_MONSTER_ASSETS } from "@/assets/scarloxyPack";
import { moodTagsForAsset } from "@/assets/resourceMoodTags";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsDungeon";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroDungeon";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroHouse";
import { RETRO_WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroWorld";
import { SHIP_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsWorld";
import {
  DUNGEON_TEXTURE_KEY,
  INTERIOR_TEXTURE_KEY,
  RETRO_DUNGEON_TEXTURE_KEY,
  RETRO_EXTERIOR_TEXTURE_KEY,
  RETRO_HOUSE_TEXTURE_KEY,
  RETRO_WORLD_TEXTURE_KEY,
  SHIP_TEXTURE_KEY,
  WORLD_TEXTURE_KEY,
} from "@/project/tilesetHarness";
import type { CharsetLabelOverride, TilesetDef } from "@/project/types";

export type ResourceSearchKind = "backdrop" | "bgm" | "charset" | "monster" | "se" | "tile";

export interface ResourceSearchOptions {
  // 타일 검색 시 프로젝트 타일셋의 사용자 메타데이터(tileMeta/tileGroups)를 번들 시맨틱 위에 겹친다.
  // 맵 인터뷰로 가르친 설명이 번들 기본값보다 우선 검색되게 하는 배선이다.
  readonly tileset?: TilesetDef;
  readonly charsetLabels?: readonly CharsetLabelOverride[];
  readonly audioProject?: AudioResourceProject;
}

export interface ResourceSearchResult {
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
  readonly score: number;
  readonly resourceId?: string;
  readonly description?: string;
  readonly descriptionSource?: AudioDescriptionSource;
}

type ResourceCandidate = Omit<ResourceSearchResult, "score">;

export function searchResources(kind: ResourceSearchKind, query: string, options: ResourceSearchOptions = {}): ResourceSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const candidates = candidatesForKind(kind, options);
  // "*" / "all" / "전체"는 브라우징용 전체 목록 — LLM이 후보를 몰라 훑어볼 때 쓴다.
  if (trimmed === "*" || trimmed.toLowerCase() === "all" || trimmed === "전체") {
    return candidates.map((candidate) => ({ ...candidate, score: 1 }));
  }
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: queryScore(
        trimmed,
        candidate.label,
        candidate.description === undefined
          ? candidate.tags
          : [...candidate.tags, candidate.description],
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

// 전체 질의 점수. 통째로 0점이면 공백 단위로 쪼개 부분 합산한다("마을 사람" → "마을"+"사람").
function queryScore(query: string, label: string, tags: readonly string[]): number {
  const whole = matchScore(query, label, tags);
  if (whole > 0) return whole;
  const terms = query.split(/\s+/).filter((term) => term.length > 0);
  if (terms.length < 2) return 0;
  const scored = terms.map((term) => matchScore(term, label, tags));
  const sum = scored.reduce((total, s) => total + s, 0);
  const allHit = scored.every((s) => s > 0);
  return sum + (allHit ? 20 : 0);
}

function matchScore(query: string, label: string, tags: readonly string[]): number {
  const q = query.toLowerCase();
  const labelLower = label.toLowerCase();
  let score = 0;
  if (labelLower === q) score += 100;
  else if (labelLower.includes(q)) score += 50;
  let tagScore = 0;
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === q) tagScore += 40;
    else if (tagLower.includes(q)) tagScore += 20;
  }
  score += Math.min(40, tagScore);
  return score;
}

// 차셋 textureKey에서 파생되는 검색 태그.
// LLM은 "people1"/"npc"/"villager" 같은 영문 질의를 우선 시도하므로(감사 로그로 확인)
// 한국어 라벨만으로는 0건이 된다 — 시트명·카테고리 동의어를 태그로 보강한다.
const CHARSET_CATEGORY_SYNONYMS: Record<string, readonly string[]> = {
  actor: ["actor", "hero", "영웅", "주인공", "동료", "파티"],
  animal: ["animal", "동물"],
  monster: ["monster", "enemy", "몬스터", "적"],
  object: ["object", "사물", "오브젝트"],
  people: ["people", "npc", "human", "villager", "사람", "주민", "마을", "마을 사람"],
  vehicle: ["vehicle", "탈것"],
  vehicles: ["vehicle", "탈것"],
};

function charsetDerivedTags(textureKey: string): string[] {
  const shortKey = textureKey.replace(/^tex_(?:easyrpg|scarloxy)_charset_/, "");
  const base = shortKey.replace(/\d+$/, "");
  return [shortKey, base, ...(CHARSET_CATEGORY_SYNONYMS[base] ?? [])];
}

function idWords(id: string): string[] {
  return id
    .split(/[^a-zA-Z0-9가-힣]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function monsterCandidates(): ResourceCandidate[] {
  const generated = GENERATED_ASSET_PLAN.assets
    .filter((asset) => asset.status === "promoted" && asset.resourceKind === "monster")
    .map((asset) => ({
      id: asset.resourceId,
      label: asset.id.replace(/-/g, " "),
      tags: [
        "monster",
        "enemy",
        "몬스터",
        "적",
        asset.id,
        asset.resourceId,
        ...idWords(asset.id),
        ...idWords(asset.resourceId),
        ...koreanMonsterTags(asset.id, asset.resourceId),
        asset.prompt,
      ],
    }));
  const builtin = builtinGeneratedResourceIds()
    .filter((id) => id.startsWith("generated-enemy-") && !generated.some((asset) => asset.id === id))
    .map((id) => ({
      id,
      label: id.replace(/^generated-enemy-/, "").replace(/-/g, " "),
      tags: ["monster", "enemy", "몬스터", "적", id, ...idWords(id), ...koreanMonsterTags(id)],
    }));
  const rtpMonsters = EASYRPG_RTP_ASSETS
    .filter((asset) => asset.category === "monster")
    .map((asset) => ({
      id: asset.id,
      label: asset.name,
      tags: [
        ...moodTagsForAsset(asset),
        asset.id,
        ...idWords(asset.id),
        ...idWords(asset.name),
        ...koreanMonsterTags(asset.id, asset.name),
      ],
    }));
  const scarloxyMonsters = SCARLOXY_MONSTER_ASSETS.map((asset) => ({
    id: asset.id,
    label: asset.name,
    tags: ["monster", "enemy", "scarloxy", ...asset.tags, asset.id, ...idWords(asset.id)],
  }));
  return [...generated, ...builtin, ...rtpMonsters, ...scarloxyMonsters];
}

// 타일셋 텍스처에 맞는 번들 시맨틱 테이블 선택.
// 타일 인덱스는 칩셋마다 의미가 다르므로 combined_town 테이블을 다른 칩셋에 적용하면 오답이 된다.
// 이전에는 interior/dungeon 이외의 모든 번들 칩셋이 폴백으로 combined_town 을 받았다 —
// 배·월드맵·레트로 4종이 다른 칩셋의 사실을 인용하는 상태였다. 칩셋별로 갈라 준다.
const BUNDLED_TILE_SEMANTICS: ReadonlyMap<
  string,
  readonly { index: number; label: string; tags: readonly string[] }[]
> = new Map([
  [INTERIOR_TEXTURE_KEY, INTERIOR_TILE_SEMANTICS],
  [DUNGEON_TEXTURE_KEY, DUNGEON_TILE_SEMANTICS],
  [RETRO_DUNGEON_TEXTURE_KEY, RETRO_DUNGEON_TILE_SEMANTICS],
  [RETRO_EXTERIOR_TEXTURE_KEY, RETRO_EXTERIOR_TILE_SEMANTICS],
  [RETRO_HOUSE_TEXTURE_KEY, RETRO_HOUSE_TILE_SEMANTICS],
  [RETRO_WORLD_TEXTURE_KEY, RETRO_WORLD_TILE_SEMANTICS],
  [SHIP_TEXTURE_KEY, SHIP_TILE_SEMANTICS],
  [WORLD_TEXTURE_KEY, WORLD_TILE_SEMANTICS],
]);

export function bundledTileSemantics(
  tileset: TilesetDef | undefined
): readonly { index: number; label: string; tags: readonly string[] }[] {
  if (tileset?.image.type === "bundled") return BUNDLED_TILE_SEMANTICS.get(tileset.image.id) ?? COMBINED_TOWN_TILE_SEMANTICS;
  if (!tileset) return COMBINED_TOWN_TILE_SEMANTICS;
  return [];
}

// 번들 시맨틱 + 프로젝트 사용자 메타데이터 병합. 같은 타일이면 사용자 라벨이 이기고 태그는 합친다.
function tileCandidates(tileset: TilesetDef | undefined): ResourceCandidate[] {
  const byTile = new Map<number, { label: string; tags: string[] }>();
  for (const entry of bundledTileSemantics(tileset)) {
    byTile.set(entry.index, { label: entry.label, tags: [...entry.tags] });
  }
  if (tileset) {
    // 그룹 이름/역할/배치 규칙도 소속 타일의 검색 태그가 된다.
    for (const group of tileset.tileGroups ?? []) {
      for (const tile of group.tileIds) {
        const entry = byTile.get(tile) ?? { label: group.name, tags: [] };
        entry.tags.push(group.name, group.role);
        byTile.set(tile, entry);
      }
    }
    (tileset.tileMeta ?? []).forEach((meta, tile) => {
      const label = meta.label.trim();
      const description = meta.description.trim();
      if (!label && !description && !(meta.tags?.length)) return;
      const entry = byTile.get(tile) ?? { label: label || `타일 ${tile}`, tags: [] };
      if (label) {
        // 사용자 수기 라벨만 큐레이션(번들 시맨틱)을 이긴다 — 하네스 시드 라벨(bundled-default)은
        // 태그로 강등해 계속 검색되게 한다(구버전은 source 불문 밀어내서 큐레이션이 가려졌음).
        const userAuthored = meta.source === "user" || meta.origin === "user";
        if (userAuthored) {
          if (entry.label !== label) entry.tags.push(entry.label);
          entry.label = label;
        } else if (entry.label !== label) {
          entry.tags.push(label);
        }
      }
      if (description) entry.tags.push(description);
      entry.tags.push(...(meta.tags ?? []));
      if (meta.role) entry.tags.push(meta.role);
      byTile.set(tile, entry);
    });
  }
  return [...byTile.entries()].map(([tile, entry]) => ({
    id: `tile:${tile}`,
    label: entry.label,
    tags: [...new Set(entry.tags)],
  }));
}

function candidatesForKind(kind: ResourceSearchKind, options: ResourceSearchOptions): ResourceCandidate[] {
  switch (kind) {
    case "tile":
      return tileCandidates(options.tileset);
    case "charset":
      return applyCharsetLabelOverrides(CHARSET_SEMANTICS, options.charsetLabels).map((entry) => ({
        id: `charset:${entry.textureKey}:${entry.characterIndex}`,
        label: entry.label,
        tags: [...entry.tags, ...charsetDerivedTags(entry.textureKey)],
      }));
    case "monster":
      return monsterCandidates();
    case "backdrop":
      return [
        ...EASYRPG_BACKDROP_ASSETS.map((asset) => ({
          id: `backdrop:${asset.id}`,
          label: asset.name,
          tags: moodTagsForAsset(asset),
        })),
        ...SCARLOXY_BACKDROP_ASSETS.map((asset) => ({
          id: `backdrop:${asset.id}`,
          label: asset.name,
          tags: ["backdrop", "battle", "scarloxy", ...asset.tags, ...idWords(asset.id)],
        })),
      ];
    case "bgm":
    case "se": {
      const audioKinds = { bgm: "music", se: "sound" } as const;
      const project = options.audioProject ?? {
        resourceProfiles: [],
        assets: { uploaded: {} },
      };
      return listAudioResources(audioKinds[kind], project).map(resource => ({
        id: `${kind}:${resource.id}`,
        resourceId: resource.id,
        label: resource.name,
        tags: resource.tags,
        description: resource.description,
        descriptionSource: resource.descriptionSource,
      }));
    }
    default:
      return [];
  }
}
