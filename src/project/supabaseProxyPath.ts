/** `vite.config.ts` 의 SUPABASE_PROXY_PATH 와 반드시 같은 값이어야 한다(프록시 등록 경로). */
export const SUPABASE_PROXY_PATH = "/supabase";

/**
 * https 페이지 → http 백엔드 fetch 는 브라우저가 mixed content 로 **무조건** 차단한다.
 * 그래서 http Supabase 를 쓰는 한 https 페이지에서는 항상 같은-오리진 /supabase 로 접는다.
 * dev 서버와 vite preview 모두 프록시를 등록해 둠(vite.config.ts §preview.proxy).
 *
 * 과거 isDev 게이트(dev에서만 접기)는 `npm start`(preview = prod 번들, DEV=false)에서
 * 모든 저장/로드 fetch 를 mixed content 로 100% 실패시켰다(2026-08-19 실측:
 * 저장 칩 "저장 실패 · 다시 시도 n회" 반복). 직접 http URL 반환은 어떤 배포에서도
 * 성공할 수 없으므로(브라우저가 차단) 프록시 경로 접기가 엄격히 우월하다.
 * 진짜 프로덕션(https Supabase URL)은 http:// 가 아니므로 손대지 않는다.
 */
export function resolveBrowserSupabaseUrl(
  rawUrl: string,
  options: { readonly pageProtocol: string | undefined }
): string {
  const url = rawUrl.trim().replace(/\/$/, "");
  if (options.pageProtocol !== "https:") return url;
  if (!url.startsWith("http://")) return url;
  return SUPABASE_PROXY_PATH;
}
