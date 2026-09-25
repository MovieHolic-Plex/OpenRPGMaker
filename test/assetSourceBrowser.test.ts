import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { assetPageUrl } from "@/editor/assetBrowser/assetPageAllowlist";
import { lookupPackCatalog, type PackCatalogEntry } from "@/editor/assetBrowser/packCatalog";
import { extractPackImage, listPackImages, suggestPackImage } from "@/editor/assetBrowser/packImages";

describe("pack catalog", () => {
  const entry: PackCatalogEntry = {
    zipSha256: "abc",
    entryName: "Tilemap/city.png",
    tileSize: 32,
    name: "일본 거리",
    pageUrl: "https://guttykreum.itch.io/free-japanese-city-game-assets",
  };

  it("uses a learned zip hash and ignores any other hash", () => {
    expect(lookupPackCatalog("abc", [entry])?.tileSize).toBe(32);
    expect(lookupPackCatalog("other", [entry])).toBeNull();
  });
});
  it("allows itch pages and their file host", () => {
    expect(assetPageUrl("https://guttykreum.itch.io/free-japanese-city-game-assets")?.hostname).toBe("guttykreum.itch.io");
    expect(assetPageUrl("https://img.itch.zone/a/original.png")?.hostname).toBe("img.itch.zone");
  });

  it("rejects other origins", () => {
    expect(assetPageUrl("http://guttykreum.itch.io/pack")).toBeNull();
    expect(assetPageUrl("https://evil.com/itch.io")).toBeNull();
    expect(assetPageUrl("https://itch.io.evil.com/pack")).toBeNull();
    expect(assetPageUrl("https://user:pass@itch.io/pack")).toBeNull();
  });
});

describe("pack images", () => {
  it("picks the sheet and leaves singles out of the suggestion", async () => {
    const sheet = png(256, 128);
    const single = png(32, 32);
    const bytes = zip([
      { name: "Tilemap/city.png", data: sheet },
      { name: "tiles/lamp.png", data: single },
      { name: "../escape.png", data: sheet },
      { name: "Unity.unitypackage", data: Buffer.from("nope") },
    ]);
    const images = await listPackImages("city.zip", bytes);
    expect(images.map((image) => image.name)).toEqual(["Tilemap/city.png", "tiles/lamp.png"]);
    expect(images.map((image) => image.role)).toEqual(["tilemap", "single"]);
    expect(suggestPackImage(images)?.name).toBe("Tilemap/city.png");
    expect(Buffer.from(await extractPackImage("city.zip", bytes, "Tilemap/city.png"))).toEqual(sheet);
  });
});

function png(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const type = Buffer.from("IHDR");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(ihdr.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, ihdr])) >>> 0);
  return Buffer.concat([signature, length, type, ihdr, checksum]);
}

function zip(files: readonly { readonly name: string; readonly data: Buffer }[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const compressed = deflateRawSync(file.data);
    const checksum = crc32(file.data) >>> 0;
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(file.data.length),
      u16(name.length), u16(0), name, compressed,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(file.data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    offset += local.length;
    locals.push(local);
    centrals.push(central);
  }
  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDir.length), u32(offset), u16(0),
  ]);
  return new Uint8Array(Buffer.concat([...locals, centralDir, eocd]));
}

function u16(value: number): Buffer {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

function u32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
}
