/** `vite.config.ts` 의 SUPABASE_PROXY_PATH 와 반드시 같은 값이어야 한다(프록시 등록 경로). */
export const SUPABASE_PROXY_PATH = "/supabase";

/**
 * https 페이지 → http 백엔드 fetch 는 브라우저가 mixed content 로 차단한다.
 * dev 는 vite 프록시가 같은 오리진에 Supabase 를 얹어두므로 그 경로로 접어 피한다.
 * 프로덕션에는 그 프록시가 없으므로 손대지 않는다.
 */
export function resolveBrowserSupabaseUrl(
  rawUrl: string,
  options: { readonly isDev: boolean; readonly pageProtocol: string | undefined }
): string {
  const url = rawUrl.trim().replace(/\/$/, "");
  if (!options.isDev) return url;
  if (options.pageProtocol !== "https:") return url;
  if (!url.startsWith("http://")) return url;
  return SUPABASE_PROXY_PATH;
}
