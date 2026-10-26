// 턴제 JRPG 첫 생성 「끝내도 되나」 — finish 가 뼈대 엔딩 도달만으로 합격시키지 못하게 막는 완료 가드.
//
// 2026-10-16 실제 Argon(8318) JRPG 시험(jrpg-real-1)에서 qa:game 과 첫 구간 자동 플레이가 통과시킨 것들:
//  - J05 타이틀이 기본값 「새 게임」 그대로 끝났다(연애는 romance-default-title 로 막았지만 JRPG 는 없었다).
//  - J04 시작 마을에 대사하는 인물이 하나도 없었다. 시간 이야기를 요청했는데 정의해 둔 시간 엔딩은 어디서도 부르지 않았고,
//    플레이는 뼈대 엔딩(첫 구간 끝)으로 끝났다 — 「엔딩 도달」 만 보는 자동 플레이로는 못 잡는다.
// 연애의 romanceCompletionGaps 와 같은 방식이다: 메시지 배열을 돌려주고, 팀 finish 가 두 번 거절한 뒤에는 보고에 남기고 받는다.

import { SEGMENT_END_ENDING_ID, SEGMENT_ROUTE_MAP_ID } from "@/project/playableSegmentContract";
import { isTitleCardNarration } from "@/project/defaults/defaultOpeningSequence";
import type { CinematicSequence, Project } from "@/project/types";
import { briefTextOf } from "./brief";
import { visitAllCommands } from "./walk";
import { checkJrpg } from "./jrpg";

const PLACEHOLDER_TITLES = new Set(["", "새 게임", "새 프로젝트", "New Game", "New Project"]);
/** 채팅 한 줄(「크로노 트리거 같은 시간여행 JRPG 만들어 줘」)로 온 JRPG 요청인가. 기획서 프롬프트가 아니어도 같은 완료 가드를 받게 한다. */
const JRPG_TASK = /jrpg|제이\s*알\s*피\s*지|알피지|\brpg\b|크로노\s*트리거|파이널\s*판타지|\bff\s?(?:[0-9]{1,2}|[ivx]{1,4})\b|드래곤\s*퀘스트/iu;
/** 이미 JRPG 인 프로젝트에서 게임 전체를 지으라는 요청인가(작은 수정 요청에는 가드를 걸지 않는다). */
const WHOLE_GAME_TASK = /게임을?\s*(?:만들|제작|완성|지어|짜)|처음부터|전체를?\s*(?:만들|제작|완성)/u;
/** 동료·파티원을 만난다는 요청 낱말 — 합류 이벤트가 둘 이상 있어야 한다(jrpg-loop-2 ct2: 「동료도 시대마다 만나고요」에 합류 0건). */
const COMPANION_WORDS = /동료|파티원|파티\s*멤버|일행|동행|companion|party\s*member/iu;
const COMPANION_MIN_JOINS = 2;
const TIME_BRIEF = /시간|시대|과거|미래|타임|평행|크로노|time|chrono|era\b/iu;
/** 탈것(비공정·비행선) 요청 낱말. */
const AIRSHIP_WORDS = /비공정|비행선|비행\s*정|에어\s*쉽|airship|탈것/iu;
/** 세계가 무너진다·폐허가 된다는 요청 낱말 — 붕괴 전/후 맵 구조가 있어야 한다. */
const COLLAPSE_WORDS = /붕괴|무너(?:져|지|진|뜨|졌)|폐허|멸망|몰락|world\s*collapse|apocalyp/iu;
const RUIN_MAP_NAME = /붕괴|폐허|잔해|황폐|멸망|몰락|무너|ruin|collaps|wreck|devast/iu;
/** 씨앗 시작 맵(버들항 어촌)의 지울 수 없는 표지 — 등대 건물. 이 맵이 어촌이라고 부르지 않는 이름으로 남아 있으면 다시 짓지 않은 것이다. */
const SCAFFOLD_LANDMARK_KIT = "bd-pick-fishing-port-lighthouse";
// 「항」은 낱말 끝(버들항·북항)이나 항구·항만일 때만 항구로 본다 — 맨 「항」은 「저항군」「항상」까지 면제해 씨앗 어촌을 놓쳤다.
const HARBOR_MAP_NAME = /항구|항만|항(?=$|[\s·,.)\]」』-])|어촌|포구|해안|바닷|해변|등대|부두|선착|port|harbor|harbour|coast|fishing|seaside|beach|lighthouse/iu;
/** 시작 마을에서 말을 거는 인물의 최소 수 — 촌장 하나로는 마을이 아니다. */
export const START_TOWN_MIN_TALKERS = 2;
/** checkJrpg 경고 중 «끝내도 되나» 를 막는 전투 균형 코드. */
const BALANCE_CODES = new Set(["jrpg-party-identical-stats", "jrpg-party-flat-roles", "jrpg-boss-not-threatening", "jrpg-boss-unwinnable", "jrpg-encounters-harmless", "jrpg-encounters-wipe-party"]);

