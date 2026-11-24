import { describe, expect, it, afterEach } from "vitest";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { THIS_EVENT_MOVE_TARGET, buildEventTargetCatalog, canonicalMoveTargetValue, matchEventTargets, moveTargetIssueMessage, moveTargetPromptSection, resolveMoveTarget } from "@/project/eventTargetCatalog";
import { buildEventAssistPrompt, parseAndValidate } from "@/ai/eventCommandAssist";
import { createBlankProject } from "@/project/defaults";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, Project, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { CHASE_MAX_EXPANSIONS, findChasePath, nextChaseDecision } from "@/player/chaseAi";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { event, fixture, ticks, pos } from "./fixtures/npcChasePathfinding";
import { invalidateTilePassabilityComponents } from "@/project/tilePassabilityComponents";
import assert from "node:assert/strict";
import { runTool } from "@/editor/tools";
import { initialGameTime } from "@/project/gameTime";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import { OBJECT_SPEC_SCHEMA, objectSpecPassage, validateObjectSpec, type ObjectSpecV1 } from "@/project/objectSpec";
import { migrateLegacyWorkshopKit, objectSpecOfKit, specFromLegacyWorkshopTags } from "@/project/objectSpecKits";
import { bakeWorkshopObject, workshopHandObjects, workshopObjectId, type WorkshopObjectInput } from "@/project/workshopTiles";
import { packObjects } from "@/assetStore/pack";
import { STORE_PACK_SCHEMA, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { resolveAnimaticCameraAxis, sampleAnimaticTrack, type AnimaticKey } from "@/project/openingAnimatic";
import { isolateTimers } from "./mergedTeardown";

// test/moveRouteEventTarget.test.ts
//
// OPRN-OUT-012 — moveEvent 「누구를」 대상의 공용 카탈로그·해석기.
//
// 재현된 결함: 조수가 `{"kind":"moveEvent","eventId":"this"}` 를 내면 검증을 전부 통과하고
// 저장돼, 스튜디오에는 «이동 경로 설정 this (없음)» 으로 보이고 테스트 플레이에서는
// 대상 NPC 가 움직이지 않았다(runtime 은 "this" 라는 이름의 이벤트를 찾다 실패한다).
//
// 이 파일이 못 박는 것:
//  1. 카탈로그가 현재 맵 이벤트를 이름+정본 id 로 열거하고 특수값 둘을 정확히 말한다.
//  2. 해석기가 `this`·이름 같은 비정본 값을 정본값으로 옮기고, 못 옮기면 실행 가능한 오류를 낸다.
//  3. 조수 출력 검증이 적용 **전에** 그 오류를 내서 자가수정 루프가 고칠 수 있다.
//  4. 테스트 플레이(런타임)에서 정본 id 는 대상 이벤트를 실제로 움직이고 `this` 는 못 움직인다.
describe("moveRouteEventTarget", () => {
  isolateTimers();
  function pageNamed(name: string): EventPage {
    return {
      id: `pg_${name}`,
      name,
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
    return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [pageNamed(name)] };
  }
  /** 문지기 / 상인 / 이름이 겹치는 경비 둘이 있는 맵. */
  function projectWithEvents(): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events = [
      eventNamed("ev_npc_gate", "문지기", 3, 4),
      eventNamed("ev_npc_merchant", "상인", 8, 2),
      eventNamed("ev_npc_guard_a", "경비", 1, 1),
      eventNamed("ev_npc_guard_b", "경비", 9, 9),
    ];
    store.replace(project);
    return project;
  }
  describe("이벤트 대상 카탈로그", () => {
    it("현재 맵 이벤트를 이름과 정본 id 로 함께 열거한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(catalog.entries.map((entry) => entry.id)).toEqual([
        "ev_npc_gate",
        "ev_npc_merchant",
        "ev_npc_guard_a",
        "ev_npc_guard_b",
      ]);
      expect(catalog.entries[0].name).toBe("문지기");
    });

    it("이름이 겹치는 이벤트는 좌표로 구분되는 라벨을 갖는다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const guards = catalog.entries.filter((entry) => entry.name === "경비");
      expect(guards).toHaveLength(2);
      expect(guards[0].label).not.toBe(guards[1].label);
      expect(guards[0].label).toContain("경비");
      expect(guards[0].label).toContain("1");
      // 겹치지 않는 이름은 꾸미지 않는다.
      expect(catalog.entries[0].label).toBe("문지기");
    });

    it("특수값 둘의 저장 형태를 그대로 유지한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(THIS_EVENT_MOVE_TARGET).toBe("");
      expect(resolveMoveTarget("", catalog)).toMatchObject({ kind: "this", storedValue: "" });
      expect(resolveMoveTarget(PLAYER_MOVE_TARGET, catalog)).toMatchObject({
        kind: "player",
        storedValue: PLAYER_MOVE_TARGET,
      });
    });

    it("정본 id 는 항목과 함께 해석된다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const resolved = resolveMoveTarget("ev_npc_merchant", catalog);
      expect(resolved.kind).toBe("event");
      if (resolved.kind !== "event") throw new Error("expected event target");
      expect(resolved.entry.name).toBe("상인");
      expect(resolved.storedValue).toBe("ev_npc_merchant");
    });

    it("«this» 같은 비정본 낱말을 이 이벤트 특수값으로 옮긴다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      for (const alias of ["this", "This", " self ", "@this"]) {
        expect(resolveMoveTarget(alias, catalog), alias).toMatchObject({ kind: "this", storedValue: "" });
        expect(canonicalMoveTargetValue(alias, catalog), alias).toBe("");
      }
      for (const alias of ["player", "주인공", "@Player"]) {
        expect(canonicalMoveTargetValue(alias, catalog), alias).toBe(PLAYER_MOVE_TARGET);
      }
    });

    it("유일한 표시 이름은 정본 id 로 옮기고, 겹치는 이름은 모호로 반려한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(canonicalMoveTargetValue("문지기", catalog)).toBe("ev_npc_gate");
      const ambiguous = resolveMoveTarget("경비", catalog);
      expect(ambiguous.kind).toBe("unresolved");
      if (ambiguous.kind !== "unresolved") throw new Error("expected unresolved");
      expect(ambiguous.reason).toBe("ambiguous");
      expect(ambiguous.candidates.map((entry) => entry.id)).toEqual(["ev_npc_guard_a", "ev_npc_guard_b"]);
      expect(canonicalMoveTargetValue("경비", catalog)).toBeNull();
    });

    it("다른 맵의 이벤트 id 는 남의 맵임을 지목한다(이동 경로는 현재 맵만 움직인다)", () => {
      const project = projectWithEvents();
      project.maps.map_far = {
        ...project.maps[project.startMapId],
        id: "map_far",
        name: "먼 마을",
        events: [eventNamed("ev_npc_far", "뱃사공", 2, 2)],
      };
      store.replace(project);
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const resolved = resolveMoveTarget("ev_npc_far", catalog);
      expect(resolved.kind).toBe("unresolved");
      if (resolved.kind !== "unresolved") throw new Error("expected unresolved");
      expect(resolved.reason).toBe("foreignMap");
      expect(moveTargetIssueMessage("ev_npc_far", catalog)).toContain("먼 마을");
    });

    it.each(["self", "player", "문지기"])("does not reinterpret the foreign ID %s as a local alias or name", (id) => {
      const project = projectWithEvents();
      project.maps.map_far = {
        ...project.maps[project.startMapId], id: "map_far", name: "Far map",
        events: [eventNamed(id, "Foreign event", 2, 2)],
      };
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(resolveMoveTarget(id, catalog)).toMatchObject({
        kind: "unresolved", reason: "foreignMap", storedValue: id, foreign: { id, mapId: "map_far" },
      });
      expect(canonicalMoveTargetValue(id, catalog)).toBeNull();
      const parsed = parseAndValidate(project, JSON.stringify([
        { kind: "moveEvent", eventId: id, route: { moves: [], repeat: false } },
      ]), { mapId: project.startMapId });
      expect(parsed.ok).toBe(false);

      project.maps[project.startMapId].events.push(eventNamed(id, "Local exact ID", 1, 2));
      expect(resolveMoveTarget(id, buildEventTargetCatalog(project, project.startMapId))).toMatchObject({
        kind: "event", storedValue: id, entry: { id, name: "Local exact ID" },
      });
    });

    it("모르는 값은 실행 가능한 진단 문구를 낸다 — 특수값 둘과 후보 id 를 함께 말한다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const message = moveTargetIssueMessage("ev_ghost", catalog);
      expect(message).toContain("ev_ghost");
      expect(message).toContain(PLAYER_MOVE_TARGET);
      expect(message).toContain("ev_npc_gate");
    });

    it("검색은 표시 이름과 id 를 모두 맞춘다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      expect(matchEventTargets(catalog, "상인").map((entry) => entry.id)).toEqual(["ev_npc_merchant"]);
      expect(matchEventTargets(catalog, "guard_b").map((entry) => entry.id)).toEqual(["ev_npc_guard_b"]);
      expect(matchEventTargets(catalog, "").map((entry) => entry.id)).toHaveLength(4);
      expect(matchEventTargets(catalog, "없는것")).toEqual([]);
    });

    it("프롬프트 절이 특수값 둘과 현재 맵 이벤트 목록을 함께 싣는다", () => {
      const project = projectWithEvents();
      const catalog = buildEventTargetCatalog(project, project.startMapId);
      const section = moveTargetPromptSection(catalog);
      expect(section).toContain(PLAYER_MOVE_TARGET);
      expect(section).toContain("ev_npc_gate");
      expect(section).toContain("문지기");
      // 실제로 났던 오작동을 이름으로 금지한다.
      expect(section).toContain("this");
    });
  });
  describe("조수 moveEvent 대상 검증", () => {
    it("프롬프트에 이동 대상 프로토콜 절이 들어간다", () => {
      const project = projectWithEvents();
      const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
      expect(prompt).toContain("ev_npc_gate");
      expect(prompt).toContain(PLAYER_MOVE_TARGET);
    });

    it("«this» 대상을 적용 전에 이 이벤트 특수값으로 정본화한다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([{ kind: "moveEvent", eventId: "this", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } }]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" / "));
      expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("");
    });

    it("이름으로 지목한 대상을 정본 id 로 옮긴다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([{ kind: "moveEvent", eventId: "상인", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } }]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" / "));
      expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("ev_npc_merchant");
    });

    it("해석 불가 대상은 자가수정 루프가 읽을 오류로 반려한다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([{ kind: "moveEvent", eventId: "ev_does_not_exist", route: { moves: [], repeat: false } }]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unresolved target must be rejected");
      expect(result.errors.join(" ")).toContain("moveEvent");
      expect(result.errors.join(" ")).toContain("ev_does_not_exist");
      expect(result.errors.join(" ")).toContain("ev_npc_gate");
    });

    it("중첩 분기 안의 대상도 검사한다", () => {
      const project = projectWithEvents();
      const nested = parseAndValidate(
        project,
        JSON.stringify([
          {
            kind: "fork",
            condition: { kind: "selfSwitch", key: "A", value: true },
            then: [{ kind: "moveEvent", eventId: "this", route: { moves: [], repeat: false } }],
          },
        ]),
        { mapId: project.startMapId },
      );
      expect(nested.ok).toBe(true);
      if (!nested.ok) throw new Error(nested.errors.join(" / "));
      const fork = nested.commands[0] as Extract<Command, { kind: "fork" }>;
      expect((fork.then[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("");
    });

    it("주인공 특수값은 그대로 통과한다", () => {
      const project = projectWithEvents();
      const result = parseAndValidate(
        project,
        JSON.stringify([
          { kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [{ kind: "move", dir: "up" }], repeat: false } },
        ]),
        { mapId: project.startMapId },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join(" / "));
      expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe(PLAYER_MOVE_TARGET);
    });
  });
  describe("테스트 플레이에서의 이동 대상", () => {
    function moverScene(project: Project) {
      const map = project.maps[project.startMapId];
      return {
        map,
        session: startSession(project),
        eventPositions: initialRuntimeEventPositions(map.events),
        autonomousNPCs: new Map(),
      };
    }

    it("정본 id 는 그 이벤트를 실제로 움직인다", () => {
      const project = projectWithEvents();
      const scene = moverScene(project);
      registerAutonomousMover(scene, "ev_npc_merchant", [{ kind: "move", dir: "up" }], false);
      expect(scene.autonomousNPCs.has("ev_npc_merchant")).toBe(true);
    });

    it("«this» 는 어떤 이벤트도 움직이지 않는다 — 이 결함이 보고된 증상이다", () => {
      const project = projectWithEvents();
      const scene = moverScene(project);
      registerAutonomousMover(scene, "this", [{ kind: "move", dir: "up" }], false);
      expect(scene.autonomousNPCs.size).toBe(0);
    });

    it("정본화를 거친 조수 출력은 테스트 플레이에서 대상을 움직인다", () => {
      const project = projectWithEvents();
      const parsed = parseAndValidate(
        project,
        JSON.stringify([
          { kind: "moveEvent", eventId: "상인", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } },
        ]),
        { mapId: project.startMapId },
      );
      if (!parsed.ok) throw new Error(parsed.errors.join(" / "));
      const command = parsed.commands[0] as Extract<Command, { kind: "moveEvent" }>;
      const scene = moverScene(project);
      registerAutonomousMover(scene, command.eventId, command.route.moves, command.route.repeat);
      expect(scene.autonomousNPCs.has("ev_npc_merchant")).toBe(true);
    });
  });
});

