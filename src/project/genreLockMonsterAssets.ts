// project/genreLockMonsterAssets.ts
// 몬스터 자산 역방향 잠금(2026-10-17) — 장르 잠금(genreLock.ts)의 짝이다.
//
// 기존 장르 잠금은 「monster-collect·romance 프로젝트가 자기 장르 자산만 쓰게 묶는」 허용 목록이다. 반대 방향이 없어서 JRPG·CT·FF6·연애 프로젝트에서도
// 포켓몬식 도구(place_monster_center·place_trainer·define_monster_species …)·몬스터 칩셋·Scarloxy 트레이너 칩·몬스터 전투 그림이 막히지 않았다
// (jrpg-loop-1 D1: FF6풍 요청이 몬스터 센터·도감·에메랄드 프로필·스타터 몬스터로 지어졌다).
//
// 규칙 하나: 몬스터 수집 자산은 **몬스터 프로젝트**(아래 projectHasMonsterGameEvidence)이거나 **몬스터 수집으로 분류된 사용자 요청 턴**(ToolContext.monsterTurn)에서만 보이고 쓰인다.
//   - 도구: 조수 도구 목록·find_tools·요약에서 빠지고, 이름으로 불러도 실행기가 거부한다(거부 문장에 다음 행동).
//   - 칩셋·캐릭터 칩·얼굴·전투 그림·전투 스킨: 조수 검색·목록·기본 고르기에서 빠지고, 새로 고르거나 바꾸면 거부한다.
//   - 프롬프트: 능력 색인·레시피·시스템 지침에서 몬스터 문구를 뺀다.
// 이 파일은 판정의 **유일한 입구**다 — 노출(createPiToolset·find_tools·세션 노출)·실행(toolRunner)·검사(check_genre_lock·QA)·DB 화면이 모두 여기를 부른다.
// 사용자가 편집기에서 손으로 하는 것은 막지 않는다(ctx.assistantRun 일 때만 강제). 이미 그려진 그림·이미 만든 몬스터 프로젝트는 건드리지 않는다 — 조수가 **새로 고르는 것**만 막는다.
// 경계가 애매하면 허용한다: 일반 RPG 의 몬스터(적·사냥터·몬스터 헌터)는 막지 않는다 — 막는 것은 포켓몬식 수집·트레이너·센터·도감·포획 계열 도구와 포켓몬풍 자산뿐이다(아래 표).
// 이 파일은 잎 모듈이다(무거운 번들 표를 끌어오지 않는다). 사용처 diff 판정·카탈로그 필터는 genreLockMonsterAssetsDiff.ts.

import { isMonsterNoCaptureGame } from "./monsterCollection";
import { tilesetFamily } from "./tilesetFamily";
import type { Project } from "./types";

/** 이 턴이 몬스터 수집 요청인가의 사실 — 호출자가 사용자 글(의도 메모 제외)을 hasMonsterCollectIntent 로 판정해 넘긴다. */
export interface MonsterAssetTurn {
  readonly monsterTurn?: boolean;
}

// ── 어떤 프로젝트가 몬스터 프로젝트인가 ───────────────────────────────────────────────────────────

/**
 * 몬스터 수집 게임이라고 **선언**된 프로젝트 — 장르 표지·장르 잠금·기획 프리셋·포획 시스템·포획 없는 몬스터 파티 전투.
 * qa/gameCheck/monster.ts 의 isMonsterGame 이 이 함수를 그대로 쓴다(완료 검사와 같은 판정).
 */
export function isDeclaredMonsterGame(project: Pick<Project, "system"> & Partial<Pick<Project, "gameDesignBrief">>): boolean {
  const system = project.system;
  return system?.genre === "monster-collect" || system?.genreLock?.preset === "monster-collect"
    || project.gameDesignBrief?.presetId === "monster-collect" || system?.monsterCollection === true || isMonsterNoCaptureGame(project);
}

/** 몬스터 칩셋 계열(tilesetFamily.ts KNOWN_FAMILY_LABELS 의 「몬스터 수집」 둘). */
export const MONSTER_TILESET_FAMILIES: ReadonlySet<string> = new Set(["oprn-monster", "oprn-monster-emerald"]);

