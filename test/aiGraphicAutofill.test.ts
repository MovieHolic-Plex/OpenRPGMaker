// AI 저작 경로에서 NPC·몬스터 외형이 비어 있는 상태로 저장되던 결함의 회귀 고정.
// 실측: upsert_enemy / define_monster_species 는 monsterResourceId 를 생략해도 통과했고,
// 전투에서는 스킨 공용 스프라이트가 대체돼 모든 적이 같은 모습이 됐다. 한국어 이름으로는
// searchResources("monster", …) 가 0건이라 모델이 필드를 아예 빼버리는 원인도 됐다.
import { describe, expect, it } from "vitest";
import { searchResources } from "@/assets/resourceSearch";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { createFieldSpawnRuntime } from "@/player/fieldSpawns";

function context(): ToolContext {
  return { project: createBlankProject() };
}

describe("한국어 몬스터 리소스 검색", () => {
  it("한국어 종족명이 대응 리소스를 찾는다", () => {
    const cases: readonly [string, string][] = [
      ["슬라임", "slime"],
      ["박쥐", "bat"],
      ["해골 궁수", "skeleton-archer"],
      ["고블린", "goblin"],
      ["붉은 용", "dragon-red"],
      ["돌 골렘", "golem-stone"],
      ["불의 정령", "spirit-fire"],
    ];
    for (const [query, expectedFragment] of cases) {
      const hits = searchResources("monster", query);
      expect(hits.length, `${query} 검색 결과가 없다`).toBeGreaterThan(0);
      expect(hits.slice(0, 3).map((hit) => hit.id).join(" "), query).toContain(expectedFragment);
    }
  });
});

describe("upsert_enemy 외형 자동 부여", () => {
  it("monsterResourceId 를 생략하면 이름에 맞는 리소스를 붙이고 경고한다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_enemy", {
      enemy: { id: "enemy_bone_archer", name: "해골 궁수", stats: { maxHp: 40 } },
    });

    expect(result.ok, result.summary).toBe(true);
    const enemy = ctx.project.database.enemies.find((entry) => entry.id === "enemy_bone_archer");
    expect(enemy?.monsterResourceId).toBe("generated-enemy-skeleton-archer");
    expect((result.diff?.warnings ?? []).join(" ")).toContain("monsterResourceId");
  });

  it("unknown names fail without persisting arbitrary or missing art", () => {
    const ctx = context();
    const before = ctx.project;
    for (const [id, name] of [["enemy_zzz_one", "이름없는것"], ["enemy_qqq_two", "정체불명"]]) {
      const result = runTool(ctx, "upsert_enemy", { enemy: { id, name } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("monster-graphic-required");
      expect(ctx.project).toBe(before);
    }
  });

  it("같은 적을 다시 저장하면 이미 붙은 외형을 유지한다", () => {
    const ctx = context();
    runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_keep", name: "동굴 박쥐" } });
    const assigned = ctx.project.database.enemies.find((entry) => entry.id === "enemy_keep")?.monsterResourceId;
    runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_keep", stats: { maxHp: 99 } } });

    const enemy = ctx.project.database.enemies.find((entry) => entry.id === "enemy_keep");
    expect(assigned).toBe("generated-enemy-bat-cave");
    expect(enemy?.monsterResourceId).toBe(assigned);
    expect(enemy?.stats.maxHp).toBe(99);
  });

  it("명시한 외형을 자동 부여가 덮지 않는다", () => {
    const ctx = context();
    runTool(ctx, "upsert_enemy", {
      enemy: { id: "enemy_explicit", name: "해골 궁수", monsterResourceId: "generated-enemy-dragon-red" },
    });

    expect(ctx.project.database.enemies.find((entry) => entry.id === "enemy_explicit")?.monsterResourceId)
      .toBe("generated-enemy-dragon-red");
  });
});

