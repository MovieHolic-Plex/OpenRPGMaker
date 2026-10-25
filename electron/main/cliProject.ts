// 명령줄로 넘긴 프로젝트 폴더(AppImage /path · AppRun /path · 두 번째 실행의 argv).
//
// 판정만 한다. Electron 을 부르지 않는다 — 시작 입구(boot.ts)와 본체(main.ts)가 둘 다 쓰고,
// 입구 번들은 200KB 를 넘기면 스플래시가 늦어진다.
//
// 메뉴 「폴더 열기」는 project.sqlite 가 없는 폴더도 연다(스토어를 만든다). 명령줄은 그렇게 하지 않는다.
// 오타가 난 경로에 project.sqlite 를 심으면 사용자의 폴더가 프로젝트가 된다. 없거나 프로젝트가 아니면 무시한다.
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** electron/local-store/schema.ts 의 PROJECT_STORE_FILE 과 같다. 스키마 모듈은 SQL 을 품고 있어 입구에 끌려오지 않게 여기 적는다. */
export const CLI_PROJECT_STORE_FILE = "project.sqlite";

const DEEP_LINK_PREFIX = "oprn:";

export type CliProjectHit = {
  readonly dir: string | null;
  readonly ignored: readonly string[];
};

export type CliProjectOptions = {
  /** argv 에서 사용자 인자가 시작되는 칸. 배포 앱은 1(실행 파일 다음), `electron .` 은 2(실행 파일·앱 경로 다음). */
  readonly fromIndex?: number;
  readonly homedir?: string;
  /** 절대 경로가 프로젝트 폴더인지. 기본은 디렉터리이고 project.sqlite 가 파일인 경우. */
  readonly isProjectDir?: (absoluteDir: string) => boolean;
};

/** `electron <앱경로>` 로 띄운 개발 실행은 argv[1] 이 앱이지 사용자가 연 폴더가 아니다. */
export function electronUserArgIndex(defaultApp = Boolean((process as { defaultApp?: boolean }).defaultApp)): number {
  return defaultApp ? 2 : 1;
}

export function isCliSwitch(arg: string): boolean {
  return arg.startsWith("-");
}

export function isOprnDeepLink(arg: string): boolean {
  return arg.toLowerCase().startsWith(DEEP_LINK_PREFIX);
}

/**
 * 위치 인자 중 첫 프로젝트 폴더. 스위치·oprn: 링크·실행 파일 경로는 건너뛴다.
 * 경로처럼 보이는데 프로젝트가 아니면 `ignored` 에 넣고 계속 본다(하나 실패가 다음 인자를 막지 않는다).
 */
export function inspectCliProjectArgs(argv: readonly string[], cwd: string, options: CliProjectOptions = {}): CliProjectHit {
  const fromIndex = options.fromIndex ?? 1;
  const home = options.homedir ?? homedir();
  const isProjectDir = options.isProjectDir ?? defaultIsProjectDir;
  const ignored: string[] = [];
  for (let index = Math.max(0, fromIndex); index < argv.length; index += 1) {
    const raw = argv[index];
    if (typeof raw !== "string") continue;
    const arg = raw.trim();
    if (arg.length === 0 || isCliSwitch(arg) || isOprnDeepLink(arg)) continue;
    const abs = argumentPath(arg, cwd, home);
    if (abs === null) {
      if (looksLikePathAttempt(arg)) ignored.push(arg);
      continue;
    }
    let matched = false;
    try {
      matched = isProjectDir(abs);
    } catch {
      matched = false;
    }
    if (matched) {
      let dir = abs;
      try { dir = realpathSync(abs); } catch { /* 검사기가 아직 없는 경로를 가리키면 해석한 경로를 그대로 둔다. */ }
      return { dir, ignored };
    }
    // 배포 래퍼가 앱 경로(app.asar·main.cjs)를 인자로 넣는 경우가 있다. 폴더가 아니므로 경고하지 않는다.
    if (looksLikePathAttempt(arg) && !isAppEntryFile(abs)) ignored.push(abs);
  }
  return { dir: null, ignored };
}

let cached: CliProjectHit | null = null;

/**
 * 이 프로세스의 argv. QA 진입점(OPRN_OPEN_PROJECT_DIR·OPRN_SMOKE_PAGE)이면 폴더 인자를 보지 않는다.
 * 그 변수는 단일 인스턴스 잠금을 끄므로, 명령줄 폴더와 섞이면 하니스가 서로의 창을 연다.
 */
export function inspectCurrentCliProject(): CliProjectHit {
  if (cached) return cached;
  if (process.env.OPRN_SMOKE_PAGE !== undefined || process.env.OPRN_OPEN_PROJECT_DIR !== undefined) {
    cached = { dir: null, ignored: [] };
    return cached;
  }
  cached = inspectCliProjectArgs(process.argv, process.cwd(), { fromIndex: electronUserArgIndex() });
  return cached;
}

function isAppEntryFile(abs: string): boolean {
  if (!/\.(?:asar|cjs|mjs|js)$/i.test(abs)) return false;
  try { return statSync(abs).isFile(); } catch { return false; }
}

function defaultIsProjectDir(absoluteDir: string): boolean {
  try {
    if (!statSync(absoluteDir).isDirectory()) return false;
    return statSync(join(absoluteDir, CLI_PROJECT_STORE_FILE)).isFile();
  } catch {
    return false;
  }
}

function argumentPath(arg: string, cwd: string, home: string): string | null {
  if (arg.toLowerCase().startsWith("file:")) {
    try {
      const url = new URL(arg);
      if (url.protocol !== "file:") return null;
      return fileURLToPath(url);
    } catch {
      return null;
    }
  }
  let expanded = arg;
  if (expanded === "~") expanded = home;
  else if (expanded.startsWith("~/") || expanded.startsWith("~\\")) expanded = join(home, expanded.slice(2));
  try {
    return resolve(cwd, expanded);
  } catch {
    return null;
  }
}

/** 스위치가 아닌데 사용자가 경로로 넣었다고 볼 만한 것. `main.cjs` 같은 맨 이름은 개발 실행 인자라 경고하지 않는다. */
function looksLikePathAttempt(arg: string): boolean {
  if (arg === "." || arg === "..") return true;
  if (arg.startsWith("./") || arg.startsWith("../") || arg.startsWith(".\\") || arg.startsWith("..\\")) return true;
  if (arg.startsWith("~") || arg.toLowerCase().startsWith("file:")) return true;
  // `C:\게임` 도 경로다. 구분자만 보면 된다(절대 경로 판정은 resolve 가 한다).
  return arg.includes("/") || arg.includes("\\");
}
