// 가져오기 직후 새 리소스가 어디에 있는지 보여야 한다.
//
// 목록은 기본 포함 리소스(캐릭셋만 40여 줄) 뒤에 업로드분을 덧붙이고, 가져오기 후 목록을
// 통째로 다시 그리면서 스크롤이 맨 위로 돌아간다. 그래서 "가져오기 완료" 토스트만 뜨고
// 목록은 그대로인 것처럼 보였다 — 방금 넣은 줄을 짚어 주고 화면 안으로 끌어와야 한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderResourceWorkbench } from "@/editor/panels/resourceManagerViews";
import type { UploadedAsset } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement, type FakeNode } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

const ASSET_ID = "charset_img_reveal";

function charsetAsset(id: string): UploadedAsset {
  return {
    id,
    name: `teal-${id}`,
    kind: "charset",
    dataUrl: "data:image/png;base64,AAAA",
    meta: { tileSize: 24, frames: 96, frameWidth: 24, frameHeight: 32, width: 288, height: 256 },
  } as UploadedAsset;
}

function renderWorkbench(recentAssetId?: string): { root: FakeNode; scrolled: string[] } {
  const scrolled: string[] = [];
  const container = document.createElement("div");
  document.body.append(container);
  const uploaded = [charsetAsset("charset_img_old"), charsetAsset(ASSET_ID)];
  renderResourceWorkbench(container, {
    categories: [{ kind: "charset", label: "캐릭터셋" }],
    selectedKind: "charset",
    profiles: [],
    uploaded,
    kindSelect: document.createElement("select") as HTMLSelectElement,
    fileInput: document.createElement("input") as HTMLInputElement,
    actions: { addTileset: () => {}, applyTileset: () => {}, deleteAsset: () => {} },
    onSelectKind: () => {},
    onImport: () => {},
    ...(recentAssetId === undefined ? {} : { recentAssetId }),
  });
  const root = container as unknown as FakeNode;
  for (const asset of uploaded) {
    const row = findByTestId(root, `resource-upload-${asset.id}`);
    if (!row) continue;
    (row as unknown as { scrollIntoView: () => void }).scrollIntoView = () => scrolled.push(asset.id);
  }
  return { root, scrolled };
}

describe("resource manager import reveal", () => {
  it("marks the just-imported row so it stands out from the bundled list", () => {
    const { root } = renderWorkbench(ASSET_ID);

    const fresh = findByTestId(root, `resource-upload-${ASSET_ID}`) as FakeElement | null;
    const older = findByTestId(root, "resource-upload-charset_img_old") as FakeElement | null;
    expect(fresh?.dataset.recent).toBe("true");
    expect(older?.dataset.recent).toBeUndefined();
  });

  it("leaves every row unmarked when nothing was just imported", () => {
    const { root } = renderWorkbench();

    const fresh = findByTestId(root, `resource-upload-${ASSET_ID}`) as FakeElement | null;
    expect(fresh?.dataset.recent).toBeUndefined();
  });

  it("scrolls the just-imported row into view", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const uploaded = [charsetAsset("charset_img_old"), charsetAsset(ASSET_ID)];
    const scrolled: string[] = [];
    // scrollIntoView 는 렌더 도중 불리므로 프로토타입에서 가로챈다.
    const proto = Object.getPrototypeOf(container) as { scrollIntoView: () => void };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = function patched(this: { dataset?: Record<string, string> }): void {
      scrolled.push(this.dataset?.recent === "true" ? "recent" : "other");
    };
    try {
      renderResourceWorkbench(container, {
        categories: [{ kind: "charset", label: "캐릭터셋" }],
        selectedKind: "charset",
        profiles: [],
        uploaded,
        kindSelect: document.createElement("select") as HTMLSelectElement,
        fileInput: document.createElement("input") as HTMLInputElement,
        actions: { addTileset: () => {}, applyTileset: () => {}, deleteAsset: () => {} },
        onSelectKind: () => {},
        onImport: () => {},
        recentAssetId: ASSET_ID,
      });
    } finally {
      proto.scrollIntoView = original;
    }

    expect(scrolled).toEqual(["recent"]);
  });
});
