/**
 * 사람 여러 명이 여러 컴퓨터에서 한 프로젝트를 같이 편집하는 「팀 협업」을 켜는 단 하나의 스위치.
 *
 * 2026-10-21: multi-user team collaboration is not supported yet. 진입점(파일 메뉴 「팀 협업 시작 / 관리」·「팀에 참여…」,
 * 시작 화면 「팀에 참여」·「최근 참여한 팀」, 편집기의 팀 연결 막대·「팀 관리 ↗」, 호스트 페이지의 팀원 초대)은
 * 이 값이 false 이면 숨는다. 코드는 지우지 않았다 — 되살릴 때 이 값만 true 로 바꾼다.
 *
 * 여기에 묶이지 않는 것(계속 동작): 프로젝트 정본 저장 호스트(Electron·`npm run host` 의 project.sqlite + assets),
 * 같은 사람의 여러 탭 사이 맵 잠금·리비전 동기화, AI 조수 팀(팀장·팀원 에이전트), 전투 파티, 팀·학교 스토어 주소 설정.
 */
export const TEAM_COLLAB_ENABLED: boolean = false;

export const TEAM_COLLAB_DEPRECATION_NOTE = 'multi-user team collaboration is not supported yet (2026-10-21)';
