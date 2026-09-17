import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { listCharacterFaces, listCharacterSprites, updateCharacterSprite } from "@/project/characterGraphics";
import { rankCharacterFaces } from "@/project/characterFaceCandidates";
import { reviewedCharsetFace } from "@/assets/charsetFaceMap";

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
});
