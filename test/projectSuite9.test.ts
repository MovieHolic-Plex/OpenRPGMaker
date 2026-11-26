import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { mapTexture } from "@/project/mapTexture";
import { type GameMap, type Project, SCHEMA_VERSION } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { adjustEffectiveFactionStance, applyPlayerKillReputation, effectiveFactionStance, factionStancePairKey, parseFactionStanceOverrides, setEffectiveFactionStance } from "@/project/factionRuntime";
import { factionStance, PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";
import { advanceFarmAnimalProduction, feedFarmAnimal, petFarmAnimal, assignFarmAnimalToBuilding } from "@/project/farmAnimals";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { animalProject, feedItemId, replaceAnimal } from "./fixtures/p1FarmAnimals";
import { isolateTimers } from "./mergedTeardown";

describe("examineHotspotVisibility", () => {
  isolateTimers();
  describe("place_examine_hotspots 보이지 않는 조사 지점", () => {
    it("그림 생략·투명 명시 모두 대체 그림 없이 투명으로 두고 빈 바닥 경고", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const res = runTool(ctx, "place_examine_hotspots", {
        mapId,
        hotspots: [
          { at: { x: 3, y: 3 }, name: "메멘토: 낡은 턴테이블", lines: ["바늘이 멈춰 있다."] },
          { at: { x: 4, y: 3 }, name: "숨은 쪽지", lines: ["글씨"], graphic: { transparent: true } },
          { at: { x: 5, y: 3 }, name: "보물 상자", lines: ["비어 있다."], graphic: { query: "보물 상자" } },
        ],
      });
      expect(res.ok, res.summary).toBe(true);
      expect(res.summary).toContain("2개는 빈 바닥 위 투명");
      const notes = JSON.stringify(res.warnings ?? res.diff);
      expect(notes).not.toContain("보석 표식");
      expect(notes).toContain("메멘토: 낡은 턴테이블");
      expect(notes).toContain("숨은 쪽지");
      expect(notes).not.toContain("보물 상자,");
      const turntable = ctx.project.maps[mapId]!.events.find((event) => event.pages?.[0]?.name === "메멘토: 낡은 턴테이블");
      expect(turntable?.pages?.[0]?.graphic).toEqual({ transparent: true });
    });
  });
  /** 지배 바닥이면서 통행 가능·비어 있는 칸 — 게임 검사 dream-invisible-objects 와 같은 기준. */
  function barePassableCell(project: Project, taken: ReadonlySet<string>): { x: number; y: number } {
    const map = project.maps[project.startMapId]!;
    const texture = mapTexture(map);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x;
        if (map.lowerTiles[index] === texture.dominantTile && !(map.upperTiles[index] > 0)
          && isPassable(project, map, x, y) && !taken.has(`${x},${y}`)) return { x, y };
      }
    }
    throw new Error("빈 판 통행 가능 칸을 찾지 못했습니다");
  }
  function occupy(map: GameMap, at: { x: number; y: number }): ReadonlySet<string> {
    return new Set([...map.events.map((event) => `${event.x},${event.y}`), `${at.x},${at.y}`]);
  }
  describe("upsert_event 맨바닥 조사 사물", () => {
    it("이름에 맞는 그림이 없는 조사 사물(제단)은 보석 등 대체 그림 없이 투명 + 경고", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const at = barePassableCell(ctx.project, new Set(ctx.project.maps[mapId]!.events.map((event) => `${event.x},${event.y}`)));
      const res = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_truth_altar", name: "고대 진실의 제단", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [{ kind: "text", body: "제단에 글씨가 새겨져 있다." }] },
      });
      expect(res.ok, res.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_truth_altar");
      expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
      expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
      expect(event?.pages?.[0]?.priority).toBe("below");
      const notes = (res.diff?.warnings ?? []).join(" ");
      expect(notes).toContain("보이지 않습니다");
      expect(notes).not.toContain("보석 표식");
    });

    it("명시 graphic:{transparent:true} 는 의도로 받아 투명 그대로", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const at = barePassableCell(ctx.project, new Set(ctx.project.maps[mapId]!.events.map((event) => `${event.x},${event.y}`)));
      const res = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_invisible_note", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [{ conditions: [], graphic: { transparent: true }, commands: [{ kind: "text", body: "보이지 않는 기록." }] }],
        },
      });
      expect(res.ok, res.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_invisible_note");
      expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
      expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
    });

    it("그 칸에 위층 장식이 있으면(사물 타일이 그림) 투명으로 남고 경고만 한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const map = ctx.project.maps[mapId]!;
      const taken = new Set(map.events.map((event) => `${event.x},${event.y}`));
      const at = barePassableCell(ctx.project, taken);
      // 위층 칸 하나를 골라 통행성까지 유지하는 장식 타일을 찾는다(통행을 깨면 이벤트가 다른 칸으로 옮겨 간다).
      const index = at.y * map.width + at.x;
      const original = map.upperTiles[index]!;
      let decor = original;
      for (let tile = 1; tile < 600; tile++) {
        if (tile === original) continue;
        map.upperTiles[index] = tile;
        if (isPassable(ctx.project, map, at.x, at.y)) { decor = tile; break; }
      }
      expect(decor).not.toBe(original);
      const res = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_tiled_statue", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [{ kind: "text", body: "타일 위 석상." }] },
      });
      expect(res.ok, res.summary).toBe(true);
      // runTool 은 ctx.project 를 새 객체로 바꾼다 — 이전에 들고 있던 지도로는 결과가 안 보인다(핸드오프 함정).
      const stored = ctx.project.maps[mapId]!;
      const event = stored.events.find((entry) => entry.id === "ev_tiled_statue");
      expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
      expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
      expect((res.diff?.warnings ?? []).join(" ")).toContain("보이지 않습니다");
      expect((res.diff?.warnings ?? []).join(" ")).not.toContain("보석 표식");
    });
  });
});

