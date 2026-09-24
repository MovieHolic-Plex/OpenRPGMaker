// 조수에게 타일셋을 가르치는 장치가 조용히 빠지지 않게 막는 가드. 배경: openwiki/teaching-assistant-tilesets.md
// 조수는 타일셋 그림을 보지 않고 참고문서·이름표만 보고 깐다. 그리고 참고문서 선행 읽기 게이트는
// TILESET_REFERENCE_TILE_CHOOSERS 에 든 도구에만, 참고문서가 있는 타일셋에서만 걸린다.
// 둘 중 하나라도 빠지면 조수는 뜻 모르는 번호를 칠하는데, 어떤 테스트도 그걸 잡지 못했다(2026-09-24).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { allTools } from "@/editor/tools/toolRegistry";
import { TILESET_REFERENCE_TILE_CHOOSERS } from "@/editor/tools/tilesetReferenceTools";
import { referenceOwner } from "@/project/tilesetReferences";
import type { JsonSchema } from "@/editor/tools/types";

// 모델이 칸을 직접 고르는 인자 — 타일 번호, 재료 이름, 조립법·팔레트·템플릿 이름.
const TILE_CHOICE_ARG = /^(tile|tiles|tileId|tileIds|material|materials|recipeId|presetId|paletteRole|template)$/;

// 위 인자를 받지만 실제 칸은 코드가 고르는 도구. 이름은 프리셋·템플릿 선택일 뿐이라 게이트 대상이 아니다.
const CODE_PICKS_TILES = new Set(["author_village", "place_concept", "place_storage_chest"]);

// 번들인데 아직 참고문서가 없는 타일셋(2026-09-24 실측). 여기서 **빼는 것만** 허용한다 —
// 새 번들 타일셋은 참고문서를 들고 태어나야 한다(AGENTS 「새 타일·타일 학습은 공용에 추가한다」).
const BUNDLED_WITHOUT_REFERENCES = new Set([
  "easyrpg_chipset_combined_town",
  "easyrpg_chipset_interior",
  "easyrpg_chipset_ship",
  "easyrpg_chipset_world",
  "easyrpg_chipset_retro_dungeon",
  "easyrpg_chipset_retro_exterior",
  "easyrpg_chipset_retro_house",
  "easyrpg_chipset_retro_world",
  "easyrpg_chipset_combined_town_retro_world",
  "modern_exteriors_nocturne",
  "slates_32",
  "opengameart_lpc_wooden_furniture",
  "opengameart_lpc_wooden_furniture_16",
  "scarloxy_chipset_grassland",
  "scarloxy_chipset_wilds",
  "scarloxy_chipset_indoor",
]);

function argNames(schema: JsonSchema | undefined, out = new Set<string>(), depth = 0): Set<string> {
  if (!schema || depth > 4) return out;
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    out.add(name);
    argNames(child, out, depth + 1);
  }
  if (schema.items) argNames(schema.items, out, depth + 1);
  return out;
}

describe("tileset teaching guards", () => {
  it("every map tool that lets the model pick tiles is behind the reference gate", () => {
    const ungated = allTools()
      .filter(tool => tool.mode === "write" && tool.deprecated !== true)
      .filter(tool => {
        const names = argNames(tool.parameters);
        return names.has("mapId") && [...names].some(name => TILE_CHOICE_ARG.test(name));
      })
      .map(tool => tool.name)
      .filter(name => !TILESET_REFERENCE_TILE_CHOOSERS.has(name) && !CODE_PICKS_TILES.has(name));
    // 실패하면: 새 칠하기 도구를 tilesetReferenceTools.ts 의 TILESET_REFERENCE_TILE_CHOOSERS 에 넣거나,
    // 코드가 칸을 고르는 도구라면 위 CODE_PICKS_TILES 에 이유와 함께 넣는다.
    expect(ungated).toEqual([]);
  });

  it("the gate list names only tools that exist", () => {
    const names = new Set(allTools().map(tool => tool.name));
    expect([...TILESET_REFERENCE_TILE_CHOOSERS].filter(name => !names.has(name))).toEqual([]);
    expect([...CODE_PICKS_TILES].filter(name => !names.has(name))).toEqual([]);
  });

  it("new bundled tilesets carry reference documents", () => {
    const project = createBlankProject();
    const bundled = Object.values(project.tilesets).filter(tileset => tileset.image.type === "bundled");
    const hasReferences = (id: string) => {
      const tileset = project.tilesets[id]!;
      return (referenceOwner(project, tileset).referenceDocuments ?? []).length > 0;
    };
    // 실패하면: 새 번들 타일셋에 참고문서를 붙인다(openwiki/teaching-assistant-tilesets.md 점검표).
    expect(bundled.map(t => t.id).filter(id => !hasReferences(id) && !BUNDLED_WITHOUT_REFERENCES.has(id))).toEqual([]);
    // 실패하면: 참고문서가 생긴 타일셋을 BUNDLED_WITHOUT_REFERENCES 에서 뺀다(목록은 줄어들기만 한다).
    expect([...BUNDLED_WITHOUT_REFERENCES].filter(id => project.tilesets[id] && hasReferences(id))).toEqual([]);
  });
});
