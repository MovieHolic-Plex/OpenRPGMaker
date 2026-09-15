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

// ── 버전 (2026-09-16) ────────────────────────────────────
// 값은 빌드 시 vite define 이 주입한다(scripts/lib/appVersion.mjs). 소스에 숫자를 손으로
// 적지 않는다 — 손으로 적으면 배포본과 저장소의 숫자가 조용히 갈다.
//
// 여기서 읽는 것은 **빌드 식별자**다. 릴리스 버전(0.1.0)의 정본은 package.json 이고,
// 그 숫자를 올리는 것은 `npm run release` 뿐이다(openwiki/release-and-version.md).
// 둘을 섞으면 매 머지마다 사용자에게 보이는 버전이 바뀐다 — 실측 하루 머지 26건.
//
// 주입이 없는 번들(vitest·번역 스크립트)에서도 죽지 않게 typeof 로 막는다.
// define 이 없으면 이 식별자들은 선언되지 않은 채 남고, typeof 는 그 경우 안전하다.

/** 빌드 시점의 버전 메타. scripts/lib/appVersion.d.mts 와 같은 모양이다. */
export type AppVersionMeta = {
  /** package.json 의 릴리스 버전. */
  readonly version: string;
  /** 사람이 읽는 라벨 — `0.1.0`  `0.1.0-dev.184+gddc7a88`. */
  readonly label: string;
  /** 가장 가까운 `v*` 태그. 없으면 null. */
  readonly tag: string | null;
  /** 그 태그 이후 커밋 수(태그가 없으면 저장소 전체 커밋 수). */
  readonly commitsSinceTag: number;
  /** `g` + 짧은 sha. git 을 못 쓰면 `unknown`. */
  readonly commit: string;
  /** 추적 중인 파일이 수정된 채로 빌드됐는가. */
  readonly dirty: boolean;
  /** 빌드 시각(ISO). */
  readonly builtAt: string;
};

declare const __APP_VERSION__: string | undefined;
declare const __APP_VERSION_META__: AppVersionMeta | undefined;

/** 사람이 읽는 빌드 라벨. 예: `0.1.0`, `0.1.0-dev.184+gddc7a88`. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0-nogit";

/** 라벨을 만들기 전 단계까지 포함한 메타. 도구와 버그 리포트가 쓴다. */
export const APP_VERSION_META: AppVersionMeta =
  typeof __APP_VERSION_META__ === "object" && __APP_VERSION_META__ !== null && typeof __APP_VERSION_META__.label === "string"
    ? __APP_VERSION_META__
    : { version: APP_VERSION, label: APP_VERSION, tag: null, commitsSinceTag: 0, commit: "unknown", dirty: false, builtAt: "" };

/** 제품명 + 버전 — 도움말·정보·로그의 한 줄. */
export function appVersionLine(): string {
  return `${PRODUCT_BRAND} ${APP_VERSION}`;
}

/** 버그 리포트에 붙일 상세 — 커밋·기준 태그·빌드 시각. */
export function appVersionDetail(): string {
  const parts = [`커밋 ${APP_VERSION_META.commit}`];
  if (APP_VERSION_META.tag) parts.push(`기준 태그 ${APP_VERSION_META.tag} +${APP_VERSION_META.commitsSinceTag}`);
  if (APP_VERSION_META.builtAt) parts.push(`빌드 ${APP_VERSION_META.builtAt}`);
  if (APP_VERSION_META.dirty) parts.push("수정된 트리에서 빌드됨");
  return parts.join(" · ");
}

// 콘솔·헤드리스 도구가 읽는 훅. 다른 `__oprn*` 훅과 같은 규약이다(모듈 로드 시 설치).
if (typeof window !== "undefined") {
  window.__oprnVersion = () => APP_VERSION_META;
}
