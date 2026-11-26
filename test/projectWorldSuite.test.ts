import { describe, expect, it } from "vitest";
import { buildCastWriterMessages, castSheetToWorldPatch, collectPendingNpcs, parseCastSheet, type CastContext } from "@/ai/npcCast";
import { normalizeWorld } from "@/project/world/guards";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, GameEvent, Project } from "@/project/types";
import { runTool } from "@/editor/tools";
import { isActionCombatMap } from "@/project/actionCombat";
import type { WikiCombatMode } from "@/project/world";
import { projectWikiContext, resolveWikiCombatMode } from "@/ai/projectWikiContext";
import type { WorldEntity, ProjectWikiUpsert, ProjectWorld, WikiSource } from "@/project/world/types";
import { applyProjectWikiPatch, parseProjectWikiPatch, reconcileProjectWiki } from "@/project/world/wiki";
import { isolateTimers } from "./mergedTeardown";
import { deserialize, serialize } from "@/project/io";
import { ProjectFormatError } from "@/project/io/errors";
import { compactWorldCanon, EMPTY_WORLD_CANON, resolveWorldCanon, WORLD_CANON_TONES } from "@/project/world/canon";
import { normalizeWorldCanon } from "@/project/world/canonNormalize";

// 캐스트 라이터 순수 모듈 — 코드는 NPC 대사를 한 줄도 만들지 않는다.
//
// 배경(2026-09-03 사용자 지적): 마을을 생성할 때마다 주민 대사가 비슷했다. 원인은 생성 코드에 박힌
// 고정 대사(DEFAULT_NPCS 10명 · "안녕하세요." · "일하는 중이야." · "${name}입니다.")였다.
// 대사는 테마에 맞아야 하고, 주민끼리 서로를 언급해야 하고, 세계관(project.world)과 엮여야 한다.
// 그래서 대사는 모델이 쓴 **캐스트 시트**로만 들어오고, 이 모듈은 대기 NPC 수집·프롬프트·검증·적용만 맡는다.
describe("npcCast", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  function page(id: string, name: string, patch: Partial<EventPage> = {}): EventPage {
    return {
      id,
      name,
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
      ...patch,
    };
  }
  function npc(id: string, x: number, pages: EventPage[]): GameEvent {
    return { id, x, y: 5, trigger: { kind: "action" }, commands: [], pages };
  }
  /** 대사 없는 주민 둘(한 명은 상점 커맨드 보유) + 대사 있는 기존 주민 한 명. */
  function projectWithPendingNpcs(): Project {
    const project = createBlankProject();
    const map = project.maps[MAP_ID]!;
    map.events.push(
      npc("ev_a", 4, [page("ev_a_p0", "주민 1")]),
      npc("ev_b", 8, [
        page("ev_b_p0", "주민 2", {
          commands: [{ kind: "shop", itemIds: ["item_potion"], allowSell: true, quantityMode: "select", shopType: "normal", messageType: "welcome" } as never],
        }),
        page("ev_b_p1", "주민 2", { conditions: [{ kind: "npcActivity", activity: "장터 소식 나누기" }] }),
      ]),
      npc("ev_old", 12, [page("ev_old_p0", "촌장", { commands: [{ kind: "text", body: "마을에 온 걸 환영하네." }] })]),
    );
    project.world = {
      entities: [
        { id: "w_faction_river", type: "faction", name: "강물지기단", summary: "강을 지키는 길드", origin: "user" },
      ],
      relations: [],
    };
    return project;
  }
  function contextFor(project: Project): CastContext {
    const pending = collectPendingNpcs(project, null);
    return {
      mapId: MAP_ID,
      mapName: project.maps[MAP_ID]!.name,
      theme: "강가 어촌 장터",
      requestText: "강가 어촌 마을 지어줘",
      worldDigest: "[faction] 강물지기단: 강을 지키는 길드",
      worldNames: ["강물지기단"],
      worldCanon: project.worldCanon,
      existingCast: [{ name: "촌장", line: "마을에 온 걸 환영하네." }],
      residents: pending,
    };
  }
  describe("collectPendingNpcs — 대사 없는 페이지를 가진 NPC 만 고른다", () => {
    it("text 커맨드가 없는 페이지를 가진 이벤트만, 페이지 단위로 조건 라벨과 함께 낸다", () => {
      const project = projectWithPendingNpcs();
      const pending = collectPendingNpcs(project, null);
      expect(pending.map((npc) => npc.eventId).sort()).toEqual(["ev_a", "ev_b"]);
      const b = pending.find((npc) => npc.eventId === "ev_b")!;
      expect(b.pages.map((p) => p.pageId)).toEqual(["ev_b_p0", "ev_b_p1"]);
      expect(b.pages[1]!.condition).toContain("장터 소식 나누기");
      // 상점 커맨드는 대사가 아니다 — 상점 주인도 대사가 없으면 대기다.
      expect(b.hasShop).toBe(true);
    });

    it("기준선(사용자 프로젝트)에 이미 있던 이벤트는 건드리지 않는다 — 사용자의 말 없는 NPC 는 사용자 것이다", () => {
      const project = projectWithPendingNpcs();
      const baseline = structuredClone(project);
      project.maps[MAP_ID]!.events.push(npc("ev_new", 14, [page("ev_new_p0", "주민 3")]));
      const pending = collectPendingNpcs(project, baseline);
      expect(pending.map((npc) => npc.eventId)).toEqual(["ev_new"]);
    });
  });
  describe("buildCastWriterMessages — 테마·기존 주민·세계관·대기 페이지가 프롬프트에 전부 실린다", () => {
    it("system + user 두 메시지이고 user 에 주민 id·조건·세계관 다이제스트·기존 주민이 들어 있다", () => {
      const project = projectWithPendingNpcs();
      const messages = buildCastWriterMessages(contextFor(project));
      expect(messages).toHaveLength(2);
      const user = String(messages[1]!.content);
      expect(user).toContain("ev_a");
      expect(user).toContain("ev_b_p1");
      expect(user).toContain("장터 소식 나누기");
      expect(user).toContain("강물지기단");
      expect(user).toContain("촌장");
      expect(user).toContain("강가 어촌 장터");
    });
  });
  describe("parseCastSheet — 전원 대사, 상호 언급, 세계관 언급을 코드가 검증한다", () => {
    const goodSheet = {
      residents: [
        { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"],
          pages: [{ pageId: "ev_a_p0", lines: ["다래 아주머니 가게에 오늘 잡은 은어를 넘겼어요.", "강물지기단이 상류를 막아서 물고기가 줄었지요."] }] },
        { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"],
          pages: [
            { pageId: "ev_b_p0", lines: ["은호가 가져온 은어가 오늘의 특산이에요."] },
            { pageId: "ev_b_p1", lines: ["장터 소식? 촌장님이 강물지기단과 담판을 지으러 갔대요."] },
          ] },
      ],
    };

    it("정상 시트를 받아 residents 를 그대로 돌려준다", () => {
      const project = projectWithPendingNpcs();
      const parsed = parseCastSheet(JSON.stringify(goodSheet), contextFor(project));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.sheet.residents).toHaveLength(2);
      expect(parsed.sheet.residents[1]!.pages[1]!.lines[0]).toContain("촌장");
    });

    it("대기 페이지 하나라도 대사가 비면 거부한다 — 빈 페이지는 완료가 아니다", () => {
      const project = projectWithPendingNpcs();
      const sheet = structuredClone(goodSheet);
      sheet.residents[1]!.pages = [sheet.residents[1]!.pages[0]!];
      const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toContain("ev_b_p1");
    });

    it("주민이 둘 이상인데 아무도 다른 주민을 언급하지 않으면 거부한다 — 주민끼리 엮여야 한다", () => {
      const project = projectWithPendingNpcs();
      const sheet = structuredClone(goodSheet);
      sheet.residents[0]!.pages[0]!.lines = ["오늘 파도가 잔잔하군요.", "강물지기단이 상류를 막았지요."];
      sheet.residents[1]!.pages[0]!.lines = ["어서 오세요."];
      sheet.residents[1]!.pages[1]!.lines = ["장터 소식은 별로 없어요."];
      const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toMatch(/언급|엮/);
    });

    it("세계관 개체가 있는데 한 줄도 언급하지 않으면 거부한다", () => {
      const project = projectWithPendingNpcs();
      const sheet = structuredClone(goodSheet);
      sheet.residents[0]!.pages[0]!.lines = ["다래 아주머니 가게에 은어를 넘겼어요."];
      sheet.residents[1]!.pages[1]!.lines = ["장터 소식? 은호가 큰 물고기를 잡았대요."];
      const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toContain("세계관");
    });

    it("JSON 이 깨졌거나 모르는 eventId 가 오면 사유를 남기고 거부한다", () => {
      const project = projectWithPendingNpcs();
      expect(parseCastSheet("not json", contextFor(project)).ok).toBe(false);
      const sheet = structuredClone(goodSheet);
      sheet.residents[0]!.eventId = "ev_ghost";
      const parsed = parseCastSheet(JSON.stringify(sheet), contextFor(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toContain("ev_ghost");
    });
  });
  describe("castSheetToWorldPatch — 주민은 세계관 개체가 되고 서로 knows 로 엮인다", () => {
    it("맵 place 개체 + 주민 character 개체 + locatedIn/knows 관계를 내고 normalizeWorld 를 통과한다", () => {
      const project = projectWithPendingNpcs();
      const parsed = parseCastSheet(
        JSON.stringify({
          residents: [
            { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"], pages: [{ pageId: "ev_a_p0", lines: ["다래 가게에 은어를 넘겼어요. 강물지기단 얘기 들었어요?"] }] },
            { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"], pages: [{ pageId: "ev_b_p0", lines: ["은호가 잡은 은어예요."] }, { pageId: "ev_b_p1", lines: ["은호 소식이 궁금해요."] }] },
          ],
        }),
        contextFor(project),
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const world = castSheetToWorldPatch(project, MAP_ID, parsed.sheet);
      const normalized = normalizeWorld(world);
      const characters = normalized.entities.filter((entity) => entity.type === "character");
      expect(characters.map((entity) => entity.name).sort()).toEqual(["다래", "은호"]);
      expect(characters.every((entity) => entity.origin === "ai")).toBe(true);
      expect(characters.every((entity) => entity.refs?.some((ref) => ref.kind === "event"))).toBe(true);
      const place = normalized.entities.find((entity) => entity.type === "place" && entity.refs?.some((ref) => ref.kind === "map" && ref.id === MAP_ID));
      expect(place).toBeTruthy();
      expect(normalized.relations.filter((relation) => relation.kind === "knows")).toHaveLength(1); // 양방향은 한 쌍으로 접는다
      expect(normalized.relations.filter((relation) => relation.kind === "locatedIn")).toHaveLength(2);
      // 기존 사용자 개체는 그대로 남는다.
      expect(normalized.entities.some((entity) => entity.id === "w_faction_river")).toBe(true);
    });
  });
  describe("worldCanon 강제 — 캐논 주입과 금지어 검증", () => {
    function canonContext(project: Project): CastContext {
      return {
        ...contextFor(project),
        worldCanon: { name: "화약 없는 왕국", absences: ["총", "화약"] },
      };
    }

    it("캐논이 있으면 프롬프트에 캐논 블록과 금지 목록이 실린다", () => {
      const project = projectWithPendingNpcs();
      const messages = buildCastWriterMessages(canonContext(project));
      expect(String(messages[1]!.content)).toContain("## 이 세계(세계관 고정)");
      expect(String(messages[1]!.content)).toContain("총");
      expect(String(messages[0]!.content)).toContain("없는 것");
    });

    it("캐논이 없으면 캐논 블록 없이 기존처럼 동작한다", () => {
      const project = projectWithPendingNpcs();
      const messages = buildCastWriterMessages(contextFor(project));
      expect(String(messages[1]!.content)).not.toContain("## 이 세계(세계관 고정)");
    });

    it("두 번째 줄·합성어 속 금지어도 잡고, secret 캐논에도 강제한다", () => {
      const project = projectWithPendingNpcs();
      const lines = ["오늘 날씨가 좋군요.", "화약고 문을 열어라.", "강물지기단 얘기예요."];
      const sheet = {
        residents: [
          { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"],
            pages: [{ pageId: "ev_a_p0", lines }] },
          { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"],
            pages: [
              { pageId: "ev_b_p0", lines: ["은호가 가져온 은어가 오늘의 특산이에요."] },
              { pageId: "ev_b_p1", lines: ["장터 소식? 은호가 큰 물고기를 잡았대요."] },
            ] },
        ],
      };
      const parsed = parseCastSheet(JSON.stringify(sheet), canonContext(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toContain("화약");
      const secret = parseCastSheet(JSON.stringify(sheet), { ...canonContext(project), worldCanon: { name: "비밀 왕국", status: "secret", absences: ["화약"] } });
      expect(secret.ok).toBe(false);
    });

    it("금지어를 쓴 대사는 재킥 사유로 거부한다", () => {
      const project = projectWithPendingNpcs();
      const sheet = {
        residents: [
          { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"],
            pages: [{ pageId: "ev_a_p0", lines: ["다래 가게에 총을 팔러 갔어요. 강물지기단 얘기 들었어요?"] }] },
          { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"],
            pages: [
              { pageId: "ev_b_p0", lines: ["은호가 가져온 은어가 오늘의 특산이에요."] },
              { pageId: "ev_b_p1", lines: ["장터 소식? 은호가 큰 물고기를 잡았대요."] },
            ] },
        ],
      };
      const parsed = parseCastSheet(JSON.stringify(sheet), canonContext(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toContain("총");
    });

    it("주민 이름에 금지어가 있으면 대사가 깨끗해도 거부한다", () => {
      const project = projectWithPendingNpcs();
      const sheet = {
        residents: [
          { eventId: "ev_a", name: "총잡이", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"],
            pages: [{ pageId: "ev_a_p0", lines: ["다래 가게에 은어를 넘겼어요. 강물지기단 얘기 들었어요?"] }] },
          { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"],
            pages: [
              { pageId: "ev_b_p0", lines: ["오늘 잡은 은어가 특산이에요."] },
              { pageId: "ev_b_p1", lines: ["장터 소식? 큰 물고기를 잡았대요."] },
            ] },
        ],
      };
      const parsed = parseCastSheet(JSON.stringify(sheet), canonContext(project));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.issues.join("\n")).toContain("총");
    });

    it("금지어 없는 정상 시트는 캐논 아래에서도 통과한다", () => {
      const project = projectWithPendingNpcs();
      const sheet = {
        residents: [
          { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"],
            pages: [{ pageId: "ev_a_p0", lines: ["다래 아주머니 가게에 오늘 잡은 은어를 넘겼어요.", "강물지기단이 상류를 막아서 물고기가 줄었지요."] }] },
          { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_a"],
            pages: [
              { pageId: "ev_b_p0", lines: ["은호가 가져온 은어가 오늘의 특산이에요."] },
              { pageId: "ev_b_p1", lines: ["장터 소식? 촌장님이 강물지기단과 담판을 지으러 갔대요."] },
            ] },
        ],
      };
      const parsed = parseCastSheet(JSON.stringify(sheet), canonContext(project));
      expect(parsed.ok).toBe(true);
    });
  });
});

describe("projectWikiPatch", () => {
  isolateTimers();
  describe("projectWikiCombat", () => {
    isolateTimers();
    describe("wiki decisions constrain actual monster authoring", () => {
      it("rejects unresolved graphic queries instead of creating an invisible field monster", () => {
        const project = createBlankProject();
        const ctx = { project };

        const result = runTool(ctx, "make_hunting_ground", {
          mapId: project.startMapId, troopId: "troop_slime",
          area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1,
          graphic: { query: "monster", characterIndex: 0 },
        });

        expect(result.ok).toBe(false);
        expect(ctx.project.maps[project.startMapId]?.fieldSpawns ?? []).toEqual([]);
      });
      it("uses visible contact battles for an existing JRPG without an explicit override", () => {
        const project = createBlankProject();
        project.system.genre = "adventure-jrpg";
        const ctx = { project };

        const result = runTool(ctx, "make_hunting_ground", {
          mapId: project.startMapId, troopId: "troop_slime",
          area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1,
        });

        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.maps[project.startMapId]?.encounterRate).toBe(0);
        expect(ctx.project.maps[project.startMapId]?.fieldSpawns).toHaveLength(1);
      });
      for (const mode of ["contact", "action"] satisfies WikiCombatMode[]) {
        it(`creates ${mode} field combat without random encounters`, () => {
          const project = createBlankProject();
          project.world = { entities: [{
            id: "w_combat", type: "guideline", name: "Combat", summary: mode, origin: "ai",
            wiki: { kind: "declaration", basis: "explicit", combatMode: mode,
              sources: [{ id: "turn-1", kind: "user", text: mode, at: 1 }] },
          }], relations: [] };
          const ctx = { project };

          const result = runTool(ctx, "make_hunting_ground", {
            mapId: project.startMapId, troopId: "troop_slime",
            area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1, chase: false,
          });

          expect(result.ok, result.summary).toBe(true);
          const map = ctx.project.maps[project.startMapId];
          expect(map?.fieldSpawns).toHaveLength(1);
          expect(map?.encounterRate).toBe(0);
          expect(map?.encounterTable ?? []).toEqual([]);
          expect(isActionCombatMap(ctx.project, map)).toBe(mode === "action");
        });
      }

      it("reads full selected document content rather than only its opening excerpt", () => {
        const project = createBlankProject();
        const body = `${"Earlier notes. ".repeat(100)}\nSecret door: tile 37.`;
        project.world = { entities: [{
          id: "w_location", type: "place", name: "Location", summary: "Door details", body, origin: "user",
        }], relations: [] };

        const result = runTool({ project }, "read_project_wiki", { ids: ["w_location"] });

        expect(result.ok, result.summary).toBe(true);
        expect(result.data).toMatchObject({ documents: [{ id: "w_location", body }] });
      });
    });
  });
  describe("projectWikiContext", () => {
    isolateTimers();
    function doc(id: string, overrides: Partial<WorldEntity> = {}): WorldEntity {
      return { id, type: "guideline", name: "Battles", summary: "Contact battles", origin: "ai", wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "s-" + id, kind: "user", text: "Contact battles", at: 1 }], combatMode: "contact" }, ...overrides };
    }
    describe("bounded wiki retrieval", () => {
      it("keeps explicit project decisions and excludes matching work history", () => {
        const project = createBlankProject();
        project.world = { entities: [
          doc("w_core"),
          ...Array.from({ length: 12 }, (_, i) => doc(`w_progress_${i}`, {
            name: "monster placement", summary: "monster",
            wiki: { kind: "progress", basis: "observed",
              sources: [{ id: `a${i}`, kind: "application", text: "Applied", at: i + 2 }] },
          })),
        ], relations: [] };

        const result = projectWikiContext(project, { query: "monster placement" });

        expect(result.selectedIds[0]).toBe("w_core");
        expect(result.selectedIds).toEqual(["w_core"]);
      });
      it("selects relevant lore without combat keywords and excludes unrelated maps", () => {
        const project = createBlankProject();
        project.world = { entities: [doc("w_moon", { name: "Glass moon", summary: "The moon is glass", wiki: { kind: "knowledge", basis: "explicit", sources: [{ id: "moon", kind: "user", text: "Glass moon", at: 1 }] } }), doc("w_other", { refs: [{ kind: "map", id: "other-map" }] })], relations: [] };
        const result = projectWikiContext(project, { query: "moon", mapId: project.startMapId });
        expect(result.selectedIds).toEqual(["w_moon"]);
      });
      it("bounds output and selected document count even for huge documents", () => {
        const project = createBlankProject();
        project.world = { entities: Array.from({ length: 100 }, (_, i) => doc(`w_${i}`, { body: "x".repeat(20_000), summary: "battle".repeat(4_000) })), relations: [] };
        const result = projectWikiContext(project, { query: "battle" });
        expect(result.text.length).toBeLessThanOrEqual(6000);
        expect(result.selectedIds.length).toBeLessThanOrEqual(8);
        expect(result.selectedIds.length).toBeGreaterThan(0);
      });
      it("omits superseded history from retrieval", () => {
        const project = createBlankProject();
        project.world = { entities: [doc("w_old"), doc("w_new", { wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "Action now", at: 2 }], combatMode: "action", supersedes: ["w_old"] } })], relations: [] };
        const result = projectWikiContext(project, { query: "battles" });
        expect(result.selectedIds).toEqual(["w_new"]);
      });
      it("returns no entries for an unrelated query rather than arbitrary knowledge", () => {
        const project = createBlankProject();
        project.world = { entities: [doc("w_moon", { name: "Moon", summary: "Silver", wiki: { kind: "knowledge", basis: "explicit", sources: [{ id: "moon", kind: "user", text: "Silver moon", at: 1 }] } })], relations: [] };
        expect(projectWikiContext(project, { query: "fishing" })).toEqual({ text: "", selectedIds: [] });
      });
    });
    describe("wiki combat route", () => {
      it("prefers a map explicit decision over the global explicit decision", () => {
        const project = createBlankProject();
        project.world = { entities: [doc("w_global"), doc("w_local", { refs: [{ kind: "map", id: project.startMapId }], wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "local", kind: "user", text: "Random battles here", at: 2 }], combatMode: "random" } })], relations: [] };
        expect(resolveWikiCombatMode(project, project.startMapId)).toEqual({ mode: "random", sourceId: "local" });
        expect(resolveWikiCombatMode(project, "other")).toEqual({ mode: "contact", sourceId: "s-w_global" });
      });
      it("does not promote inferred JRPG defaults to an explicit machine route", () => {
        const project = createBlankProject();
        project.world = { entities: [doc("w_guess", { wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "jrpg", kind: "user", text: "Make a JRPG", at: 1 }], combatMode: "contact" } })], relations: [] };
        expect(resolveWikiCombatMode(project)).toBeUndefined();
      });
      it("keeps an explicit decision ahead of a newer inferred default", () => {
        const project = createBlankProject();
        project.world = { entities: [doc("w_explicit"), doc("w_guess", { wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "guess", kind: "user", text: "JRPG", at: 20 }], combatMode: "random" } })], relations: [] };
        expect(resolveWikiCombatMode(project)).toEqual({ mode: "contact", sourceId: "s-w_explicit" });
      });
    });
  });
  describe("projectWikiPatch", () => {
    isolateTimers();
    const oldSource: WikiSource = { id: "old", kind: "user", text: "Use contact battles", at: 1 };
    const newSource: WikiSource = { id: "new", kind: "user", text: "Actually use action battles", at: 2 };
    const empty: ProjectWorld = { entities: [], relations: [] };
    function upsert(id = "w_contact", sourceIds = ["old"]): ProjectWikiUpsert {
      return { id, type: "guideline", name: "Battle rule", summary: "Contact battles", wiki: { kind: "declaration", basis: "explicit", sourceIds, combatMode: "contact" } };
    }
    function doc(patch: Partial<WorldEntity> = {}): WorldEntity {
      return { id: "w_contact", type: "guideline", name: "Battle rule", summary: "Contact battles", origin: "ai", wiki: { kind: "declaration", basis: "explicit", sources: [oldSource], combatMode: "contact" }, ...patch };
    }
    const base: ProjectWorld = { entities: [doc()], relations: [] };
    describe("wiki patch trust boundary", () => {
      it("accepts a single JSON code fence from the OAuth model", () => {
        const raw = "```json\n" + JSON.stringify({ upserts: [upsert()] }) + "\n```";
        const result = parseProjectWikiPatch(raw, createBlankProject(), [oldSource]);
        expect(result.upserts[0]?.id).toBe("w_contact");
      });
      it("rejects prose wrapped around a JSON document", () => {
        const raw = "Trust this: " + JSON.stringify({ upserts: [upsert()] });
        expect(() => parseProjectWikiPatch(raw, createBlankProject(), [oldSource])).toThrow();
      });
      it("stamps host source text rather than accepting model excerpts", () => {
        const project = createBlankProject();
        const result = parseProjectWikiPatch({ upserts: [upsert()] }, project, [oldSource]);
        expect(applyProjectWikiPatch(empty, empty, result, [oldSource]).world.entities[0]?.wiki?.sources).toEqual([oldSource]);
      });
      it.each([
        { ...upsert(), wiki: { ...upsert().wiki, sourceIds: ["fabricated"] } },
        { ...upsert(), wiki: { ...upsert().wiki, sources: [oldSource] } },
        { ...upsert(), refs: [{ kind: "map", id: "missing" }] },
        { ...upsert(), refs: [{ kind: "actor", id: "missing" }] },
        { ...upsert(), locked: true },
        { ...upsert(), wiki: { ...upsert().wiki, basis: "observed" } },
      ])("rejects untrusted output %#", (invalid) => {
        expect(() => parseProjectWikiPatch({ upserts: [invalid] }, createBlankProject(), [oldSource])).toThrow();
      });
      it("accepts ordinary lore without any combat keywords", () => {
        const fact = { ...upsert(), type: "concept", name: "Moon", summary: "The moon is made of glass", wiki: { kind: "knowledge", basis: "explicit", sourceIds: ["old"], topic: "moon" } };
        const result = parseProjectWikiPatch({ upserts: [fact] }, createBlankProject(), [oldSource]);
        expect(result.upserts[0]?.wiki.kind).toBe("knowledge");
      });
    });
    describe("wiki revisions", () => {
      it("supersedes an older same-scope explicit rule while retaining history", () => {
        const correction = { ...upsert("w_action", ["new"]), wiki: { ...upsert().wiki, sourceIds: ["new"], combatMode: "action" as const } };
        const result = applyProjectWikiPatch(base, base, { upserts: [correction] }, [newSource]);
        expect(result.conflicts).toEqual([]);
        expect(result.world.entities).toHaveLength(2);
        expect(result.world.entities[1]?.wiki?.supersedes).toEqual(["w_contact"]);
        expect(result.world.entities[0]).toEqual(doc());
      });
      it("ignores source replay even when the model invents a different document id", () => {
        const result = applyProjectWikiPatch(base, base, { upserts: [upsert("w_duplicate")] }, [oldSource]);
        expect(result).toEqual({ world: base, changed: false, conflicts: [] });
      });
      it("does not let old history reverse a newer decision", () => {
        const newer: ProjectWorld = { entities: [doc({ wiki: { ...doc().wiki, kind: "declaration", basis: "explicit", sources: [newSource], combatMode: "action" } })], relations: [] };
        const result = applyProjectWikiPatch(newer, newer, { upserts: [upsert("w_stale")] }, [oldSource]);
        expect(result.changed).toBe(false);
        expect(result.conflicts).toContainEqual({ id: "w_stale", reason: "stale" });
      });
      it("does not let inferred rules supersede explicit rules", () => {
        const inferred = { ...upsert("w_guess", ["new"]), wiki: { ...upsert().wiki, sourceIds: ["new"], basis: "inferred" as const, supersedes: ["w_contact"] } };
        const result = applyProjectWikiPatch(base, base, { upserts: [inferred] }, [newSource]);
        expect(result.changed).toBe(false);
        expect(result.conflicts[0]?.reason).toBe("invalid-supersession");
      });
      it.each([
        doc({ locked: true }),
        doc({ origin: "user" }),
        doc({ wiki: { kind: "declaration", basis: "explicit", sources: [{ ...oldSource, kind: "manual" }], combatMode: "contact" } }),
      ])("preserves protected documents %#", (protectedDoc) => {
        const world: ProjectWorld = { entities: [protectedDoc], relations: [] };
        const result = applyProjectWikiPatch(world, world, { upserts: [upsert("w_contact", ["new"])] }, [newSource]);
        expect(result.world).toEqual(world);
        expect(result.conflicts[0]?.reason).toBe("protected");
      });
      it("keeps map scopes separate", () => {
        const scoped = { ...upsert("w_map", ["new"]), refs: [{ kind: "map" as const, id: "map-other" }] };
        const result = applyProjectWikiPatch(base, base, { upserts: [scoped] }, [newSource]);
        expect(result.world.entities[1]?.wiki?.supersedes ?? []).toEqual([]);
      });
      it("preserves unrelated live entities and relations during reconciliation", () => {
        const unrelated = doc({ id: "w_elsewhere", name: "Unrelated", wiki: undefined });
        const live: ProjectWorld = { entities: [...base.entities, unrelated], relations: [{ a: "w_contact", b: "w_elsewhere", kind: "custom" }] };
        const proposed: ProjectWorld = { ...base, entities: [doc({ summary: "Updated" })] };
        const result = reconcileProjectWiki(base, proposed, live);
        expect(result.world.entities).toEqual([doc({ summary: "Updated" }), unrelated]);
        expect(result.world.relations).toEqual(live.relations);
      });
      it("rejects same-document concurrent edits atomically", () => {
        const proposed: ProjectWorld = { ...base, entities: [doc({ summary: "AI update" })] };
        const live: ProjectWorld = { ...base, entities: [doc({ summary: "Manual update" })] };
        const result = reconcileProjectWiki(base, proposed, live);
        expect(result).toEqual({ world: live, changed: false, conflicts: [{ id: "w_contact", reason: "concurrent-edit" }] });
      });
      it("rejects stale extraction when its supersession target changed concurrently", () => {
        const live: ProjectWorld = { ...base, entities: [doc({ summary: "Manual update" })] };
        const result = applyProjectWikiPatch(live, base, { upserts: [upsert("w_new", ["new"])] }, [newSource]);
        expect(result.world).toEqual(live);
        expect(result.conflicts[0]?.reason).toBe("concurrent-edit");
      });
    });
  });
});

