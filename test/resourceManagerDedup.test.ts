import { describe, expect, it } from "vitest";
import { canonicalResourceProfileId, dedupeListedProfiles } from "@/editor/panels/resourceManagerUtils";
import { defaultResourceProfiles } from "@/project/defaults/defaultAssets";
import type { ResourceProfile, UploadedAsset } from "@/project/types";

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
  it("기본 프로젝트의 칩셋 목록에서 easyrpg-chipset-* 별칭이 번들 텍스처 키 카드 아래로 접힌다", () => {
    const all = defaultResourceProfiles();
    const visible = dedupeListedProfiles(all, []);
    const chipsets = visible.filter((p) => p.kind === "chipset");
    expect(all.filter((p) => p.kind === "chipset").some((p) => p.assetId === "easyrpg-chipset-dungeon")).toBe(true);
    expect(chipsets.filter((p) => p.assetId?.startsWith("easyrpg-chipset-")).map((p) => p.assetId)).toEqual([
      // tex_tiles_default 는 프로필로 등록되지 않는 런타임 텍스처 키라 exterior 는 별칭 프로필이 유일한 카드다.
      "easyrpg-chipset-exterior",
    ]);
    expect(chipsets.some((p) => p.assetId === "tex_easyrpg_chipset_dungeon")).toBe(true);
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

  it("canonicalResourceProfileId 는 칩셋·캐릭터셋 별칭을 번들 텍스처 키로 접는다", () => {
    expect(canonicalResourceProfileId("easyrpg-chipset-dungeon")).toBe("tex_easyrpg_chipset_dungeon");
    expect(canonicalResourceProfileId("easyrpg-chipset-exterior")).toBe("tex_tiles_default");
    expect(canonicalResourceProfileId("easyrpg-charset-actor1")).toBe("tex_easyrpg_charset_actor1");
    expect(canonicalResourceProfileId("tex_easyrpg_chipset_dungeon")).toBe("tex_easyrpg_chipset_dungeon");
    expect(canonicalResourceProfileId("custom-upload")).toBe("custom-upload");
  });
});
