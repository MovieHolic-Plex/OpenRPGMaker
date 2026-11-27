import { describe, expect, it } from "vitest";
import { auditProjectAssetLicenses } from "@/project/assetLicenseAudit";
import { buildPlayerCredits } from "@/player/titleLicenseNotice";
import { listTitleMenuOptions } from "@/player/titleScreen";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { Project } from "@/project/types";

function makeCustomOnlyProject(overrides?: Partial<Project>): Project {
  const base = {
    version: 4,
    meta: {
      title: "Original Indie RPG",
      author: "Indie Studio",
      terms: {},
      language: "en" as const,
    },
    assets: {
      sprites: {},
      uploaded: {
        custom_tiles: { id: "custom_tiles", name: "My Tiles", kind: "chipset", meta: {} },
        custom_hero: { id: "custom_hero", name: "My Hero", kind: "charset", meta: {} },
        custom_bgm: { id: "custom_bgm", name: "My Theme", kind: "music", meta: {} },
        custom_title: { id: "custom_title", name: "My Title", kind: "title", meta: {} },
      },
    },
    resourceProfiles: [
      // Catalog rows that are NOT used by maps/events must not trigger attribution or AI warnings.
      { kind: "music", name: "Unused AI Track", assetId: "oprn-bgm-ct2-battle-v1-1" },
      { kind: "chipset", name: "Unused Beodeul", assetId: "tex_beodeul_city" },
    ],
    tilesets: {
      ts_custom: {
        id: "ts_custom",
        name: "Custom Tileset",
        image: { type: "uploaded", id: "custom_tiles" },
        tileSize: 16,
        tilesPerRow: 16,
        count: 16,
        passability: [],
        priority: [],
        terrain: [],
      },
      // Unused bundled tileset in project.tilesets should not taint the audit.
      ts_unused_beodeul: {
        id: "ts_unused_beodeul",
        name: "Unused Beodeul",
        image: { type: "bundled", id: "tex_beodeul_city" },
        tileSize: 16,
        tilesPerRow: 48,
        count: 48,
        passability: [],
        priority: [],
        terrain: [],
      },
    },
    switches: [],
    variables: [],
    commonEvents: [],
    database: {
      actors: [
        {
          id: "actor_1",
          name: "Ari",
          nickname: "Scout",
          classId: "class_1",
          initialLevel: 1,
          maxLevel: 99,
          characterResourceId: "custom_hero",
        },
      ],
      classes: [{ id: "class_1", name: "Ranger" }],
      skills: [],
      items: [],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [],
    },
    system: {
      startActorIds: ["actor_1"],
      titleResourceId: "custom_title",
      defaultBgmResourceId: "custom_bgm",
      battleBgmResourceId: "custom_bgm",
      titleScreen: {
        ...defaultTitleScreenSettings(),
        title: "Original Indie RPG",
        backgroundResourceId: "custom_title",
        musicResourceId: "custom_bgm",
      },
    },
    session: {
      switches: {},
      variables: {},
      inventory: {},
      partyActorIds: ["actor_1"],
    },
    maps: {
      map_1: {
        id: "map_1",
        name: "Start Village",
        width: 10,
        height: 10,
        tilesetId: "ts_custom",
        tileSize: 16,
        lowerTiles: [],
        upperTiles: [],
        events: [],
      },
    },
    mapTree: { mapId: "map_1", children: [] },
    startMapId: "map_1",
    startPos: { x: 1, y: 1 },
    flags: {},
  } as unknown as Project;
  return { ...base, ...overrides };
}