// test/facesetMigration.test.ts
// v3 → v4 얼굴 마이그레이션. 저장된 (시트 리소스 id, faceIndex) 짝이 낱장 얼굴 id 하나로
// 바뀌는지, 그리고 faceIndex 키가 프로젝트 어디에도 남지 않는지 검증한다.
//
// 왜 이 테스트가 필요한가: 인덱스가 생략된 저장본은 "0번 칸"을 뜻한다. 마이그레이션이
// 생략을 못 읽으면 주인공 얼굴이 조용히 빈 그림이 된다(recon-data-model.md §7-3).
describe("facesetMigration", () => {
  isolateTimers();
  type Json = Record<string, unknown>;
  function legacyChangeFace(faceIndex: number): Json {
    return {
      kind: "changeFace",
      resourceId: "easyrpg-faceset-actor1",
      faceIndex,
      position: "left",
      flipHorizontally: false,
    };
  }
  function legacyV3Payload(): Json {
    const raw = JSON.parse(serialize(createBlankProject())) as Json;
    raw.version = 3;

    const database = raw.database as { actors: Json[]; troops: Json[] };
    const actors = database.actors;
    expect(actors.length).toBeGreaterThanOrEqual(3);
    actors[0]!.faceResourceId = "easyrpg-faceset-actor1";
    actors[0]!.faceIndex = 7;
    actors[1]!.faceResourceId = "easyrpg-faceset-actor1";
    delete actors[1]!.faceIndex;
    actors[2]!.faceResourceId = "easyrpg-faceset-actor1";
    actors[2]!.faceIndex = 99;

    const mapId = raw.startMapId as string;
    const maps = raw.maps as Record<string, { events: Json[] }>;
    maps[mapId]!.events = [
      {
        id: "ev_face",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "ev_face_page_1",
            name: "Page 1",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              legacyChangeFace(15),
              {
                kind: "choices",
                prompt: "누구 얼굴?",
                options: [{ text: "주인공", branch: [legacyChangeFace(15)] }],
              },
              {
                kind: "m2Command",
                commandId: "m2-025-change-actor-faceset",
                fields: { target: "actor_hero", value: "easyrpg-faceset-people1", faceIndex: 3 },
              },
              // 칸 번호가 기본값 0 이라 짧게 직렬화된 생기본 — faceIndex 키가 아예 없다.
              {
                kind: "m2Command",
                commandId: "m2-025-change-actor-faceset",
                fields: { target: "actor_hero", value: "easyrpg-faceset-people1" },
              },
              // 얼굴과 믴상관없는 m2 명령은 건드리지 않는다.
              {
                kind: "m2Command",
                commandId: "m2-024-change-actor-graphic",
                fields: { target: "actor_hero", value: "easyrpg-charset-actor1" },
              },
            ],
          },
        ],
      },
    ];

    (raw.commonEvents as Json[]).push({
      id: "ce_face",
      name: "얼굴 공통",
      trigger: "parallel",
      commands: [legacyChangeFace(15)],
    });

    database.troops[0]!.battleEventPages = [
      {
        id: "bp_face",
        name: "전투 얼굴",
        conditions: [],
        span: "battle",
        commands: [legacyChangeFace(15)],
      },
    ];

    const session = raw.session as Json;
    session.actorFaceResourceIds = { actor_hero: "easyrpg-faceset-people1" };
    session.actorFaceIndices = { actor_hero: 4 };

    return raw;
  }
  function keyPaths(value: unknown, key: string, path = "$"): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((entry, index) => keyPaths(entry, key, `${path}[${index}]`));
    }
    if (value === null || typeof value !== "object") return [];
    const found: string[] = [];
    for (const [name, child] of Object.entries(value as Json)) {
      if (name === key) found.push(`${path}.${name}`);
      found.push(...keyPaths(child, key, `${path}.${name}`));
    }
    return found;
  }
  describe("v3 → v4 faceset migration", () => {
    it("rewrites actor (sheet, faceIndex) pairs into per-face resource ids", () => {
      const project = deserialize(JSON.stringify(legacyV3Payload()));

      expect(project.version).toBe(SCHEMA_VERSION);
      expect(SCHEMA_VERSION).toBe(4);
      expect(project.database.actors[0]!.faceResourceId).toBe("easyrpg-faceset-actor1-07");
      // 인덱스가 없는 저장본은 0번 칸이다 — 빈 얼굴이 아니다.
      expect(project.database.actors[1]!.faceResourceId).toBe("easyrpg-faceset-actor1-00");
      // 범위를 넘는 값은 마지막 칸으로 고정한다(과거 normalizeOptionalSheetIndex 와 같은 클램프).
      expect(project.database.actors[2]!.faceResourceId).toBe("easyrpg-faceset-actor1-15");
    });

    it("rewrites changeFace commands on pages, nested branches, common events, battle events", () => {
      const project = deserialize(JSON.stringify(legacyV3Payload()));
      const page = project.maps[project.startMapId]!.events[0]!.pages![0]!;

      const face = page.commands[0]!;
      expect(face.kind).toBe("changeFace");
      if (face.kind !== "changeFace") throw new Error("expected changeFace");
      expect(face.resourceId).toBe("easyrpg-faceset-actor1-15");

      const choices = page.commands[1]!;
      if (choices.kind !== "choices") throw new Error("expected choices");
      const nested = choices.options[0]!.branch[0]!;
      if (nested.kind !== "changeFace") throw new Error("expected nested changeFace");
      expect(nested.resourceId).toBe("easyrpg-faceset-actor1-15");

      const common = project.commonEvents.find((entry) => entry.id === "ce_face")!.commands[0]!;
      if (common.kind !== "changeFace") throw new Error("expected common changeFace");
      expect(common.resourceId).toBe("easyrpg-faceset-actor1-15");

      const battle = project.database.troops[0]!.battleEventPages[0]!.commands[0]!;
      if (battle.kind !== "changeFace") throw new Error("expected battle changeFace");
      expect(battle.resourceId).toBe("easyrpg-faceset-actor1-15");
    });

    it("rewrites m2 change-actor-faceset fields and session override maps", () => {
      const project = deserialize(JSON.stringify(legacyV3Payload()));
      const page = project.maps[project.startMapId]!.events[0]!.pages![0]!;
      const m2 = page.commands[2]!;
      if (m2.kind !== "m2Command") throw new Error("expected m2Command");
      expect(m2.fields.value).toBe("easyrpg-faceset-people1-03");
      expect(m2.fields.faceIndex).toBeUndefined();

      // faceIndex 키가 없는 생기본도 0번 칸이다. 안 옮기면 48px 얼굴 자리에 192x192 시트가 통짜로 그려진다
      // — 시트 id 는 여전히 등록되어 있어서 검사도 이걸 말리지 않는다.
      const m2NoIndex = page.commands[3]!;
      if (m2NoIndex.kind !== "m2Command") throw new Error("expected m2Command");
      expect(m2NoIndex.fields.value).toBe("easyrpg-faceset-people1-00");
      expect(m2NoIndex.fields.faceIndex).toBeUndefined();

      // 얼굴 시트가 아닌 id 는 faceIdForSheetCell 이 그대로 되돌린다(무조건 재작성 없음).
      const m2Other = page.commands[4]!;
      if (m2Other.kind !== "m2Command") throw new Error("expected m2Command");
      expect(m2Other.fields.value).toBe("easyrpg-charset-actor1");

      const session = project.session as unknown as {
        actorFaceResourceIds?: Record<string, string>;
        actorFaceIndices?: Record<string, number>;
      };
      expect(session.actorFaceResourceIds?.actor_hero).toBe("easyrpg-faceset-people1-04");
      expect(session.actorFaceIndices).toBeUndefined();
    });

    it("leaves no faceIndex key anywhere in the migrated project", () => {
      const project = deserialize(JSON.stringify(legacyV3Payload()));
      const paths = keyPaths(JSON.parse(serialize(project)), "faceIndex");
      expect(paths, paths.join("\n")).toEqual([]);
    });

    it("is idempotent — per-face ids survive a second load unchanged", () => {
      const once = deserialize(JSON.stringify(legacyV3Payload()));
      const twice = deserialize(serialize(once));
      expect(serialize(twice)).toBe(serialize(once));
      expect(twice.database.actors[0]!.faceResourceId).toBe("easyrpg-faceset-actor1-07");
    });
  });
});

