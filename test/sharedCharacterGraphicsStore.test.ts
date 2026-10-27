import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSharedCharacterGraphics, writeSharedCharacterGraphics } from "../scripts/lib/sharedCharacterGraphics";
import { defaultSharedCharacterGraphics, emptySharedCharacterGraphics } from "@/project/sharedCharacterGraphicsSchema";
import { validateSharedCharacterGraphics } from "@/project/sharedCharacterGraphics";

let directory: string;
let file: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "oprn-shared-graphics-")); file = join(directory, "catalog.json"); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("Host-owned character graphics catalog", () => {
  it("starts with valid reviewed mappings without generating a project-specific copy", () => {
    const catalog = defaultSharedCharacterGraphics();
    expect(() => validateSharedCharacterGraphics(catalog)).not.toThrow();
    expect(readSharedCharacterGraphics(file).document).toEqual(catalog);
    expect(catalog.mappings.some(row => row.status === "pending")).toBe(false);
    // Animal #1 은 원본 얼굴이 없어 짝 얼굴을 생성했다(2026-09-28). 다른 고양이·강아지 얼굴을 대체로 쓰지 않는다.
    expect(catalog.mappings.find(row => row.textureKey === "tex_easyrpg_charset_animal" && row.characterIndex === 1)?.faceResourceId).toBe("generated-faceset-missing-people-11");
    // Animal #0 은 코기 강아지다(2026-10-20 정정). 고양이 얼굴(people2-09)에 묶이면 강아지가 고양이 초상으로 말한다.
    expect(catalog.mappings.find(row => row.textureKey === "tex_easyrpg_charset_animal" && row.characterIndex === 0)).toMatchObject({ label: "주황 강아지", faceResourceId: "easyrpg-faceset-people2-08" });
    expect(catalog.mappings.find(row => row.textureKey === "tex_easyrpg_charset_actor3" && row.characterIndex === 5)?.faceResourceId).not.toBe("easyrpg-faceset-actor2-05");
  });
  it("survives a new reader and retains a previous accepted revision", () => {
    const initial = readSharedCharacterGraphics(file);
    const document = emptySharedCharacterGraphics();
    document.mappings.push({ textureKey: "tex_easyrpg_charset_actor1", characterIndex: 0, label: "용사", attributes: {}, status: "mapped", faceResourceId: "easyrpg-faceset-actor1-00", quality: "unspecified", note: "" });
    const accepted = writeSharedCharacterGraphics({ revision: initial.revision, document }, file);
    expect(readSharedCharacterGraphics(file)).toEqual(accepted);
    writeSharedCharacterGraphics({ revision: accepted.revision, document: emptySharedCharacterGraphics() }, file);
    // 저장본은 제출 초안이 아니라 받아들인 문서다 — #2759 부터 현대 연애 칩 짝 행을 앞채움하므로 accepted.document 와 비교한다.
    expect(JSON.parse(readFileSync(`${file}.previous`, "utf8"))).toEqual(accepted.document);
  });
  it("rejects an older reader without overwriting newer data", () => {
    const initial = readSharedCharacterGraphics(file);
    const document = emptySharedCharacterGraphics();
    document.faces.push({ resourceId: "easyrpg-faceset-actor1-00", label: "공용 얼굴", attributes: {}, note: "검토" });
    const accepted = writeSharedCharacterGraphics({ revision: initial.revision, document }, file);
    expect(() => writeSharedCharacterGraphics({ revision: initial.revision, document: emptySharedCharacterGraphics() }, file)).toThrow("다른 창");
    expect(readSharedCharacterGraphics(file)).toEqual(accepted);
  });
  it("rejects malformed and duplicate rows before writing", () => {
    const initial = readSharedCharacterGraphics(file);
    const row = { resourceId: "easyrpg-faceset-actor1-00", label: "얼굴", attributes: {}, note: "" };
    expect(() => writeSharedCharacterGraphics({ revision: initial.revision, document: { ...initial.document, faces: [row, row] } }, file)).toThrow();
    expect(() => writeSharedCharacterGraphics({ revision: initial.revision, document: { ...initial.document, faces: [{ ...row, attributes: { arbitrary: "bad" } }] } }, file)).toThrow();
    expect(readSharedCharacterGraphics(file)).toEqual(initial);
  });
});