/** 칩셋 하나가 몬스터 칩셋인가. 프로젝트에 없는 공용 DB 행의 칩셋 id 는 이름 모양(monster_*·emerald_monster_*)으로 본다. */
export function isMonsterTilesetId(project: Pick<Project, "tilesets">, tilesetId: string): boolean {
  if (project.tilesets[tilesetId]) return MONSTER_TILESET_FAMILIES.has(tilesetFamily(project, tilesetId));
  return /^(?:emerald_)?monster_/u.test(tilesetId);
}

/**
 * 이미 몬스터 게임을 하고 있는 프로젝트 — 선언(isDeclaredMonsterGame)에 더해 몬스터 파티 전투·원정 정의·몬스터 칩셋 맵이 있으면 참이다.
 * 이런 프로젝트는 영향이 없다(기존 프로젝트 불변). 기본 프로젝트가 싣는 몬스터 종 10개·몬스터 칩셋(번들 목록)은 증거가 아니다 — 맵이 실제로 쓰는 칩셋만 본다.
 */
export function projectHasMonsterGameEvidence(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>): boolean {
  if (isDeclaredMonsterGame(project)) return true;
  const system = project.system;
  if (system?.monsterBattleParty === true || system?.battleParty === "monsters" || system?.monsterCampaign !== undefined) return true;
  return Object.values(project.maps ?? {}).some((map) => isMonsterTilesetId(project, map.tilesetId));
}

/** 몬스터 자산을 보여 주고 쓰게 해도 되는가 — 몬스터 프로젝트이거나 몬스터 수집 요청 턴. 노출·실행·검사가 모두 이 함수 하나를 쓴다. */
export function monsterAssetsAllowed(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, turn?: MonsterAssetTurn): boolean {
  return turn?.monsterTurn === true || projectHasMonsterGameEvidence(project);
}

/** 몬스터 자산 상태 보고(check_genre_lock·DB 화면) — 허용 여부와 그 근거 한 줄. 판정은 monsterAssetsAllowed 와 같다. */
export function monsterAssetStatus(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, turn?: MonsterAssetTurn): { readonly allowed: boolean; readonly reason: string } {
  if (isDeclaredMonsterGame(project)) return { allowed: true, reason: "몬스터 수집 게임으로 선언된 프로젝트" };
  const system = project.system;
  if (system?.monsterBattleParty === true || system?.battleParty === "monsters" || system?.monsterCampaign !== undefined) return { allowed: true, reason: "몬스터 파티 전투·원정 정의가 있는 프로젝트(기존 몬스터 게임)" };
  if (Object.values(project.maps ?? {}).some((map) => isMonsterTilesetId(project, map.tilesetId))) return { allowed: true, reason: "맵이 몬스터 칩셋을 쓰는 프로젝트(기존 몬스터 게임)" };
  if (turn?.monsterTurn === true) return { allowed: true, reason: "이번 요청이 몬스터 수집 요청(그 턴만)" };
  return { allowed: false, reason: "몬스터 수집 게임이 아니고 이번 요청도 몬스터 수집 요청이 아니다 — 포켓몬식 도구·칩셋·캐릭터 칩·전투 그림을 조수가 새로 고르지 못한다(이미 있는 것과 사용자의 손 편집은 막지 않는다)" };
}

/** 이 프로젝트에 역방향 잠금이 걸려 있는가(= 몬스터 자산이 막힌 프로젝트). 검사 도구·DB 화면 표시용. */
export function monsterAssetLockApplies(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, turn?: MonsterAssetTurn): boolean {
  return !monsterAssetsAllowed(project, turn);
}

// ── 이 도구 호출 동안만 켜지는 턴 신호(동기 도구 실행 구간) ─────────────────────────────────────────

let activeTurn: MonsterAssetTurn | undefined;

