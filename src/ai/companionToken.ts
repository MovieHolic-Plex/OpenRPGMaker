// ai/companionToken.ts
/**
 * 동반 서비스 실행별 토큰(설계 7.4). 루프백은 같은 머신의 다른 프로세스에도 열려 있어 오리진 검사만으로는
 * 부족하다(curl 은 오리진을 안 보내고 DNS 리바인딩은 속일 수 있다). 없으면 헤더를 붙이지 않는다 —
 * 토큰을 걸지 않은 서버(vite dev·공유 호스트)와 같은 코드로 돌아야 하기 때문이다.
 *
 * 로그인(/auth/*)·조수(/v1/chat/completions)·에이전트(/v1/agent/*)·그림(/v1/images/*)이 모두 이 헤더를
 * 실어야 한다. 예전에는 /auth/* 만 실어서, 칩은 「연결됨」인데 조수 요청은 403 으로 조용히 막혔다.
 */
export function companionToken(): string | null {
  if (typeof window !== "undefined" && window.oprn?.companionToken) return window.oprn.companionToken;
  return null;
}

export function companionTokenHeaders(): Record<string, string> {
  const token = companionToken();
  return token ? { "x-oprn-companion-token": token } : {};
}
