import { describe, expect, it, test } from "vitest";
import { claudeTurnCost, CLAUDE_INSTALL_BY_OS } from "../scripts/lib/localCliAgent/claude";
import { LOCAL_CLI_DEFAULT_ORDER, pickDefaultLocalCli } from "../scripts/lib/localCliAgent/registry";
import { type LocalCliId, type LocalCliStatus, installFields } from "../scripts/lib/localCliAgent/types";
import { installPlanFor, runInstall } from "../scripts/lib/localCliAgent/installer";
import { cmdEscapeArg, planSpawn, resolveBinary } from "../scripts/lib/localCliAgent/resolveBinary";
import { isolateTimers } from "./mergedTeardown";

describe("localCliClaudeTurnCost", () => {
  isolateTimers();
  describe("claudeTurnCost", () => {
    it("reports only this turn's share of Claude Code's cumulative total_cost_usd", () => {
      // Two turns in one process: Claude Code reports 0.0149 then 0.0251 (cumulative).
      let reported = 0;
      const turns = [0.0149, 0.0251].map((total) => { const c = claudeTurnCost(total, reported); reported = total; return c; });
      expect(turns[0]).toBeCloseTo(0.0149, 6);
      expect(turns[1]).toBeCloseTo(0.0102, 6);
      expect(turns[0]! + turns[1]!).toBeCloseTo(0.0251, 6);
    });
    it("never goes negative", () => {
      expect(claudeTurnCost(0.01, 0.02)).toBe(0);
    });
  });
});

// 연결된 로컬 CLI 가 여럿일 때의 자동 추천 — Claude(Claude Code CLI)가 먼저다(오너 결정 2026-11-23: 조수는 Sonnet 5.5 high. 2026-11-19 에는 ChatGPT 가 먼저였다).
// 화면 순서(LOCAL_CLI_IDS: claude → codex → gemini)와 추천 순서는 따로다. 추천만 바뀌고 저장된 선택은 건드리지 않는다.
describe("localCliDefaultOrder", () => {
  isolateTimers();
  const row = (id: LocalCliId, state: LocalCliStatus["state"], routine: string, deep: string): LocalCliStatus => ({
    id, label: id, state, stateLabel: state, found: state !== "not-installed", billing: "subscription", models: [],
    defaults: { routine, deep }, install: { command: "", help: "", url: "" }, login: { command: "", help: "" },
  });
  describe("pickDefaultLocalCli", () => {
    it("prefers Claude over Codex (ChatGPT) and Gemini when several are ready, whatever the row order", () => {
      expect(LOCAL_CLI_DEFAULT_ORDER).toEqual(["claude", "codex", "gemini"]);
      const rows = [row("claude", "ready", "claude-sonnet-5-5", "claude-sonnet-5-5"), row("codex", "ready", "gpt-6-luna", "gpt-6.2-sol"), row("gemini", "ready", "auto", "auto")];
      expect(pickDefaultLocalCli(rows)).toEqual({ provider: "local-cli:claude", routineModel: "claude-sonnet-5-5", deepModel: "claude-sonnet-5-5" });
      expect(pickDefaultLocalCli([...rows].reverse())?.provider).toBe("local-cli:claude");
    });

    it("falls back to Codex (ChatGPT), then Gemini, when Claude is not ready, and to nothing when none is", () => {
      expect(pickDefaultLocalCli([row("claude", "login-required", "", ""), row("codex", "ready", "gpt-6-luna", "gpt-6.2-sol"), row("gemini", "ready", "auto", "auto")])).toEqual({ provider: "local-cli:codex", routineModel: "gpt-6-luna", deepModel: "gpt-6.2-sol" });
      expect(pickDefaultLocalCli([row("claude", "not-installed", "", ""), row("codex", "error", "", ""), row("gemini", "ready", "auto", "auto")])?.provider).toBe("local-cli:gemini");
      expect(pickDefaultLocalCli([row("claude", "login-required", "", "")])).toBeUndefined();
    });
  });
});

describe("localCliInstaller", () => {
  isolateTimers();
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
});

