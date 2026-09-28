// 몬스터 게임 출연진(scarloxyCast.ts) 배역표가 실제 그림·얼굴과 이어지는지.
// 그림 파일은 scripts/build-scarloxy-cast.py 가 만든다. 규격(288x256 시트, 48x48 얼굴)과
// 배역이 가리키는 칸에 실제로 그림이 있는지를 PNG 를 직접 읽어 확인한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { SCARLOXY_RESOURCE_IDS } from "@/assets/scarloxyPack";
import { SCARLOXY_CAST, scarloxyCastCharsetResourceId, type ScarloxyCastRole } from "@/project/defaults/scarloxyCast";

type Rgba = { readonly width: number; readonly height: number; readonly data: Uint8Array };

/** 8비트 RGBA 비인터레이스 PNG 만 읽는 최소 디코더(빌드 스크립트가 쓰는 형식). */
function readPng(publicPath: string): Rgba {
  const buf = readFileSync(path.join(process.cwd(), "public", publicPath));
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect([body[8], body[9], body[12]]).toEqual([8, 6, 0]);
    } else if (type === "IDAT") idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= 4 ? data[y * stride + x - 4]! : 0;
      const b = y > 0 ? data[(y - 1) * stride + x]! : 0;
      const c = x >= 4 && y > 0 ? data[(y - 1) * stride + x - 4]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const add = [0, a, b, (a + b) >> 1, paeth][filter]!;
      data[y * stride + x] = (cur + add) & 0xff;
    }
  }
  return { width, height, data };
}

function opaqueIn(img: Rgba, x0: number, y0: number, w: number, h: number): number {
  let count = 0;
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) if (img.data[(y * img.width + x) * 4 + 3]! > 0) count += 1;
  return count;
}

const ROLES = Object.keys(SCARLOXY_CAST) as ScarloxyCastRole[];

describe("몬스터 게임 출연진 배역표", () => {
  it.each(ROLES)("%s 는 등록된 차셋과 라벨 있는 칸을 가리킨다", (role) => {
    const entry = SCARLOXY_CAST[role];
    const asset = findCharsetAsset(entry.charsetTextureKey);
    expect(asset).toBeDefined();
    expect(findCharsetAsset(scarloxyCastCharsetResourceId(role))?.textureKey).toBe(entry.charsetTextureKey);
    expect(findCharsetSemantic(entry.charsetTextureKey, entry.index)?.appearance).toBeTruthy();
    // 걷기 12칸(3패턴 × 4방향) 모두에 그림이 있어야 한다 — 빈 칸이면 그 방향에서 캐릭터가 사라진다.
    const sheet = readPng(asset!.path);
    expect([sheet.width, sheet.height]).toEqual([288, 256]);
    const bx = (entry.index % 4) * 72;
    const by = Math.floor(entry.index / 4) * 128;
    for (let row = 0; row < 4; row += 1) {
      for (let pattern = 0; pattern < 3; pattern += 1) {
        expect(opaqueIn(sheet, bx + pattern * 24, by + row * 32, 24, 32)).toBeGreaterThan(150);
      }
    }
  });

  it("주요 인물은 얼굴이 있고, 얼굴 id 는 해석·검증 목록에 올라 있다", () => {
    const main: ScarloxyCastRole[] = ["professor", "mom", "rival", "grassLeader", "fireLeader", "waterLeader", "champion", "nurse"];
    for (const role of main) expect(SCARLOXY_CAST[role].faceId).toBeTruthy();
    for (const role of ROLES) {
      const faceId = SCARLOXY_CAST[role].faceId;
      if (!faceId) continue;
      const url = resolveAssetResourceUrl(faceId);
      expect(url).toMatch(/\.png$/u);
      if (faceId.startsWith("scarloxy-face-")) {
        expect(SCARLOXY_RESOURCE_IDS).toContain(faceId);
        const face = readPng(url!.slice(1));
        expect([face.width, face.height]).toEqual([48, 48]);
      }
    }
  });

  it("한 칸을 두 배역이 나눠 쓰지 않는다", () => {
    const slots = ROLES.map((role) => `${SCARLOXY_CAST[role].charsetTextureKey}#${SCARLOXY_CAST[role].index}`);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("전투 화면에 트레이너 그림 자리가 없어 전투 그림은 비워 둔다", () => {
    for (const role of ROLES) expect(SCARLOXY_CAST[role].battlerResourceId).toBeUndefined();
  });
});