describe("npcPathfinding8", () => {
  isolateTimers();
  const original = store.getCurrent;
  afterEach(() => { store.getCurrent = original; });
  const living = (x: number, y: number) => ({ movement: { type: 'living', speed: 8, frequency: 8, living: { destinations: [{ mapId: 'm', x, y }], repeat: false } } });
  function corridor(pocket: number | null, three = false, reverse = false) {
   const events = [event('a',3,1,living(8,1)), event('b',4,1,living(0,1))];
   if (three) events.push(event('c',5,1,living(1,1)));
   if (reverse) events.reverse();
   const f = fixture(9,3,events,-10,-10);
   f.map.lowerTiles.fill(1);
   for(let x=0;x<9;x++) f.map.lowerTiles[9+x]=0;
   if(pocket!==null) f.map.lowerTiles[pocket]=0;
   // Rebuild routes after the terrain fixture changes.
   f.scene.autonomousNPCs.clear(); f.scene.pageMoveRouteKeys.clear(); f.scene.pageMoveRouteEventIds.clear();
   registerPageMoveRoutes(f.scene);
   return f;
  }
  function run(s:any, n=500) {for(let i=0;i<n;i++){ticks(s,1);registerPageMoveRoutes(s);}}
  it.each([false,true])('backs up several steps into a pocket; reverse=%s', reverse => {
   const f=corridor(1,false,reverse); run(f.scene);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1}); expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});
  });
  it.each([false,true])('resolves three-person chain at its free end; reverse=%s', reverse => {
   const f=corridor(2,true,reverse); run(f.scene,900);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1}); expect(pos(f.scene,'b')).toMatchObject({x:0,y:1}); expect(pos(f.scene,'c')).toMatchObject({x:1,y:1});
  });
  it('impossible corridor stays still rather than oscillating',()=>{
   const f=corridor(null,true);run(f.scene,60);const before=JSON.stringify(f.scene.eventPositions);run(f.scene,400);expect(JSON.stringify(f.scene.eventPositions)).toBe(before);
  });
  it('fixed blocker is bypassed when a detour exists and waits otherwise',()=>{
   for(const detour of [false,true]){
    const f=fixture(7,3,[event('a',0,1,living(6,1)),event('fixed',3,1,{movement:{type:'fixed'}})],-10,-10);
    if(!detour){for(let x=0;x<7;x++){f.map.lowerTiles[x]=1;f.map.lowerTiles[14+x]=1;}}
    run(f.scene);expect(pos(f.scene,'a').x).toBe(detour?6:2);expect(pos(f.scene,'fixed').x).toBe(3);
   }
  });
  it.each([false,true])('pathfind=false escapes a wall without an immediate reverse step; mirrored=%s', mirrored=>{
   const f=fixture(7,7,[],5,3);for(let y=1;y<=5;y++)f.map.lowerTiles[y*7+3]=1;
   const target={x:mirrored?1:5,y:3};
   let from={x:mirrored?4:2,y:3};const mover={timer:0,moveIntervalMs:80};const trail=[from];let touched=false;
   for(let i=0;i<60;i++) {const d=nextChaseDecision({...f,from,player:target,mover,deltaMs:80,pathfind:false});if(d.kind==='touch'){touched=true;break;}if(d.kind==='move'){from={x:d.x,y:d.y};trail.push(from);}}
   for(let i=2;i<trail.length;i++)expect(trail[i]).not.toEqual(trail[i-2]);
   expect(touched).toBe(true);
  });
  it('caps a single unreachable A* to 2048 node expansions',()=>{
   const f=fixture(100,100,[],50,50);let queries=0;
   const path=findChasePath(f.project,f.map,{x:0,y:0},{x:50,y:50},{footprint:{width:1,height:1},passRows:1,blocked:(x,y)=>{queries++;return Math.abs(x-50)+Math.abs(y-50)===1;}},undefined,CHASE_MAX_EXPANSIONS);
   expect(path).toEqual([]);expect(queries).toBeLessThanOrEqual(2048*4);
   console.log('bounded A* passage queries',queries);
  });
  it('uncapped callers (schedules, coordinate moves, doors) still find long detours past 2048 expansions',()=>{
   // 100x100 serpentine: walls on every other row leave one gap, alternating ends — the path is ~5000 cells.
   const f=fixture(100,100,[],99,99);
   const blocked=(x:number,y:number)=>y%2===1&&(Math.floor(y/2)%2===0?x!==99:x!==0);
   const pass={footprint:{width:1,height:1},passRows:1,blocked};
   const path=findChasePath(f.project,f.map,{x:0,y:0},{x:99,y:98},pass);
   expect(path.length).toBeGreaterThan(2048);
   expect(path.at(-1)).toEqual({x:99,y:98});
   expect(findChasePath(f.project,f.map,{x:0,y:0},{x:99,y:98},pass,undefined,CHASE_MAX_EXPANSIONS)).toEqual([]);
  });
  it('the trailing end yields first when only that end has spare space',()=>{
   const f=corridor(6,true);f.map.lowerTiles[7]=0;run(f.scene,1200);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1});expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});expect(pos(f.scene,'c')).toMatchObject({x:1,y:1});
  });
  // Oracle captured from ef5375b2fa, seed 928, LCG 1664525/1013904223; 70/80 targets reachable.
  it('keeps legacy A* bytes on 80 deterministic small maps', async()=>{
   const {default:cases}=await import('./fixtures/npcChasePathfinding8Oracle.json');
   for(const sample of cases){const f=fixture(12,12,[],11,11);f.map.lowerTiles=sample.tiles;expect(JSON.stringify(findChasePath(f.project,f.map,{x:0,y:0},{x:11,y:11}))).toBe(JSON.stringify(sample.path));}
  });
  it('does not park on a peer destination even when that side pocket is nearer',()=>{
   const f=corridor(1);f.map.lowerTiles[2]=0;
   f.map.events.find((e:any)=>e.id==='b').pages[0].movement=living(2,0).movement;
   registerPageMoveRoutes(f.scene);run(f.scene,700);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1});expect(pos(f.scene,'b')).toMatchObject({x:2,y:0});
  });
  it('backs up a wide body into a full-width pocket, never the narrow opening',()=>{
   const body={footprint:{width:2,height:1},passRows:1};
   const f=fixture(11,3,[event('a',4,1,{...living(9,1),...body}),event('b',6,1,{...living(0,1),...body})],-10,-10);
   f.map.lowerTiles.fill(1);for(let x=0;x<11;x++)f.map.lowerTiles[11+x]=0;for(const x of [2,3,4])f.map.lowerTiles[x]=0;
   f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
   run(f.scene,700);expect(pos(f.scene,'a')).toMatchObject({x:9,y:1});expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});
  });
  it('capped chase A* widens its cap on following frames and still reaches a 198-cell detour',()=>{
   // Adversarial review repro: a 100x100 wall with one gap at the far end. The first capped search fails;
   // before the fix every 500ms retry repeated the same 2048 cap and the chaser waited forever.
   const f=fixture(100,100,[],51,1);for(let y=0;y<99;y++)f.map.lowerTiles[y*100+50]=1;
   const player={x:51,y:1};let from={x:49,y:1};const mover:any={timer:0,moveIntervalMs:80};let touched=false;let searchesFrame1=0;
   for(let i=0;i<600&&!touched;i++){const d=nextChaseDecision({...f,from,player,mover,deltaMs:80});if(i===0)searchesFrame1=mover.chaseExpansionCap??0;if(d.kind==='touch')touched=true;else if(d.kind==='move')from={x:d.x,y:d.y};}
   expect(searchesFrame1).toBe(CHASE_MAX_EXPANSIONS*2);
   expect(touched).toBe(true);
  });
  it('pathfind=false keeps touching an adjacent stationary target',()=>{
   const f=fixture(5,3,[],2,1);const mover={timer:0,moveIntervalMs:80};const kinds:string[]=[];
   for(let i=0;i<8;i++)kinds.push(nextChaseDecision({...f,from:{x:1,y:1},player:{x:2,y:1},mover,deltaMs:500,pathfind:false}).kind);
   expect(kinds).toEqual(Array(8).fill('touch'));
  });
  it('a yielder resumes once a detour opens even when the peer parks on its original cell',()=>{
   // Adversarial review repro: width-2 bodies, b's destination is a's original cell.
   const body={footprint:{width:2,height:1},passRows:1};
   const f=fixture(11,3,[event('a',4,1,{...living(9,1),...body}),event('b',6,1,{...living(4,1),...body})],-10,-10);
   f.map.lowerTiles.fill(1);for(let x=0;x<11;x++)f.map.lowerTiles[11+x]=0;for(const x of [2,3,4,5])f.map.lowerTiles[x]=0;
   f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
   for(let i=0;i<1000;i++){if(i===200){for(let x=6;x<11;x++)f.map.lowerTiles[x]=0;invalidateTilePassabilityComponents(f.map);}ticks(f.scene,1);registerPageMoveRoutes(f.scene);}
   expect(pos(f.scene,'a')).toMatchObject({x:9,y:1});expect(pos(f.scene,'b')).toMatchObject({x:4,y:1});
  });
  it.each([32,33])('a %i-NPC head-on line still resolves (group cap falls back to the pair)',n=>{
   const start=n+1,w=2*n+5,events=[event('a',start,1,living(w-1,1))];for(let k=1;k<n;k++)events.push(event('e'+k,start+k,1,living(k-1,1)));
   const f=fixture(w,3,events,-10,-10);f.map.lowerTiles.fill(1);for(let x=0;x<w;x++)f.map.lowerTiles[w+x]=0;f.map.lowerTiles[start]=0;
   f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
   for(let i=0;i<3500;i++){ticks(f.scene,1);registerPageMoveRoutes(f.scene);}
   const reached=events.filter(e=>{const p=pos(f.scene,e.id),d=(e.pages[0] as any).movement.living.destinations[0];return p.x===d.x&&p.y===d.y}).length;
   expect(reached).toBe(n);
  },120_000);
});

