import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { canonicalResourceProfileId, dedupeListedProfiles } from "@/editor/panels/resourceManagerUtils";
import { defaultResourceProfiles } from "@/project/defaults/defaultAssets";
import type { ResourceProfile, UploadedAsset } from "@/project/types";
import { decideImageDataUrl, decideImageImport, formatImageImportDimensionError, formatImageImportSizeError } from "@/editor/panels/resourceManagerImageImport";
import { renderResourceWorkbench } from "@/editor/panels/resourceManagerViews";
import { findByTestId, installFakeDom, type FakeElement, type FakeNode } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("resourceManagerDedup", () => {
  isolateTimers();
  const upload = (id: string, kind: UploadedAsset["kind"]): UploadedAsset => ({
    id,
    name: id,
    kind,
    dataUrl: "data:image/png;base64,x",
    meta: {},
  });
  const profile = (kind: ResourceProfile["kind"], assetId: string | undefined, name = assetId ?? "anonymous"): ResourceProfile =>
    assetId === undefined ? { kind, name } : { kind, name, assetId };
  describe("리소스 관리자 목록 중복 제거", () => {
    // EasyRPG 칩셋 시트(easyrpg-chipset-*)는 2026-10-07 저작권 정리(PR #2335)로 번들에서 빠졌다.
    // 접을 칩셋 별칭이 더는 없으므로, 기본 목록에 별칭 칩셋 카드가 남지 않는지만 본다.
    it("기본 프로젝트의 칩셋 목록에 easyrpg-chipset-* 별칭 카드가 남지 않는다", () => {
      const all = defaultResourceProfiles();
      const chipsets = dedupeListedProfiles(all, []).filter((p) => p.kind === "chipset");
      expect(chipsets.filter((p) => p.assetId?.startsWith("easyrpg-chipset-"))).toEqual([]);
      expect(chipsets.some((p) => p.assetId === "tex_beodeul_city")).toBe(true);
    });

    it("캐릭터셋도 같은 시트의 RTP id 별칭이 접히고 정본 프로필만 남는다", () => {
      const all = defaultResourceProfiles();
      const visible = dedupeListedProfiles(all, []).filter((p) => p.kind === "charset");
      expect(all.filter((p) => p.kind === "charset").some((p) => p.assetId === "easyrpg-charset-actor1")).toBe(true);
      expect(visible.some((p) => p.assetId?.startsWith("easyrpg-charset-"))).toBe(false);
      expect(visible.some((p) => p.assetId === "tex_easyrpg_charset_actor1")).toBe(true);
      // 데이터에서 프로필을 지우지 않는다 — 목록만 접는다.
      expect(visible.length).toBeLessThan(all.filter((p) => p.kind === "charset").length);
    });

    it("업로드 자산과 같은 assetId 를 가진 프로필은 업로드 카드가 대신 보인다", () => {
      const profiles = [
        profile("chipset", "my-upload", "업로드와 겹침"),
        profile("chipset", "tex_easyrpg_chipset_dungeon"),
      ];
      const visible = dedupeListedProfiles(profiles, [upload("my-upload", "tileset")]);
      expect(visible.map((p) => p.assetId)).toEqual(["tex_easyrpg_chipset_dungeon"]);
    });

    it("정본 프로필이 없는 별칭 프로필만 있는 프로젝트는 그대로 보인다", () => {
      const profiles = [profile("chipset", "easyrpg-chipset-dungeon")];
      const visible = dedupeListedProfiles(profiles, []);
      expect(visible).toHaveLength(1);
      expect(visible[0]?.assetId).toBe("easyrpg-chipset-dungeon");
    });

    it("assetId 없는 프로필은 서로 다른 항목으로 유지된다", () => {
      const profiles = [profile("chipset", undefined, "수작업 칩셋 A"), profile("chipset", undefined, "수작업 칩셋 B")];
      expect(dedupeListedProfiles(profiles, [])).toHaveLength(2);
    });

    it("canonicalResourceProfileId 는 캐릭터셋 별칭을 번들 텍스처 키로 접는다", () => {
      // 칩셋 별칭의 번들 시트는 PR #2335 로 삭제됐다 — 접을 대상이 없으면 id 를 그대로 둔다.
      expect(canonicalResourceProfileId("easyrpg-chipset-dungeon")).toBe("easyrpg-chipset-dungeon");
      expect(canonicalResourceProfileId("easyrpg-charset-actor1")).toBe("tex_easyrpg_charset_actor1");
      expect(canonicalResourceProfileId("tex_easyrpg_chipset_dungeon")).toBe("tex_easyrpg_chipset_dungeon");
      expect(canonicalResourceProfileId("custom-upload")).toBe("custom-upload");
    });
  });
});

