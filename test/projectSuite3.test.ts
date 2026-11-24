import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { getCharacterAppearance, listAppearanceUsages, resolveActorAppearance, resolveAppearancePortrait } from "@/project/characterAppearances";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import { characterAppearanceProject } from "./fixtures/characterAppearanceProject";
import { listCharacterFaces, listCharacterSprites, seedGraphicAttributes, updateCharacterSprite } from "@/project/characterGraphics";
import { isRecommendedCharacterFace, rankCharacterFaces } from "@/project/characterFaceCandidates";
import { reviewedCharsetFace } from "@/assets/charsetFaceMap";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { CHARACTER_FOOTPRINT_AXIS_MAX, UNIT_FOOTPRINT, footprintBounds, characterFootprintCells, nearestCellInRect, footprintContains, normalizeCharacterFootprint, normalizeCharacterScale, normalizePassRows, passageBounds, pointRect, rectsOverlap } from "@/project/footprint";
import { isolateTimers } from "./mergedTeardown";

describe("characterAppearanceSets", () => {
  isolateTimers();
  describe("character appearance authored boundary", () => {
    it.each([
      ["non-array catalog", {}],
      ["missing name", [{ id: "look", description: "" }]],
      ["duplicate ids", [{ id: "look", name: "A", description: "" }, { id: "look", name: "B", description: "" }]],
      ["invalid slot", [{ id: "look", name: "A", description: "", charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 8 } }]],
      ["missing resource", [{ id: "look", name: "A", description: "", face: { resourceId: "missing-face" } }]],
      ["wrong resource kind", [{ id: "look", name: "A", description: "", face: { resourceId: "easyrpg-charset-actor1" } }]],
    ])("rejects %s when loading authored appearances", (_name, characterAppearances) => {
      // Given authored JSON at the existing load boundary.
      const project = createBlankProject();
      const wire = JSON.stringify({ ...project, database: { ...project.database, characterAppearances } });
      // When / Then malformed authored fields must not be silently retained or dropped.
      expect(() => deserialize(wire)).toThrow();
    });

    it("keeps the catalog absent when loading a legacy project", () => {
      // Given a legacy project with no catalog.
      const project = createBlankProject();
      // When it crosses the persistence boundary.
      const loaded = deserialize(serialize(project));
      // Then no empty catalog is invented.
      expect(Object.hasOwn(loaded.database, "characterAppearances")).toBe(false);
    });

    it("preserves catalog, page link, and actor link across save and reload", () => {
      // Given a complete set and an intentionally empty set.
      const project = characterAppearanceProject();
      const legacyActor = { ...project.database.actors[0] };
      // When persisted through the canonical path.
      const loaded = deserialize(serialize(project));
      // Then references and legacy direct fields survive together.
      expect(loaded.database.characterAppearances).toEqual(project.database.characterAppearances);
      expect(loaded.database.actors[0].appearanceId).toBe("look");
      expect(loaded.database.actors[0].characterResourceId).toBe(legacyActor.characterResourceId);
      expect(loaded.maps[loaded.startMapId].events[0].pages?.[0].graphic.appearanceId).toBe("look");
      expect(getCharacterAppearance(loaded, "empty")).toEqual({ id: "empty", name: "Empty", description: "" });
      expect(collectUsedUploadedAssetIds(loaded)).toContain("uploaded-walk");
    });

    it.each(["actor", "page", "command"] as const)("rejects dangling %s links when reloading", (target) => {
      // Given a reference to an absent set.
      const project = characterAppearanceProject();
      const event = project.maps[project.startMapId].events[0];
      switch (target) {
        case "actor": project.database.actors[0].appearanceId = "missing"; break;
        case "page": {
          const page = event.pages?.[0];
          if (!page) throw new Error("fixture page missing");
          page.graphic.appearanceId = "missing";
          break;
        }
        case "command": event.commands = [{ kind: "changeFace", resourceId: "", appearanceId: "missing", position: "left", flipHorizontally: false }]; break;
      }
      // When / Then load rejects instead of erasing authored intent.
      expect(() => deserialize(serialize(project))).toThrow(/appearanceId/);
    });

    it("reports actors, pages, and nested common-event commands when checking usages", () => {
      // Given a reference nested under a loop.
      const project = characterAppearanceProject();
      project.commonEvents.push({ id: "appearance-common", name: "Portrait", trigger: "none", commands: [
        { kind: "loop", body: [{ kind: "changeFace", resourceId: "", appearanceId: "look", position: "left", flipHorizontally: false }] },
      ] });
      // When deletion protection asks for usages.
      const usages = listAppearanceUsages(project, "look");
      // Then each reference kind blocks unsafe deletion.
      expect(usages.map((usage) => usage.kind)).toEqual(["actor", "event", "command"]);
      expect(listAppearanceUsages(project, "empty")).toEqual([]);
    });

    it("falls back to legacy direct slots when an actor links an incomplete set", () => {
      // Given a metadata-only appearance.
      const project = characterAppearanceProject();
      const actor = { ...project.database.actors[0], appearanceId: "empty" };
      // When effective slots are projected.
      const effective = resolveActorAppearance(project, actor);
      // Then omitted set slots retain legacy values and authoring stays intact.
      expect(effective).toEqual(actor);
      expect(resolveAppearancePortrait(project, "empty", "bust")).toBeUndefined();
    });

    it("rejects a charset upload with an unsupported authored sheet layout", () => {
      // Given a purported charset that cannot contain eight 3x4 characters.
      const project = characterAppearanceProject();
      project.assets.uploaded["uploaded-walk"].meta.width = 48;
      // When / Then the linked resource cannot silently use an arbitrary slice.
      expect(() => deserialize(serialize(project))).toThrow(/charset/);
    });

    it.each([
      ["bust", "generated-face-actor1-bust"],
      ["bust", "generated-face-actor1-full"],
      // 생성 영웅 얼굴(generated-actor-hero-01-face)은 생성 계획에서 rejected 라 더는 고를 수 없다 — 출하 얼굴 칸으로 본다.
      ["face", "easyrpg-faceset-actor1-00"],
    ] as const)("accepts built-in portrait %s/%s offered by the picker", (slot, resourceId) => {
      // Given a real built-in picture, without a redundant project profile.
      const project = characterAppearanceProject();
      project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId !== resourceId);
      project.database.characterAppearances = [{ id: "look", name: "Guide", description: "", [slot]: { resourceId } }];
      // When the authored selection crosses the save/load boundary.
      const loaded = deserialize(serialize(project));
      // Then the picker choice remains valid with explicit bust presentation.
      expect(resolveAppearancePortrait(loaded, "look", slot)?.resourceId).toBe(resourceId);
    });
  });
});

