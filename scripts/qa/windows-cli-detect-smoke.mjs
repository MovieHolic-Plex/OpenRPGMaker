#!/usr/bin/env node
// 윈도 러너에서 로컬 CLI 감지가 실제로 되는지 본다(.github/workflows/windows-cli-smoke.yml).
// node 24 는 .ts 를 타입만 지우고 바로 읽는다 — localCliAgent 는 node 내장 모듈만 쓰므로 npm ci 가 필요 없다.
//
// EXPECT_INSTALLED=codex,gemini[,claude]: 설치 단계가 성공한 CLI. 그중 found:false 가 있으면 exit 1.
// 덧붙여 .cmd 껍데기에 위험한 인자를 넘겨 그대로 돌아오는지·명령이 끼어들지 않는지 본다(cmdEscapeArg 실기 확인).
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectLocalClis } from "../lib/localCliAgent/registry.ts";
import { runShort, spawnJsonLines } from "../lib/localCliAgent/process.ts";

const expected = (process.env.EXPECT_INSTALLED ?? "").split(",").map((id) => id.trim()).filter(Boolean);
const lines = [`## Local CLI detect smoke (${process.platform}, node ${process.version})`, ""];
const failures = [];

const rows = await detectLocalClis({ fresh: true });
lines.push("| CLI | expected | found | state | version | binary |", "|---|---|---|---|---|---|");
for (const row of rows) {
  const want = expected.includes(row.id);
  lines.push(`| ${row.id} | ${want ? "installed" : "-"} | ${row.found} | ${row.state} | ${row.version ?? ""} | ${row.binaryPath ?? ""} |`);
  if (want && !row.found) failures.push(`${row.id}: 설치 단계는 성공했지만 not-installed 로 감지됐다${row.problem ? ` (${row.problem})` : ""}`);
}
lines.push("", `install.command: ${rows.map((row) => `${row.id}=\`${row.install.command}\``).join(" · ")}`);

const work = mkdtempSync(join(tmpdir(), "oprn-cli-smoke-"));
try {
  const canary = join(work, "pwned.txt");
  const nasty = ["a & calc", "x|y", "<in >out", "^caret", "%PATH%", "!bang!", "say \"hi\"", `a"&echo INJECTED>"${canary}"&"`, "trail\\", "", "(p) , ; *?"];
  writeFileSync(join(work, "echo-args.js"), "process.stdout.write(JSON.stringify(process.argv.slice(2)) + '\\n');\n");
  const shim = join(work, "echo args.cmd");
  writeFileSync(shim, `@ECHO off\r\n"${process.execPath}" "%~dp0\\echo-args.js" %*\r\n`);
  if (process.platform === "win32") {
    const short = runShort(shim, nasty, 15_000);
    let echoed;
    try { echoed = JSON.parse(short.stdout); } catch { echoed = undefined; }
    const same = JSON.stringify(echoed) === JSON.stringify(nasty);
    lines.push("", `runShort(.cmd) 인자 왕복: ${same ? "OK" : "MISMATCH"}`, "```", (short.stdout || short.stderr).trim(), "```");
    if (!same) failures.push(`runShort(.cmd) 인자 왕복이 다르다: ${short.stdout || short.stderr}`);

    let streamed = "";
    const spawned = spawnJsonLines({ binary: shim, args: nasty, cwd: work, env: { ...process.env }, onJson: () => undefined, onText: (text) => { streamed = text; } });
    const code = await spawned.exited;
    const streamedSame = streamed === JSON.stringify(nasty);
    if (code !== 0 || !streamedSame) failures.push(`spawnJsonLines(.cmd) 종료 코드 ${code}, 인자 ${streamed}`);
    if (existsSync(canary)) failures.push("cmd 인자에서 명령이 끼어들었다(pwned.txt 생김)");
    lines.push(`spawnJsonLines(.cmd) 종료 코드 ${code} · 인자 왕복 ${streamedSame ? "OK" : "MISMATCH"} · 끼어들기 표식 ${existsSync(canary) ? "생김(실패)" : "없음"}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

lines.push("", failures.length ? `**FAIL**\n\n${failures.map((f) => `- ${f}`).join("\n")}` : "**PASS**", "");
const report = lines.join("\n");
console.log(report);
if (process.env.SMOKE_REPORT) writeFileSync(process.env.SMOKE_REPORT, report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
process.exit(failures.length ? 1 : 0);
