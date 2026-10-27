// 칩셋 계열 판정(src/project/tilesetFamily.ts). 같은 계열끼리는 조수가 말없이 바꿔도 되고, 다른 계열은 사용자 승인이 필요하다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { sameFamilyTilesets, tilesetFamily, tilesetFamilyLabel } from "@/project/tilesetFamily";
import type { Project, TilesetDef } from "@/project/types";
import { deserialize, serialize } from "@/project/io/serialize";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

function withUploaded(project: Project, id: string, extra: Partial<TilesetDef> = {}): Project {
  const base = Object.values(project.tilesets)[0]!;
  project.tilesets[id] = { ...structuredClone(base), id, name: `올린 ${id}`, image: { type: "uploaded", id: `asset_${id}` }, ...extra };
  delete project.tilesets[id]!.referenceDocuments;
  // 2026-10-07 저작권 정리: 새 프로젝트의 첫 타일셋은 beodeul_city(family oprn-atlas)라 복제본이 그 family 를 물려받는다 — 「family 없는 업로드」를 만들려면 지운다.
  if (!("family" in extra)) delete project.tilesets[id]!.family;
  delete project.tilesets[id]!.referenceSourceTilesetId;
  return project;
}

function bundledIds(project: Project, prefix: string): string[] {
  return Object.keys(project.tilesets).filter((id) => id.startsWith(prefix));
}

describe("tilesetFamily", () => {
  it("easyrpg 번들 둘은 같은 계열이고 이름은 EasyRPG", () => {
    // 2026-10-07 저작권 정리: 새 프로젝트에 EasyRPG 시트가 없다 — 옛 저장본처럼 은퇴 시트를 심어 계열 판정을 검증한다.
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    const [a, b] = bundledIds(project, "easyrpg_");
    expect(a && b).toBeTruthy();
    expect(tilesetFamily(project, a!)).toBe("easyrpg");
    expect(tilesetFamily(project, b!)).toBe("easyrpg");
    expect(tilesetFamilyLabel(project, "easyrpg")).toBe("EasyRPG");
  });

  it("forest_harmony 는 easyrpg 계열, 성채는 다른 계열", () => {
    // 2026-10-07 저작권 정리: 번들 forest_harmony·opengameart_castle 이 새 프로젝트에서 빠졌다. 계열은 id 로 판정하므로 같은 id 의 번들 칩셋을 합성해 계약을 유지한다.
    const project = createBlankProject();
    const base = Object.values(project.tilesets)[0]!;
    for (const [id, textureKey] of [["forest_harmony", "tex_forest_harmony"], ["opengameart_castle", "tex_opengameart_castle"]] as const) {
      project.tilesets[id] = { ...structuredClone(base), id, name: id, image: { type: "bundled", id: textureKey } };
      delete project.tilesets[id]!.family;
      delete project.tilesets[id]!.referenceDocuments;
      delete project.tilesets[id]!.referenceSourceTilesetId;
    }
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
    // 새 프로젝트의 beodeul_city 는 family 를 갖는다(2026-10-07 이후) — family 없는 옛 저장본은 그 필드를 지운 사본으로 재현한다.
    const old = createBlankProject();
    for (const tileset of Object.values(old.tilesets)) delete tileset.family;
    const legacy = deserialize(serialize(old));
    expect(Object.values(legacy.tilesets).some((t) => "family" in t)).toBe(false);
  });
});
