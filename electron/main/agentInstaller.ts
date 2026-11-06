// 에이전트 모드 설치기 — 사용자가 터미널 없이 앱 안에서 코딩 에이전트를 설치·로그인·제거한다.
//
// 설치 위치: 앱 전용 폴더(윈도 %LOCALAPPDATA%\OPRN Studio\agents\<에이전트>). 시스템 node 가 필요 없다 —
// 앱 실행 파일(Electron)을 ELECTRON_RUN_AS_NODE 로 node 처럼 돌리고, 앱에 같이 실은 npm(dist-electron/agent-npm)으로
// 공식 npm 패키지를 받는다. 설치 스크립트(postinstall)는 돌리지 않는다: 필요한 실행 파일은 플랫폼 패키지에서 직접 찾는다.
//
// 로그인: 각 에이전트의 「공식」 로그인 명령(claude auth login · codex login)을 그대로 띄운다. 브라우저는 그 명령이 연다.
// 이 모듈은 토큰·자격 증명을 읽거나 저장하지 않는다 — 명령이 출력한 로그인 주소만 패널에 옮기고, 명령이 「코드를 붙여 넣으라」고
// 할 때만 사용자가 입력한 코드를 그 명령의 표준 입력에 그대로 흘려 보낸다. 로그인 상태는 공식 상태 명령으로만 묻는다.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, rmSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type InstallableAgent = "claude" | "codex" | "opencode";

/** npm 으로 받을 패키지. 버전을 고정해 같은 앱 버전은 같은 에이전트를 깐다(다시 설치 = 같은 버전). */
export const AGENT_PACKAGES: Readonly<Record<InstallableAgent, { readonly packages: readonly string[]; readonly approxFetches: number; readonly approxMb: number }>> = {
  // claude-agent-acp 는 공식 Claude Code 실행 파일을 @anthropic-ai/claude-agent-sdk-<플랫폼> 에 함께 싣는다
  // (@anthropic-ai/claude-code 의 실행 파일과 바이트까지 같다 — 2.1.318 실측). 그래서 claude-code 를 따로 받지 않는다(약 320MB 절약).
  claude: { packages: ["@agentclientprotocol/claude-agent-acp@0.101.0"], approxFetches: 230, approxMb: 270 },
  // codex-acp 2.x 는 공식 @openai/codex 를 의존성으로 받고, 그 codex 로 app-server 를 띄운다.
  codex: { packages: ["@agentclientprotocol/codex-acp@2.5.0"], approxFetches: 40, approxMb: 180 },
  opencode: { packages: ["opencode-ai@1.19.5"], approxFetches: 6, approxMb: 160 },
};

export type InstallerPaths = {
  readonly agentsDir: string;
  readonly npmCli: string | null;
  /** 데스크톱은 Electron 바이너리 + ELECTRON_RUN_AS_NODE=1. */
  readonly nodeCommand: string;
  readonly nodeEnv: Readonly<Record<string, string>>;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
};

export type SetupEvent = {
  readonly agent: InstallableAgent;
  readonly phase: "installing" | "installed" | "install-failed" | "removing" | "removed" | "login-started" | "login-url" | "login-waiting-code" | "login-done" | "login-failed";
  readonly message: string;
  readonly progress?: number;
  readonly url?: string;
};

export type InstalledAgent = {
  readonly adapter: { readonly command: string; readonly args: readonly string[]; readonly env: Readonly<Record<string, string>> };
  readonly cli: { readonly command: string; readonly args: readonly string[]; readonly env: Readonly<Record<string, string>> };
};

function platformTriple(platform: NodeJS.Platform, arch: string): { node: string; opencode: string; exe: string } {
  const os = platform === "win32" ? "win32" : platform;
  return { node: `${os}-${arch}`, opencode: `${platform === "win32" ? "windows" : platform}-${arch}`, exe: platform === "win32" ? ".exe" : "" };
}

export function agentDir(paths: InstallerPaths, agent: InstallableAgent): string {
  return join(paths.agentsDir, agent);
}

