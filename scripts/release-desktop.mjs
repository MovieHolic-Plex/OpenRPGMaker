#!/usr/bin/env node
// 최신 vX.Y.Z GitHub Release 에 리눅스 AppImage 와 윈도우 zip 이 없으면
// 그 태그에서 빌드해 올린다. 이미 있으면 바로 끝난다.
// 20분짜리 버전 제안과 분리한다. 패키징은 CPU 를 한 차례 다 쓴다.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const repo = process.cwd();
const buildRoot = process.env.OPRN_DESKTOP_BUILD || join(homedir(), ".cache", "oprn-desktop-release");
const lockFile = `${buildRoot}.lock`;
// 윈도우 zip 을 테스트용 PC 로 바로 보낸다(GitHub 에서 다시 받지 않는다). 비우면 건너뛴다.
// OPRN_WIN_DELIVER_HOST="" 로 끈다. 전달 실패는 릴리스 업로드를 실패시키지 않는다.
const deliverHost = process.env.OPRN_WIN_DELIVER_HOST ?? "ubbio@100.112.124.41";
const deliverDir = process.env.OPRN_WIN_DELIVER_DIR ?? "Downloads/oprn-app";
const deliverWinDir = process.env.OPRN_WIN_DELIVER_WINDIR ?? "C:\\Users\\ubbio\\Downloads\\oprn-app";

