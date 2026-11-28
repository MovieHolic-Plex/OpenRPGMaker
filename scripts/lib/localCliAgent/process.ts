// CLI 자식 프로세스 공통 — 줄 단위 JSON 읽기, 빈 임시 작업 폴더, 중단.
import { spawn, spawnSync, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planSpawn } from "./resolveBinary.ts";

/** 빈 임시 작업 폴더 — 사용자 프로젝트 폴더의 지침 파일·MCP 설정이 섞이지 않게. */
export function emptyWorkDir(prefix: string): { readonly dir: string; readonly remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `oprn-${prefix}-`));
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * 자식 프로세스를 끝낸다. cmd.exe 로 띄운 `.cmd`·`.bat`(`planSpawn` 의 windowsVerbatimArguments)는 cmd 만 죽이면
 * 그 아래 node CLI 가 남으므로 `taskkill /T /F` 로 프로세스 나무째 끝낸다. 네이티브 실행 파일은 SIGTERM.
 */
export function killProcessTree(child: ChildProcess, viaCmdShim: boolean): void {
  if (viaCmdShim && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true })
      .on("error", () => { try { child.kill(); } catch { /* 무시 */ } });
    return;
  }
  try { child.kill("SIGTERM"); } catch { /* 이미 끝남 */ }
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
  const plan = planSpawn(options.binary, options.args, { env: options.env });
  const child = spawn(plan.command, [...plan.args], {
    cwd: options.cwd, env: options.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    ...(plan.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
  });
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
    kill: () => {
      if (child.exitCode !== null || child.killed) return;
      killProcessTree(child, Boolean(plan.windowsVerbatimArguments));
    },
  };
}

export interface ShortCommandResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly enoent?: boolean;
  readonly timedOut?: boolean;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

/** `--version` 같은 짧은 명령(동기). 찾지 못하면 ok:false. */
export function runShort(binary: string, args: readonly string[], timeoutMs = 20_000, env?: NodeJS.ProcessEnv): ShortCommandResult {
  let plan: ReturnType<typeof planSpawn>;
  try { plan = planSpawn(binary, args, env ? { env } : {}); } catch (error) { return { ok: false, stdout: "", stderr: error instanceof Error ? error.message : String(error) }; }
  const out = spawnSync(plan.command, [...plan.args], {
    encoding: "utf8", timeout: timeoutMs, windowsHide: true,
    ...(plan.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}), ...(env ? { env } : {}),
  });
  const err = out.error as NodeJS.ErrnoException | undefined;
  return {
    ok: !err && out.status === 0,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
    ...(err?.code === "ENOENT" ? { enoent: true } : {}),
    ...(err?.code === "ETIMEDOUT" ? { timedOut: true } : {}),
    ...(err?.code ? { errorCode: err.code } : {}),
    ...(err?.message ? { errorMessage: err.message } : {}),
  };
}

/** 이벤트 루프를 막지 않는 비동기 짧은 명령 실행기(감지 프로브용). */
export function runShortAsync(binary: string, args: readonly string[], timeoutMs = 20_000, env?: NodeJS.ProcessEnv): Promise<ShortCommandResult> {
  let plan: ReturnType<typeof planSpawn>;
  try { plan = planSpawn(binary, args, env ? { env } : {}); } catch (error) {
    return Promise.resolve({ ok: false, stdout: "", stderr: error instanceof Error ? error.message : String(error), errorMessage: error instanceof Error ? error.message : String(error) });
  }
  return new Promise((resolve) => {
    const child = spawn(plan.command, [...plan.args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...(plan.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
      ...(env ? { env } : {}),
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    const done = (result: ShortCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child, Boolean(plan.windowsVerbatimArguments));
      done({ ok: false, stdout, stderr, timedOut: true, errorCode: "ETIMEDOUT", errorMessage: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    timer.unref?.();
    child.on("error", (err: NodeJS.ErrnoException) => {
      done({
        ok: false,
        stdout,
        stderr,
        ...(err.code === "ENOENT" ? { enoent: true } : {}),
        ...(err.code ? { errorCode: err.code } : {}),
        errorMessage: err.message,
      });
    });
    child.on("close", (code) => {
      done({
        ok: !timedOut && code === 0,
        stdout,
        stderr,
        ...(timedOut ? { timedOut: true, errorCode: "ETIMEDOUT" } : {}),
      });
    });
  });
}

/**
 * 계정 사용 한도가 다 떨어졌는가 — 몇 시간·며칠 뒤에야 풀리므로 몇십 초 뒤 다시 보내도 같은 거절이다.
 * 2026-11-24 draft-10min 실측: codex CLI 는 「You've hit your usage limit … try again at Nov 27th」를 4초 만에 돌려주는데,
 * 아래 «try again» 이 이것을 일시 오류로 읽어 8·16·24·32·40초 쉬며 5번 다시 보냈다 — 화면 검수 한 판마다 약 140초가 빈 답으로 사라졌다.
 */
export function isHardQuotaCliError(message: string | undefined): boolean {
  return !!message && /usage limit|purchase more credits|try again (?:at|on|in ~?\d+ ?(?:min|hour|day))/iu.test(message);
}

/** 모델 요청이 일시적으로 거절됐는가(용량·속도 제한) — 같은 차례를 잠시 뒤 다시 보낼 만한 오류. 계정 한도 소진(isHardQuotaCliError)은 아니다. */
export function isTransientCliError(message: string | undefined): boolean {
  return !!message && !isHardQuotaCliError(message) && /at capacity|high demand|overloaded|rate.?limit|429|503|temporarily unavailable|try again/iu.test(message);
}

export const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});
