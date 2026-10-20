// CLI 자식 프로세스 공통 — 줄 단위 JSON 읽기, 빈 임시 작업 폴더, 중단.
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 빈 임시 작업 폴더 — 사용자 프로젝트 폴더의 지침 파일·MCP 설정이 섞이지 않게. */
export function emptyWorkDir(prefix: string): { readonly dir: string; readonly remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `oprn-${prefix}-`));
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

export interface SpawnLinesOptions {
  readonly binary: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly stdin?: string | "keep-open";
  readonly onJson: (value: Record<string, unknown>) => void;
  readonly onText?: (line: string) => void;
  readonly onStderr?: (text: string) => void;
}

export interface SpawnedLines {
  readonly child: ChildProcessWithoutNullStreams;
  readonly exited: Promise<number | null>;
  write(line: string): void;
  endInput(): void;
  kill(): void;
}

export function spawnJsonLines(options: SpawnLinesOptions): SpawnedLines {
  const child = spawn(options.binary, [...options.args], { cwd: options.cwd, env: options.env, stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { options.onText?.(line); continue; }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) options.onJson(parsed as Record<string, unknown>);
      else options.onText?.(line);
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => options.onStderr?.(chunk));
  // 자식이 죽었는데 stdin 에 쓰면 EPIPE 가 프로세스를 죽인다 — 삼킨다.
  child.stdin.on("error", () => undefined);
  const exited = new Promise<number | null>((resolve) => {
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(-1));
  });
  if (typeof options.stdin === "string" && options.stdin !== "keep-open") child.stdin.end(options.stdin);
  return {
    child,
    exited,
    write: (line) => { if (!child.stdin.destroyed && child.exitCode === null) child.stdin.write(line.endsWith("\n") ? line : `${line}\n`); },
    endInput: () => { if (!child.stdin.destroyed) child.stdin.end(); },
    kill: () => { if (child.exitCode === null && !child.killed) child.kill("SIGTERM"); },
  };
}

/** `--version` 같은 짧은 명령. 찾지 못하면 ok:false. */
export function runShort(binary: string, args: readonly string[], timeoutMs = 20_000, env?: NodeJS.ProcessEnv): { ok: boolean; stdout: string; stderr: string } {
  const out = spawnSync(binary, [...args], { encoding: "utf8", timeout: timeoutMs, ...(env ? { env } : {}) });
  return { ok: !out.error && out.status === 0, stdout: out.stdout ?? "", stderr: out.stderr ?? "" };
}

/** 모델 요청이 일시적으로 거절됐는가(용량·속도 제한) — 같은 차례를 잠시 뒤 다시 보낼 만한 오류. */
export function isTransientCliError(message: string | undefined): boolean {
  return !!message && /at capacity|overloaded|rate.?limit|429|503|temporarily unavailable|try again/iu.test(message);
}

export const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});
