import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { listCharacterFaces, listCharacterSprites, seedGraphicAttributes, updateCharacterSprite } from "@/project/characterGraphics";
import { isRecommendedCharacterFace, rankCharacterFaces } from "@/project/characterFaceCandidates";
import { faceGraphicForCharset, npcFaceGraphic, reviewedCharsetFace } from "@/assets/charsetFaceMap";

describe("character face evidence", () => {
  it("uses written semantic age and gender without saving or borrowing paired-face traits", () => {
    const project = createBlankProject();
    const before = JSON.stringify(project);
    const nun = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people2" && row.characterIndex === 1)!;
    expect(nun.attributes).toMatchObject({ age: "노년", gender: "여성", role: "수녀" });
    expect(listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-people1-00")?.label).toBe("갈색 단발 소년");
    expect(JSON.stringify(project)).toBe(before);
    updateCharacterSprite(project, { ...nun, attributes: {} });
    expect(listCharacterSprites(project).find((row) => row.textureKey === nun.textureKey && row.characterIndex === 1)?.attributes).toEqual({});
  });

  it("uses reviewed human correspondences without treating NPC fallback or monster indices as exact", () => {
    expect(reviewedCharsetFace("tex_easyrpg_charset_people3", 0)?.resourceId).toBe("easyrpg-faceset-people2-00");
    expect(reviewedCharsetFace("tex_easyrpg_charset_people1", 4)?.approximate).toBe(true);
    expect(reviewedCharsetFace("tex_easyrpg_charset_people2", 1)).toBeNull();
    expect(reviewedCharsetFace("tex_easyrpg_charset_monster2", 1)).toBeNull();
    expect(reviewedCharsetFace("tex_easyrpg_charset_actor1", 8)).toBeNull();
  });

  it("ranks known correspondence first and exposes contradictory written attributes", () => {
    const project = createBlankProject();
    const sprite = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people1" && row.characterIndex === 0)!;
    const ranked = rankCharacterFaces(sprite, listCharacterFaces(project));
    expect(ranked[0]?.face.resourceId).toBe("easyrpg-faceset-people1-00");
    expect(ranked.find((candidate) => candidate.face.resourceId === "easyrpg-faceset-people1-07")?.conflicts).toContain("나이: 어린이 ↔ 노년");
    expect(sprite.faceResourceId).toBeNull();
  });
  it("uses both halves of each actor face sheet in editor and NPC tool paths", () => {
    const pairs = [["actor1", "actor1", 0], ["actor2", "actor1", 8], ["actor3", "actor2", 0], ["actor4", "actor2", 8]] as const;
    for (const [charset, faceset, offset] of pairs) for (let slot = 0; slot < 8; slot++) {
      const expected = `easyrpg-faceset-${faceset}-${String(slot + offset).padStart(2, "0")}`;
      const texture = `tex_easyrpg_charset_${charset}`;
      expect(reviewedCharsetFace(texture, slot)?.resourceId).toBe(expected);
      expect(faceGraphicForCharset(texture, slot)?.resourceId).toBe(expected);
      expect(npcFaceGraphic(`easyrpg-charset-${charset}`, slot)?.resourceId).toBe(expected);
    }
  });

  it("does not recommend children for unknown age or claim a pair from gender alone", () => {
    const project = createBlankProject();
    const gentleman = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people2" && row.characterIndex === 0)!;
    const ranked = rankCharacterFaces(gentleman, listCharacterFaces(project));
    expect(ranked.find((candidate) => candidate.face.resourceId === "easyrpg-faceset-people1-00")?.recommendation).toBe("conflict");
    expect(ranked.filter(isRecommendedCharacterFace).some((candidate) => candidate.face.attributes.age === "어린이")).toBe(false);
    const broadMatch = { resourceId: "test-face", label: "남성", attributes: { kind: "사람", gender: "남성" }, note: "" };
    expect(rankCharacterFaces(gentleman, [broadMatch])[0]?.recommendation).toBe("none");
  });

  it("vetoes reviewed-table priority when independent authored traits contradict it", () => {
    const project = createBlankProject();
    const boy = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people1" && row.characterIndex === 0)!;
    const face = listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-people1-00")!;
    const result = rankCharacterFaces(boy, [{ ...face, attributes: { ...face.attributes, gender: "여성" } }])[0]!;
    expect(result.recommendation).toBe("conflict");
    expect(result.score).toBeLessThan(100);
    expect(isRecommendedCharacterFace(result)).toBe(false);
  });

  it("reads face source descriptions independently and does not read a white headband as white hair", () => {
    const project = createBlankProject();
    const face = listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-actor2-05")!;
    expect(face.label).toBe("청록 머리 여성");
    expect(face.attributes.gender).toBe("여성");
    const fighter = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_actor3" && row.characterIndex === 5)!;
    expect(rankCharacterFaces(fighter, [face])[0]?.recommendation).toBe("conflict");
    expect(seedGraphicAttributes("흰 머리띠 여성").hair).toBeUndefined();
  });

});
