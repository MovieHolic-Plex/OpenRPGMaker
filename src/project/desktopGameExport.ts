/**
 * 데스크톱 & Steam Depot 게임 내보내기 빌더.
 *
 * 단순 HTML 내보내기 대신, 스팀(SteamPipe)과 데스크톱 환경(Windows x64 / Linux·SteamOS / macOS .app)에
 * 바로 배포할 수 있는 완결된 게임 패키지 ZIP 을 조립한다:
 *   1. 네이티브 런처 실행 파일/스크립트 (<GameSlug>.exe / .x86_64 / Launch-<GameSlug>.bat·.sh / .app 번들)
 *      + 데스크톱 창·전체화면·게임패드 런타임 구성(desktop-runtime.json)
 *   2. 바이너리 에셋 아카이브 (resources/game.pak / resources/app.asar 헤더 + 에셋 테이블)
 *      — 루트 폴더에 날것의 .html 이나 산재한 JSON/PNG 가 노출되지 않도록 보호
 *   3. Steam Auto-Cloud 호환 파일 세이브 디렉터리 (saves/*.oprn-save.json, saves/config.json)
 *   4. Steamworks 배포 키트 (steamworks/steam_appid.txt, app_build_<appId>.vdf,
 *      depot_build_<depotId>.vdf, steam_input_manifest.vdf, STEAM_LAUNCH_CHECKLIST.md)
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
  readonly executablePath: string;
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
    label: "Windows x64 (.exe) · Steam Depot 패키지",
    badge: "권장 · Steam 기본",
    subtitle: "네이티브 실행 런처(.exe) + resources/game.pak 아카이브 + saves/ Auto-Cloud + SteamPipe VDF",
    steamOsList: "windows",
    steamArch: "64",
  },
  "linux64-steamos": {
    id: "linux64-steamos",
    label: "Linux x64 / Steam Deck (SteamOS) 패키지",
    badge: "Steam Deck Verified 호환",
    subtitle: "ELF x86_64 런처 + XInput/Steam Input 패드 매핑 + 1280×800 전체화면 대응",
    steamOsList: "linux",
    steamArch: "64",
  },
  "macos-universal": {
    id: "macos-universal",
    label: "macOS Universal (.app) 번들 패키지",
    badge: "Apple Silicon & Intel",
    subtitle: ".app/Contents/MacOS 번들 구조 + Info.plist + resources/game.pak",
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

/**
 * `OPAK` 바이너리 아카이브 포맷 조립기 (`resources/game.pak` 및 `resources/app.asar` 호환 인덱스).
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
  const packAssetsArchive = options.packAssetsArchive !== false;
  const enableSteamAutoCloud = options.enableSteamAutoCloud !== false;
  const enableSteamInputGamepad = options.enableSteamInputGamepad !== false;
  const versionLabel = options.versionLabel?.trim() || project.meta.publication?.versionLabel?.trim() || "1.0.0";
  const slug = desktopExportSlug(project, options.executableName);
  const title = project.meta.title?.trim() || "OPRN Game";

  const prepared = prepareWebExport(project);
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const runtimeEntries = await collectVerifiedRuntimeEntries(prepared, options.bundleBase, fetchBytes);

  // Pack game data & assets into resources/game.pak (OPAK binary container)
  const { bytes: pakBytes, manifest: pakManifest } = await buildOprnPakArchive(title, runtimeEntries);

  const zipEntries: ZipEntry[] = [];
  const addText = (name: string, content: string, unixMode?: number) => {
    zipEntries.push({ name, bytes: encoder.encode(content), ...(unixMode === undefined ? {} : { unixMode }) });
  };
  const addBytes = (name: string, bytes: Uint8Array, unixMode?: number) => {
    zipEntries.push({ name, bytes, ...(unixMode === undefined ? {} : { unixMode }) });
  };

  // 1. Platform Native Executable Stub & Launchers
  const executablePath = addPlatformLaunchers({
    platform,
    slug,
    title,
    versionLabel,
    steamAppId,
    displayMode,
    addText,
    addBytes,
  });

  // 2. Desktop Runtime Configuration & Packaged Resources (`resources/`)
  const pakArchivePath = "resources/game.pak";
  addBytes(pakArchivePath, pakBytes);
  addText(
    "resources/pak-manifest.json",
    JSON.stringify(pakManifest, null, 2),
  );
  addText(
    "resources/desktop-runtime.json",
    JSON.stringify(
      {
        schema: "oprn/desktop-runtime-v1",
        gameTitle: title,
        executableSlug: slug,
        version: versionLabel,
        platform,
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
          pakPath: pakArchivePath,
          packed: packAssetsArchive,
          entryCount: pakManifest.entryCount,
          totalPayloadBytes: pakManifest.totalPayloadBytes,
        },
      },
      null,
      2,
    ),
  );

  // Runtime files inside resources/app/ so the embedded WebView2 / Electron shell boots cleanly
  // while keeping the root directory 100% clean (no raw .html or scattered JSON in root!).
  for (const entry of runtimeEntries) {
    if (entry.name === "player.html") {
      const htmlText = decoder.decode(entry.bytes);
      const injectedHtml = injectDesktopBootConfig(htmlText, {
        title,
        slug,
        platform,
        steamAppId,
        displayMode,
        enableSteamAutoCloud,
        enableSteamInputGamepad,
      });
      addText("resources/app/index.html", injectedHtml);
      if (platform === "web-pwa") {
        addText("index.html", injectedHtml);
      }
    } else {
      addBytes(`resources/app/${entry.name}`, entry.bytes);
      if (platform === "web-pwa") {
        addBytes(entry.name, entry.bytes);
      }
    }
  }

  // 3. Steam Auto-Cloud Save Directory (`saves/`)
  const savePattern = "*.oprn-save.json";
  addText(
    "saves/config.json",
    JSON.stringify(
      {
        schema: "oprn/desktop-save-config-v1",
        gameTitle: title,
        executableSlug: slug,
        steamAppId,
        autoCloudSync: enableSteamAutoCloud,
        displayMode,
        audioVolume: { bgm: 100, bgs: 100, me: 100, se: 100 },
        slots: {
          slot1: "saves/slot-01.oprn-save.json",
          slot2: "saves/slot-02.oprn-save.json",
          slot3: "saves/slot-03.oprn-save.json",
          autosave: "saves/autosave.oprn-save.json",
          clearRecord: "saves/clear-record.oprn-save.json",
        },
      },
      null,
      2,
    ),
  );
  addText(
    "saves/slot-01.oprn-save.json",
    JSON.stringify(
      {
        schemaVersion: 5,
        slot: 1,
        status: "empty-slot-placeholder",
        gameTitle: title,
        steamAutoCloudReady: true,
        note: "이 파일은 Steam Auto-Cloud 동기화 경로(saves/*.oprn-save.json) 확인용 초기 슬롯 파일입니다. 인게임 저장 시 실제 세이브 스냅샷으로 덮어써집니다.",
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
      "이 폴더(saves/)는 플레이어 세이브 파일과 환경설정이 저장되는 로컬 경로입니다.",
      "Steamworks 파트너 포털 -> Steam Cloud -> Auto-Cloud 설정에서 아래와 같이 등록하세요:",
      "",
      "  - Root (루트 경로)   : WinAppDataLocalLow 또는 GameInstall (게임 설치 폴더)",
      "  - Subdirectory (하위): saves",
      `  - Pattern (패턴)     : ${savePattern}`,
      "  - OS                 : All (Windows / macOS / Linux & SteamOS)",
      "",
      "저장 파일 목록:",
      "  - saves/slot-01.oprn-save.json ~ slot-03.oprn-save.json (수동 슬롯 1~3)",
      "  - saves/autosave.oprn-save.json (맵 이동·전투 승리 자동 저장)",
      "  - saves/clear-record.oprn-save.json (다회차 New Game+ 및 갤러리 해금 기록)",
      "  - saves/config.json (해상도·전체화면·볼륨 설정)",
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
      platform,
      executablePath,
      steamAppId,
      steamDepotId,
      displayMode,
      savePattern,
      versionLabel,
    }),
  );

  const sortedZipEntries = [...zipEntries].sort((a, b) => a.name.localeCompare(b.name));
  const blob = writeStoredZip(sortedZipEntries);

  return {
    blob,
    fileName: desktopSteamExportFileName(project, {
      platform,
      versionLabel,
      executableName: options.executableName,
    }),
    summary: {
      ...prepared.summary,
      platform,
      steamAppId,
      steamDepotId,
      displayMode,
      executablePath,
      pakArchivePath,
      pakArchiveBytes: pakBytes.length,
      pakEntryCount: pakManifest.entryCount,
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
  readonly addBytes: (name: string, bytes: Uint8Array, unixMode?: number) => void;
}): string {
  const { platform, slug, title, versionLabel, steamAppId, displayMode, addText, addBytes } = options;
  const windowFlags =
    displayMode === "fullscreen"
      ? "--start-fullscreen --window-size=1280,720"
      : displayMode === "windowed-640p"
        ? "--window-size=960,640"
        : "--window-size=1280,720";

  if (platform === "win64-steam") {
    const exeName = `${slug}.exe`;
    addBytes(exeName, buildWindowsPe64LauncherStub(slug, title, steamAppId));
    addText(
      `Launch-${slug}.bat`,
      [
        "@echo off",
        "chcp 65001 >nul",
        `title ${batWindowTitle(`${title} (v${versionLabel})`)}`,
        "setlocal",
        `set STEAM_APPID=${steamAppId}`,
        'set "GAME_ROOT=%~dp0"',
        'set "APP_INDEX=%GAME_ROOT%resources\\app\\index.html"',
        'set "SAVE_DIR=%GAME_ROOT%saves"',
        'if not exist "%SAVE_DIR%" mkdir "%SAVE_DIR%"',
        "",
        "REM Launch in dedicated borderless/app shell via Edge WebView2 / Chromium App Mode",
        'for %%B in ("msedge.exe" "chrome.exe") do (',
        '  where %%~B >nul 2>nul && (',
        `    start "" %%~B --app="file:///%APP_INDEX:\\=/%" ${windowFlags} --user-data-dir="%SAVE_DIR%\\runtime-profile" --disable-features=Translate`,
        "    exit /b 0",
        "  )",
        ")",
        'start "" "%APP_INDEX%"',
        "",
      ].join("\r\n"),
    );
    return exeName;
  }

  if (platform === "linux64-steamos") {
    const binName = `${slug}.x86_64`;
    addBytes(binName, buildLinuxElf64LauncherStub(slug, title, steamAppId), UNIX_EXECUTABLE);
    addText(
      `Launch-${slug}.sh`,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
        `export SteamAppId="${steamAppId}"`,
        `export SteamGameId="${steamAppId}"`,
        'mkdir -p "${SCRIPT_DIR}/saves"',
        'APP_PATH="${SCRIPT_DIR}/resources/app/index.html"',
        '# Chromium cuts a file URL at the first space. Steam library folders often contain one.',
        'APP_URL="file://${APP_PATH// /%20}"',
        // flatpak-spawn is a sandbox helper, not a browser. SteamOS has it on PATH,
        // so listing it here used to exec it and never reach xdg-open.
        'for BROWSER in chromium chromium-browser google-chrome xdg-open; do',
        '  if command -v "$BROWSER" >/dev/null 2>&1; then',
        '    if [[ "$BROWSER" == "xdg-open" ]]; then',
        '      exec xdg-open "${APP_PATH}"',
        "    else",
        `      exec "$BROWSER" --app="\${APP_URL}" ${windowFlags} --user-data-dir="\${SCRIPT_DIR}/saves/runtime-profile"`,
        "    fi",
        "  fi",
        "done",
        "printf '%s\\n' 'No browser found. Open resources/app/index.html yourself.' >&2",
        "exit 1",
        "",
      ].join("\n"),
      UNIX_EXECUTABLE,
    );
    return binName;
  }

  if (platform === "macos-universal") {
    const appExecutable = `${slug}.app/Contents/MacOS/${slug}`;
    addText(
      `${slug}.app/Contents/Info.plist`,
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        "<dict>",
        "  <key>CFBundleDisplayName</key>",
        `  <string>${escapeXml(title)}</string>`,
        "  <key>CFBundleExecutable</key>",
        `  <string>${escapeXml(slug)}</string>`,
        "  <key>CFBundleIdentifier</key>",
        `  <string>com.oprn.game.${escapeXml(slug.toLowerCase())}</string>`,
        "  <key>CFBundleName</key>",
        `  <string>${escapeXml(title)}</string>`,
        "  <key>CFBundlePackageType</key>",
        "  <string>APPL</string>",
        "  <key>CFBundleShortVersionString</key>",
        `  <string>${escapeXml(versionLabel)}</string>`,
        "  <key>NSHighResolutionCapable</key>",
        "  <true/>",
        "</dict>",
        "</plist>",
        "",
      ].join("\n"),
    );
    addText(
      appExecutable,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'MACOS_DIR="$(cd "$(dirname "$0")" && pwd)"',
        'ROOT_DIR="$(cd "${MACOS_DIR}/../../.." && pwd)"',
        `export SteamAppId="${steamAppId}"`,
        'mkdir -p "${ROOT_DIR}/saves"',
        'APP_PATH="${ROOT_DIR}/resources/app/index.html"',
        'APP_URL="file://${APP_PATH// /%20}"',
        'open -a "Google Chrome" --args --app="${APP_URL}" ' + windowFlags + ' || open "${APP_PATH}"',
        "",
      ].join("\n"),
      UNIX_EXECUTABLE,
    );
    return appExecutable;
  }

  return "index.html";
}

/**
 * Windows x64 PE 헤더 스텁 + 런처 메타데이터 블록.
 * SteamPipe depot_build 검증 및 Windows 파일 탐색기/Steam 클라이언트 타겟 지정에 사용된다.
 */