/** 설치 폴더에서 실행 파일을 찾는다. 하나라도 없으면 null — 「설치 안 됨」 또는 「백신이 지웠다」. */
export function resolveInstalled(paths: InstallerPaths, agent: InstallableAgent): InstalledAgent | null {
  const platform = paths.platform ?? process.platform;
  const arch = paths.arch ?? process.arch;
  const triple = platformTriple(platform, arch);
  const modules = join(agentDir(paths, agent), "node_modules");
  const asNode = (script: string, extraEnv: Record<string, string> = {}) => ({ command: paths.nodeCommand, args: [script], env: { ...paths.nodeEnv, ...extraEnv } });
  if (agent === "claude") {
    const adapter = join(modules, "@agentclientprotocol", "claude-agent-acp", "dist", "index.js");
    const claude = join(modules, "@anthropic-ai", `claude-agent-sdk-${triple.node}`, `claude${triple.exe}`);
    if (!existsSync(adapter) || !existsSync(claude)) return null;
    return { adapter: asNode(adapter, { CLAUDE_CODE_EXECUTABLE: claude }), cli: { command: claude, args: [], env: {} } };
  }
  if (agent === "codex") {
    const adapter = join(modules, "@agentclientprotocol", "codex-acp", "dist", "index.js");
    const codex = join(modules, "@openai", "codex", "bin", "codex.js");
    if (!existsSync(adapter) || !existsSync(codex)) return null;
    return { adapter: asNode(adapter), cli: asNode(codex) };
  }
  // opencode: postinstall 을 돌리지 않으므로 플랫폼 패키지의 실행 파일을 직접 쓴다(AVX2 없는 PC 용 baseline 도 같이 찾는다).
  for (const name of [`opencode-${triple.opencode}`, `opencode-${triple.opencode}-baseline`, `opencode-${triple.opencode}-musl`]) {
    const bin = join(modules, name, "bin", `opencode${triple.exe}`);
    if (existsSync(bin)) {
      const cli = { command: bin, args: [] as string[], env: {} };
      return { adapter: { ...cli, args: ["acp"] }, cli };
    }
  }
  return null;
}

export function explainInstallError(output: string, platform: NodeJS.Platform = process.platform): string {
  const text = output.toLowerCase();
  if (/enospc|no space left/u.test(text)) return "디스크 공간이 부족합니다. 설치에 약 300MB 가 필요합니다 — 공간을 비운 뒤 다시 설치하세요.";
  if (/e407|proxy authentication|tunneling socket|econnreset.*proxy|proxy/u.test(text)) return "프록시(회사·학교 네트워크)가 내려받기를 막았습니다. 시스템 프록시를 HTTPS_PROXY 환경 변수로 지정하거나 다른 네트워크에서 다시 설치하세요.";
  if (/self[_ -]signed|unable_to_verify|unable to get local issuer|cert_/u.test(text)) return "보안 프로그램이나 회사 네트워크가 인증서를 바꿔 끼워 내려받기가 막혔습니다. 다른 네트워크에서 다시 설치하거나 관리자에게 registry.npmjs.org 허용을 요청하세요.";
  if (/enotfound|eai_again|getaddrinfo|econnrefused|network|etimedout|socket hang up|fetch failed/u.test(text)) return "인터넷에 연결할 수 없습니다(registry.npmjs.org). 연결을 확인한 뒤 「다시 설치」를 누르세요.";
  if (/eperm|eacces|ebusy|operation not permitted|virus|quarantin/u.test(text)) {
    return platform === "win32"
      ? "파일을 쓰지 못했습니다. 백신(Windows 보안)이 파일을 막았을 수 있습니다 — 보호 기록에서 OPRN Studio 의 agents 폴더를 허용한 뒤 「다시 설치」를 누르세요."
      : "파일을 쓰지 못했습니다(권한 또는 보안 프로그램). 설치 폴더 권한을 확인한 뒤 「다시 설치」를 누르세요.";
  }
  const last = output.trim().split(/\r?\n/u).filter(Boolean).slice(-1)[0] ?? "";
  return `설치하지 못했습니다. ${last.slice(0, 200)}`.trim();
}

function folderSizeMb(dir: string): number {
  let total = 0;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += statSync(full).size;
    }
  };
  try { walk(dir); } catch { return 0; }
  return Math.round(total / 1_048_576);
}

