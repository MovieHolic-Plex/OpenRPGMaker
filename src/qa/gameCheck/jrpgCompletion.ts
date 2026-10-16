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
const TIME_BRIEF = /시간|시대|과거|미래|타임|평행|크로노|time|chrono|era\b/iu;
/** 시작 마을에서 말을 거는 인물의 최소 수 — 촌장 하나로는 마을이 아니다. */
export const START_TOWN_MIN_TALKERS = 2;
/** checkJrpg 경고 중 «끝내도 되나» 를 막는 전투 균형 코드. */
const BALANCE_CODES = new Set(["jrpg-party-identical-stats", "jrpg-boss-not-threatening", "jrpg-boss-unwinnable", "jrpg-encounters-harmless", "jrpg-encounters-wipe-party"]);

function isJrpg(project: Project): boolean {
  return project.system?.genre === "adventure-jrpg" || project.gameDesignBrief?.presetId === "adventure-jrpg";
}

export function jrpgCompletionGaps(project: Project, briefText = briefTextOf(project)): string[] {
  if (!isJrpg(project)) return [];
  const gaps: string[] = [];

  // 1) 기본 제목.
  const title = (project.system?.titleScreen?.title ?? "").trim();
  const metaTitle = (project.meta?.title ?? "").trim();
  if (PLACEHOLDER_TITLES.has(title) || PLACEHOLDER_TITLES.has(metaTitle)) {
    gaps.push(`게임 제목이 기본값 「${title || metaTitle || "(비어 있음)"}」 그대로입니다 — configure_title_screen {title} 로 이 게임의 이름을 짓고, 기본 부제(「A NEW ADVENTURE」)를 쓰지 않을 거면 logoStyle 을 정하세요.`);
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

  // 4) 전투 균형 — 파티원이 전부 같은 몸이거나, 보스가 피해를 못 주거나 이길 수 없으면 「끝」까지 갈 수는 있어도 게임이 아니다(jrpg-real-1 J06:
  //    파티 Lv1 스탯 동일 · 보스 21~57입력에 승리). 모의전은 즉시 끝난다(3판, 고정 시드).
  // 검사기가 던지면(DB 가 덜 만들어진 프로젝트) finish 를 막지 않는다 — 균형 검사는 보너스지 필수 구조 검사가 아니다.
  let balance: ReturnType<typeof checkJrpg> = [];
  try { balance = checkJrpg(project); } catch { balance = []; }
  for (const finding of balance) {
    if (BALANCE_CODES.has(finding.code)) gaps.push(`${finding.message} — 배우 능력치는 upsert_actor 의 parameterCurves, 적 능력치는 upsert_enemy 의 stats 로 고치세요.`);
  }
  return gaps;
}
