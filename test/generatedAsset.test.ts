import { describe, expect, it } from "vitest";
import { buildContactSheetMetadata, buildDryRunPathPlan, buildLiveAgyCommand, buildPromotionMetadata, createFakeGeneratedAsset, validateGeneratedAssetBytes } from "@/assets/generatedAssetHarness";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { createFakePngBytes } from "@/assets/pngFake";
import { validateGeneratedAssetManifest, type GeneratedAssetManifestInput } from "@/assets/generatedAssetManifest";
import { isolateTimers } from "./mergedTeardown";

describe("generatedAssetHarness", () => {
  isolateTimers();
  describe("generatedAssetHarness", () => {
    it("validates dry-run PNGs without re-promoting retired starter entries", async () => {
      const entry = GENERATED_ASSET_PLAN.assets[1];
      const plan = buildDryRunPathPlan(GENERATED_ASSET_PLAN, ".omo/evidence/oprn-generated-assets-execution/raw");
      const bytes = createFakeGeneratedAsset(entry);

      const validation = await validateGeneratedAssetBytes({ entry, path: plan[1]?.rawPath ?? "", bytes });
      const promotion = buildPromotionMetadata(entry, validation);
      const contactSheet = buildContactSheetMetadata(GENERATED_ASSET_PLAN);
      const command = buildLiveAgyCommand(entry, "C:/tmp/generated.png");

      expect(plan[1]?.rawPath).toMatch(/hero-01-charset-[0-9a-f]{8}\.png$/);
      expect(command).toContain("agy");
      expect(command.join(" ")).toContain("180s");
      expect(validation.ok).toBe(true);
      expect(validation.inspection?.width).toBe(288);
      expect(validation.inspection?.height).toBe(256);
      expect(validation.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(promotion).toBeNull();
      expect(contactSheet.cells).toHaveLength(GENERATED_ASSET_PLAN.assets.length);
    });

    it("rejects missing, non-PNG, wrong-size, blank, and unsafe generated outputs", async () => {
      const entry = GENERATED_ASSET_PLAN.assets.find((asset) => asset.id === "potion-red-icon");
      expect(entry).toBeDefined();
      if (!entry) return;
      const missing = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: null });
      const nonPng = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: new Uint8Array([1, 2, 3]) });
      const wrongSize = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: createFakePngBytes({ width: 64, height: 64 }) });
      const blank = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: createFakePngBytes({ width: 32, height: 32, blank: true }) });
      const unsafeName = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/output.png", bytes: createFakePngBytes({ width: 32, height: 32 }) });

      expect(missing.issues).toContain("file is missing");
      expect(nonPng.issues).toContain("file is not a PNG");
      expect(wrongSize.issues).toContain("PNG dimensions 64x64 do not match 32x32");
      expect(blank.issues).toContain("PNG appears blank");
      expect(unsafeName.issues).toContain("output path must be a unique generated PNG outside public/assets/easyrpg");
    });
  });
});

describe("generatedAssetManifest", () => {
  isolateTimers();
  describe("generatedAssetManifest", () => {
    it("accepts the planned Wave 1 RM2K3 asset batch when every target has contract metadata", () => {
      const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.manifest.assets.filter((entry) => entry.target === "actorFace")).toHaveLength(2);
        // hero-02-charset 는 나무 타일 무늬가 들어간 fake 승격본이라 뺐다. 남은 걷기 시트는 hero-01 하나.
        expect(result.manifest.assets.filter((entry) => entry.target === "actorCharset")).toHaveLength(1);
        // 4 → 6 (2026-08-29): 성직자·궁수 배틀러 추가. DB 액터 actor_cleric / actor_ranger 가
        // 여태 hero-02 / hero-01 시트를 돌려 써서 파티에 넣으면 같은 그림이 두 번 섰다.
        expect(result.manifest.assets.filter((entry) => entry.target === "actorBattleCharset")).toHaveLength(6);
        expect(result.manifest.assets.filter((entry) => entry.target === "enemyMonster")).toHaveLength(5);
        expect(result.manifest.assets.filter((entry) => entry.target === "itemImage" || entry.target === "itemIcon")).toHaveLength(4);
        expect(result.manifest.assets.filter((entry) => entry.target === "equipmentImage" || entry.target === "equipmentIcon")).toHaveLength(4);
        expect(result.manifest.assets.filter((entry) => entry.target === "troopPreview")).toHaveLength(1);
        expect(
          result.manifest.assets.every(
            (entry) =>
              entry.prompt.length > 0 &&
              (entry.provenance.generator === "agy" ||
                entry.provenance.generator === "imagegen" ||
                entry.provenance.generator === "grok" ||
                entry.provenance.generator === "native-pixel")
          )
        ).toBe(true);
        expect(result.manifest.assets.some((entry) => entry.provenance.generator === "imagegen")).toBe(true);
      }
    });

    it("rejects manifests with missing prompt, bad dimensions, or EasyRPG paths", () => {
      const invalid: GeneratedAssetManifestInput = {
        version: 1,
        assets: [
          {
            id: "bad-actor",
            target: "actorCharset",
            resourceKind: "charset",
            expectedDimensions: { width: 320, height: 240 },
            negativePrompt: "watermarks",
            status: "generated",
            rawPath: "public/assets/easyrpg/charset/output.png",
            resourceId: "bad-actor-resource",
            provenance: {
              generator: "agy",
              mode: "fake",
              promptVersion: "test",
              createdAt: "2026-06-22T00:00:00.000Z",
            },
          },
        ],
      };

      const result = validateGeneratedAssetManifest(invalid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.map((issue) => issue.field)).toContain("prompt");
        expect(result.issues.map((issue) => issue.field)).toContain("expectedDimensions");
        expect(result.issues.map((issue) => issue.field)).toContain("path");
      }
    });

    it("registers the historical enemy IDs with native source and portrait provenance", () => {
      const enemies = GENERATED_ASSET_PLAN.assets.filter((entry) => entry.target === "enemyMonster" || entry.target === "troopPreview");
      expect(enemies).toHaveLength(6);
      expect(enemies.every(entry => entry.provenance.generator === "native-pixel")).toBe(true);
      expect(enemies.every(entry => entry.rawPath?.includes("pixel-enemies/") && entry.promotedPath?.includes("pixel-enemy-portraits/"))).toBe(true);
    });

    it("retains starter battle charset provenance while rejecting their promotion", () => {
      const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // promptVersion 이 "+grok-row1-v1" 로 늘어난 이유: 2026-08-29 에 행 1(defend/dead)을 grok 으로
      // 그려 같은 PNG 에 병합했다. 행 0 은 여전히 번들 캐릭터셋 추출본이라 출처가 섞였고,
      // 스키마는 자산 하나에 생성 패스 하나를 전제하므로 그 사실을 문자열로 남긴다.
      const extractedAssets = result.manifest.assets.filter((asset) =>
        asset.provenance.promptVersion.startsWith("bundled-charset-extract-v1")
      );
      expect(extractedAssets.map((asset) => asset.id).sort()).toEqual([
        "hero-01-battle",
        "hero-02-battle",
        "hero-03-battle",
        "hero-04-battle",
      ]);
      expect(extractedAssets.every((asset) => asset.provenance.promptVersion.endsWith("+grok-row1-v1"))).toBe(true);
      expect(extractedAssets.every((asset) => asset.status === "rejected")).toBe(true);
      expect(extractedAssets.every((asset) => asset.promotedPath === null && asset.sha256 === null)).toBe(true);
    });
  });
});