// 프로젝트에 이미 저장된 업로드 얼굴 시트(4x4) + actor faceIndex 조합이
// 낱장 16개 자산 + 낱장 참조로 옮겨지는지 검사한다. 내장 시트가 아닌 경로다.
describe("facesetUploadedSheetMigration", () => {
  isolateTimers();
  type Json = Record<string, unknown>;
  const SHEET_ID = "faceset_img_user01";
  const PIXEL = "data:image/png;base64,iVBORw0KGgo=";
  function v3WithUploadedSheet(): Json {
    const raw = JSON.parse(serialize(createBlankProject())) as Json;
    raw.version = 3;
    const assets = raw.assets as { uploaded: Record<string, Json> };
    assets.uploaded[SHEET_ID] = {
      id: SHEET_ID,
      name: "내 얼굴 시트",
      kind: "faceset",
      dataUrl: PIXEL,
      meta: { tileSize: 48, frames: 16, frameWidth: 48, frameHeight: 48, width: 192, height: 192 },
    };
    const profiles = raw.resourceProfiles as Json[];
    profiles.push({ kind: "faceset", name: "내 얼굴 시트", imageWidth: 192, imageHeight: 192, assetId: SHEET_ID });
    const database = raw.database as { actors: Json[] };
    database.actors[0]!.faceResourceId = SHEET_ID;
    database.actors[0]!.faceIndex = 7;
    return raw;
  }
  function parse(raw: Json): Json {
    return JSON.parse(JSON.stringify(deserialize(JSON.stringify(raw)))) as Json;
  }
  describe("업로드된 얼굴 시트의 v3 → v4 이관", () => {
    it("actor 의 faceIndex 7 은 낱장 -07 참조가 된다", () => {
      const project = parse(v3WithUploadedSheet());
      const actors = (project.database as { actors: { faceResourceId?: string }[] }).actors;
      expect(actors[0]!.faceResourceId).toBe(`${SHEET_ID}-07`);
    });

    it("시트 자산은 낱장 16개로 바뀌고 시트 자체는 사라진다", () => {
      const project = parse(v3WithUploadedSheet());
      const uploaded = (project.assets as { uploaded: Record<string, unknown> }).uploaded;
      const faceIds = Object.keys(uploaded).filter((id) => id.startsWith(`${SHEET_ID}-`));
      expect(faceIds).toHaveLength(16);
      expect(faceIds).toContain(`${SHEET_ID}-00`);
      expect(faceIds).toContain(`${SHEET_ID}-15`);
      expect(uploaded[SHEET_ID]).toBeUndefined();
    });

    it("낱장 자산은 48×48 로 기록되고 절단 대기 표시를 들고 있다", () => {
      const project = parse(v3WithUploadedSheet());
      const uploaded = (project.assets as { uploaded: Record<string, { meta?: Json }> }).uploaded;
      const face = uploaded[`${SHEET_ID}-07`]!;
      expect(face.meta?.width).toBe(48);
      expect(face.meta?.height).toBe(48);
      expect(face.meta?.sheetCell).toBe(7);
      expect(face.meta?.sheetSourceId).toBe(SHEET_ID);
    });

    it("리소스 프로필도 낱장 16개로 바뀐다", () => {
      const project = parse(v3WithUploadedSheet());
      const profiles = project.resourceProfiles as { kind: string; assetId?: string; imageWidth?: number }[];
      const faces = profiles.filter((entry) => entry.assetId?.startsWith(`${SHEET_ID}-`));
      expect(faces).toHaveLength(16);
      expect(faces.every((entry) => entry.imageWidth === 48)).toBe(true);
      expect(profiles.some((entry) => entry.assetId === SHEET_ID)).toBe(false);
    });

    it("faceIndex 키는 어디에도 남지 않는다", () => {
      expect(JSON.stringify(parse(v3WithUploadedSheet()))).not.toContain('"faceIndex"');
    });

    it("두 번 읽어도 낱장 id 가 다시 접미사를 얻지 않는다", () => {
      const once = parse(v3WithUploadedSheet());
      once.version = 3;
      const actors = (parse(once).database as { actors: { faceResourceId?: string }[] }).actors;
      expect(actors[0]!.faceResourceId).toBe(`${SHEET_ID}-07`);
    });
  });
});

