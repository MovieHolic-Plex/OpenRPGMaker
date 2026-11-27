// 칩셋 계열 판정(src/project/tilesetFamily.ts). 같은 계열끼리는 조수가 말없이 바꿔도 되고, 다른 계열은 사용자 승인이 필요하다.
import { describe, expect, it } from "vitest";
import { combinedTownTileset, createBlankProject } from "@/project/defaults";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { sameFamilyTilesets, tilesetFamily, tilesetFamilyLabel } from "@/project/tilesetFamily";
import type { Project, TilesetDef } from "@/project/types";
import { deserialize, serialize } from "@/project/io/serialize";

function withUploaded(project: Project, id: string, extra: Partial<TilesetDef> = {}): Project {
  // 새 프로젝트 첫 타일셋(버들항)은 family "oprn-atlas" 를 갖고 있어 업로드 사본이 그 계열을 물려받는다 — 계열 없는 합본 마을 정의를 바탕으로 쓴다(#5185).
  const base = project.tilesets.easyrpg_chipset_combined_town ?? combinedTownTileset();
  project.tilesets[id] = { ...structuredClone(base), id, name: `올린 ${id}`, image: { type: "uploaded", id: `asset_${id}` }, ...extra };
  delete project.tilesets[id]!.referenceDocuments;
  delete project.tilesets[id]!.referenceSourceTilesetId;
  return project;
}

/**
 * 새 프로젝트에는 EasyRPG·숲 조화·성채 번들이 더 이상 없다(시작 맵은 버들항, #5185). 계열 판정은 저장본에 남은
 * 그 칩셋들을 그대로 다뤄야 하므로, 옛 저장본처럼 그 칩셋을 갖춘 프로젝트를 만든다.
 */
function legacyBundledProject(): Project {
  const project = withRetiredEasyRpgTilesets(createBlankProject());
  const base = combinedTownTileset();
  project.tilesets.forest_harmony ??= { ...structuredClone(base), id: "forest_harmony", name: "숲 조화", image: { type: "bundled", id: "tex_forest_harmony" } };
  project.tilesets.opengameart_castle ??= { ...structuredClone(base), id: "opengameart_castle", name: "성채", image: { type: "bundled", id: "tex_opengameart_castle" } };
  return project;
}

function bundledIds(project: Project, prefix: string): string[] {
  return Object.keys(project.tilesets).filter((id) => id.startsWith(prefix));
}

describe("tilesetFamily", () => {
  it("easyrpg 번들 둘은 같은 계열이고 이름은 EasyRPG", () => {
    const project = legacyBundledProject();
    const [a, b] = bundledIds(project, "easyrpg_");
    expect(a && b).toBeTruthy();
    expect(tilesetFamily(project, a!)).toBe("easyrpg");
    expect(tilesetFamily(project, b!)).toBe("easyrpg");
    expect(tilesetFamilyLabel(project, "easyrpg")).toBe("EasyRPG");
  });

  it("forest_harmony 는 easyrpg 계열, 성채는 다른 계열", () => {
    const project = legacyBundledProject();
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
    // 지금 번들(버들항 등)은 family 를 갖고 태어난다 — 옛 저장본처럼 family 를 지운 뒤 왕복해 «없는 채로 읽힌다»를 본다.
    const old = createBlankProject();
    for (const tileset of Object.values(old.tilesets)) delete (tileset as { family?: string }).family;
    const legacy = deserialize(serialize(old));
    expect(Object.values(legacy.tilesets).some((t) => "family" in t)).toBe(false);
  });
});
