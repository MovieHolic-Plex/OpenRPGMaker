import { describe, expect, it } from "vitest";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/resourceOptions";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function ids(kind: DatabaseResourcePickerKind, project: Project): string[] {
  return listDatabaseResourceOptions(kind, project).map(entry => entry.id);
}

function withUploads(): Project {
  const project = createBlankProject();
  project.assets.uploaded["backdrop_img_0001"] = {
    id: "backdrop_img_0001", name: "AI 배경화", kind: "backdrop", dataUrl: "data:image/png;base64,AAAA", meta: {},
  };
  project.assets.uploaded["title_img_0001"] = {
    id: "title_img_0001", name: "AI 타이틀", kind: "title", dataUrl: "data:image/png;base64,AAAA", meta: {},
  };
  project.assets.uploaded["picture-upload"] = {
    id: "picture-upload", name: "업로드 그림", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {},
  };
  return project;
}

describe("시네마틱 스틸 카탈로그", () => {
  it("전체화면 아트를 아이템 아이콘보다 먼저 제안한다", () => {
    const still = ids("still", createBlankProject());
    expect(still).toContain("easyrpg-backdrop-cosmos1");
    expect(still).toContain("easyrpg-title-title1");
    expect(still.slice(0, 40).filter(id => id.startsWith("cc0-jetrel-"))).toEqual([]);
  });

  it("기존 저장본의 아이콘 참조를 계속 허용한다", () => {
    const project = createBlankProject();
    const legacyIcon = ids("image", project).find(id => id.startsWith("cc0-jetrel-"));
    expect(legacyIcon).toBeTruthy();
    expect(ids("still", project)).toContain(legacyIcon);
  });

  it("아이콘/이미지 카탈로그는 그대로 둔다", () => {
    const project = createBlankProject();
    const image = ids("image", project);
    expect(image.length).toBeGreaterThan(400);
    expect(image).not.toContain("easyrpg-backdrop-cosmos1");
    expect(image).not.toContain("easyrpg-title-title1");
    expect(ids("icon", project)).not.toContain("easyrpg-backdrop-cosmos1");
  });

  it("AI 생성·업로드 스틸을 아이콘보다 앞에 둔다", () => {
    const still = ids("still", withUploads());
    const firstIcon = still.findIndex(id => id.startsWith("cc0-jetrel-"));
    expect(firstIcon).toBeGreaterThan(0);
    for (const id of ["backdrop_img_0001", "title_img_0001", "picture-upload"]) {
      expect(still).toContain(id);
      expect(still.indexOf(id)).toBeLessThan(firstIcon);
    }
  });

  it("음악·영상 카탈로그를 스틸로 끌어오지 않는다", () => {
    const still = ids("still", withUploads());
    expect(still.some(id => id.startsWith("cc0-bgm-"))).toBe(false);
    expect(still.some(id => id.startsWith("cc0-se-"))).toBe(false);
  });
});
