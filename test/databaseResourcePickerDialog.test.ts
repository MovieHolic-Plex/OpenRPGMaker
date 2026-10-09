import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const colorKeyRequests: string[] = [];
vi.mock("@/assets/transparentColorKeyBackground", () => ({
  transparentColorKeyDataUrl: async (path: string) => {
    colorKeyRequests.push(path);
    return "data:image/png;base64,KEYED";
  },
}));

import { AUTHORABLE_FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import {
  listDatabaseResourceOptionsForTest,
  openDatabaseResourcePickerDialog,
  resourcePickerControl,
} from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement, type FakeNode } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  colorKeyRequests.length = 0;
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

  // 얼굴 한 칸 = 파일 한 장. 피커는 저작 가능한 낱장만 나열하고, 분할 전 시트 id 와
  // 생성 시리즈(hero-XX-face) 낱장은 목록에서 빠진다.
  it("lists one option per standalone face file and drops the legacy sheets", () => {
    const project = createBlankProject();
    const faces = listDatabaseResourceOptionsForTest("faceset", project);
    const ids = faces.map((entry) => entry.id);
    for (const asset of AUTHORABLE_FACESET_FACE_ASSETS) expect(ids).toContain(asset.id);
    for (const sheetId of LEGACY_FACESET_SHEET_IDS) expect(ids).not.toContain(sheetId);
    for (const generatedId of GENERATED_FACESET_FACE_IDS) expect(ids).not.toContain(generatedId);
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

  it("title/backdrop 피커 행에 AI 만들기 칸이 붙는다", () => {
    store.replace(createBlankProject());
    for (const [kind, prefix] of [["title", "title-pick"], ["backdrop", "backdrop-pick"]] as const) {
      const row = resourcePickerControl({
        label: "배경",
        resourceId: undefined,
        kind,
        testid: prefix,
        onChange: () => {},
        rerender: () => {},
      }) as unknown as FakeNode;
      expect(findByTestId(row, `${prefix}-ai-prompt`), `${kind} AI 프롬프트 칸`).not.toBeNull();
      expect(findByTestId(row, `${prefix}-ai-generate`), `${kind} AI 생성 버튼`).not.toBeNull();
    }
  });

  it("monster 피커 행에는 AI 칸이 붙지 않는다 — 몬스터는 도트 시트 140종에서 고른다(2026-10-02)", () => {
    store.replace(createBlankProject());
    const row = resourcePickerControl({
      label: "몬스터",
      resourceId: undefined,
      kind: "monster",
      testid: "monster-pick",
      onChange: () => {},
      rerender: () => {},
    }) as unknown as FakeNode;
    expect(findByTestId(row, "monster-pick-ai-prompt")).toBeNull();
    expect(findByTestId(row, "monster-pick-ai-generate")).toBeNull();
  });

  it("charset 피커 행에는 AI 칸이 붙지 않는다", () => {
    store.replace(createBlankProject());
    const row = resourcePickerControl({
      label: "캐릭터셋",
      resourceId: undefined,
      kind: "charset",
      testid: "charset-pick",
      onChange: () => {},
      rerender: () => {},
    }) as unknown as FakeNode;
    expect(findByTestId(row, "charset-pick-ai-prompt")).toBeNull();
  });

  // 캐릭셋 원본(RTP·업로드 모두)은 배경이 단색이고 알파가 없다. 키아웃하지 않으면
  // 캐릭터 그래픽을 고르는 목록 전체가 스프라이트 뒤에 청록 사각형을 달고 나온다.
  it("swaps charset thumbnails to a color-keyed image", async () => {
    store.replace(createBlankProject());
    const row = resourcePickerControl({
      label: "캐릭터셋",
      resourceId: "easyrpg-charset-actor1",
      kind: "charset",
      testid: "charset-key",
      onChange: () => {},
      rerender: () => {},
    }) as unknown as FakeNode;

    const crop = (row as unknown as FakeElement).querySelector(".db-resource-picker-crop");
    expect(crop).not.toBeNull();
    expect(colorKeyRequests).toHaveLength(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(crop?.style.getPropertyValue("--db-resource-url")).toBe('url("data:image/png;base64,KEYED")');
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