describe("worldCanon", () => {
  isolateTimers();
  describe("worldCanon", () => {
    it("migrates legacy secret status into independent visibility", () => {
      expect(normalizeWorldCanon({ name: "해안", status: "secret" })).toEqual({
        name: "해안", visibility: "secret",
      });
    });

    it("round-trips a confirmed secret without losing either axis", () => {
      const project = createBlankProject();
      project.worldCanon = normalizeWorldCanon({ name: "해안", status: "canon", visibility: "secret" });
      expect(deserialize(serialize(project)).worldCanon).toEqual({
        name: "해안", status: "canon", visibility: "secret",
      });
    });

    it("resolves a missing canon to empty defaults", () => {
      const resolved = resolveWorldCanon(undefined);
      expect(resolved).toEqual(EMPTY_WORLD_CANON);
      expect(compactWorldCanon(resolved)).toBeUndefined();
    });

    it("omits a fully empty object so old saves stay sparse", () => {
      expect(normalizeWorldCanon({})).toBeUndefined();
    });

    it("keeps authored name, premise, body, tones, and absences", () => {
      const canon = normalizeWorldCanon({
        name: " 서녘 공화국 ",
        premise: "마법은 피의 대가다.",
        tones: ["grim", "political", "grim", "nope"],
        absences: [" 총 ", "", "엘프", "총"],
        body: "왕위는 비어 있다.",
        extra: "drop",
      });
      expect(canon).toEqual({
        name: "서녘 공화국",
        premise: "마법은 피의 대가다.",
        tones: ["grim", "political"],
        absences: ["총", "엘프"],
        body: "왕위는 비어 있다.",
      });
    });

    it("round-trips through serialize/deserialize on a real project", () => {
      const project = createBlankProject();
      project.worldCanon = {
        name: "안개 해안",
        tones: ["gothic"],
        absences: ["총"],
        status: "canon",
        laws: { power: { present: true, note: "피의 대가" } },
      };
      const loaded = deserialize(serialize(project));
      expect(loaded.worldCanon).toEqual({
        name: "안개 해안",
        tones: ["gothic"],
        absences: ["총"],
        status: "canon",
        laws: { power: { present: true, note: "피의 대가" } },
      });
    });

    it("rejects a non-object canon at the project boundary", () => {
      expect(() => normalizeWorldCanon("서녘")).toThrow(ProjectFormatError);
    });

    it("exposes a closed tone list the editor can chip", () => {
      expect(WORLD_CANON_TONES).toContain("grim");
      expect(WORLD_CANON_TONES).toContain("slice");
    });
  });
});
