// 게임 파일(.oprn) 형식 이름표. 무거운 패키지 코드(직렬화·zip)와 떼어 둔다 — 데스크톱 시작 화면이 «파일 고르기» 대화상자의
// accept 값만 쓰려고 직렬화 모듈(번들 타일셋 80MB 를 끌고 온다)을 첫 화면 번들에 싣지 않게(2026-10-20).
export const OPRN_EXTENSION = ".oprn";
export const OPRN_MIME = "application/vnd.openrpg.project+zip";
export const LEGACY_RPGZZU_EXTENSION = ".rpgzzu";
export const LEGACY_RPGZZU_MIME = "application/vnd.rpgzzu.project+zip";

/** 파일 고르기 accept 값 — 새 형식과 옛 형식 모두. */
export const OPRN_GAME_FILE_ACCEPT = [OPRN_MIME, LEGACY_RPGZZU_MIME, OPRN_EXTENSION, LEGACY_RPGZZU_EXTENSION].join(",");
