import { spawnSync } from "node:child_process";
import {
  chmodSync, constants, copyFileSync, cpSync, createWriteStream, lstatSync, mkdirSync, mkdtempSync,
  readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";

const markerName = ".oprn-qa-base.json";
const unpackedBackupLimit = 1_000_000_000;
const tarEnv = { ...process.env, TAR_OPTIONS: "" };
const tarEscapes = { a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\" };
const usage = [
  "node overlay-qa-bundle.mjs [--reset] <qa-bundle.tgz> <extracted-appimage-root>",
  "node overlay-qa-bundle.mjs --restore <extracted-appimage-root>",
].join("\n");

function within(parent, path) {
  const name = relative(parent, path);
  return name !== ".." && !name.startsWith(`..${sep}`) && !isAbsolute(name);
}

function fileStat(path) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && !stat.isFile()) throw new Error(`Expected a regular file: ${path}`);
  return stat;
}

function directoryExists(path) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && !stat.isDirectory()) throw new Error(`Expected a real directory: ${path}`);
  return Boolean(stat);
}

function baseInfo(stat) {
  return { size: stat.size, mtimeMs: stat.mtimeMs };
}

function checkBase(app, base) {
  const marker = join(app, markerName);
  if (!fileStat(marker)) throw new Error(`Refusing to replace unmanaged app directory: ${app}`);
  const saved = JSON.parse(readFileSync(marker, "utf8"));
  if (saved.size !== base.size || saved.mtimeMs !== base.mtimeMs) {
    throw new Error(`Overlay base differs from the saved ASAR: ${app}`);
  }
}

async function readAt(archive, length, start) {
  const bytes = Buffer.alloc(length);
  for (let offset = 0; offset < length;) {
    const { bytesRead } = await archive.read(bytes, offset, length - offset, start + offset);
    if (bytesRead === 0) throw new Error("Truncated ASAR header");
    offset += bytesRead;
  }
  return bytes;
}