describe("assetLicenseAudit & conditional multilingual credits", () => {
  it("reports zero third-party attribution and zero Steam AI disclosure for a 100% custom asset game", () => {
    const project = makeCustomOnlyProject();
    const audit = auditProjectAssetLicenses(project);
    expect(audit.usesEasyRpgRtp).toBe(false);
    expect(audit.usesScarloxy).toBe(false);
    expect(audit.usesRefmap).toBe(false);
    expect(audit.usesAiBgm).toBe(false);
    expect(audit.aiBgmTracks).toEqual([]);
    expect(audit.usesAiGeneratedImages).toBe(false);
    expect(audit.usesCc0Assets).toBe(false);
    expect(audit.storeCredits).toEqual([]);
    expect(audit.requiresAttribution).toBe(false);
    expect(audit.requiresSteamAiDisclosure).toBe(false);
    expect(audit.steamAiDisclosureReasons).toEqual([]);
  });

  it("never mentions Google Lyria, EasyRPG, Scarloxy, or REFMAP in credits when unused", () => {
    const project = makeCustomOnlyProject({
      meta: {
        title: "Original Indie RPG",
        author: "Indie Studio",
        terms: {},
        language: "en",
        customCredits: "Directed & Drawn by Indie Studio\nMusic by Composer Jane",
      },
    });
    const enCredits = buildPlayerCredits(project, "en");
    expect(enCredits).toContain("## Game Credits");
    expect(enCredits.indexOf("Directed & Drawn by Indie Studio")).toBeLessThan(enCredits.indexOf("## Built With"));
    expect(enCredits).not.toContain("Google Lyria");
    expect(enCredits).not.toContain("EasyRPG");
    expect(enCredits).not.toContain("Scarloxy");
    expect(enCredits).not.toContain("REFMAP");
  });

  it("detects OPRN AI BGM (Google Lyria), EasyRPG, Scarloxy, REFMAP, AI stills, and Store items accurately", () => {
    const project = makeCustomOnlyProject();
    project.system.battleBgmResourceId = "oprn-bgm-ct2-battle-v1-1";
    project.system.titleScreen = {
      ...project.system.titleScreen!,
      backgroundResourceId: "oprn-still-dark-citadel",
    };
    project.database.actors[0]!.characterResourceId = "easyrpg-charset-actor1";
    project.maps["map_1"]!.events.push({
      id: "ev_1",
      name: "NPC",
      x: 2,
      y: 2,
      pages: [
        {
          graphic: { sprite: { type: "bundled", id: "tex_refmap_doll_1" } },
          commands: [{ kind: "playAudio", resourceId: "cc0-bgm-town", loop: true }],
        },
        {
          graphic: { sprite: { type: "bundled", id: "scarloxy-charset-people1" } },
          commands: [],
        },
      ],
    } as unknown as Project["maps"][string]["events"][number]);

    const audit = auditProjectAssetLicenses(project);
    expect(audit.usesAiBgm).toBe(true);
    expect(audit.aiBgmTracks.map((t) => t.id)).toContain("oprn-bgm-ct2-battle-v1-1");
    expect(audit.usesAiGeneratedImages).toBe(true);
    expect(audit.aiGeneratedImageIds).toContain("oprn-still-dark-citadel");
    expect(audit.usesEasyRpgRtp).toBe(true);
    expect(audit.usesScarloxy).toBe(true);
    expect(audit.usesRefmap).toBe(true);
    expect(audit.usesCc0Assets).toBe(true);
    expect(audit.requiresAttribution).toBe(true);
    expect(audit.requiresSteamAiDisclosure).toBe(true);
    expect(audit.steamAiDisclosureReasons.some((r) => r.code === "ai-bgm")).toBe(true);
    expect(audit.steamAiDisclosureReasons.some((r) => r.code === "ai-images")).toBe(true);

    for (const locale of ["ko", "en", "ja", "zh"] as const) {
      const text = buildPlayerCredits(project, locale);
      expect(text).toContain("Google Lyria");
      expect(text).toContain("EasyRPG RTP");
      expect(text).toContain("Scarloxy (Ismael Garcia)");
      expect(text).toContain("REFMAP (http://refmap.wixsite.com/fsm-material), modified");
    }
  });

  it("allows hiding title credits only when requiresAttribution is false", () => {
    const customProject = makeCustomOnlyProject();
    const settings = {
      ...defaultTitleScreenSettings(),
      menuVisibility: { newGame: true, continueGame: true, quit: true, credits: false },
    };

    const hiddenOptions = listTitleMenuOptions(settings, { project: customProject });
    expect(hiddenOptions.map((o) => o.id)).toEqual(["newGame", "continueGame", "quit"]);
    expect(hiddenOptions.map((o) => o.label)).toEqual(["New Game", "Load Game", "Quit"]);

    const rtpProject = makeCustomOnlyProject();
    rtpProject.database.actors[0]!.characterResourceId = "easyrpg-charset-actor1";
    const enforcedOptions = listTitleMenuOptions(settings, { project: rtpProject });
    expect(enforcedOptions.map((o) => o.id)).toEqual(["newGame", "continueGame", "credits", "quit"]);
    expect(enforcedOptions.find((o) => o.id === "credits")?.label).toBe("Credits");
  });
});
