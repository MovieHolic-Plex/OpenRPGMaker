// 칩셋 계열 판정(src/project/tilesetFamily.ts). 같은 계열끼리는 조수가 말없이 바꿔도 되고, 다른 계열은 사용자 승인이 필요하다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { sameFamilyTilesets, tilesetFamily, tilesetFamilyLabel } from "@/project/tilesetFamily";
import type { Project, TilesetDef } from "@/project/types";
import { deserialize, serialize } from "@/project/io/serialize";

function withUploaded(project: Project, id: string, extra: Partial<TilesetDef> = {}): Project {
  const base = project.tilesets.easyrpg_chipset_combined_town ?? Object.values(project.tilesets)[0]!;
  project.tilesets[id] = { ...structuredClone(base), id, name: `올린 ${id}`, image: { type: "uploaded", id: `asset_${id}` }, ...extra };
  delete project.tilesets[id]!.referenceDocuments;
  delete project.tilesets[id]!.referenceSourceTilesetId;
  return project;
}

function bundledIds(project: Project, prefix: string): string[] {
  return Object.keys(project.tilesets).filter((id) => id.startsWith(prefix));
}

describe("tilesetFamily", () => {
  it("easyrpg 번들 둘은 같은 계열이고 이름은 EasyRPG", () => {
    const project = createBlankProject();
    const [a, b] = bundledIds(project, "easyrpg_");
    expect(a && b).toBeTruthy();
    expect(tilesetFamily(project, a!)).toBe("easyrpg");
    expect(tilesetFamily(project, b!)).toBe("easyrpg");
    expect(tilesetFamilyLabel(project, "easyrpg")).toBe("EasyRPG");
  });

  it("forest_harmony 는 easyrpg 계열, 성채는 다른 계열", () => {
    const project = createBlankProject();
    expect(tilesetFamily(project, "forest_harmony")).toBe("easyrpg");
    const castle = bundledIds(project, "opengameart_castle")[0];
    expect(castle).toBeTruthy();
    expect(tilesetFamily(project, castle!)).toBe("castle");
    expect(tilesetFamily(project, castle!)).not.toBe(tilesetFamily(project, "forest_harmony"));
  });

  it("family 없는 업로드 타일셋은 uploaded:<id>, 이름은 그 칩셋 이름", () => {
    const project = withUploaded(createBlankProject(), "pack");
    expect(tilesetFamily(project, "pack")).toBe("uploaded:pack");
    expect(tilesetFamilyLabel(project, "uploaded:pack")).toBe("올린 pack");
    expect(sameFamilyTilesets(project, "uploaded:pack").map((t) => t.id)).toEqual(["pack"]);
  });

  it("업로드 둘이 같은 family 면 같은 계열", () => {
    const project = withUploaded(withUploaded(createBlankProject(), "field", { family: "rasak-fantasy" }), "cave", { family: "rasak-fantasy" });
    expect(tilesetFamily(project, "field")).toBe("rasak-fantasy");
    expect(tilesetFamily(project, "cave")).toBe("rasak-fantasy");
    expect(tilesetFamilyLabel(project, "rasak-fantasy")).toBe("Rasak Fantasy");
    expect(sameFamilyTilesets(project, "rasak-fantasy").map((t) => t.id).sort()).toEqual(["cave", "field"]);
  });

  it("파생(referenceSourceTilesetId) 은 원본 계열을 따른다", () => {
    const project = withUploaded(withUploaded(createBlankProject(), "root", { family: "rasak-fantasy" }), "child");
    project.tilesets.child!.referenceSourceTilesetId = "root";
    expect(tilesetFamily(project, "child")).toBe("rasak-fantasy");
    const plain = withUploaded(withUploaded(createBlankProject(), "root2"), "child2");
    plain.tilesets.child2!.referenceSourceTilesetId = "root2";
    expect(tilesetFamily(plain, "child2")).toBe("uploaded:root2");
  });

  it("없는 id 는 unknown:<id>", () => {
    expect(tilesetFamily(createBlankProject(), "nope")).toBe("unknown:nope");
  });

  it("family 는 저장 왕복에서 유지되고, 없는 옛 프로젝트는 그대로 읽힌다", () => {
    const project = withUploaded(createBlankProject(), "pack", { family: "rasak-fantasy" });
    const loaded = deserialize(serialize(project));
    expect(loaded.tilesets.pack?.family).toBe("rasak-fantasy");
    const legacy = deserialize(serialize(createBlankProject()));
    expect(Object.values(legacy.tilesets).some((t) => "family" in t)).toBe(false);
  });
});