async function extractAsar(asar, unpacked, target, base, mirrored) {
  const archive = await open(asar, "r");
  try {
    // Chromium pickle 바깥 길이 뒤에 헤더 pickle(문자열 길이·JSON·패딩)이 온다.
    const lead = await readAt(archive, 16, 0);
    const headerSize = lead.readUInt32LE(4);
    const dataStart = 8 + headerSize;
    const jsonSize = lead.readUInt32LE(12);
    if (lead.readUInt32LE(0) !== 4 || headerSize < 8 || dataStart > base.size
      || jsonSize > headerSize - 8 || jsonSize > 128 * 1024 * 1024) {
      throw new Error(`Invalid ASAR header: ${asar}`);
    }
    const { files } = JSON.parse((await readAt(archive, jsonSize, 16)).toString("utf8"));
    const links = [];

    async function unpack(entries, subdir = "") {
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("Invalid ASAR directory");
      for (const [name, node] of Object.entries(entries)) {
        if (!name || name === "." || name === ".." || /[/\\\0]/.test(name)) {
          throw new Error(`Invalid ASAR path component: ${name}`);
        }
        const path = join(subdir, name);
        const dest = join(target, path);
        if (node.files) {
          mkdirSync(dest);
          await unpack(node.files, path);
        } else if (typeof node.link === "string") {
          const source = resolve(target, node.link);
          if (isAbsolute(node.link) || !within(target, source)) throw new Error(`ASAR link escapes app: ${path}`);
          links.push([relative(dirname(dest), source) || ".", dest]);
        } else {
          const size = node.size;
          if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid ASAR file size: ${path}`);
          const mode = node.executable ? 0o755 : 0o644;
          if (node.unpacked) {
            // 앱 폴더에서도 워커·네이티브·참고 그림을 함께 찾을 수 있게 원본을 복사한다.
            const source = realpathSync(join(unpacked, path));
            if (!within(unpacked, source)) throw new Error(`Unpacked ASAR file escapes its directory: ${path}`);
            const stat = fileStat(source);
            // 백업 없이 재적용할 때는 기록된 QA 사본의 크기가 원본과 다를 수 있다.
            if (!stat || (!mirrored.has(path) && stat.size !== size)) {
              throw new Error(`Invalid unpacked ASAR file: ${path}`);
            }
            copyFileSync(source, dest, constants.COPYFILE_FICLONE);
            if (node.executable) chmodSync(dest, mode);
          } else {
            const start = dataStart + Number(node.offset);
            if (!/^\d+$/.test(node.offset) || !Number.isSafeInteger(start) || start < dataStart || size > base.size - start) {
              throw new Error(`Invalid ASAR file range: ${path}`);
            }
            if (size === 0) writeFileSync(dest, "", { mode });
            else await pipeline(
              archive.createReadStream({ start, end: start + size - 1, autoClose: false }),
              createWriteStream(dest, { mode }),
            );
          }
        }
      }
    }

    await unpack(files);
    // 링크를 마지막에 만들어 파일을 푸는 도중 링크를 경유하지 않게 한다.
    for (const [source, dest] of links) symlinkSync(source, dest);
  } finally {
    await archive.close();
  }
}

function fitsUnpackedBackup(dir) {
  let bytes = 0;
  const dirs = [dir];
  while (dirs.length) {
    const parent = dirs.pop();
    for (const name of readdirSync(parent)) {
      const path = join(parent, name);
      const stat = lstatSync(path);
      if (stat.isDirectory()) dirs.push(path);
      else bytes += stat.size;
      if (bytes >= unpackedBackupLimit) return false;
    }
  }
  return true;
}

function saveUnpackedBackup(unpacked, backup) {
  if (!directoryExists(unpacked)) return;
  if (!fitsUnpackedBackup(unpacked)) {
    console.warn(`Skipped ${unpacked} backup (1 GB or larger)`);
    return;
  }
  const temp = mkdtempSync(join(dirname(backup), ".oprn-qa-unpacked-"));
  try {
    const copy = join(temp, "unpacked");
    cpSync(unpacked, copy, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
    renameSync(copy, backup);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function restoreUnpacked(unpacked, backup) {
  const retired = mkdtempSync(join(dirname(unpacked), ".oprn-qa-retired-"));
  const previous = join(retired, "unpacked");
  const hasUnpacked = directoryExists(unpacked);
  try {
    if (hasUnpacked) renameSync(unpacked, previous);
    try {
      renameSync(backup, unpacked);
    } catch (error) {
      if (hasUnpacked) renameSync(previous, unpacked);
      throw error;
    }
  } finally {
    // Leave the displaced directory available if rolling back the rename also failed.
    if (directoryExists(unpacked)) rmSync(retired, { recursive: true, force: true });
  }
}

function isUnpackedPayload(path) {
  if (/^dist\/assets\/.*\.(png|jpg|jpeg|webp)$/s.test(path)) return true;
  if (!path.startsWith("dist-electron/")) return false;
  return path.startsWith("dist-electron/agent-npm/") || path.startsWith("dist-electron/worker-data/") ||
    /^(oh-my-pi-worker.*|pi_natives.*\.node|oprn-agent-mode-mcp\.mjs)$/s.test(basename(path));
}

function unpackedParent(dir) {
  if (!directoryExists(dir)) {
    unpackedParent(dirname(dir));
    mkdirSync(dir);
  }
  if (realpathSync(dir) !== dir) throw new Error(`Unpacked destination uses a linked directory: ${dir}`);
}

function mirrorBundle(bundle, app, unpacked, backup, marker, mirrored) {
  const list = spawnSync("tar", ["-tzf", bundle, "--quoting-style=escape"], {
    env: { ...tarEnv, LC_ALL: "C" }, stdio: ["ignore", "pipe", "inherit"], encoding: "latin1", maxBuffer: 64 * 1024 * 1024,
  });
  if (list.error) throw list.error;
  if (list.status !== 0) throw new Error(`QA bundle listing failed (${list.signal ?? list.status})`);

  const files = new Map();
  for (const line of list.stdout.split("\n")) {
    // GNU tar quotes embedded newlines and emits non-ASCII bytes as octal in the C locale.
    const bytes = line.replace(/\\([0-7]{3}|[abfnrtv\\])/g, (_, escape) =>
      tarEscapes[escape] ?? String.fromCharCode(Number.parseInt(escape, 8)));
    const entry = Buffer.from(bytes, "latin1").toString("utf8");
    if (!entry || entry.endsWith("/")) continue;
    const source = resolve(app, entry);
    if (!within(app, source)) throw new Error(`QA bundle path escapes app: ${entry}`);
    const path = relative(app, source);
    const stat = lstatSync(source, { throwIfNoEntry: false });
    const dest = join(unpacked, path);
    if (!stat?.isFile() || (!isUnpackedPayload(path) && !lstatSync(dest, { throwIfNoEntry: false }))) continue;
    if (realpathSync(source) !== source) throw new Error(`QA bundle file uses a linked directory: ${path}`);
    files.set(path, stat.mode & 0o777);
  }

  if (!fileStat(marker) && !directoryExists(backup)) saveUnpackedBackup(unpacked, backup);
  if (files.size) {
    const temp = mkdtempSync(join(dirname(marker), ".oprn-qa-mirror-"));
    try {
      const paths = [...new Set([...mirrored, ...files.keys()])].sort();
      const record = join(temp, "mirrored.json");
      writeFileSync(record, JSON.stringify(paths, null, 2) + "\n");
      renameSync(record, marker);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  for (const [path, mode] of files) {
    const dest = join(unpacked, path);
    unpackedParent(dirname(dest));
    if (lstatSync(dest, { throwIfNoEntry: false })) unlinkSync(dest);
    copyFileSync(join(app, path), dest, constants.COPYFILE_EXCL);
    chmodSync(dest, mode);
  }
  console.log(`Mirrored ${files.size} files into ${unpacked}`);
}

async function main() {
  const { values: flags, positionals } = parseArgs({
    options: { reset: { type: "boolean" }, restore: { type: "boolean" }, help: { type: "boolean" } },
    allowPositionals: true,
  });
  if (flags.help) {
    console.log(usage);
    return;
  }
  if (flags.reset && flags.restore) throw new Error("Choose either --reset or --restore");
  if (flags.restore ? (positionals.length < 1 || positionals.length > 2) : positionals.length !== 2) {
    throw new Error("Missing or unexpected arguments");
  }

  const root = realpathSync(positionals.at(-1));
  const resources = join(root, "resources");
  if (!directoryExists(resources)) throw new Error(`Missing AppImage resources directory: ${resources}`);
  const asar = join(resources, "app.asar");
  const original = join(resources, "app.asar.qa-orig");
  const unpacked = join(resources, "app.asar.unpacked");
  const unpackedBackup = join(resources, "app.asar.unpacked.qa-orig");
  const mirrorMarker = join(resources, ".oprn-qa-mirrored.json");
  const mirrored = new Set(fileStat(mirrorMarker) ? JSON.parse(readFileSync(mirrorMarker, "utf8")) : []);
  const app = join(resources, "app");
  const asarStat = fileStat(asar);
  const originalStat = fileStat(original);
  if (asarStat && originalStat) throw new Error(`Both ASAR files exist: ${asar}, ${original}`);
  if (!asarStat && !originalStat) throw new Error(`Missing base archive: ${asar}`);
  const base = baseInfo(asarStat ?? originalStat);
  let hasApp = directoryExists(app);
  if (hasApp) checkBase(app, base);

  let bundle;
  if (!flags.restore) {
    bundle = realpathSync(positionals[0]);
    if (!fileStat(bundle) || [app, unpacked, unpackedBackup].some(dir => within(dir, bundle))) {
      throw new Error("Bundle must be a file outside resources/app and the unpacked directories");
    }
  }

  if (flags.reset || flags.restore) {
    if (directoryExists(unpackedBackup)) {
      restoreUnpacked(unpacked, unpackedBackup);
      rmSync(mirrorMarker, { force: true });
      mirrored.clear();
      console.log(`Restored ${unpacked}`);
    } else if (mirrored.size) {
      console.warn(`Warning: ${unpacked} may contain QA copies. Re-extract the AppImage for an exact restore.`);
    }
    if (originalStat) renameSync(original, asar);
    if (hasApp) {
      const retired = mkdtempSync(join(resources, ".oprn-qa-retired-"));
      try {
        // 삭제가 중단돼도 Electron 이 반쯤 지운 앱을 고르지 않게 먼저 옮긴다.
        renameSync(app, join(retired, "app"));
      } finally {
        rmSync(retired, { recursive: true, force: true });
      }
      hasApp = false;
    }
    if (flags.restore) {
      console.log(`Restored ${asar}`);
      return;
    }
  }

  if (!hasApp) {
    const source = fileStat(asar) ? asar : original;
    const temp = mkdtempSync(join(resources, ".oprn-qa-app-"));
    try {
      console.log(`Extracting ${source} into ${app}`);
      await extractAsar(source, unpacked, temp, base, mirrored);
      writeFileSync(join(temp, markerName), JSON.stringify(base) + "\n", { flag: "wx" });
      // 압축 해제가 끝난 앱을 기본 AppImage 와 같은 접근 권한으로 올린다.
      chmodSync(temp, 0o755);
      renameSync(temp, app);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  if (fileStat(asar)) renameSync(asar, original);

  // 같은 파일이 링크여도 원본을 건드리지 않도록 기존 항목을 먼저 떼고 새 파일을 쓴다.
  const result = spawnSync("tar", [
    "-xzf", bundle, "-C", app, "--unlink-first", "--no-same-owner", "--no-same-permissions",
  ], { stdio: "inherit", env: tarEnv });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`QA bundle extraction failed (${result.signal ?? result.status}). Fix the bundle and retry or use --restore.`);
  mirrorBundle(bundle, app, unpacked, unpackedBackup, mirrorMarker, mirrored);

  const manifest = JSON.parse(readFileSync(join(app, "qa-bundle.json"), "utf8"));
  console.log(`QA bundle ${manifest.gitSha} (${manifest.branch}${manifest.dirty ? ", dirty" : ""})`);
  const binary = lstatSync(join(root, "AppRun"), { throwIfNoEntry: false }) ? "AppRun" : "oprn";
  console.log(`Launch ${JSON.stringify(join(root, binary))}`);
}

try {
  await main();
} catch (error) {
  console.error(`overlay-qa-bundle: ${error.message}\n${usage}`);
  process.exitCode = 1;
}