describe("npcScheduleMoveSync", () => {
  isolateTimers();
  // 2026-09-23 추리 도그푸딩: 마을 주민을 경찰로 바꿔 move_event 로 옮겼지만 시간표 아침 칸이 옛 자리에
  // 남아, 끝에 시간 시스템이 켜지자 NPC 가 옛 자리로 돌아가 지목 대화를 찾을 수 없었다.
  function fixture() {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const map = ctx.project.maps[mapId];
    assert(map);
    const npc: GameEvent = {
      id: "ev_police", name: "경찰", x: 5, y: 5, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: "p", name: "경찰", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "지목" }],
      }],
      schedule: [
        { when: { timePhase: "morning" }, at: { mapId, x: 5, y: 5 }, facing: "down", activity: "아침 집안일" },
        { when: { timePhase: "day" }, at: { mapId, x: 9, y: 3 }, facing: "left", activity: "창문 닦기" },
      ],
    };
    map.events.push(npc);
    return { ctx, mapId, map };
  }
  describe("NPC 시간표와 배치 동기화", () => {
    it("move_event 는 옛 자리에 있던 시간표 칸을 새 자리로 옮기고 남은 칸을 알린다", () => {
      const { ctx, mapId } = fixture();
      const result = runTool(ctx, "move_event", { mapId, eventId: "ev_police", x: 7, y: 6 });
      assert(result.ok, result.summary);
      const event = ctx.project.maps[mapId]?.events.find((entry) => entry.id === "ev_police");
      assert(event?.schedule);
      expect({ x: event.x, y: event.y }).not.toEqual({ x: 5, y: 5 });
      expect(event.schedule[0]?.at).toEqual({ mapId, x: event.x, y: event.y });
      expect(event.schedule[1]?.at).toEqual({ mapId, x: 9, y: 3 });
      const warnings = result.diff?.warnings.join("\n") ?? "";
      expect(warnings).toMatch(/시간표/);
      expect(warnings).toMatch(/창문 닦기/);
    });

    it("configure_time_system 은 켜는 순간 시간표 위치로 끌려갈 NPC 를 알린다", () => {
      const { ctx, map } = fixture();
      const event = map.events.find((entry) => entry.id === "ev_police");
      assert(event);
      event.x = 2;
      event.y = 2;
      const result = runTool(ctx, "configure_time_system", { enabled: true });
      assert(result.ok, result.summary);
      const system = ctx.project.system.timeSystem;
      const target = npcScheduleTargetForEvent(map.id, event, initialGameTime(system), undefined);
      expect(target).toMatchObject({ x: 5, y: 5, matched: true });
      const warnings = result.diff?.warnings.join("\n") ?? "";
      expect(warnings).toMatch(/경찰/);
      expect(warnings).toMatch(/\(2, 2\).*\(5, 5\)/);
    });

    it("configure_time_system 은 시간표와 배치가 맞으면 조용하다", () => {
      const { ctx } = fixture();
      const result = runTool(ctx, "configure_time_system", { enabled: true });
      assert(result.ok, result.summary);
      expect(result.diff?.warnings ?? []).toEqual([]);
    });
  });
});

