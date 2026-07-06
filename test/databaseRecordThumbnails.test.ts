import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { createBlankProject } from "@/project/defaults";
import type { DatabaseCollection } from "@/editor/databaseActions";
import type { DatabaseRecords } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("database record list thumbnails", () => {
  it("returns collection-specific thumbnail slots for visual database records", () => {
    const project = createBlankProject();

    const actor = thumb("actors", project.database.actors[0], project);
    expect(actor.className).toContain("db-list-thumb");
    expect(actor.className).toContain("db-list-thumb-crop");
    expect(actor.style.backgroundImage).toContain("/assets/easyrpg/faceset/");

    const enemy = thumb("enemies", project.database.enemies[0], project);
    expect(enemy.className).toContain("db-list-thumb-image");
    expect(enemy.querySelector("img")?.attrs.src).toContain("/assets/");

    const item = thumb("items", project.database.items[0], project);
    expect(item.querySelector("img")?.attrs.src).toContain("/assets/cc0/");

    const equipment = thumb("equipment", project.database.equipment[0], project);
    expect(equipment.querySelector("img")?.attrs.src).toContain("/assets/cc0/");

    const skill = thumb("skills", project.database.skills[0], project);
    expect(skill.className).toContain("db-list-thumb-animation");
    expect(skill.style.backgroundImage).toContain("/assets/easyrpg/battle/");

    const animation = thumb("battleAnimations", project.database.battleAnimations[0], project);
    expect(animation.className).toContain("db-list-thumb-animation");
    expect(animation.style.backgroundImage).toContain("/assets/easyrpg/battle/");
  });

  it("keeps non-visual collections unchanged and returns empty slots for missing supported resources", () => {
    const project = createBlankProject();

    expect(recordListThumbnail("classes", project.database.classes[0], project)).toBeNull();
    expect(recordListThumbnail("troops", project.database.troops[0], project)).toBeNull();
    expect(recordListThumbnail("states", project.database.states[0], project)).toBeNull();

    const actor = { ...project.database.actors[0], faceResourceId: undefined };
    const empty = recordListThumbnail("actors", actor, project);
    expect(empty?.className).toContain("db-list-thumb");
    expect(empty?.className).toContain("empty");
  });
});

function thumb<C extends DatabaseCollection>(
  collection: C,
  record: DatabaseRecords[C][number] | undefined,
  project: ReturnType<typeof createBlankProject>
): FakeElement {
  if (!record) throw new Error(`Missing ${collection} record`);
  const node = recordListThumbnail(collection, record, project);
  if (node instanceof FakeElement) return node;
  throw new Error(`Expected ${collection} thumbnail`);
}
