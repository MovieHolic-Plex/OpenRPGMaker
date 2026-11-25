import { describe, expect, it } from "vitest";
import { buildChangeLedger, summarizeLedgerValue, type ChangeLedgerEntry } from "@/project/changeLedger";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { getCharacterAppearance, listAppearanceUsages, resolveActorAppearance, resolveAppearancePortrait } from "@/project/characterAppearances";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import { characterAppearanceProject } from "./fixtures/characterAppearanceProject";
import { isolateTimers } from "./mergedTeardown";

// 변경 내역(긴 명세) — 큰 위임의 검토는 칩이 아니라 항목별 before → after 로 한다.
//
// 깨질 것(실측 2026-09-14, 감독 지시): "before/after 가 굉장히 긴 명세여야 하는 것 아닌가.
// 보통 맡기는 일이 매우 클텐데" — 지도 그림 두 장과 칩 한 줄로는 위임을 검토할 수 없다.
describe("changeLedger", () => {
  isolateTimers();
  function blank(): { project: Project; mapId: string } {
    const project = createBlankProject();
    return { project, mapId: Object.keys(project.maps)[0]! };
  }
  function clone(project: Project): Project {
    return structuredClone(project) as Project;
  }
  function mapOf(project: Project, mapId: string): GameMap {
    const map = project.maps[mapId];
    if (!map) throw new TypeError(`맵 없음: ${mapId}`);
    return map;
  }
  function event(id: string, name: string, x: number, y: number): GameEvent {
    return { id, name, x, y, trigger: "action", commands: [], pages: [] } as unknown as GameEvent;
  }
  function entryFor(entries: readonly ChangeLedgerEntry[], label: string): ChangeLedgerEntry {
    const entry = entries.find((candidate) => candidate.label === label);
    if (!entry) throw new Error(`항목 없음: ${label} — ${entries.map((candidate) => candidate.label).join(", ")}`);
    return entry;
  }
  function mapLabel(project: Project, mapId: string): string {
    return `${mapOf(project, mapId).name} (${mapId})`;
  }
  describe("buildChangeLedger — 항목별 before → after", () => {
    it("이벤트가 움직이면 영역·이름·좌표 변화가 나온다", () => {
      const { project: before, mapId } = blank();
      mapOf(before, mapId).events = [event("e1", "NPC_가드", 1, 1)];
      const after = clone(before);
      mapOf(after, mapId).events = [event("e1", "NPC_가드", 4, 7)];

      const { entries } = buildChangeLedger(before, after);
      const entry = entryFor(entries, "NPC_가드");

      expect(entry.area).toContain("이벤트 ·");
      expect(entry.change).toBe("changed");
      expect(entry.detail).toEqual(expect.arrayContaining(["X: 1 → 4", "Y: 1 → 7"]));
    });

    it("새 이벤트는 추가로, 지운 이벤트는 삭제로 남는다 — 어느 쪽도 조용히 사라지지 않는다", () => {
      const { project: before, mapId } = blank();
      mapOf(before, mapId).events = [event("e0", "사라진 경비", 2, 2)];
      const after = clone(before);
      mapOf(after, mapId).events = [event("e1", "새 상인", 5, 5)];

      const { entries } = buildChangeLedger(before, after);

      expect(entryFor(entries, "새 상인").change).toBe("added");
      expect(entryFor(entries, "새 상인").detail).toEqual(expect.arrayContaining(["X: 5", "Y: 5"]));
      expect(entryFor(entries, "사라진 경비").change).toBe("removed");
      expect(entryFor(entries, "사라진 경비").detail).toEqual(expect.arrayContaining(["X: 2"]));
    });

    it("퀘스트는 key 가 신원이고 title 이 이름이다", () => {
      const { project: before } = blank();
      const after = clone(before);
      after.quests = [{ key: "quest_bell", title: "종을 되찾아라", summary: "…", steps: [] } as never];

      const quest = entryFor(buildChangeLedger(before, after).entries, "종을 되찾아라");

      expect(quest.area).toBe("퀘스트");
      expect(quest.change).toBe("added");
      expect(quest.detail).toEqual(expect.arrayContaining(["제목: 종을 되찾아라"]));
    });

    it("데이터베이스 레코드의 필드 변화가 값과 함께 나온다", () => {
      const { project: before } = blank();
      before.database = { ...before.database, items: [{ id: "item_1", name: "포션", price: 50 } as never] };
      const after = clone(before);
      after.database = { ...after.database, items: [{ id: "item_1", name: "큰 포션", price: 120 } as never] };

      const item = entryFor(buildChangeLedger(before, after).entries, "큰 포션");

      expect(item.area).toBe("데이터베이스 · 아이템");
      expect(item.detail).toEqual(expect.arrayContaining(["이름: 포션 → 큰 포션", "가격: 50 → 120"]));
    });

    it("맵 타일은 칸 수로 요약한다 — 만 칸짜리 배열을 명세에 쏟지 않는다", () => {
      const { project: before, mapId } = blank();
      const after = clone(before);
      const map = mapOf(after, mapId);
      map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
      map.lowerTiles[1] = (map.lowerTiles[1] ?? 0) + 1;

      const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

      expect(detail).toContain("아래층 타일: 2칸 바뀜");
      // 이벤트는 자기 항목이 맡는다 — 맵 항목이 이벤트 목록 전체를 요약하지 않는다.
      expect(detail.some((line) => line.startsWith("이벤트:"))).toBe(false);
    });

    it("맵 이름·인카운터 같은 속성 변화도 이름을 얻는다", () => {
      const { project: before, mapId } = blank();
      const after = clone(before);
      mapOf(after, mapId).name = "달빛 숲";
      mapOf(after, mapId).encounterRate = 12;

      const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

      expect(detail).toEqual(expect.arrayContaining([`이름: ${summarizeLedgerValue(before.maps[mapId]!.name)} → 달빛 숲`]));
      expect(detail).toEqual(expect.arrayContaining(["인카운터율: 없음 → 12"]));
    });

    it("프로젝트 정보 같은 싱글톤도 필드별로 나온다", () => {
      const { project: before } = blank();
      const after = clone(before);
      after.meta = { ...after.meta, title: "새 게임", author: "나" };

      const meta = entryFor(buildChangeLedger(before, after).entries, "게임 정보");

      expect(meta.area).toBe("프로젝트 정보");
      expect(meta.detail).toEqual(expect.arrayContaining([`제목: ${summarizeLedgerValue(before.meta.title)} → 새 게임`]));
    });

    it("모르는 모양의 필드도 남는다 — 변경이 사라지지 않는다", () => {
      const { project: before } = blank();
      const after = clone(before);
      after.aiInstructions = "항상 한국어로";

      expect(entryFor(buildChangeLedger(before, after).entries, "AI 지시문").after).toBe("항상 한국어로");
    });

    it("아무것도 안 바뀌면 빈 명세", () => {
      const { project: before } = blank();
      const ledger = buildChangeLedger(before, clone(before));
      expect(ledger.entries).toEqual([]);
      expect(ledger.total).toBe(0);
    });

    it("상한을 넘으면 자르되 전체 수를 잃지 않는다", () => {
      const { project: before, mapId } = blank();
      const after = clone(before);
      mapOf(after, mapId).events = Array.from({ length: 12 }, (_, index) => event(`e${index}`, `NPC_${index}`, index, index));

      const ledger = buildChangeLedger(before, after, { maxEntries: 5 });

      expect(ledger.entries).toHaveLength(5);
      expect(ledger.total).toBeGreaterThan(5);
    });
  });
  describe("summarizeLedgerValue", () => {
    it("긴 본문은 잘라 한 줄로 만든다 — 명세가 카드를 삼키지 않게", () => {
      const summary = summarizeLedgerValue("가".repeat(400));
      expect(summary.length).toBeLessThanOrEqual(91);
      expect(summary.endsWith("…")).toBe(true);
    });

    it("빈 값·목록·불리언을 사람이 읽는 말로 바꾼다", () => {
      expect(summarizeLedgerValue(undefined)).toBe("없음");
      expect(summarizeLedgerValue("")).toBe("빈 값");
      expect(summarizeLedgerValue(["a", "b"])).toBe("a, b (2개)");
      expect(summarizeLedgerValue([{ a: 1 }, { b: 2 }])).toBe("2개 항목");
      expect(summarizeLedgerValue(true)).toBe("true");
    });

    it("중첩 개체는 JSON 대신 키 이름으로 — 명세에 소음을 쏟지 않는다", () => {
      expect(summarizeLedgerValue({ hp: "HP", mp: "MP" })).toBe("hp HP, mp MP (2개)");
      expect(summarizeLedgerValue({ pages: [{}, {}], commands: [] })).toBe("pages, commands … (2개 항목)");
      expect(summarizeLedgerValue({})).toBe("빈 값");
    });
  });
});

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