/** 도구 실행 구간 동안 ctx.monsterTurn 을 켠다 — find_tools·list_* 같은 읽기 도구는 ctx 를 못 받으므로 이 값으로 같은 판정을 쓴다(try/finally 로 되돌린다). */
export function withMonsterTurn<T>(turn: MonsterAssetTurn | undefined, run: () => T): T {
  const previous = activeTurn;
  activeTurn = turn;
  try { return run(); } finally { activeTurn = previous; }
}

/** 지금 도구 실행 구간의 턴 신호(없으면 undefined = 몬스터 요청 아님). */
export function activeMonsterTurn(): MonsterAssetTurn | undefined {
  return activeTurn;
}

// ── 거부 목록(명시표) ───────────────────────────────────────────────────────────────────────────────

export type MonsterToolGroup = "campaign" | "species" | "field" | "system";

interface MonsterToolRow {
  readonly name: string;
  readonly group: MonsterToolGroup;
  /** 사람이 읽는 한 줄 — 왜 몬스터 수집 전용인가. */
  readonly why: string;
}

/**
 * 몬스터 프로젝트(또는 몬스터 요청 턴)에서만 쓰는 도구 — 포켓몬식 수집·트레이너·센터·도감·포획·상성표·필드 기술 게이트.
 * place_field_obstacle 은 여기 없다 — kind:'gap'(틈 건너뛰기·장대 도약)은 일반 RPG 필드 능력이라 열고, 나머지 kind(비전머신 HM 게이트)는 아래 ARG_RULES 가 막는다.
 * 여기 없는 도구는 막지 않는다: place_npc·upsert_enemy·upsert_troop·set_encounter_table(일반 랜덤 조우)·make_hunting_ground·place_field_enemy·author_dungeon·author_wild_route(버들항 필드 themeScene 이 일반 프로젝트에도 쓴다) 은 일반 RPG 도 쓴다.
 * 도구가 새로 생기면 이 표에 한 줄을 더한다(toolRunner·노출 표가 모두 이 표를 읽는다).
 */
export const MONSTER_ONLY_TOOLS: readonly MonsterToolRow[] = [
  { name: "build_monster_game", group: "campaign", why: "72맵·60종·8체육관 포켓몬형 캠페인 생성" },
  { name: "build_monster_tournament", group: "campaign", why: "포획 없는 트레이너 대회형 몬스터 게임 생성" },
  { name: "build_monster_expedition", group: "campaign", why: "체육관 없는 도감 탐험형 몬스터 게임 생성" },
  { name: "configure_monster_style", group: "campaign", why: "에메랄드 참고 프로필 적용" },
  { name: "configure_monster_campaign", group: "campaign", why: "도감 순서·체육관 배지·진행 목표" },
  { name: "read_monster_game", group: "campaign", why: "몬스터 캠페인 읽기" },
  { name: "review_monster_game", group: "campaign", why: "몬스터 캠페인 완료 검토(센터·도감·배지 요구)" },
  { name: "configure_monster_system", group: "system", why: "포획·몬스터 파티 전투·보관함 시스템 켜기" },
  { name: "define_monster_species", group: "species", why: "도감 종 정의" },
  { name: "define_monster_families", group: "species", why: "도감 종 계통(진화) 일괄 정의" },
  { name: "rename_monster_species", group: "species", why: "도감 종 이름 일괄 변경" },
  { name: "give_starter_monsters", group: "species", why: "스타터 몬스터 3종 선택 이벤트" },
  { name: "set_type_chart", group: "system", why: "포켓몬식 타입 상성표" },
  { name: "place_trainer", group: "field", why: "시야선 트레이너(눈이 마주치면 배틀)" },
  { name: "place_monster_center", group: "field", why: "몬스터 센터 간호사(맡김→회복 연출)" },
  { name: "place_monster_pc", group: "field", why: "몬스터 보관함(PC)" },
  { name: "place_badge_gate", group: "field", why: "배지 N개 필요 길막이" },
];

const MONSTER_ONLY_NAMES: ReadonlySet<string> = new Set(MONSTER_ONLY_TOOLS.map((row) => row.name));

/** 이 이름이 몬스터 전용 도구인가(표만 본다 — 프로젝트·턴은 보지 않는다). */
export function isMonsterOnlyTool(toolName: string): boolean {
  return MONSTER_ONLY_NAMES.has(toolName);
}

