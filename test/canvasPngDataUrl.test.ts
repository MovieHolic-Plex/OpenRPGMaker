// @vitest-environment happy-dom
// 캔버스 PNG 를 toBlob 으로 비동기로 만들어도 data URL 글이 toDataURL 과 같은지, toBlob 이 없거나 실패하면 toDataURL 로 물러나는지 본다.
import { describe, expect, it } from "vitest";
import { canvasPng, canvasPngDataUrl } from "@/util/canvasPngDataUrl";

const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const DATA_URL = `data:image/png;base64,${Buffer.from(BYTES).toString("base64")}`;

describe("canvasPng", () => {
  it("toBlob 바이트로 만든 data URL 은 toDataURL 글과 같고, 같은 바이트의 Blob 을 돌려준다", async () => {
    let syncCalls = 0;
    const canvas = {
      toDataURL: () => { syncCalls += 1; return DATA_URL; },
      toBlob: (done: (blob: Blob | null) => void, type?: string) => { setTimeout(() => done(new Blob([BYTES], { type })), 0); },
    };
    const png = await canvasPng(canvas);
    expect(png.dataUrl).toBe(DATA_URL);
    expect(new Uint8Array(await png.blob!.arrayBuffer())).toEqual(BYTES);
    expect(syncCalls).toBe(0);
  });

  it("toBlob 이 없거나 null 을 주면 toDataURL 로 물러난다", async () => {
    expect(await canvasPngDataUrl({ toDataURL: () => DATA_URL })).toBe(DATA_URL);
    const failing = { toDataURL: () => DATA_URL, toBlob: (done: (blob: Blob | null) => void) => done(null) };
    expect(await canvasPng(failing)).toEqual({ dataUrl: DATA_URL, blob: null });
  });
});
