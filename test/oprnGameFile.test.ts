import { createBlankProject } from "@/project/defaults";
import { createProjectPackage, projectPackageFileName } from "@/project/package";
import {
  isOprnGameFile,
  OPRN_GAME_FILE_ACCEPT,
  pickOprnGameFile,
  readOprnGameFile,
} from "@/player/oprnGameFile";
import { exportedProjectId } from "@/player/exportProjectStoreShim";
import { resolveCommunitySaveScope, resolveExportSaveNamespace } from "@/player/exportSaveNamespace";
import { describe, expect, it } from "vitest";

function fileStub(name: string, type = ""): Pick<File, "name" | "type"> {
  return { name, type };
}

describe("oprn game file", () => {
  it("derives publication isolation from listing paths, independently of legacy host/file namespaces", () => {
    expect(resolveCommunitySaveScope("/play/listing-a/releases/" + "a".repeat(64) + "/player.html")).toBe("listing-a");
    expect(resolveCommunitySaveScope("/play/listing-b/releases/" + "a".repeat(64) + "/player.html")).toBe("listing-b");
    expect(resolveCommunitySaveScope("/play/encoded%20listing/player.html")).toBe("encoded listing");
    expect(resolveCommunitySaveScope("/renamed-standalone.html")).toBeUndefined();
    expect(resolveCommunitySaveScope("/other/renamed-standalone.html")).toBeUndefined();
  });
  it("accepts the .oprn extension and the package mime types", () => {
    expect(isOprnGameFile(fileStub("my-game.oprn"))).toBe(true);
    expect(isOprnGameFile(fileStub("MY-GAME.OPRN"))).toBe(true);
    expect(isOprnGameFile(fileStub("legacy.rpgzzu"))).toBe(true);
    expect(isOprnGameFile(fileStub("game", "application/vnd.openrpg.project+zip"))).toBe(true);
    expect(isOprnGameFile(fileStub("notes.txt"))).toBe(false);
    expect(isOprnGameFile(fileStub("project.json", "application/json"))).toBe(false);
    expect(OPRN_GAME_FILE_ACCEPT).toContain(".oprn");
  });

  it("picks the first game file out of a mixed drop", () => {
    const dropped = [
      { name: "readme.txt", type: "text/plain" },
      { name: "hero.oprn", type: "" },
      { name: "spare.oprn", type: "" },
    ] as unknown as File[];

    expect(pickOprnGameFile(dropped)?.name).toBe("hero.oprn");
    expect(pickOprnGameFile([{ name: "readme.txt", type: "text/plain" }] as unknown as File[])).toBeNull();
  });

  it("reads a project back out of a single exported .oprn file", async () => {
    // Given
    const project = createBlankProject();
    project.meta.title = "단일 파일 게임";
    const blob = createProjectPackage(project);

    // When
    const read = await readOprnGameFile(blob);

    // Then
    expect(projectPackageFileName(project)).toBe("단일-파일-게임.oprn");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.project.meta.title).toBe("단일 파일 게임");
    expect(Object.keys(read.project.maps)).toEqual(Object.keys(project.maps));
    expect(read.project.startMapId).toBe(project.startMapId);
  });

  it("reports a readable reason instead of throwing when the file is not a package", async () => {
    // Given
    const notAPackage = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);

    // When
    const read = await readOprnGameFile(notAPackage);

    // Then
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.message.length).toBeGreaterThan(0);
  });

  it("namespaces an opened file by its own identity instead of the host identity", () => {
    const project = createBlankProject();
    project.meta.title = "가져온 게임";
    project.meta.author = "파일 저자";

    expect(resolveExportSaveNamespace(project, {
      source: "opened-file",
      hostSaveNamespace: "host-injected-save-slots",
      pathname: "/play/host-community-game",
    })).toBe(`oprn-export:${exportedProjectId(project)}`);
  });

  it("preserves the bundled player's host, community, then project namespace precedence", () => {
    const project = createBlankProject();
    project.meta.title = "번들 게임";

    expect(resolveExportSaveNamespace(project, {
      source: "bundled",
      hostSaveNamespace: "host-injected-save-slots",
      pathname: "/play/community-game",
    })).toBe("host-injected-save-slots");
    expect(resolveExportSaveNamespace(project, {
      source: "bundled",
      pathname: "/play/community%20game",
    })).toBe("oprn-export:community game");
    expect(resolveExportSaveNamespace(project, {
      source: "bundled",
      pathname: "/player.html",
    })).toBe(`oprn-export:${exportedProjectId(project)}`);
  });
});
