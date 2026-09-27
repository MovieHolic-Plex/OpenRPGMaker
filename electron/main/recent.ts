import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { app } from "electron";
import { readProjectCoverSource, readProjectFolderSummary } from "../local-store/summary";
import { PROJECT_COVER_FILE, PROJECT_STORE_FILE } from "../local-store/schema";
import type { ProjectCoverSource, RecentProjectEntry, SuggestedProjectDir } from "../shared/start";

type RecentEntry = { readonly projectDir: string; readonly title: string; readonly lastOpenedAt: string };
const MAX_RECENT = 20;
/** 카드 그림 상한. 편집기는 480×300 JPEG(100KB 안팎)을 쓴다 — 이보다 크면 누가 손으로 넣은 파일이다. */
const MAX_COVER_BYTES = 1_000_000;
const DEFAULT_PROJECT_NAME = "새 게임";

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

function temporaryRoots(): readonly string[] {
  const roots = new Set<string>(["/tmp"]);
  try { roots.add(realpathSync(tmpdir())); } catch { roots.add(tmpdir()); }
  return [...roots];
}

/**
 * 임시 폴더 아래 프로젝트는 QA·패키징 점검이 남긴 것이다. 실측(2026-09-27): 최근 목록 20줄 중
 * 19줄이 `/tmp/oprn-packaged-*` 였고 사용자의 진짜 게임은 한 줄이었다. 지우지 않고 기본으로 숨긴다.
 */
function isTemporaryDir(projectDir: string, roots: readonly string[]): boolean {
  return roots.some((root) => projectDir === root || projectDir.startsWith(root + sep));
}

function coverDataUrl(projectDir: string): string | null {
  const path = join(projectDir, PROJECT_COVER_FILE);
  try {
    if (!existsSync(path) || statSync(path).size > MAX_COVER_BYTES) return null;
    const bytes = readFileSync(path);
    // JPEG 표식(FF D8)이 아니면 싣지 않는다 — data URL 로 무엇이든 시작 화면에 그리게 두지 않는다.
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    return "data:image/jpeg;base64," + bytes.toString("base64");
  } catch {
    return null;
  }
}

/** cover.jpg 가 마지막 저장보다 1분 넘게 오래됐는가. 편집기는 저장 뒤 1분 안에 다시 굽는다. */
function isCoverStale(projectDir: string, updatedAt: string | null): boolean {
  const saved = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(saved)) return false;
  try {
    return statSync(join(projectDir, PROJECT_COVER_FILE)).mtimeMs + 60_000 < saved;
  } catch {
    return false;
  }
}

/** 시작 화면 최근 목록. 제목·마지막 편집·맵 수는 폴더의 project.sqlite 에서 읽는다(기록된 제목은 경로일 때가 많다). */
export function describeRecentProjects(): readonly RecentProjectEntry[] {
  const roots = temporaryRoots();
  return listRecentProjects().map((entry): RecentProjectEntry => {
    const exists = existsSync(join(entry.projectDir, PROJECT_STORE_FILE));
    const summary = exists ? readProjectFolderSummary(entry.projectDir) : null;
    const storedTitle = entry.title && entry.title !== entry.projectDir ? entry.title : null;
    const cover = exists ? coverDataUrl(entry.projectDir) : null;
    return {
      projectDir: entry.projectDir,
      title: summary?.title || storedTitle || entry.projectDir.split(/[\\/]/).filter(Boolean).pop() || entry.projectDir,
      lastOpenedAt: entry.lastOpenedAt ?? null,
      updatedAt: summary?.updatedAt ?? null,
      mapCount: summary?.mapCount ?? null,
      cover,
      coverStale: cover !== null && isCoverStale(entry.projectDir, summary?.updatedAt ?? null),
      hiddenReason: !exists ? "missing" : isTemporaryDir(entry.projectDir, roots) ? "temporary" : null,
    };
  });
}

/**
 * 시작 화면이 부르는 폴더 경로는 **최근 목록에 있는 것만** 받는다. 렌더러가 준 아무 경로나 열거나 쓰지 않는다.
 */
function recentProjectDir(projectDir: unknown): string | null {
  if (typeof projectDir !== "string" || !projectDir) return null;
  const known = listRecentProjects().some((entry) => entry.projectDir === projectDir);
  return known && existsSync(join(projectDir, PROJECT_STORE_FILE)) ? projectDir : null;
}

/** 최근 목록의 프로젝트에서 카드 그림 재료(시작 맵 + 타일셋)를 읽는다. */
export function recentProjectCoverSource(projectDir: unknown): ProjectCoverSource | null {
  const dir = recentProjectDir(projectDir);
  return dir ? readProjectCoverSource(dir) : null;
}

/** 시작 화면이 구운 카드 그림을 최근 목록의 그 폴더에 남긴다. JPEG·1MB 상한은 편집기 경로와 같다. */
export function writeRecentProjectCover(projectDir: unknown, dataUrl: unknown): boolean {
  const dir = recentProjectDir(projectDir);
  if (!dir || typeof dataUrl !== "string") return false;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) return false;
  const bytes = Buffer.from(match[1]!, "base64");
  if (bytes.length > MAX_COVER_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  writeFileSync(join(dir, PROJECT_COVER_FILE), bytes);
  return true;
}

/** 새 게임 폴더의 기본 상위 위치. QA 하니스는 OPRN_NEW_PROJECT_ROOT 로 임시 폴더를 준다(대화상자를 자동화할 수 없다). */
export function defaultProjectRoot(): string {
  const override = process.env.OPRN_NEW_PROJECT_ROOT;
  if (override && isAbsolute(override)) return resolve(override);
  return join(app.getPath("documents"), "OPRN Games");
}

function folderNameFor(title: string | undefined): string {
  const cleaned = (title ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 60)
    .trim();
  return cleaned || DEFAULT_PROJECT_NAME;
}

function isUsableNewDir(path: string): boolean {
  if (!existsSync(path)) return true;
  try {
    return statSync(path).isDirectory() && readdirSync(path).length === 0;
  } catch {
    return false;
  }
}

/** `<root>/<이름>` 이 이미 쓰이고 있으면 `<이름> 2`, `<이름> 3` … 으로 비켜 간다. */
export function suggestProjectDir(title: string | undefined, root: string = defaultProjectRoot()): SuggestedProjectDir {
  const base = folderNameFor(title);
  for (let index = 1; index < 1000; index += 1) {
    const candidate = join(root, index === 1 ? base : base + " " + index);
    if (isUsableNewDir(candidate)) return { root, projectDir: candidate };
  }
  return { root, projectDir: join(root, base + " " + Date.now()) };
}

/**
 * 시작 화면이 고른 새 폴더를 준비한다. 절대 경로여야 하고, 없거나 비어 있어야 한다 —
 * 이미 무언가 있는 폴더에 새 프로젝트를 심으면 사용자의 파일 옆에 project.sqlite 가 생긴다.
 */
export function prepareNewProjectDir(projectDir: string): string {
  if (!isAbsolute(projectDir)) throw new Error("새 프로젝트 폴더는 절대 경로여야 합니다.");
  const dir = resolve(projectDir);
  if (!isUsableNewDir(dir)) throw new Error("이미 파일이 있는 폴더입니다. 다른 이름이나 위치를 골라 주세요.");
  mkdirSync(dir, { recursive: true });
  return dir;
}