/** 줄이 끝난(뒤에 공백이 온) 첫 https 주소만 — 출력 조각 중간에서 잘린 주소를 내보내지 않는다. */
export function extractLoginUrl(text: string): string | null {
  const match = /(https:\/\/[^\s"'<>]+)\s/u.exec(text);
  return match ? match[1]! : null;
}

export function createAgentInstaller(paths: InstallerPaths, emit: (event: SetupEvent) => void) {
  const env = paths.env ?? process.env;
  const running = new Map<InstallableAgent, ChildProcess>();
  const logins = new Map<InstallableAgent, ChildProcess>();

  const runQuiet = (command: string, args: readonly string[], extraEnv: Record<string, string>, timeoutMs: number): Promise<{ code: number | null; out: string }> => new Promise((resolve) => {
    let out = "";
    let child: ChildProcess;
    try {
      child = spawn(command, [...args], { env: { ...env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (error) {
      resolve({ code: -1, out: error instanceof Error ? error.message : String(error) });
      return;
    }
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => { out += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { out += chunk.toString("utf8"); });
    child.on("error", (error) => { out += error.message; });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, out }); });
  });

  return {
    installed(agent: InstallableAgent): InstalledAgent | null {
      return resolveInstalled(paths, agent);
    },

    isBusy(agent: InstallableAgent): boolean {
      return running.has(agent);
    },

    /** 공식 상태 명령으로 로그인 여부를 묻는다. 토큰 내용은 보지 않는다(로그인됨/아님만 읽는다). */
    async loggedIn(agent: InstallableAgent): Promise<boolean | null> {
      const found = resolveInstalled(paths, agent);
      if (!found) return null;
      if (agent === "claude") {
        const { out } = await runQuiet(found.cli.command, [...found.cli.args, "auth", "status"], found.cli.env, 15_000);
        return /"loggedIn"\s*:\s*true/u.test(out);
      }
      if (agent === "codex") {
        const { code } = await runQuiet(found.cli.command, [...found.cli.args, "login", "status"], found.cli.env, 15_000);
        return code === 0;
      }
      // opencode 는 로그인 없이도 무료 모델로 돈다. 제공자 로그인은 선택이다.
      return true;
    },

    async install(agent: InstallableAgent): Promise<boolean> {
      if (running.has(agent)) return false;
      const spec = AGENT_PACKAGES[agent];
      if (!paths.npmCli || !existsSync(paths.npmCli)) {
        emit({ agent, phase: "install-failed", message: "앱에 들어 있어야 할 설치 도구(npm)를 찾지 못했습니다. OPRN Studio 를 다시 내려받아 주세요." });
        return false;
      }
      const dir = agentDir(paths, agent);
      // 다시 설치는 깨끗하게 — 반쯤 받은 폴더·백신이 일부만 지운 폴더를 남기지 않는다.
      rmSync(dir, { recursive: true, force: true });
      try { mkdirSync(dir, { recursive: true }); } catch (error) {
        emit({ agent, phase: "install-failed", message: explainInstallError(error instanceof Error ? error.message : String(error), paths.platform) });
        return false;
      }
      const cache = join(paths.agentsDir, ".npm-cache");
      emit({ agent, phase: "installing", message: `내려받는 중… (약 ${spec.approxMb}MB)`, progress: 0.02 });
      const args = [paths.npmCli, "install", "--prefix", dir, "--no-audit", "--no-fund", "--ignore-scripts", "--no-update-notifier", "--cache", cache, "--loglevel=http", ...spec.packages];
      let output = "";
      let fetched = 0;
      const ok = await new Promise<boolean>((resolve) => {
        let child: ChildProcess;
        try {
          child = spawn(paths.nodeCommand, args, { cwd: dir, env: { ...env, ...paths.nodeEnv, npm_config_update_notifier: "false" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
        } catch (error) {
          output += error instanceof Error ? error.message : String(error);
          resolve(false);
          return;
        }
        running.set(agent, child);
        const onData = (chunk: Buffer): void => {
          const text = chunk.toString("utf8");
          output = (output + text).slice(-20_000);
          const hits = text.match(/fetch GET 200/gu)?.length ?? 0;
          if (hits) {
            fetched += hits;
            const progress = Math.min(0.95, 0.05 + 0.9 * (fetched / spec.approxFetches));
            emit({ agent, phase: "installing", message: `내려받는 중… ${fetched}개 받음`, progress });
          }
        };
        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);
        child.on("error", (error) => { output += `\n${error.message}`; });
        child.on("close", (code) => { running.delete(agent); resolve(code === 0); });
      });
      rmSync(cache, { recursive: true, force: true });
      if (!ok) {
        emit({ agent, phase: "install-failed", message: explainInstallError(output, paths.platform) });
        return false;
      }
      if (!resolveInstalled(paths, agent)) {
        // npm 은 성공했는데 실행 파일이 없다 — 대개 백신이 받자마자 격리했다.
        emit({ agent, phase: "install-failed", message: explainInstallError("EPERM: executable missing after install", paths.platform) });
        return false;
      }
      emit({ agent, phase: "installed", message: `설치했습니다 (${folderSizeMb(dir)}MB)`, progress: 1 });
      return true;
    },

    uninstall(agent: InstallableAgent): void {
      running.get(agent)?.kill();
      running.delete(agent);
      logins.get(agent)?.kill();
      logins.delete(agent);
      emit({ agent, phase: "removing", message: "지우는 중…" });
      try {
        rmSync(agentDir(paths, agent), { recursive: true, force: true });
        emit({ agent, phase: "removed", message: "지웠습니다. 로그인 정보는 그 에이전트 쪽(사용자 폴더)에 남습니다." });
      } catch (error) {
        emit({ agent, phase: "install-failed", message: explainInstallError(error instanceof Error ? error.message : String(error), paths.platform) });
      }
    },

    /** 공식 로그인 명령을 띄운다. 브라우저는 그 명령이 직접 연다. 주소가 출력되면 패널에도 보인다. */
    login(agent: InstallableAgent): void {
      const found = resolveInstalled(paths, agent);
      if (!found) { emit({ agent, phase: "login-failed", message: "먼저 설치하세요." }); return; }
      // opencode 의 auth login 은 제공자를 고르는 터미널 화면이라 패널에서 모사할 수 없다. 무료 모델은 로그인 없이 돈다.
      if (agent === "opencode") { emit({ agent, phase: "login-done", message: "opencode 는 로그인 없이 무료 모델로 씁니다." }); return; }
      logins.get(agent)?.kill();
      const args = agent === "claude" ? ["auth", "login", "--claudeai"] : ["login"];
      let child: ChildProcess;
      try {
        child = spawn(found.cli.command, [...found.cli.args, ...args], { env: { ...env, ...found.cli.env }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      } catch (error) {
        emit({ agent, phase: "login-failed", message: error instanceof Error ? error.message : String(error) });
        return;
      }
      logins.set(agent, child);
      emit({ agent, phase: "login-started", message: "브라우저에서 로그인하세요. 창이 안 열리면 아래 주소를 여세요." });
      let buffer = "";
      let sentUrl = false;
      let askedCode = false;
      const onData = (chunk: Buffer): void => {
        buffer = (buffer + chunk.toString("utf8")).slice(-8_000);
        const url = extractLoginUrl(buffer);
        if (url && !sentUrl) {
          sentUrl = true;
          emit({ agent, phase: "login-url", message: "브라우저가 열리지 않으면 이 주소를 여세요.", url });
        }
        if (!askedCode && /paste code/iu.test(buffer)) {
          askedCode = true;
          emit({ agent, phase: "login-waiting-code", message: "브라우저에서 로그인하세요. 브라우저가 코드를 보여 주면 아래 칸에 붙여 넣으세요(자동으로 끝나면 필요 없습니다).", ...(url ? { url } : {}) });
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.on("error", (error) => emit({ agent, phase: "login-failed", message: error.message }));
      child.on("close", (code) => {
        if (logins.get(agent) !== child) return;
        logins.delete(agent);
        if (code === 0) emit({ agent, phase: "login-done", message: "로그인했습니다." });
        else {
          const last = buffer.trim().split(/\r?\n/u).filter((line) => !/^https?:/u.test(line)).slice(-1)[0] ?? "";
          emit({ agent, phase: "login-failed", message: `로그인하지 못했습니다. ${last.replace(/https:\/\/\S+/gu, "").slice(0, 200)}`.trim() });
        }
      });
    },

    /** 로그인 명령이 코드를 물을 때 사용자가 붙여 넣은 값을 그 명령에 그대로 넘긴다(저장하지 않는다). */
    loginCode(agent: InstallableAgent, code: string): boolean {
      const child = logins.get(agent);
      if (!child?.stdin || child.stdin.destroyed) return false;
      child.stdin.write(`${code.trim()}\n`);
      return true;
    },

    cancelLogin(agent: InstallableAgent): void {
      logins.get(agent)?.kill();
      logins.delete(agent);
    },

    close(): void {
      for (const child of [...running.values(), ...logins.values()]) child.kill();
      running.clear();
      logins.clear();
    },
  };
}

export type AgentInstaller = ReturnType<typeof createAgentInstaller>;
