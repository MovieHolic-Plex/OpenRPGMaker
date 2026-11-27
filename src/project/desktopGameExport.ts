/**
 * 데스크톱 & Steam Depot 게임 패키징 키트 내보내기 빌더.
 *
 * 브라우저 안에서 가짜 .exe / .x86_64 스텁을 만들지 않고, 실제로 동작하는 패키징 키트를 조립한다:
 *   1. 바이너리 에셋 아카이브 (`resources/game.pak`, OPAK v1) 또는 비압축 `resources/app/` 중 하나만 수록
 *      — 동일 파일의 평문 중복 복사를 없애고 Electron `oprn-game://` 핸들러와 로컬 런처가 직접 읽는다.
 *   2. 즉시 실행 가능한 로컬 루프백 HTTP 런처 (`play-local.mjs` + `Launch-<slug>.bat` / `.sh` / `.command`)
 *      — `file://` CORS 실패 없이 `resources/game.pak`을 `http://127.0.0.1:<port>/`로 서빙하고
 *        `saves/*.oprn-save.json`에 실제 디스크 저장/복원까지 수행한다.
 *   3. Electron 네이티브 앱 패키징 입력 (`resources/desktop-runtime.json`)
 *      — `npm run build:desktop-game -- --input <내보낸.zip>`으로 Windows(.exe) / Linux / macOS(.app)
 *        실제 실행 앱을 생성한다.
 *   4. Steamworks 배포 키트 (`steam_appid.txt`, `steamworks/app_build_<appId>.vdf`,
 *      `steamworks/depot_build_<depotId>.vdf` [saves/* 제외 포함], `steam_input_manifest.vdf`,
 *      `STEAM_LAUNCH_CHECKLIST.md`) — 빈 더미 세이브 파일은 배포하지 않는다.
 */
import { writeStoredZip, type ZipEntry } from "@/project/packageZip";
import {
  WEB_PLAYER_BUNDLE_BASE,
  prepareWebExport,
  type PreparedWebExport,
  type WebExportSummary,
} from "@/project/webExport";
import { loadVerifiedPlayerDeployment, type FetchBytes } from "@/project/playerDeploymentManifest";
import { defaultFetchBytes, exactWebExportEntries } from "@/project/webExportZip";
import { loadPublicationRuntime, publicationAssetEntries } from "@/project/publicationExport";
import { safeFileName } from "@/project/webExportAssets";
import { sha256HexBytes } from "@/util/sha256";
import type { Project } from "@/project/types";

export type DesktopExportPlatform =
  | "win64-steam"
  | "linux64-steamos"
  | "macos-universal"
  | "web-pwa";

export type DesktopDisplayMode =
  | "fullscreen"
  | "windowed-720p"
  | "windowed-640p";

export interface DesktopSteamExportOptions {
  readonly platform?: DesktopExportPlatform;
  readonly steamAppId?: number;
  readonly steamDepotId?: number;
  readonly displayMode?: DesktopDisplayMode;
  readonly packAssetsArchive?: boolean;
  readonly enableSteamAutoCloud?: boolean;
  readonly enableSteamInputGamepad?: boolean;
  readonly versionLabel?: string;
  readonly executableName?: string;
  /** 체험판 → 본편 세이브 인계용 공유 그룹 ID (동일 ID를 지정하면 saveNamespace를 공유한다). */
  readonly sharedSaveGroup?: string;
  /** 세이브 네임스페이스를 직접 덮어쓸 때 사용한다(지정 시 sharedSaveGroup·AppID 기본값보다 우선). */
  readonly saveNamespace?: string;
  readonly bundleBase?: string;
  readonly fetchBytes?: FetchBytes;
}

export interface DesktopPakEntryMeta {
  readonly path: string;
  readonly offset: number;
  readonly size: number;
  readonly sha256: string;
}

export interface DesktopPakArchiveManifest {
  readonly magic: "OPAK";
  readonly formatVersion: 1;
  readonly gameTitle: string;
  readonly createdAt: string;
  readonly entryCount: number;
  readonly totalPayloadBytes: number;
  readonly entries: readonly DesktopPakEntryMeta[];
}

export interface DesktopSteamExportSummary extends WebExportSummary {
  readonly platform: DesktopExportPlatform;
  readonly steamAppId: number;
  readonly steamDepotId: number;
  readonly displayMode: DesktopDisplayMode;
  /** 압축 해제 후 바로 실행할 수 있는 키트 진입점 (`Launch-*.bat` / `.sh` / `.command` 또는 `index.html`). */
  readonly executablePath: string;
  /** `npm run build:desktop-game` Electron 패키징 후 Steam Launch Option에 지정할 최종 실행 파일 경로. */
  readonly nativeExecutablePath: string;
  readonly saveNamespace: string;
  readonly pakArchivePath: string;
  readonly pakArchiveBytes: number;
  readonly pakEntryCount: number;
  readonly savePattern: string;
  readonly zipEntryCount: number;
  readonly entryNames: readonly string[];
}

export interface DesktopSteamExportResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly summary: DesktopSteamExportSummary;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** Regular file, owner rwx, group/other rx. Unzip and Steam keep this only when the ZIP host OS is Unix. */
const UNIX_EXECUTABLE = 0o100755;

