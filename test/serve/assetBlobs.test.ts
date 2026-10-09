import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAssetBlobIndex } from "../../electron/serve/assetBlobs";
import { ASSET_BLOB_PREFIX, assetBlobOwners, restoreAssetBlobs } from "@/project/persistence/core/foldedProject";

const png = (seed: number) => "data:image/png;base64," + Buffer.from(Array.from({ length: 6000 }, (_, i) => (i * seed) % 251)).toString("base64");

// HTTP 팀 호스트의 자산 떼기(2026-09-28): 접힌 행 64MB 중 63MB 가 업로드 자산 dataUrl 이라 참여 창이 부팅·팀 변경 반영마다
// 다시 받았다. 전송에서만 떼고 참여 창이 되돌린다 — 되돌린 문서는 원래 행과 같아야 한다.
describe("HTTP 팀 호스트 자산 떼기", () => {
  const row = () => JSON.stringify({
    version: 4,
    assets: { uploaded: {
      big: { id: "big", dataUrl: png(3) },
      twin: { id: "twin", dataUrl: png(3) },
      small: { id: "small", dataUrl: "data:image/png;base64,AAAA" },
      ref: { id: "ref", ref: { sha256: "a".repeat(64), mime: "image/png", bytes: 1, extension: "png" } },
    } },
    tilesets: { t: { $blob: "b".repeat(64) } },
  });

  it("떼고 되돌린 문서가 원래 행과 같다", () => {
    const index = createAssetBlobIndex();
    const original = row();
    const stripped = index.strip(original);
    expect(stripped.folded.length).toBeLessThan(original.length / 2);
    expect(stripped.assetBlobShas).toHaveLength(1);
    const sha = stripped.assetBlobShas[0]!;
    expect(sha).toBe(createHash("sha256").update(png(3), "utf8").digest("hex"));
    const document = JSON.parse(stripped.folded) as Record<string, unknown>;
    expect([...assetBlobOwners(document).get(sha)!].sort()).toEqual(["big", "twin"]);
    restoreAssetBlobs(document, new Map(Object.entries(index.read(stripped.assetBlobShas))));
    expect(JSON.stringify(document)).toBe(original);
  });

  it("작은 dataUrl 과 파일 참조 자산은 그대로 둔다", () => {
    const stripped = createAssetBlobIndex().strip(row());
    const uploaded = (JSON.parse(stripped.folded) as { assets: { uploaded: Record<string, { dataUrl?: string }> } }).assets.uploaded;
    expect(uploaded.small!.dataUrl).toBe("data:image/png;base64,AAAA");
    expect(uploaded.ref!.dataUrl).toBeUndefined();
    expect(uploaded.big!.dataUrl).toBe(ASSET_BLOB_PREFIX + stripped.assetBlobShas[0]);
  });

  it("바이트 해시 힌트가 dataUrl 의 바이트와 맞는다", () => {
    const stripped = createAssetBlobIndex().strip(row());
    const hint = stripped.assetBlobHints[stripped.assetBlobShas[0]!]!;
    expect(hint.head).toBe("data:image/png;base64");
    expect(hint.bytesSha256).toBe(createHash("sha256").update(Buffer.from(png(3).split(",")[1]!, "base64")).digest("hex"));
  });

  it("본문이 없으면 되돌리지 않고 던진다 — 빈 그림으로 저장하지 않는다", () => {
    const stripped = createAssetBlobIndex().strip(row());
    expect(() => restoreAssetBlobs(JSON.parse(stripped.folded) as Record<string, unknown>, new Map())).toThrow("본문");
  });

  it("자산이 없는 행은 파싱 없이 그대로 준다", () => {
    const plain = JSON.stringify({ assets: { uploaded: {} }, tilesets: {} });
    expect(createAssetBlobIndex().strip(plain)).toEqual({ folded: plain, assetBlobShas: [], assetBlobHints: {} });
  });
});
