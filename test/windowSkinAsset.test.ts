import { describe, expect, it } from "vitest";

type BinaryFsReader = {
  readonly readFileSync: (path: URL) => Uint8Array;
};

const loadBinaryFs = async (): Promise<BinaryFsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as BinaryFsReader;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const WINDOW_SKIN_URL = new URL("../public/assets/ui/windowskin-rm2003.png", import.meta.url);

describe("runtime window skin asset", () => {
  it("ships a valid 96x96 RGBA PNG for 24px 9-slice windows", async () => {
    const fs = await loadBinaryFs();
    const bytes = fs.readFileSync(WINDOW_SKIN_URL);

    expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
    expect(readUint32BE(bytes, 16)).toBe(96);
    expect(readUint32BE(bytes, 20)).toBe(96);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(6);
    expect(hasChunk(bytes, "IDAT")).toBe(true);
  });
});

function hasChunk(bytes: Uint8Array, type: string): boolean {
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const chunkType = ascii(bytes, offset + 4, offset + 8);
    if (chunkType === type) return true;
    offset += length + 12;
  }
  return false;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 0x1000000) + (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
