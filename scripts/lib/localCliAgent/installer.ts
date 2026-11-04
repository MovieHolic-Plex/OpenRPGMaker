import { spawn } from "node:child_process";
import { planSpawn, resolveBinary } from "./resolveBinary.ts";

export type InstallableCli = "claude" | "codex";

export interface InstallPlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly shown: string;
}

const CLAUDE_PS1 = "irm https://claude.ai/install.ps1 | iex";
const CLAUDE_SH = "curl -fsSL https://claude.ai/install.sh | bash";

export function installPlanFor(cli: InstallableCli, platform: NodeJS.Platform = process.platform): InstallPlan | undefined {
  if (cli === "claude") {
    if (platform === "win32") return { command: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", CLAUDE_PS1], shown: CLAUDE_PS1 };
    return { command: "bash", args: ["-c", CLAUDE_SH], shown: CLAUDE_SH };
  }
  return { command: "npm", args: ["install", "-g", "@openai/codex"], shown: "npm install -g @openai/codex" };
}

export interface InstallResult {
  readonly ok: boolean;
  readonly code: "ok" | "unsupported" | "needs-node" | "failed" | "timeout";
  readonly message: string;
}

export const INSTALL_TIMEOUT_MS = 5 * 60_000;

export async function runInstall(cli: string, options: { platform?: NodeJS.Platform; timeoutMs?: number } = {}): Promise<InstallResult> {
  if (cli !== "claude" && cli !== "codex") return { ok: false, code: "unsupported", message: "이 프로그램은 앱이 대신 설치할 수 없어요." };
  const platform = options.platform ?? process.platform;
  const plan = installPlanFor(cli, platform);
  if (!plan) return { ok: false, code: "unsupported", message: "이 컴퓨터에서는 앱이 대신 설치할 수 없어요." };
  if (plan.command === "npm" && !resolveBinary("npm", { platform })) {
    return { ok: false, code: "needs-node", message: "먼저 Node.js(nodejs.org)를 설치해야 해요. 설치하고 이 화면에서 「다시 확인」을 눌러 주세요." };
  }
  const spawnPlan = planSpawn(plan.command, plan.args, { platform });
  return new Promise<InstallResult>((resolve) => {
    const child = spawn(spawnPlan.command, [...spawnPlan.args], {
      stdio: "ignore", windowsHide: true,
      ...(spawnPlan.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
    });
    const timer = setTimeout(() => { child.kill(); resolve({ ok: false, code: "timeout", message: "설치가 너무 오래 걸려서 멈췄어요. 다시 눌러 주세요." }); }, options.timeoutMs ?? INSTALL_TIMEOUT_MS);
    child.on("error", () => { clearTimeout(timer); resolve({ ok: false, code: "failed", message: "설치를 시작하지 못했어요." }); });
    child.on("close", (exit) => {
      clearTimeout(timer);
      resolve(exit === 0 ? { ok: true, code: "ok", message: "설치했어요." } : { ok: false, code: "failed", message: "설치가 끝나지 않았어요." });
    });
  });
}