describe("define_monster_species 외형 자동 부여", () => {
  it("graphic.monsterResourceId 를 생략하면 이름으로 붙인다", () => {
    const ctx = context();
    const result = runTool(ctx, "define_monster_species", {
      species: { id: "species_slime", name: "푸른 슬라임", captureRate: 0.5 },
    });

    expect(result.ok, result.summary).toBe(true);
    const species = ctx.project.database.monsterSpecies?.find((entry) => entry.id === "species_slime");
    expect(species?.graphic.monsterResourceId).toBe("generated-enemy-slime-blue");
    expect((result.diff?.warnings ?? []).join(" ")).toContain("species.graphic.monsterResourceId");
  });
});

describe("make_action_enemy 외형 자동 부여", () => {
  it("생성 적과 그 적의 사냥터 필드 스폰이 모두 보이는 외형을 가진다", () => {
    const ctx = context();
    const enemyId = "enemy_action_visible";
    const troopId = "troop_action_visible";
    const created = runTool(ctx, "make_action_enemy", {
      enemyId,
      name: "슬라임",
      actionProfile: { contactDamage: 3 },
    });

    expect(created.ok, created.summary).toBe(true);
    expect(ctx.project.database.enemies.find((entry) => entry.id === enemyId)?.monsterResourceId)
      .toMatch(/^generated-enemy-/);
    expect((created.diff?.warnings ?? []).join(" ")).toContain("monsterResourceId");

    ctx.project.database.troops.push({
      id: troopId,
      name: "돌진 슬라임 무리",
      enemyIds: [enemyId],
      members: [{ enemyId, x: 160, y: 96, hidden: false }],
      autoAlign: false,
      battleEventPages: [],
    });
    const mapId = ctx.project.startMapId;
    const hunting = runTool(ctx, "make_hunting_ground", {
      mapId,
      area: { x: 1, y: 1, w: 3, h: 3 },
      troopId,
      maxAlive: 1,
    });

    expect(hunting.ok, hunting.summary).toBe(true);
    const map = ctx.project.maps[mapId];
    if (!map) throw new Error("start map missing");
    const runtime = createFieldSpawnRuntime(ctx.project, map, { x: 10, y: 10 });
    expect(runtime.entries.at(-1)?.spawn.graphic.sprite?.id).toMatch(/^generated-enemy-/);
    expect(runtime.entries.at(-1)?.spawn.graphic.transparent).not.toBe(true);
  });
});

describe("몬스터 이벤트 기본 외형", () => {
  it.each([
    ["place_battle_blocker", (ctx: ToolContext) => ({
      mapId: ctx.project.startMapId,
      x: 3,
      y: 3,
      troopId: ctx.project.database.troops[0]?.id,
    })],
    ["make_chase_scene", (ctx: ToolContext) => ({
      mapId: ctx.project.startMapId,
      chaser: { at: { x: 3, y: 3 } },
    })],
  ] as const)("%s 는 graphic 생략 시 monster charset 과 경고를 붙인다", (toolName, argsFor) => {
    const ctx = context();
    const result = runTool(ctx, toolName, argsFor(ctx));

    expect(result.ok, result.summary).toBe(true);
    const eventId = (result.data as { eventId: string }).eventId;
    const pages = ctx.project.maps[ctx.project.startMapId]?.events.find((event) => event.id === eventId)?.pages ?? [];
    const visiblePages = pages.filter((page) => page.graphic?.transparent !== true);
    expect(visiblePages.length).toBeGreaterThan(0);
    for (const page of visiblePages) {
      expect(page.graphic?.sprite?.id).toBeTruthy();
      expect(page.graphic?.transparent).not.toBe(true);
    }
    expect((result.diff?.warnings ?? []).join(" ")).toContain('query:"monster"');
  });
});

