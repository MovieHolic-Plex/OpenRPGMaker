// util/id.ts — 식별자 생성.
// crypto.randomUUID를 우선 사용, 구형 환경은 폴백.
export function genId(prefix = "id"): string {
  return `${prefix}_${randomUuid()}`;
}

// crypto.randomUUID는 secure context(HTTPS/localhost) 전용이라 HTTP 서빙에서는 getRandomValues 기반 v4 폴백을 쓴다.
export function randomUuid(): string {
  const cryptoApi = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
