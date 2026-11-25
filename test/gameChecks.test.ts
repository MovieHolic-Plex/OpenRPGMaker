import { describe, expect, it, afterEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { choiceMetaTag, playerChoiceText } from "@/project/choiceText";
import { fieldMenu } from "@/project/fieldMenu";
import { applyStorySetupDefaults } from "@/ai/v2/genreDefaults";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import type { Project, GameEvent, GameMap, Command } from "@/project/types";
import { findingLine } from "@/ai/v2/judge/finding";
import { getTool } from "@/editor/tools/toolRegistry";
import { projectCanLoseHp } from "@/project/fieldHud";
import { runTool } from "@/editor/tools/toolRunner";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { resolveMapBgm } from "@/project/mapMusic";
import { musicOnly, v2ExtraToolNames } from "@/ai/v2/request/readers";
import { scopeAdviceToRequest, type AdvisorVerdict } from "@/ai/v2/judge/advisor";
import { chaserThreatsAt, unsafeSpawnLines } from "@/project/chaserSpawnSafety";
import { startChaseSpawnGrace, tickChaseSpawnGrace } from "@/player/chaseSpawnGrace";
import { movementKeyProblems } from "@/editor/tools/eventPageKeys";
import { endingSummaryText, splitScriptSpeaker } from "@/project/endingSummary";
import { resolveMapCameraZoom } from "@/project/cameraZoom";
import { runTodoCheck } from "@/ai/v2/judge/todoChecks";
import { buildGameApiDts, scriptApiCheatSheet } from "@/project/script/dts";
import { setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { inferStoreMusicScene, normalizeStoreMusicScene, rankStoreMusic, scoreStoreMusic, storeMusicTracks } from "@/assetStore/storeMusicPick";
import { readStoreMusicMeta, STORE_MUSIC_SCENES } from "@/assets/storeMusicMeta";
import type { StorePackManifest } from "@/assetStore/format";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2ChoiceTagsStoryMenu", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  describe("choice meta tags (J37)", () => {
    it("strips design notes but keeps prices and plain brackets", () => {
      expect(playerChoiceText("마지막으로 가게 문을 닫는다 (엔딩)")).toBe("마지막으로 가게 문을 닫는다");
      expect(playerChoiceText("혼자 도망친다 (배드 엔딩)")).toBe("혼자 도망친다");
      expect(playerChoiceText("침대에서 자고 다음 날 아침을 맞이한다 (+1일)")).toBe("침대에서 자고 다음 날 아침을 맞이한다");
      expect(playerChoiceText("커피를 건넨다 [호감+2]")).toBe("커피를 건넨다");
      expect(playerChoiceText("포션을 산다 (100G)")).toBe("포션을 산다 (100G)");
      expect(playerChoiceText("(조용히) 고개를 끄덕인다")).toBe("(조용히) 고개를 끄덕인다");
      expect(playerChoiceText("(엔딩)")).toBe("(엔딩)");
      expect(choiceMetaTag("혼자 도망친다 (배드 엔딩)")).toBe("(배드 엔딩)");
      expect(choiceMetaTag("포션을 산다 (100G)")).toBeUndefined();
    });

    it("finish check flags tagged choices in changed events", () => {
      const before = createBlankProject() as Project;
      const after = structuredClone(before);
      const map = after.maps[after.startMapId!]!;
      map.events.push({ id: "ev_door", name: "정문", x: 2, y: 2, pages: [{ trigger: { kind: "action" }, commands: [{ kind: "choices", options: [{ text: "혼자 도망친다 (배드 엔딩)", branch: [] }, { text: "언니를 찾는다", branch: [] }] }] }] } as never);
      const problems = gameLines(before, after, "공포 게임 만들어 줘");
      expect(problems.some((p) => p.includes("[게임 검사 선택지]") && p.includes("(배드 엔딩)"))).toBe(true);
    });
  });
  describe("story ESC menu (J39)", () => {
    it("a non-combat game start gets the story menu; a battle game keeps the default", () => {
      const story = createBlankProject() as Project;
      expect(applyStorySetupDefaults(story, "폐업 직전 장난감 가게 회상 스토리 게임")).toContain("ESC 메뉴 이야기용");
      const commands = fieldMenu(story)!.entries.map((e) => e.command);
      expect(commands).not.toContain("skills");
      expect(commands).not.toContain("equipment");
      expect(commands).toContain("save");

      const battle = createBlankProject() as Project;
      applyStorySetupDefaults(battle, "보스와 전투가 있는 게임");
      expect(battle.meta.oprnFieldMenu).toBeUndefined();
    });

    it("does not overwrite an authored menu", () => {
      const p = createBlankProject() as Project;
      p.meta.oprnFieldMenu = { version: 1, entries: [{ command: "items", label: "가방" }] };
      applyStorySetupDefaults(p, "공포 게임");
      expect(p.meta.oprnFieldMenu.entries).toHaveLength(1);
    });
  });
});