describe("upsert_event NPC 외형 자동 부여", () => {
  it("대화가 있는 action 이벤트는 투명하게 저장되지 않는다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_talker",
        x: 3,
        y: 3,
        trigger: { kind: "action" },
        pages: [{ conditions: [], commands: [{ kind: "text", body: "안녕하세요" }] }],
      },
    });

    expect(result.ok, result.summary).toBe(true);
    const page = ctx.project.maps[ctx.project.startMapId]?.events
      .find((entry) => entry.id === "ev_talker")?.pages?.[0];
    expect(page?.graphic?.sprite?.id).toBeTruthy();
    expect(page?.graphic?.transparent).not.toBe(true);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("graphic:{transparent:true}");
  });

  // 2026-09-24 꿈 세계 도그푸딩: 거울·촛대·액자가 주민 그림으로 서 있었다.
  it("이름이 사물인 조사 이벤트에는 주민 그림을 세우지 않는다", () => {
    const ctx = context();
    const upsert = (id: string, name: string, x: number) => runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: { id, name, x, y: 3, trigger: { kind: "action" }, pages: [{ conditions: [], commands: [{ kind: "text", body: "…" }] }] },
    });
    const pageOf = (id: string) => ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === id)?.pages?.[0];
    const mirror = upsert("ev_mirror", "기억의 거울", 3);
    expect(mirror.ok, mirror.summary).toBe(true);
    expect(pageOf("ev_mirror")?.graphic).toEqual({ transparent: true });
    expect((mirror.diff?.warnings ?? []).join(" ")).toContain("사물 타일을 칠하거나");
    upsert("ev_door", "붉은 문 (촛불 숲)", 5);
    expect(pageOf("ev_door")?.graphic?.sprite?.id).toBe("tex_easyrpg_charset_object1");
    upsert("ev_shadow", "그림자 사람", 7);
    expect(pageOf("ev_shadow")?.graphic?.sprite?.id).toBeTruthy();
    expect(pageOf("ev_shadow")?.graphic?.sprite?.id).not.toBe("tex_easyrpg_charset_object1");
  });

  it("place_npc 의 최상위 commands 는 인사 한 줄로 덮이지 않는다", () => {
    const ctx = context();
    const result = runTool(ctx, "place_npc", {
      mapId: ctx.project.startMapId, x: 4, y: 4, name: "춤추는 그림자", id: "ev_dancer",
      commands: [{ kind: "text", body: "…(말없이 춤춘다)" }],
    });
    expect(result.ok, result.summary).toBe(true);
    const commands = JSON.stringify(ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_dancer")?.pages);
    expect(commands).toContain("말없이 춤춘다");
    expect(commands).not.toContain("안녕하세요");
  });

  it("두 페이지 NPC는 비어 있는 뒷 페이지에 앞 페이지 외형을 그대로 재사용한다", () => {
    const ctx = context();
    const explicitGraphic = {
      sprite: { type: "bundled" as const, id: "tex_easyrpg_charset_people2" },
      direction: "left" as const,
      pattern: 7,
    };
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_progressive_npc",
        x: 3,
        y: 3,
        trigger: { kind: "action" },
        pages: [
          { conditions: [], graphic: explicitGraphic, commands: [{ kind: "text", body: "처음 대사" }] },
          { conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [{ kind: "text", body: "다음 대사" }] },
        ],
      },
    });

    expect(result.ok, result.summary).toBe(true);
    const pages = ctx.project.maps[ctx.project.startMapId]?.events
      .find((entry) => entry.id === "ev_progressive_npc")?.pages;
    expect(pages?.[1]?.graphic).toEqual(pages?.[0]?.graphic);
    expect(pages?.[1]?.graphic).toEqual(explicitGraphic);
  });

  it("priority below 인 action 대화 마커는 주민 그래픽을 세우지 않는다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_wall_marker",
        x: 4,
        y: 3,
        trigger: { kind: "action" },
        pages: [{
          conditions: [],
          priority: "below",
          commands: [{ kind: "text", body: "벽에 오래된 글씨가 있다." }],
        }],
      },
    });

    expect(result.ok, result.summary).toBe(true);
    const graphic = ctx.project.maps[ctx.project.startMapId]?.events
      .find((entry) => entry.id === "ev_wall_marker")?.pages?.[0]?.graphic;
    expect(graphic?.sprite).toBeUndefined();
    expect(graphic?.transparent).not.toBe(true);
  });

  it("투명을 명시한 이벤트와 컷신용 auto 이벤트는 그대로 둔다", () => {
    const ctx = context();
    runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_hidden",
        x: 4,
        y: 3,
        trigger: { kind: "action" },
        pages: [{ conditions: [], graphic: { transparent: true }, commands: [{ kind: "text", body: "낡은 표지판" }] }],
      },
    });
    runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_cutscene",
        x: 5,
        y: 3,
        trigger: { kind: "auto" },
        pages: [{ conditions: [], commands: [{ kind: "text", body: "바람이 불어온다" }] }],
      },
    });

    const events = ctx.project.maps[ctx.project.startMapId]?.events ?? [];
    expect(events.find((entry) => entry.id === "ev_hidden")?.pages?.[0]?.graphic?.sprite).toBeUndefined();
    expect(events.find((entry) => entry.id === "ev_cutscene")?.pages?.[0]?.graphic?.sprite).toBeUndefined();
  });
});

