// 턴제 JRPG 첫 생성 「끝내도 되나」 — finish 가 뼈대 엔딩 도달만으로 합격시키지 못하게 막는 완료 가드.
//
// 2026-10-16 실제 Argon(8318) JRPG 시험(jrpg-real-1)에서 qa:game 과 첫 구간 자동 플레이가 통과시킨 것들:
//  - J05 타이틀이 기본값 「새 게임」 그대로 끝났다(연애는 romance-default-title 로 막았지만 JRPG 는 없었다).
//  - J04 시작 마을에 대사하는 인물이 하나도 없었다. 시간 이야기를 요청했는데 정의해 둔 시간 엔딩은 어디서도 부르지 않았고,
//    플레이는 뼈대 엔딩(첫 구간 끝)으로 끝났다 — 「엔딩 도달」 만 보는 자동 플레이로는 못 잡는다.
// 연애의 romanceCompletionGaps 와 같은 방식이다: 메시지 배열을 돌려주고, 팀 finish 가 두 번 거절한 뒤에는 보고에 남기고 받는다.

import { SEGMENT_END_ENDING_ID, SEGMENT_ROUTE_MAP_ID } from "@/project/playableSegmentContract";
import type { Project } from "@/project/types";
import { briefTextOf } from "./brief";
import { visitAllCommands } from "./walk";
import { checkJrpg } from "./jrpg";

const PLACEHOLDER_TITLES = new Set(["", "새 게임", "새 프로젝트", "New Game", "New Project"]);
/** 채팅 한 줄(「크로노 트리거 같은 시간여행 JRPG 만들어 줘」)로 온 JRPG 요청인가. 기획서 프롬프트가 아니어도 같은 완료 가드를 받게 한다. */
const JRPG_TASK = /jrpg|제이\s*알\s*피\s*지|알피지|\brpg\b|크로노\s*트리거|파이널\s*판타지|\bff\s?(?:[0-9]{1,2}|[ivx]{1,4})\b|드래곤\s*퀘스트/iu;
/** 이미 JRPG 인 프로젝트에서 게임 전체를 지으라는 요청인가(작은 수정 요청에는 가드를 걸지 않는다). */
const WHOLE_GAME_TASK = /게임을?\s*(?:만들|제작|완성|지어|짜)|처음부터|전체를?\s*(?:만들|제작|완성)/u;
const TIME_BRIEF = /시간|시대|과거|미래|타임|평행|크로노|time|chrono|era\b/iu;
/** 탈것(비공정·비행선) 요청 낱말. */
const AIRSHIP_WORDS = /비공정|비행선|비행\s*정|에어\s*쉽|airship|탈것/iu;
/** 세계가 무너진다·폐허가 된다는 요청 낱말 — 붕괴 전/후 맵 구조가 있어야 한다. */
const COLLAPSE_WORDS = /붕괴|무너(?:져|지|진|뜨|졌)|폐허|멸망|몰락|world\s*collapse|apocalyp/iu;
const RUIN_MAP_NAME = /붕괴|폐허|잔해|황폐|멸망|몰락|무너|ruin|collaps|wreck|devast/iu;
/** 씨앗 시작 맵(버들항 어촌)의 지울 수 없는 표지 — 등대 건물. 이 맵이 어촌이라고 부르지 않는 이름으로 남아 있으면 다시 짓지 않은 것이다. */
const SCAFFOLD_LANDMARK_KIT = "bd-pick-fishing-port-lighthouse";
const HARBOR_MAP_NAME = /항|어촌|포구|해안|바닷|해변|등대|부두|선착|port|harbor|harbour|coast|fishing|seaside|beach|lighthouse/iu;
/** 시작 마을에서 말을 거는 인물의 최소 수 — 촌장 하나로는 마을이 아니다. */
export const START_TOWN_MIN_TALKERS = 2;
/** checkJrpg 경고 중 «끝내도 되나» 를 막는 전투 균형 코드. */
const BALANCE_CODES = new Set(["jrpg-party-identical-stats", "jrpg-party-flat-roles", "jrpg-boss-not-threatening", "jrpg-boss-unwinnable", "jrpg-encounters-harmless", "jrpg-encounters-wipe-party"]);

function isJrpg(project: Project): boolean {
  return project.system?.genre === "adventure-jrpg" || project.gameDesignBrief?.presetId === "adventure-jrpg";
}

/**
 * 채팅 한 줄 요청에도 JRPG 완료 가드를 거는가. 기획서 프롬프트(segmentGate)가 아니면 팀 finish 는 JRPG 가드를 한 번도 부르지 않아
 * 파티 능력치 동일·보스 무해·기본 오프닝이 그대로 끝났다(jrpg-loop-1 ct1: check 경고 4건을 안고 finish 통과).
 */
