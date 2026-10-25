import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_PROJECT_STORE_FILE, electronUserArgIndex, inspectCliProjectArgs } from "../electron/main/cliProject";

const roots: string[] = [];

function scratch(): string {
  // /tmp 가 심볼릭 링크면 명령줄 해석(realpath)과 테스트가 만든 경로가 달라진다.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "oprn-cli-project-")));
  roots.push(dir);
  return dir;
}

function project(parent: string, name = "game"): string {
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CLI_PROJECT_STORE_FILE), "not-a-real-database");
  return dir;
}

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CLI project folder arguments", () => {
  it("treats the electron app path as not a user argument", () => {
    expect(electronUserArgIndex(false)).toBe(1);
    expect(electronUserArgIndex(true)).toBe(2);
  });

  it("opens the first directory that contains project.sqlite and skips switches", () => {
    const root = scratch();
    const game = project(root);
    const hit = inspectCliProjectArgs(
      ["/opt/OPRN/oprn", "--no-sandbox", "--disable-gpu", game],
      root,
    );
    expect(hit).toEqual({ dir: game, ignored: [] });
  });

  it("keeps a store deep link out of the project scan", () => {
    const root = scratch();
    const game = project(root);
    const link = "oprn://store/install?store=https%3A%2F%2Fstore.openrpgmaker.com&slug=forest-pack";
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", link, "--ozone-platform=x11", game], root);
    expect(hit.dir).toBe(game);
    expect(hit.ignored).toEqual([]);
  });

  it("resolves a relative path against the caller working directory", () => {
    const root = scratch();
    project(root, "quest");
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", "quest"], root);
    expect(hit.dir).toBe(join(root, "quest"));
  });

  it("skips the dev-app entry when fromIndex is 2, even if that entry is a directory", () => {
    const root = scratch();
    const game = project(root, "game");
    const appDir = join(root, "app");
    mkdirSync(appDir);
    const hit = inspectCliProjectArgs(["/usr/bin/electron", appDir, "game"], root, { fromIndex: 2 });
    expect(hit).toEqual({ dir: game, ignored: [] });
  });

  it("expands a leading tilde with the given home directory", () => {
    const home = scratch();
    const game = project(home, "quest");
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", "~/quest"], "/somewhere/else", { homedir: home });
    expect(hit.dir).toBe(game);
  });

  it("accepts a file URL for a project folder", () => {
    const root = scratch();
    const game = project(root);
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", pathToFileURL(game).href], root);
    expect(hit.dir).toBe(game);
  });

  it("follows a symlink to the project directory", () => {
    const root = scratch();
    const game = project(root, "real");
    const link = join(root, "link");
    symlinkSync(game, link);
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", link], root);
    expect(hit.dir).toBe(game);
  });

  it("ignores a missing path, a file, and a folder with no project store", () => {
    const root = scratch();
    const empty = join(root, "empty");
    mkdirSync(empty);
    const file = join(root, "notes.txt");
    writeFileSync(file, "hello");
    const missing = join(root, "missing");
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", missing, file, empty], root);
    expect(hit.dir).toBeNull();
    expect(hit.ignored).toEqual([missing, file, empty]);
  });

  it("does not treat a directory named project.sqlite as the store file", () => {
    const root = scratch();
    const dir = join(root, "odd");
    mkdirSync(join(dir, CLI_PROJECT_STORE_FILE), { recursive: true });
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", dir], root);
    expect(hit).toEqual({ dir: null, ignored: [dir] });
  });

  it("continues after an invalid path and opens the next project", () => {
    const root = scratch();
    const game = project(root);
    const missing = join(root, "nope");
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", missing, game], root);
    expect(hit).toEqual({ dir: game, ignored: [missing] });
  });

  it("stops at the first project when several are passed", () => {
    const root = scratch();
    const first = project(root, "first");
    const second = project(root, "second");
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", first, second], root);
    expect(hit).toEqual({ dir: first, ignored: [] });
  });

  it("does not warn about an app entry file the wrapper passed through", () => {
    const root = scratch();
    const entry = join(root, "app.asar");
    writeFileSync(entry, "bundle");
    const script = join(root, "main.cjs");
    writeFileSync(script, "module.exports = {}");
    const game = project(root);
    expect(inspectCliProjectArgs(["/opt/OPRN/oprn", entry, script], root)).toEqual({ dir: null, ignored: [] });
    expect(inspectCliProjectArgs(["/opt/OPRN/oprn", entry, game], root).dir).toBe(game);
  });

  it("ignores a bare name that is not a path and does not throw on a bad file URL", () => {
    const root = scratch();
    expect(inspectCliProjectArgs(["/opt/OPRN/oprn", "main.cjs", "file://%"], root)).toEqual({
      dir: null,
      ignored: ["file://%"],
    });
    expect(inspectCliProjectArgs(["/opt/OPRN/oprn"], root)).toEqual({ dir: null, ignored: [] });
  });

  it("swallows a probe that throws", () => {
    const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", "/tmp/oprn-cli-boom"], "/tmp", {
      isProjectDir: () => { throw new Error("boom"); },
    });
    expect(hit.dir).toBeNull();
    expect(hit.ignored).toEqual(["/tmp/oprn-cli-boom"]);
  });
});
