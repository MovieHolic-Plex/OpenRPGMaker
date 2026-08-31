import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets } from "@/project/webExportAssets";
import type { Project } from "@/project/types";
import { describe, expect, it } from "vitest";

function exportedPaths(project: Project): Set<string> {
  return new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));
}

function audioPaths(project: Project): string[] {
  return [...exportedPaths(project)].filter((path) => path.includes("/audio/"));
}

function audioFileOf(project: Project, resourceId: string | undefined): string | null {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url?.startsWith("/") || !url.includes("/audio/")) return null;
  return url.slice(1);
}

describe("web export usage pruning", () => {
  it("ships exactly the tracks the project actually plays", () => {
    // Given
    const project = createBlankProject();
    const played = [project.system.defaultBgmResourceId, project.system.battleBgmResourceId]
      .map((id) => audioFileOf(project, id))
      .filter((path): path is string => path !== null);

    // When
    const audio = audioPaths(project);

    // Then
    expect(played.length).toBe(2);
    for (const path of played) expect(audio).toContain(path);
    // 「0 개가 아니다」 로는 카탈로그 전량이 실려도 통과한다 — 집합 자체를 고정한다.
    expect([...audio].sort()).toEqual([...played].sort());
  });

  it("does not ship the file behind a catalog row that nothing references", () => {
    // Given
    const project = createBlankProject();
    const played = new Set([project.system.defaultBgmResourceId, project.system.battleBgmResourceId]);
    const unreferenced = (project.resourceProfiles ?? [])
      .map((profile) => profile.assetId)
      .filter((id): id is string => typeof id === "string" && !played.has(id))
      .map((id) => audioFileOf(project, id))
      .find((path): path is string => path !== null);

    // When
    const paths = exportedPaths(project);

    // Then
    expect(unreferenced).toBeDefined();
    expect(paths.has(unreferenced!)).toBe(false);
  });

  it("starts shipping a catalog track once the project points at it", () => {
    // Given
    const project = createBlankProject();
    const baseline = audioPaths(project);
    const spare = (project.resourceProfiles ?? [])
      .map((profile) => profile.assetId)
      .filter((id): id is string => typeof id === "string" && id.startsWith("cc0-bgm-"))
      .find((id) => !baseline.some((path) => path.includes(id.replace("cc0-bgm-", ""))));

    // When
    const pointed: Project = spare
      ? { ...project, system: { ...project.system, defaultBgmResourceId: spare } }
      : project;
    const after = audioPaths(pointed);

    // Then
    expect(spare).toBeDefined();
    expect(after).not.toEqual(baseline);
  });

  // 좁힌 대상은 오디오 카탈로그 **뿐** 이다. 이미지 카탈로그(등록된 얼굴 등)까지 같이 자르면
  // webExportFacesetFaces.test.ts 가 못 박은 "등록만 한 얼굴도 나간다" 계약이 깨진다.
  it("leaves the image catalog alone while pruning the audio catalog", () => {
    // Given
    const project = createBlankProject();
    const imageRow = (project.resourceProfiles ?? []).find((profile) => {
      const url = resolveAssetResourceUrl(profile.assetId, { project });
      return url?.startsWith("/") === true && url.includes("/faceset/");
    });

    // When
    const paths = exportedPaths(project);

    // Then
    expect(imageRow).toBeDefined();
    const file = resolveAssetResourceUrl(imageRow!.assetId, { project })!.slice(1);
    expect(paths.has(file)).toBe(true);
  });

  it("still prunes uploaded assets by static reference", () => {
    // Given
    const project = createBlankProject();
    project.assets.uploaded.unused_upload = {
      id: "unused_upload",
      name: "Unused",
      kind: "picture",
      dataUrl: "data:image/png;base64,AA==",
      meta: { width: 1, height: 1 },
    };

    // When
    const paths = exportedPaths(project);

    // Then
    expect([...paths].some((path) => path.includes("unused_upload"))).toBe(false);
  });
});
