import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { PROJECT_STORE_FILE } from "../local-store/schema";

export function containsPath(parent: string, child: string): boolean {
  const suffix = relative(parent, child);
  return suffix !== ".." && !suffix.startsWith(".." + sep) && !isAbsolute(suffix);
}

/** IPC only accepts an exact recent entry. Check membership before inspecting the filesystem. */
export function validateRecentFolder(
  path: unknown,
  entries: readonly { readonly projectDir: string }[],
  inspect: (path: string) => string | null,
): string | null {
  if (!isProjectFolderPath(path) || !entries.some((entry) => entry.projectDir === path)) return null;
  const canonical = inspect(path);
  // A saved path that now resolves through a link could point at a different project.
  return canonical && relative(path, canonical) === "" ? canonical : null;
}

function isProjectFolderPath(path: unknown): path is string {
  return typeof path === "string" && isAbsolute(path) && !path.includes("\0")
    && resolve(path) === path && path !== parse(path).root;
}

export function inspectProjectFolder(path: unknown): string | null {
  if (!isProjectFolderPath(path)) return null;
  try {
    const canonical = realpathSync(path);
    return lstatSync(canonical).isDirectory() && lstatSync(join(canonical, PROJECT_STORE_FILE)).isFile() ? canonical : null;
  } catch {
    return null;
  }
}