// ObjectSpec v1 — tile-gen·스토어·에디터가 같이 읽는 기물 설명서. 검사, 공방 옛 태그 이주, 공방 굽기, 팩 목록.
describe("objectSpec", () => {
  isolateTimers();
  const ID = "atlas_biome_interior";
  const well = (over: Partial<ObjectSpecV1> = {}): ObjectSpecV1 => ({
    schema: OBJECT_SPEC_SCHEMA, id: "stone-well", name: "돌 우물", category: "prop", tags: ["우물"], tileSize: 16,
    size: { w: 2, h: 2 }, view: { footRows: 1, risePx: 0 }, layer: "upper",
    placement: { anchor: "outdoor", use: ["decor"] }, provenance: { aiGenerated: true, tool: "tile-gen/0.1.0" }, ...over,
  });
  const shelf = (over: Partial<WorkshopObjectInput> = {}): WorkshopObjectInput => ({
    objectId: workshopObjectId("new:약초 선반"), title: "약초 선반", description: "말린 약초", kind: "floor",
    columns: 2, rows: 2, footRows: 1, risePx: 16, use: ["search"], gridHash: "h1",
    asset: { id: "workshop_test", dataUrl: "data:image/png;base64,AA", width: 480, height: 16 },
    cells: [{ sourceTile: 0, dx: 0, dy: 0 }, { sourceTile: 1, dx: 1, dy: 0 }, { sourceTile: 2, dx: 0, dy: 1 }, { sourceTile: 3, dx: 1, dy: 1 }],
    ...over,
  });
  describe("ObjectSpec v1 검사", () => {
    it("올바른 설명서를 받고, 크기와 통행 줄이 어긋나면 거절한다", () => {
      expect(validateObjectSpec(well()).ok).toBe(true);
      expect(validateObjectSpec(well({ passage: ["**", "XX"] })).ok).toBe(true);
      expect(validateObjectSpec(well({ passage: ["**"] })).ok).toBe(false);
      expect(validateObjectSpec(well({ view: { footRows: 3, risePx: 0 } })).ok).toBe(false);
      expect(validateObjectSpec({ ...well(), schema: "x" }).ok).toBe(false);
      expect(validateObjectSpec({ ...well(), provenance: {} }).ok).toBe(false);
      expect(validateObjectSpec(well({ id: "workshop:돌-우물" })).ok).toBe(true);
      expect(validateObjectSpec(well({ id: "has space" })).ok).toBe(false);
    });

    it("통행이 없으면 발밑 줄에서 유도한다", () => {
      expect(objectSpecPassage(well())).toEqual(["**", "XX"]);
      expect(objectSpecPassage(well({ placement: { anchor: "flat" } }))).toEqual(["..", ".."]);
    });
  });
  describe("공방 옛 태그 → 설명서", () => {
    const legacy = (): SectionStructureKitDef => ({
      id: "workshop:선반", kind: "section", name: "선반", width: 2, height: 2,
      rows: [{ tiles: [-1, -1], upperTiles: [10, 11] }, { tiles: [-1, -1], upperTiles: [12, 13] }],
      ai: { description: "책 선반", placementRules: "바닥에 둔다.", tags: ["tall", "workshop", "hand:wall", "foot:1", "rise:12", "grid:abc", "use:storage"] },
      learnedFrom: "workshop",
    });

    it("옛 태그를 정식 칸으로 읽고, 이주하면 인코딩 태그를 뺀다", () => {
      const kit = legacy();
      const spec = specFromLegacyWorkshopTags(kit, 16)!;
      expect(spec.placement.anchor).toBe("wall");
      expect(spec.view).toEqual({ footRows: 1, risePx: 12 });
      expect(spec.placement.use).toEqual(["storage"]);
      expect(spec.art?.gridHash).toBe("abc");
      expect(spec.tags).toEqual(["tall", "workshop"]);
      expect(validateObjectSpec(spec).ok).toBe(true);
      expect(migrateLegacyWorkshopKit(kit, 16)).toBe(true);
      expect(kit.spec?.placement.anchor).toBe("wall");
      expect(kit.ai?.tags).toEqual(["tall", "workshop"]);
      expect(objectSpecOfKit(kit)?.view.risePx).toBe(12);
    });

    it("공방이 아닌 킷의 use: 태그는 건드리지 않는다", () => {
      const kit = { ...legacy(), learnedFrom: "user-paint" as const, ai: { description: "", placementRules: "", tags: ["use:sit"] } };
      expect(migrateLegacyWorkshopKit(kit, 16)).toBe(false);
      expect(kit.ai.tags).toEqual(["use:sit"]);
    });
  });
  describe("공방 굽기는 설명서를 쓴다", () => {
    it("새 킷은 spec 을 갖고 옛 인코딩 태그가 없으며, 방 짓기 사양으로 같은 값이 나온다", () => {
      const p = createBlankProject();
      const kit = bakeWorkshopObject(p, ID, shelf({ review: { pick: { by: "human", at: "2026-10-20T00:00:00Z" } } }));
      expect(kit.spec?.schema).toBe(OBJECT_SPEC_SCHEMA);
      expect(validateObjectSpec(kit.spec).ok).toBe(true);
      expect(kit.spec?.view).toEqual({ footRows: 1, risePx: 16 });
      expect(kit.spec?.passage).toEqual(["**", "XX"]);
      expect(kit.spec?.art?.gridHash).toBe("h1");
      expect(kit.spec?.review?.pick?.by).toBe("human");
      expect(kit.ai?.tags?.some((tag) => /^(hand|foot|rise|grid|use):/.test(tag))).toBe(false);
      const hand = workshopHandObjects(p.tilesets[ID])[kit.id]!;
      expect(hand).toMatchObject({ kind: "floor", h: 1, up: 16, use: ["search"] });
      // 같은 격자 해시면 다시 늘리지 않는다(해시는 spec.art.gridHash 에서 읽는다)
      const count = p.tilesets[ID]!.count;
      bakeWorkshopObject(p, ID, shelf());
      expect(p.tilesets[ID]!.count).toBe(count);
    });
  });
  describe("스토어 팩 content.objects", () => {
    const tileset = (kits: SectionStructureKitDef[]): TilesetDef => ({
      id: "ts_a", name: "우물", kind: "custom", image: { type: "uploaded", id: "a_1" }, tileSize: 16, tilesPerRow: 2, count: 4,
      passability: Array.from({ length: 4 }, () => ({ up: true, down: true, left: true, right: true })),
      priority: ["upper", "upper", "upper", "upper"], terrain: [0, 0, 0, 0], structureKits: kits,
    });
    const kit = (spec?: ObjectSpecV1): SectionStructureKitDef => ({
      id: "stone-well", kind: "section", name: "돌 우물", width: 2, height: 2,
      rows: [{ tiles: [-1, -1], upperTiles: [0, 1] }, { tiles: [-1, -1], upperTiles: [2, 3] }], learnedFrom: "pack-preset", ...(spec ? { spec } : {}),
    });
    const sha = "a".repeat(64);
    const manifest = (objects: unknown): StorePackManifest => ({
      schema: STORE_PACK_SCHEMA, title: "우물", summary: "", description: "", tags: [], kind: "tileset", license: "CC0", aiGenerated: true, credits: "tile-gen",
      content: { assets: { a_1: { id: "a_1", name: "우물", kind: "chipset", blob: sha, mime: "image/png", meta: { width: 32, height: 32 } } }, tilesets: { ts_a: tileset([kit(well())]) }, objects } as StorePackManifest["content"],
      previews: [sha], blobs: [{ sha256: sha, mime: "image/png", bytes: 10 }],
    });

    it("설명서가 있는 킷만 목록이 된다", () => {
      expect(packObjects({ ts_a: tileset([kit(well()), kit()]) })).toEqual([{ tileset: "ts_a", kit: "stone-well", spec: well() }]);
    });

    it("매니페스트 검사: 맞는 목록은 받고, 없는 킷·틀린 설명서·id 불일치는 거절한다", () => {
      expect(validateManifest(manifest([{ tileset: "ts_a", kit: "stone-well", spec: well() }])).ok).toBe(true);
      expect(validateManifest(manifest(undefined)).ok).toBe(true);
      expect(validateManifest(manifest([{ tileset: "ts_a", kit: "nope", spec: well({ id: "nope" }) }])).ok).toBe(false);
      expect(validateManifest(manifest([{ tileset: "ts_x", kit: "stone-well", spec: well() }])).ok).toBe(false);
      expect(validateManifest(manifest([{ tileset: "ts_a", kit: "stone-well", spec: { ...well(), size: { w: 0, h: 2 } } }])).ok).toBe(false);
      expect(validateManifest(manifest([{ tileset: "ts_a", kit: "stone-well", spec: well({ id: "other" }) }])).ok).toBe(false);
    });
  });
});

