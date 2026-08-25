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
    expect(skill.style.backgroundImage).toContain("/assets/generated/effects/");

    const animation = thumb("battleAnimations", project.database.battleAnimations[0], project);
    expect(animation.className).toContain("db-list-thumb-animation");
    expect(animation.style.backgroundImage).toContain("/assets/easyrpg/battle/");
  });

  it("returns visual thumbnails for classes, troops, and states", () => {
    const project = createBlankProject();

    const klass = thumb("classes", project.database.classes[0], project);
    expect(klass.className).toContain("db-list-thumb");

    const troop = thumb("troops", project.database.troops[0], project);
    expect(troop.className).toContain("db-list-thumb");

    const state = thumb("states", project.database.states[0], project);
    expect(state.className).toContain("db-list-thumb-state");
    expect(state.style.backgroundColor).toMatch(/^#|rgb/i);
  });

  it("returns empty slots for missing supported resources", () => {
    const project = createBlankProject();
    const actor = { ...project.database.actors[0], faceResourceId: undefined };
    const empty = recordListThumbnail("actors", actor, project);
    expect(empty?.className).toContain("db-list-thumb");
    expect(empty?.className).toContain("empty");
  });

  it("crops actor faces by faceIndex", () => {
    const project = createBlankProject();
    const actor = { ...project.database.actors[0], faceIndex: 1 };
    const node = thumb("actors", actor, project);
    expect(node.style.backgroundPosition).toContain("-");
    expect(node.style.backgroundPosition).not.toBe("0px 0px");
  });

  it("parameterized size scales the crop math while the default stays at 32px", () => {
    const project = createBlankProject();
    const actor = { ...project.database.actors[0], faceIndex: 0 };

    // 기본(size 미지정)은 기존 32px 크롭과 동일하다 — 기존 호출부 계약 유지.
    const defaultNode = thumb("actors", actor, project);
    const explicit32 = recordListThumbnail("actors", actor, project, 32);
    if (!(explicit32 instanceof FakeElement)) throw new Error("expected fake element");
    expect(explicit32.style.backgroundSize).toBe(defaultNode.style.backgroundSize);

    // 48px 은 배율 1.5 로 크롭 스케일이 커진다 (backgroundSize 첫 숫자 = size × 시트 열 수).
    const large = recordListThumbnail("actors", actor, project, 48);
    if (!(large instanceof FakeElement)) throw new Error("expected fake element");
    expect(large.style.backgroundSize).not.toBe(defaultNode.style.backgroundSize);
    expect(firstPx(large.style.backgroundSize) / firstPx(defaultNode.style.backgroundSize)).toBeCloseTo(1.5);

    // 손상된 size(0/음수)는 32px 기본으로 폴백한다.
    const broken = recordListThumbnail("actors", actor, project, 0);
    if (!(broken instanceof FakeElement)) throw new Error("expected fake element");
    expect(broken.style.backgroundSize).toBe(defaultNode.style.backgroundSize);

    // 애니메이션 크롭도 size 를 따른다 (같은 1.5 배율).
    const animationDefault = recordListThumbnail("battleAnimations", project.database.battleAnimations[0], project);
    const animation = recordListThumbnail("battleAnimations", project.database.battleAnimations[0], project, 48);
    if (!(animation instanceof FakeElement) || !(animationDefault instanceof FakeElement)) throw new Error("expected fake element");
    expect(animation.style.backgroundSize).not.toBe(animationDefault.style.backgroundSize);
    expect(firstPx(animation.style.backgroundSize) / firstPx(animationDefault.style.backgroundSize)).toBeCloseTo(1.5);
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

function firstPx(backgroundSize: string): number {
  return Number.parseFloat(backgroundSize) || 0;
}
