const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

type FakePngRequest = {
  readonly width: number;
  readonly height: number;
  readonly blank?: boolean;
};

export function createFakePngBytes(request: FakePngRequest): Uint8Array {
  const scanlineLength = 1 + request.width * 4;
  const raw = new Uint8Array(scanlineLength * request.height);
  for (let y = 0; y < request.height; y += 1) {
    const row = y * scanlineLength;
    raw[row] = 0;
    for (let x = 0; x < request.width; x += 1) {
      const offset = row + 1 + x * 4;
      const varied = request.blank === true ? 0 : (x * 17 + y * 31) % 251;
      raw[offset] = varied;
      raw[offset + 1] = request.blank === true ? 0 : (80 + varied) % 251;
      raw[offset + 2] = request.blank === true ? 0 : (160 + varied) % 251;
      raw[offset + 3] = request.blank === true ? 0 : 255;
    }
  }
  return joinBytes([
    new Uint8Array(PNG_SIGNATURE),
    pngChunk("IHDR", ihdrBytes(request.width, request.height)),
    pngChunk("IDAT", zlibStoredBytes(raw)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function ihdrBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13);
  writeUint32(bytes, 0, width);
  writeUint32(bytes, 4, height);
  bytes[8] = 8;
  bytes[9] = 6;
  return bytes;
}

function zlibStoredBytes(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < raw.byteLength; offset += 65535) {
    const length = Math.min(65535, raw.byteLength - offset);
    const finalBlock = offset + length >= raw.byteLength ? 1 : 0;
    const header = new Uint8Array([finalBlock, length & 255, length >> 8, (~length) & 255, ((~length) >> 8) & 255]);
    blocks.push(header, raw.slice(offset, offset + length));
  }
  const checksum = new Uint8Array(4);
  writeUint32(checksum, 0, adler32(raw));
  blocks.push(checksum);
  return joinBytes(blocks);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const bytes = new Uint8Array(12 + data.byteLength);
  writeUint32(bytes, 0, data.byteLength);
  bytes.set(typeBytes, 4);
  bytes.set(data, 8);
  writeUint32(bytes, 8 + data.byteLength, crc32(joinBytes([typeBytes, data])));
  return bytes;
}

function joinBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let current = (crc ^ byte) & 255;
    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    crc = (crc >>> 8) ^ current;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
