import { describe, expect, it } from "vitest";
import {
  resolveCharacterListThumbSource,
} from "@/editor/panels/characterListThumbnail";
import { listCharacterIdIndex } from "@/project/characterIdIndex";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";

const CHARSET_ID = "tex_easyrpg_charset_people1";

function entryFor(project: Project, characterId: string) {
  const entry = listCharacterIdIndex(project).find((item) => item.characterId === characterId);
  if (!entry) throw new Error(`missing entry ${characterId}`);
  return entry;
}

function withHostEvent(project: Project, event: GameEvent): Project {
  const mapId = project.startMapId;
  project.maps[mapId].events = [event];
  return project;
}

describe("resolveCharacterListThumbSource", () => {
  it("returns charset resource from first host's first non-transparent sprite page", () => {
    const project = createBlankProject();
    withHostEvent(project, {
      id: "ev_used",
      x: 1,
      y: 2,
      characterId: "char_used",
      pages: [
        {
          id: "p0",
          name: "투명",
          conditions: [],
          commands: [],
          graphic: { transparent: true, sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
        },
        {
          id: "p1",
          name: "본체",
          conditions: [],
          commands: [],
          graphic: {
            sprite: { type: "bundled", id: CHARSET_ID },
            pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
          },
        },
      ],
    });

    const source = resolveCharacterListThumbSource(project, entryFor(project, "char_used"));
    expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 3 });
  });

  it("falls back to first sprite page when all sprites are transparent", () => {
    const project = createBlankProject();
    withHostEvent(project, {
      id: "ev_trans",
      x: 0,
      y: 0,
      characterId: "char_trans",
      pages: [
        {
          id: "p0",
          name: "투명만",
          conditions: [],
          commands: [],
          graphic: { transparent: true, sprite: { type: "bundled", id: CHARSET_ID } },
        },
      ],
    });

    const source = resolveCharacterListThumbSource(project, entryFor(project, "char_trans"));
    expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 0 });
  });

  it("returns null for unused profiles (no hosts)", () => {
    const project = createBlankProject();
    project.characters = {
      char_idle: { displayName: "미사용" },
    };
    project.maps[project.startMapId].events = [];

    const source = resolveCharacterListThumbSource(project, entryFor(project, "char_idle"));
    expect(source).toBeNull();
  });

  it("returns null for orphan events without any charset graphic", () => {
    const project = createBlankProject();
    withHostEvent(project, {
      id: "ev_orphan",
      x: 2,
      y: 3,
      characterId: "char_orphan",
      pages: [{ id: "p1", name: "고아 NPC", conditions: [], commands: [] }],
    });

    const source = resolveCharacterListThumbSource(project, entryFor(project, "char_orphan"));
    expect(source).toBeNull();
  });

  it("uses hosts[0] only even when a later host has a graphic", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId].events = [
      {
        id: "ev_first",
        x: 0,
        y: 0,
        characterId: "char_multi",
        pages: [{ id: "p1", name: "빈", conditions: [], commands: [] }],
      },
      {
        id: "ev_second",
        x: 1,
        y: 1,
        characterId: "char_multi",
        pages: [
          {
            id: "p1",
            name: "스프라이트",
            conditions: [],
            commands: [],
            graphic: { sprite: { type: "bundled", id: CHARSET_ID } },
          },
        ],
      },
    ];

    const source = resolveCharacterListThumbSource(project, entryFor(project, "char_multi"));
    expect(source).toBeNull();
  });
});
