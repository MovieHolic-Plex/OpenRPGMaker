import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractLoginUrl, resolveInstalled, type InstallerPaths } from "../electron/main/agentInstaller";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function paths(platform: NodeJS.Platform): InstallerPaths {
  const agentsDir = mkdtempSync(join(tmpdir(), "oprn-agents-"));
  roots.push(agentsDir);
  return { agentsDir, npmCli: null, nodeCommand: "/app/OPRN Studio.exe", nodeEnv: { ELECTRON_RUN_AS_NODE: "1" }, platform, arch: "x64" };
}

function touch(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "");
}

describe("resolveInstalled", () => {
  it("runs the Claude ACP adapter through the app runtime and points it at the bundled official claude binary", () => {
    const p = paths("win32");
    const modules = join(p.agentsDir, "claude", "node_modules");
    touch(join(modules, "@agentclientprotocol", "claude-agent-acp", "dist", "index.js"));
    expect(resolveInstalled(p, "claude")).toBeNull();
    touch(join(modules, "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe"));
    const found = resolveInstalled(p, "claude");
    expect(found?.adapter.command).toBe("/app/OPRN Studio.exe");
    expect(found?.adapter.env.ELECTRON_RUN_AS_NODE).toBe("1");
    expect(found?.adapter.env.CLAUDE_CODE_EXECUTABLE).toBe(join(modules, "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe"));
    expect(found?.cli.command).toBe(join(modules, "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe"));
  });

  it("finds the opencode baseline binary without running its postinstall", () => {
    const p = paths("win32");
    touch(join(p.agentsDir, "opencode", "node_modules", "opencode-windows-x64-baseline", "bin", "opencode.exe"));
    expect(resolveInstalled(p, "opencode")?.adapter.args).toEqual(["acp"]);
  });
});

describe("extractLoginUrl", () => {
  it("waits until the printed URL is complete", () => {
    expect(extractLoginUrl("visit: https://claude.com/cai/oauth/authorize?code=true&sta")).toBeNull();
    expect(extractLoginUrl("visit: https://claude.com/cai/oauth/authorize?code=true&state=x\nPaste code")).toBe("https://claude.com/cai/oauth/authorize?code=true&state=x");
  });
});