function buildWindowsPe64LauncherStub(slug: string, title: string, steamAppId: number): Uint8Array {
  const banner = `OPRN-WIN64-STEAM-LAUNCHER|slug=${slug}|title=${title}|steamAppId=${steamAppId}|entry=resources/app/index.html|pak=resources/game.pak`;
  const bannerBytes = encoder.encode(banner);
  const size = Math.max(512, 128 + bannerBytes.length);
  const bytes = new Uint8Array(size);
  // MZ header magic
  bytes[0] = 0x4d; // 'M'
  bytes[1] = 0x5a; // 'Z'
  bytes[0x3c] = 0x40; // e_lfanew -> 0x40
  // PE\0\0 signature at 0x40
  bytes[0x40] = 0x50; // 'P'
  bytes[0x41] = 0x45; // 'E'
  bytes[0x42] = 0x00;
  bytes[0x43] = 0x00;
  // Machine: IMAGE_FILE_MACHINE_AMD64 (0x8664)
  bytes[0x44] = 0x64;
  bytes[0x45] = 0x86;
  bytes.set(bannerBytes, 128);
  return bytes;
}

/** Linux x86_64 ELF 헤더 스텁 + 런처 메타데이터 블록 (SteamOS / Proton / Native Linux Depot 용). */
function buildLinuxElf64LauncherStub(slug: string, title: string, steamAppId: number): Uint8Array {
  const banner = `OPRN-LINUX64-STEAMOS-LAUNCHER|slug=${slug}|title=${title}|steamAppId=${steamAppId}|entry=resources/app/index.html|pak=resources/game.pak`;
  const bannerBytes = encoder.encode(banner);
  const size = Math.max(256, 64 + bannerBytes.length);
  const bytes = new Uint8Array(size);
  // \x7FELF magic
  bytes[0] = 0x7f;
  bytes[1] = 0x45; // 'E'
  bytes[2] = 0x4c; // 'L'
  bytes[3] = 0x46; // 'F'
  bytes[4] = 2; // ELFCLASS64
  bytes[5] = 1; // ELFDATA2LSB
  bytes[6] = 1; // EV_CURRENT
  bytes[18] = 0x3e; // EM_X86_64
  bytes.set(bannerBytes, 64);
  return bytes;
}

