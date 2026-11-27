#!/usr/bin/env node
/**
 * CLI for Git-friendly bidirectional conversion between OPRN Studio `project.sqlite` / `.oprn.json`
 * and deterministic multi-file text trees.
 *
 * Usage:
 *   node scripts/project-git-sync.mjs unpack --sqlite <project.sqlite> --out <dir>
 *   node scripts/project-git-sync.mjs unpack --json <file.oprn.json> --out <dir>
 *   node scripts/project-git-sync.mjs pack --dir <dir> --out <project.sqlite|file.oprn.json>
 *   node scripts/project-git-sync.mjs diff-check --dir <dir>
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  GIT_SYNC_FORMAT_FILE,
  packTextFilesToProject,
  unpackProjectToTextFiles,
  validateUnpackedProjectFiles,
} from "../src/project/gitSync.ts";

const IGNORED_NAMES = new Set([".git", ".DS_Store", "Thumbs.db"]);

const SQLITE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  project_id TEXT NOT NULL,
  title TEXT,
  document_version INTEGER NOT NULL,
  current_json TEXT NOT NULL,
  current_sha256 TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS maps (
  project_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  name TEXT,
  width INTEGER,
  height INTEGER,
  tileset_id TEXT,
  map_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, map_id)
);
CREATE TABLE IF NOT EXISTS tileset_blobs (
  sha256 TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

function unfoldTilesetsFromSqlite(db, projectObj) {
  if (!projectObj || typeof projectObj !== "object" || !projectObj.tilesets || typeof projectObj.tilesets !== "object") {
    return projectObj;
  }
  let hasTable = false;
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tileset_blobs'").get();
    hasTable = Boolean(row);
  } catch {
    hasTable = false;
  }
  if (!hasTable) return projectObj;

  const lookup = db.prepare("SELECT body FROM tileset_blobs WHERE sha256 = ?");
  for (const [id, entry] of Object.entries(projectObj.tilesets)) {
    if (entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.$blob === "string" && Object.keys(entry).length === 1) {
      const blobRow = lookup.get(entry.$blob);
      if (!blobRow || typeof blobRow.body !== "string") {
        throw new Error(`Missing tileset_blobs entry ${entry.$blob} for tileset "${id}"`);
      }
      projectObj.tilesets[id] = JSON.parse(blobRow.body);
    }
  }
  return projectObj;
}

function readProjectFromSqlite(sqlitePath) {
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare("SELECT project_id, current_json FROM project WHERE id = 1").get();
    if (!row || typeof row.current_json !== "string") {
      throw new Error(`No project row (id=1) found in ${sqlitePath}`);
    }
    const parsed = JSON.parse(row.current_json);
    const project = unfoldTilesetsFromSqlite(db, parsed);
    const projectId = typeof row.project_id === "string" ? row.project_id : undefined;
    return { project, projectId };
  } finally {
    db.close();
  }
}

function readProjectFromJson(jsonPath) {
  const raw = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw);
  return { project: parsed, projectId: undefined };
}

function readTextTreeDir(rootDir) {
  const files = {};
  function walk(currentDir) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const rel = relative(rootDir, fullPath).replace(/\\/gu, "/");
        files[rel] = readFileSync(fullPath, "utf8");
      }
    }
  }
  walk(rootDir);
  return files;
}

function writeTextTreeDir(outDir, files, { clean = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  if (clean) {
    const expected = new Set(Object.keys(files));
    const existing = readTextTreeDir(outDir);
    for (const rel of Object.keys(existing)) {
      if (!expected.has(rel)) {
        rmSync(join(outDir, rel), { force: true });
      }
    }
  }
  for (const [relPath, content] of Object.entries(files)) {
    const target = join(outDir, relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
}

function writeProjectToSqlite(sqlitePath, project, projectIdOverride) {
  mkdirSync(dirname(resolve(sqlitePath)), { recursive: true });
  const db = new DatabaseSync(sqlitePath);
  try {
    db.exec(SQLITE_SCHEMA_DDL);
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT project_id, revision FROM project WHERE id = 1").get();
    const projectId =
      (existing && typeof existing.project_id === "string" ? existing.project_id : undefined)
      ?? projectIdOverride
      ?? `proj_${randomUUID()}`;
    const nextRevision = (existing && typeof existing.revision === "number" ? existing.revision : 0) + 1;
    const title = typeof project?.meta?.title === "string" ? project.meta.title : "";
    const documentVersion = typeof project?.version === "number" ? project.version : 4;
    const currentJson = JSON.stringify(project);
    const currentSha = sha256Hex(currentJson);

    db.exec("BEGIN");
    try {
      const upsertMeta = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
      upsertMeta.run("format_version", "1");
      upsertMeta.run("project_id", projectId);
      if (!existing) {
        upsertMeta.run("created_at", now);
      }

      if (existing) {
        db.prepare(
          "UPDATE project SET project_id = ?, title = ?, document_version = ?, current_json = ?, current_sha256 = ?, revision = ?, updated_at = ? WHERE id = 1",
        ).run(projectId, title, documentVersion, currentJson, currentSha, nextRevision, now);
      } else {
        db.prepare(
          "INSERT INTO project (id, project_id, title, document_version, current_json, current_sha256, revision, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)",
        ).run(projectId, title, documentVersion, currentJson, currentSha, nextRevision, now);
      }

      db.prepare("DELETE FROM maps WHERE project_id = ?").run(projectId);
      const insertMap = db.prepare(
        "INSERT INTO maps (project_id, map_id, name, width, height, tileset_id, map_json, sha256, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      const maps = project && typeof project.maps === "object" && project.maps ? project.maps : {};
      for (const [mapId, mapValue] of Object.entries(maps)) {
        const mapJson = JSON.stringify(mapValue);
        insertMap.run(
          projectId,
          mapId,
          typeof mapValue?.name === "string" ? mapValue.name : mapId,
          typeof mapValue?.width === "number" ? mapValue.width : 0,
          typeof mapValue?.height === "number" ? mapValue.height : 0,
          typeof mapValue?.tilesetId === "string" ? mapValue.tilesetId : "",
          mapJson,
          sha256Hex(mapJson),
          now,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { projectId, revision: nextRevision, sha256: currentSha };
  } finally {
    db.close();
  }
}

function usage() {
  console.log(`Usage:
  node scripts/project-git-sync.mjs unpack --sqlite <project.sqlite> --out <dir> [--clean]
  node scripts/project-git-sync.mjs unpack --json <file.oprn.json> --out <dir> [--clean]
  node scripts/project-git-sync.mjs pack --dir <dir> --out <project.sqlite|file.oprn.json>
  node scripts/project-git-sync.mjs diff-check --dir <dir>`);
}

function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command || command === "--help" || command === "-h" || flags.help) {
    usage();
    process.exit(0);
  }

  if (command === "unpack") {
    const outDir = typeof flags.out === "string" ? resolve(flags.out) : undefined;
    const sqlitePath = typeof flags.sqlite === "string" ? resolve(flags.sqlite) : undefined;
    const jsonPath = typeof flags.json === "string" ? resolve(flags.json) : undefined;
    if (!outDir || (!sqlitePath && !jsonPath) || (sqlitePath && jsonPath)) {
      console.error("Error: unpack requires --out <dir> and exactly one of --sqlite <path> or --json <path>.");
      process.exit(1);
    }
    const { project, projectId } = sqlitePath ? readProjectFromSqlite(sqlitePath) : readProjectFromJson(jsonPath);
    const files = unpackProjectToTextFiles(project, projectId ? { projectId } : undefined);
    writeTextTreeDir(outDir, files, { clean: Boolean(flags.clean) });
    console.log(
      `[project-git-sync] unpacked ${Object.keys(files).length} files -> ${outDir}${projectId ? ` (projectId=${projectId})` : ""}`,
    );
    return;
  }

  if (command === "pack") {
    const dir = typeof flags.dir === "string" ? resolve(flags.dir) : undefined;
    const outPath = typeof flags.out === "string" ? resolve(flags.out) : undefined;
    if (!dir || !outPath) {
      console.error("Error: pack requires --dir <dir> and --out <project.sqlite|file.oprn.json>.");
      process.exit(1);
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`Error: directory not found: ${dir}`);
      process.exit(1);
    }
    const files = readTextTreeDir(dir);
    let projectId;
    if (files[GIT_SYNC_FORMAT_FILE]) {
      try {
        const header = JSON.parse(files[GIT_SYNC_FORMAT_FILE]);
        if (typeof header?.projectId === "string") projectId = header.projectId;
      } catch {
        // packTextFilesToProject will surface the exact JSON error below
      }
    }
    const project = packTextFilesToProject(files);
    const ext = extname(outPath).toLowerCase();
    if (ext === ".sqlite" || ext === ".db" || flags.sqlite === true) {
      const info = writeProjectToSqlite(outPath, project, projectId);
      console.log(
        `[project-git-sync] packed sqlite -> ${outPath} (projectId=${info.projectId}, revision=${info.revision}, sha256=${info.sha256.slice(0, 12)})`,
      );
    } else {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
      console.log(`[project-git-sync] packed json -> ${outPath}`);
    }
    return;
  }

  if (command === "diff-check") {
    const dir = typeof flags.dir === "string" ? resolve(flags.dir) : undefined;
    if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error("Error: diff-check requires an existing --dir <dir>.");
      process.exit(1);
    }
    const files = readTextTreeDir(dir);
    const report = validateUnpackedProjectFiles(files);
    console.log(
      `[project-git-sync] diff-check ${dir}: ok=${report.ok} maps=${report.counts.maps} tilesets=${report.counts.tilesets} db=${report.counts.databaseKinds} scripts=${report.counts.scripts} assets=${report.counts.uploadedAssets} errors=${report.errors.length} warnings=${report.warnings.length}`,
    );
    for (const issue of report.warnings) {
      console.warn(`  [warn] ${issue.path}: ${issue.message}`);
    }
    for (const issue of report.errors) {
      console.error(`  [error] ${issue.path}: ${issue.message}`);
    }
    if (!report.ok) process.exit(1);
    return;
  }

  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(1);
}

main();
