import { readFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import scenario, { cleanupCharacterAppearanceFixture } from "../scripts/qa/runtime/character-appearance-sets.scenario.mjs";

afterAll(cleanupCharacterAppearanceFixture);

it("loads the actual scenario upload and selected cells through the shipped data boundary", () => {
  // Given the exact fixture consumed by the player.html harness.
  const raw = readFileSync(scenario.projectFixture, "utf8");
  // When the shipping load and runtime projection paths execute.
  const project = deserialize(raw);
  const session = startSession(project);
  const sprite = resolvePlayerSpriteResource(project, session);
  const npc = runtimeEventViewsForMap(project, project.maps[project.startMapId], session, {})[0];
  // Then real PNG bytes and independently computed RTP cells survive.
  expect(project.assets.uploaded["qa-manual-charset"].dataUrl).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  expect([sprite.texture, sprite.idleFrameFor("down"), npc.sprite?.id, npc.page?.graphic.pattern])
    .toEqual(["qa-manual-charset", 76, "qa-manual-charset", 88]);
});