describe("aiV2HorrorLifeHud", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  // 2026-10-25 심사 J67: 피해가 없는 공포 탐험에 set_field_hud{theme:'horror'} 가 꽃잎 생명(체력)을 말없이 켰다.
  function withTrap(project: Project): Project {
    const map = Object.values(project.maps)[0]!;
    map.events = [...(map.events ?? []), { id: "ev_trap", name: "가시 함정", x: 2, y: 2, trigger: "touch",
      pages: [{ id: "p1", name: "", conditions: [], trigger: "touch", priority: "same", commands: [{ kind: "changeActorHp", actorId: "actor_hero", op: "-=", amount: 5 }] }] } as unknown as GameEvent];
    return project;
  }
  describe("horror life HUD only when HP can drop (J67)", () => {
    it("theme horror alone does not show the petals in a damageless game", () => {
      const project = createBlankProject() as Project;
      expect(projectCanLoseHp(project)).toBe(false);
      getTool("set_field_hud")!.run(project, { theme: "horror" });
      expect(project.system.fieldHud?.vitals).toBe(false);
    });

    it("keeps the petals when something can hurt the player, or when vitals is asked for", () => {
      const hurt = withTrap(createBlankProject() as Project);
      getTool("set_field_hud")!.run(hurt, { theme: "horror" });
      expect(hurt.system.fieldHud?.vitals).toBe(true);
      const asked = createBlankProject() as Project;
      getTool("set_field_hud")!.run(asked, { theme: "horror", vitals: true });
      expect(asked.system.fieldHud?.vitals).toBe(true);
    });

    it("the finish check flags a life HUD in a game where HP never drops", () => {
      const before = createBlankProject() as Project;
      const after = structuredClone(before);
      after.system.fieldHud = { theme: "horror", vitals: true, clock: false, tools: false, objective: false, hideEmpty: true };
      expect(gameLines(before, after, "공포 탐험 게임").some((line) => line.includes("[게임 검사 HUD]"))).toBe(true);
    });
  });
});

