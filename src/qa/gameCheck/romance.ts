// 연애(관계) 게임 부합 검사 — 「막힘 0 · 엔딩 도달」 만으로는 못 잡는 구멍을 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고다.
// 2026-10-16 실제 Argon(8318) 연애 시험에서 qa:game check 가 「막힘 0 · 경고 0」 으로 통과시킨 것들:
//  - 뼈대가 깐 「기억의 조각 / 기억의 길 / 구간 끝 / 첫 구간 끝」 자리표시를 그대로 둔 채 끝(연애와 무관한 맵·엔딩이 통과)
//  - 호감이 쌓이는 인물도, 인물 엔딩도 없이 뼈대 엔딩 하나만 닿음
//  - 인물 NPC 가 전부 투명 이벤트(화면에 아무도 안 보임) · 서로 다른 인물이 같은 칩
//  - 대사 본문 앞에 「[이름]」 이 또 붙은 줄

import { affectionVariableOwners, unmappedAffectionVariables } from "@/project/affectionVariables";
import { isTalkFriendshipEnabled } from "@/project/friendship";
import { ROMANCE_TITLE_SUBTITLE } from "@/project/romancePreset";
import { romanceTitleArtSettingGap, romanceTitleMismatch, romanceTitleMismatchMessage } from "@/project/romanceTitleArt";
import { ROMANCE_PLACEHOLDER_NAMES, SEGMENT_END_ENDING_ID, SEGMENT_END_EVENT_ID, SEGMENT_ROUTE_MAP_ID, SEGMENT_STARTER_EVENT_ID } from "@/project/playableSegmentContract";
import { TILE } from "@/project/defaults/constants";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import type { Command, EventPage, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import { briefTextOf } from "./brief";
import type { Finding } from "./types";
import { openingIsOnlyTitleCard } from "./jrpgCompletion";
import { checkEndingNpcReachable, checkHeroineEndingsCalled, checkPerHeroineEndings, checkSplitHeroineIds, checkRomanceEndings } from "./romanceEndings";
import { allPages, commandList, visitPageCommands } from "./walk";
import { stripSpeakerEcho } from "@/project/dialogueSpeakerEcho";

const ROMANCE_BRIEF = /연애|로맨스|호감|고백|romance|dating/iu;
/** 뼈대가 깔아 두는 자리표시 이름 — 기획에 맞게 바꿨어야 하는 것들. */
const PLACEHOLDER_NAMES = new Set<string>(["기억의 길", "기억의 조각", "구간 끝", "첫 구간 끝", ...ROMANCE_PLACEHOLDER_NAMES.slice(1)]); // 첫 이름(길 맵 「산책로」)은 그대로 써도 어색하지 않아 자리표시로 치지 않는다
/** 빈 프로젝트·인터뷰 시작이 남기는 기본 제목 — 연애 게임은 이 게임의 이름을 가져야 한다. */
const PLACEHOLDER_TITLES = new Set(["", "새 게임", "새 프로젝트"]);
const AFFECTION_VARIABLE = /호감|friendship|affection|favou?r/iu;
const OBJECT_NPC_NAME = /표지판|게시판|안내판|푯말|우편함|시계탑|나무|상자|벤치|분수대|자판기|포인트|안내데스크|다이어리|수첩|커피머신|간식|코너/u;
const PERSON_ROLE_NAME = /학생|선배|후배|동기|친구|교수|선생|매니저|바리스타|팀장|대리|사원|부원|위원|회장|서기|당번|주인|점원|나무꾼|상인|안내원|담당|사서|관리인/u;
/** 대사 본문 속 타일 좌표 「(40,13)」·「(16, 6)」 — 플레이어에게는 뜻 없는 숫자다. */
const RAW_TILE_COORDS = /\(\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/u;
/** 이름이 물가를 약속하는 맵 — 플레이어는 강·호수·바다를 보러 온다. 실내(「강변 카페」)는 물이 없어도 된다. */
const WATERFRONT_MAP_NAME = /강변|강가|호숫가|수변|해변/u;
const INDOOR_MAP_NAME = /카페|실내|가게|식당|레스토랑|호텔|숙소|사무실|매장|편의점|원룸|아파트|교실|방$/u;
const WATERFRONT_MIN_COVERAGE = 0.1;

/** 연애 프로젝트인가 — 호감 하트 HUD(연애 기본값)·인터뷰 장르·기획 문장 중 하나. */
export function isRomanceCheckTarget(project: Project, briefText = briefTextOf(project)): boolean {
  if (project.gameDesignBrief?.interview?.genre === "romance") return true;
  if (project.system?.fieldHud?.theme === "hearts") return true;
  return ROMANCE_BRIEF.test(briefText);
}

function chipOf(page: EventPage): string | undefined {
  const g = page.graphic as { sprite?: { type?: string; id?: string }; characterResourceId?: string; appearanceId?: string; pattern?: number; direction?: string } | undefined;
  if (!g) return undefined;
  if (g.appearanceId) return `appearance:${g.appearanceId}`;
  if (g.characterResourceId) return `character:${g.characterResourceId}`;
  if (g.sprite?.id) return `sprite:${g.sprite.type ?? ""}:${g.sprite.id}:${g.pattern ?? 0}`;
  return undefined;
}

/** 한 사람을 가리키는 키 — 이름(「한서연 선배」)을 우선하고, 이름이 없으면 characterId·이벤트 id. 맵마다 characterId 에 _2 를 붙여도 같은 이름이면 한 사람이다. */
function personKey(event: GameEvent): string {
  const name = event.name?.trim();
  return name || event.characterId?.trim() || event.id;
}

function isPersonEvent(event: GameEvent): boolean {
  const name = (event.name ?? "").trim();
  if ((OBJECT_NPC_NAME.test(name) && !PERSON_ROLE_NAME.test(name)) || /^ev_(?:examine|route_bench|date_bench|segment_)/iu.test(event.id)) {
    return false;
  }
  return Boolean(event.characterId?.trim()) || /^(ev_)?npc[_-]/u.test(event.id);
}

function containsTriggerEnding(commands: readonly Command[] | undefined): boolean {
  return (commands ?? []).some((command) => command.kind === "triggerEnding"
    || (command.kind === "fork" && (containsTriggerEnding((command as { then?: Command[] }).then) || containsTriggerEnding((command as { else?: Command[] }).else))));
}

/** 이 명령 줄이 끝까지 가면 반드시 엔딩이 열리는가 — triggerEnding(endingId) 은 그 엔딩의 conditions 를 다시 보고 거짓이면 넘어가므로 조건 없는 엔딩만 보장한다. */
function guaranteesEnding(project: Project, commands: readonly Command[] | undefined): boolean {
  for (const command of commands ?? []) {
    if (command.kind === "triggerEnding") {
      const ending = command.endingId ? (project.endings ?? []).find((entry) => entry.id === command.endingId) : undefined;
      if (!command.endingId) return false;
      if (ending && (ending.conditions?.length ?? 0) === 0) return true;
      continue;
    }
    if (command.kind === "fork") {
      // 호감 문턱 fork 의 then 쪽 엔딩은 그 문턱 조건이 지킨다 — 구멍은 마지막 else 가 닫혀 있느냐다.
      const branch = command as { then?: Command[]; else?: Command[] };
      if (containsTriggerEnding(branch.then) && guaranteesEnding(project, branch.else)) return true;
    }
  }
  return false;
}

/** 기한(onDayEnd) 판정이 「N일째 이후 어떤 호감 상태여도」 엔딩을 부르는지 — 아무도 안 만난 플레이어가 영영 끝나지 않는 구멍(romance-loop-1 R1). */
function deadlineWithoutFallback(project: Project): string | undefined {
  const hook = project.system?.timeSystem?.onDayEnd;
  const common = hook ? (project.commonEvents ?? []).find((entry) => entry.id === hook) : undefined;
  if (!common) return undefined;
  for (const command of common.commands as Command[]) {
    if (command.kind !== "fork") continue;
    const fork = command as { condition?: { kind?: string; op?: string; value?: unknown }; then?: Command[] };
    if (fork.condition?.kind !== "variable" || fork.condition.op !== ">=") continue;
    if (!guaranteesEnding(project, fork.then)) return `${common.name ?? common.id}`;
  }
  return undefined;
}

/** 바닥 칸이 물인가. 칸 설명(tileMeta)이 있는 타일셋은 그 role·태그를, 없으면 내장 물 칸 번호를 믿는다. */
function isWaterTile(tileset: TilesetDef | undefined, tile: number | undefined): boolean {
  if (typeof tile !== "number" || tile < 0) return false;
  const meta = tileset?.tileMeta?.[tile];
  if (meta && (meta.role !== undefined || (meta.tags?.length ?? 0) > 0)) return meta.role === "water" || meta.tags?.some((tag) => tag === "water" || tag === "물") === true;
  return tile === TILE.WATER || isWaterChipsetTile(tile) || isLakeAutotileTile(tile, tileset);
}

/**
 * 물가 이름(강변·강가·호숫가·수변·해변)인데 물이 맵의 10% 미만이거나 한 줄(예: 맨 윗줄 y=0)에만 깔린 바깥 맵.
 * 2026-10-17 「퇴근길 강변 야경 길」 이 맨 윗줄 물 한 줄로 강을 흉내 냈는데 검사가 통과시켰다.
 */
function waterfrontMapsWithoutWater(project: Project): string[] {
  const found: string[] = [];
  for (const map of Object.values(project.maps)) {
    const name = (map.name ?? "").trim();
    if (!WATERFRONT_MAP_NAME.test(name) || INDOOR_MAP_NAME.test(name)) continue;
    const cells = map.width * map.height;
    if (cells <= 0) continue;
    const tileset = project.tilesets[map.tilesetId];
    const rows = new Set<number>();
    let water = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!isWaterTile(tileset, map.lowerTiles[y * map.width + x])) continue;
        water += 1;
        rows.add(y);
      }
    }
    const coverage = water / cells;
    if (coverage >= WATERFRONT_MIN_COVERAGE && rows.size > 1) continue;
    const row = rows.size === 1 ? ` · y=${[...rows][0]} 한 줄에만` : "";
    found.push(`${name}(물 ${Math.round(coverage * 100)}%${row})`);
  }
  return found;
}

