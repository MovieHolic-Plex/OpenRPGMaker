import type { Project } from '../../project/types';
import { isRomanceGameRequest, romanceCompletionGaps } from '../../qa/gameCheck/romance';

/**
 * 연애 게임 제작 요청의 완료 검사(2026-10-16 romance-fix-4, romance-real-2 R03).
 * 팀 경로는 finish 게이트가 있지만 채팅 한 줄(기획서 없음)로 도는 단일 조수 실행은 아무 게이트도 없어 기본 제목 「새 게임」·기본 부제·뼈대 자리표시·
 * 호감과 무관한 단일 엔딩이 그대로 통과했다. 요청 문장이 「연애 게임 만들기」일 때만 켜고, 같은 검사(romanceCompletionGaps)를 완료 재촉으로 쓴다.
 * 팀 하위 실행(도구 목록 고정)은 켜지 않는다 — 단계별 일만 하는 작업자에게 제목·엔딩을 시키면 안 된다.
 */
export class PiRomanceProduction {
  readonly requested: boolean;
  constructor(requested: boolean, private readonly task = '') { this.requested = requested && isRomanceGameRequest(task); }
  inspect(project: Project): string[] {
    return this.requested ? romanceCompletionGaps(project, { task: this.task }) : [];
  }
}
