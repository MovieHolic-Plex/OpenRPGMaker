type TeamRole = 'owner' | 'editor' | 'viewer';

let role: TeamRole | null = null;
export function setTeamRole(value: TeamRole | null): void { role = value; }
/** Fail closed until host membership has been read. Ordinary web projects have no team bridge. */
/** 보기 전용 팀 멤버의 쓰기를 거절할 때 쓰는 한 줄. */
export const TEAM_READ_ONLY_WRITE_MESSAGE = '보기 전용 프로젝트라 바꿀 수 없습니다.';

export function canWriteTeamProject(): boolean {
  return typeof window === 'undefined' || !window.oprn?.team || role === 'owner' || role === 'editor';
}
