// brand.ts
// 제품 정체성의 단일 진실 원천. 다른 파일은 여기서만 가져다 쓴다.
//
// 왜 두 개로 나누는가 —
//   PRODUCT_SLUG  : 저장 키·window 전역·패키지·파일명에 박히는 식별자. 바꾸면 데이터
//                   마이그레이션이 필요하므로 **중립·상숙**으로 둔다. 패키지 포맷이
//                   이미 `.oprn` / `application/vnd.openrpg.project+zip` 이라 그걸 따른다.
//   PRODUCT_BRAND : 사람이 읽는 표시명. 톱바·<title>·manifest·로그인·도움말이 쓴다.
//                   슬러그와 분리해 뒀으므로 나중에 여기 한 줄만 고치면 전부 따라온다.
//
// 금지: 이 두 상수에 RPG Maker / RPG 만들기 / 쯔꾸르 / 쯔구르 / ツクール / RM2K 계열
// 표현을 넣지 않는다. `test/e2e/_detsukuru-brand.spec.ts` 가 렌더된 DOM 을 검사한다.

/** 식별자 슬러그 — 저장 키·전역 훅·패키지에 쓴다. 바꾸면 마이그레이션 필요. */
export const PRODUCT_SLUG = "oprn";

/**
 * 화면에 보이는 제품명. **임시값** — 감독이 최종 이름을 정하면 이 줄만 바꾼다.
 * 파생 문자열을 다른 곳에 손으로 적지 말고 이 상수를 import 해서 조립할 것.
 */
export const PRODUCT_BRAND = "OPRN Studio";

/** 한 줄 소개 — meta description·manifest·도움말 개요가 공유한다. */
export const PRODUCT_TAGLINE = "브라우저에서 돌아가는 AI 협업 탑다운 RPG 제작 워크벤치";