function isJrpg(project: Project): boolean {
  return project.system?.genre === "adventure-jrpg" || project.gameDesignBrief?.presetId === "adventure-jrpg";
}

/** 시스템이 덧붙인 `[의도 메모 — 아래는 사용자 글이 아니라 시스템 지침]` 뒤는 사용자 요청이 아니다(jrpg-loop-4 ff1·ff2:
 * 지침 안의 「항구·포구·어촌」·「시대·평행세계」 낱말이 briefText 에 섞여 씨앗 어촌 면제·시간 엔딩 오탐을 냈다). */
export function stripSystemIntentNote(task = ""): string {
  const index = task.indexOf("[의도 메모");
  return (index >= 0 ? task.slice(0, index) : task).trim();
}

export function jrpgCompletionGateApplies(project: Project, task = ""): boolean {
  const userTask = stripSystemIntentNote(task);
  if (JRPG_TASK.test(userTask)) return true;
  return isJrpg(project) && WHOLE_GAME_TASK.test(userTask);
}

/**
 * 오프닝이 제목 카드뿐인가 — 도입을 쓰지 않은 채 끝낸 것이다. 카드는 「— 제목 —」 모양(제목과 달라도·씨앗의 「— 새 게임 —」 포함),
 * 기본 제목 「새 게임」 글, 또는 게임 제목만 적은 글이다. 사용자가 끈 오프닝(enabled:false)·빈 오프닝은 아니다(빈 것은 부르는 쪽이 따로 본다).
 */
export function openingIsOnlyTitleCard(opening: CinematicSequence | undefined, title?: string): boolean {
  if (!opening || opening.enabled === false) return false;
  const scenes = opening.scenes ?? [];
  if (scenes.length === 0) return false;
  if (scenes.length === 1 && scenes[0]?.kind === "text") return true;
  if (scenes.some((scene) => scene.kind === "image") && !scenes.some((scene) => scene.kind === "animatic" && Boolean(scene.composition?.pixelGrid))) return true;
  return scenes.every((scene) => scene.kind === "text" && typeof scene.narration === "string" && isTitleCardNarration(scene.narration, title));
}

/** 시작 맵에서 transfer 명령을 따라 닿는 맵 id 들(시작 맵 포함). */
function reachableMapIds(project: Project): Set<string> {
  const edges = new Map<string, Set<string>>();
  visitAllCommands(project, (visit) => {
    const from = visit.where.mapId;
    const to = visit.command.kind === "transfer" && typeof visit.command.mapId === "string" ? visit.command.mapId : undefined;
    if (!from || !to) return;
    const bucket = edges.get(from) ?? new Set<string>();
    bucket.add(to);
    edges.set(from, bucket);
  });
  const seen = new Set<string>();
  const queue = [project.startMapId];
  while (queue.length) {
    const id = queue.pop();
    if (!id || seen.has(id) || !project.maps[id]) continue;
    seen.add(id);
    for (const next of edges.get(id) ?? []) queue.push(next);
  }
  return seen;
}

