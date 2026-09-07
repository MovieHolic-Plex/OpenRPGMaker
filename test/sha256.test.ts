import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256HexBytes, sha256HexText, sha256HexTextSync } from "../src/util/sha256";

const VECTORS: ReadonlyArray<readonly [string, string]> = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  // 56바이트 — 패딩이 다음 블록으로 넘어가는 경계
  ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
];

describe("sha256", () => {
  it.each(VECTORS)("hashes synchronous text against a standard vector when input is %j", (input, expected) => {
    // Given a standard SHA-256 input/output pair.
    // When a synchronous tool boundary hashes the input.
    const digest = sha256HexTextSync(input);
    // Then it has the same cryptographic identity as the standard algorithm.
    expect(digest).toBe(expected);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("crypto.subtle 경로에서 표준 벡터와 일치한다", async () => {
    for (const [input, expected] of VECTORS) {
      expect(await sha256HexText(input)).toBe(expected);
    }
  });

  it("crypto.subtle 이 없는 비보안 컨텍스트에서도 같은 해시를 낸다", async () => {
    vi.stubGlobal("crypto", undefined);
    for (const [input, expected] of VECTORS) {
      expect(await sha256HexText(input)).toBe(expected);
    }
  });

  it("멀티블록 바이너리 입력에서 subtle 경로와 폴백 경로가 일치한다", async () => {
    const bytes = new Uint8Array(300);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 37 + 11) % 256;
    const viaSubtle = await sha256HexBytes(bytes);
    vi.stubGlobal("crypto", undefined);
    const viaFallback = await sha256HexBytes(bytes);
    expect(viaFallback).toBe(viaSubtle);
  });
});