/** 몬스터 자산이 막힌 상태에서 이 도구가 조수에게 숨겨져야 하는가(목록·find_tools·능력 색인). 실행 거부는 monsterToolBlocked. */
export function monsterToolHidden(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, toolName: string, turn?: MonsterAssetTurn): boolean {
  return isMonsterOnlyTool(toolName) && !monsterAssetsAllowed(project, turn);
}

/**
 * 조수 도구 실행 구간(withMonsterTurn 안)에서 이 이름이 몬스터 잠금으로 가려지는가 — find_tools·목록 같은 읽기 도구가 ctx 없이 쓴다.
 * 조수 실행이 아니면(편집기 직접 호출·테스트·콘텐츠 스크립트) 구간 신호가 없으므로 아무것도 가리지 않는다.
 */
export function monsterToolHiddenInRun(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, toolName: string): boolean {
  return activeTurn !== undefined && monsterToolHidden(project, toolName, activeTurn);
}

/**
 * 조수 도구 실행 구간에서 이 칩셋 id(몬스터 칩셋)가 목록·검색에서 가려지는가 — list_tileset_references·list_spatial_designs·read_region_reference 목록이 쓴다.
 * 조수 실행이 아니면 구간 신호가 없어 아무것도 가리지 않는다(편집기 UI·스크립트).
 */
export function monsterTilesetHiddenInRun(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, tilesetId: string | null | undefined): boolean {
  return activeTurn !== undefined && !!tilesetId && !monsterAssetsAllowed(project, activeTurn) && isMonsterTilesetId(project, tilesetId);
}

/** 장르 잠금(역방향)이 이 이름을 가려야 하는가 — 기존 장르 잠금의 hiddenToolPatterns 와 함께 본다. 노출 지점 세 곳이 이 한 함수를 쓴다. */
export function toolHiddenByMonsterLock(project: Pick<Project, "system" | "maps" | "tilesets"> & Partial<Pick<Project, "gameDesignBrief">>, toolName: string, turn?: MonsterAssetTurn): boolean {
  return monsterToolHidden(project, toolName, turn);
}

/** 거부 문장 — 무엇이 막혔고, 사용자가 몬스터 수집을 원할 때의 다음 행동까지 싣는다. */
export function monsterToolRejection(toolName: string): string {
  const row = MONSTER_ONLY_TOOLS.find((entry) => entry.name === toolName);
  return `몬스터 수집 잠금: ${toolName}(${row?.why ?? "포켓몬식 몬스터 수집 도구"})은 몬스터 수집 게임 전용이다. 이 프로젝트는 몬스터 수집 게임이 아니고 이번 요청도 몬스터 수집 요청이 아니라서 쓰지 않는다 — `
    + `일반 RPG 의 적·사냥터는 upsert_enemy·upsert_troop·place_field_enemy·set_encounter_table 로, NPC 는 place_npc 로 만든다. `
    + `사용자가 정말 몬스터 수집(포켓몬식) 게임을 원하는지 한 문장으로 되묻고 턴을 끝내라 — 원하면 사용자가 「몬스터 수집 게임 만들어 줘」처럼 말하거나(그 요청 턴부터 도구가 풀린다) 새 프로젝트를 몬스터 수집으로 시작한다. 조수가 임의로 풀지 않는다.`;
}

// ── 인자로 갈리는 도구(일반 도구가 몬스터 전용 값을 받을 때) ──────────────────────────────────────

/**
 * 일반 도구의 몬스터 전용 인자 값 — 도구는 일반 RPG 도 쓰지만 이 값은 포켓몬식 설정이다. 위반이면 거부 문장, 아니면 undefined.
 * 시스템 필드에 닿는 나머지 경로(set_project_settings 의 battle.uiStyle 등)는 실행 뒤 diff 판정(genreLockMonsterAssetsDiff.systemViolation)이 막는다.
 */