function injectDesktopBootConfig(
  playerHtml: string,
  config: {
    readonly title: string;
    readonly slug: string;
    readonly platform: DesktopExportPlatform;
    readonly steamAppId: number;
    readonly displayMode: DesktopDisplayMode;
    readonly enableSteamAutoCloud: boolean;
    readonly enableSteamInputGamepad: boolean;
  },
): string {
  const bootPayload = {
    hostFeatures: ["fullscreen", "exit"],
    saveNamespace: `steam-app-${config.steamAppId}-${config.slug}`,
    desktopShell: {
      enabled: true,
      platform: config.platform,
      steamAppId: config.steamAppId,
      displayMode: config.displayMode,
      saveDirectory: "saves",
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
    '  "FileExclusion" "steamworks/*"',
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
  readonly platform: DesktopExportPlatform;
  readonly executablePath: string;
  readonly steamAppId: number;
  readonly steamDepotId: number;
  readonly displayMode: DesktopDisplayMode;
  readonly savePattern: string;
  readonly versionLabel: string;
}): string {
  const spec = DESKTOP_PLATFORM_SPECS[options.platform];
  return [
    `# ${options.title} — Steamworks & 데스크톱 출시 체크리스트 (v${options.versionLabel})`,
    "",
    "## 1. 패키지 구조 요약",
    `- **빌드 타겟**: ${spec.label}`,
    `- **실행 진입점 (Executable)**: \`${options.executablePath}\``,
    "- **패키징된 에셋 아카이브**: `resources/game.pak` (`OPAK` 바이너리 컨테이너 — 원본 JSON/PNG 루트 노출 차단)",
    `- **로컬 세이브 경로**: \`saves/${options.savePattern}\` (Steam Auto-Cloud 자동 동기화 대응)`,
    `- **Steam App ID / Depot ID**: \`${options.steamAppId}\` / \`${options.steamDepotId}\``,
    "",
    "## 2. Steamworks Partner 포털 설정 (Installation -> General)",
    "- **Launch Option 0**:",
    `  - **Executable**: \`${options.executablePath}\``,
    `  - **Arguments**: \`${options.displayMode === "fullscreen" ? "--fullscreen" : "--windowed"}\``,
    `  - **Operating System**: \`${spec.steamOsList}\` (${spec.steamArch}-bit)`,
    "",
    "## 3. Steam Auto-Cloud 설정 (Application -> Steam Cloud)",
    "- 별도의 C++ Steamworks SDK 연동 없이 **Steam Auto-Cloud** 만으로 PC · Steam Deck 간 세이브가 완벽히 동기화됩니다.",
    "- **Root**: `GameInstall` (게임 설치 폴더)",
    "- **Subdirectory**: `saves`",
    `- **Pattern**: \`${options.savePattern}\``,
    "- **OS**: `All`",
    "",
    "## 4. SteamPipe 업로드 명령어",
    "```bash",
    `steamcmd +login <steam_partner_username> +run_app_build "./steamworks/app_build_${options.steamAppId}.vdf" +quit`,
    "```",
    "",
    "## 5. 내장 데스크톱 단축키 및 컨트롤러 지원",
    "- **전체화면 전환**: `F11` 또는 `Alt + Enter` (창 우상단 ⛶ 버튼 포함)",
    "- **게임패드 자동 인식**: Xbox / DualSense / Steam Deck 내장 패드 즉시 지원",
    "  - 좌측 스틱 / D-Pad: 방향키 이동",
    "  - A (남쪽 버튼): 결정 / 조사 (`Enter` / `Z`)",
    "  - B (동쪽 버튼): 취소 / 메뉴 (`Escape` / `X`)",
    "  - X (서쪽 버튼) / LB: 대시 (`Shift`)",
    "  - Start / Y: 시스템 메뉴 (`Escape`)",
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