export function jrpgCompletionGateApplies(project: Project, task = ""): boolean {
  if (JRPG_TASK.test(task)) return true;
  return isJrpg(project) && WHOLE_GAME_TASK.test(task);
}

/** 오프닝이 제목 카드(「— 제목 —」)뿐인가 — 도입을 쓰지 않은 채 끝낸 것이다. 사용자가 끈 오프닝(enabled:false)은 아니다. */
function openingIsOnlyTitleCard(project: Project): boolean {
  const opening = project.system?.opening;
  if (!opening || opening.enabled === false) return false;
  const scenes = opening.scenes ?? [];
  if (scenes.length === 0) return false;
  return scenes.every((scene) => {
    const narration = typeof scene.narration === "string" ? scene.narration.trim() : "";
    const hasPicture = "resourceId" in scene && Boolean((scene as { resourceId?: unknown }).resourceId);
    return scene.kind === "text" && !hasPicture && /^[—–-]+\s*.+?\s*[—–-]+$/u.test(narration);
  });
}

export function jrpgCompletionGaps(project: Project, briefText = briefTextOf(project), options: { readonly task?: string } = {}): string[] {
  if (!isJrpg(project) && !JRPG_TASK.test(options.task ?? "")) return [];
  const gaps: string[] = [];
  if (options.task) briefText = `${briefText} ${options.task}`;

  // 1) 기본 제목.
  const title = (project.system?.titleScreen?.title ?? "").trim();
  const metaTitle = (project.meta?.title ?? "").trim();
  if (PLACEHOLDER_TITLES.has(title) || PLACEHOLDER_TITLES.has(metaTitle)) {
    gaps.push(`게임 제목이 기본값 「${title || metaTitle || "(비어 있음)"}」 그대로입니다 — configure_title_screen {title} 로 이 게임의 이름을 짓고, 기본 부제(「A NEW ADVENTURE」)를 쓰지 않을 거면 logoStyle 을 정하세요.`);
  }

  // 1b) 오프닝 — 제목 카드 한 장(씨앗이 남긴 「— 새 게임 —」 포함)뿐이면 새 게임을 눌러도 검은 화면에 글자만 뜬다.
  if (openingIsOnlyTitleCard(project)) {
    gaps.push("오프닝이 제목 카드(「— …  —」) 한 장뿐입니다 — 새 게임을 누르면 검은 화면에 글자만 뜹니다. plan_opening/set_opening 으로 이 게임의 도입을 2~4컷(세계·발단·주인공) 써서 넣으세요.");
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
    // 조명·날씨(defaultLighting / climate.weather)가 있어야 붕괴 후 모습으로 센다.
    const ruinMaps = Object.values(project.maps ?? {}).filter((map) => {
      const looksAltered = Boolean(map.defaultLighting) || Boolean(map.climate && "weather" in map.climate && map.climate.weather && map.climate.weather !== "none");
      return looksAltered && (RUIN_MAP_NAME.test(map.name ?? "") || (map.defaultLighting?.ambient ?? 0) >= 0.45);
    });
    const otherMaps = Object.values(project.maps ?? {}).length - ruinMaps.length;
    if (ruinMaps.length === 0 || otherMaps === 0) {
      gaps.push("세계가 무너진다는 이야기인데 「붕괴 전/후」 맵 구조가 없습니다 — 같은 지리의 붕괴 후 변형을 derive_map_variant({sourceMapId, variants:[{id, name:\"… (붕괴 후)\", era:\"ruin\"}]}) 로 만들고(건물 철거·안개·어둠이 자동), create_time_gate 나 이벤트 transfer 로 붕괴 순간에 이어 붙이세요.");
    }
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
  for (const map of Object.values(project.maps)) {
    if (!(map.structurePlacements ?? []).some((placement) => placement.kitId === SCAFFOLD_LANDMARK_KIT)) continue;
    if (HARBOR_MAP_NAME.test(map.name ?? "")) continue;
    gaps.push(`맵 「${map.name}」(${map.id}) 이 씨앗 어촌(등대·항구) 그대로입니다 — 이름과 다른 초록 항구 마을이 보입니다. 이 장소를 요청 세계관에 맞게 다시 짓거나(author_beodeul_town 의 다른 테마·place_concept) 등대 건물을 철거하고, 시작 맵이면 startMapId 를 새로 지은 마을로 옮기세요.`);
    break;
  }
  return gaps;
}
