import { describe, expect, it } from "vitest";
import { installPlanFor, runInstall } from "../scripts/lib/localCliAgent/installer";

describe("in-app CLI installer", () => {
  it("only knows fixed install commands for Claude and Codex", () => {
    expect(installPlanFor("claude", "win32")).toMatchObject({ command: "powershell.exe", shown: "irm https://claude.ai/install.ps1 | iex" });
    expect(installPlanFor("claude", "linux")).toMatchObject({ command: "bash", shown: "curl -fsSL https://claude.ai/install.sh | bash" });
    expect(installPlanFor("claude", "darwin")?.command).toBe("bash");
    expect(installPlanFor("codex", "win32")).toMatchObject({ command: "npm", args: ["install", "-g", "@openai/codex"] });
  });

  it("runs PowerShell on Windows without loading the user profile", () => {
    const plan = installPlanFor("claude", "win32")!;
    expect(plan.args).toContain("-NoProfile");
    expect(plan.args.at(-1)).toBe("irm https://claude.ai/install.ps1 | iex");
  });

  it("refuses anything that is not a whitelisted CLI name", async () => {
    for (const name of ["gemini", "rm -rf /", "claude; calc", "", "../claude"]) {
      const result = await runInstall(name);
      expect(result.ok, name).toBe(false);
      expect(result.code, name).toBe("unsupported");
    }
  });
});
