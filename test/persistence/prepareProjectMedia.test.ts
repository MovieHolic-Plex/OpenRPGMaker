import { describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import type { ProjectRepository } from "@/project/persistence/types";
import { prepareProjectMedia } from "@/project/persistence/prepareProjectMedia";

const target = { kind: "local", projectDir: "/fixture", projectId: "one" } as const;
const ref = { sha256: "a".repeat(64), extension: "png", mime: "image/png", bytes: 3 };
function fixture() {
  const original = { id: "pixels", name: "소재", kind: "sprite" as const, dataUrl: "data:image/png;base64,AQID", meta: { frames: 1 } };
  const project = { assets: { uploaded: { pixels: original } } } as unknown as Project;
  const put = vi.fn(async () => ({ ref, dataUrl: null }));
  const repository = { supportsAssetRefs: true, currentTarget: () => target, assets: { put } } as unknown as ProjectRepository;
  return { project, original, repository, put };
}

describe("seed media before folder adoption", () => {
  it("실제 바이트를 파일 저장에 넘기고 원본 소재 레코드는 유지한다", async () => {
    const { project, original, repository, put } = fixture();
    await prepareProjectMedia(project, repository);
    expect(put).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), { mime: "image/png", extension: "png", originalName: "소재", kind: "sprite" });
    expect(project.assets.uploaded.pixels).toMatchObject({ ref, meta: { frames: 1 } });
    expect(project.assets.uploaded.pixels?.dataUrl).toBeUndefined();
    expect(original.dataUrl).toBe("data:image/png;base64,AQID");
  });
  it("파일 저장 실패는 프로젝트 채택 전에 전파되고 소재를 지우지 않는다", async () => {
    const { project, repository, put } = fixture();
    put.mockRejectedValueOnce(new Error("disk full"));
    await expect(prepareProjectMedia(project, repository)).rejects.toThrow("disk full");
    expect(project.assets.uploaded.pixels?.dataUrl).toBeDefined();
    expect(project.assets.uploaded.pixels?.ref).toBeUndefined();
  });
  it("소재 준비 중 폴더가 바뀌면 중단한다", async () => {
    const { project, repository } = fixture();
    let active: typeof target | { kind: "local"; projectDir: string; projectId: string } = target;
    const put = vi.fn(async () => { active = { kind: "local", projectDir: "/other", projectId: "two" }; return { ref, dataUrl: null }; });
    const changed = { ...repository, currentTarget: () => active, assets: { ...repository.assets, put } };
    await expect(prepareProjectMedia(project, changed)).rejects.toThrow("폴더가 바뀌었습니다");
    expect(project.assets.uploaded.pixels?.ref).toBeUndefined();
  });
  it("같은 경로의 프로젝트 ID가 바뀌어도 중단한다", async () => {
    const { project, repository } = fixture();
    let active: { kind: "local"; projectDir: string; projectId: string } = target;
    const put = vi.fn(async () => { active = { ...target, projectId: "replacement" }; return { ref, dataUrl: null }; });
    const changed = { ...repository, currentTarget: () => active, assets: { ...repository.assets, put } };
    await expect(prepareProjectMedia(project, changed)).rejects.toThrow("폴더가 바뀌었습니다");
    expect(project.assets.uploaded.pixels?.ref).toBeUndefined();
  });
});