export function checkRomance(project: Project, briefText = briefTextOf(project)): Finding[] {
  if (!isRomanceCheckTarget(project, briefText)) return [];
  const findings: Finding[] = [];
  const maps = Object.values(project.maps);

  // 1) 뼈대 자리표시가 그대로 남았나.
  const leftovers: string[] = [];
  const routeMap = project.maps[SEGMENT_ROUTE_MAP_ID];
  if (routeMap && PLACEHOLDER_NAMES.has(routeMap.name)) leftovers.push(`맵 「${routeMap.name}」(${SEGMENT_ROUTE_MAP_ID})`);
  for (const map of maps) for (const event of map.events) {
    const placeholderEvent = event.id === SEGMENT_STARTER_EVENT_ID || event.id === SEGMENT_END_EVENT_ID;
    if (placeholderEvent && event.name && PLACEHOLDER_NAMES.has(event.name)) leftovers.push(`이벤트 「${event.name}」(${map.name})`);
  }
  const skeletonEnding = (project.endings ?? []).find((ending) => ending.id === SEGMENT_END_ENDING_ID);
  if (skeletonEnding && PLACEHOLDER_NAMES.has(skeletonEnding.name)) leftovers.push(`엔딩 「${skeletonEnding.name}」`);
  if (leftovers.length > 0) {
    findings.push({
      severity: "warning", code: "romance-skeleton-leftover",
      message: `연애 게임인데 첫 구간 뼈대의 자리표시가 그대로 남았습니다: ${leftovers.join(" · ")} — 이름·대사를 이 게임에 맞게 바꾸거나 쓰지 않을 거면 지우세요(뼈대 이벤트 id·연결은 유지).`,
    });
  }

  if (PLACEHOLDER_TITLES.has((project.meta?.title ?? "").trim()) || PLACEHOLDER_TITLES.has((project.system?.titleScreen?.title ?? "").trim())) {
    findings.push({
      severity: "warning", code: "romance-default-title",
      message: `게임 제목이 기본값 「${(project.system?.titleScreen?.title || project.meta?.title || "").trim() || "(비어 있음)"}」 그대로입니다 — set_title_screen {title} 로 이 게임의 이름을 정하세요(타이틀 화면에 그대로 나옵니다).`,
    });
  }

  // 코드가 깔아 둔 연애 기본 부제는 제목이 아니라 「이 게임에 맞게 정해야 할 자리」다 — 게임 내용과 무관한 문구가 그대로 남으면 타이틀이 템플릿처럼 보인다.
  if ((project.system?.titleScreen?.logoSubtitle ?? "").trim() === ROMANCE_TITLE_SUBTITLE) {
    findings.push({
      severity: "warning", code: "romance-default-subtitle",
      message: `타이틀 부제가 코드 기본값 「${ROMANCE_TITLE_SUBTITLE}」 그대로입니다 — set_title_screen {logoSubtitle} 로 이 게임 내용에 맞는 한 줄(예: 배경 장소·계절·관계의 분위기)로 바꾸세요.`,
    });
  }

  const titleArtMismatch = romanceTitleMismatch(project.system?.titleScreen?.backgroundResourceId);
  if (titleArtMismatch) findings.push({ severity: "warning", code: "romance-title-art-mismatch", message: romanceTitleMismatchMessage(titleArtMismatch) });
  // 타이틀이 소재와 다른 그림(벚꽃 캠퍼스 기본이거나 엉뚱한 소재)인데 기획은 카페·학원·회사·마을이면 소재에 맞는 키아트로 바꾸게 한다(romance-loop-1 R1-06).
  // 기획서(gameDesignBrief)가 없는 판(--text 생성·직접 시작)은 제목·부제·맵 이름에서 소재를 읽는다(romance-loop-3: 「봄빛 고등학교의 고백」이 벚꽃 캠퍼스 그림을 그대로 썼다).
  const settingText = briefText.trim() ? briefText
    : [project.meta?.title, project.system?.titleScreen?.title, project.system?.titleScreen?.logoSubtitle, ...Object.values(project.maps).map((map) => map.name)].filter((part): part is string => typeof part === "string").join("\n");
  const settingArt = romanceTitleArtSettingGap(project.system?.titleScreen?.backgroundResourceId, settingText);
  if (settingArt) {
    findings.push({
      severity: "warning", code: "romance-title-art-setting",
      message: `타이틀 배경이 이 게임 소재와 다른 그림인데 기획은 ${settingArt.label} 쪽입니다 — set_title_screen {backgroundResourceId:"${settingArt.id}"} 로 소재에 맞는 그림으로 바꾸세요(전용 그림을 만들었으면 generate_title_art).`,
    });
  }

  // 1c) 오프닝 — 비었거나 제목 카드(「— 새 게임 —」 씨앗·제목만 적은 글)뿐이면 새 게임을 눌러도 검은 화면에 글자만 뜬다. 사용자가 끈 오프닝(enabled:false)은 짚지 않는다.
  const opening = project.system?.opening;
  const openingEmpty = opening?.enabled !== false && (opening?.scenes ?? []).length === 0;
  // 어느 장면이 걸렸는지 — 글·그림 장면을 쓴 모델이 무엇을 바꿔야 하는지 알게(2026-10-29 standin romance: 글 둘·그림 하나).
  const stillSlides = (opening?.scenes ?? []).filter((scene) => scene.kind === "image").map((scene) => String(scene.id));
  if (openingEmpty || openingIsOnlyTitleCard(opening, project.system?.titleScreen?.title ?? project.meta?.title)) {
    findings.push({
      severity: "warning", code: "romance-opening-title-card",
      message: `오프닝이 ${openingEmpty ? "비어 있습니다" : stillSlides.length ? `정지 그림 슬라이드(${stillSlides.join("·")})와 글 카드뿐입니다 — 도트 애니메틱 장면이 하나도 없습니다` : "제목 카드·단문 카드 한 장뿐입니다"} — 새 게임을 누르면 바로 걷거나 검은 화면에 제목만 뜹니다. plan_opening/set_opening 및 #2852 도트 애니메틱 도구(create_opening_animatic_shot 384×216 → set_opening_pixel_grid 384×216 → place_opening_background → place_opening_charset_actor 번들 24×32 캐릭터 칩 → set_opening_caption → set_opening → preview_opening_animatic → review_opening)로 이 게임의 도입을 여러 장면(무대·주인공·첫 만남의 계기)으로 써 넣으세요.`,
    });
  }

  // 1d) 물가 이름의 맵에 물이 보이나 — 한 줄짜리 물띠는 강·호수가 아니다.
  const dryWaterfronts = waterfrontMapsWithoutWater(project);
  if (dryWaterfronts.length > 0) {
    findings.push({
      severity: "warning", code: "romance-waterfront-no-water",
      message: `물가 이름의 맵 ${dryWaterfronts.slice(0, 4).join(", ")}에 물이 거의 없거나 한 줄 띠뿐입니다 — 강·호수·바다가 화면에 보이도록 맵의 1/10 이상, 두 줄 이상 폭으로 물을 칠하거나(fill_region·물 오토타일) 맵 이름을 실제 모습에 맞게 바꾸세요.`,
    });
  }

  // 2) 호감이 쌓이는 인물 · 인물 엔딩.
  const people: { readonly map: GameMap; readonly event: GameEvent }[] = [];
  for (const map of maps) for (const event of map.events) if (isPersonEvent(event)) people.push({ map, event });
  const friendly = people.filter(({ event }) => isTalkFriendshipEnabled(event));
  const hasAffectionVariable = (project.variables ?? []).some((variable) => AFFECTION_VARIABLE.test(variable.name ?? ""));
  const touchesRelationship = allPages(project).some((page) => {
    let hit = false;
    visitPageCommands(page, (visit) => { if (visit.command.kind === "changeFriendship" || visit.command.kind === "talkFriendship") hit = true; });
    return hit;
  });
  findings.push(...checkPerHeroineEndings(project, [...new Set(friendly.map(({ event }) => personKey(event)))]));
  if (friendly.length === 0 && !hasAffectionVariable && !touchesRelationship) {
    findings.push({
      severity: "warning", code: "romance-no-relationship",
      message: "연애 게임인데 호감이 쌓이는 인물(talkFriendship)도 호감 변수·호감 변경 명령도 없습니다 — 관계가 어떻게 변하는지 플레이어가 느낄 수 없습니다.",
    });
  }
  // 호감을 「호감 변수」 로 올리는 저작: 이름이 「인물 호감」 모양이면 런타임이 같은 인물 friendship 에 변화량을 더해 ESC·HUD·엔딩에 보인다.
  // 인물을 못 정한 호감 변수는 ESC·HUD 에 안 나오니 완료 조건이다(romance-real-2 R02).
  const usedVariables = new Set<string>();
  for (const page of allPages(project)) visitPageCommands(page, (visit) => { if (visit.command.kind === "setVariable" && typeof visit.command.variableId === "string") usedVariables.add(visit.command.variableId); });
  const unmapped = unmappedAffectionVariables(project).filter((variable) => usedVariables.has(variable.id));
  if (unmapped.length > 0) {
    findings.push({
      severity: "warning", code: "romance-affection-variable-unmapped",
      message: `호감 변수 ${unmapped.slice(0, 4).map((variable) => `「${variable.name}」(${variable.id})`).join(", ")} 이(가) 어느 인물의 호감인지 알 수 없어 ESC 관계 화면·호감 HUD·호감 엔딩에 나오지 않습니다 — changeFriendship(npcKey=인물 characterId, delta) 로 바꾸거나 변수 이름을 「인물 이름 호감도」 로 정하세요.`,
    });
  } else if (usedVariables.size > 0 && affectionVariableOwners(project).size > 0 && ![...affectionVariableOwners(project).keys()].every((id) => !usedVariables.has(id))) {
    findings.push({
      severity: "info", code: "romance-affection-variable-compat",
      message: "호감을 변수(setVariable)로 올리는 곳이 있습니다 — 읽기 호환으로 ESC·HUD·엔딩에는 반영되지만, 새 저작은 changeFriendship 을 쓰세요.",
    });
  }
  const endings = project.endings ?? [];
  findings.push(...checkRomanceEndings(project));
  findings.push(...checkEndingNpcReachable(project));
  findings.push(...checkHeroineEndingsCalled(project));
  findings.push(...checkSplitHeroineIds(project));
  if (endings.length > 0 && endings.every((ending) => ending.id === SEGMENT_END_ENDING_ID)) {
    findings.push({
      severity: "warning", code: "romance-only-skeleton-ending",
      message: "엔딩이 뼈대의 자리표시 엔딩(ending_first_segment) 하나뿐입니다 — 연애 게임인데 관계에 따른 엔딩(고백 성공·실패·혼자)이 없습니다.",
    });
  }

  // 3) 인물이 화면에 보이나 · 서로 다른 인물이 같은 칩인가.
  const invisible = people.filter(({ event }) => !(event.pages ?? []).some((page) => page.graphic?.transparent !== true && chipOf(page) !== undefined));
  if (invisible.length > 0) {
    const names = invisible.slice(0, 6).map(({ event }) => event.name ?? event.id).join(", ");
    findings.push({
      severity: "warning", code: "romance-npc-invisible",
      message: `인물 ${invisible.length}/${people.length}명이 그림 없는 투명 이벤트입니다(${names}${invisible.length > 6 ? " …" : ""}) — 화면에는 아무도 보이지 않습니다.`,
    });
  }
  // 같은 인물이 맵마다 같은 모습으로 서는 것은 일관성이다(characterId 가 맵마다 달라도 같은 이름이면 한 사람) — 서로 다른 사람이 한 칩일 때만 중복이다.
  // 같은 characterId 를 쓰는 이벤트도 한 사람이다(맵마다 「산책로의 한서윤」 처럼 이름 머리말이 달라도).
  const byChip = new Map<string, { name: string; cid: string }[]>();
  for (const { event } of people) {
    const chip = (event.pages ?? []).map(chipOf).find((c): c is string => c !== undefined);
    if (!chip) continue;
    byChip.set(chip, [...(byChip.get(chip) ?? []), { name: personKey(event), cid: event.characterId?.trim() ?? "" }]);
  }
  for (const [chip, entries] of byChip) {
    const clusters: { names: Set<string>; cids: Set<string> }[] = [];
    for (const entry of entries) {
      const hit = clusters.filter((cluster) => cluster.names.has(entry.name) || (entry.cid && cluster.cids.has(entry.cid)));
      const merged = hit[0] ?? { names: new Set<string>(), cids: new Set<string>() };
      for (const other of hit.slice(1)) { other.names.forEach((n) => merged.names.add(n)); other.cids.forEach((c) => merged.cids.add(c)); clusters.splice(clusters.indexOf(other), 1); }
      if (!hit[0]) clusters.push(merged);
      merged.names.add(entry.name);
      if (entry.cid) merged.cids.add(entry.cid);
    }
    if (clusters.length < 2) continue;
    const who = clusters.map((cluster) => [...cluster.names][0]!);
    findings.push({
      severity: "warning", code: "romance-npc-duplicate-chip",
      message: `서로 다른 인물 ${who.length}명(${who.slice(0, 5).join(", ")})이 같은 캐릭터 칩(${chip})입니다 — 화면에서 구분되지 않습니다. list_npc_graphics 에서 인물마다 다른 칩을 고르세요.`,
    });
  }
  // people(isPersonEvent)는 #2894 부터 사물 이름 이벤트를 빼므로, 그 목록을 거르면 이 검사가 영영 비었다 — 인물 표지(characterId·npc_ id)만 보고 직접 모은다.
  const npcLike: { readonly map: GameMap; readonly event: GameEvent }[] = [];
  for (const map of maps) for (const event of map.events) if (event.characterId?.trim() || /^(ev_)?npc[_-]/u.test(event.id)) npcLike.push({ map, event });
  const objectBustNpcs = npcLike.filter(({ event }) => {
    if (event.id === SEGMENT_STARTER_EVENT_ID || event.id === SEGMENT_END_EVENT_ID) return false;
    const name = (event.name ?? "").trim();
    if (!OBJECT_NPC_NAME.test(name) || PERSON_ROLE_NAME.test(name)) return false;
    const hasChip = (event.pages ?? []).some((page) => page.graphic?.transparent !== true && chipOf(page) !== undefined);
    const hasFace = (event.pages ?? []).some((page, pageIndex) => {
      let hit = false;
      visitPageCommands({ page, pageIndex, conditions: page.conditions ?? [], commands: commandList(page.commands) }, (v) => { if (v.command.kind === "changeFace") hit = true; });
      return hit;
    });
    return hasChip && hasFace;
  });
  if (objectBustNpcs.length > 0) {
    const where = objectBustNpcs.map(({ map, event }) => `${(event.name ?? event.id).trim()}(${map.name})`).join(", ");
    findings.push({
      severity: "warning", code: "romance-object-npc-bust",
      message: `사물 이름인 NPC ${objectBustNpcs.length}개(${where})가 사람 캐릭터 칩·흉상(changeFace)을 달고 있습니다 — 사물은 NPC 가 아니라 place_props/오브젝트 이벤트로 놓으세요(이벤트는 graphic:{transparent:true}·injectFace:false).`,
    });
  }

  // 3b) 선택지가 달린 조사 이벤트가 눈에 안 보이는 칸에 서 있나(romance-real-2 R14: 「설레는 약속 게시판」이 그림 없는 투명 이벤트 + 빈 바닥).
  //     호감을 올리는 선택의 입구인데 플레이어가 무엇을 조사할지 알 수 없다. 인물(그림 칩 검사는 위 romance-npc-invisible)은 제외.
  const hiddenChoice: string[] = [];
  for (const ref of allPages(project)) {
    const { map, event, page } = ref;
    if (!map || !event || !page || ref.pageIndex !== 0 || isPersonEvent(event) || page.trigger?.kind !== "action") continue;
    let hasChoices = false;
    visitPageCommands(ref, (visit) => { if (visit.command.kind === "choices") hasChoices = true; });
    if (!hasChoices) continue;
    const g = page.graphic as { transparent?: boolean; sprite?: unknown; appearanceId?: string; characterResourceId?: string } | undefined;
    const drawn = g !== undefined && g.transparent !== true && (g.sprite !== undefined || g.appearanceId !== undefined || g.characterResourceId !== undefined);
    const onObjectTile = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
      const nx = event.x + dx!;
      const ny = event.y + dy!;
      return nx >= 0 && nx < map.width && ny >= 0 && ny < map.height && (map.upperTiles[ny * map.width + nx] ?? -1) > 0;
    });
    if (!drawn && !onObjectTile) hiddenChoice.push(`${event.name ?? event.id}(${map.name})`);
  }
  if (hiddenChoice.length > 0) {
    findings.push({
      severity: "warning", code: "romance-choice-event-invisible",
      message: `선택지가 달린 조사 이벤트 ${hiddenChoice.length}개가 그림 없는 투명 이벤트이고 물건 타일도 없는 빈 바닥입니다(${hiddenChoice.slice(0, 4).join(", ")}${hiddenChoice.length > 4 ? " …" : ""}) — 플레이어는 무엇을 조사할지 볼 수 없습니다. place_props/set_build_spec 으로 게시판·편지·책상 같은 그림을 입히세요.`,
    });
  }

  // 4) 대사 본문 앞에 화자 표기가 또 붙은 줄(「[이름]」 이중 표기·바깥 따옴표) · 본문에 타일 좌표가 그대로 박힌 줄.
  let doubled = 0;
  let example = "";
  let coordLines = 0;
  let coordExample = "";
  for (const page of allPages(project)) visitPageCommands(page, (visit) => {
    const command = visit.command;
    if (command.kind !== "text" || typeof command.body !== "string") return;
    // 「[이름]」 줄 머리표, 또는 speaker 칸과 같은 이름이 「이름:」 로 본문 앞에 또 붙은 줄(romance-real-2 R07: `한지훈: "반가워!"`).
    const echoed = stripSpeakerEcho(command.body, typeof command.speaker === "string" ? command.speaker : undefined) !== command.body;
    if (echoed || /^\s*["“]?\s*\[[^\]\n]{1,20}\]\s*\n/u.test(command.body)) { doubled += 1; if (!example) example = command.body.slice(0, 30).replace(/\n/gu, "↵"); }
    // 2026-10-17: 「(40,13) 쪽 벤치에서 기다릴게」 처럼 조수가 저작 좌표를 대사에 옮겨 적었다 — 플레이어는 좌표를 볼 수 없다.
    if (RAW_TILE_COORDS.test(command.body)) { coordLines += 1; if (!coordExample) coordExample = command.body.slice(0, 40).replace(/\n/gu, "↵"); }
  });
  if (doubled > 0) {
    findings.push({
      severity: "warning", code: "romance-speaker-in-body",
      message: `대사 ${doubled}줄의 본문이 「[이름]」·「이름:」 으로 시작합니다(예: ${example}) — 화자는 speaker 칸에 있으니 본문에서 빼세요. 재생 화면은 이름표와 같은 이름의 머리표를 걷어 주지만 저작 데이터는 깨끗해야 합니다.`,
    });
  }
  if (coordLines > 0) {
    findings.push({
      severity: "warning", code: "romance-dialogue-raw-coords",
      message: `대사 ${coordLines}줄에 타일 좌표 (x,y) 가 그대로 들어 있습니다(예: ${coordExample}) — 플레이어에게 좌표는 뜻이 없습니다. 「분수대 옆 벤치」「도서관 2층 창가」처럼 장소를 자연스러운 말로 바꾸세요.`,
    });
  }
  const noFallback = deadlineWithoutFallback(project);
  if (noFallback) {
    findings.push({
      severity: "warning", code: "romance-deadline-no-fallback",
      message: `기한 엔딩 「${noFallback}」 은 호감이 낮으면(아무도 안 만나면) 어떤 엔딩도 부르지 않습니다 — 기한이 와도 게임이 끝나지 않습니다. 마지막 기본 결말은 conditions 가 없는 엔딩이어야 합니다(define_ending 으로 conditions [] 로 다시 정의하거나 조건 없는 「혼자 보낸 학기」 같은 엔딩을 set_deadline_ending 마지막 tiers 에).`,
    });
  }
  return findings;
}

/** 「끝낸 것으로 칠 수 없는」 연애 게임의 빈칸 — 팀의 finish·조수 완료 검사가 이것을 막는다(scripts/lib/piTeamRuntime.ts · piAgentRuntime.ts). 경고 코드 중 이 목록만 완료 조건이다. */
const COMPLETION_CODES = new Set(["romance-skeleton-leftover", "romance-only-skeleton-ending", "romance-default-title", "romance-default-subtitle", "romance-title-art-mismatch", "romance-endings-unbranched", "romance-ending-shadowed", "romance-affection-variable-unmapped", "romance-endings-not-per-heroine", "romance-deadline-no-fallback", "romance-title-art-setting", "romance-ending-npc-unreachable", "romance-heroine-endings-uncalled", "romance-heroine-id-split", "romance-object-npc-bust", "romance-opening-title-card", "romance-dialogue-raw-coords", "romance-waterfront-no-water"]);
/** 엔딩 분기를 요구하지 않는 코드 — 한 장면 하네스(첫 만남 한 장면)는 엔딩이 하나다. */
const ENDING_CODES = new Set(["romance-only-skeleton-ending", "romance-endings-unbranched", "romance-ending-shadowed", "romance-endings-not-per-heroine", "romance-ending-npc-unreachable", "romance-heroine-endings-uncalled", "romance-heroine-id-split"]);
const SINGLE_SCENE_ENDING_ID = "ending_romance_first_meeting";

/** 사용자 요청 문장이 「연애 게임 만들기」인가 — 인터뷰 기획서가 없는 채팅 한 줄 경로도 같은 완료 검사를 받게 한다(romance-real-2 R03: 이 경로는 게이트가 안 걸렸다). */
export function isRomanceGameRequest(text: string | undefined | null): boolean {
  if (typeof text !== "string") return false;
  // 장르 프리셋 지시문에 실린 제작 매뉴얼은 사용자 요청이 아니다(openingProduction.withoutAuthoringPresetManual 과 같은 처리).
  text = text.replace(/AUTHORING_PRESET_BEGIN [\s\S]*?AUTHORING_PRESET_END[^\n]*/gu, "");
  if (!/연애|로맨스|미연시|romance|dating|소개팅|썸\s?타/iu.test(text) || !/게임|시뮬|연애물|로맨스물|미연시|학원물|캠퍼스물|game|sim/iu.test(text)) return false;
  if (/만들|제작|짜 ?줘|구현/u.test(text)) return true;
  // 동사 없이 소재만 적은 한 줄(「고등학교 학원물 연애 게임, 여러 명 중 한 명과 이어지는 엔딩」)도 제작 요청이다 — romance-loop-1 R1 에서 이 문장은 완료 검사가
  // 통째로 꺼져 기본 제목 「새 게임」·기본 부제·뼈대 자리표시·인물별 엔딩 없음이 그대로 통과했다. 고치기·질문·설명 요청만 뺀다.
  return !/고쳐|고치|수정|바꿔|바꾸|버그|왜\s|어떻게|뭐야|설명|알려|넓혀|지워|삭제|확인해|점검/u.test(text);
}

export function romanceCompletionGaps(project: Project, options: { readonly task?: string } = {}): string[] {
  const interview = project.gameDesignBrief?.interview?.genre === "romance";
  if (!interview && !isRomanceGameRequest(options.task)) return [];
  const singleScene = (project.endings ?? []).some((ending) => ending.id === SINGLE_SCENE_ENDING_ID);
  return checkRomance(project, options.task ?? briefTextOf(project))
    .filter((finding) => COMPLETION_CODES.has(finding.code) && !(singleScene && ENDING_CODES.has(finding.code)))
    .map((finding) => finding.message);
}