describe("resourceManagerImageImport", () => {
  isolateTimers();
  describe("decideImageImport", () => {
    it("accepts png and jpeg without normalization", () => {
      expect(
        decideImageImport({ fileName: "tile.png", mimeType: "image/png", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "png", normalizeToPng: false });
      expect(
        decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "jpeg", normalizeToPng: false });
    });

    it("accepts webp and gif with PNG normalization", () => {
      expect(
        decideImageImport({ fileName: "shot.webp", mimeType: "image/webp", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      expect(
        decideImageImport({ fileName: "anim.gif", mimeType: "image/gif", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "gif", normalizeToPng: true });
    });

    it("rejects oversize files with actual size and the 4MB limit", () => {
      const decision = decideImageImport({
        fileName: "big.png",
        mimeType: "image/png",
        sizeBytes: 6 * 1024 * 1024,
      });
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.reason).toBe("size");
        expect(decision.message).toContain("6.0MB");
        expect(decision.message).toContain("4MB");
      }
    });

    it("rejects unsupported formats naming the actual type", () => {
      const decision = decideImageImport({
        fileName: "icon.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 100,
      });
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.reason).toBe("format");
        expect(decision.message).toContain("image/svg+xml");
      }
    });

    it("falls back to extension when MIME is empty", () => {
      expect(
        decideImageImport({ fileName: "shot.webp", mimeType: "", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
    });

    it("falls back to extension for generic octet-stream MIME", () => {
      expect(
        decideImageImport({ fileName: "tile.png", mimeType: "application/octet-stream", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "png", normalizeToPng: false });
      expect(
        decideImageImport({ fileName: "shot.webp", mimeType: "application/octet-stream", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
    });

    it("prefers MIME over a conflicting extension for image types", () => {
      expect(
        decideImageImport({ fileName: "renamed-svg.png", mimeType: "image/svg+xml", sizeBytes: 100 }).ok
      ).toBe(false);
      expect(
        decideImageImport({ fileName: "photo.webp", mimeType: "image/png", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "png", normalizeToPng: false });
    });

    it("accepts uppercase extensions", () => {
      expect(
        decideImageImport({ fileName: "SHOT.WEBP", mimeType: "", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
    });

    it("normalizes the non-standard image/jpg alias to PNG", () => {
      expect(
        decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpg", sizeBytes: 100 })
      ).toEqual({ ok: true, format: "jpeg", normalizeToPng: true });
    });
  });
  describe("decideImageDataUrl", () => {
    it("passes png/jpeg data URLs through", () => {
      const decision = decideImageDataUrl("data:image/png;base64,AAAA");
      expect(decision).toEqual({ ok: true, format: "png", normalizeToPng: false });
    });

    it("flags webp/gif data URLs for normalization", () => {
      expect(decideImageDataUrl("data:image/webp;base64,AAAA")).toEqual({
        ok: true,
        format: "webp",
        normalizeToPng: true,
      });
    });

    it("follows the file-level decision for empty or generic data-URL headers", () => {
      expect(
        decideImageDataUrl("data:;base64,AAAA", { format: "webp", normalizeToPng: true })
      ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      // 일반 헤더는 파일 판정이 png 여도 PNG 로 다시 그린다 — 그대로 저장하면
      // safeUploadedResourceUrl 화이트리스트에 걸려 플레이에서 보이지 않는다.
      expect(
        decideImageDataUrl("data:application/octet-stream;base64,AAAA", { format: "png", normalizeToPng: false })
      ).toEqual({ ok: true, format: "png", normalizeToPng: true });
    });

    it("still rejects non-image data URLs without a fallback", () => {
      const decision = decideImageDataUrl("data:;base64,AAAA");
      expect(decision.ok).toBe(false);
    });

    it("normalizes the image/jpg data-URL alias", () => {
      expect(decideImageDataUrl("data:image/jpg;base64,AAAA")).toEqual({
        ok: true,
        format: "jpeg",
        normalizeToPng: true,
      });
    });
  });
  describe("error message helpers", () => {
    it("shows actual megabytes in size errors", () => {
      const message = formatImageImportSizeError(2.5 * 1024 * 1024);
      expect(message).toContain("2.5MB");
      expect(message).toContain("4MB");
    });

    it("appends actual dimensions when the validator message lacks them", () => {
      const withDims = formatImageImportDimensionError("칩셋: 16x16 단위", 20, 20);
      expect(withDims).toContain("20x20");
      const already = formatImageImportDimensionError("필요 16x16, 현재 20x20", 20, 20);
      expect(already).toBe("필요 16x16, 현재 20x20");
    });
  });
});

// 가져오기 직후 새 리소스가 어디에 있는지 보여야 한다.
//
// 목록은 기본 포함 리소스(캐릭셋만 40여 줄) 뒤에 업로드분을 덧붙이고, 가져오기 후 목록을
// 통째로 다시 그리면서 스크롤이 맨 위로 돌아간다. 그래서 "가져오기 완료" 토스트만 뜨고
// 목록은 그대로인 것처럼 보였다 — 방금 넣은 줄을 짚어 주고 화면 안으로 끌어와야 한다.
describe("resourceManagerRevealImport", () => {
  isolateTimers();
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
});
