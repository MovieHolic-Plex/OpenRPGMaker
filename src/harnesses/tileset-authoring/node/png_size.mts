import { readFileSync } from "node:fs";
/** PNG 머리(IHDR)에서 폭·높이. */
export function imageSize(path: string) { const b = readFileSync(path); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