export function jrpgCompletionGaps(project: Project, briefText = briefTextOf(project), options: { readonly task?: string } = {}): string[] {
  const userTask = stripSystemIntentNote(options.task);
  if (!isJrpg(project) && !JRPG_TASK.test(userTask)) return [];
  const gaps: string[] = [];
  if (userTask) briefText = `${briefText} ${userTask}`;
  // 1) 기본 제목.
  const title = (project.system?.titleScreen?.title ?? "").trim();
  const metaTitle = (project.meta?.title ?? "").trim();
  if (PLACEHOLDER_TITLES.has(title) || PLACEHOLDER_TITLES.has(metaTitle)) {
    gaps.push(`게임 제목이 기본값 「${title || metaTitle || "(비어 있음)"}」 그대로입니다 — configure_title_screen {title} 로 이 게임의 이름을 짓고, 기본 부제(「A NEW ADVENTURE」)를 쓰지 않을 거면 logoStyle 을 정하세요.`);
  }

  // 1b) 오프닝 — 비어 있거나 제목/단문 카드 한 장, 또는 정지 그림 슬라이드뿐이거나 #2852 도트 격자 애니메틱 6샷이 아니면 미완이다.
  const opening = project.system?.opening;
  const openingEmpty = Boolean(userTask) && opening?.enabled !== false && (opening?.scenes ?? []).length === 0;
  const animaticShots = (opening?.scenes ?? []).filter((scene): scene is Extract<typeof scene, { kind: "animatic" }> => scene.kind === "animatic" && Boolean(scene.composition?.pixelGrid));
  if (openingEmpty || openingIsOnlyTitleCard(opening, project.system?.titleScreen?.title ?? project.meta?.title)) {
    gaps.push("오프닝이 제목 카드(「— …  —」) 한 장뿐이거나 정지 슬라이드뿐입니다 — 새 게임을 누르면 검은 화면에 글자만 뜨거나 정지 그림만 넘어갑니다. plan_opening/set_opening 및 #2852 도트 애니메틱 도구(create_opening_animatic_shot 384×216 → set_opening_pixel_grid 384×216 → place_opening_background(list_opening_media 의 oprn-still-* 배경, generate_opening_image 호출 금지) → place_opening_charset_actor(oprn-charset-heroes1 + toX 걷기) → upsert_opening_light_fx + animate_opening_camera → set_opening_caption → set_opening 6샷 연결 → review_opening)로 이 게임의 도입을 **6샷(shot_1..shot_6)** 도트 애니메틱으로 만들어 넣으세요.");
  } else if (Boolean(userTask) && opening && opening.enabled !== false) {
    const missingBg = animaticShots.filter((s) => !s.composition.layers.some((l) => l.kind === "image" && l.role === "background")).map((s) => s.id);
    const missingActor = animaticShots.filter((s) => !s.composition.layers.some((l) => l.kind === "image" && l.role === "actor")).map((s) => s.id);
    const missingCaption = animaticShots.filter((s) => !s.composition.layers.some((l) => l.kind === "caption")).map((s) => s.id);
    if (animaticShots.length < 6 || missingBg.length > 0 || missingCaption.length > 0 || missingActor.length > 2) {
      gaps.push(`오프닝 #2852 도트 격자 애니메틱(384×216)이 ${animaticShots.length}샷입니다(6샷 필수${missingBg.length ? `, 배경 누락: ${missingBg.join(",")}` : ""}${missingActor.length > 2 ? `, 배우 누락: ${missingActor.join(",")}` : ""}${missingCaption.length ? `, 자막 누락: ${missingCaption.join(",")}` : ""}) — generate_opening_image 호출 없이 list_opening_media 의 한 장면 번들 배경(oprn-still-kingdom-day, oprn-still-dark-citadel, oprn-still-snow-village, oprn-still-desert-ruin, oprn-still-farm-golden, oprn-still-forest-path, oprn-pack-still-sky-01, oprn-pack-still-sky-03 등 — 분할 화면·UI 참고 스틸 oprn-still-hero-dawn 등은 거절됨)으로 6샷(shot_1..shot_6, 각 384×216·durationMs:6500) 모두 place_opening_background + place_opening_charset_actor(oprn-charset-heroes1 + toX 걷기) + upsert_opening_light_fx + animate_opening_camera + set_opening_caption(#fff0dc)을 채우고 set_opening 으로 6샷을 저장하세요.`);
    }
  }

  // 2) 시작 마을 인물 — 말을 거는 이벤트(text/say 명령이 있는 이벤트)가 시작 맵과, 문 하나로 닿는 마을(길 맵 제외)을 합쳐 최소 몇 명 있어야 한다.
  //    뼈대의 시작 맵은 「촌장 한 명 + 문」 이라 마을 본체가 옆 맵에 있는 게 정상이다(jrpg-real-1 c: 본체 마을에 상점·치유사·동료).
  const startMap = project.maps[project.startMapId];
  if (startMap) {
    const townIds = new Set<string>([startMap.id]);
    visitAllCommands(project, (visit) => {
      const from = visit.where.mapId;
      const to = visit.command.kind === "transfer" && typeof visit.command.mapId === "string" ? visit.command.mapId : undefined;
      if (from && to && from === startMap.id && to !== SEGMENT_ROUTE_MAP_ID && project.maps[to]) townIds.add(to);
      if (from && to && to === startMap.id && from !== SEGMENT_ROUTE_MAP_ID && project.maps[from]) townIds.add(from);
    });
    const talkers = new Set<string>();
    visitAllCommands(project, (visit) => {
      const mapId = visit.where.mapId;
      if (mapId && townIds.has(mapId) && visit.where.eventId && (visit.command.kind === "text" || visit.command.kind === "say")) talkers.add(`${mapId}/${visit.where.eventId}`);
    });
    if (talkers.size < START_TOWN_MIN_TALKERS) {
      gaps.push(`시작 마을 「${[...townIds].map((id) => project.maps[id]?.name ?? id).join("·")}」에서 말을 거는 인물이 ${talkers.size}명뿐입니다(최소 ${START_TOWN_MIN_TALKERS}명) — 주민·상인·치유사처럼 대사가 있는 NPC 이벤트(upsert_event + text)를 더 두세요. 마을이 비면 첫 장면이 죽습니다.`);
    }
  }

  // 3) 엔딩 — 정의만 있고 부르지 않는 엔딩, 시간 이야기인데 뼈대 엔딩으로만 끝나는 경우.
  const endings = project.endings ?? [];
  const named = new Set<string>();
  let autoSelects = false;
  visitAllCommands(project, (visit) => {
    if (visit.command.kind !== "triggerEnding") return;
    if (typeof visit.command.endingId === "string" && visit.command.endingId) named.add(visit.command.endingId);
    else autoSelects = true;
  });
  if (!autoSelects) {
    const uninvoked = endings.filter((ending) => !named.has(ending.id));
    if (uninvoked.length) gaps.push(`엔딩 ${uninvoked.map((ending) => `「${ending.name || ending.id}」`).join("·")} 은 정의만 있고 부르는 곳이 없어 볼 수 없습니다 — 마지막 사건 이벤트에 {kind:"triggerEnding", endingId} 를 연결하세요(define_ending 은 엔딩을 실행하지 않습니다).`);
  }
  if (TIME_BRIEF.test(briefText) && !endings.some((ending) => ending.id !== SEGMENT_END_ENDING_ID && (named.has(ending.id) || autoSelects))) {
    gaps.push("시간·시대 이야기를 요청했는데 호출되는 엔딩이 뼈대의 「첫 구간 끝」 뿐입니다 — 시간 이야기를 맺는 엔딩(define_ending)을 만들고 마지막 사건에서 triggerEnding 으로 부르세요.");
  }

  // 3b) 요청한 규모(jrpg-loop-1 D13) — 비공정을 말했는데 탈것이 없거나, 세계가 무너진다는 이야기인데 붕괴 후 맵이 없으면 요청의 핵심이 빠진 게임이다.
  //     ff2 는 이 둘 없이 NPC 「비공정 기관사」 한 명으로 끝났다(몬스터 캠페인 보수에 시간을 쓴 탓 — D1).
  if (AIRSHIP_WORDS.test(briefText) && !(project.system?.vehicles ?? []).some((vehicle) => vehicle.id === "airship")) {
    gaps.push("비공정(비행선)을 요청했는데 탈것이 없습니다 — place_vehicle({vehicle:\"airship\", mapId, x, y, flightView:\"mode7\"}) 로 비행선을 세우고, 탈 수 있는 월드맵·착륙 지점(걸을 수 있는 칸)을 정하세요. NPC 이름에 「비공정」을 붙이는 것으로는 부족합니다.");
  }
  if (COLLAPSE_WORDS.test(briefText)) {
    // 이름만 「폐허」인 맵은 붕괴 후가 아니다 — jrpg-loop-2 ff2: 씨앗 초록 항구에 「에덴의 폐허 거점」 이름만 붙었다. derive_map_variant(era ruin)가 남기는
    // 조명·날씨(defaultLighting / climate.weather)가 있어야 붕괴 후 모습으로 센다. 밝은 조명(ambient 0)은 derive_map_variant 가 시대 조명이
    // 새지 않게 원본에 박는 것이라 겉모습 변화가 아니다.
    const ruinMaps = Object.values(project.maps ?? {}).filter((map) => {
      const looksAltered = (map.defaultLighting?.ambient ?? 0) > 0 || Boolean(map.climate && "weather" in map.climate && map.climate.weather && map.climate.weather !== "none");
      return looksAltered && (RUIN_MAP_NAME.test(map.name ?? "") || (map.defaultLighting?.ambient ?? 0) >= 0.45);
    });
    const otherMaps = Object.values(project.maps ?? {}).length - ruinMaps.length;
    if (ruinMaps.length === 0 || otherMaps === 0) {
      gaps.push("세계가 무너진다는 이야기인데 「붕괴 전/후」 맵 구조가 없습니다 — 같은 지리의 붕괴 후 변형을 derive_map_variant({sourceMapId, variants:[{id, name:\"… (붕괴 후)\", era:\"ruin\"}]}) 로 만들고(건물 철거·안개·어둠이 자동), create_time_gate 나 이벤트 transfer 로 붕괴 순간에 이어 붙이세요.");
    }
  }

  // 3c) 동료 — 요청이 동료를 만난다고 했는데 changeParty add 로 합류시키는 인물이 거의 없으면 파티는 주인공 혼자다(ct2: 시대마다 인물은 있으나 합류 0건).
  //     r3-ff1·ct1: changeParty add 이벤트는 만들었지만 set_party 로 시작 파티에 동료까지 전부 넣어 두어 만나기 전부터 파티에 있었다.
  const joined = new Set<string>();
  visitAllCommands(project, (visit) => {
    if (visit.command.kind === "changeParty" && visit.command.action === "add" && typeof visit.command.actorId === "string") joined.add(visit.command.actorId);
  });
  const sys = project.system;
  const legacyParty = sys && "party" in sys && Array.isArray(sys.party) ? sys.party.filter((id): id is string => typeof id === "string") : [];
  const initialParty = new Set<string>([...(sys?.startActorIds ?? []), ...(project.session?.partyActorIds ?? []), ...legacyParty]);
  const newlyJoined = [...joined].filter((id) => !initialParty.has(id));
  if (COMPANION_WORDS.test(briefText) && joined.size < COMPANION_MIN_JOINS) {
    gaps.push(`동료를 만난다고 요청했는데 파티에 합류하는 인물이 ${joined.size}명뿐입니다(최소 ${COMPANION_MIN_JOINS}) — 시대·장소마다 한 명씩 upsert_actor(역할별 parameterCurves)로 만들고, NPC 이벤트의 선택지 승낙 분기에 {kind:"changeParty", action:"add", actorId} 를 넣으세요. 대사만 하는 NPC 는 동료가 아닙니다.`);
  } else if (joined.size >= COMPANION_MIN_JOINS && initialParty.size > 0 && newlyJoined.length < COMPANION_MIN_JOINS) {
    gaps.push(`changeParty add 로 합류시키는 동료(${[...joined].join(", ")})가 이미 시작 파티(system.startActorIds / system.party)에 들어 있어 만나기 전부터 파티에 있습니다(새로 합류하는 인물 ${newlyJoined.length}명, 최소 ${COMPANION_MIN_JOINS}) — set_party({scope:"start", actorIds:[주인공 id]}) 로 시작 파티에는 주인공만 두고, 동료는 만나는 이벤트의 changeParty add 로 합류시키세요.`);
  }

  // 4) 전투 균형 — 파티원이 전부 같은 몸이거나, 보스가 피해를 못 주거나 이길 수 없으면 「끝」까지 갈 수는 있어도 게임이 아니다(jrpg-real-1 J06:
  //    파티 Lv1 스탯 동일 · 보스 21~57입력에 승리). 모의전은 즉시 끝난다(3판, 고정 시드).
  // 검사기가 던지면(DB 가 덜 만들어진 프로젝트) finish 를 막지 않는다 — 균형 검사는 보너스지 필수 구조 검사가 아니다.
  let balance: ReturnType<typeof checkJrpg> = [];
  try { balance = checkJrpg(project); } catch { balance = []; }
  for (const finding of balance) {
    if (BALANCE_CODES.has(finding.code)) gaps.push(`${finding.message} — 배우 능력치는 upsert_actor 의 parameterCurves, 적 능력치는 upsert_enemy 의 stats 로 고치세요.`);
  }
  // 2c) 씨앗 어촌 그대로 — 이름은 「잿빛 설원 · 저항군 전초기지」인데 맵은 초록 항구 마을(등대)이면 첫 화면부터 세계관이 거짓이다(jrpg-loop-2 ff1).
  //    플레이어가 닿을 수 있는 맵(시작 맵에서 transfer 로 이어진 맵)만 본다 — 새 마을을 짓고 시작 맵을 옮긴 뒤 남은 옛 씨앗 맵까지 막으면 고칠 방법이 없다.
  //    jrpg-loop-3 실측(ff2·ct2): 이 맵의 집은 완성된 집 보호 영역이라 tile_erase·clear_map·paint_tiles·author_beodeul_town 이 전부
  //    「완성된 집의 보호 영역은 AI가 변경할 수 없습니다」로 거절됐고, 옛 문구의 「등대 건물을 철거」 는 AI 도구에 없는 일이었다.
  const reachable = reachableMapIds(project);
  for (const map of Object.values(project.maps)) {
    if (!reachable.has(map.id)) continue;
    if (!(map.structurePlacements ?? []).some((placement) => placement.kitId === SCAFFOLD_LANDMARK_KIT)) continue;
    const retiredSeedMap = map.id === "map_blank_start" && project.startMapId !== "map_blank_start";
    const harborExempt = !retiredSeedMap && HARBOR_MAP_NAME.test(map.name ?? "") && (map.id !== "map_blank_start" || !briefText.trim() || HARBOR_MAP_NAME.test(briefText));
    if (harborExempt) continue;
    gaps.push(
      retiredSeedMap
        ? `시작 맵을 ${project.startMapId} 로 옮겼는데 옛 씨앗 어촌 맵 「${map.name}」(${map.id}) 으로 가는 문(transfer)이 남아 플레이어가 초록 항구 마을에 들어갈 수 있습니다 — ${map.id} 로 가는 transfer 명령(문 이벤트)을 지우거나 새 마을로 돌리세요. 시작 맵에서 닿지 않게 끊으면(remove_map 불필요) 이 검사와 도달 불가 검사에서 모두 빠집니다.`
        : `맵 「${map.name}」(${map.id}) 이 씨앗 어촌(등대·항구) 그대로입니다 — 이름과 다른 초록 항구 마을이 보입니다. 이 맵의 집은 보호돼 있어 안에서 지우거나 덧칠할 수 없습니다(tile_erase·clear_map·paint_tiles 는 거절됩니다). 새 맵을 만들어(create_map → author_beodeul_town 으로 요청 세계관에 맞게 짓기) set_start_position 으로 시작 맵을 새 마을로 옮기고, 옛 맵으로 가는 문(transfer)은 새 마을로 돌리세요 — 시작에서 닿지 않는 옛 씨앗 맵은 이 검사에서 빠집니다.`,
    );
    break;
  }
  return gaps;
}
