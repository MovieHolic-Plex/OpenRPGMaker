import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acceptMenuFolder, prepareNewProjectDir } from "../electron/main/newProjectDir";

const roots: string[] = [];

function scratch(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "oprn-new-project-")));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("new project folder", () => {
  it("creates a missing absolute folder", () => {
    const root = scratch();
    const dir = prepareNewProjectDir(join(root, "game"));
    expect(dir).toBe(join(root, "game"));
    expect(existsSync(dir)).toBe(true);
  });

  it("accepts an empty directory", () => {
    const root = scratch();
    const empty = join(root, "empty");
    mkdirSync(empty);
    expect(prepareNewProjectDir(empty)).toBe(empty);
  });

  it("refuses a folder that already has files and leaves them in place", () => {
    const root = scratch();
    const photos = join(root, "photos");
    mkdirSync(photos);
    writeFileSync(join(photos, "holiday.txt"), "keep");
    expect(() => prepareNewProjectDir(photos)).toThrow(/이미 파일이 있는 폴더/);
    expect(existsSync(join(photos, "holiday.txt"))).toBe(true);
    expect(existsSync(join(photos, "project.sqlite"))).toBe(false);
  });

  it("refuses a file path and a relative path", () => {
    const root = scratch();
    const file = join(root, "notes.txt");
    writeFileSync(file, "x");
    expect(() => prepareNewProjectDir(file)).toThrow(/이미 파일이 있는 폴더/);
    expect(() => prepareNewProjectDir("games/new")).toThrow(/절대 경로/);
  });

  it("lets Open keep a non-empty folder and makes New refuse it", () => {
    const root = scratch();
    const photos = join(root, "photos");
    mkdirSync(photos);
    writeFileSync(join(photos, "holiday.txt"), "keep");
    expect(acceptMenuFolder(photos, "open")).toBe(photos);
    expect(existsSync(join(photos, "project.sqlite"))).toBe(false);
    expect(() => acceptMenuFolder(photos, "new")).toThrow(/이미 파일이 있는 폴더/);
    expect(existsSync(join(photos, "project.sqlite"))).toBe(false);
  });
});
