// 윈도에서 CLI 이름(claude·codex·gemini)을 실제 실행 파일로 바꾸고, 띄우는 방법을 정한다.
//
// 왜: 윈도의 npm 전역 CLI 는 `.cmd` 껍데기(codex.cmd·gemini.cmd)다. 셸 없이 맨 이름 'codex' 를 spawn 하면 ENOENT 라
// 감지가 「설치 필요」로 보였다. `.cmd`·`.bat` 은 2024 CVE 수정(BatBadBut) 뒤로 직접 spawn 하면 EINVAL 이다 —
// `cmd.exe /d /s /c` 로 띄우고 인자는 cmd 가 두 번 읽어도(바깥 cmd + 껍데기 안의 %*) 깨지지 않게 이스케이프한다.
// 윈도가 아니면 아무것도 바꾸지 않는다(이름 그대로 spawn).

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { win32 } from "node:path";

export interface ResolveBinaryDeps {
  readonly platform?: NodeJS.Platform;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly exists?: (path: string) => boolean;
  readonly where?: (name: string) => readonly string[];
}

export const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** 윈도 환경 변수는 대소문자를 가리지 않는다(`Path`·`PATH`). `{ ...process.env }` 복사본에서도 같게 읽는다. */
export function envValue(env: Readonly<Record<string, string | undefined>>, key: string): string | undefined {
  if (env[key] !== undefined) return env[key];
  const lower = key.toLowerCase();
  for (const [name, value] of Object.entries(env)) if (name.toLowerCase() === lower && value !== undefined) return value;
  return undefined;
}

function isFile(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}

function whereExe(name: string, env: Readonly<Record<string, string | undefined>>): readonly string[] {
  const out = spawnSync("where.exe", [name], { encoding: "utf8", timeout: 5000, windowsHide: true, env: env as NodeJS.ProcessEnv });
  if (out.error || out.status !== 0) return [];
  return (out.stdout ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

/** PATH 에 없을 때 볼 설치 위치(npm 전역·Claude 설치기·WinGet·Node 설치기). 앱이 PATH 를 갱신하기 전에 떠도 찾게. */
export function windowsFallbackDirs(env: Readonly<Record<string, string | undefined>>): string[] {
  const appData = envValue(env, "APPDATA");
  const localAppData = envValue(env, "LOCALAPPDATA");
  const userProfile = envValue(env, "USERPROFILE");
  const programFiles = envValue(env, "ProgramFiles");
  return [
    appData && win32.join(appData, "npm"),
    localAppData && win32.join(localAppData, "Programs", "claude"),
    userProfile && win32.join(userProfile, ".local", "bin"),
    userProfile && win32.join(userProfile, ".claude", "local"),
    localAppData && win32.join(localAppData, "Microsoft", "WinGet", "Links"),
    programFiles && win32.join(programFiles, "nodejs"),
  ].filter((dir): dir is string => !!dir);
}

/**
 * 실행할 파일 경로. 윈도가 아니면 이름 그대로. 윈도에서 못 찾으면 undefined.
 * 확장자 없는 이름은 PATHEXT 확장자를 붙인 것만 본다 — npm 전역 폴더의 확장자 없는 `codex` 는 sh 스크립트라 실행할 수 없다.
 */
export function resolveBinary(name: string, deps: ResolveBinaryDeps = {}): string | undefined {
  if ((deps.platform ?? process.platform) !== "win32") return name;
  const env = deps.env ?? process.env;
  const exists = deps.exists ?? isFile;
  const exts = (envValue(env, "PATHEXT") || DEFAULT_PATHEXT).split(";").map((ext) => ext.trim().toLowerCase()).filter(Boolean);
  const runnable = (file: string) => exts.some((ext) => file.toLowerCase().endsWith(ext));
  const hasExt = runnable(name);
  // 경로로 준 경우(OPRN_LOCAL_CLI_<ID>=C:\...\claude.cmd): 그 경로만 본다.
  if (/[\\/]/u.test(name) || win32.isAbsolute(name)) {
    return (hasExt ? [name] : [...exts.map((ext) => name + ext), name]).find(exists);
  }
  const pathDirs = (envValue(env, "PATH") ?? "").split(";").map((dir) => dir.trim().replace(/^"(.*)"$/u, "$1")).filter(Boolean);
  for (const dir of [...pathDirs, ...windowsFallbackDirs(env)]) {
    for (const candidate of hasExt ? [win32.join(dir, name)] : exts.map((ext) => win32.join(dir, name + ext))) {
      if (exists(candidate)) return candidate;
    }
  }
  return (deps.where ?? ((n: string) => whereExe(n, env)))(name).find(runnable);
}

// cmd.exe 특수 문자. 공백·쉼표·세미콜론도 인자 구분자라 같이 막는다(cross-spawn 과 같은 목록).
const CMD_META = /([()\][%!^"`<>&|;, *?])/gu;

/**
 * `.cmd`·`.bat` 에 넘길 인자 하나. CommandLineToArgvW 규칙으로 따옴표를 씌운 뒤 cmd 특수 문자를 «두 번» ^ 로 막는다:
 * 바깥 `cmd /c` 가 한 겹, npm 껍데기 안의 `%*` 가 다시 읽으며 한 겹을 벗긴다. 한 겹만 막으면 `a"&calc` 같은 값이
 * 둘째 읽기에서 따옴표를 닫고 명령을 잇는다.
 * 줄바꿈은 cmd 명령줄로 안전하게 넘길 방법이 없다 — 던진다(긴 글·프롬프트는 표준 입력으로 보낸다).
 */
export function cmdEscapeArg(arg: string): string {
  if (/[\r\n\0]/u.test(arg)) throw new Error("줄바꿈이 든 값은 cmd.exe 인자로 넘길 수 없습니다 — 표준 입력으로 보내세요.");
  const quoted = `"${arg.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\*)$/u, "$1$1")}"`;
  return quoted.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

export interface SpawnPlan {
  readonly command: string;
  readonly args: readonly string[];
  /** cmd.exe 로 띄울 때만 true — 우리가 만든 명령줄을 Node 가 다시 따옴표로 감싸지 않게. */
  readonly windowsVerbatimArguments?: boolean;
}

/** spawn 할 것. 윈도가 아니면 `{ command: binary, args }` 그대로. */
export function planSpawn(binary: string, args: readonly string[], deps: ResolveBinaryDeps = {}): SpawnPlan {
  if ((deps.platform ?? process.platform) !== "win32") return { command: binary, args };
  const resolved = resolveBinary(binary, deps) ?? binary;
  if (!/\.(cmd|bat)$/iu.test(resolved)) return { command: resolved, args };
  if (/[\r\n\0]/u.test(resolved)) throw new Error(`실행 파일 경로에 쓸 수 없는 문자가 있습니다: ${resolved}`);
  // /d: 사용자 AutoRun 을 건너뛴다. /s /c "…": 맨 앞·맨 뒤 따옴표 한 쌍만 벗기고 나머지는 그대로 읽는다.
  // 경로는 따옴표 없이 한 겹만 ^ 로 막는다(cross-spawn escapeCommand 와 같다) — 따옴표를 씌우면 경로의 % 가 풀린다.
  const line = [resolved.replace(CMD_META, "^$1"), ...args.map(cmdEscapeArg)].join(" ");
  return { command: envValue(deps.env ?? process.env, "ComSpec") || "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`], windowsVerbatimArguments: true };
}