describe("openingAnimaticCamera", () => {
  isolateTimers();
  const key = (atMs: number, value: number): AnimaticKey => ({ atMs, value });
  function axis(keys: AnimaticKey[] | undefined, atMs: number, fallback: number, span: number): number {
    return resolveAnimaticCameraAxis(sampleAnimaticTrack(keys, atMs, fallback), keys, fallback, span);
  }
  describe("resolveAnimaticCameraAxis", () => {
    it("keeps a centre-relative pan continuous after it leaves the 25% band", () => {
      const keys = [key(0, 0), key(1000, 80)];
      const height = 270;
      const at = (t: number) => axis(keys, t, height / 2, height);
      expect(at(0)).toBe(135);
      expect(at(800)).toBeCloseTo(64 + 135, 6);
      // 72 is outside the band. The old per-sample recentre left it at 72 and jumped half a stage.
      expect(at(900)).toBeCloseTo(72 + 135, 6);
      expect(at(1000)).toBe(80 + 135);
      for (let t = 0; t < 1000; t += 50) {
        expect(Math.abs(at(t + 50) - at(t))).toBeLessThanOrEqual(4.01);
      }
    });

    it("reads a world pan that starts outside the band as world coordinates the whole way", () => {
      const keys = [key(0, 230), key(5600, 500)];
      const height = 270;
      expect(axis(keys, 0, height / 2, height)).toBe(230);
      expect(axis(keys, 2800, height / 2, height)).toBe(365);
      expect(axis(keys, 5600, height / 2, height)).toBe(500);
      const dipping = [key(0, 100), key(1000, 40)];
      expect(axis(dipping, 0, height / 2, height)).toBe(100);
      expect(axis(dipping, 1000, height / 2, height)).toBe(40);
    });

    it("still recentres a static offset and leaves an omitted camera on the stage centre", () => {
      const height = 270;
      const width = 480;
      expect(axis(undefined, 0, 0, height)).toBe(height / 2);
      expect(axis([key(0, 10)], 0, height / 2, height)).toBe(10 + height / 2);
      expect(axis(undefined, 0, width / 2, width)).toBe(width / 2);
    });
  });
});
