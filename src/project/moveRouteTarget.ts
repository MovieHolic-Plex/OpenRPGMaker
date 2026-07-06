// moveEvent 명령(이동 루트 설정)의 대상 지정.
// eventId 필드에 아래 센티넬을 넣으면 "주인공(플레이어)"을 강제로 이동시킨다.
// (RM2003 의 "이동 루트 설정 → 주인공" 에 해당. 장소 이동과 달리 자연스럽게 걷는다.)
// 빈 문자열("")은 "이 이벤트", 그 외 문자열은 "특정 이벤트 ID".
export const PLAYER_MOVE_TARGET = "@player";

export function isPlayerMoveTarget(eventId: string): boolean {
  return eventId === PLAYER_MOVE_TARGET;
}