export function monsterToolArgViolation(toolName: string, args: Readonly<Record<string, unknown>>): string | undefined {
  const rule = ARG_RULES.find((entry) => entry.tool === toolName && entry.test(args));
  return rule ? `몬스터 수집 잠금: ${toolName} 의 ${rule.what}는 몬스터 수집(포켓몬식) 전용 설정이다. 이 프로젝트는 몬스터 수집 게임이 아니고 이번 요청도 몬스터 수집 요청이 아니라서 거부했다 — ${rule.instead} `
    + `사용자가 정말 몬스터 수집 게임을 원하는지 한 문장으로 되묻고 턴을 끝내라(원하면 「몬스터 수집 게임 만들어 줘」라고 말하면 그 요청 턴부터 풀린다).` : undefined;
}

interface ArgRule { readonly tool: string; readonly what: string; readonly instead: string; readonly test: (args: Readonly<Record<string, unknown>>) => boolean }

const ARG_RULES: readonly ArgRule[] = [
  { tool: "set_project_genre", what: "genre:monster-collect", instead: "장르는 adventure-jrpg 등 이 게임에 맞는 값으로 둔다.", test: (args) => args.genre === "monster-collect" },
  { tool: "reset_project", what: "genrePreset:monster-collect", instead: "빈 프로젝트에 장르 프리셋 없이 시작하거나 이 게임에 맞는 프리셋을 쓴다.", test: (args) => args.genrePreset === "monster-collect" },
  { tool: "place_field_obstacle", what: "kind:rock|tree|water|waterfall|dark(비전머신 HM 필드 기술 게이트)", instead: "일반 RPG 의 필드 능력 틈 건너뛰기는 kind:'gap'(requiresActorId·requiresSkillId) 으로, 열쇠·퍼즐 문은 compile_puzzle, 밀 바위는 place_pushable 로 만든다.", test: (args) => args.kind !== "gap" },
  { tool: "author_dungeon", what: "genre:pokemon(짧은 동굴·야생 조우 계획)", instead: "genre 를 생략하거나 rpg 로 둔다(긴 던전·필드 적·상자·잠긴 문).", test: (args) => args.genre === "pokemon" },
  { tool: "configure_game_systems", what: "battleModel:gen1(몬스터 대치 전투)·monsterCare(산책 돌봄)", instead: "전투 방식은 기본 도트 측면(rm2k3)으로 둔다.",
    test: (args) => {
      const patch = args.battleModel;
      const model = patch && typeof patch === "object" ? (patch as Record<string, unknown>).model ?? (patch as Record<string, unknown>).value : patch;
      return model === "gen1" || args.monsterCare !== undefined && (args.monsterCare as Record<string, unknown> | null)?.enabled !== false;
    } },
];

// ── 시스템 필드(실행 뒤 diff 로 본다) ───────────────────────────────────────────────────────────────

/** before → after 사이에 새로 켜진 몬스터 수집 전용 시스템 필드 이름들(없으면 빈 배열). 이미 켜져 있던 것은 세지 않는다. */
export function monsterSystemFieldChanges(before: Pick<Project, "system">, after: Pick<Project, "system">): string[] {
  const b = before.system, a = after.system;
  const found: string[] = [];
  if (a.genre === "monster-collect" && b.genre !== "monster-collect") found.push("system.genre=monster-collect");
  if (a.monsterCollection === true && b.monsterCollection !== true) found.push("system.monsterCollection");
  if (a.monsterBattleParty === true && b.monsterBattleParty !== true) found.push("system.monsterBattleParty");
  if (a.battleParty === "monsters" && b.battleParty !== "monsters") found.push("system.battleParty=monsters");
  if (a.battleModel === "gen1" && b.battleModel !== "gen1") found.push("system.battleModel=gen1");
  if (a.battleUiStyle === "pokemon" && b.battleUiStyle !== "pokemon") found.push("system.battleUiStyle=pokemon");
  if (a.monsterCampaign !== undefined && b.monsterCampaign === undefined) found.push("system.monsterCampaign");
  if (a.monsterCare !== undefined && b.monsterCare === undefined) found.push("system.monsterCare");
  if (a.genreLock?.preset === "monster-collect" && b.genreLock?.preset !== "monster-collect") found.push("system.genreLock=monster-collect");
  return found;
}
