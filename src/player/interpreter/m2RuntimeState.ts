import type { M2RuntimeState, PlaySessionLike } from "@/project/sessionRuntimeTypes"

export function ensureM2Runtime(session: PlaySessionLike): M2RuntimeState {
  session.m2Runtime ??= {
    screen: {},
    access: {},
    audio: {},
    actors: {},
    events: {},
    map: {},
    system: {},
    session: {},
    camera: {},
    screenEffects: [],
    pathfinding: [],
    waits: [],
    regions: [],
    quests: {},
    dialogue: [],
    cutscene: {},
    checkpoints: [],
    ui: [],
    debug: [],
    expressions: [],
    fallbacks: [],
  };
  session.m2Runtime.camera ??= {};
  session.m2Runtime.screenEffects ??= [];
  session.m2Runtime.pathfinding ??= [];
  session.m2Runtime.waits ??= [];
  session.m2Runtime.regions ??= [];
  session.m2Runtime.quests ??= {};
  session.m2Runtime.dialogue ??= [];
  session.m2Runtime.cutscene ??= {};
  session.m2Runtime.checkpoints ??= [];
  session.m2Runtime.ui ??= [];
  session.m2Runtime.debug ??= [];
  session.m2Runtime.expressions ??= [];
  return session.m2Runtime;
}

/**
 * 명령 이력 배열(표현식·디버그·화면효과·경로·대기·체크포인트·대화·대체 기록)의 상한.
 *
 * 이 배열들은 관측용 기록이라 게임 규칙이 읽지 않는다(상태 조회기·증거 스펙만 끝 몇 개를 본다).
 * 상한이 없어서 반복 명령이 있는 게임은 한 시간에 수만 건이 쌓였고, 세션을 복제하는 모든 경로
 * (자동저장 스냅샷·날짜 경계·농사 트랜잭션)가 그만큼 느려졌다 — 실측 10만 건에서 저장 273ms,
 * 날짜 경계 290ms. 가장 오래된 것부터 버린다.
 */
export const M2_HISTORY_LIMIT = 64;

export function pushM2History<T>(list: T[], entry: T): void {
  list.push(entry);
  if (list.length > M2_HISTORY_LIMIT) list.splice(0, list.length - M2_HISTORY_LIMIT);
}