describe("factionRuntime", () => {
  isolateTimers();
  const table = resolveFactionTable({
    defs: [
      { id: "bandit", name: "산적" },
      { id: "guard", name: "경비병" },
      { id: "watch", name: "자경단" },
    ],
    relations: [
      { a: "bandit", b: "guard", stance: -1 },
      { a: "guard", b: "watch", stance: 1 },
    ],
  });
  describe("runtime faction stance overlay", () => {
    it("matches authored behavior exactly when the overlay is absent", () => {
      for (const a of table.ids) {
        for (const b of table.ids) {
          expect(effectiveFactionStance(table, undefined, a, b)).toBe(factionStance(table, a, b));
        }
      }
    });

    it("uses stable unambiguous ordered-pair keys and stores only changed directions", () => {
      expect(factionStancePairKey("a|b", "c")).not.toBe(factionStancePairKey("a", "b|c"));
      const changed = setEffectiveFactionStance(table, {}, "guard", PLAYER_FACTION_ID, -1);
      expect(Object.keys(changed).sort()).toEqual([
        factionStancePairKey(PLAYER_FACTION_ID, "guard"),
        factionStancePairKey("guard", PLAYER_FACTION_ID),
      ].sort());
      expect(setEffectiveFactionStance(table, changed, "guard", PLAYER_FACTION_ID, 0)).toEqual({});
    });

    it("clamps absolute and delta updates while preserving fractional reputation", () => {
      let overrides = setEffectiveFactionStance(table, {}, "guard", PLAYER_FACTION_ID, 99);
      expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(2);
      overrides = adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -0.25);
      expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(1.75);
      overrides = adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -99);
      expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(-2);
    });

    it("takes the more hostile direction even for asymmetric loaded overlays", () => {
      const overrides = parseFactionStanceOverrides({
        [factionStancePairKey("guard", "bandit")]: 2,
        [factionStancePairKey("bandit", "guard")]: -2,
      });
      expect(effectiveFactionStance(table, overrides, "guard", "bandit")).toBe(-2);
      expect(effectiveFactionStance(table, overrides, "bandit", "guard")).toBe(-2);
    });

    it("warms enemies of the defeated faction and cools it plus its allies", () => {
      const changed = applyPlayerKillReputation(table, {}, "guard", 0.25);
      expect(effectiveFactionStance(table, changed, "bandit", PLAYER_FACTION_ID)).toBe(0.25);
      expect(effectiveFactionStance(table, changed, "guard", PLAYER_FACTION_ID)).toBe(-0.25);
      expect(effectiveFactionStance(table, changed, "watch", PLAYER_FACTION_ID)).toBe(-0.25);
    });
  });
});

