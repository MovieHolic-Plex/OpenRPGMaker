import { randomBytes } from "node:crypto";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

const ALLOWED_SAVE_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;

/**
 * Validates a relative save path and resolves it strictly inside `saveRootDir`.
 * Accepts both `"saves/slot-01.oprn-save.json"` and `"slot-01.oprn-save.json"`,
 * rejecting path traversal, absolute paths, nested directories, and control chars.
 */
export function resolveSafeSavePath(saveRootDir: string, relativePath: string): {
  readonly fileName: string;
  readonly absolutePath: string;
} {
  if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
    throw new Error("Invalid save file path: empty");
  }
  const normalized = relativePath.replaceAll("\\", "/").trim();
  if (normalized.includes("\0") || normalized.startsWith("/") || /^[a-zA-Z]:/u.test(normalized)) {
    throw new Error(`Invalid save file path: ${relativePath}`);
  }
  const stripped = normalized.startsWith("saves/") ? normalized.slice("saves/".length) : normalized;
  if (stripped.includes("/") || stripped.includes("..") || !ALLOWED_SAVE_FILE.test(stripped)) {
    throw new Error(`Unsafe save file path rejected: ${relativePath}`);
  }
  const root = resolve(saveRootDir);
  const candidate = resolve(root, stripped);
  if (candidate !== join(root, stripped) || !candidate.startsWith(`${root}${sep}`)) {
    throw new Error(`Save path escapes save directory: ${relativePath}`);
  }
  return { fileName: basename(candidate), absolutePath: candidate };
}

/**
 * Picks a writable save directory:
 * 1. Explicit `overrideDir` (e.g. `OPRN_SAVE_DIR`)
 * 2. Portable `preferredDir` (e.g. `<gameDir>/saves` for Steam Auto-Cloud GameInstall) if writable
 * 3. OS-standard `fallbackDir` (e.g. `app.getPath("userData")/saves`)
 */
export function resolveWritableSaveDir(options: {
  readonly overrideDir?: string;
  readonly preferredDir?: string;
  readonly fallbackDir: string;
}): string {
  if (options.overrideDir?.trim()) {
    const dir = resolve(options.overrideDir.trim());
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  if (options.preferredDir?.trim()) {
    const preferred = resolve(options.preferredDir.trim());
    if (isDirectoryWritable(preferred)) {
      return preferred;
    }
  }
  const fallback = resolve(options.fallbackDir);
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

function isDirectoryWritable(dirPath: string): boolean {
  try {
    if (existsSync(dirPath)) {
      accessSync(dirPath, constants.R_OK | constants.W_OK);
      return true;
    }
    const parent = dirname(dirPath);
    if (!existsSync(parent)) return false;
    accessSync(parent, constants.W_OK);
    mkdirSync(dirPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export interface DesktopSaveStore {
  readonly rootDir: string;
  writeSaveFile(relativePath: string, content: string): void;
  readSaveFile(relativePath: string): string | null;
  listSaveFiles(): readonly string[];
  writeScreenshot(slug: string, pngBytes: Uint8Array): string;
}

export function createDesktopSaveStore(saveRootDir: string): DesktopSaveStore {
  const rootDir = resolve(saveRootDir);
  mkdirSync(rootDir, { recursive: true });

  return {
    rootDir,
    writeSaveFile(relativePath: string, content: string): void {
      if (typeof content !== "string") {
        throw new Error("Save content must be a string");
      }
      const { absolutePath } = resolveSafeSavePath(rootDir, relativePath);
      mkdirSync(rootDir, { recursive: true });
      const tmpPath = join(
        rootDir,
        `.tmp-${process.pid}-${Date.now()}-${randomBytes(4).toString("hex")}`,
      );
      try {
        writeFileSync(tmpPath, content, { encoding: "utf8", mode: 0o600 });
        renameSync(tmpPath, absolutePath);
      } catch (error) {
        try {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        } catch {
          // ignore cleanup failure
        }
        throw error;
      }
    },

    readSaveFile(relativePath: string): string | null {
      const { absolutePath } = resolveSafeSavePath(rootDir, relativePath);
      if (!existsSync(absolutePath)) return null;
      return readFileSync(absolutePath, "utf8");
    },

    listSaveFiles(): readonly string[] {
      if (!existsSync(rootDir)) return [];
      const files: string[] = [];
      for (const entry of readdirSync(rootDir)) {
        if (!entry.endsWith(".oprn-save.json") || !ALLOWED_SAVE_FILE.test(entry)) continue;
        const fullPath = join(rootDir, entry);
        try {
          if (statSync(fullPath).isFile()) {
            files.push(`saves/${entry}`);
          }
        } catch {
          // ignore vanished entry
        }
      }
      files.sort((a, b) => a.localeCompare(b));
      return files;
    },

    writeScreenshot(slug: string, pngBytes: Uint8Array): string {
      const screenshotsDir = join(rootDir, "screenshots");
      mkdirSync(screenshotsDir, { recursive: true });
      const safeSlug = slug.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "oprn-game";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = join(screenshotsDir, `${safeSlug}-${stamp}.png`);
      writeFileSync(filePath, pngBytes);
      return filePath;
    },
  };
}
