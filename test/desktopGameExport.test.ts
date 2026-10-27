// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  buildOprnPakArchive,
  createDesktopSteamExportPackage,
  desktopSteamExportFileName,
  readOprnPakArchive,
} from "@/project/desktopGameExport";
import { readStoredZipEntry, readStoredZipEntryNames } from "@/project/packageZip";
import { createRuntimeManifest, jsonBytes } from "@/project/gameRelease";
import { preparePublication } from "@/project/publication";
import {
  installDesktopShellBridge,
  mirrorDesktopSaveFile,
  saveStorageKeyToDesktopFilePath,
} from "@/player/desktopShellBridge";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("Desktop & Steam Depot Game Export", () => {
  it("packs game data and assets into a verified OPAK binary archive (resources/game.pak) and round-trips entries", async () => {
    const entries = [
      { name: "project.json", bytes: encoder.encode('{"title":"Chrono Bell"}') },
      { name: "assets/hero.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]) },
    ];
    const { bytes, manifest } = await buildOprnPakArchive("시간의 종소리와 무너진 별", entries);
    expect(manifest.magic).toBe("OPAK");
    expect(manifest.entryCount).toBe(2);

    const unpacked = readOprnPakArchive(bytes);
    expect(unpacked.manifest.gameTitle).toBe("시간의 종소리와 무너진 별");
    const projectJson = decoder.decode(unpacked.readEntry("project.json")!);
    expect(projectJson).toBe('{"title":"Chrono Bell"}');
    const heroPng = unpacked.readEntry("assets/hero.png")!;
    expect([...heroPng]).toEqual([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  });

  it("generates a complete Windows x64 Steam Depot ZIP with .exe launcher, resources/game.pak, saves/ Auto-Cloud, and SteamPipe VDFs", async () => {
    const project = createBlankProject();
    project.meta.title = "ChronoBell";
    const runtime = await createRuntimeManifest(
      [
        { name: "web/player.html", bytes: encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>") },
        { name: "web/player.js", bytes: encoder.encode("console.log('player');") },
        { name: "web/dependency-collector.js", bytes: encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};") },
      ],
      [],
    );
    project.meta.publication = preparePublication(runtime.runtimeTarget);

    const fileMap = new Map<string, Uint8Array>([
      ["/runtime-archive/default.json", jsonBytes({ runtimeTarget: runtime.runtimeTarget })],
      [`/runtime-archive/${runtime.runtimeTarget}/runtime.json`, jsonBytes(runtime)],
      [`/runtime-archive/${runtime.runtimeTarget}/web/player.html`, encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>")],
      [`/runtime-archive/${runtime.runtimeTarget}/web/player.js`, encoder.encode("console.log('player');")],
      [`/runtime-archive/${runtime.runtimeTarget}/web/dependency-collector.js`, encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};")],
    ]);

    const result = await createDesktopSteamExportPackage(project, {
      platform: "win64-steam",
      steamAppId: 480,
      steamDepotId: 481,
      displayMode: "fullscreen",
      versionLabel: "1.2.0",
      fetchBytes: async (path) => {
        const hit = fileMap.get(path);
        if (!hit) throw new Error(`Missing fixture path: ${path}`);
        return hit;
      },
    });

    expect(result.fileName).toBe(
      desktopSteamExportFileName(project, { platform: "win64-steam", versionLabel: "1.2.0" }),
    );
    expect(result.summary.executablePath).toBe("ChronoBell.exe");
    expect(result.summary.pakArchivePath).toBe("resources/game.pak");

    const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
    const entryNames = readStoredZipEntryNames(zipBytes);

    expect(entryNames).toContain("ChronoBell.exe");
    expect(entryNames).toContain("Launch-ChronoBell.bat");
    expect(entryNames).toContain("steam_appid.txt");
    expect(entryNames).toContain("resources/game.pak");
    expect(entryNames).toContain("resources/desktop-runtime.json");
    expect(entryNames).toContain("resources/app/index.html");
    expect(entryNames).toContain("saves/config.json");
    expect(entryNames).toContain("saves/slot-01.oprn-save.json");
    expect(entryNames).toContain("saves/README-STEAM-CLOUD.txt");
    expect(entryNames).toContain("steamworks/app_build_480.vdf");
    expect(entryNames).toContain("steamworks/depot_build_481.vdf");
    expect(entryNames).toContain("steamworks/steam_input_manifest.vdf");
    expect(entryNames).toContain("steamworks/STEAM_LAUNCH_CHECKLIST.md");

    // Verify PE64 MZ + PE header stub on ChronoBell.exe
    const exeBytes = readStoredZipEntry(zipBytes, "ChronoBell.exe")!;
    expect(exeBytes[0]).toBe(0x4d); // 'M'
    expect(exeBytes[1]).toBe(0x5a); // 'Z'
    expect(exeBytes[0x40]).toBe(0x50); // 'P'
    expect(exeBytes[0x41]).toBe(0x45); // 'E'

    // Verify steam_appid.txt
    const appIdText = decoder.decode(readStoredZipEntry(zipBytes, "steam_appid.txt")!);
    expect(appIdText.trim()).toBe("480");
  });

  it("escapes cmd and Steam VDF metacharacters in the game title", async () => {
    const project = createBlankProject();
    project.meta.title = "Dungeons & Dragons\n%PATH%";
    const runtime = await createRuntimeManifest(
      [
        { name: "web/player.html", bytes: encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>") },
        { name: "web/player.js", bytes: encoder.encode("console.log('player');") },
        { name: "web/dependency-collector.js", bytes: encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};") },
      ],
      [],
    );
    project.meta.publication = preparePublication(runtime.runtimeTarget);
    const html = encoder.encode("<!doctype html><html><head></head><body><div id='app'></div></body></html>");
    const player = encoder.encode("console.log('player');");
    const collector = encoder.encode("var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};");
    const fileMap = new Map<string, Uint8Array>([
      ["/runtime-archive/default.json", jsonBytes({ runtimeTarget: runtime.runtimeTarget })],
      [`/runtime-archive/${runtime.runtimeTarget}/runtime.json`, jsonBytes(runtime)],
      [`/runtime-archive/${runtime.runtimeTarget}/web/player.html`, html],
      [`/runtime-archive/${runtime.runtimeTarget}/web/player.js`, player],
      [`/runtime-archive/${runtime.runtimeTarget}/web/dependency-collector.js`, collector],
    ]);
    const result = await createDesktopSteamExportPackage(project, {
      platform: "win64-steam",
      versionLabel: '1.0 "beta"',
      executableName: "ChronoBell",
      fetchBytes: async (path) => {
        const hit = fileMap.get(path);
        if (!hit) throw new Error(`Missing fixture path: ${path}`);
        return hit;
      },
    });
    const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
    const bat = decoder.decode(readStoredZipEntry(zipBytes, "Launch-ChronoBell.bat")!);
    const titleLine = bat.split(/\r?\n/).find((line) => line.startsWith("title "));
    // `%` is doubled so cmd does not expand PATH, and `&` is caret-escaped so it is not a new command.
    expect(titleLine).toBe('title Dungeons ^& Dragons %%PATH%% (v1.0 "beta")');
    const vdf = decoder.decode(readStoredZipEntry(zipBytes, "steamworks/app_build_480.vdf")!);
    expect(vdf).toContain(String.raw`"Desc" "Dungeons & Dragons %PATH% (win64-steam) v1.0 \"beta\""`);
    const input = decoder.decode(readStoredZipEntry(zipBytes, "steamworks/steam_input_manifest.vdf")!);
    expect(input).toContain(String.raw`"Set_GameControls" "Dungeons & Dragons %PATH% 기본 조작"`);
    expect(vdf.split("\n").filter((line) => line.includes('"Desc"'))).toHaveLength(1);
  });

  it("bridges localStorage save slots into saves/*.oprn-save.json for Steam Auto-Cloud", () => {
    expect(saveStorageKeyToDesktopFilePath("oprn:save-slot:v5:1")).toBe("saves/slot-01.oprn-save.json");
    expect(saveStorageKeyToDesktopFilePath("oprn:save-slot:v5:auto")).toBe("saves/autosave.oprn-save.json");
    expect(saveStorageKeyToDesktopFilePath("oprn:clear-record:v1")).toBe("saves/clear-record.oprn-save.json");

    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = installDesktopShellBridge(root, {
      enabled: true,
      platform: "win64-steam",
      steamAppId: 480,
      displayMode: "fullscreen",
    });

    const mirrored = mirrorDesktopSaveFile("oprn:save-slot:v5:1", '{"schemaVersion":5,"gold":777}');
    expect(mirrored?.filePath).toBe("saves/slot-01.oprn-save.json");
    expect(window.__oprnDesktopShellState?.syncedSaveFiles["saves/slot-01.oprn-save.json"]?.json).toContain('"gold":777');
    cleanup();
  });
});
