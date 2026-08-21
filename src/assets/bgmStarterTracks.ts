// assets/bgmStarterTracks.ts
// 새 프로젝트가 곧바로 소리를 내기 위한 "스타터 3곡".
//
// 왜 3곡만 특별한가: CC0 BGM 카탈로그는 281곡/1.21GB 라 전부 CDN(DigitalOcean Spaces)에서 온다.
// 그런데 기본 프로젝트의 BGM 이 CDN 에만 있으면 `VITE_BGM_CDN_BASE` 를 설정하지 않은 환경
// (클론 직후, CI, 오프라인)에서 새 프로젝트가 **무음으로 시작**한다. 그래서 기본값으로 쓰는
// 세 곡만 `public/assets/cc0/audio/catalog/` 에 함께 커밋한다(≈10MB).
//
// 여기 목록을 바꾸면 `public/` 의 파일도 같이 바꿔야 한다 —
// test/bgmCatalog.test.ts 의 "스타터 곡 파일이 실제로 존재한다" 가 그 불일치를 잡는다.

/** 기본 맵 BGM(초원 장거리 보행 — 심리스 루프). */
export const STARTER_DEFAULT_BGM_ID = "cc0-bgm-rtp-fld-003";

/** 기본 전투 BGM(일반 전투). */
export const STARTER_BATTLE_BGM_ID = "cc0-bgm-rtp-btl-001";

/** 기본 타이틀 BGM(타이틀 · 메뉴). */
export const STARTER_TITLE_BGM_ID = "cc0-bgm-rtp-ttl-001";

/** 레포에 파일이 함께 커밋된 카탈로그 곡. CDN 없이도 재생돼야 한다. */
export const BGM_STARTER_TRACK_IDS: readonly string[] = [
  STARTER_DEFAULT_BGM_ID,
  STARTER_BATTLE_BGM_ID,
  STARTER_TITLE_BGM_ID,
];
