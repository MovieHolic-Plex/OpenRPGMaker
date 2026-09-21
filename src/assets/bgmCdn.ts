// assets/bgmCdn.ts
// CC0 BGM 카탈로그(281곡, 1.21GB)의 재생 URL 조립.
//
// 왜 CDN 인가: 오디오 총량이 1.21GB 다. 레포/번들에 담을 수 없고, 담아도 배포마다 1.21GB 를
// 다시 밀게 된다. 그래서 파일은 DigitalOcean Spaces 에 한 번 올리고 카탈로그(파일명+sha256)만
// 레포에 남긴다. `scripts/upload-bgm-to-spaces.mjs` 가 그 업로드 경로다.
//
// 왜 폴백이 로컬 경로인가: CDN 이 설정되지 않은 개발 환경에서 절대 URL 을 만들면
// 잘못된 오리진으로 281개 요청이 나간다. 대신 `public/` 하위 경로로 떨어뜨려
// (원하면 로컬 동기화로 채울 수 있는) 같은 오리진 404 가 되게 한다 — 진단이 쉽다.

/**
 * CDN 위에서 카탈로그 오디오가 놓이는 접두사. 업로드 스크립트(KEY_PREFIX)와 반드시 같아야 한다.
 * Space 는 다른 서비스와 공유하므로 `rpg-zzu/` 로 프로젝트를 격리한다.
 */
export const BGM_CDN_PREFIX = "rpg-zzu/bgm/v1";

/**
 * CDN 미설정 시 쓰는 같은 오리진 경로. `public/` 하위이므로 로컬에 파일을 복사해 두면 그대로 들린다.
 * (레포에는 커밋하지 않는다 — .gitignore 참조)
 */
export const BGM_LOCAL_FALLBACK_PREFIX = "/assets/cc0/audio/catalog";

export type BgmCdnEnv = {
  readonly VITE_BGM_CDN_BASE?: string;
};

/**
 * import.meta.env 접근을 한 곳으로 모은다 — 플레이어 SDK 처럼 번들러 밖에서 쓰일 때를 대비한다.
 *
 * 키를 **하나만** 읽는다. `import.meta.env` 를 통째로 참조하면 Vite 가 env 객체 전체를 번들에
 * 직렬화해 .env.local 의 비밀(VITE_LLM_API_KEY·Supabase anon 키)이 출하물에 박힌다
 * (2026-09-22 실측: 패키징 AppImage 에 dev 머신 주소와 anon JWT 가 들어갔다). 정적 키 접근은
 * 그 키만 인라인되므로 env 객체가 방출되지 않는다. 번들러 밖(env 부재)에서는 catch 가 받는다.
 */
function ambientEnv(): BgmCdnEnv {
  try {
    return { VITE_BGM_CDN_BASE: import.meta.env.VITE_BGM_CDN_BASE };
  } catch {
    return {};
  }
}

/**
 * 설정된 CDN 베이스를 정규화해서 돌려준다. 미설정/빈 값이면 null.
 * 끝의 `/` 는 떼고, `http(s)` 가 아닌 값은 무시한다(오타로 이상한 스킴이 새는 것 방지).
 */
export function bgmCdnBase(env: BgmCdnEnv = ambientEnv()): string | null {
  const raw = env.VITE_BGM_CDN_BASE?.trim();
  if (!raw) return null;
  const trimmed = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/**
 * 카탈로그 파일명 → 재생 URL.
 *
 * 파일명은 카탈로그 생성 시점에 고정된 값(`rtp-fld-001-...\_f5d3e29d.mp3`)이라 그대로 쓴다.
 * 다만 경로 조작 문자가 섞인 값은 거부한다 — 카탈로그가 손상됐거나 프로젝트가 조작된 경우다.
 */
export function bgmTrackUrl(fileName: string, env: BgmCdnEnv = ambientEnv()): string | null {
  const name = fileName.trim();
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const base = bgmCdnBase(env);
  if (base === null) return `${BGM_LOCAL_FALLBACK_PREFIX}/${encodeURIComponent(name)}`;
  return `${base}/${BGM_CDN_PREFIX}/${encodeURIComponent(name)}`;
}
