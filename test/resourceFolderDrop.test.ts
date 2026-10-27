// 리소스 관리자에 폴더를 놓으면 폴더 자체가 파일 한 장으로 들어와 「알 수 없는 형식」이 됐다.
// 폴더 안을 읽고, 지금 분류의 확장자만 가져온다.
import { describe, expect, it } from "vitest";
import { RESOURCE_FOLDER_IMPORT_CAP, filesFromResourceDrop } from "@/editor/panels/resourceManagerViews";

function fileNamed(name: string): File {
  return new File(["x"], name, { type: "application/octet-stream" });
}

function fileEntry(name: string, onRead?: () => void): FileSystemEntry {
  return {
    name,
    isFile: true,
    isDirectory: false,
    file(success) {
      onRead?.();
      success(fileNamed(name));
    },
  } as FileSystemFileEntry;
}

function dirEntry(name: string, children: readonly FileSystemEntry[]): FileSystemEntry {
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => {
      let pending = children.slice();
      return {
        readEntries(success) {
          const batch = pending.splice(0, 100);
          success(batch);
        },
      };
    },
  } as FileSystemDirectoryEntry;
}

function transfer(entries: readonly (FileSystemEntry | null)[], files: readonly File[] = []): DataTransfer {
  return {
    items: entries.map((entry) => ({
      kind: "file",
      webkitGetAsEntry: () => entry,
    })),
    files,
  } as unknown as DataTransfer;
}

describe("filesFromResourceDrop", () => {
  it("keeps a single dropped file when the browser does not expose a directory entry", async () => {
    const png = fileNamed("lamp.png");
    const read = await filesFromResourceDrop({
      items: [{ kind: "file", webkitGetAsEntry: () => null }],
      files: [png],
    } as unknown as DataTransfer);

    expect(read.files.map((file) => file.name)).toEqual(["lamp.png"]);
    expect(read.notice).toBeNull();
  });

  it("imports images inside a dropped folder and skips notes", async () => {
    const read = await filesFromResourceDrop(transfer([
      dirEntry("village-pictures", [
        fileEntry("lamp.png"),
        fileEntry("notes.txt"),
        dirEntry("signs", [fileEntry("sign.png"), fileEntry(".hidden.png")]),
      ]),
    ], [fileNamed("village-pictures")]));

    expect(read.files.map((file) => file.name)).toEqual(["lamp.png", "sign.png"]);
    expect(read.notice).toBeNull();
  });

  it("says when a folder has nothing the current category can import", async () => {
    const read = await filesFromResourceDrop(transfer([
      dirEntry("music", [fileEntry("theme.mp3")]),
    ]), ["png"]);

    expect(read.files).toEqual([]);
    expect(read.noticeKind).toBe("error");
    expect(read.notice).toBe("이 폴더에서 지금 분류로 가져올 파일이 없습니다.");
  });

  it("stops after the folder cap and does not read the rest", async () => {
    let extraReads = 0;
    const children = Array.from({ length: RESOURCE_FOLDER_IMPORT_CAP + 3 }, (_, index) => (
      fileEntry(`tile-${index}.png`, () => {
        if (index >= RESOURCE_FOLDER_IMPORT_CAP) extraReads += 1;
      })
    ));
    const read = await filesFromResourceDrop(transfer([dirEntry("tiles", children)]));

    expect(read.files).toHaveLength(RESOURCE_FOLDER_IMPORT_CAP);
    expect(extraReads).toBe(0);
    expect(read.noticeKind).toBe("info");
    expect(read.notice).toBe(`폴더에서는 앞의 ${RESOURCE_FOLDER_IMPORT_CAP}개만 가져옵니다.`);
  });

  it("still passes a loose file through even when its extension is not a folder match", async () => {
    const read = await filesFromResourceDrop(transfer([fileEntry("sheet.bmp")]));

    expect(read.files.map((file) => file.name)).toEqual(["sheet.bmp"]);
    expect(read.notice).toBeNull();
  });
});
