import { describe, expect, it } from "vitest";

// scripts/asset-gen/spriteProcess.mjs 의 두 입력 형태를 못 박는다.
//
// 왜 필요한가: 이 모듈에는 테스트가 없었는데, 자산 생성 백엔드가 바뀌면 입력의 성질이
// 통째로 바뀐다. kaykai image API 의 DuckCoding 경로는 **알파로 배경이 빠진 RGBA PNG** 를
// 주고, agy generate_image 는 **마젠타 배경 JPEG** 를 준다. 알파 소스를 마젠타 경로로
// 흘리면 투명 픽셀의 RGB (0,0,0) 이 배경색 중앙값으로 잡혀서, 허용 오차(62) 안에 드는
// **피사체의 검은 1px 외곽선이 통째로 지워진다**. 픽셀아트에서 외곽선이 사라지면 실루엣이
// 무너지는데 예외는 안 난다 — 조용히 망가지는 부류라 테스트로 잡아야 한다.
import Jimp from "jimp";
import { processSprite } from "../scripts/asset-gen/spriteProcess.mjs";

const TMP = ".omo/asset-gen-tmp/test";

/** 검은 외곽선을 가진 파란 사각형. 픽셀아트의 최소 재현 — 외곽선 보존을 재려면 필요하다. */
async function outlinedBlob(width: number, height: number, background: number | null): Promise<Jimp> {
  const canvas = new Jimp(width, height, background ?? 0x00000000);
  const w = Math.floor(width * 0.4);
  const h = Math.floor(height * 0.6);
  const outline = new Jimp(w, h, 0x101010ff);
  const fill = new Jimp(w - 8, h - 8, 0x2050c0ff);
  outline.composite(fill, 4, 4);
  canvas.composite(outline, Math.floor((width - w) / 2), Math.floor((height - h) / 2));
  return canvas;
}

async function countPixels(path: string): Promise<{ opaque: number; dark: number }> {
  const image = await Jimp.read(path);
  let opaque = 0;
  let dark = 0;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (_x, _y, idx) {
    const data = this.bitmap.data;
    if (data[idx + 3] <= 32) return;
    opaque += 1;
    if (data[idx] < 70 && data[idx + 1] < 70 && data[idx + 2] < 70) dark += 1;
  });
  return { opaque, dark };
}

describe("processSprite source shapes", () => {
  it("keys a magenta background and reports the content box", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(TMP, { recursive: true });
    const source = `${TMP}/magenta-src.png`;
    const out = `${TMP}/magenta-48.png`;
    await (await outlinedBlob(400, 400, 0xff00ffff)).writeAsync(source);

    const report = await processSprite(source, out, 48);

    expect(report.preKeyed).toBe(false);
    expect(report.content).toEqual({ w: 160, h: 240 });
    expect(report.keyedRatio).toBeGreaterThan(0.5);
  });

  it("skips keying for an alpha source and keeps the dark outline", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(TMP, { recursive: true });
    const source = `${TMP}/alpha-src.png`;
    const out = `${TMP}/alpha-48.png`;
    await (await outlinedBlob(400, 400, null)).writeAsync(source);

    const report = await processSprite(source, out, 48, Jimp.RESIZE_BEZIER);

    expect(report.preKeyed).toBe(true);
    expect(report.content).toEqual({ w: 160, h: 240 });
    // 외곽선이 남아 있어야 한다. 마젠타 경로를 타면 배경색이 검정으로 잡혀 여기가 0 이 된다.
    const { opaque, dark } = await countPixels(out);
    expect(opaque).toBeGreaterThan(200);
    expect(dark).toBeGreaterThan(0);
  });

  it("throws when the border is neither alpha nor magenta", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(TMP, { recursive: true });
    const source = `${TMP}/grey-src.png`;
    await new Jimp(200, 200, 0x303030ff).writeAsync(source);

    await expect(processSprite(source, `${TMP}/grey-48.png`, 48)).rejects.toThrow();
  });
});
