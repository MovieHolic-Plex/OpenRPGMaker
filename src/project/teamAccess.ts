// 사람 팀 협업의 역할(소유자·편집자·보기 전용). 혼자 쓰는 프로젝트는 언제나 소유자라 이 모듈이 아무것도 막지 않는다.
// 'editor'·'viewer' 는 팀원 초대로만 생긴다 — 초대 진입점은 @deprecated(multi-user team collaboration is not supported yet, 2026-10-21).
// 그래도 이 검사는 남긴다: 예전에 초대받은 보기 전용 팀원은 호스트(dispatch.ts)가 쓰기를 거절하므로, 편집기도 먼저 막아
// 「저장했다」는 거짓 표시를 내지 않는다. 소유자·편집자는 평소처럼 혼자 편집한다.
import { TEAM_COLLAB_ENABLED } from "../../electron/shared/teamCollab";

type TeamRole = 'owner' | 'editor' | 'viewer';

let role: TeamRole | null = null;
export function setTeamRole(value: TeamRole | null): void { role = value; }
/** Fail closed until host membership has been read. Ordinary web projects have no team bridge. */
/** 보기 전용 팀 멤버의 쓰기를 거절할 때 쓰는 한 줄. */
export const TEAM_READ_ONLY_WRITE_MESSAGE = '보기 전용 프로젝트라 바꿀 수 없습니다.';

/**
 * 사람 팀 협업이 꺼져 있으면(TEAM_COLLAB_ENABLED=false, 2026-10-21) 언제나 true 다. 호스트 연결이 끊기거나
 * 역할을 아직 못 읽었다고 편집기를 보기 전용으로 만들지 않는다 — 저장은 자동 저장 재시도가 맡는다.
 * 실측(2026-10-21): 역할 읽기가 실패하면 role=null 이 되어 store 의 모든 쓰기가 조용히 거절됐다.
 */
export function canWriteTeamProject(): boolean {
  if (!TEAM_COLLAB_ENABLED) return true;
  return typeof window === 'undefined' || !window.oprn?.team || role === 'owner' || role === 'editor';
}
