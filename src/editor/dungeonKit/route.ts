// 던전 라우팅(2026-10-15) — 요청 낱말·장르 프리셋·칩셋 계열 → (어댑터, 종류, 변형, 타일셋).
// 규칙: ① 기존 맵을 고치면 그 맵의 칩셋이 어댑터를 정한다. ② 새 맵이면 장르가 정한다(pokemon → 몬스터 키트, rpg → 버들항).
// ③ 어댑터가 그 종류를 못 지으면 거절(가장 가까운 지원 종류를 권한다). 다른 칩셋으로 조용히 갈아타지 않는다.
import type { Project, TilesetDef } from "@/project/types";
import { createMonsterKitTileset } from "@/project/defaults/monsterKit";
import { DungeonComposeError } from "./errors";
import { adapterCaps, adapterIdForTileset, adapterSupports, refusalMessage, type AdapterId } from "./capabilities";
import { GENRE_PRESETS, genreOfProject, type DungeonGenre } from "./genres";
import { inferDungeonType } from "./grammar";
import { isMonsterSheet, monsterKitFor, monsterVariants, type MonsterSheet } from "./monster/monsterAdapter";
import { composeDungeon } from "./beodeul/compose";
import { composeMonsterDungeon } from "./monster/monsterAdapter";
import type { DungeonCompose, DungeonSpec, DungeonType } from "./types";
import { DUNGEON_TYPES } from "./types";

export const BEODEUL_TILESET_ID = "beodeul_city";
const MONSTER_TEXTURE: Record<MonsterSheet, string> = { dungeon: "tex_monster_dungeon", overworld: "tex_monster_overworld" };

export interface DungeonRoute {
  readonly adapter: "beodeul" | "monster";
  readonly genre: DungeonGenre;
  readonly type: DungeonType;
  readonly variant?: string;
  readonly tilesetId: string;
  /** 프로젝트에 아직 없어 번들에서 가져와야 하는 타일셋(몬스터 시트). 도구가 draft 에 넣는다. */
  readonly addTileset?: TilesetDef;
  readonly notes: string[];
}

export interface RouteArgs {
  readonly type?: string;
  readonly variant?: string;
  readonly adapter?: string;
  readonly genre?: string;
  /** 기존 맵(빈 맵을 그 자리에 짓는 경우) — 그 맵의 칩셋이 어댑터를 정한다. */
  readonly mapId?: string;
  /** 사용자 말(종류를 말하지 않았을 때 추정). */
  readonly text?: string;
}

const isType = (v: unknown): v is DungeonType => typeof v === "string" && (DUNGEON_TYPES as readonly string[]).includes(v);

/** 프로젝트 안에서 몬스터 시트를 찾는다(그룹으로 알아본다). 없으면 번들에서 만들 사본을 돌려준다(몬스터 칩셋 계열 프로젝트만). */
function monsterSheetFor(project: Project, sheet: MonsterSheet): { ts: TilesetDef; add?: TilesetDef } | null {
  const all = Object.values(project.tilesets);
  const found = all.find((t) => isMonsterSheet(t, sheet));
  if (found) return { ts: found };
  try {
    const fresh = createMonsterKitTileset(MONSTER_TEXTURE[sheet]);
    return { ts: fresh, add: fresh };
  } catch { return null; }
}

