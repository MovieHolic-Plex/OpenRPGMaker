import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FACESET_FACE_ASSETS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import {
  listDatabaseResourceOptionsForTest,
  openDatabaseResourcePickerDialog,
} from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeNode } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("database resource picker catalog", () => {
  it("lists icon and monster candidates from bundled assets", () => {
    const project = createBlankProject();
    const icons = listDatabaseResourceOptionsForTest("icon", project);
    const monsters = listDatabaseResourceOptionsForTest("monster", project);
    const titles = listDatabaseResourceOptionsForTest("title", project);

    expect(icons.some((entry) => entry.id.startsWith("cc0-jetrel-"))).toBe(true);
    expect(monsters.some((entry) => entry.id.includes("enemy") || entry.id.includes("monster"))).toBe(true);
    expect(titles.length).toBeGreaterThan(0);
  });

  it("lists facesets and charsets for actor sheet picking", () => {
    const project = createBlankProject();
    const faces = listDatabaseResourceOptionsForTest("faceset", project);
    const charsets = listDatabaseResourceOptionsForTest("charset", project);
    expect(faces.some((entry) => entry.id.includes("faceset"))).toBe(true);
    expect(charsets.some((entry) => entry.id.includes("charset"))).toBe(true);
  });

  // 얼굴 한 칸 = 파일 한 장. 피커는 낱장 112장을 그대로 나열하고, 분할 전 시트 id 는 목록에서 빠진다.
  it("lists one option per standalone face file and drops the legacy sheets", () => {
    const project = createBlankProject();
    const faces = listDatabaseResourceOptionsForTest("faceset", project);
    const ids = faces.map((entry) => entry.id);
    for (const asset of FACESET_FACE_ASSETS) expect(ids).toContain(asset.id);
    for (const sheetId of LEGACY_FACESET_SHEET_IDS) expect(ids).not.toContain(sheetId);
  });
});

describe("faceset picker dialog", () => {
  it("renders per-face options and no face-index control", () => {
    store.replace(createBlankProject());
    openDatabaseResourcePickerDialog({
      kind: "faceset",
      title: "얼굴 고르기",
      currentId: "easyrpg-faceset-actor1-07",
      testidPrefix: "face-pick",
      onConfirm: () => {},
    });
    const body = document.body as unknown as FakeNode;
    expect(findByTestId(body, "face-pick")).not.toBeNull();
    expect(findByTestId(body, "face-pick-option-easyrpg-faceset-actor1-07")).not.toBeNull();
    expect(findByTestId(body, "face-pick-option-easyrpg-faceset-people1-15")).not.toBeNull();
    expect(findByTestId(body, "face-pick-option-easyrpg-faceset-actor1")).toBeNull();
    expect(findByTestId(body, "face-pick-face-index")).toBeNull();
  });

  it("confirms the picked face id alone", () => {
    store.replace(createBlankProject());
    const picked: string[] = [];
    openDatabaseResourcePickerDialog({
      kind: "faceset",
      title: "얼굴 고르기",
      currentId: "easyrpg-faceset-actor1-00",
      testidPrefix: "face-pick",
      onConfirm: (result) => {
        picked.push(result.resourceId);
        expect(Object.keys(result)).not.toContain("faceIndex");
      },
    });
    const body = document.body as unknown as FakeNode;
    findByTestId(body, "face-pick-option-easyrpg-faceset-actor2-03")?.dispatchEvent(new Event("click"));
    findByTestId(body, "face-pick-ok")?.dispatchEvent(new Event("click"));
    expect(picked).toEqual(["easyrpg-faceset-actor2-03"]);
  });
});