describe("add_companion actor 합류 이벤트 외형", () => {
  it("actorId 의 charset 을 말 걸기 페이지에 표시한다", () => {
    const ctx = context();
    const actor = ctx.project.database.actors[0];
    if (!actor) throw new Error("actor fixture missing");
    const result = runTool(ctx, "add_companion", {
      who: { actorId: actor.id },
      target: { mapId: ctx.project.startMapId, x: 4, y: 4 },
      trigger: "talk",
    });

    expect(result.ok, result.summary).toBe(true);
    const eventId = (result.data as { eventId: string }).eventId;
    const joinPage = ctx.project.maps[ctx.project.startMapId]?.events
      .find((entry) => entry.id === eventId)?.pages?.find((page) =>
        page.commands.some((command) => command.kind === "addFollower")
      );
    expect(joinPage?.graphic?.sprite?.id).toBeTruthy();
    expect(joinPage?.graphic?.transparent).not.toBe(true);
  });

  it("upsert_actor 로 만든 charset 없는 액터는 주민 charset 으로 폴백한다", () => {
    const ctx = context();
    const actorId = "actor_ai_companion";
    const classId = ctx.project.database.classes[0]?.id;
    if (!classId) throw new Error("class fixture missing");
    const actorResult = runTool(ctx, "upsert_actor", {
      actor: { id: actorId, name: "새 동료", classId },
    });
    expect(actorResult.ok, actorResult.summary).toBe(true);
    expect(ctx.project.database.actors.find((actor) => actor.id === actorId)?.characterResourceId).toBeUndefined();

    const result = runTool(ctx, "add_companion", {
      who: { actorId },
      target: { mapId: ctx.project.startMapId, x: 4, y: 4 },
      trigger: "talk",
    });

    expect(result.ok, result.summary).toBe(true);
    const eventId = (result.data as { eventId: string }).eventId;
    const joinPage = ctx.project.maps[ctx.project.startMapId]?.events
      .find((entry) => entry.id === eventId)?.pages?.find((page) =>
        page.commands.some((command) => command.kind === "addFollower")
      );
    expect(joinPage?.graphic?.sprite?.id).toBe("tex_easyrpg_charset_people1");
    expect(joinPage?.graphic?.transparent).not.toBe(true);
  });
});

describe("타일 가구 위 조사 지점은 사람 그림을 세우지 않는다", () => {
  it("그림 없는 기존 조사 지점을 대화 페이지로 고쳐도 투명하게 남는다", () => {
    const ctx = context();
    const mapId = ctx.project.startMapId;
    const seeded = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_safe", x: 3, y: 3, trigger: { kind: "action" },
        pages: [{ conditions: [], trigger: { kind: "action" }, graphic: { transparent: true }, commands: [{ kind: "text", body: "철제 금고다." }] }] },
    });
    expect(seeded.ok, seeded.summary).toBe(true);
    const result = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_safe", pages: [{ conditions: [], trigger: { kind: "action" }, graphic: {}, commands: [{ kind: "text", body: "다이얼이 달려 있다." }] }] },
    });
    expect(result.ok, result.summary).toBe(true);
    const page = ctx.project.maps[mapId]?.events.find((entry) => entry.id === "ev_safe")?.pages?.[0];
    expect(page?.graphic?.sprite).toBeUndefined();
    expect((result.diff?.warnings ?? []).join(" ")).not.toContain("주민 기본 charset");
  });
});
