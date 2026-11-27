#!/usr/bin/env node
/**
 * Packages an exported OPRN Desktop/Steam Game Kit (.zip or directory)
 * into a native Electron executable app for Windows, Linux, or macOS.
 *
 * Usage:
 *   npm run build:desktop-game -- --input ./MyGame-win64-steam-v1.0.0.zip
 *   npm run build:desktop-game -- --input ./exported-kit --platform linux --out ./dist-desktop-games
 *   npm run build:desktop-game -- --input ./MyGame.zip --installer
 *   npm run build:desktop-game -- --input ./MyGame.zip --dry-run
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

function printUsage() {
  process.stdout.write(
    [
      "OPRN Desktop Game Packager (Electron Native Runtime)",
      "",
      "Usage:",
      "  npm run build:desktop-game -- --input <kit.zip|kit-dir> [options]",
      "",
      "Options:",
      "  --input <path>        Path to exported Desktop/Steam kit (.zip or folder) [required]",
      "  --out <dir>           Output directory (default: dist-desktop-games/<slug>)",
      "  --platform <target>   Target OS: win | linux | mac | current (default: current)",
      "  --installer           Build distributable installer (NSIS / AppImage / DMG) instead of unpacked dir",
      "  --dry-run             Validate kit + bundle Electron player scripts without running electron-builder",
      "  --help                Show this help",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    input: "",
    out: "",
    platform: "current",
    installer: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (token === "--input" || token === "-i") {
      args.input = argv[++i] ?? "";
    } else if (token.startsWith("--input=")) {
      args.input = token.slice("--input=".length);
    } else if (token === "--out" || token === "-o") {
      args.out = argv[++i] ?? "";
    } else if (token.startsWith("--out=")) {
      args.out = token.slice("--out=".length);
    } else if (token === "--platform" || token === "-p") {
      args.platform = argv[++i] ?? "current";
    } else if (token.startsWith("--platform=")) {
      args.platform = token.slice("--platform=".length);
    } else if (token === "--installer") {
      args.installer = true;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (!token.startsWith("-") && !args.input) {
      args.input = token;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  return args;
}

function resolvePlatform(raw) {
  const value = String(raw || "current").toLowerCase();
  if (value === "current") {
    if (process.platform === "win32") return "win";
    if (process.platform === "darwin") return "mac";
    return "linux";
  }
  if (value === "win" || value === "win64" || value === "win64-steam" || value === "windows") return "win";
  if (value === "linux" || value === "linux64" || value === "linux64-steamos" || value === "steamos") return "linux";
  if (value === "mac" || value === "macos" || value === "macos-universal" || value === "darwin") return "mac";
  throw new Error(`Unsupported platform: ${raw} (use win | linux | mac | current)`);
}

function extractStoredZip(zipPath, destDir) {
  const bytes = new Uint8Array(readFileSync(zipPath));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocd = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minEocd; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid ZIP archive (EOCD missing)");
  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const root = resolve(destDir);
  mkdirSync(root, { recursive: true });

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_FILE_HEADER) {
      throw new Error("Corrupted ZIP central directory");
    }
    const method = view.getUint16(cursor + 10, true);
    if (method !== 0) {
      // Fall back to system unzip for deflated archives
      return false;
    }
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    cursor += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue;
    const normalized = name.replaceAll("\\", "/");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error(`Unsafe ZIP entry path rejected: ${name}`);
    }
    const outPath = resolve(root, normalized);
    if (!outPath.startsWith(`${root}${sep}`)) {
      throw new Error(`ZIP entry escapes target directory: ${name}`);
    }
    if (view.getUint32(localOffset, true) !== LOCAL_FILE_HEADER) {
      throw new Error(`Broken local ZIP header for ${name}`);
    }
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, bytes.subarray(dataStart, dataStart + compressedSize));
  }
  return true;
}

function unpackKitInput(inputPath, tempRoot) {
  const abs = resolve(inputPath);
  if (!existsSync(abs)) {
    throw new Error(`Input path does not exist: ${abs}`);
  }
  const st = statSync(abs);
  if (st.isDirectory()) return abs;
  const extractDir = join(tempRoot, "kit");
  mkdirSync(extractDir, { recursive: true });
  const extractedStored = extractStoredZip(abs, extractDir);
  if (!extractedStored) {
    const unzip = spawnSync("unzip", ["-q", "-o", abs, "-d", extractDir], { stdio: "inherit" });
    if (unzip.status !== 0) {
      throw new Error(`Failed to extract compressed ZIP (${abs}). Ensure 'unzip' is installed or use an OPRN stored ZIP.`);
    }
  }
  return extractDir;
}

function validateOpakFile(pakPath) {
  const bytes = new Uint8Array(readFileSync(pakPath));
  if (bytes.length < 12 || bytes[0] !== 0x4f || bytes[1] !== 0x50 || bytes[2] !== 0x41 || bytes[3] !== 0x4b) {
    throw new Error(`Invalid OPAK archive magic: ${pakPath}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== 1) throw new Error(`Unsupported OPAK version ${version}: ${pakPath}`);
  const headerLen = view.getUint32(8, true);
  if (12 + headerLen > bytes.length) throw new Error(`Truncated OPAK header: ${pakPath}`);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLen)));
  if (manifest.magic !== "OPAK" || !Array.isArray(manifest.entries)) {
    throw new Error(`Invalid OPAK manifest JSON: ${pakPath}`);
  }
  const hasEntry = manifest.entries.some((e) => e.path === "index.html" || e.path === "player.html");
  if (!hasEntry) {
    throw new Error("OPAK archive does not contain index.html or player.html");
  }
  return manifest;
}

function sanitizeVersion(raw) {
  const clean = String(raw || "1.0.0").trim().replace(/[^0-9.]/g, "");
  const parts = clean.split(".").filter(Boolean).slice(0, 3);
  while (parts.length < 3) parts.push("0");
  return parts.map((p) => String(Number.parseInt(p, 10) || 0)).join(".");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.input) {
    printUsage();
    throw new Error("Missing required --input <kit.zip|kit-dir>");
  }

  const targetPlatform = resolvePlatform(args.platform);
  const tempRoot = mkdtempSync(join(tmpdir(), "oprn-desktop-game-"));

  try {
    const kitDir = unpackKitInput(args.input, tempRoot);
    const resourcesDir = join(kitDir, "resources");
    const runtimeConfigPath = join(resourcesDir, "desktop-runtime.json");
    if (!existsSync(runtimeConfigPath)) {
      throw new Error(`Missing resources/desktop-runtime.json in ${kitDir}. Export a Desktop/Steam kit first.`);
    }
    const runtimeConfig = JSON.parse(readFileSync(runtimeConfigPath, "utf8"));
    const gameTitle = String(runtimeConfig.gameTitle || "OPRN Game").trim();
    const slug = String(runtimeConfig.executableSlug || "oprn-game").trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "oprn-game";
    const version = sanitizeVersion(runtimeConfig.version || "1.0.0");

    const pakPath = join(resourcesDir, "game.pak");
    const unpackedIndexPath = join(resourcesDir, "app", "index.html");
    const hasPak = existsSync(pakPath);
    let pakManifest = null;
    if (hasPak) {
      pakManifest = validateOpakFile(pakPath);
    } else if (!existsSync(unpackedIndexPath)) {
      throw new Error("Neither resources/game.pak nor resources/app/index.html was found in the kit.");
    }

    const stageDir = join(tempRoot, "stage");
    const distPlayerDir = join(stageDir, "dist-player");
    const stageResourcesDir = join(stageDir, "resources");
    mkdirSync(distPlayerDir, { recursive: true });
    mkdirSync(stageResourcesDir, { recursive: true });

    // Bundle Electron native player main & preload scripts
    for (const [entryRel, outName] of [
      ["electron/player/main.ts", "main.cjs"],
      ["electron/player/preload.ts", "preload.cjs"],
    ]) {
      await build({
        absWorkingDir: REPO_ROOT,
        bundle: true,
        entryPoints: [resolve(REPO_ROOT, entryRel)],
        format: "cjs",
        platform: "node",
        target: "node22",
        external: ["electron", "node:*"],
        logLevel: "warning",
        outfile: join(distPlayerDir, outName),
      });
    }

    // Stage game resources (OPAK archive or unpacked app dir, never both duplicated)
    cpSync(runtimeConfigPath, join(stageResourcesDir, "desktop-runtime.json"));
    if (hasPak) {
      cpSync(pakPath, join(stageResourcesDir, "game.pak"));
      const pakManifestPath = join(resourcesDir, "pak-manifest.json");
      if (existsSync(pakManifestPath)) {
        cpSync(pakManifestPath, join(stageResourcesDir, "pak-manifest.json"));
      }
    } else {
      cpSync(join(resourcesDir, "app"), join(stageResourcesDir, "app"), { recursive: true });
    }

    const steamAppIdPath = join(kitDir, "steam_appid.txt");
    const hasSteamAppId = existsSync(steamAppIdPath);
    if (hasSteamAppId) {
      cpSync(steamAppIdPath, join(stageDir, "steam_appid.txt"));
    }

    const outDir = resolve(args.out || join(REPO_ROOT, "dist-desktop-games", `${slug}-${targetPlatform}`));
    const electronVersion = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")).devDependencies?.electron;

    writeFileSync(
      join(stageDir, "package.json"),
      JSON.stringify(
        {
          name: slug.toLowerCase(),
          productName: gameTitle,
          version,
          private: true,
          main: "dist-player/main.cjs",
          author: "OPRN Studio",
          description: `${gameTitle} — Desktop Player`,
        },
        null,
        2,
      ),
    );

    const builderConfig = {
      appId: `com.oprn.game.${slug.toLowerCase().replace(/[^a-z0-9.-]/g, "") || "app"}`,
      productName: gameTitle,
      executableName: slug,
      ...(electronVersion ? { electronVersion: String(electronVersion).replace(/^[^0-9]+/, "") } : {}),
      directories: {
        app: stageDir,
        output: outDir,
      },
      asar: true,
      files: ["dist-player/**", "package.json", "!node_modules/**"],
      extraResources: [{ from: join(stageDir, "resources"), to: "." }],
      ...(hasSteamAppId ? { extraFiles: [{ from: join(stageDir, "steam_appid.txt"), to: "steam_appid.txt" }] } : {}),
      win: {
        target: args.installer ? ["nsis"] : ["dir"],
      },
      linux: {
        target: args.installer ? ["AppImage"] : ["dir"],
        category: "Game",
      },
      mac: {
        target: args.installer ? ["dmg"] : ["dir"],
        category: "public.app-category.games",
      },
    };
    const builderConfigPath = join(tempRoot, "electron-builder.config.json");
    writeFileSync(builderConfigPath, JSON.stringify(builderConfig, null, 2));

    process.stdout.write(`[build-desktop-game] Game: ${gameTitle} (${slug} v${version})\n`);
    process.stdout.write(
      `[build-desktop-game] Archive: ${hasPak ? `resources/game.pak (${pakManifest.entryCount} entries, ${(pakManifest.totalPayloadBytes / 1048576).toFixed(2)} MB payload)` : "resources/app/ (unpacked)"}\n`,
    );
    process.stdout.write(`[build-desktop-game] Target: ${targetPlatform} (${args.installer ? "installer" : "unpacked app dir"})\n`);

    if (args.dryRun) {
      const dryOut = join(outDir, "dry-run-stage");
      rmSync(dryOut, { recursive: true, force: true });
      mkdirSync(dirname(dryOut), { recursive: true });
      cpSync(stageDir, dryOut, { recursive: true });
      writeFileSync(join(dryOut, "electron-builder.config.json"), JSON.stringify(builderConfig, null, 2));
      process.stdout.write(`[build-desktop-game] Dry-run complete. Staged Electron player at: ${dryOut}\n`);
      return;
    }

    const builderBin = resolve(
      REPO_ROOT,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
    );
    if (!existsSync(builderBin)) {
      throw new Error(`electron-builder not found at ${builderBin}. Run npm ci first.`);
    }

    const platformFlag = targetPlatform === "win" ? "--win" : targetPlatform === "mac" ? "--mac" : "--linux";
    const cliArgs = [platformFlag, "--config", builderConfigPath, "--publish", "never"];
    if (!args.installer) cliArgs.push("--dir");

    mkdirSync(outDir, { recursive: true });
    const result = spawnSync(builderBin, cliArgs, {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`electron-builder exited with code ${result.status ?? 1}`);
    }

    // Copy steamworks VDF kit beside output for convenient SteamPipe upload
    const steamworksDir = join(kitDir, "steamworks");
    if (existsSync(steamworksDir)) {
      cpSync(steamworksDir, join(outDir, "steamworks"), { recursive: true });
    }

    process.stdout.write(`[build-desktop-game] Packaged native Electron game in: ${outDir}\n`);
    process.stdout.write(`[build-desktop-game] Input source: ${basename(args.input)}\n`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`[build-desktop-game] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