describe("characterFaceCandidates", () => {
  isolateTimers();
  describe("character face evidence", () => {
    it("uses written semantic age and gender without saving or borrowing paired-face traits", () => {
      const project = createBlankProject();
      const before = JSON.stringify(project);
      const nun = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people2" && row.characterIndex === 1)!;
      expect(nun.attributes).toMatchObject({ age: "노년", gender: "여성", role: "수녀" });
      expect(listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-people1-00")?.label).toBe("갈색 단발 소년");
      expect(JSON.stringify(project)).toBe(before);
      updateCharacterSprite(project, { ...nun, attributes: {} });
      expect(listCharacterSprites(project).find((row) => row.textureKey === nun.textureKey && row.characterIndex === 1)?.attributes).toEqual({});
    });

    it("uses reviewed human correspondences without treating NPC fallback or monster indices as exact", () => {
      expect(reviewedCharsetFace("tex_easyrpg_charset_people3", 0)?.resourceId).toBe("easyrpg-faceset-people2-00");
      expect(reviewedCharsetFace("tex_easyrpg_charset_people1", 4)?.approximate).toBe(true);
      expect(reviewedCharsetFace("tex_easyrpg_charset_people2", 1)).toBeNull();
      expect(reviewedCharsetFace("tex_easyrpg_charset_monster2", 1)).toBeNull();
      expect(reviewedCharsetFace("tex_easyrpg_charset_actor1", 8)).toBeNull();
    });

    it("ranks known correspondence first and exposes contradictory written attributes", () => {
      const project = createBlankProject();
      const sprite = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people1" && row.characterIndex === 0)!;
      const ranked = rankCharacterFaces(sprite, listCharacterFaces(project));
      expect(ranked[0]?.face.resourceId).toBe("easyrpg-faceset-people1-00");
      expect(ranked.find((candidate) => candidate.face.resourceId === "easyrpg-faceset-people1-07")?.conflicts).toContain("나이: 어린이 ↔ 노년");
      expect(sprite.faceResourceId).toBeNull();
    });
    it("uses both halves of each actor face sheet in editor and NPC tool paths", () => {
      const pairs = [["actor1", "actor1", 0], ["actor2", "actor1", 8], ["actor3", "actor2", 0], ["actor4", "actor2", 8]] as const;
      for (const [charset, faceset, offset] of pairs) for (let slot = 0; slot < 8; slot++) {
        // Actor3 #5(청록 머리 무도가)는 FaceSet/Actor2 에 이 인물이 없다(2026-09-28 원본 대조) — 생성 짝 얼굴을 쓴다.
        if (charset === "actor3" && slot === 5) {
          expect(reviewedCharsetFace("tex_easyrpg_charset_actor3", 5)).toBeNull();
          expect(reviewedFaceIdForCharset("easyrpg-charset-actor3", 5)).toBe("generated-faceset-missing-people-10");
          continue;
        }
        // Actor4 #5(금발 남성 갑옷 전사)는 기존 얼굴이 여성·녹색 스카프라 다른 인물이다 — 2026-10-05 재검토로 공용 대응표가 「얼굴 없음」으로 바꿨다.
        if (charset === "actor4" && slot === 5) {
          expect(reviewedFaceIdForCharset("easyrpg-charset-actor4", 5)).toBeUndefined();
          continue;
        }
        const expected = `easyrpg-faceset-${faceset}-${String(slot + offset).padStart(2, "0")}`;
        const texture = `tex_easyrpg_charset_${charset}`;
        expect(reviewedCharsetFace(texture, slot)?.resourceId).toBe(expected);
        expect(reviewedFaceIdForCharset(`easyrpg-charset-${charset}`, slot)).toBe(expected);
      }
    });

    it("does not recommend children for unknown age or claim a pair from gender alone", () => {
      const project = createBlankProject();
      const gentleman = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people2" && row.characterIndex === 0)!;
      const ranked = rankCharacterFaces(gentleman, listCharacterFaces(project));
      expect(ranked.find((candidate) => candidate.face.resourceId === "easyrpg-faceset-people1-00")?.recommendation).toBe("conflict");
      expect(ranked.filter(isRecommendedCharacterFace).some((candidate) => candidate.face.attributes.age === "어린이")).toBe(false);
      const broadMatch = { resourceId: "test-face", label: "남성", attributes: { kind: "사람", gender: "남성" }, note: "" };
      expect(rankCharacterFaces(gentleman, [broadMatch])[0]?.recommendation).toBe("none");
    });

    it("vetoes reviewed-table priority when independent authored traits contradict it", () => {
      const project = createBlankProject();
      const boy = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people1" && row.characterIndex === 0)!;
      const face = listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-people1-00")!;
      const result = rankCharacterFaces(boy, [{ ...face, attributes: { ...face.attributes, gender: "여성" } }])[0]!;
      expect(result.recommendation).toBe("conflict");
      expect(result.score).toBeLessThan(100);
      expect(isRecommendedCharacterFace(result)).toBe(false);
    });

    it("reads face source descriptions independently and does not read a white headband as white hair", () => {
      const project = createBlankProject();
      const face = listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-actor2-05")!;
      expect(face.label).toBe("청록 머리 여성");
      expect(face.attributes.gender).toBe("여성");
      const fighter = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_actor3" && row.characterIndex === 5)!;
      expect(rankCharacterFaces(fighter, [face])[0]?.recommendation).toBe("conflict");
      expect(seedGraphicAttributes("흰 머리띠 여성").hair).toBeUndefined();
    });

  });
});

// test/characterFootprint.test.ts
// 발밑 앵커 발자국 프리미티브 단위 테스트.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §1.
describe("characterFootprint", () => {
  isolateTimers();
  describe("1x1 항등성 — 이 설계의 안전줄", () => {
    it("1x1 bounds 는 그 칸 자신이다", () => {
      expect(footprintBounds(5, 7, UNIT_FOOTPRINT)).toEqual({ left: 5, right: 5, top: 7, bottom: 7 });
    });

    it("1x1 bounds 는 pointRect 와 같다", () => {
      for (let x = -3; x <= 3; x += 1) {
        for (let y = -3; y <= 3; y += 1) {
          expect(footprintBounds(x, y, UNIT_FOOTPRINT)).toEqual(pointRect(x, y));
        }
      }
    });

    it("1x1 contains 는 그 칸에서만 참이다", () => {
      expect(footprintContains(5, 7, UNIT_FOOTPRINT, 5, 7)).toBe(true);
      expect(footprintContains(5, 7, UNIT_FOOTPRINT, 4, 7)).toBe(false);
      expect(footprintContains(5, 7, UNIT_FOOTPRINT, 5, 6)).toBe(false);
    });

    it("1x1 cells 는 한 칸이다", () => {
      expect(characterFootprintCells(5, 7, UNIT_FOOTPRINT)).toEqual([{ x: 5, y: 7 }]);
    });
  });
  describe("footprintBounds — 발밑 앵커", () => {
    it("2x2 는 오른쪽·위로 자라고 앵커가 좌하단이다", () => {
      expect(footprintBounds(5, 7, { width: 2, height: 2 })).toEqual({ left: 5, right: 6, top: 6, bottom: 7 });
    });

    it("3x3 은 앵커가 하단 중앙이다", () => {
      expect(footprintBounds(5, 7, { width: 3, height: 3 })).toEqual({ left: 4, right: 6, top: 5, bottom: 7 });
    });

    it("짝수 폭은 왼쪽으로 치우친다 — 앵커 왼쪽 칸 수가 오른쪽보다 적다", () => {
      const b = footprintBounds(5, 7, { width: 4, height: 1 });
      expect(b.left).toBe(4);
      expect(b.right).toBe(7);
      expect(5 - b.left).toBeLessThan(b.right - 5);
    });

    it("하단 행은 언제나 y 다", () => {
      for (const height of [1, 2, 3, 5, 8]) {
        expect(footprintBounds(5, 7, { width: 1, height }).bottom).toBe(7);
      }
    });
  });
  describe("rectsOverlap — AABB", () => {
    it("맞닿기만 해도 겹침이다(포함 경계)", () => {
      expect(rectsOverlap(pointRect(1, 1), pointRect(1, 1))).toBe(true);
    });

    it("한 칸 떨어지면 겹치지 않는다", () => {
      expect(rectsOverlap(pointRect(1, 1), pointRect(2, 1))).toBe(false);
      expect(rectsOverlap(pointRect(1, 1), pointRect(1, 2))).toBe(false);
    });

    it("2x2 발자국은 자기 네 칸 전부와 겹친다", () => {
      const fp = { width: 2, height: 2 };
      const bounds = footprintBounds(5, 7, fp);
      for (const cell of characterFootprintCells(5, 7, fp)) {
        expect(rectsOverlap(bounds, pointRect(cell.x, cell.y))).toBe(true);
      }
      expect(characterFootprintCells(5, 7, fp)).toHaveLength(4);
    });

    it("교차하는 큰 사각끼리도 겹침을 잡는다", () => {
      expect(rectsOverlap({ left: 0, right: 5, top: 0, bottom: 1 }, { left: 2, right: 3, top: -4, bottom: 9 })).toBe(true);
    });
  });
  describe("normalizeCharacterFootprint — 직렬화 방어", () => {
    it("잘못된 값은 1x1 로 떨어진다", () => {
      expect(normalizeCharacterFootprint(undefined)).toEqual(UNIT_FOOTPRINT);
      expect(normalizeCharacterFootprint(null)).toEqual(UNIT_FOOTPRINT);
      expect(normalizeCharacterFootprint("2x2")).toEqual(UNIT_FOOTPRINT);
      expect(normalizeCharacterFootprint({})).toEqual(UNIT_FOOTPRINT);
      expect(normalizeCharacterFootprint({ width: 0, height: -3 })).toEqual(UNIT_FOOTPRINT);
      expect(normalizeCharacterFootprint({ width: 1.5, height: 2.5 })).toEqual(UNIT_FOOTPRINT);
      expect(normalizeCharacterFootprint({ width: Number.NaN, height: 2 })).toEqual({ width: 1, height: 2 });
    });

    it("축 상한으로 클램프한다", () => {
      expect(normalizeCharacterFootprint({ width: 99, height: 99 })).toEqual({
        width: CHARACTER_FOOTPRINT_AXIS_MAX,
        height: CHARACTER_FOOTPRINT_AXIS_MAX,
      });
    });

    it("정상 값은 그대로 통과한다", () => {
      expect(normalizeCharacterFootprint({ width: 3, height: 2 })).toEqual({ width: 3, height: 2 });
    });
  });
  describe("normalizeCharacterScale", () => {
    it("생략·비정상은 1 이다", () => {
      expect(normalizeCharacterScale(undefined)).toBe(1);
      expect(normalizeCharacterScale("2")).toBe(1);
      expect(normalizeCharacterScale(Number.NaN)).toBe(1);
      expect(normalizeCharacterScale(0)).toBe(1);
      expect(normalizeCharacterScale(-2)).toBe(1);
    });

    it("범위 안 값은 그대로, 밖은 클램프한다", () => {
      expect(normalizeCharacterScale(2)).toBe(2);
      expect(normalizeCharacterScale(1.5)).toBe(1.5);
      expect(normalizeCharacterScale(99)).toBe(8);
      expect(normalizeCharacterScale(0.01)).toBe(0.25);
    });
  });
  describe("nearestCellInRect — 사각으로 올린 히트테스트의 소비자용", () => {
    // 사각으로 이벤트를 **찾은** 다음 그 결과로 방향·거리를 계산하는 곳이 있다.
    // 거기서 앵커 좌표를 그대로 쓰면 틀린다: 앵커는 발자국의 최근접 칸이 아니다.
    it("사각 안의 점은 그대로 둔다", () => {
      const rect = footprintBounds(15, 18, { width: 2, height: 2 }); // 15..16 × 17..18
      expect(nearestCellInRect(rect, 16, 18)).toEqual({ x: 16, y: 18 });
      expect(nearestCellInRect(rect, 15, 17)).toEqual({ x: 15, y: 17 });
    });

    it("사각 밖의 점은 최근접 모서리 칸으로 끌어당긴다", () => {
      const rect = footprintBounds(15, 18, { width: 2, height: 2 });
      expect(nearestCellInRect(rect, 16, 19), "정남향 아래").toEqual({ x: 16, y: 18 });
      expect(nearestCellInRect(rect, 20, 12), "우상 대각 멀리").toEqual({ x: 16, y: 17 });
      expect(nearestCellInRect(rect, 3, 30), "좌하 대각 멀리").toEqual({ x: 15, y: 18 });
    });

    it("1x1 에서는 항등이다 — 앵커가 곧 유일한 칸이다", () => {
      const rect = footprintBounds(5, 7, UNIT_FOOTPRINT);
      for (const [px, py] of [[5, 7], [4, 7], [5, 9], [99, -3]]) {
        expect(nearestCellInRect(rect, px, py), `(${px},${py})`).toEqual({ x: 5, y: 7 });
      }
    });
  });
  describe("비정규 발자국은 fail-open 하지 않는다", () => {
    // 정규화(normalizeCharacterFootprint)는 runtimeEventView 한 곳에만 있고
    // footprintBounds 는 원시 CharacterFootprint 를 받는다. 축이 1 미만이면
    // left > right 인 역사각이 되어 파생 함수들의 셀 루프가 0회 돌고, 통행 검사가
    // **한 번도 실행되지 않은 채 통과**한다. 통행 판정이 열리는 쪽으로 실패하는 것은
    // 벽 통과로 직결되므로 1x1 로 굳혀 막는다.
    //
    // 이 테스트가 실패하려면: footprintBounds 의 safeAxis 를 지우면 폭 0 의 bounds 가
    // { left: 5, right: 4 } 로 뒤집히고 아래 첫 단정이 깨진다.
    it("폭·높이 0 은 1 로 굳어 역사각이 되지 않는다", () => {
      expect(footprintBounds(5, 7, { width: 0, height: 0 })).toEqual(
        footprintBounds(5, 7, UNIT_FOOTPRINT)
      );
      for (const fp of [{ width: 0, height: 3 }, { width: 3, height: 0 }, { width: -2, height: -2 }]) {
        const rect = footprintBounds(5, 7, fp);
        expect(rect.left <= rect.right, `${JSON.stringify(fp)} 의 가로`).toBe(true);
        expect(rect.top <= rect.bottom, `${JSON.stringify(fp)} 의 세로`).toBe(true);
      }
    });

    it("역사각이 안 되므로 셀 순회가 빈 배열이 되지 않는다", () => {
      // 빈 배열이면 canMoveFootprint 의 선행 모서리 루프도 0회 돌아 무조건 true 다.
      expect(characterFootprintCells(5, 7, { width: 0, height: 0 })).toEqual([{ x: 5, y: 7 }]);
      expect(characterFootprintCells(5, 7, { width: Number.NaN, height: 2 })).toHaveLength(2);
    });

    it("소수 축은 내림한다 — 사각 좌표는 정수여야 한다", () => {
      expect(footprintBounds(5, 7, { width: 2.9, height: 1 })).toEqual(
        footprintBounds(5, 7, { width: 2, height: 1 })
      );
    });
  });
  // 2차 스펙 §1 — 몸 사각과 통행 사각의 분리.
  describe("passageBounds — 통행 사각은 몸 사각의 하단 부분사각", () => {
    // 항등: passRows 가 몸 높이와 같으면(= 생략 시 정규화 기본값) 두 사각이 같다.
    // 이 항등이 깨지면 passRows 없는 기존 프로젝트의 통행 동작이 바뀐다.
    it("행 수가 몸 높이와 같으면 몸 사각과 정확히 같다", () => {
      for (const height of [1, 2, 3, CHARACTER_FOOTPRINT_AXIS_MAX]) {
        const fp = { width: 3, height };
        expect(passageBounds(5, 7, fp, height), `높이 ${height}`).toEqual(footprintBounds(5, 7, fp));
      }
    });

    it("행 수 1 이면 발밑 한 줄이다 — 좌우 폭은 몸과 같다", () => {
      const rect = passageBounds(5, 7, { width: 3, height: 3 }, 1);
      expect(rect).toEqual({ left: 4, right: 6, top: 7, bottom: 7 });
    });

    it("하단에 고정된다 — top 만 올라오고 bottom·left·right 는 몸과 같다", () => {
      const fp = { width: 4, height: 4 };
      const body = footprintBounds(9, 12, fp);
      for (const rows of [1, 2, 3, 4]) {
        const pass = passageBounds(9, 12, fp, rows);
        expect(pass.bottom, `${rows}행의 bottom`).toBe(body.bottom);
        expect(pass.left, `${rows}행의 left`).toBe(body.left);
        expect(pass.right, `${rows}행의 right`).toBe(body.right);
        expect(pass.top, `${rows}행의 top`).toBe(body.bottom - (rows - 1));
      }
    });

    // fail-closed: 행 수가 적을수록 통행이 열린다. 비정규 값은 다 막는 쪽으로 굳어야 한다.
    //
    // 이 테스트가 실패하려면: passageBounds 의 safePassRows 를 지우면 rows=0 이
    // top = bottom + 1 인 역사각을 만들고 첫 단정이 깨진다.
    it("비정규 행 수는 몸 전체로 올라간다 — fail-closed", () => {
      const fp = { width: 2, height: 3 };
      const body = footprintBounds(5, 7, fp);
      for (const rows of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(passageBounds(5, 7, fp, rows), `행 수 ${rows}`).toEqual(body);
      }
    });

    it("몸 높이를 넘는 행 수는 몸 높이로 클램프된다", () => {
      const fp = { width: 2, height: 2 };
      expect(passageBounds(5, 7, fp, 99)).toEqual(footprintBounds(5, 7, fp));
    });

    it("역사각이 되지 않으므로 통행 검사가 빈손으로 통과하지 않는다", () => {
      for (const rows of [0, -5, Number.NaN, 2.5]) {
        const rect = passageBounds(5, 7, { width: 3, height: 3 }, rows);
        expect(rect.top <= rect.bottom, `행 수 ${rows}`).toBe(true);
        expect(rect.left <= rect.right, `행 수 ${rows}`).toBe(true);
      }
    });
  });
  describe("normalizePassRows — 직렬화 방어", () => {
    it("생략·비정규는 몸 높이 전체다 — 그게 항등 기본값이다", () => {
      for (const bad of [undefined, null, "2", {}, [], Number.NaN, 0, -3, 2.5, true]) {
        expect(normalizePassRows(bad, 3), `${JSON.stringify(bad) ?? "undefined"}`).toBe(3);
      }
    });

    it("범위 안의 정수는 그대로다", () => {
      expect(normalizePassRows(1, 3)).toBe(1);
      expect(normalizePassRows(2, 3)).toBe(2);
    });

    it("몸 높이를 넘으면 몸 높이로 클램프한다", () => {
      expect(normalizePassRows(9, 3)).toBe(3);
    });

    it("몸 높이가 비정규면 clampAxis 와 같은 경계로 굳는다", () => {
      expect(normalizePassRows(5, 0)).toBe(1);
      expect(normalizePassRows(5, Number.NaN)).toBe(1);
      // 몸 높이가 상한을 넘으면 상한이 천장이 된다. 범위 안의 5 는 그대로 5 다.
      expect(normalizePassRows(5, CHARACTER_FOOTPRINT_AXIS_MAX + 10)).toBe(5);
      expect(normalizePassRows(99, CHARACTER_FOOTPRINT_AXIS_MAX + 10)).toBe(CHARACTER_FOOTPRINT_AXIS_MAX);
    });
  });
});