// 추격 곡이 추격 상태를 따라가는가 + 음악만 바라는 요청의 범위(2026-10-30 실조수 e2e r11·r12 후속).
// r12: 금고를 열 때만 추격 곡으로 바꿔서, 스위치가 켜진 채 맵에 다시 들어오거나 잡혀서 다시 시작하면 평소 곡이 깔렸다.
// r12: 검토자의 «체크포인트가 추격자 시야 안» 우려가 관문 글로 넘어가 조수가 상자를 찍고 make_chase_scene 을 불렀다.
// r11: 엔딩곡 요청에 이미 있던 ev_boss 의 triggerEnding 을 못 보고 «triggerEnding 이 없다»고 막았다.
describe("chaseMusicPersists", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  function chaseProject() {
    const ctx = { project: createBlankProject() };
    const must = (name: string, args: Record<string, unknown>) => {
      const result = runTool(ctx, name, args, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      return result;
    };
    must("create_map", { id: "map_cellar", name: "지하실", width: 20, height: 15 });
    must("upsert_event", { mapId: "map_cellar", event: { id: "ev_safe", name: "금고", x: 15, y: 10, commands: [{ kind: "setSwitch", switchId: "sw_chase_on", value: true }] } });
    must("make_chase_scene", { mapId: "map_cellar", id: "ev_chaser", chaser: { at: { x: 3, y: 3 }, speed: 4 }, activateSwitch: "sw_chase_on", killOnTouch: true, hidingSpots: [], patrol: { mode: "auto" } });
    return { ctx, must };
  }
  describe("chase music follows the chase switch", () => {
    it("leaves a while-switch entry music on the chaser map, idempotently", () => {
      const { ctx, must } = chaseProject();
      const [first, second] = listAudioResources("music", ctx.project).map((r) => r.id);
      const mapBgm = structuredClone(ctx.project.maps.map_cellar!.bgm);
      must("set_game_audio", { role: "chase", resourceId: first });
      must("set_game_audio", { role: "chase", resourceId: second });
      const map = ctx.project.maps.map_cellar!;
      expect(map.bgmWhileSwitch).toEqual([{ switchId: "sw_chase_on", resourceId: second }]);
      // 평소 맵 곡은 그대로 — 스위치가 꺼져 있으면 평소 곡이다.
      expect(map.bgm).toEqual(mapBgm);
    });

    it("upgrades an older unguarded switch-on cue to the guarded one without duplicating it", () => {
      const { ctx, must } = chaseProject();
      const id = listAudioResources("music", ctx.project)[0]!.id;
      const safe = ctx.project.maps.map_cellar!.events.find((e) => e.id === "ev_safe")!;
      safe.pages![0]!.commands.unshift({ kind: "m2Command", commandId: "m2-063-memorize-current-bgm", fields: {} } as never, { kind: "playAudio", resourceId: "old", loop: true, channel: "bgm" } as never);
      must("set_game_audio", { role: "chase", resourceId: id });
      must("set_game_audio", { role: "chase", resourceId: id });
      const commands = ctx.project.maps.map_cellar!.events.find((e) => e.id === "ev_safe")!.pages![0]!.commands as unknown as { kind: string; then?: { kind: string; resourceId?: string }[] }[];
      expect(commands.map((c) => c.kind)).toEqual(["fork", "setSwitch"]);
      expect(commands[0]!.then!.map((c) => c.resourceId ?? c.kind)).toEqual(["m2Command", id]);
    });

    it("resolves the chase track on map entry only while the switch is on", () => {
      const maps = { m: { id: "m", bgm: { mode: "custom", resourceId: "calm" }, bgmWhileSwitch: [{ switchId: "sw", resourceId: "chase" }] } as unknown as GameMap };
      const project = { maps, mapTree: { mapId: "m", children: [] }, system: {} } as unknown as Parameters<typeof resolveMapBgm>[0];
      expect(resolveMapBgm(project, "m", { switches: { sw: true } })).toEqual({ kind: "play", resourceId: "chase" });
      expect(resolveMapBgm(project, "m", { switches: { sw: false } })).toMatchObject({ kind: "play", resourceId: "calm" });
      // 스위치를 넘기지 않는 호출(편집기 미리보기·추천)은 평소 곡.
      expect(resolveMapBgm(project, "m")).toMatchObject({ kind: "play", resourceId: "calm" });
    });
  });
  describe("music-only requests", () => {
    it.each([
      ["아오오니 느낌으로 추격 음악", true],
      ["투더문처럼 잔잔하게 엔딩곡", true],
      ["테일즈런너처럼 신나는 거 마을에 깔아 줘", true],
      ["배경음악 추가해 줘", true],
      ["엔딩곡 만들어 줘", true],
      ["보스 만들고 보스곡 넣어 줘", false],
      ["추격자 만들고 추격 음악", false],
      ["마을을 만들고 배경음악 깔아 줘", false],
      ["파판처럼 마을 만들어", false],
    ] as const)("「%s」 music-only = %s", (task, expected) => {
      expect(musicOnly(task)).toBe(expected);
    });

    it("does not load map/event writing tools for a music-only chase request", () => {
      const names = v2ExtraToolNames("아오오니 느낌으로 추격 음악");
      expect(names).toContain("set_game_audio");
      expect(names).toContain("store_find_music");
      for (const tool of ["stamp_object", "make_chase_scene", "list_spatial_designs", "define_ending"]) expect(names).not.toContain(tool);
    });

    it("demotes reviewer concerns about pre-existing issues to notes, keeps report-honesty blockers", () => {
      const verdict: AdvisorVerdict = { ms: 1, inputChars: 1, notes: [
        { level: "blocker", what: "[출하 차단 default-hero] 기본 주인공이 남았다", evidence: "-" },
        { level: "concern", what: "체크포인트가 추격자 시야 안에 있어 위험함", evidence: "⚠ 위협" },
        { level: "blocker", claim: "추격 곡을 걸었다", what: "보고의 주장이 실제 변경과 반대다", evidence: "-" },
      ] };
      const scoped = scopeAdviceToRequest(verdict, "아오오니 느낌으로 추격 음악");
      expect(scoped.notes.map((n) => n.level)).toEqual(["aside", "aside", "blocker"]);
      expect(scoped.notes[1]!.what).toMatch(/음악 요청 밖/u);
      // 다른 일이 섞인 요청은 그대로.
      expect(scopeAdviceToRequest(verdict, "추격자 만들고 추격 음악")).toBe(verdict);
    });
  });
  describe("ending finish-check looks at the whole project", () => {
    const withBossEnding = (): Project => {
      const project = createBlankProject();
      const ctx = { project };
      expect(runTool(ctx, "create_map", { id: "m1", name: "던전", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
      expect(runTool(ctx, "define_ending", { id: "ending_main", name: "끝", priority: 0, conditions: [] }, { dryRun: false }).ok).toBe(true);
      expect(runTool(ctx, "upsert_event", { mapId: "m1", event: { id: "ev_boss", name: "그림자", x: 1, y: 1, commands: [{ kind: "triggerEnding", endingId: "ending_main" }] } }, { dryRun: false }).ok).toBe(true);
      return ctx.project;
    };

    it("does not claim a missing triggerEnding for a music-only ending request", () => {
      const before = withBossEnding();
      const after = structuredClone(before);
      after.endings![0]!.presentation = { ...(after.endings![0]!.presentation ?? {}), musicResourceId: "song" };
      expect(gameLines(before, after, "투더문처럼 잔잔하게 엔딩곡").join("\n")).not.toMatch(/triggerEnding 명령이 없다/u);
    });

    it("counts an existing triggerEnding elsewhere in the project for an ending request", () => {
      const before = withBossEnding();
      const after = structuredClone(before);
      expect(gameLines(before, after, "엔딩 장면 다듬어 줘").join("\n")).not.toMatch(/triggerEnding 명령이 없다/u);
      const empty = createBlankProject();
      expect(gameLines(empty, structuredClone(empty), "엔딩 장면 다듬어 줘").join("\n")).toMatch(/triggerEnding 명령이 없다/u);
    });
  });
});

// J54·J61: 추격자는 순찰하고(보면 쫓고 놓치면 돌아와 다시 순찰), 시작·체크포인트가 추격자 시야에 있으면 도구·끝맺음 검사가 짚는다.
describe("chaserPatrolAndSpawnSafety", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  function fixture(): { project: Project; mapId: string } {
    const project = createBlankProject();
    return { project, mapId: project.startMapId };
  }
  function chaser(project: Project, mapId: string, id: string): GameEvent {
    const event = project.maps[mapId]!.events.find((entry) => entry.id === id);
    if (!event) throw new Error(`no event ${id}`);
    return event;
  }
  describe("make_chase_scene 순찰", () => {
    it("patrol:{mode:'auto'} 는 닫힌 순찰 길을 movement.route 에 달고, 놓치면 돌아오게 한다", () => {
      const { project, mapId } = fixture();
      project.startPos = { x: 1, y: 1 };
      const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } }, patrol: { mode: "auto" } });
      const data = result.data as { eventId: string; patrolCells?: { x: number; y: number }[] };
      const movement = chaser(project, mapId, data.eventId).pages?.[0]?.movement as unknown as { type: string; route?: { moves: { kind: string }[]; repeat: boolean }; pursuit?: { onLost?: string } };
      expect(movement.type).toBe("chase");
      expect(movement.route?.repeat).toBe(true);
      expect(movement.route?.moves.some((move) => move.kind === "move")).toBe(true);
      expect(movement.pursuit?.onLost).toBe("return");
      const cells = data.patrolCells!;
      expect(cells[0]).toEqual(cells[cells.length - 1]);
    });

    it("patrol 이 없으면 순찰 없음을 요약에 적는다", () => {
      const { project, mapId } = fixture();
      project.startPos = { x: 1, y: 1 };
      const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } } });
      expect(result.summary).toContain("순찰 없음");
    });

    it("configure_npc_patrol 은 추격자에게 순찰 길을 달고 type 'chase' 를 지킨다", () => {
      const { project, mapId } = fixture();
      project.startPos = { x: 1, y: 1 };
      const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } } });
      const id = (made.data as { eventId: string }).eventId;
      getTool("configure_npc_patrol")!.run(project, { mapId, eventId: id, directions: ["right", "right", "left", "left"] });
      const movement = chaser(project, mapId, id).pages?.[0]?.movement as unknown as { type: string; route?: { moves: unknown[] }; pursuit?: { onLost?: string } };
      expect(movement.type).toBe("chase");
      expect(movement.route?.moves.length).toBeGreaterThan(0);
      expect(movement.pursuit?.onLost).toBe("return");
    });
  });
  describe("모르는 움직임 필드 거부", () => {
    it("patrol·waypoints 같은 엉뚱한 키를 이름과 함께 짚는다", () => {
      const problems = movementKeyProblems({ type: "chase", patrol: ["left"], waypoints: [], sight: { range: 5 } }, "movement");
      expect(problems.join(" ")).toContain("patrol");
      expect(problems.join(" ")).toContain("waypoints");
      // 문제 문장에는 허용 키 목록(…sight…)이 함께 붙는다 — sight 자체가 문제로 짚히지 않는지만 본다.
      expect(problems.some((problem) => problem.startsWith("movement.sight"))).toBe(false);
      expect(problems).toHaveLength(2);
    });

    it("patch_event_page 는 movement 의 모르는 키를 거부한다", () => {
      const { project, mapId } = fixture();
      project.startPos = { x: 1, y: 1 };
      const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } } });
      const id = (made.data as { eventId: string }).eventId;
      expect(() => getTool("patch_event_page")!.run(project, { mapId, eventId: id, set: { movement: { type: "chase", patrolPath: ["left", "right"] } } })).toThrow(/patrolPath/u);
    });
  });
  describe("시작·체크포인트 안전(J61)", () => {
    it("추격자 시야 안의 시작 칸을 짚고, 멀리 옮기면 조용하다", () => {
      const { project, mapId } = fixture();
      project.startPos = { x: 1, y: 1 };
      const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 }, sightRange: 5 } });
      const id = (made.data as { eventId: string }).eventId;
      const at = chaser(project, mapId, id);
      expect(chaserThreatsAt(project, mapId, at.x - 3, at.y).map((threat) => threat.eventId)).toContain(id);
      const moved = getTool("set_start_position")!.run(project, { mapId, x: at.x - 3, y: at.y });
      expect((moved.warnings ?? []).join(" ")).toContain("추격자");
      expect(unsafeSpawnLines(project).length).toBeGreaterThan(0);
    });

    it("끝맺음 검사가 시야 안 시작 칸과 말로만 한 추격을 짚는다", () => {
      const { project: before, mapId } = fixture();
      before.startPos = { x: 1, y: 1 };
      const after = structuredClone(before);
      const made = getTool("make_chase_scene")!.run(after, { mapId, chaser: { at: { x: 12, y: 10 }, sightRange: 5 } });
      const at = chaser(after, mapId, (made.data as { eventId: string }).eventId);
      after.startPos = { x: at.x - 2, y: at.y };
      expect(gameLines(before, after, "추격자를 둬").join(" ")).toContain("시작 위치");

      const talky = structuredClone(before);
      talky.maps[mapId]!.events.push({ id: "ev_guard", name: "경비", x: 5, y: 5, pages: [{ conditions: [], trigger: "action", commands: [{ kind: "text", body: "!" }] }] } as unknown as GameEvent);
      expect(gameLines(before, talky, "경비가 시야에 들면 「!」 하고 쫓아오게").join(" ")).toContain("쫓는 움직임");
    });
  });
  describe("태어난 뒤 잠깐의 유예", () => {
    it("유예 시간 동안만 참이다", () => {
      const scene = {};
      startChaseSpawnGrace(scene, 2000);
      expect(tickChaseSpawnGrace(scene, 1500)).toBe(true);
      expect(tickChaseSpawnGrace(scene, 600)).toBe(false);
    });
  });
});

