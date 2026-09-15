import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { applyCharacterGraphicsImport, exportCharacterGraphics, listCharacterSprites, listCharacterFaces, NPC_FACE_MAPPING_SCHEMA, parseCharacterGraphicsImport, seedGraphicAttributes } from "@/project/characterGraphics";

const textureKey = "tex_easyrpg_charset_people1";
const faceResourceId = "easyrpg-faceset-actor2-15";
const row = (characterIndex = 0) => ({ textureKey, characterIndex, label: "수정한 이름", note: "수동 검토", status: "pending", faceResourceId: null });
// 2026-09 제품명 스윕 전 카탈로그가 내보낸 v1 문서 — schema id 가 옛 이름이다. 사용자 디스크의 그 파일이 계속 열려야 하므로
// 이 fixture 는 일부러 옛 id 를 든다(옛 id 수용 검사). 새 id 는 아래 "schema id" 테스트가 고정한다.
const documentV1 = (mappings: unknown[]) => ({ schema: "rpg-zzu-npc-face-mapping", version: 1, sourceCommit: "old-catalog", mappings });

describe("character graphics metadata", () => {
  it("imports pending labels independently, preserves explicit no-face and exact mapped IDs through project reload", () => {
    const project = createBlankProject();
    const events = JSON.stringify(project.maps);
    applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1([
      row(), { ...row(1), status: "no-face" }, { ...row(2), status: "mapped", faceResourceId },
    ]), project));
    const loaded = deserialize(serialize(project));
    const sprites = listCharacterSprites(loaded).filter((sprite) => sprite.textureKey === textureKey);
    expect(sprites[0]).toMatchObject({ label: "수정한 이름", status: "pending", faceResourceId: null, note: "수동 검토", quality: "unspecified" });
    expect(sprites[1]).toMatchObject({ status: "no-face", faceResourceId: null });
    expect(sprites[2]).toMatchObject({ status: "mapped", faceResourceId });
    expect(loaded.charsetLabels?.find((entry) => entry.characterIndex === 0 && entry.textureKey === textureKey)?.label).toBe("수정한 이름");
    expect(JSON.stringify(project.maps)).toBe(events);
  });

  it("exports the oprn schema id, re-imports it, still accepts the legacy id, and rejects anything else", () => {
    const project = createBlankProject();
    const exported = exportCharacterGraphics(project);
    expect(NPC_FACE_MAPPING_SCHEMA).toBe("oprn-npc-face-mapping");
    expect(exported.schema).toBe("oprn-npc-face-mapping");
    expect(() => parseCharacterGraphicsImport(exported, project)).not.toThrow();
    expect(() => parseCharacterGraphicsImport({ ...exported, schema: "rpg-zzu-npc-face-mapping" }, project)).not.toThrow();
    expect(() => parseCharacterGraphicsImport(documentV1([row()]), project)).not.toThrow();
    expect(() => parseCharacterGraphicsImport({ ...exported, schema: "someone-elses-mapping" }, project)).toThrow();
  });

  it("rejects a bad final row or duplicate before any mutation", () => {
    const project = createBlankProject();
    const before = serialize(project);
    for (const rows of [
      [row(), { ...row(1), status: "mapped", faceResourceId: "unknown-face" }],
      [row(), row()],
      [{ ...row(), characterIndex: 8 }],
      [{ ...row(), status: "no-face", faceResourceId }],
      [{ ...row(), quality: "invented" }],
    ]) {
      expect(() => applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1(rows), project))).toThrow();
      expect(serialize(project)).toBe(before);
    }
  });

  it("roundtrips v2 independent attributes and keeps unspecified quality", () => {
    const project = createBlankProject();
    const payload = { ...documentV1([{ ...row(), attributes: { skin: "어두운", role: "상인" }, quality: "unspecified" }]), version: 2,
      faces: [{ resourceId: faceResourceId, label: "직접 고친 얼굴", note: "얼굴 메모", attributes: { skin: "밝은", hair: "금발" } }] };
    applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(payload, project));
    const exported = exportCharacterGraphics(deserialize(serialize(project)));
    expect(exported.mappings.find((entry) => entry.textureKey === textureKey && entry.characterIndex === 0)).toMatchObject({ attributes: { skin: "어두운", role: "상인" }, status: "pending", quality: "unspecified" });
    expect(exported.faces.find((entry) => entry.resourceId === faceResourceId)).toMatchObject({ label: "직접 고친 얼굴", attributes: { skin: "밝은", hair: "금발" } });
    const second = createBlankProject();
    applyCharacterGraphicsImport(second, parseCharacterGraphicsImport(exported, second));
    expect(exportCharacterGraphics(second)).toEqual(exported);
    expect(listCharacterFaces(second).find((face) => face.resourceId === faceResourceId)?.attributes.role).toBeUndefined();
  });

  it("does not let the bundled resource-ID alias hide an edited texture-key profile", () => {
    const project = createBlankProject();
    expect(project.resourceProfiles.some((profile) => profile.assetId === "easyrpg-charset-people1")).toBe(true);
    applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1([row()]), project));
    expect(listCharacterSprites(project).find((entry) => entry.textureKey === textureKey && entry.characterIndex === 0)?.note).toBe("수동 검토");
  });

  it("rejects malformed or duplicate v2 face rows atomically", () => {
    const project = createBlankProject();
    const before = serialize(project);
    const face = { resourceId: faceResourceId, label: "얼굴", note: "", attributes: { hair: "금발" } };
    for (const faces of [[face, face], [{ ...face, resourceId: "missing" }], [{ ...face, attributes: { hair: 4 } }]]) {
      expect(() => parseCharacterGraphicsImport({ ...documentV1([row()]), version: 2, faces }, project)).toThrow();
      expect(serialize(project)).toBe(before);
    }
  });

  it("preserves explicitly blank and whitespace labels rather than resetting them to bundled labels", () => {
    const project = createBlankProject();
    applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(documentV1([{ ...row(), label: "" }, { ...row(1), label: "  이름  " }]), project));
    const sprites = listCharacterSprites(deserialize(serialize(project))).filter((entry) => entry.textureKey === textureKey);
    expect(sprites[0]?.label).toBe("");
    expect(sprites[1]?.label).toBe("  이름  ");
  });

  it("keeps legacy projects metadata-free and only seeds explicit written traits", () => {
    const project = deserialize(serialize(createBlankProject()));
    expect(project.resourceProfiles.some((profile) => profile.characterSlots || profile.graphicAttributes)).toBe(false);
    expect(seedGraphicAttributes("정체불명 4번")).toEqual({});
    expect(seedGraphicAttributes("금발 노파 상인")).toMatchObject({ hair: "금발", age: "노년", gender: "여성", role: "상인" });
    expect(seedGraphicAttributes("젊은 중년 남성 여성").age).toBeUndefined();
    expect(seedGraphicAttributes("젊은 중년 남성 여성").gender).toBeUndefined();
  });

  it("rejects malformed persisted metadata, duplicates and dangling face IDs on load", () => {
    const project = createBlankProject();
    const profile = project.resourceProfiles.find((entry) => entry.kind === "charset" && entry.assetId === textureKey)!;
    const slot = { characterIndex: 0, status: "mapped", faceResourceId: "missing", quality: "exact", note: "", graphicAttributes: {} };
    Object.assign(profile, { characterSlots: [slot] });
    expect(() => deserialize(serialize(project))).toThrow();
    Object.assign(profile, { characterSlots: [{ ...slot, faceResourceId }, { ...slot, faceResourceId }] });
    expect(() => deserialize(serialize(project))).toThrow();
    Object.assign(profile, { characterSlots: [{ ...slot, faceResourceId, graphicAttributes: { age: 4 } }] });
    expect(() => deserialize(serialize(project))).toThrow();
  });
});
