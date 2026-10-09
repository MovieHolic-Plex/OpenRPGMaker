import { describe, expect, it } from "vitest";
import { uploadedAssetForImport } from "@/editor/uploadedAssetStorage";
import { createMemoryRepository } from "@/project/persistence/memoryRepository";
import { createLocalRepositoryFixture, type LocalRepositoryFixture } from "./localStore/localRepositoryFixture";

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;

async function withLocalFixture(run: (fixture: LocalRepositoryFixture) => Promise<void>): Promise<void> {
  const fixture = await createLocalRepositoryFixture();
  try {
    await run(fixture);
  } finally {
    fixture.close();
  }
}

describe("uploadedAssetForImport", () => {
  it("자산 저장이 없는 어댑터는 dataUrl 을 문서에 넣는다", async () => {
    const repository = createMemoryRepository({ target: { url: "memory://contract", anonKey: "memory", projectId: "p1" } });

    const asset = await uploadedAssetForImport({
      repository,
      id: "asset_mem",
      name: "메모리 이미지",
      kind: "sprite",
      dataUrl: DATA_URL,
      meta: { width: 1, height: 1 },
    });

    expect(asset.dataUrl).toBe(DATA_URL);
    expect(asset.ref).toBeUndefined();
    expect(await repository.assets.list()).toHaveLength(0);
  });

  it("자산 저장이 있는 어댑터는 파일로 넣고 ref 만 문서에 남긴다", async () => {
    await withLocalFixture(async ({ repository }) => {
      const asset = await uploadedAssetForImport({
        repository,
        id: "asset_local",
        name: "로컬 이미지",
        kind: "sprite",
        dataUrl: DATA_URL,
        meta: { width: 1, height: 1 },
      });

      expect(asset.dataUrl).toBeUndefined();
      expect(asset.ref?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.ref?.extension).toBe("png");
      expect(asset.ref?.mime).toBe("image/png");
      expect(asset.ref?.bytes).toBe(PNG_BYTES.byteLength);

      const listed = await repository.assets.list();
      expect(listed.map((entry) => entry.sha256)).toEqual([asset.ref?.sha256]);
    });
  });
});