export const DESKTOP_PLATFORM_SPECS: Readonly<Record<DesktopExportPlatform, {
  readonly id: DesktopExportPlatform;
  readonly label: string;
  readonly badge: string;
  readonly subtitle: string;
  readonly steamOsList: string;
  readonly steamArch: string;
}>> = {
  "win64-steam": {
    id: "win64-steam",
    label: "Windows x64 · 데스크톱 / Steam 패키징 키트",
    badge: "Steam 기본 · Electron 입력",
    subtitle: "resources/game.pak + 로컬 HTTP 실행 런처 + Auto-Cloud 설정 + SteamPipe VDF (Electron .exe 빌드용)",
    steamOsList: "windows",
    steamArch: "64",
  },
  "linux64-steamos": {
    id: "linux64-steamos",
    label: "Linux x64 / Steam Deck (SteamOS) 패키징 키트",
    badge: "Steam Deck 패드 대응",
    subtitle: "resources/game.pak + 로컬 실행 스크립트 + Steam Input 매핑 + SteamPipe VDF (Electron Linux 빌드용)",
    steamOsList: "linux",
    steamArch: "64",
  },
  "macos-universal": {
    id: "macos-universal",
    label: "macOS (.app) 데스크톱 / Steam 패키징 키트",
    badge: "Apple Silicon & Intel",
    subtitle: "resources/game.pak + 로컬 실행 .command + 공증 체크리스트 (Electron .app 빌드용)",
    steamOsList: "macos",
    steamArch: "64",
  },
  "web-pwa": {
    id: "web-pwa",
    label: "웹 서버 배포용 번들 (.zip)",
    badge: "웹 호스팅 / Itch.io",
    subtitle: "정적 웹 서버 및 커뮤니티 호스팅용 표준 플레이어 번들",
    steamOsList: "windows,linux,macos",
    steamArch: "64",
  },
};

export function desktopExportSlug(project: Project, customExecutableName?: string): string {
  const raw = customExecutableName?.trim() || project.meta.title?.trim() || "oprn-game";
  const slug = safeFileName(raw).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "oprn-game";
}

export function resolveDesktopSaveNamespace(options: {
  readonly steamAppId: number;
  readonly slug: string;
  readonly saveNamespace?: string;
  readonly sharedSaveGroup?: string;
}): string {
  const explicit = sanitizeNamespaceToken(options.saveNamespace);
  if (explicit) return explicit;
  const shared = sanitizeNamespaceToken(options.sharedSaveGroup);
  if (shared) return `shared-save-${shared}`;
  return `steam-app-${options.steamAppId}-${options.slug}`;
}

