// 프로젝트에 이미 저장된 업로드 얼굴 시트(4x4) + actor faceIndex 조합이
// 낱장 16개 자산 + 낱장 참조로 옮겨지는지 검사한다. 내장 시트가 아닌 경로다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

type Json = Record<string, unknown>;

const SHEET_ID = "faceset_img_user01";
const PIXEL = "data:image/png;base64,iVBORw0KGgo=";

function v3WithUploadedSheet(): Json {
  const raw = JSON.parse(serialize(createBlankProject())) as Json;
  raw.version = 3;
  const assets = raw.assets as { uploaded: Record<string, Json> };
  assets.uploaded[SHEET_ID] = {
    id: SHEET_ID,
    name: "내 얼굴 시트",
    kind: "faceset",
    dataUrl: PIXEL,
    meta: { tileSize: 48, frames: 16, frameWidth: 48, frameHeight: 48, width: 192, height: 192 },
  };
  const profiles = raw.resourceProfiles as Json[];
  profiles.push({ kind: "faceset", name: "내 얼굴 시트", imageWidth: 192, imageHeight: 192, assetId: SHEET_ID });
  const database = raw.database as { actors: Json[] };
  database.actors[0]!.faceResourceId = SHEET_ID;
  database.actors[0]!.faceIndex = 7;
  return raw;
}

function parse(raw: Json): Json {
  return JSON.parse(JSON.stringify(deserialize(JSON.stringify(raw)))) as Json;
}

describe("업로드된 얼굴 시트의 v3 → v4 이관", () => {
  it("actor 의 faceIndex 7 은 낱장 -07 참조가 된다", () => {
    const project = parse(v3WithUploadedSheet());
    const actors = (project.database as { actors: { faceResourceId?: string }[] }).actors;
    expect(actors[0]!.faceResourceId).toBe(`${SHEET_ID}-07`);
  });

  it("시트 자산은 낱장 16개로 바뀌고 시트 자체는 사라진다", () => {
    const project = parse(v3WithUploadedSheet());
    const uploaded = (project.assets as { uploaded: Record<string, unknown> }).uploaded;
    const faceIds = Object.keys(uploaded).filter((id) => id.startsWith(`${SHEET_ID}-`));
    expect(faceIds).toHaveLength(16);
    expect(faceIds).toContain(`${SHEET_ID}-00`);
    expect(faceIds).toContain(`${SHEET_ID}-15`);
    expect(uploaded[SHEET_ID]).toBeUndefined();
  });

  it("낱장 자산은 48×48 로 기록되고 절단 대기 표시를 들고 있다", () => {
    const project = parse(v3WithUploadedSheet());
    const uploaded = (project.assets as { uploaded: Record<string, { meta?: Json }> }).uploaded;
    const face = uploaded[`${SHEET_ID}-07`]!;
    expect(face.meta?.width).toBe(48);
    expect(face.meta?.height).toBe(48);
    expect(face.meta?.sheetCell).toBe(7);
    expect(face.meta?.sheetSourceId).toBe(SHEET_ID);
  });

  it("리소스 프로필도 낱장 16개로 바뀐다", () => {
    const project = parse(v3WithUploadedSheet());
    const profiles = project.resourceProfiles as { kind: string; assetId?: string; imageWidth?: number }[];
    const faces = profiles.filter((entry) => entry.assetId?.startsWith(`${SHEET_ID}-`));
    expect(faces).toHaveLength(16);
    expect(faces.every((entry) => entry.imageWidth === 48)).toBe(true);
    expect(profiles.some((entry) => entry.assetId === SHEET_ID)).toBe(false);
  });

  it("faceIndex 키는 어디에도 남지 않는다", () => {
    expect(JSON.stringify(parse(v3WithUploadedSheet()))).not.toContain('"faceIndex"');
  });

  it("두 번 읽어도 낱장 id 가 다시 접미사를 얻지 않는다", () => {
    const once = parse(v3WithUploadedSheet());
    once.version = 3;
    const actors = (parse(once).database as { actors: { faceResourceId?: string }[] }).actors;
    expect(actors[0]!.faceResourceId).toBe(`${SHEET_ID}-07`);
  });
});
