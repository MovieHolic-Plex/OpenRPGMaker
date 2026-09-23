// assets/openingStillPackCdn.ts
// 오프닝 스틸 팩 URL 조립. bgmCdn.ts 와 같은 계약:
//   - VITE_STILL_CDN_BASE 가 있으면 CDN 절대 URL, 없으면 설치된 로컬 폴백 경로.
//   - 파일명에 경로 조작이 섞이면 거부한다(카탈로그 손상·조작 방어).

export const STILL_LOCAL_FALLBACK_PREFIX = "/assets/stills/pack";
export const STILL_CDN_PREFIX = "stills/v1";

export type StillCdnEnv = {
  readonly VITE_STILL_CDN_BASE?: string;
};

function ambientEnv(): StillCdnEnv {
  try {
    return (import.meta.env ?? {}) as StillCdnEnv;
  } catch {
    return {};
  }
}

/** 미설정이거나 http(s) 가 아니면 null(bgmCdn.ts 와 같은 방어). */
export function stillCdnBase(env: StillCdnEnv = ambientEnv()): string | null {
  const raw = env.VITE_STILL_CDN_BASE?.trim();
  if (!raw) return null;
  const trimmed = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function openingStillPackUrl(fileName: string, env: StillCdnEnv = ambientEnv()): string | null {
  const name = fileName.trim();
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const base = stillCdnBase(env);
  if (base === null) return STILL_LOCAL_FALLBACK_PREFIX + "/" + encodeURIComponent(name);
  return base + "/" + STILL_CDN_PREFIX + "/" + encodeURIComponent(name);
}