function run(command, args, { cwd = repo, allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${command} ${args.join(" ")} 실패${stderr ? `: ${stderr}` : ""}`);
  }
}

function runInherit(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function takeLock() {
  if (existsSync(lockFile)) {
    const pid = Number(readFileSync(lockFile, "utf8"));
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        console.log(`[release-desktop] 이미 실행 중 (pid ${pid})`);
        process.exit(0);
      } catch {
        // 죽은 잠금
      }
    }
  }
  writeFileSync(lockFile, String(process.pid));
}

function releaseLock() {
  try {
    if (existsSync(lockFile) && readFileSync(lockFile, "utf8").trim() === String(process.pid)) rmSync(lockFile);
  } catch {
    // 잠금 정리 실패는 다음 실행이 pid 로 판단한다
  }
}

function latestVersionTag() {
  const output = run("git", ["tag", "-l", "v[0-9]*", "--sort=-v:refname"]);
  const tag = output.split("\n").map((line) => line.trim()).find((line) => /^v\d+\.\d+\.\d+$/.test(line));
  if (!tag) throw new Error("vX.Y.Z 태그가 없음");
  return tag;
}

function assetNames(tag) {
  const raw = run("gh", ["release", "view", tag, "--json", "assets"]);
  const assets = JSON.parse(raw).assets ?? [];
  return assets.map((asset) => asset.name);
}

/** zip 을 SFTP 로 올리고 원격 크기를 대조한 뒤 원격에서 버전 폴더로 푼다. */
function deliverWindowsZip(zipPath, version) {
  const name = zipPath.split("/").pop();
  const localSize = statSync(zipPath).size;
  const ssh = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15"];
  const listing = execFileSync("sftp", ["-b", "-", ...ssh, "-P", "22", deliverHost], {
    input: `-mkdir ${deliverDir}\nput "${zipPath}" "${deliverDir}/${name}"\nls -l "${deliverDir}/${name}"\n`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const line = listing.split("\n").find((row) => row.includes(name) && !row.startsWith("sftp>"));
  const remoteSize = Number(line?.trim().split(/\s+/)[4]);
  if (remoteSize !== localSize) throw new Error(`원격 크기 불일치: 로컬 ${localSize}, 원격 ${remoteSize || "(없음)"}`);
  const zipWin = `${deliverWinDir}\\${name}`;
  const outWin = `${deliverWinDir}\\OPRN Studio ${version}`;
  const ps = [
    "$ProgressPreference='SilentlyContinue'",
    `$z='${zipWin}'`,
    `$d='${outWin}'`,
    "if (Test-Path $d) { Remove-Item -Recurse -Force $d }",
    "New-Item -ItemType Directory -Force $d | Out-Null",
    "tar -xf $z -C $d",
    "if ($LASTEXITCODE -ne 0) { 'TAR_FAIL ' + $LASTEXITCODE; exit 1 }",
    "$n=(Get-ChildItem -Recurse -File $d | Measure-Object).Count",
    "$exe=Get-Item (Join-Path $d 'OPRN Studio.exe')",
    "'EXTRACT files=' + $n + ' exe=' + $exe.Length",
  ].join("; ");
  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const out = execFileSync("ssh", [...ssh, deliverHost, `powershell -NoProfile -EncodedCommand ${encoded}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const result = out.split("\n").find((row) => row.startsWith("EXTRACT ") || row.startsWith("TAR_FAIL"))?.trim();
  if (!result?.startsWith("EXTRACT ")) throw new Error(`원격 압축 해제 실패: ${result || "(출력 없음)"}`);
  console.log(`[release-desktop] 윈도우 zip 전달: ${deliverHost} ${outWin} (${localSize} bytes, ${result})`);
}

function hasDesktop(names) {
  const appImage = names.some((name) => name.endsWith(".AppImage"));
  const winZip = names.some((name) => name.endsWith(".zip") && name.includes("win"));
  return appImage && winZip;
}

takeLock();
process.on("exit", releaseLock);
try {
  run("git", ["fetch", "origin", "--tags", "--quiet"], { allowFailure: true });
  const tag = latestVersionTag();
  const names = assetNames(tag);
  if (hasDesktop(names)) {
    console.log(`[release-desktop] ${tag} 에 AppImage·윈도우 zip 이 이미 있음`);
    process.exit(0);
  }

  console.log(`[release-desktop] ${tag} 데스크톱 빌드 시작`);
  run("git", ["worktree", "prune"]);
  if (existsSync(buildRoot)) run("git", ["worktree", "remove", "--force", buildRoot], { allowFailure: true });
  if (existsSync(buildRoot)) rmSync(buildRoot, { recursive: true, force: true });
  run("git", ["worktree", "add", "--detach", buildRoot, tag]);

  const env = {
    ...process.env,
    VITE_CACHE_DIR: join(buildRoot, ".vite-cache"),
    npm_config_fund: "false",
    npm_config_audit: "false",
  };
  execFileSync("npm", ["ci"], { cwd: buildRoot, stdio: "inherit", env });
  execFileSync("node", ["scripts/build-electron.mjs"], { cwd: buildRoot, stdio: "inherit", env });
  execFileSync("npx", ["vite", "build", "--configLoader", "runner"], { cwd: buildRoot, stdio: "inherit", env });
  // icon-tool.js is CJS. Without this, Node walks up to ~/package.json ("type":"module") and dies on require.
  writeFileSync(join(homedir(), ".cache/electron-builder/package.json"), "{\"type\":\"commonjs\"}\n");
  execFileSync(
    "npx",
    ["electron-builder", "--config", "scripts/electron-builder.config.mjs", "--linux", "AppImage", "--win", "zip", "--x64"],
    { cwd: buildRoot, stdio: "inherit", env },
  );

  const outDir = join(buildRoot, "dist-packages");
  const files = readdirSync(outDir)
    .filter((name) => name.endsWith(".AppImage") || (name.endsWith(".zip") && name.includes("win")))
    .map((name) => join(outDir, name));
  if (files.length < 2) throw new Error(`산출물이 부족합니다: ${files.join(", ") || "(없음)"}`);

  // README 의 /releases/latest/download/ 주소는 버전 없는 이름을 본다.
  const stable = [];
  for (const file of files) {
    const base = file.endsWith(".AppImage") ? "OPRN.Studio-linux.AppImage" : "OPRN.Studio-windows.zip";
    const alias = join(outDir, base);
    if (alias !== file) {
      copyFileSync(file, alias);
      stable.push(alias);
    }
  }
  runInherit("gh", ["release", "upload", tag, ...files, ...stable, "--clobber"], repo);
  console.log(`[release-desktop] ${tag} 업로드 완료: ${[...files, ...stable].map((file) => file.split("/").pop()).join(", ")}`);

  const winZip = files.find((file) => file.endsWith(".zip"));
  if (deliverHost && winZip) {
    try {
      deliverWindowsZip(winZip, tag.slice(1));
    } catch (error) {
      // 릴리스는 이미 올라갔다. 전달만 실패로 남기고 다음 수동 전달에 맡긴다.
      console.error(`[release-desktop] 윈도우 zip 전달 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} catch (error) {
  console.error(`[release-desktop] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
} finally {
  run("git", ["worktree", "remove", "--force", buildRoot], { allowFailure: true });
  releaseLock();
}
