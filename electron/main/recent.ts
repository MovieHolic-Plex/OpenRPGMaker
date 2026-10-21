import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { app } from "electron";
import { readProjectCoverSource, readProjectFolderSummary } from "../local-store/summary";
import { PROJECT_STORE_FILE } from "../local-store/schema";
import { PROJECT_COVER_VERSION, type ProjectCoverSource, type RecentProjectEntry, type SuggestedProjectDir } from "../shared/start";
import type { RecentTeamEntry } from "../shared/start";

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

const MAX_RECENT_TEAMS = 8;

function recentTeamsPath(): string {
  return join(app.getPath("userData"), "recent-teams.json");
}

/** 초대 비밀(#join=)과 로그인 이후 경로는 버리고, 호스트 주소와 hostProject 만 남긴다. */
export function teamEntryUrl(target: URL): string {
  const url = new URL(target.origin + "/");
  const project = target.searchParams.get("hostProject");
  if (project) url.searchParams.set("hostProject", project);
  return url.href;
}

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21). */
export function listRecentTeams(): readonly RecentTeamEntry[] {
  const path = recentTeamsPath();
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry?.url === "string" && URL.canParse(entry.url) && typeof entry?.lastJoinedAt === "string").slice(0, MAX_RECENT_TEAMS)
      : [];
  } catch { return []; }
}

/** @deprecated multi-user team collaboration is not supported yet (2026-10-21). */
export function rememberRecentTeam(target: URL): void {
  const url = teamEntryUrl(target);
  const entries = [{ url, lastJoinedAt: new Date().toISOString() }, ...listRecentTeams().filter((entry) => entry.url !== url)];
  const path = recentTeamsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(entries.slice(0, MAX_RECENT_TEAMS), null, 2));
}

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

/**
 * 시작 화면 카드 그림 캐시(2026-10-20). 프로젝트 폴더의 cover.jpg(편집기가 남기는 옛 1배 그림)를 쓰지 않고,
 * 앱 데이터 폴더에 「폴더 해시-문서 해시」 이름으로 둔다. 문서가 바뀌면(current_sha256) 열쇠가 바뀌어 다시 굽는다 —
 * 목록을 읽을 때는 파일이 있는지만 본다(맵을 읽거나 그리지 않는다). 빈 맵은 .empty 표식만 남긴다.
 */
function coverCacheDir(): string {
  return join(app.getPath("userData"), "start-covers");
}

function dirKey(projectDir: string): string {
  return createHash("sha256").update(projectDir).digest("hex").slice(0, 16);
}

/** 문서 해시가 없는 옛 저장소는 마지막 저장 시각으로 대신한다. 둘 다 없으면 null(캐시하지 않는다). */
function coverKey(projectDir: string, contentHash: string | null, updatedAt: string | null): string | null {
  const content = contentHash ?? updatedAt;
  if (!content) return null;
  return `${dirKey(projectDir)}-${createHash("sha256").update(`${PROJECT_COVER_VERSION}\n${content}`).digest("hex").slice(0, 16)}`;
}

function readCachedCover(key: string): { readonly cover: string | null; readonly empty: boolean } {
  const base = join(coverCacheDir(), key);
  if (existsSync(base + ".empty")) return { cover: null, empty: true };
  try {
    const path = base + ".jpg";
    if (!existsSync(path) || statSync(path).size > MAX_COVER_BYTES) return { cover: null, empty: false };
    const bytes = readFileSync(path);
    // JPEG 표식(FF D8)이 아니면 싣지 않는다 — data URL 로 무엇이든 시작 화면에 그리게 두지 않는다.
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return { cover: null, empty: false };
    return { cover: "data:image/jpeg;base64," + bytes.toString("base64"), empty: false };
  } catch {
    return { cover: null, empty: false };
  }
}

/** 시작 화면 최근 목록. 제목·마지막 편집·맵 수는 폴더의 project.sqlite 에서 읽는다(기록된 제목은 경로일 때가 많다). */
export function describeRecentProjects(): readonly RecentProjectEntry[] {
  const roots = temporaryRoots();
  return listRecentProjects().map((entry): RecentProjectEntry => {
    const exists = existsSync(join(entry.projectDir, PROJECT_STORE_FILE));
    const summary = exists ? readProjectFolderSummary(entry.projectDir) : null;
    const storedTitle = entry.title && entry.title !== entry.projectDir ? entry.title : null;
    const key = summary ? coverKey(entry.projectDir, summary.contentHash, summary.updatedAt) : null;
    const cached = key ? readCachedCover(key) : { cover: null, empty: false };
    return {
      projectDir: entry.projectDir,
      title: summary?.title || storedTitle || entry.projectDir.split(/[\\/]/).filter(Boolean).pop() || entry.projectDir,
      lastOpenedAt: entry.lastOpenedAt ?? null,
      updatedAt: summary?.updatedAt ?? null,
      mapCount: summary?.mapCount ?? null,
      cover: cached.cover,
      coverEmpty: cached.empty,
      coverStale: false,
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

/**
 * 시작 화면이 구운 카드 그림을 캐시에 남긴다. dataUrl 이 "empty" 면 빈 맵 표식. JPEG·1MB 상한은 편집기 경로와 같다.
 * 같은 폴더의 옛 열쇠 파일은 지운다(문서가 바뀔 때마다 쌓이지 않게).
 */
export function writeRecentProjectCover(projectDir: unknown, dataUrl: unknown): boolean {
  const dir = recentProjectDir(projectDir);
  if (!dir || typeof dataUrl !== "string") return false;
  const summary = readProjectFolderSummary(dir);
  const key = summary ? coverKey(dir, summary.contentHash, summary.updatedAt) : null;
  if (!key) return false;
  let bytes: Buffer | null = null;
  if (dataUrl !== "empty") {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
    if (!match) return false;
    bytes = Buffer.from(match[1]!, "base64");
    if (bytes.length > MAX_COVER_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  }
  const folder = coverCacheDir();
  mkdirSync(folder, { recursive: true });
  const prefix = dirKey(dir) + "-";
  for (const name of readdirSync(folder)) {
    if (name.startsWith(prefix) && !name.startsWith(key + ".")) rmSync(join(folder, name), { force: true });
  }
  if (bytes) writeFileSync(join(folder, key + ".jpg"), bytes);
  else writeFileSync(join(folder, key + ".empty"), "");
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
