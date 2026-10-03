const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

/**
 * 동기 SHA-256. crypto.subtle 이 없는 HTTP 서빙(팀 호스트)에서는 체크포인트 정체성 해시가 전부 이 경로를 탄다.
 * 예전 구현(DataView·일반 배열·블록마다 구조 분해)은 26 MB 에 1.2 s 가 걸려 체크포인트마다 메인 스레드를
 * 수 초씩 멈췄다(2026-09-25 실측) — Int32Array 와 지역 변수로 한 블록씩 누적한다.
 */
class Sha256 {
  private readonly state = Int32Array.from(IV);
  private readonly w = new Int32Array(64);
  private readonly block = new Uint8Array(64);
  private blockLength = 0;
  private byteLength = 0;

  reset(): this {
    this.state.set(IV);
    this.blockLength = 0;
    this.byteLength = 0;
    return this;
  }

  update(data: Uint8Array, length = data.length): void {
    this.byteLength += length;
    let offset = 0;
    if (this.blockLength > 0) {
      const take = Math.min(64 - this.blockLength, length);
      this.block.set(data.subarray(0, take), this.blockLength);
      this.blockLength += take;
      offset = take;
      if (this.blockLength < 64) return;
      this.compress(this.block, 0);
      this.blockLength = 0;
    }
    for (; length - offset >= 64; offset += 64) this.compress(data, offset);
    if (offset < length) {
      this.block.set(data.subarray(offset, length), 0);
      this.blockLength = length - offset;
    }
  }

  digestHex(): string {
    const bitLength = this.byteLength * 8;
    const tail = new Uint8Array(this.blockLength < 56 ? 64 - this.blockLength : 128 - this.blockLength);
    tail[0] = 0x80;
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    const end = tail.length;
    tail[end - 8] = high >>> 24; tail[end - 7] = high >>> 16; tail[end - 6] = high >>> 8; tail[end - 5] = high;
    tail[end - 4] = low >>> 24; tail[end - 3] = low >>> 16; tail[end - 2] = low >>> 8; tail[end - 1] = low;
    this.update(tail);
    let hex = "";
    for (let i = 0; i < 8; i += 1) hex += (this.state[i]! >>> 0).toString(16).padStart(8, "0");
    return hex;
  }

  private compress(data: Uint8Array, offset: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = (data[j]! << 24) | (data[j + 1]! << 16) | (data[j + 2]! << 8) | data[j + 3]!;
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15]!;
      const y = w[i - 2]!;
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    const state = this.state;
    let a = state[0]!, b = state[1]!, c = state[2]!, d = state[3]!;
    let e = state[4]!, f = state[5]!, g = state[6]!, h = state[7]!;
    for (let i = 0; i < 64; i += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    state[0] = (state[0]! + a) | 0; state[1] = (state[1]! + b) | 0;
    state[2] = (state[2]! + c) | 0; state[3] = (state[3]! + d) | 0;
    state[4] = (state[4]! + e) | 0; state[5] = (state[5]! + f) | 0;
    state[6] = (state[6]! + g) | 0; state[7] = (state[7]! + h) | 0;
  }
}

// UTF-16 한 단위는 UTF-8 로 최대 3바이트다(서로게이트 쌍 두 단위는 4바이트). 창 하나가 버퍼를 넘지 않는다.
const TEXT_WINDOW = 1 << 16;
let textBuffer: Uint8Array | null = null;
let textEncoder: TextEncoder | null = null;
let textHasher: Sha256 | null = null;

/**
 * 문자열 전체를 UTF-8 배열로 만들지 않고 창 단위로 인코딩해 흘린다 — 수십 MB 할당과 복사를 피한다.
 * 동기 함수라 재진입이 없으므로 해시기·버퍼를 하나씩만 두고 다시 쓴다(작은 글을 수만 번 해시하는 호출자가 있다).
 */
function sha256TextFallback(value: string): string {
  const hasher = (textHasher ??= new Sha256()).reset();
  const encoder = textEncoder ??= new TextEncoder();
  const buffer = textBuffer ??= new Uint8Array(TEXT_WINDOW * 3);
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + TEXT_WINDOW, value.length);
    // 서로게이트 쌍을 창 경계에서 쪼개면 두 반쪽이 각각 U+FFFD 로 인코딩된다.
    if (end < value.length) {
      const last = value.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    }
    const { written } = encoder.encodeInto(start === 0 && end === value.length ? value : value.slice(start, end), buffer);
    hasher.update(buffer, written);
    start = end;
  }
  return hasher.digestHex();
}

function sha256Fallback(bytes: Uint8Array): string {
  const hasher = new Sha256();
  hasher.update(bytes);
  return hasher.digestHex();
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest. crypto.subtle 은 secure context(HTTPS/localhost) 전용이라 HTTP 서빙에서는 JS 폴백을 쓴다. */
export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const stableBytes = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(stableBytes).set(bytes);
    return toHex(new Uint8Array(await subtle.digest("SHA-256", stableBytes)));
  }
  return sha256Fallback(bytes);
}

export async function sha256HexText(value: string): Promise<string> {
  return sha256HexBytes(new TextEncoder().encode(value));
}

/** Synchronous boundaries use the same SHA-256 implementation without changing their execution contract. */
export function sha256HexTextSync(value: string): string {
  return sha256TextFallback(value);
}

/** Synchronous byte digest for transactional tool mutations. */
export function sha256HexBytesSync(bytes: Uint8Array): string { return sha256Fallback(bytes); }
