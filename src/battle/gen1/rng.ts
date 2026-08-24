import type { Rng } from "@/util/rng";

export type Gen1NextByte = () => number;

/** Adapts the runtime's [0, 1) RNG contract to the cartridge's full byte domain. */
export function createGen1ByteRng(rng: Rng): Gen1NextByte {
  return () => Math.min(255, Math.max(0, Math.floor(rng() * 256)));
}

export function rotateLeft8(value: number, count = 1): number {
  const byte = normalizeByte(value);
  const shift = normalizeShift(count);
  if (shift === 0) return byte;
  return ((byte << shift) | (byte >>> (8 - shift))) & 0xff;
}

export function rotateRight8(value: number, count = 1): number {
  const byte = normalizeByte(value);
  const shift = normalizeShift(count);
  if (shift === 0) return byte;
  return ((byte >>> shift) | (byte << (8 - shift))) & 0xff;
}

function normalizeByte(value: number): number {
  return Math.min(255, Math.max(0, Math.trunc(value)));
}

function normalizeShift(count: number): number {
  return ((Math.trunc(count) % 8) + 8) % 8;
}
