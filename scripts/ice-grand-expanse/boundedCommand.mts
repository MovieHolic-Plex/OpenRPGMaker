import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

export type CommandReceipt = {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly diagnosticIdentities: readonly string[];
  readonly elapsedMs: number;
  readonly endedAt: string;
  readonly exitCode: number | null;
  readonly lastState: string;
  readonly phase: string;
  readonly signal: NodeJS.Signals | null;
  readonly startedAt: string;
  readonly stderrSha256: string;
  readonly stdoutSha256: string;
  readonly timedOut: boolean;
};
export type BoundedCommandRequest = {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly phase: string;
  readonly timeoutMs: number;
};

export async function runBoundedCommand(request: BoundedCommandRequest): Promise<CommandReceipt> {
  const { argv, cwd, phase, timeoutMs } = request;
  const startedAt = new Date();
  const stdoutHash = createHash("sha256");
  const stderrHash = createHash("sha256");
  const diagnosticLines: string[] = [];
  const invocation = resolveInvocation(argv);
  const child = spawn(invocation.command, invocation.args, { cwd, env: process.env, shell: false, windowsHide: true });
  let timedOut = false;
  child.stdout.on("data", (chunk: Buffer) => collect(chunk, stdoutHash, diagnosticLines));
  child.stderr.on("data", (chunk: Buffer) => collect(chunk, stderrHash, diagnosticLines));
  const timer = setTimeout(() => {
    timedOut = true;
    terminateTree(child.pid);
  }, timeoutMs);
  const result = await new Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).finally(() => clearTimeout(timer));
  if (timedOut) terminateTree(child.pid);
  const endedAt = new Date();
  return {
    argv,
    cwd,
    diagnosticIdentities: [...new Set(diagnosticLines)].slice(0, 200),
    elapsedMs: endedAt.getTime() - startedAt.getTime(),
    endedAt: endedAt.toISOString(),
    exitCode: result.code,
    lastState: timedOut ? "process-tree-terminated" : "process-closed",
    phase,
    signal: result.signal,
    startedAt: startedAt.toISOString(),
    stderrSha256: stderrHash.digest("hex"),
    stdoutSha256: stdoutHash.digest("hex"),
    timedOut,
  };
}

function collect(chunk: Buffer, hash: ReturnType<typeof createHash>, diagnostics: string[]): void {
  hash.update(chunk);
  for (const line of chunk.toString("utf8").split(/\r?\n/u)) {
    if (/\b(?:FAIL|Error|TS\d{4}|failed|×)\b/iu.test(line)) diagnostics.push(line.trim().slice(0, 500));
  }
}

function resolveInvocation(argv: readonly string[]): { readonly args: readonly string[]; readonly command: string } {
  const command = argv[0];
  if (!command) throw new Error("Bounded command requires an executable");
  if (process.platform !== "win32" || (command !== "npm" && command !== "npx")) {
    return { args: argv.slice(1), command };
  }
  const npmCli = process.env.npm_execpath;
  if (!npmCli) return { args: argv.slice(1), command };
  const cli = command === "npm" ? npmCli : path.join(path.dirname(npmCli), "npx-cli.js");
  return { args: [cli, ...argv.slice(1)], command: process.execPath };
}

function terminateTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
  }
}