// J36: 엔딩 카드 요약은 내레이션 — 에필로그의 말한 사람이 「이름: 대사」 대본 머리말로 새지 않는다.
describe("endingSummary", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  const TOY_SHOP_EPILOGUE = [
    { kind: "letterbox", show: true },
    { kind: "say", speaker: "노장인 제페토", text: "루카스의 씩씩한 태엽 병정도… 모두 자네에게 마지막 인사를 건넸구나." },
    { kind: "say", speaker: "노장인 제페토", text: "우리 가슴속에 감긴 추억의 태엽은 영원히 멈추지 않을 걸세." },
    { kind: "say", context: "narration", text: "철컥— 제페토 할아버지는 가게의 문을 조용히 닫았습니다." },
  ];
  describe("엔딩 카드 요약", () => {
    it("말한 사람의 줄은 이름 머리말 없이 「」 인용으로, 연이은 말은 한 인용으로 묶는다", () => {
      const text = endingSummaryText(TOY_SHOP_EPILOGUE);
      expect(text).not.toContain("제페토:");
      expect(text.split("\n")).toEqual([
        "「루카스의 씩씩한 태엽 병정도… 모두 자네에게 마지막 인사를 건넸구나. 우리 가슴속에 감긴 추억의 태엽은 영원히 멈추지 않을 걸세.」",
        "철컥— 제페토 할아버지는 가게의 문을 조용히 닫았습니다.",
      ]);
    });

    it("말한 사람이 둘 이상이면 인용 끝에 출처를 붙이고, 본문에 직접 쓴 「이름:」도 뗀다", () => {
      const text = endingSummaryText([
        { kind: "say", speaker: "미아", text: "고마워." },
        { kind: "say", text: "레온: 「또 만나자.」" },
      ]);
      expect(text.split("\n")).toEqual(["「고마워.」 — 미아", "「또 만나자.」 — 레온"]);
    });

    it("시각·문장 속 쌍점은 화자로 보지 않는다", () => {
      expect(splitScriptSpeaker("오전 10: 30 종이 울렸다").speaker).toBeUndefined();
      expect(splitScriptSpeaker("그날 밤, 마을 사람들은 모두 광장에 모여 이렇게 말했다: 고마워").speaker).toBeUndefined();
    });

    it("끝맺음 검사가 본문에 「이름:」을 쓴 에필로그를 짚는다", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      after.endings = [{ id: "ending_a", name: "끝", conditions: [], priority: 0, epilogue: [{ kind: "say", text: "노장인 제페토: 잘 가게." }] }];
      expect(gameLines(before, after, "엔딩 고쳐 줘").some((p) => p.includes("에필로그 대사 본문이 「이름:」"))).toBe(true);
      after.endings = [{ id: "ending_a", name: "끝", conditions: [], priority: 0, epilogue: [{ kind: "say", speaker: "노장인 제페토", text: "잘 가게." }] }];
      expect(gameLines(before, after, "엔딩 고쳐 줘").some((p) => p.includes("에필로그 대사 본문이 「이름:」"))).toBe(false);
    });
  });
});