describe("farmAnimals", () => {
  isolateTimers();
  describe("p1HostileAudit", () => {
    isolateTimers();
    describe("P1 independent hostile audit", () => {
      it("rejects care receipts for a day other than the live calendar day without mutation", () => {
        // Break caught: a caller can consume feed or gain friendship for a future day and poison the next transition.
        const project = animalProject();
        project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
        const session = startSession(project, 901);
        session.inventory[feedItemId(project)] = 2;
        const before = structuredClone(session);

        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:2")).toMatchObject({
          ok: false,
          reason: "invalid-day-key",
        });
        expect(petFarmAnimal(project, session, "animal_1", "1:spring:2")).toMatchObject({
          ok: false,
          reason: "invalid-day-key",
        });
        expect(session).toEqual(before);
      });

      it("rejects production advancement for a day other than the live calendar day", () => {
        // Break caught: direct authority calls can mint products while gameTime remains on an earlier day.
        const project = animalProject();
        project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
        const session = startSession(project, 902);
        replaceAnimal(session, "animal_1", {
          productionProgress: 1,
          lastFedDayKey: "1:spring:2",
          lastPettedDayKey: "1:spring:2",
        });
        const before = structuredClone(session);

        expect(advanceFarmAnimalProduction(project, session, "1:spring:2")).toMatchObject({
          ok: false,
          reason: "invalid-day-key",
        });
        expect(session).toEqual(before);
      });

      it("repairs over-capacity saved assignments deterministically on direct apply", () => {
        // Break caught: a hostile save restores an overfilled home and makes every animal API fail invalid-state.
        const project = animalProject();
        project.system.farmAnimalBuildings = project.system.farmAnimalBuildings!.map((building) =>
          building.id === "coop" ? { ...building, capacity: 1 } : building);
        const session = startSession(project, 903);
        session.farmAnimals!.animal_2 = {
          ...session.farmAnimals!.animal_2!,
          buildingId: "coop",
        };
        const snapshot = createSaveSnapshot(project, session);

        const restored = applySaveSnapshot(project, snapshot);

        expect(restored.farmAnimals?.animal_1?.buildingId).toBe("coop");
        expect(restored.farmAnimals?.animal_2?.buildingId).toBeUndefined();
      });
    });
  });
  describe("p1SessionPersistence", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();

      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    describe("P1 farm-animal session persistence", () => {
      it("round-trips runtime assignment, care receipts, cadence, and ready products", () => {
        // Break caught: runtime animal actions work live but their resulting state is lost by save parse/apply.
        const project = animalProject();
        const session = startSession(project, 301);
        session.inventory[feedItemId(project)] = 2;
        expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop").ok).toBe(true);
        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(true);
        expect(petFarmAnimal(project, session, "animal_1", "1:spring:1").ok).toBe(true);
        expect(advanceFarmAnimalProduction(project, session, "1:spring:1").ok).toBe(true);
        expect(feedFarmAnimal(project, session, "animal_1", "1:spring:2").ok).toBe(true);
        expect(petFarmAnimal(project, session, "animal_1", "1:spring:2").ok).toBe(true);
        expect(advanceFarmAnimalProduction(project, session, "1:spring:2").ok).toBe(true);

        const storage = new MemoryStorage();
        saveToSlot(storage, 1, createSaveSnapshot(project, session));
        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected present save");
        const restored = applySaveSnapshot(project, read.snapshot);

        expect(restored.farmAnimals).toEqual(session.farmAnimals);
        expect(restored.farmAnimals?.animal_1).toMatchObject({
          friendship: 20,
          productionProgress: 0,
          readyProductCount: 2,
          lastFedDayKey: "1:spring:2",
          lastPettedDayKey: "1:spring:2",
          lastAdvancedDayKey: "1:spring:2",
        });
        expect(restored.farmAnimals?.animal_2?.buildingId).toBe("coop");
      });

      it("keeps empty authored arrays and omitted legacy animal state compatible", () => {
        // Break caught: an empty/omitted legacy package becomes corrupt after runtime APIs are introduced.
        const project = createBlankProject();
        project.database.farmAnimalSpecies = [];
        project.system.farmAnimalBuildings = [];
        project.session.farmAnimals = [];
        const empty = startSession(project, 302);
        const snapshot = createSaveSnapshot(project, empty);
        delete (snapshot.session as { farmAnimals?: unknown }).farmAnimals;

        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.farmAnimals).toEqual({});
        expect(advanceFarmAnimalProduction(project, restored, "1:spring:1")).toMatchObject({
          ok: true,
          advancedInstanceIds: [],
          products: [],
        });
      });

      it("falls back to the authored home when a saved moved-home reference is deleted", () => {
        // Break caught: a stale moved building id survives load or erases the safe authored assignment.
        const project = animalProject();
        project.system.farmAnimalBuildings!.push({
          id: "temporary_coop",
          name: "Temporary coop",
          mapId: project.startMapId,
          x: 5,
          y: 5,
          capacity: 1,
          allowedSpeciesIds: ["chicken"],
        });
        const session = startSession(project, 303);
        expect(assignFarmAnimalToBuilding(project, session, "animal_1", "temporary_coop").ok).toBe(true);
        const snapshot = createSaveSnapshot(project, session);
        project.system.farmAnimalBuildings = project.system.farmAnimalBuildings!
          .filter((building) => building.id !== "temporary_coop");

        expect(applySaveSnapshot(project, snapshot).farmAnimals?.animal_1?.buildingId).toBe("coop");
      });
    });
  });
});
