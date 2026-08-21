import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "vendor/easyrpg-rtp/ChipSet/Exterior.png";
const TARGET = "public/assets/easyrpg-chipset-exterior.png";
const EXPECTED_WIDTH = 480;
const EXPECTED_HEIGHT = 256;

function readPngSize(path) {
  const bytes = readFileSync(path);
  const signature = bytes.slice(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${path} is not a PNG file`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let k = 0; k < 8; k++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])), 0);
  return Buffer.concat([length, typeBytes, payload, checksum]);
}

function withIndexedTransparency(bytes) {
  const out = [bytes.slice(0, 8)];
  let pos = 8;
  let inserted = false;
  while (pos < bytes.length) {
    const len = bytes.readUInt32BE(pos);
    const type = bytes.slice(pos + 4, pos + 8).toString();
    const current = bytes.slice(pos, pos + len + 12);
    out.push(current);
    pos += len + 12;
    if (type === "PLTE") {
      const alpha = Buffer.alloc(256, 255);
      alpha[0] = 0;
      out.push(chunk("tRNS", alpha));
      inserted = true;
    }
  }
  if (!inserted) throw new Error(`${SOURCE} has no indexed PNG palette`);
  return Buffer.concat(out);
}

const sourceBytes = readFileSync(SOURCE);
const size = readPngSize(SOURCE);
if (size.width !== EXPECTED_WIDTH || size.height !== EXPECTED_HEIGHT) {
  throw new Error(`Expected ${SOURCE} to be ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}, got ${size.width}x${size.height}`);
}

writeFileSync(TARGET, withIndexedTransparency(sourceBytes));
console.log(`Copied EasyRPG RTP Exterior chipset to ${TARGET} with palette index 0 transparency`);
