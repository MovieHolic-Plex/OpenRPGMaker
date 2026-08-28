/** `vite.config.ts` 의 SUPABASE_PROXY_PATH 와 반드시 같은 값이어야 한다(프록시 등록 경로). */
export const SUPABASE_PROXY_PATH = "/supabase";

/**
 * 프록시 모드에서 클라이언트가 들고 있는 자리표시자. 실제 자격증명이 아니다 —
 * `/supabase` 프록시가 서버 전용 `SUPABASE_ANON_KEY` 로 apikey/authorization 을 덮어쓴다.
 *
 * 빈 문자열이 아니라 센티널을 쓰는 이유: 저장 가능 여부·자격증명 변경 감지·헤더 구성 등
 * 이미 `Boolean(anonKey)` 를 보는 지점이 여러 곳(store.ts, persistenceStatus.ts,
 * editorToolHook.ts, mapEditLocks.ts, queryTools.ts)이라, 빈 값을 흘리면 그 전부가
 * "미설정"으로 뒤집힌다. 센티널은 그 계약을 건드리지 않고 실 키만 번들에서 빼낸다.
 */
export const SUPABASE_PROXY_ANON_SENTINEL = "proxy-injected";

/** 프록시 모드 여부 — 이 값이 켜지면 URL 은 항상 같은-오리진 경로이고 실 키는 서버에만 있다. */
export function supabaseProxyModeEnabled(raw: string | undefined): boolean {
  const value = raw?.trim();
  return value === "1" || value === "true";
}

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
