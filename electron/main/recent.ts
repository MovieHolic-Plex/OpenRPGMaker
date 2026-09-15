import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

type RecentEntry = { readonly projectDir: string; readonly title: string; readonly lastOpenedAt: string };
const MAX_RECENT = 20;

function recentPath(): string {
  return join(app.getPath("userData"), "recent-projects.json");
}

export function listRecentProjects(): readonly RecentEntry[] {
  const path = recentPath();
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry.projectDir === "string") : [];
  } catch { return []; }
}

export function rememberRecentProject(projectDir: string, title: string): void {
  const entries = listRecentProjects().filter((entry) => entry.projectDir !== projectDir);
  entries.unshift({ projectDir, title, lastOpenedAt: new Date().toISOString() });
  const trimmed = entries.slice(0, MAX_RECENT);
  const path = recentPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(trimmed, null, 2));
}

export function recentProjectsPath(): string { return recentPath(); }