// J69: 맵마다 기본 카메라 배율(set_map_properties zoom) · J70: 타이틀 메뉴 글자 크기(set_title_screen menuFontPx).
describe("mapZoomAndTitleFont", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  describe("맵 카메라 배율", () => {
    it("set_map_properties zoom 이 맵에 남고 런타임 배율이 그것을 먼저 본다", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      getTool("set_map_properties")!.run(project, { mapId, zoom: 1.5 });
      expect(project.maps[mapId]!.cameraZoom).toBe(1.5);
      expect(resolveMapCameraZoom(project.system, project.maps[mapId])).toBe(1.5);
      getTool("set_map_properties")!.run(project, { mapId, zoom: 1 });
      expect(project.maps[mapId]!.cameraZoom).toBeUndefined();
      expect(resolveMapCameraZoom({ cameraZoom: 2 }, project.maps[mapId])).toBe(2);
    });

    it("끝맺음 검사가 배율만 거는 자동 이벤트를 짚는다", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      after.maps[after.startMapId]!.events.push({ id: "ev_zoom", name: "줌", x: 0, y: 0, pages: [{ conditions: [], trigger: { kind: "auto" }, commands: [{ kind: "m2Command", commandId: "m2-201-camera-control", fields: { mode: "follow", zoom: "2" } }, { kind: "eraseEvent" }] }] } as unknown as GameEvent);
      expect(gameLines(before, after, "이 방은 가까이 보이게").join(" ")).toContain("set_map_properties");
    });
  });
  describe("타이틀 메뉴 글자 크기", () => {
    it("menuFontPx 를 10~24 로 잘라 저장하고 0 이면 지운다", () => {
      const project = createBlankProject();
      getTool("set_title_screen")!.run(project, { menuFontPx: 30 });
      expect(project.system.titleScreen?.menuFontPx).toBe(24);
      getTool("set_title_screen")!.run(project, { menuFontPx: 0 });
      expect(project.system.titleScreen?.menuFontPx).toBeUndefined();
    });
  });
});