export function routeDungeon(project: Project, args: RouteArgs): DungeonRoute {
  const notes: string[] = [];
  const genre: DungeonGenre = args.genre === "pokemon" || args.genre === "rpg" ? args.genre : genreOfProject(project);
  const preset = GENRE_PRESETS[genre];

  // 1) 어댑터
  let adapter: AdapterId;
  const map = args.mapId ? project.maps[args.mapId] : undefined;
  if (args.adapter === "beodeul" || args.adapter === "monster") adapter = args.adapter;
  else if (map) adapter = adapterIdForTileset(project.tilesets[map.tilesetId]);
  else {
    const hasBeodeul = !!project.tilesets[BEODEUL_TILESET_ID];
    const hasMonster = Object.values(project.tilesets).some((t) => adapterIdForTileset(t) === "monster");
    // 새 맵: 프로젝트가 고른다 — 몬스터 수집 장르(system.genre) → 몬스터 키트, 아니면 이미 있는 맵들의 칩셋 다수결(몬스터 맵이 더 많으면 몬스터 키트), 그 밖은 버들항.
    // 요청의 genre 인자는 배치 프리셋(짧은/긴 던전)만 바꾼다 — 그림체 계열은 바꾸지 않는다(칩셋 계열 지키기).
    const votes: Partial<Record<AdapterId, number>> = {};
    for (const m of Object.values(project.maps)) { const id = adapterIdForTileset(project.tilesets[m.tilesetId]); votes[id] = (votes[id] ?? 0) + 1; }
    const startAdapter = adapterIdForTileset(project.tilesets[project.maps[project.startMapId]?.tilesetId ?? ""]);
    const isMonsterProject = genreOfProject(project) === "pokemon" || (votes.monster ?? 0) > (votes.beodeul ?? 0);
    if (isMonsterProject && (hasMonster || !hasBeodeul)) adapter = "monster";
    else if (hasBeodeul) adapter = "beodeul";
    else adapter = hasMonster ? "monster" : startAdapter;
    // 던전을 못 짓는 칩셋(조선·마법 학교 …)이 시작 맵이고 beodeul·monster 가 둘 다 없거나 다수가 그 칩셋이면 그 계열을 따른다 → 거절
    const top = (Object.entries(votes) as [AdapterId, number][]).sort((x, y) => y[1] - x[1])[0]?.[0];
    if (top && top !== "none" && top !== "beodeul" && top !== "monster" && !args.adapter) adapter = top;
  }

  // 2) 종류
  let type: DungeonType | null = isType(args.type) ? args.type : null;
  if (!type && args.text) type = inferDungeonType(args.text).type;
  if (!type) type = (adapter === "monster" ? preset.defaultType.monster : preset.defaultType.beodeul);
  let variant = typeof args.variant === "string" && args.variant.trim() ? args.variant.trim() : undefined;

  if (adapter !== "beodeul" && adapter !== "monster") throw new DungeonComposeError(refusalMessage(adapterCaps(adapter), type), "type-unsupported-by-tileset");
  const caps = adapterCaps(adapter);
  if (!adapterSupports(caps, type)) throw new DungeonComposeError(refusalMessage(caps, type), "type-unsupported-by-tileset");

  // 3) 타일셋
  if (adapter === "beodeul") {
    const ts = project.tilesets[BEODEUL_TILESET_ID];
    if (!ts) throw new DungeonComposeError("이 프로젝트에는 버들항 타일셋(beodeul_city)이 없다 — 버들항 던전은 버들항 타일셋 전용이다.", "beodeul-tileset-missing");
    if (variant) notes.push(`버들항 ${type} 에는 변형(variant)이 없어 무시했다.`);
    return { adapter, genre, type, tilesetId: ts.id, notes };
  }
  // 몬스터: 변형이 목록에 없으면 기본 변형
  if (variant && !monsterVariants(type).includes(variant)) { notes.push(`몬스터 키트 ${type} 에 변형 ${variant} 는 없다 — 기본 변형으로 지었다(변형: ${monsterVariants(type).join("·") || "없음"}).`); variant = undefined; }
  const kit = monsterKitFor(type, variant)!;
  const sheet = monsterSheetFor(project, kit.sheet);
  if (!sheet) throw new DungeonComposeError(`몬스터 시트(${kit.sheet})를 번들에서 만들지 못했다.`, "kit-missing");
  return { adapter, genre, type, ...(variant ? { variant } : {}), tilesetId: sheet.ts.id, ...(sheet.add ? { addTileset: sheet.add } : {}), notes };
}

/** 라우트 + 장르 배치 인자 → 어댑터가 칠한 결과. */
export function composeRouted(route: DungeonRoute, ts: TilesetDef, spec: DungeonSpec): DungeonCompose {
  const laid = GENRE_PRESETS[route.genre].layout(route.type, { ...spec, type: route.type, ...(route.variant ? { variant: route.variant } : {}) });
  const composed = route.adapter === "monster" ? composeMonsterDungeon(ts, laid) : composeDungeon(ts, laid);
  return { ...composed, adapter: route.adapter, tilesetId: ts.id };
}
