/**
 * 내용 동일성 판정용 128비트 비암호 지문. 같은 문자열 → 같은 값, 우연 충돌은 사실상 없다.
 * 적대자를 막는 서명이 아니다 — 워커·브라우저가 «같은 프로젝트를 보고 있나»만 확인한다.
 * 수십 MB JSON 에 순수 JS SHA-256 을 돌리면 쓰기 1회에 8~43 s 가 들었다(여기선 수백 ms).
 * UTF-16 코드 단위를 그대로 먹여 TextEncoder 복사도 없다.
 */
export function contentFingerprint(value: string): string {
  let h1 = 0x9e3779b1 ^ value.length;
  let h2 = 0x85ebca77;
  let h3 = 0xc2b2ae3d;
  let h4 = 0x27d4eb2f;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h3 = Math.imul((h3 ^ c) + i, 0x1b873593);
    h4 = Math.imul(h4 ^ (c << 7), 0xcc9e2d51) ^ (h4 >>> 13);
  }
  const mix = (h: number, k: number) => {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35 ^ k);
    h ^= h >>> 16;
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  return mix(h1, 0) + mix(h2, 1) + mix(h3, 2) + mix(h4, 3);
}
