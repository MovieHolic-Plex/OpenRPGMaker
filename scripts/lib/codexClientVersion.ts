/**
 * Codex 백엔드는 요청 헤더 `version`(클라이언트 버전)으로 모델 목록을 거른다. 설치된 pi-catalog 17.4 는
 * `0.144.1` 을 박아 보내며, 이 값은 상수라 바꿀 수 없다. 실측(2026-10-07, 같은 ChatGPT 계정):
 * - `/backend-api/codex/models?client_version=0.144.1` → gpt-5.6 계열까지만
 * - `0.155.1` → gpt-6-astra·gpt-6-sol·gpt-6-luna 가 더해진다
 * - `0.160.0` → gpt-6.1-sol 까지 (minimal_client_version 은 0.153.0 이라고 적혀 있지만 0.158 까지는 목록에 없다)
 * 그래서 카탈로그에 있던 gpt-6-* 도 실제로는 전부 400(「requires a newer version of Codex」)이었다.
 *
 * HTTP(SSE) 요청의 `version` 헤더만 여기서 올린다. 웹소켓 핸드셰이크 헤더는 fetch 를 거치지 않으므로
 * 새 모델은 ohMyPiModel 에서 preferWebsockets:false 로 SSE 를 쓰게 한다.
 */
export const OPRN_CODEX_CLIENT_VERSION = "0.160.0";

function isCodexBackend(input: Parameters<typeof fetch>[0]): boolean {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw);
    return url.hostname === "chatgpt.com" && url.pathname.startsWith("/backend-api/codex");
  } catch {
    return false;
  }
}

/** Codex 백엔드로 가는 요청에만 새 클라이언트 버전을 싣는다. 다른 주소는 그대로 통과시킨다. */
export function codexVersionFetch(base: typeof fetch = fetch): typeof fetch {
  const wrapped = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    if (!isCodexBackend(input)) return base(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("version", OPRN_CODEX_CLIENT_VERSION);
    return base(input, { ...init, headers });
  };
  return Object.assign(wrapped, base) as typeof fetch;
}