// 2026-10-31 실조수(Opus) 데모에서 나온 스크립트 후속 수리를 고정한다.
// - 끝맺음 게임 검사가 스크립트의 game.shake/flash/playBgm 을 「명령 없음」으로 오판했다.
// - 모델이 game.player().facing 을 추측했다(필드는 direction) — 치트시트에 타입이 없었다.
// - showEmote/showAnimation 의 'this' 대상.
describe("scriptSandboxFollowups", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  function withScriptEvent(project: Project, source: string, name = "레버"): Project {
    const p = structuredClone(project);
    const map = Object.values(p.maps)[0]!;
    const script = { kind: "script", source, compiled: "/* compiled */", summary: "" } as unknown as Command;
    map.events = [...(map.events ?? []), {
      id: "ev_lever", name, x: 3, y: 3, trigger: "action",
      pages: [{ id: "p1", name: "", conditions: [], trigger: "action", priority: "same", commands: [script] }],
    } as unknown as GameEvent];
    return p;
  }
  describe("script follow-ups from the live assistant run", () => {
    const before = createBlankProject() as Project;
    const shakeTask = "레버를 틀리면 화면이 흔들려";

    it("a script that calls game.shake satisfies the shake check", () => {
      const after = withScriptEvent(before, "await game.shake(6, 40);");
      expect(gameLines(before, after, shakeTask).some((p) => p.includes("흔들림"))).toBe(false);
    });

    it("a script without a shake still gets the shake check", () => {
      const after = withScriptEvent(before, "await game.showMessage('clunk');");
      expect(gameLines(before, after, shakeTask).some((p) => p.includes("흔들림"))).toBe(true);
    });

    it("the cheat sheet lists helper types, so field names are not guessed", () => {
      const sheet = scriptApiCheatSheet();
      expect(sheet).toContain("## Types");
      expect(sheet).toMatch(/interface PlayerInfo \{[^}]*direction: Direction/);
      expect(sheet).toContain("type EmoteName =");
      expect(sheet).toContain("interface GameClock");
    });

    it("showEmote and showAnimation accept 'this' in the typed API", () => {
      const dts = buildGameApiDts();
      expect(dts).toMatch(/showEmote\(target: 'player' \| 'this' \| EventId/);
      expect(dts).toContain('type AnimTarget = "player" | "this" | EventId');
    });

    it("a todo talk check reads game.showMessage lines inside a script", () => {
      const after = withScriptEvent(before, "const p = 80;\nawait game.showMessage(`포션은 ${p}골드예요.`, { speaker: \"포션 상인\" });", "포션 상인");
      const result = runTodoCheck(after, { kind: "talk", who: "포션 상인", says: "골드예요" });
      expect(result.pass).toBe(true);
    });
  });
});

