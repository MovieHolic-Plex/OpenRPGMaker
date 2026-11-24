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

/**
 * 타이틀 · 메뉴 곡.
 *
 * **새 프로젝트**의 타이틀 BGM 기본값이다(`defaultSystem(true)` 만 꽂는다 — 2026-11-24 오너 결정).
 * 예전에는 타이틀 무음이 의도된 기본이었지만, 새 프로젝트를 타이틀부터 실행하면 아무 소리도
 * 나지 않는 것이 «기본 BGM 이 안 틀어진다» 로 보고됐다. 이미 저장된 프로젝트는 건드리지 않는다:
 * `defaultTitleScreenSettings()`(옛 문서 보정·normalize 의 기준)에는 곡이 없고, 저작자가 일부러
 * 비운 칸은 그대로 비어 있다. 파일은 레포에 함께 커밋돼 있어 CDN 설정 없이도 재생된다.
 */
export const STARTER_TITLE_BGM_ID = "cc0-bgm-rtp-ttl-001";

/**
 * 새 프로젝트 타이틀 메뉴 효과음(커서·결정·취소). 전부 `public/assets/se/oga-rpg-pack/interface/` 에
 * 함께 커밋된 CC0 UI 소리다(seCatalogRuntime.ts 가 경로를 안다 — CDN 없음).
 * 커서 = 짧은 탭(0.19s), 결정 = 밝은 상향 차임(0.45s), 취소 = 낮은 노크(0.5s)로 서로 구분된다.
 */
export const STARTER_TITLE_SE_IDS = {
  cursor: "cc0-se-orp-interface-interface1",
  confirm: "cc0-se-orp-interface-interface2",
  cancel: "cc0-se-orp-interface-interface6",
} as const;

/** 레포에 파일이 함께 커밋된 카탈로그 곡. CDN 없이도 재생돼야 한다. */
export const BGM_STARTER_TRACK_IDS: readonly string[] = [
  STARTER_DEFAULT_BGM_ID,
  STARTER_BATTLE_BGM_ID,
  STARTER_TITLE_BGM_ID,
];