// 윈도에서 로컬 CLI(claude·codex·gemini) 찾기와 .cmd 껍데기 띄우기 — 가짜 env·파일 목록으로 리눅스 CI 에서도 돈다.
describe("localCliResolve", () => {
  isolateTimers();
  const WIN_ENV = {
    PATH: "C:\\Windows\\system32;C:\\tools",
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    APPDATA: "C:\\Users\\u\\AppData\\Roaming",
    LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local",
    USERPROFILE: "C:\\Users\\u",
    ProgramFiles: "C:\\Program Files",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  };
  const files = (...paths: string[]) => (path: string) => paths.includes(path);
  const noWhere = () => [];
  /** cmd.exe 가 한 번 읽을 때 따옴표 밖 ^x → x. cmdEscapeArg 는 따옴표까지 ^ 로 막아 따옴표 안 상태가 생기지 않는다. */
  const cmdRead = (text: string) => text.replace(/\^(.)/gsu, "$1");
  /** CommandLineToArgvW(msvcrt) 규칙으로 명령줄을 인자로 나눈다 — node 가 process.argv 를 만드는 방식. */
  function argvOf(line: string): string[] {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;
    let started = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === "\\") {
        let n = 0;
        while (line[i + n] === "\\") n++;
        if (line[i + n] === "\"") {
          current += "\\".repeat(Math.floor(n / 2));
          if (n % 2 === 1) current += "\"";
          else inQuotes = !inQuotes;
          i += n;
        } else { current += "\\".repeat(n); i += n - 1; }
        started = true;
      } else if (ch === "\"") { inQuotes = !inQuotes; started = true; }
      else if ((ch === " " || ch === "\t") && !inQuotes) { if (started) out.push(current); current = ""; started = false; }
      else { current += ch; started = true; }
    }
    if (started) out.push(current);
    return out;
  }
  describe("resolveBinary (win32)", () => {
    test("같은 폴더에서는 PATHEXT 순서대로 고른다", () => {
      const exists = files("C:\\tools\\codex.cmd", "C:\\tools\\codex.exe");
      expect(resolveBinary("codex", { platform: "win32", env: WIN_ENV, exists, where: noWhere })).toBe("C:\\tools\\codex.exe");
      expect(resolveBinary("codex", { platform: "win32", env: { ...WIN_ENV, PATHEXT: ".CMD;.EXE" }, exists, where: noWhere })).toBe("C:\\tools\\codex.cmd");
    });

    test("확장자 없는 sh 껍데기는 고르지 않는다", () => {
      const exists = files("C:\\tools\\codex", "C:\\tools\\codex.cmd");
      expect(resolveBinary("codex", { platform: "win32", env: WIN_ENV, exists, where: noWhere })).toBe("C:\\tools\\codex.cmd");
    });

    test("PATH 에 없으면 %APPDATA%\\npm 의 .cmd 를 찾는다", () => {
      const exists = files("C:\\Users\\u\\AppData\\Roaming\\npm\\gemini.cmd");
      expect(resolveBinary("gemini", { platform: "win32", env: WIN_ENV, exists, where: noWhere })).toBe("C:\\Users\\u\\AppData\\Roaming\\npm\\gemini.cmd");
    });

    test("Claude 설치기 위치(%USERPROFILE%\\.local\\bin)와 대소문자가 다른 Path 키", () => {
      const env = { PATHEXT: WIN_ENV.PATHEXT, USERPROFILE: WIN_ENV.USERPROFILE, Path: "C:\\Windows\\system32" };
      const exists = files("C:\\Users\\u\\.local\\bin\\claude.exe");
      expect(resolveBinary("claude", { platform: "win32", env, exists, where: noWhere })).toBe("C:\\Users\\u\\.local\\bin\\claude.exe");
    });

    test("어디에도 없으면 where.exe 결과 중 실행 가능한 것, 그것도 없으면 undefined", () => {
      expect(resolveBinary("codex", { platform: "win32", env: WIN_ENV, exists: files(), where: () => ["D:\\x\\codex", "D:\\x\\codex.cmd"] })).toBe("D:\\x\\codex.cmd");
      expect(resolveBinary("codex", { platform: "win32", env: WIN_ENV, exists: files(), where: noWhere })).toBeUndefined();
    });

    test("OPRN_LOCAL_CLI_<ID> 로 준 전체 경로는 그 경로만 본다", () => {
      const exists = files("D:\\cli\\claude.cmd");
      expect(resolveBinary("D:\\cli\\claude", { platform: "win32", env: WIN_ENV, exists, where: noWhere })).toBe("D:\\cli\\claude.cmd");
      expect(resolveBinary("D:\\cli\\claude.cmd", { platform: "win32", env: WIN_ENV, exists, where: noWhere })).toBe("D:\\cli\\claude.cmd");
    });
  });
  describe("resolveBinary·planSpawn (윈도 밖)", () => {
    test("이름을 그대로 쓰고 파일을 찾지 않는다", () => {
      const exists = () => { throw new Error("must not look up files"); };
      expect(resolveBinary("codex", { platform: "linux", exists })).toBe("codex");
      const args = ["exec", "--json", "a&b"];
      expect(planSpawn("/opt/codex", args, { platform: "darwin", exists })).toEqual({ command: "/opt/codex", args });
    });
  });
  describe("planSpawn (win32)", () => {
    test(".cmd 는 cmd.exe /d /s /c 로, 인자는 원래 값으로 돌아온다", () => {
      const exists = files("C:\\Users\\u\\AppData\\Roaming\\npm\\codex.cmd");
      const args = ["exec", "-c", "model_instructions_file=\"C:\\\\Temp\\\\oprn x\\\\instructions.md\"", "--settings", "{\"disableAllHooks\":true}", "", "-"];
      const plan = planSpawn("codex", args, { platform: "win32", env: WIN_ENV, exists, where: noWhere });
      expect(plan.command).toBe("C:\\Windows\\system32\\cmd.exe");
      expect(plan.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
      expect(plan.windowsVerbatimArguments).toBe(true);
      const line = plan.args[3]!;
      expect(line.startsWith("\"") && line.endsWith("\"")).toBe(true);
      // 바깥 cmd /s /c 가 겉따옴표를 벗기고 한 번 읽고, 껍데기의 %* 가 한 번 더 읽는다.
      const seenByNode = cmdRead(cmdRead(line.slice(1, -1)));
      expect(argvOf(seenByNode)).toEqual(["C:\\Users\\u\\AppData\\Roaming\\npm\\codex.cmd", ...args]);
    });

    test(".exe 는 셸 없이 바로 띄운다", () => {
      const exists = files("C:\\Users\\u\\.local\\bin\\claude.exe");
      const plan = planSpawn("claude", ["-p", "a&b"], { platform: "win32", env: WIN_ENV, exists, where: noWhere });
      expect(plan).toEqual({ command: "C:\\Users\\u\\.local\\bin\\claude.exe", args: ["-p", "a&b"] });
    });
  });
  describe("cmdEscapeArg", () => {
    const nasty = ["a & calc", "x|y", "<in >out", "^caret", "%PATH%", "!bang!", "say \"hi\"", "a\"&calc&\"", "trail\\", "back\\\\\"q", "(paren) , ; *?", "`tick`", ""];

    test.each(nasty)("%j 는 두 번 읽혀도 같은 인자 하나로 돌아온다", (value) => {
      const escaped = cmdEscapeArg(value);
      expect(argvOf(cmdRead(cmdRead(escaped)))).toEqual([value]);
    });

    test.each(nasty)("%j: 첫 번째 읽기 뒤에도 연산자·따옴표가 모두 ^ 로 막혀 있다", (value) => {
      const afterOuter = cmdRead(cmdEscapeArg(value));
      expect(afterOuter.replace(/\^./gsu, "")).not.toMatch(/[()\][%!^"`<>&|;, *?]/u);
    });

    test("줄바꿈이 든 값은 명령줄로 넘기지 않는다", () => {
      expect(() => cmdEscapeArg("line1\r\nline2 & calc")).toThrow();
      expect(() => cmdEscapeArg("a\nb")).toThrow();
    });
  });
  describe("installByOs", () => {
    test("install.command 는 그 운영체제의 명령이다", () => {
      expect(installFields(CLAUDE_INSTALL_BY_OS, "u", "win32").install.command).toBe("irm https://claude.ai/install.ps1 | iex");
      expect(installFields(CLAUDE_INSTALL_BY_OS, "u", "darwin").install.command).toBe("curl -fsSL https://claude.ai/install.sh | bash");
      expect(installFields(CLAUDE_INSTALL_BY_OS, "u", "linux").installByOs).toBe(CLAUDE_INSTALL_BY_OS);
    });
  });
});