// 추격 음악(scene chase · set_game_audio role chase)과 store_find_music 장면 다른 말.
// 2026-10-30 실조수 e2e(/tmp/mfe2): 「아오오니 느낌으로 추격 음악」이 모든 전투에 걸렸고, scene 에 village·maps·미술관을 넣거나 빼서 한 번씩 헛돌았다.
describe("storeMusicChase", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  const sha = (n: number): string => n.toString(16).padStart(64, "0");
  const SLUG = "oprn-bgm-chase-horror-vol-1-abcd1234";
  const track = (n: number, id: string, sceneRoles: string[]) => ({
    id, name: id, kind: "music" as const, blob: sha(n), mime: "audio/ogg" as const,
    meta: { oprnMusic: { genre: "chase-horror", genreKo: "추격 호러", sceneRoles, mood: ["긴박한"], loopable: true, lengthSec: 60, summaryKo: id } },
  });
  const MANIFEST = {
    schema: "oprn-store-pack/1", title: "OPRN BGM — Chase Horror", summary: "s", description: "d", tags: ["bgm"], kind: "music",
    license: "OPRN-GAME", aiGenerated: true, credits: "Music: OPRN BGM (AI-generated)", previews: [],
    content: { tilesets: {}, assets: {
      battle: track(1, "battle", ["battle"]), tense: track(2, "tense", ["tense"]), chase: track(3, "chase", ["chase"]),
      hall: track(4, "hall", ["town"]), cave: track(5, "cave", ["dungeon"]), field: track(6, "field", ["field"]),
    } },
    blobs: [1, 2, 3, 4, 5, 6].map((n) => ({ sha256: sha(n), mime: "audio/ogg", bytes: 10 })),
  } as unknown as StorePackManifest;
  const TRACKS = storeMusicTracks({ slug: SLUG, latestVersion: 1, title: MANIFEST.title }, MANIFEST);
  function fakeStore(): StoreReadAccess {
    const item = { slug: SLUG, title: MANIFEST.title, summary: "", kind: "music", grade: "single", license: "OPRN-GAME", aiGenerated: true, author: "OPRN 운영", tags: [], latestVersion: 1, cover: null, downloads: 0, updatedAt: "" };
    return {
      url: "http://store.test", autoInstall: true, userMentionedStore: true,
      catalog: async () => ({ items: [item] as never, total: 1, page: 1, pageSize: 24 }),
      item: async () => ({ ...item }) as never,
      manifest: async () => MANIFEST,
      blob: async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
    };
  }
  afterEach(() => setWorkerStoreAccess(null));
  describe("store music scene words", () => {
    it("keeps the scene id exactly `chase` and reads it from pack meta", () => {
      expect(STORE_MUSIC_SCENES).toContain("chase");
      expect(readStoreMusicMeta({ oprnMusic: { sceneRoles: ["chase"] } })?.scenes).toEqual(["chase"]);
    });

    it("normalises the words the model actually sent", () => {
      expect(normalizeStoreMusicScene("village")).toBe("town");
      expect(normalizeStoreMusicScene("City")).toBe("town");
      expect(normalizeStoreMusicScene("마을")).toBe("town");
      expect(normalizeStoreMusicScene("미술관")).toBe("town");
      expect(normalizeStoreMusicScene("maps")).toBe("field");
      expect(normalizeStoreMusicScene("필드")).toBe("field");
      expect(normalizeStoreMusicScene("던전")).toBe("dungeon");
      expect(normalizeStoreMusicScene("동굴")).toBe("dungeon");
      expect(normalizeStoreMusicScene("추격")).toBe("chase");
      expect(normalizeStoreMusicScene("보스")).toBe("boss");
      expect(normalizeStoreMusicScene("credits")).toBe("ending");
      expect(normalizeStoreMusicScene("tense")).toBe("tense");
      expect(normalizeStoreMusicScene("nonsense")).toBeNull();
      expect(normalizeStoreMusicScene(undefined)).toBeNull();
    });

    it("reads a missing scene from the request words (chase before tense, boss before battle)", () => {
      expect(inferStoreMusicScene(undefined, "아오오니 느낌으로 추격 음악")).toBe("chase");
      expect(inferStoreMusicScene(undefined, "쫓아올 때 무서운 곡")).toBe("chase");
      expect(inferStoreMusicScene(undefined, "보스 전투곡")).toBe("boss");
      expect(inferStoreMusicScene(undefined, "옛날 슈패 RPG 같은 16비트 필드")).toBe("field");
      expect(inferStoreMusicScene(undefined, "테일즈런너처럼 신나는 거 마을에 깔아 줘")).toBe("town");
      expect(inferStoreMusicScene(undefined, "좋은 곡")).toBeNull();
    });
  });
  describe("chase scoring", () => {
    it("puts chase tracks first, tense tracks next, and never battle tracks", () => {
      expect(rankStoreMusic(TRACKS, { scene: "chase", query: "아오오니 느낌" }).map((t) => t.assetId)).toEqual(["chase", "tense"]);
      expect(scoreStoreMusic(TRACKS.find((t) => t.assetId === "battle")!, { scene: "chase" })).toBe(-1);
      expect(rankStoreMusic(TRACKS, { scene: "tense" })[0]?.assetId).toBe("tense");
    });
  });
  describe("store_find_music scene arguments", () => {
    const find = async (args: Record<string, unknown>) => {
      setWorkerStoreAccess(fakeStore());
      const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", args, { dryRun: true });
      expect(result.ok, result.summary).toBe(true);
      return result as { summary: string; data: { scene: string | null; tracks: { assetId: string }[] } };
    };

    it("accepts synonyms instead of rejecting them", async () => {
      expect((await find({ scene: "village", query: "추격 호러" })).data).toMatchObject({ scene: "town", tracks: [{ assetId: "hall" }] });
      expect((await find({ scene: "maps", query: "추격 호러" })).data.scene).toBe("field");
      expect((await find({ scene: "미술관", query: "추격 호러" })).data.scene).toBe("town");
    });

    it("reads a missing scene from the query and says so", async () => {
      const result = await find({ query: "아오오니 느낌으로 추격 음악" });
      expect(result.data.scene).toBe("chase");
      expect(result.data.tracks[0]?.assetId).toBe("chase");
      expect(result.summary).toMatch(/→ chase/u);
    });
  });
  describe("set_game_audio role chase", () => {
    const music = (project: Project) => listAudioResources("music", project)[0]!.id;
    const chaseProject = () => {
      const ctx = { project: createBlankProject() };
      const must = (name: string, args: Record<string, unknown>) => {
        const result = runTool(ctx, name, args, { dryRun: false });
        expect(result.ok, result.summary).toBe(true);
        return result;
      };
      must("create_map", { id: "map_cellar", name: "지하실", width: 20, height: 15 });
      must("upsert_event", { mapId: "map_cellar", event: { id: "ev_safe", name: "금고", x: 15, y: 10, commands: [{ kind: "setSwitch", switchId: "sw_chase_on", value: true }] } });
      must("upsert_event", { mapId: "map_cellar", event: { id: "ev_calm", name: "진정", x: 16, y: 10, commands: [{ kind: "setSwitch", switchId: "sw_chase_on", value: false }] } });
      must("make_chase_scene", { mapId: "map_cellar", id: "ev_chaser", chaser: { at: { x: 3, y: 3 }, speed: 4 }, activateSwitch: "sw_chase_on", killOnTouch: true, hidingSpots: [], patrol: { mode: "auto" } });
      return { ctx, must };
    };
    const commandsOf = (project: Project, eventId: string) => project.maps.map_cellar!.events.find((e) => e.id === eventId)!.pages!.flatMap((page) => page.commands);

    it("refuses when there is no chaser instead of creating one", () => {
      const project = createBlankProject();
      const result = runTool({ project }, "set_game_audio", { role: "chase", resourceId: music(project) }, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(result.summary).toMatch(/추격자가 없습니다/u);
    });

    it("switches the music where the chase switch turns on, restores it where it turns off, and leaves battle music alone", () => {
      const { ctx, must } = chaseProject();
      const id = music(ctx.project);
      const battle = ctx.project.system.battleBgmResourceId;
      // bgmResourceId 는 resourceId 의 다른 이름으로 받는다.
      must("set_game_audio", { role: "chase", bgmResourceId: id, mapIds: ["map_cellar"] });
      must("set_game_audio", { role: "chase", resourceId: id }); // 두 번 걸어도 겹치지 않는다
      // 이미 켜져 있으면(금고를 다시 조사) 기억하지 않는다 — 추격 곡을 «평소 곡»으로 덮으면 끌 때 되돌아오지 않는다.
      expect(commandsOf(ctx.project, "ev_safe")).toEqual([
        { kind: "fork", condition: { kind: "switch", switchId: "sw_chase_on", value: false }, then: [
          { kind: "m2Command", commandId: "m2-063-memorize-current-bgm", fields: {} },
          { kind: "playAudio", resourceId: id, loop: true, channel: "bgm" },
        ] },
        { kind: "setSwitch", switchId: "sw_chase_on", value: true },
      ]);
      expect(commandsOf(ctx.project, "ev_calm")).toEqual([
        { kind: "setSwitch", switchId: "sw_chase_on", value: false },
        { kind: "m2Command", commandId: "m2-064-play-memorized-bgm", fields: {} },
      ]);
      expect(ctx.project.system.battleBgmResourceId).toBe(battle);
      // 추격자의 순찰 경로(이동 명령)에는 곡 명령이 들어가지 않는다.
      expect(JSON.stringify(ctx.project.maps.map_cellar!.events.find((e) => e.id === "ev_chaser")!.pages![0]!.movement)).not.toMatch(/playAudio|m2-06/u);
    });

    it("makes an always-present chaser's map music the chase track", () => {
      const { ctx, must } = chaseProject();
      must("make_chase_scene", { mapId: "map_cellar", id: "ev_ghost", chaser: { at: { x: 6, y: 6 }, speed: 4 }, killOnTouch: true, hidingSpots: [] });
      const id = music(ctx.project);
      const result = must("set_game_audio", { role: "chase", resourceId: id });
      expect((result.data as { chasers: { eventId: string; via: string }[] }).chasers).toEqual(expect.arrayContaining([
        { mapId: "map_cellar", eventId: "ev_chaser", via: "switch" }, { mapId: "map_cellar", eventId: "ev_ghost", via: "map-bgm" },
      ]));
      expect(ctx.project.maps.map_cellar!.bgm).toEqual({ mode: "custom", resourceId: id });
    });

    it("flags chase music wired to every battle", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      after.system.battleBgmResourceId = "store_chase";
      expect(gameLines(before, after, "아오오니 느낌으로 추격 음악 넣어줘").join("\n")).toMatch(/role:'chase'/u);
    });
  });
});
