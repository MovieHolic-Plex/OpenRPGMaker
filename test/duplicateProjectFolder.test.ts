import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { duplicateProjectFolder } from "../electron/main/duplicateProject";
import { inspectProjectFolder } from "../electron/main/projectFolderPath";

it("열린 WAL의 저장본과 폴더 파일을 새 ID의 형제 폴더에 복제한다", async () => {
  const root = mkdtempSync(join(tmpdir(), "oprn-project-copy-"));
  const source = join(root, "게임");
  const firstCopy = join(root, "게임 사본");
  mkdirSync(join(source, "assets"), { recursive: true });
  mkdirSync(firstCopy);
  writeFileSync(join(firstCopy, "keep.txt"), "기존 사본");
  writeFileSync(join(source, "assets", "custom.txt"), "사용자 파일");

  const path = join(source, "project.sqlite");
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA wal_autocheckpoint=0;
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE project (id INTEGER PRIMARY KEY, project_id TEXT, title TEXT);
      INSERT INTO meta VALUES ('project_id', 'original');
      INSERT INTO project VALUES (1, 'original', '저장된 제목');
    `);
    expect(existsSync(path + "-wal")).toBe(true);

    const copy = await duplicateProjectFolder(source);
    expect(copy).toEqual({ projectDir: join(root, "게임 사본 2"), title: "저장된 제목" });
    expect(readFileSync(join(copy.projectDir, "assets", "custom.txt"), "utf8")).toBe("사용자 파일");
    expect(readFileSync(join(firstCopy, "keep.txt"), "utf8")).toBe("기존 사본");
    expect(existsSync(join(copy.projectDir, "project.sqlite-wal"))).toBe(false);
    const copied = new DatabaseSync(join(copy.projectDir, "project.sqlite"), { readOnly: true });
    try {
      const id = copied.prepare("SELECT value FROM meta WHERE key = 'project_id'").get()?.value;
      expect(id).toEqual(expect.any(String));
      expect(id).not.toBe("original");
      expect(copied.prepare("SELECT project_id FROM project").get()?.project_id).toBe(id);
      expect(db.prepare("SELECT project_id FROM project").get()?.project_id).toBe("original");
    } finally { copied.close(); }
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

it("project.sqlite라는 이름의 디렉터리는 실제 프로젝트 파일로 인정하지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "oprn-project-path-"));
  try {
    mkdirSync(join(root, "project.sqlite"));
    expect(inspectProjectFolder(root)).toBeNull();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