function sanitizeNamespaceToken(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function desktopSteamExportFileName(
  project: Project,
  options: Pick<DesktopSteamExportOptions, "platform" | "versionLabel" | "executableName"> = {},
): string {
  const platform = options.platform ?? "win64-steam";
  const slug = desktopExportSlug(project, options.executableName);
  const rawVersion = options.versionLabel?.trim() || project.meta.publication?.versionLabel?.trim() || "1.0.0";
  const cleanVersion = rawVersion.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${slug}-${platform}-v${cleanVersion}.zip`;
}

export function nativeExecutablePathForPlatform(platform: DesktopExportPlatform, slug: string): string {
  if (platform === "win64-steam") return `${slug}.exe`;
  if (platform === "linux64-steamos") return slug;
  if (platform === "macos-universal") return `${slug}.app/Contents/MacOS/${slug}`;
  return "index.html";
}

/**
 * `OPAK` 바이너리 아카이브 포맷 조립기 (`resources/game.pak`).
 *
 * 구조:
 *   [0..3]   Magic: "OPAK" (0x4F, 0x50, 0x41, 0x4B)
 *   [4..7]   Version: uint32 LE (1)
 *   [8..11]  Header JSON byte length: uint32 LE
 *   [12..12+H] UTF-8 JSON header (DesktopPakArchiveManifest)
 *   [12+H..] Concatenated binary payloads at exact offsets
 */
export async function buildOprnPakArchive(
  gameTitle: string,
  entries: readonly ZipEntry[],
): Promise<{ readonly bytes: Uint8Array; readonly manifest: DesktopPakArchiveManifest }> {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const metas: DesktopPakEntryMeta[] = [];
  let offset = 0;
  for (const entry of sorted) {
    const sha256 = await sha256HexBytes(entry.bytes);
    metas.push({
      path: entry.name,
      offset,
      size: entry.bytes.length,
      sha256,
    });
    offset += entry.bytes.length;
  }
  const manifest: DesktopPakArchiveManifest = {
    magic: "OPAK",
    formatVersion: 1,
    gameTitle: gameTitle || "OPRN Game",
    createdAt: "2026-10-19T00:00:00.000Z",
    entryCount: metas.length,
    totalPayloadBytes: offset,
    entries: metas,
  };
  const headerBytes = encoder.encode(JSON.stringify(manifest));
  const totalLength = 12 + headerBytes.length + offset;
  const out = new Uint8Array(totalLength);
  out[0] = 0x4f; // 'O'
  out[1] = 0x50; // 'P'
  out[2] = 0x41; // 'A'
  out[3] = 0x4b; // 'K'
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(4, 1, true);
  view.setUint32(8, headerBytes.length, true);
  out.set(headerBytes, 12);
  let cursor = 12 + headerBytes.length;
  for (const entry of sorted) {
    out.set(entry.bytes, cursor);
    cursor += entry.bytes.length;
  }
  return { bytes: out, manifest };
}

/** OPAK 바이너리에서 헤더 매니페스트와 개별 파일 바이트를 복원한다 (검증·테스트용). */
export function readOprnPakArchive(pakBytes: Uint8Array): {
  readonly manifest: DesktopPakArchiveManifest;
  readonly readEntry: (path: string) => Uint8Array | null;
} {
  if (
    pakBytes.length < 12 ||
    pakBytes[0] !== 0x4f ||
    pakBytes[1] !== 0x50 ||
    pakBytes[2] !== 0x41 ||
    pakBytes[3] !== 0x4b
  ) {
    throw new Error("Invalid OPAK archive header magic");
  }
  const view = new DataView(pakBytes.buffer, pakBytes.byteOffset, pakBytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== 1) throw new Error(`Unsupported OPAK version: ${version}`);
  const headerLen = view.getUint32(8, true);
  const payloadStart = 12 + headerLen;
  if (payloadStart > pakBytes.length) throw new Error("Truncated OPAK header");
  const manifest = JSON.parse(decoder.decode(pakBytes.subarray(12, payloadStart))) as DesktopPakArchiveManifest;
  return {
    manifest,
    readEntry: (targetPath: string) => {
      const meta = manifest.entries.find((item) => item.path === targetPath);
      if (!meta) return null;
      const start = payloadStart + meta.offset;
      const end = start + meta.size;
      if (end > pakBytes.length) throw new Error(`Truncated OPAK entry: ${targetPath}`);
      return pakBytes.slice(start, end);
    },
  };
}

export async function createDesktopSteamExportPackage(
  project: Project,
  options: DesktopSteamExportOptions = {},
): Promise<DesktopSteamExportResult> {
  const platform: DesktopExportPlatform = options.platform ?? "win64-steam";
  const steamAppId = normalizePositiveInt(options.steamAppId, 480);
  const steamDepotId = normalizePositiveInt(options.steamDepotId, steamAppId + 1);
  const displayMode: DesktopDisplayMode = options.displayMode ?? "fullscreen";
  const packAssetsArchive = options.packAssetsArchive !== false && platform !== "web-pwa";
  const enableSteamAutoCloud = options.enableSteamAutoCloud !== false;
  const enableSteamInputGamepad = options.enableSteamInputGamepad !== false;
  const versionLabel = options.versionLabel?.trim() || project.meta.publication?.versionLabel?.trim() || "1.0.0";
  const slug = desktopExportSlug(project, options.executableName);
  const title = project.meta.title?.trim() || "OPRN Game";
  const saveNamespace = resolveDesktopSaveNamespace({
    steamAppId,
    slug,
    saveNamespace: options.saveNamespace,
    sharedSaveGroup: options.sharedSaveGroup,
  });
  const nativeExecutablePath = nativeExecutablePathForPlatform(platform, slug);

  const prepared = prepareWebExport(project);
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const rawRuntimeEntries = await collectVerifiedRuntimeEntries(prepared, options.bundleBase, fetchBytes);

  // Inject desktop boot config into index.html ONCE before packing into game.pak or resources/app/.
  const bootInjectedEntries: ZipEntry[] = rawRuntimeEntries.map((entry) => {
    if (entry.name === "player.html") {
      const htmlText = decoder.decode(entry.bytes);
      const injectedHtml = injectDesktopBootConfig(htmlText, {
        title,
        slug,
        platform,
        steamAppId,
        displayMode,
        saveNamespace,
        enableSteamAutoCloud,
        enableSteamInputGamepad,
      });
      return { name: "index.html", bytes: encoder.encode(injectedHtml) };
    }
    return entry;
  });

  const zipEntries: ZipEntry[] = [];
  const addText = (name: string, content: string, unixMode?: number) => {
    zipEntries.push({ name, bytes: encoder.encode(content), ...(unixMode === undefined ? {} : { unixMode }) });
  };
  const addBytes = (name: string, bytes: Uint8Array, unixMode?: number) => {
    zipEntries.push({ name, bytes, ...(unixMode === undefined ? {} : { unixMode }) });
  };

  // 1. Real CORS-free Local Launcher Scripts (no fake PE/ELF stubs!)
  const executablePath = addPlatformLaunchers({
    platform,
    slug,
    title,
    versionLabel,
    steamAppId,
    displayMode,
    addText,
  });

  // 2. Packaged Game Resources — EITHER resources/game.pak (OPAK) OR resources/app/ (unpacked), never duplicated!
  let pakArchivePath = "";
  let pakArchiveBytes = 0;
  let pakEntryCount = 0;

  if (platform === "web-pwa") {
    for (const entry of bootInjectedEntries) {
      addBytes(entry.name, entry.bytes);
    }
  } else if (packAssetsArchive) {
    const { bytes: pakBytes, manifest: pakManifest } = await buildOprnPakArchive(title, bootInjectedEntries);
    pakArchivePath = "resources/game.pak";
    pakArchiveBytes = pakBytes.length;
    pakEntryCount = pakManifest.entryCount;
    addBytes(pakArchivePath, pakBytes);
    addText("resources/pak-manifest.json", JSON.stringify(pakManifest, null, 2));
  } else {
    for (const entry of bootInjectedEntries) {
      addBytes(`resources/app/${entry.name}`, entry.bytes);
    }
  }

  const fileName = desktopSteamExportFileName(project, {
    platform,
    versionLabel,
    executableName: options.executableName,
  });

  if (platform !== "web-pwa") {
    addText(
      "resources/desktop-runtime.json",
      JSON.stringify(
        {
          schema: "oprn/desktop-runtime-v1",
          gameTitle: title,
          executableSlug: slug,
          version: versionLabel,
          platform,
          nativeBuild: {
            packagerCommand: `npm run build:desktop-game -- --input ${fileName}`,
            expectedExecutable: nativeExecutablePath,
            kitLauncher: executablePath,
          },
          window: {
            defaultMode: displayMode,
            width: displayMode === "windowed-640p" ? 960 : 1280,
            height: displayMode === "windowed-640p" ? 640 : 720,
            resizable: true,
            fullscreenShortcuts: ["F11", "Alt+Enter"],
            screenshotShortcut: "F12",
            pixelArtIntegerScaling: true,
          },
          storage: {
            steamAutoCloud: enableSteamAutoCloud,
            saveDirectory: "saves",
            saveNamespace,
            ...(options.sharedSaveGroup?.trim() ? { sharedSaveGroup: options.sharedSaveGroup.trim() } : {}),
            saveFilePattern: "*.oprn-save.json",
            configFile: "saves/config.json",
          },
          input: {
            steamInput: enableSteamInputGamepad,
            html5GamepadPolling: true,
            mappings: {
              confirm: ["ButtonA", "ButtonSouth", "Z", "Enter", "Space"],
              cancel: ["ButtonB", "ButtonEast", "X", "Escape"],
              menu: ["ButtonY", "ButtonNorth", "ButtonStart", "X", "Escape"],
              dash: ["ButtonX", "ButtonWest", "LeftShoulder", "Shift"],
              move: ["LeftStick", "DPad", "ArrowKeys", "WASD"],
            },
          },
          archive: {
            pakPath: pakArchivePath || null,
            packed: packAssetsArchive,
            entryCount: pakEntryCount,
            totalPayloadBytes: pakArchiveBytes,
          },
        },
        null,
        2,
      ),
    );
  }

  // 3. Steam Auto-Cloud Save Documentation (NO dummy slot-01.oprn-save.json placeholder!)
  const savePattern = "*.oprn-save.json";
  if (platform !== "web-pwa") {
    addText(
      "saves/config.json",
      JSON.stringify(
        {
          schema: "oprn/desktop-save-config-v1",
          gameTitle: title,
          executableSlug: slug,
          steamAppId,
          saveNamespace,
          autoCloudSync: enableSteamAutoCloud,
          displayMode,
          audioVolume: { bgm: 100, bgs: 100, me: 100, se: 100 },
          slots: {
            pattern: "saves/slot-XX.oprn-save.json",
            autosave: "saves/autosave.oprn-save.json",
            clearRecord: "saves/clear-record.oprn-save.json",
            galleryRecord: "saves/gallery-record.oprn-save.json",
          },
        },
        null,
        2,
      ),
    );
    addText(
      "saves/README-STEAM-CLOUD.txt",
      [
        "====================================================================",
        `  ${title} — Steam Auto-Cloud Save Directory (saves/)`,
        "====================================================================",
        "",
        "이 폴더(saves/)는 플레이어 세이브 파일이 저장되는 로컬 경로입니다.",
        "depot_build.vdf에는 \"FileExclusion\" \"saves/*\" 규칙이 들어 있어 Steam 업데이트가 유저 세이브를 덮어쓰지 않습니다.",
        "",
        "Steamworks 파트너 포털 -> Steam Cloud -> Auto-Cloud 설정:",
        "  - Root (루트 경로)   : GameInstall (포터블 설치 폴더) 또는 OS별 AppData/userData",
        `  - Subdirectory (하위): saves (OS userData 사용 시 OPRN-Games/${saveNamespace}/saves)`,
        `  - Pattern (패턴)     : ${savePattern}`,
        "  - OS                 : All (Windows / macOS / Linux & SteamOS)",
        "",
        "실제 인게임 저장 시 생성되는 파일:",
        "  - saves/slot-01.oprn-save.json ~ slot-20.oprn-save.json (수동 슬롯)",
        "  - saves/autosave.oprn-save.json (자동 저장)",
        "  - saves/clear-record.oprn-save.json (클리어 / New Game+ 기록)",
        "  - saves/gallery-record.oprn-save.json (갤러리 해금 기록)",
        "",
      ].join("\n"),
    );

    // 4. Steamworks SDK & SteamPipe Depot Builder Scripts (`steamworks/`)
    addText("steam_appid.txt", `${steamAppId}\n`);
    addText("steamworks/steam_appid.txt", `${steamAppId}\n`);
    addText(
      `steamworks/app_build_${steamAppId}.vdf`,
      buildSteamAppVdf({
        steamAppId,
        steamDepotId,
        title,
        versionLabel,
        platform,
      }),
    );
    addText(
      `steamworks/depot_build_${steamDepotId}.vdf`,
      buildSteamDepotVdf({
        steamDepotId,
      }),
    );
    addText(
      "steamworks/steam_input_manifest.vdf",
      buildSteamInputManifestVdf(title),
    );
    addText(
      "steamworks/STEAM_LAUNCH_CHECKLIST.md",
      buildSteamLaunchChecklistMd({
        title,
        slug,
        fileName,
        platform,
        executablePath,
        nativeExecutablePath,
        steamAppId,
        steamDepotId,
        displayMode,
        savePattern,
        saveNamespace,
        versionLabel,
      }),
    );
  }

  const sortedZipEntries = [...zipEntries].sort((a, b) => a.name.localeCompare(b.name));
  const blob = writeStoredZip(sortedZipEntries);

  return {
    blob,
    fileName,
    summary: {
      ...prepared.summary,
      platform,
      steamAppId,
      steamDepotId,
      displayMode,
      executablePath,
      nativeExecutablePath,
      saveNamespace,
      pakArchivePath,
      pakArchiveBytes,
      pakEntryCount,
      savePattern: `saves/${savePattern}`,
      zipEntryCount: sortedZipEntries.length,
      entryNames: sortedZipEntries.map((entry) => entry.name),
    },
  };
}

async function collectVerifiedRuntimeEntries(
  prepared: PreparedWebExport,
  bundleBase: string | undefined,
  fetchBytes: FetchBytes,
): Promise<readonly ZipEntry[]> {
  if (prepared.project.meta.publication) {
    const archive = await loadPublicationRuntime(prepared, fetchBytes);
    const bundles = await Promise.all(
      archive.runtime.files
        .filter((file) => file.path.startsWith("web/"))
        .map(async (file) => ({
          name: file.path.slice(4),
          bytes: await archive.read(file.path),
        })),
    );
    const assets = await publicationAssetEntries(prepared, archive);
    return [
      { name: "project.json", bytes: encoder.encode(prepared.projectJson) },
      ...bundles,
      ...assets,
    ];
  }
  const deployment = await loadVerifiedPlayerDeployment({
    bundleBase: bundleBase ?? WEB_PLAYER_BUNDLE_BASE,
    adapters: { fetchBytes },
  });
  return exactWebExportEntries(prepared, deployment, fetchBytes);
}

function addPlatformLaunchers(options: {
  readonly platform: DesktopExportPlatform;
  readonly slug: string;
  readonly title: string;
  readonly versionLabel: string;
  readonly steamAppId: number;
  readonly displayMode: DesktopDisplayMode;
  readonly addText: (name: string, content: string, unixMode?: number) => void;
}): string {
  const { platform, slug, title, versionLabel, steamAppId, displayMode, addText } = options;

  if (platform === "web-pwa") {
    return "index.html";
  }

  // Zero-dependency local loopback HTTP launcher that reads resources/game.pak (OPAK) directly
  // without CORS failures and bridges saves/*.oprn-save.json to disk.
  addText("play-local.mjs", buildLocalPakHttpLauncherScript({ title, slug, displayMode }), UNIX_EXECUTABLE);

  if (platform === "win64-steam") {
    const launcherName = `Launch-${slug}.bat`;
    addText(
      launcherName,
      [
        "@echo off",
        "chcp 65001 >nul",
        `title ${batWindowTitle(`${title} (v${versionLabel})`)}`,
        "setlocal",
        `set STEAM_APPID=${steamAppId}`,
        'set "GAME_ROOT=%~dp0"',
        'where node >nul 2>nul',
        "if errorlevel 1 (",
        "  echo [OPRN] Node.js 20+ is required to run this local test launcher.",
        "  echo [OPRN] For standalone Steam distribution without Node.js, package with:",
        "  echo        npm run build:desktop-game -- --input ^<exported-kit.zip^> --platform win",
        "  pause",
        "  exit /b 1",
        ")",
        'node "%GAME_ROOT%play-local.mjs" %*',
        "",
      ].join("\r\n"),
    );
    return launcherName;
  }

  if (platform === "linux64-steamos") {
    const launcherName = `Launch-${slug}.sh`;
    addText(
      launcherName,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
        `export SteamAppId="${steamAppId}"`,
        `export SteamGameId="${steamAppId}"`,
        'if ! command -v node >/dev/null 2>&1; then',
        "  printf '%s\\n' '[OPRN] Node.js 20+ is required for this local test launcher.' >&2",
        "  printf '%s\\n' '[OPRN] Build a standalone Electron binary with: npm run build:desktop-game -- --input <kit.zip> --platform linux' >&2",
        "  exit 1",
        "fi",
        'exec node "${SCRIPT_DIR}/play-local.mjs" "$@"',
        "",
      ].join("\n"),
      UNIX_EXECUTABLE,
    );
    return launcherName;
  }

  // macos-universal
  const launcherName = `Launch-${slug}.command`;
  addText(
    launcherName,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
      `export SteamAppId="${steamAppId}"`,
      'if ! command -v node >/dev/null 2>&1; then',
      "  printf '%s\\n' '[OPRN] Node.js 20+ is required for this local test launcher.' >&2",
      "  printf '%s\\n' '[OPRN] Build a standalone Electron .app with: npm run build:desktop-game -- --input <kit.zip> --platform mac' >&2",
      "  exit 1",
      "fi",
      'exec node "${SCRIPT_DIR}/play-local.mjs" "$@"',
      "",
    ].join("\n"),
    UNIX_EXECUTABLE,
  );
  return launcherName;
}

/**
 * Generates a self-contained Node ESM loopback server (`play-local.mjs`) that serves
 * `resources/game.pak` (OPAK v1) or `resources/app/` over `http://127.0.0.1:<port>/`
 * with zero CORS failures and real file-backed save sync (`saves/*.oprn-save.json`).
 */
function buildLocalPakHttpLauncherScript(options: {
  readonly title: string;
  readonly slug: string;
  readonly displayMode: DesktopDisplayMode;
}): string {
  const defaultMode = JSON.stringify(options.displayMode);
  const titleJson = JSON.stringify(options.title);
  return `#!/usr/bin/env node
// OPRN Local Loopback Launcher — serves resources/game.pak (OPAK v1) over 127.0.0.1 with zero CORS errors.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESOURCES = join(ROOT, "resources");
const SAVES_DIR = join(ROOT, "saves");
const PAK_PATH = join(RESOURCES, "game.pak");
const APP_DIR = join(RESOURCES, "app");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".wasm": "application/wasm",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".mp4": "video/mp4", ".webm": "video/webm",
};

function openPak(filePath) {
  const fd = openSync(filePath, "r");
  const prefix = Buffer.allocUnsafe(12);
  readSync(fd, prefix, 0, 12, 0);
  if (prefix.toString("ascii", 0, 4) !== "OPAK") throw new Error("Invalid OPAK header");
  const headerLen = prefix.readUInt32LE(8);
  const headerBuf = Buffer.allocUnsafe(headerLen);
  readSync(fd, headerBuf, 0, headerLen, 12);
  const manifest = JSON.parse(headerBuf.toString("utf8"));
  const map = new Map(manifest.entries.map((e) => [e.path, e]));
  const payloadStart = 12 + headerLen;
  return {
    read(relPath) {
      const meta = map.get(relPath) || (relPath === "index.html" ? map.get("player.html") : null);
      if (!meta) return null;
      const out = Buffer.allocUnsafe(meta.size);
      readSync(fd, out, 0, meta.size, payloadStart + meta.offset);
      return out;
    },
    close() { closeSync(fd); },
  };
}

function safeSavePath(raw) {
  const clean = String(raw || "").replaceAll("\\\\", "/").replace(/^saves\\//, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(clean) || clean.includes("..")) {
    throw new Error("Unsafe save path");
  }
  const abs = resolve(SAVES_DIR, clean);
  if (!abs.startsWith(resolve(SAVES_DIR) + sep)) throw new Error("Escapes saves/");
  return abs;
}

const LOCAL_BRIDGE_SCRIPT = \`<script>
window.__oprnDesktopPlayer = window.__oprnDesktopPlayer || {
  async writeSaveFile(path, content) {
    await fetch("/__oprn-desktop/save?path=" + encodeURIComponent(path), { method: "PUT", body: content });
  },
  async readSaveFile(path) {
    const r = await fetch("/__oprn-desktop/save?path=" + encodeURIComponent(path));
    return r.ok ? r.text() : null;
  },
  async listSaveFiles() {
    const r = await fetch("/__oprn-desktop/saves");
    return r.ok ? r.json() : [];
  },
  async quit() {
    await fetch("/__oprn-desktop/quit", { method: "POST" }).catch(() => {});
    window.close();
  },
};
</script>\`;

const pak = existsSync(PAK_PATH) ? openPak(PAK_PATH) : null;
mkdirSync(SAVES_DIR, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/__oprn-desktop/saves" && req.method === "GET") {
      const files = readdirSync(SAVES_DIR)
        .filter((f) => f.endsWith(".oprn-save.json") && statSync(join(SAVES_DIR, f)).isFile())
        .sort()
        .map((f) => "saves/" + f);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(files));
      return;
    }
    if (url.pathname === "/__oprn-desktop/save") {
      const abs = safeSavePath(url.searchParams.get("path"));
      if (req.method === "GET") {
        if (!existsSync(abs)) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(readFileSync(abs, "utf8"));
        return;
      }
      if (req.method === "PUT") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const tmp = abs + ".tmp-" + process.pid;
        writeFileSync(tmp, Buffer.concat(chunks));
        renameSync(tmp, abs);
        res.writeHead(204);
        res.end();
        return;
      }
    }
    if (url.pathname === "/__oprn-desktop/quit" && req.method === "POST") {
      res.writeHead(204);
      res.end();
      setTimeout(() => { pak?.close(); server.close(() => process.exit(0)); }, 100);
      return;
    }

    const rawPath = decodeURIComponent(url.pathname).replace(/^\\/+/, "") || "index.html";
    if (rawPath.includes("..") || rawPath.includes("\\0")) { res.writeHead(400); res.end("Bad path"); return; }

    let body = pak ? pak.read(rawPath) : null;
    if (!body && !pak) {
      const abs = resolve(APP_DIR, rawPath);
      if (abs.startsWith(resolve(APP_DIR) + sep) && existsSync(abs)) body = readFileSync(abs);
    }
    if (!body) { res.writeHead(404); res.end("Not Found"); return; }

    const mime = MIME[extname(rawPath).toLowerCase()] || "application/octet-stream";
    if (rawPath === "index.html" || rawPath === "player.html") {
      const html = body.toString("utf8").replace("</head>", LOCAL_BRIDGE_SCRIPT + "\\n</head>");
      res.writeHead(200, { "content-type": mime, "cache-control": "no-store" });
      res.end(html);
      return;
    }
    res.writeHead(200, { "content-type": mime, "cache-control": "no-store" });
    res.end(body);
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});

const portArgIdx = process.argv.indexOf("--port");
const listenPort = portArgIdx >= 0 ? Number.parseInt(process.argv[portArgIdx + 1] || "0", 10) : 0;
server.listen(listenPort, "127.0.0.1", () => {
  const addr = server.address();
  const url = \`http://127.0.0.1:\${addr.port}/\`;
  process.stdout.write(\`[\${${titleJson}}] Running at \${url} (Ctrl+C to stop)\\n\`);
  if (process.argv.includes("--no-open")) return;
  const fullscreen = process.argv.includes("--fullscreen") || (!process.argv.includes("--windowed") && ${defaultMode} === "fullscreen");
  const flags = fullscreen ? ["--start-fullscreen", "--window-size=1280,720"] : ["--window-size=1280,720"];
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.on("error", () => {
      spawn("chromium", [\`--app=\${url}\`, ...flags], { detached: true, stdio: "ignore" }).unref();
    });
    child.unref();
  }
});
process.on("SIGINT", () => { pak?.close(); server.close(() => process.exit(0)); });
`;
}

function injectDesktopBootConfig(
  playerHtml: string,
  config: {
    readonly title: string;
    readonly slug: string;
    readonly platform: DesktopExportPlatform;
    readonly steamAppId: number;
    readonly displayMode: DesktopDisplayMode;
    readonly saveNamespace: string;
    readonly enableSteamAutoCloud: boolean;
    readonly enableSteamInputGamepad: boolean;
  },
): string {
  const bootPayload = {
    hostFeatures: ["fullscreen", "exit"],
    saveNamespace: config.saveNamespace,
    desktopShell: {
      enabled: true,
      platform: config.platform,
      steamAppId: config.steamAppId,
      displayMode: config.displayMode,
      saveDirectory: "saves",
      saveNamespace: config.saveNamespace,
      savePattern: "saves/*.oprn-save.json",
      pakArchive: "resources/game.pak",
      steamAutoCloud: config.enableSteamAutoCloud,
      gamepadPolling: config.enableSteamInputGamepad,
    },
  };
  const scriptTag = `<script>window.__OPENRPG_BOOT__ = Object.assign({}, window.__OPENRPG_BOOT__ || {}, ${JSON.stringify(bootPayload).replace(/</g, "\\u003c")});</script>`;
  if (playerHtml.includes("</head>")) {
    return playerHtml.replace("</head>", `  ${scriptTag}\n  </head>`);
  }
  return `${scriptTag}\n${playerHtml}`;
}

function buildSteamAppVdf(options: {
  readonly steamAppId: number;
  readonly steamDepotId: number;
  readonly title: string;
  readonly versionLabel: string;
  readonly platform: DesktopExportPlatform;
}): string {
  return [
    '"AppBuild"',
    "{",
    `  "AppID" "${options.steamAppId}"`,
    `  "Desc" "${vdfText(options.title)} (${options.platform}) v${vdfText(options.versionLabel)}"`,
    '  "BuildOutput" "./output/"',
    '  "ContentRoot" "../"',
    '  "SetLive" ""',
    '  "Preview" "0"',
    '  "Local" ""',
    '  "Depots"',
    "  {",
    `    "${options.steamDepotId}" "depot_build_${options.steamDepotId}.vdf"`,
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildSteamDepotVdf(options: { readonly steamDepotId: number }): string {
  return [
    '"DepotBuildConfig"',
    "{",
    `  "DepotID" "${options.steamDepotId}"`,
    '  "ContentRoot" "."',
    '  "FileMapping"',
    "  {",
    '    "LocalPath" "*"',
    '    "DepotPath" "."',
    '    "recursive" "1"',
    "  }",
    '  "FileExclusion" "saves/*"',
    '  "FileExclusion" "steamworks/*"',
    '  "FileExclusion" "play-local.mjs"',
    '  "FileExclusion" "Launch-*"',
    '  "FileExclusion" "*.pdb"',
    "}",
    "",
  ].join("\n");
}

function buildSteamInputManifestVdf(title: string): string {
  return [
    '"In Game Actions"',
    "{",
    '  "actions"',
    "  {",
    '    "GameControls"',
    "    {",
    '      "title" "#Set_GameControls"',
    '      "StickPadGyro"',
    "      {",
    '        "Move"',
    "        {",
    '          "title" "#Action_Move"',
    '          "input_mode" "joystick_move"',
    "        }",
    "      }",
    '      "Button"',
    "      {",
    '        "Confirm" "#Action_Confirm_Z_Enter"',
    '        "Cancel" "#Action_Cancel_X_Escape"',
    '        "Menu" "#Action_Menu_Escape"',
    '        "Dash" "#Action_Dash_Shift"',
    '        "Fullscreen" "#Action_ToggleFullscreen_F11"',
    "      }",
    "    }",
    "  }",
    '  "localization"',
    "  {",
    '    "koreana"',
    "    {",
    `      "Set_GameControls" "${vdfText(title)} 기본 조작"`,
    '      "Action_Move" "이동 (방향키 / 좌측 스틱)"',
    '      "Action_Confirm_Z_Enter" "결정 / 대화 / 조사 (A 버튼 · Z / Enter)"',
    '      "Action_Cancel_X_Escape" "취소 / 뒤로 (B 버튼 · X / Esc)"',
    '      "Action_Menu_Escape" "메뉴 열기 (Y / Start · Esc)"',
    '      "Action_Dash_Shift" "달리기 (X 버튼 / LB · Shift)"',
    '      "Action_ToggleFullscreen_F11" "전체화면 전환 (F11 / Alt+Enter)"',
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildSteamLaunchChecklistMd(options: {
  readonly title: string;
  readonly slug: string;
  readonly fileName: string;
  readonly platform: DesktopExportPlatform;
  readonly executablePath: string;
  readonly nativeExecutablePath: string;
  readonly steamAppId: number;
  readonly steamDepotId: number;
  readonly displayMode: DesktopDisplayMode;
  readonly savePattern: string;
  readonly saveNamespace: string;
  readonly versionLabel: string;
}): string {
  const spec = DESKTOP_PLATFORM_SPECS[options.platform];
  const cliPlatform =
    options.platform === "win64-steam"
      ? "win"
      : options.platform === "linux64-steamos"
        ? "linux"
        : "mac";
  return [
    `# ${options.title} — Steamworks & 데스크톱 출시 체크리스트 (v${options.versionLabel})`,
    "",
    "## 1. 이 ZIP(패키징 키트)의 역할과 즉시 테스트",
    `- **빌드 타겟**: ${spec.label}`,
    `- **로컬 즉시 실행 테스트**: 압축 해제 후 \`${options.executablePath}\` (또는 \`node play-local.mjs\`) 실행`,
    "  - `play-local.mjs`는 `resources/game.pak`을 `http://127.0.0.1` 루프백으로 서빙하여 `file://` CORS 오류 없이 바로 실행되고 `saves/`에 실제 저장됩니다.",
    "- **에셋 아카이브**: `resources/game.pak` (`OPAK` v1 바이너리 컨테이너 — 평문 중복 복사 없음)",
    `- **세이브 네임스페이스**: \`${options.saveNamespace}\` (체험판→본편 인계 시 동일 그룹 ID 유지)`,
    `- **Steam App ID / Depot ID**: \`${options.steamAppId}\` / \`${options.steamDepotId}\``,
    "",
    "## 2. Electron 네이티브 실행 앱(.exe / Linux / .app) 패키징 (Steam 업로드 전 필수)",
    "플레이어 PC에 Node.js나 브라우저가 없어도 실행되는 실제 Electron 앱으로 감쌉니다:",
    "```bash",
    `npm run build:desktop-game -- --input "./${options.fileName}" --platform ${cliPlatform}`,
    "```",
    `- 생성된 unpacked 앱 폴더(\`dist-desktop-games/${options.slug}-${cliPlatform}/\`)에 실제 \`${options.nativeExecutablePath}\`와 \`resources/game.pak\`이 포함됩니다.`,
    "- Electron 플레이어는 `oprn-game://app/` 커스텀 프로토콜로 `resources/game.pak`을 직접 읽고 `window.__oprnDesktopPlayer`로 원자적 파일 세이브·전체화면·스크린샷·앱 종료를 처리합니다.",
    "",
    "## 3. Steamworks Partner 포털 설정 (Installation -> General)",
    "- **Launch Option 0**:",
    `  - **Executable**: \`${options.nativeExecutablePath}\``,
    `  - **Arguments**: \`${options.displayMode === "fullscreen" ? "--fullscreen" : "--windowed"}\``,
    `  - **Operating System**: \`${spec.steamOsList}\` (${spec.steamArch}-bit)`,
    "",
    "## 4. Steam Auto-Cloud 설정 (Application -> Steam Cloud)",
    "- `depot_build.vdf`는 `saves/*`를 업로드에서 자동 제외하므로 게임 업데이트가 유저 세이브를 덮어쓰지 않습니다.",
    "- **Windows / Linux (설치 폴더 쓰기 가능 시)**:",
    "  - **Root**: `GameInstall`",
    "  - **Subdirectory**: `saves`",
    `  - **Pattern**: \`${options.savePattern}\``,
    "- **macOS / 읽기 전용 설치 폴더 폴백 (OS 표준 userData)**:",
    "  - Windows: `WinAppDataRoaming` · Subdirectory: `OPRN-Games/" + options.saveNamespace + "/saves`",
    "  - macOS: `MacAppSupport` · Subdirectory: `OPRN-Games/" + options.saveNamespace + "/saves`",
    "  - Linux: `LinuxXdgConfigHome` · Subdirectory: `OPRN-Games/" + options.saveNamespace + "/saves`",
    "",
    "## 5. macOS 코드 서명 및 공증 (macOS 출시 시 필수)",
    "- macOS Gatekeeper 경고를 피하려면 Apple Developer ID 인증서로 `.app` 번들을 서명하고 공증해야 합니다:",
    "```bash",
    `codesign --deep --force --options runtime --sign "Developer ID Application: <Your Name>" "${options.slug}.app"`,
    `xcrun notarytool submit "${options.slug}.zip" --keychain-profile "<profile>" --wait`,
    `xcrun stapler staple "${options.slug}.app"`,
    "```",
    "",
    "## 6. SteamPipe 업로드 명령어",
    "Electron 패키징 출력 폴더 안에서 `steamworks/` VDF를 실행합니다:",
    "```bash",
    `steamcmd +login <steam_partner_username> +run_app_build "./steamworks/app_build_${options.steamAppId}.vdf" +quit`,
    "```",
    "",
    "## 7. 내장 데스크톱 단축키 및 컨트롤러 지원",
    "- **전체화면 전환**: `F11` 또는 `Alt + Enter`",
    "- **스크린샷 저장**: `F12` (`saves/screenshots/` PNG 저장)",
    "- **게임 종료**: 타이틀 메뉴 「게임 종료」 → 네이티브 앱 즉시 종료",
    "- **게임패드 자동 인식**: Xbox / DualSense / Steam Deck 내장 패드 즉시 지원",
    "",
  ].join("\n");
}

/**
 * The generated `.bat` runs in cmd.exe. `&`, `|`, `<`, `>`, `^`, and `%` in a title
 * such as `Dungeons & Dragons` would otherwise start another command or expand a variable.
 */
function batWindowTitle(text: string): string {
  const safe = text
    .replace(/[\r\n]+/g, " ")
    .replace(/%/g, "%%")
    .replace(/[&|<>^]/g, (char) => `^${char}`)
    .trim();
  return safe.length > 0 ? safe : "OPRN Game";
}

/** SteamPipe VDF strings. A quote or newline in the title would end the `"Desc"` value. */
function vdfText(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return fallback;
  return Math.trunc(value);
}
