// 시작 입구(boot.ts → dist-electron/main.cjs)와 앱 본체(main.ts → dist-electron/app.cjs)가 나누는 것.
// 입구는 가볍게 두어 app ready 직후 스플래시를 띄우고, 그다음에 본체(약 4MB)를 읽는다 — 본체 평가가 ready 와
// 스플래시를 늦추지 않게(2026-10-21 실측: 본체를 먼저 평가하면 ready 가 약 0.2s 늦었다).
import { join } from "node:path";
import { app } from "electron";
import { inspectCurrentCliProject, projectDirFromOpenPath, shouldBootToStartScreen } from "./cliProject";
import type { Splash } from "./splash";

/** 이미 떠 있는 앱으로 넘어온 두 번째 실행. cwd 는 그 실행의 작업 폴더(상대 경로를 여기서 푼다). */
export type SecondInstanceLaunch = {
  readonly argv: readonly string[];
  readonly cwd: string;
};

export type BootContext = {
  /** 시작 화면으로 켜질 때 띄운 스플래시. QA 진입점·OPRN_SPLASH=0 이면 없다. */
  readonly splash: Splash | undefined;
  /** 스플래시의 「다시 시도」가 부를 함수를 정한다. */
  readonly setRetry: (retry: () => void) => void;
  /** ready 전·본체를 읽기 전에 들어온 링크(oprn://…)와 두 번째 실행을 넘겨받고, 이후 것은 handler 로 바로 받는다. */
  readonly attachLinks: (onLink: (url: string) => void, onSecondInstance: (launch: SecondInstanceLaunch) => void) => { readonly links: readonly string[]; readonly secondInstances: readonly SecondInstanceLaunch[] };
};

/** 렌더러 빌드 폴더(dist). 개발·QA 는 OPRN_RENDERER_DIR 로 바꾼다. */
export function rendererDirectory(): string {
  return process.env.OPRN_RENDERER_DIR ?? join(app.getAppPath(), "dist");
}

/** 리눅스·윈도우 창 아이콘. 맥은 앱 번들 icns 를 쓴다. */
export function windowIconPath(rendererDir: string): string | undefined {
  return process.platform === "darwin" ? undefined : join(rendererDir, "icons", "pwa-512.png");
}

// macOS open-file 은 ready 전에도 온다. 본체를 읽기 전에 받아 두었다가 첫 창·이후 열기에 넘긴다.
const pendingOpenFiles: string[] = [];
let onOpenFile: ((filePath: string) => void) | null = null;

/** Finder 「다음으로 열기」·독에 떨어뜨린 경로. 핸들러가 붙기 전이면 큐에 둔다. */
export function noteOpenFile(filePath: string): void {
  if (typeof filePath !== "string" || filePath.length === 0) return;
  if (onOpenFile) onOpenFile(filePath);
  else pendingOpenFiles.push(filePath);
}

/**
 * 큐를 비우고 이후 경로는 handler 로 바로 넘긴다. handler 를 먼저 붙여, 비우는 동안 온 경로를 잃지 않는다.
 */
export function takePendingOpenFiles(handler: (filePath: string) => void): readonly string[] {
  onOpenFile = handler;
  return pendingOpenFiles.splice(0, pendingOpenFiles.length);
}

/**
 * 큐에 있는 첫 프로젝트 폴더. QA 진입점에서는 null — 그 변수는 열 폴더를 따로 정하고, open-file 이 그것을 덮으면 안 된다.
 */
export function peekPendingProjectDir(): string | null {
  if (process.env.OPRN_SMOKE_PAGE !== undefined || process.env.OPRN_OPEN_PROJECT_DIR !== undefined) return null;
  for (const filePath of pendingOpenFiles) {
    const dir = projectDirFromOpenPath(filePath);
    if (dir) return dir;
  }
  return null;
}

/**
 * 처음 창이 시작 화면인가.
 * QA 진입점과, project.sqlite 가 있는 명령줄·open-file 폴더는 시작 화면이 아니다(스플래시도 띄우지 않는다).
 */
export function bootsToStartScreen(): boolean {
  return shouldBootToStartScreen({
    smokePage: process.env.OPRN_SMOKE_PAGE !== undefined,
    openProjectDirEnv: process.env.OPRN_OPEN_PROJECT_DIR !== undefined,
    cliProjectDir: inspectCurrentCliProject().dir,
    openFileProjectDir: peekPendingProjectDir(),
  });
}
