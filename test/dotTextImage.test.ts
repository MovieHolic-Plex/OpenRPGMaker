import { describe, expect, it, afterEach, vi } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject, TILE } from "@/project/defaults";
import { addFollowerToSession, removeFollowerFromSession, resolveCompanionRules, charsetFollowerGraphic, followerPositions, MAX_FOLLOWER_TRAIL_POINTS, recordFollowerPlayerStep, resetFollowerTrailNearPlayer } from "@/project/followers";
import { startSession } from "@/project/session";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import type { Command, EventPage, PlaySession, Project } from "@/project/types";
import { generateDotArt, setDotTextChat } from "@/ai/dotTextArt";
import { cropOpaque, DotTextImageError, generateDotTextImage, parseDotGrid, planDotCanvas, scaleNearest, type DotTextChat } from "@/ai/dotTextImage";
import { cutsceneDotPrompt, setCutsceneArtGenerator } from "@/editor/tools/cutsceneArtTools";
import { generateDatabaseRecordWithAi } from "@/editor/aiDatabaseGeneration";
import { generateImageAsset } from "@/editor/imageAssetGeneration";
import { prepareTool, runToolAsync } from "@/editor/tools/asyncToolRunner";
import { defaultAiConfig } from "@/ai/llmClient";
import { getTool } from "@/editor/tools";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import type { runEventCommandAssist } from "@/ai/eventCommandAssist";
import { decideFacesetUploadDimensions } from "@/editor/tools/resourceTools";
import { isolateTimers } from "./mergedTeardown";

describe("companionRules", () => {
  isolateTimers();
  const CAT = () => charsetFollowerGraphic("tex_easyrpg_charset_animal", 0);
  function walkEast(session: PlaySession, from: number, steps: number): void {
    for (let i = 0; i < steps; i += 1) {
      recordFollowerPlayerStep(session, { x: from + i, y: 5, direction: "right" });
    }
  }
  function pageWithCommands(project: Project, mapId: string, eventId: string): EventPage | undefined {
    const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
    return event?.pages?.find((page) => page.commands.length > 0);
  }
  describe("동료 간격 규칙", () => {
    it("gap 을 지정하지 않으면 궤적을 한 칸씩 승계한다(기존 동작)", () => {
      const project = createBlankProject();
      const session = startSession(project);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

      walkEast(session, 1, 6);

      expect(followerPositions(session).map((entry) => ({ name: entry.follower.name, x: entry.x }))).toEqual([
        { name: "가리", x: 6 },
        { name: "야옹이", x: 5 },
      ]);
    });

    it("gap 이 커지면 같은 궤적에서 더 멀리 떨어져 따라온다", () => {
      const project = createBlankProject();
      project.system.companions = { gap: 3 };
      const session = startSession(project);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

      walkEast(session, 1, 10);
      const trail = session.followerTrail ?? [];

      // 궤적 head 가 방금 떠난 칸이고, gap 3 이면 1번째 동료는 trail[2]·2번째는 trail[5] 를 읽는다.
      expect(followerPositions(session, project.system.companions).map((entry) => entry.x)).toEqual([
        trail[2]?.x,
        trail[5]?.x,
      ]);
      expect(trail[2]?.x).toBe((trail[0]?.x ?? 0) - 2);
      expect(trail[5]?.x).toBe((trail[0]?.x ?? 0) - 5);
    });

    it("맵 진입 궤적 초기화는 gap 만큼 길게 깔아 동료가 플레이어 칸에 겹치지 않게 한다", () => {
      const project = createBlankProject();
      // 기본 따라오기는 빵부스러기(#3509) — 맵에 들어서면 일부러 주인공 칸에 겹쳐 선다. 간격 궤적은 spaced 모드에서 본다.
      project.system.companions = { gap: 4, followMode: "spaced" };
      const session = startSession(project);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

      resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], project.system.companions);

      expect(session.followerTrail).toHaveLength(8);
      for (const position of followerPositions(session, project.system.companions)) {
        expect({ x: position.x, y: position.y }).not.toEqual({ x: session.x, y: session.y });
      }
    });
  });
  describe("동료 인원 상한", () => {
    it("상한을 넘기면 reject 정책이 새 동료를 붙이지 않는다", () => {
      const project = createBlankProject();
      project.system.companions = { maxCompanions: 1 };
      const session = startSession(project);

      expect(addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" })).not.toBeNull();
      expect(addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" })).toBeNull();
      expect(session.followers.map((entry) => entry.name)).toEqual(["가리"]);
    });

    it("replaceOldest 정책은 가장 먼저 붙은 동료를 밀어낸다", () => {
      const project = createBlankProject();
      project.system.companions = { maxCompanions: 1, overflow: "replaceOldest" };
      const session = startSession(project);

      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

      expect(session.followers.map((entry) => entry.name)).toEqual(["야옹이"]);
    });

    it("몬스터 동행은 액터 상한에 포함되지 않는다", () => {
      const project = createBlankProject();
      project.system.companions = { maxCompanions: 1 };
      const session = startSession(project);
      session.followers = [
        {
          id: "monster:m1",
          name: "슬라임",
          kind: "monster",
          monsterInstanceId: "m1",
          graphic: charsetFollowerGraphic("tex_easyrpg_charset_monster1", 0),
        },
      ];

      expect(addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" })).not.toBeNull();
      expect(session.followers.map((entry) => entry.name)).toEqual(["가리", "슬라임"]);
    });
  });
  describe("동료 그래픽 프레임", () => {
    it("charsetFollowerGraphic 은 캐릭터 칸마다 다른 프레임을 만든다", () => {
      const orange = charsetFollowerGraphic("tex_easyrpg_charset_animal", 0);
      const black = charsetFollowerGraphic("tex_easyrpg_charset_animal", 1);

      expect(orange.pattern).toBe(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }));
      expect(black.pattern).toBe(charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 }));
      expect(orange.pattern).not.toBe(black.pattern);
    });
  });
  describe("동료 대형", () => {
    it("beside 대형은 앞 4명을 플레이어 인접 칸에 세우고 나머지는 일렬로 떨어뜨린다", () => {
      // TILE.GRASS 는 합본 마을 칸 번호다 — 버들항 시작 맵에 깔면 막힌 칸이 되어 옆자리가 사라진다(2026-10-07 정리).
      const project = startOnRetiredCombinedTown(createBlankProject());
      project.system.companions = { formation: "beside" };
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map fixture missing");
      map.lowerTiles.fill(TILE.GRASS);
      const session = startSession(project);
      session.x = 6;
      session.y = 6;
      for (const name of ["가리", "야옹이", "까망이", "삐약이", "다섯"]) {
        addFollowerToSession(project, session, { graphic: CAT(), name });
      }
      walkEast(session, 1, 6);

      const positions = followerPositions(session, project.system.companions, { project, map });
      const beside = positions.slice(0, 4).map((entry) => `${entry.x},${entry.y}`);

      expect(new Set(beside).size).toBe(4);
      for (const entry of positions.slice(0, 4)) {
        expect(Math.abs(entry.x - session.x) + Math.abs(entry.y - session.y)).toBe(1);
      }
      // 5번째는 옆자리가 없으니 궤적으로 떨어진다.
      expect(positions[4]).toMatchObject({ x: session.followerTrail?.[0]?.x, y: session.followerTrail?.[0]?.y });
    });

    it("통행 불가 인접 칸은 옆자리로 쓰지 않는다", () => {
      // TILE.GRASS 는 합본 마을 칸 번호다 — 버들항 시작 맵에 깔면 막힌 칸이 되어 옆자리가 사라진다(2026-10-07 정리).
      const project = startOnRetiredCombinedTown(createBlankProject());
      project.system.companions = { formation: "beside" };
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map fixture missing");
      map.lowerTiles.fill(TILE.GRASS);
      map.lowerTiles[6 * map.width + 5] = TILE.WATER;
      const session = startSession(project);
      session.x = 6;
      session.y = 6;
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

      const [first] = followerPositions(session, project.system.companions, { project, map });

      expect(first).toBeDefined();
      expect({ x: first?.x, y: first?.y }).not.toEqual({ x: 5, y: 6 });
    });
  });
  describe("맵 이동 시 동료 해제", () => {
    it("clearOnTransfer 가 켜져 있으면 전송 후 액터 동료가 사라진다", () => {
      const project = createBlankProject();
      project.system.companions = { clearOnTransfer: true };
      const session = startSession(project);
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });
      expect(session.followers).toHaveLength(1);

      if (resolveCompanionRules(project.system.companions).clearOnTransfer) {
        removeFollowerFromSession(session, { all: true });
      }

      expect(session.followers).toHaveLength(0);
    });

    it("기본값은 맵 이동 후에도 동료를 유지한다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

      expect(resolveCompanionRules(project.system.companions).clearOnTransfer).toBe(false);
      expect(session.followers).toHaveLength(1);
    });
  });
  describe("configure_companion_rules 툴", () => {
    it("간격/상한/초과정책을 system.companions 에 기록한다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const result = runTool(context, "configure_companion_rules", { gap: 3, maxCompanions: 2, overflow: "replaceOldest" });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.system.companions).toEqual({ gap: 3, maxCompanions: 2, overflow: "replaceOldest" });
    });

    it("궤적 버퍼를 넘는 간격×인원 조합을 거부한다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const result = runTool(context, "configure_companion_rules", { gap: 16, maxCompanions: 8 });

      expect(16 * 8).toBeGreaterThan(MAX_FOLLOWER_TRAIL_POINTS);
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("companion-trail-overflow");
      expect(context.project.system.companions).toBeUndefined();
    });

    it("대형과 맵 이동 해제 옵션을 기록하고, beside 는 궤적 상한 검사를 건너뛴다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const result = runTool(context, "configure_companion_rules", { formation: "beside", clearOnTransfer: true, gap: 16, maxCompanions: 8 });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.system.companions).toMatchObject({ formation: "beside", clearOnTransfer: true });
      expect((result.data as { formation: string }).formation).toBe("beside");
    });

    it("reset 은 규칙을 지운다", () => {
      const context: ToolContext = { project: createBlankProject() };
      context.project.system.companions = { gap: 4 };

      expect(runTool(context, "configure_companion_rules", { reset: true }).ok).toBe(true);
      expect(context.project.system.companions).toBeUndefined();
    });
  });
  describe("add_companion 툴", () => {
    it("말 걸어 합류하는 동료 이벤트를 만들고 합류 후 사라지게 한다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const result = runTool(context, "add_companion", {
        who: { query: "고양이" },
        target: { mapId, x: 4, y: 4 },
        trigger: "talk",
        name: "야옹이",
      });

      expect(result.ok, result.summary).toBe(true);
      const eventId = (result.data as { eventId: string }).eventId;
      const event = context.project.maps[mapId]?.events.find((entry) => entry.id === eventId);
      expect(event?.pages).toHaveLength(2);
      const page = pageWithCommands(context.project, mapId, eventId);
      expect(page?.commands[0]).toMatchObject({ kind: "addFollower", name: "야옹이" });
      expect(page?.commands.at(-1)).toMatchObject({ kind: "setSelfSwitch", key: "A", value: true });
      expect(event?.pages?.some((entry) => entry.commands.length === 0)).toBe(true);
    });

    it("자동 합류 이벤트는 스위치 가드로 1회만 실행된다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const result = runTool(context, "add_companion", {
        who: { actorId: "actor_hero" },
        target: { mapId, x: 4, y: 4 },
        trigger: "autorun",
      });

      expect(result.ok, result.summary).toBe(true);
      const eventId = (result.data as { eventId: string }).eventId;
      const page = context.project.maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
      expect(page?.trigger).toEqual({ kind: "auto" });
      const guard = page?.conditions?.[0];
      expect(guard).toMatchObject({ kind: "switch", value: false });
      const switchId = (guard as { switchId: string }).switchId;
      expect(page?.commands.at(-1)).toMatchObject({ kind: "setSwitch", switchId, value: true });
      expect(context.project.switches.some((entry) => entry.id === switchId)).toBe(true);
    });

    it("기존 이벤트에 붙일 수 있고 그래픽은 프레임 계산을 거친다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const created = runTool(context, "add_companion", { who: { query: "고양이" }, target: { mapId, x: 4, y: 4 } });
      const eventId = (created.data as { eventId: string }).eventId;

      const appended = runTool(context, "add_companion", {
        who: { textureKey: "tex_easyrpg_charset_animal", characterIndex: 1 },
        target: { eventId, mapId },
        name: "까망이",
      });

      expect(appended.ok, appended.summary).toBe(true);
      const commands: readonly Command[] = pageWithCommands(context.project, mapId, eventId)?.commands ?? [];
      const added = commands.filter((command) => command.kind === "addFollower");
      expect(added).toHaveLength(2);
      expect((added[1] as { graphic?: { pattern?: number } }).graphic?.pattern).toBe(
        charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 })
      );
    });

    it("없는 액터와 해석 불가 검색어를 거부한다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;

      const badActor = runTool(context, "add_companion", { who: { actorId: "actor_nope" }, target: { mapId, x: 4, y: 4 } });
      expect(badActor.ok).toBe(false);
      expect(badActor.issues?.[0]?.code).toBe("companion-actor-missing");

      const badQuery = runTool(context, "add_companion", {
        who: { query: "존재하지않는우주선123" },
        target: { mapId, x: 4, y: 4 },
      });
      expect(badQuery.ok).toBe(false);
      expect(badQuery.issues?.[0]?.code).toBe("graphic-not-found");
    });
  });
});

describe("dotTextImage", () => {
  isolateTimers();
  const square = (n: number, fill: (x: number, y: number) => boolean): string[] =>
    Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => (fill(x, y) ? "a" : ".")).join(""));
  const answer = (rows: string[]): string => JSON.stringify({ legend: { a: "#aa3322" }, rows });
  const reply = (text: string) => ({ text, model: "stub-pixel", provider: "stub" });
  afterEach(() => { setDotTextChat(undefined); setCutsceneArtGenerator(undefined); });
  describe("낱장 도트 생성기(텍스트 모델이 격자로 찍는다)", () => {
    it("긴 변 64 이하는 1배, 넘으면 칸이 64 이하가 되는 정수 배로 확대한다", () => {
      expect(planDotCanvas(32)).toEqual({ box: 32, factor: 1 });
      expect(planDotCanvas(64)).toEqual({ box: 64, factor: 1 });
      expect(planDotCanvas(96)).toEqual({ box: 48, factor: 2 });
      expect(planDotCanvas(224)).toEqual({ box: 56, factor: 4 });
    });

    it("격자를 읽어 여백을 자르고 정수 배로 키운 투명 PNG 를 낸다", async () => {
      const plan = planDotCanvas(96);
      const image = await generateDotTextImage({ prompt: "truck", longSidePx: 96 }, async () => reply(answer(square(plan.box, (x, y) => x > 4 && x < 43 && y > 10 && y < 38))));
      expect(image).toMatchObject({ dot: true, mimeType: "image/png", model: "stub-pixel", width: 38 * 2, height: 27 * 2 });
      expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    });

    it("줄 수·폭·색이 틀리면 오류 글을 돌려 고치게 하고, 끝까지 틀리면 거절한다 — 다른 경로로 몰래 대체하지 않는다", async () => {
      const plan = planDotCanvas(16);
      let asked = 0;
      const seen: string[] = [];
      const chat: DotTextChat = async (messages) => {
        asked += 1;
        seen.push(messages[messages.length - 1]!.content);
        return reply(asked === 1 ? answer(square(15, () => true)) : answer(square(plan.box, (x, y) => x > 2 && y > 2 && x < 12 && y < 12)));
      };
      const ok = await generateDotTextImage({ prompt: "gem", longSidePx: 16 }, chat);
      expect(asked).toBe(2);
      expect(seen[1]).toContain("16줄");
      expect(ok.width).toBeGreaterThan(0);
      await expect(generateDotTextImage({ prompt: "gem", longSidePx: 16 }, async () => reply("not json"))).rejects.toBeInstanceOf(DotTextImageError);
    });

    it("parseDotGrid 는 legend 밖 글자·팔레트 초과·#rrggbb 아님을 거른다", () => {
      const plan = planDotCanvas(8);
      expect(parseDotGrid(JSON.stringify({ legend: { a: "red" }, rows: square(8, () => true) }), plan)).toMatchObject({ ok: false });
      expect(parseDotGrid(JSON.stringify({ legend: { a: "#000000" }, rows: square(8, () => false).map((r, i) => (i === 0 ? "b".repeat(8) : r)) }), plan)).toMatchObject({ ok: false });
      expect(parseDotGrid(JSON.stringify({ legend: { ".": "#000000" }, rows: square(8, () => true) }), plan)).toMatchObject({ ok: false });
      const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [String.fromCharCode(98 + i), "#101010"]));
      expect(parseDotGrid(JSON.stringify({ legend: many, rows: square(8, () => false) }), plan)).toMatchObject({ ok: false });
      expect(parseDotGrid(answer(square(8, (x) => x < 4)), plan)).toMatchObject({ ok: true });
    });

    it("cropOpaque·scaleNearest 는 화소를 그대로 둔다", () => {
      const px = new Uint8ClampedArray(4 * 4 * 4);
      px.set([9, 8, 7, 255], (1 * 4 + 2) * 4);
      const cropped = cropOpaque(4, 4, px)!;
      expect(cropped).toMatchObject({ width: 1, height: 1 });
      const big = scaleNearest(1, 1, cropped.rgba, 3);
      expect(big.width).toBe(3);
      expect([...big.rgba.subarray(0, 4)]).toEqual([9, 8, 7, 255]);
    });
  });
  describe("도트 용도는 도트 경로로, 낱장 도트가 아닌 용도는 거절", () => {
    it("generateDotArt 는 생성형·공방 용도를 거절한다", async () => {
      setDotTextChat(async () => reply(answer(square(8, () => true))));
      await expect(generateDotArt({ prompt: "x", purpose: "title-art" })).rejects.toBeInstanceOf(DotTextImageError);
      await expect(generateDotArt({ prompt: "x", purpose: "tileset" })).rejects.toBeInstanceOf(DotTextImageError);
      await expect(generateDotArt({ prompt: "x", purpose: "item-icon", longSidePx: 8 })).resolves.toMatchObject({ dot: true });
    });

    it("컷신 style:game 소품은 이미지 모델이 아니라 도트 저작 모델로 찍는다 (이미지 생성기를 불러서는 안 된다)", async () => {
      let imageCalls = 0;
      let prompts = 0;
      setCutsceneArtGenerator(async () => { imageCalls += 1; throw new Error("불려서는 안 된다"); });
      setDotTextChat(async (messages) => {
        prompts += 1;
        expect(messages[1]!.content).toContain("3/4 top-down");
        const plan = planDotCanvas(64);
        return reply(answer(square(plan.box, (x, y) => x > 3 && x < 60 && y > 20 && y < 44)));
      });
      const ctx = { project: createBlankProject() };
      const args = { role: "sprite", prompt: "white box delivery truck, side-on", name: "트럭", tiles: 4 };
      await prepareTool("generate_cutscene_art", args);
      const result = runTool(ctx, "generate_cutscene_art", args, { dryRun: false });
      expect(result.ok).toBe(true);
      expect(imageCalls).toBe(0);
      expect(prompts).toBe(1);
      expect(cutsceneDotPrompt("truck")).not.toContain("magenta");
    });

    it("이미지 생성기만 꽂힌 헤드리스 하네스는 옛 경로를 쓴다(준비된 그림 그대로)", async () => {
      let imageCalls = 0;
      setCutsceneArtGenerator(async () => {
        imageCalls += 1;
        throw new Error("헤드리스 생성기 호출됨");
      });
      const args = { role: "sprite", prompt: "headless legacy truck", name: "옛 경로", tiles: 4 };
      await prepareTool("generate_cutscene_art", args);
      expect(imageCalls).toBe(1);
    });

    it("아이템 아이콘은 도트 저작 모델이 찍은 투명 PNG 를 그대로 쓴다(배경 지우기 없음)", async () => {
      setDotTextChat(async () => reply(answer(square(32, (x, y) => x > 8 && x < 24 && y > 6 && y < 26))));
      let flattened = 0;
      const outcome = await generateDatabaseRecordWithAi(
        { kind: "item", brief: "푸른 엘릭서", config: defaultAiConfig(), withArtwork: true },
        {
          currentProject: () => createBlankProject(),
          complete: async () => ({ message: { role: "assistant", content: '{"name":"푸른 엘릭서","price":300}' }, finishReason: "stop" }),
          flattenArtwork: async (dataUrl) => { flattened += 1; return dataUrl; },
          applyCalls: (calls) => calls.map(() => ({ ok: true, summary: "적용" })),
        },
      );
      expect(flattened).toBe(0);
      expect(outcome.artworkDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
      expect(outcome.artworkModel).toBe("stub-pixel");
    });

    it("조수 generate_image_asset pixel:true 는 도트 저작 모델로 가고, 생략하면 이미지 모델로 간다", async () => {
      setDotTextChat(async () => reply(answer(square(32, (x, y) => x > 8 && x < 24 && y > 6 && y < 26))));
      let imageCalls = 0;
      const generateImage = async () => { imageCalls += 1; return { dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "img", provider: "img" }; };
      const dot = await generateImageAsset({ kind: "picture", prompt: "붉은 열쇠 아이콘", pixel: true }, { generateImage });
      expect(dot).toMatchObject({ ok: true, kind: "picture" });
      expect(imageCalls).toBe(0);
      const art = await generateImageAsset({ kind: "picture", prompt: "붉은 열쇠 아이콘" }, { generateImage });
      expect(art.ok).toBe(true);
      expect(imageCalls).toBe(1);
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "generate_image_asset", { kind: "title", prompt: "타이틀 배경", pixel: true }).ok).toBe(false);
    });
  });
});

describe("eventCommandAssistTool", () => {
  isolateTimers();
  function fixture() {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const page: EventPage = {
      id: "page-1", name: "페이지", conditions: [], graphic: {}, trigger: { kind: "action" },
      priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "이전 대사" }],
    };
    project.maps[mapId].events.push({ id: "ev-assist", name: "대화", x: 2, y: 2,
      trigger: { kind: "action" }, commands: [], pages: [page, { ...structuredClone(page), id: "page-2" }] });
    return { ctx: { project }, args: { mapId, eventId: "ev-assist", pageId: page.id, prompt: "대사를 고쳐 줘" } };
  }
  const generated: Awaited<ReturnType<typeof runEventCommandAssist>> = {
    commands: [{ kind: "text", body: "새 대사" }], scope: "page", attempts: 1,
  };
  describe("event_command_assist", () => {
    it("is a discoverable write tool excluded from read-only Pi sessions", () => {
      const { ctx } = fixture();
      expect(getTool("event_command_assist")?.mode).toBe("write");
      expect(createPiToolset(ctx, { readOnly: true }).some(t => t.name === "event_command_assist")).toBe(false);
      expect(createPiToolset(ctx, { toolNames: ["event_command_assist"] })).toHaveLength(1);
    });

    it("updates only the chosen page through a cloned draft", async () => {
      const { ctx, args } = fixture();
      const before = ctx.project;
      const result = await runToolAsync(ctx, "event_command_assist", args, { generate: async () => generated });
      expect(result.ok).toBe(true);
      const oldEvent = before.maps[args.mapId].events.find(e => e.id === args.eventId)!;
      const next = ctx.project.maps[args.mapId].events.find(e => e.id === args.eventId)!;
      expect(oldEvent.pages![0].commands[0]).toEqual({ kind: "text", body: "이전 대사" });
      expect(next.pages![0]).toEqual({ ...oldEvent.pages![0], commands: generated.commands });
      expect(next.pages![1]).toEqual(oldEvent.pages![1]);
    });

    it("dry-run and synchronous calls cannot commit generated commands", async () => {
      const { ctx, args } = fixture();
      const before = ctx.project;
      expect(runTool(ctx, "event_command_assist", args).ok).toBe(false);
      const result = await runToolAsync(ctx, "event_command_assist", args, { dryRun: true, generate: async () => generated });
      expect(result.ok).toBe(true);
      expect(ctx.project).toBe(before);
    });

    // 전체 수정으로 싣는 페이지 상한은 2만 자다(#5106, src/ai/eventCommandAssist.ts MAX_EXISTING_CHARS).
    it("rejects missing targets and long-page edits before generation", async () => {
      const { ctx, args } = fixture();
      const generate = vi.fn(async () => generated);
      expect((await runToolAsync(ctx, "event_command_assist", { ...args, pageId: "absent" }, { generate })).ok).toBe(false);
      ctx.project.maps[args.mapId].events.find(e => e.id === args.eventId)!.pages![0].commands = [{ kind: "text", body: "가".repeat(21000) }];
      expect((await runToolAsync(ctx, "event_command_assist", args, { generate })).ok).toBe(false);
      expect(generate).not.toHaveBeenCalled();
    });

    it("appends without replacing existing commands", async () => {
      const { ctx, args } = fixture();
      const result = await runToolAsync(ctx, "event_command_assist", { ...args, mode: "append" }, {
        generate: async options => {
          expect(options.context.scope).toBe("append");
          return { ...generated, scope: "append" };
        },
      });
      expect(result.ok).toBe(true);
      expect(ctx.project.maps[args.mapId].events.find(e => e.id === args.eventId)!.pages![0].commands).toHaveLength(2);
    });

    it("passes the host selection to generation and inserts after it in append mode", async () => {
      const { ctx, args } = fixture();
      const page = ctx.project.maps[args.mapId].events[0].pages![0];
      const last = { kind: "text" as const, body: "마지막 대사" };
      page.commands.push(last);
      const result = await runToolAsync(ctx, "event_command_assist", { ...args, mode: "append" }, {
        eventCommandScope: { ...args, mode: "append", selection: [0], selectionLabel: "선택한 첫 명령" },
        generate: async options => {
          expect(options.context.selection).toEqual([0]);
          expect(options.context.selectionLabel).toBe("선택한 첫 명령");
          return { ...generated, scope: "append" };
        },
      });
      expect(result.ok).toBe(true);
      expect(ctx.project.maps[args.mapId].events[0].pages![0].commands).toEqual([
        { kind: "text", body: "이전 대사" }, ...generated.commands, last,
      ]);
    });

    it("rejects stale or cancelled results without replacing the project", async () => {
      const { ctx, args } = fixture();
      const changed = structuredClone(ctx.project);
      const result = await runToolAsync(ctx, "event_command_assist", args, {
        generate: async () => { ctx.project = changed; return generated; },
      });
      expect(result.issues?.[0].code).toBe("stale-project");
      expect(ctx.project).toBe(changed);
      const controller = new AbortController();
      await expect(runToolAsync(ctx, "event_command_assist", args, {
        signal: controller.signal,
        generate: async () => { controller.abort(); return generated; },
      })).rejects.toThrow();
      expect(ctx.project).toBe(changed);
    });

    it("uses the shared generator's validation and repair loop", async () => {
      const { ctx, args } = fixture();
      const chat = vi.fn()
        .mockResolvedValueOnce({ message: { role: "assistant", content: '[{"kind":"not-a-command"}]' }, finishReason: "stop" })
        .mockResolvedValueOnce({ message: { role: "assistant", content: JSON.stringify(generated.commands) }, finishReason: "stop" });
      const result = await runToolAsync(ctx, "event_command_assist", args, { config: defaultAiConfig(), chat });
      expect(result.ok).toBe(true);
      expect(chat).toHaveBeenCalledTimes(2);
      expect(result.data).toMatchObject({ attempts: 2 });
    });

    it("keeps the draft unchanged when resource validation exhausts retries", async () => {
      const { ctx, args } = fixture();
      const before = ctx.project;
      const chat = vi.fn().mockResolvedValue({ message: { role: "assistant", content:
        JSON.stringify([{ kind: "playAudio", channel: "bgm", resourceId: "nonexistent-resource", volume: 100, pitch: 100 }]),
      }, finishReason: "stop" });
      const result = await runToolAsync(ctx, "event_command_assist", args, { config: defaultAiConfig(), chat });
      expect(result.ok).toBe(false);
      expect(chat).toHaveBeenCalledTimes(3);
      expect(ctx.project).toBe(before);
    });
  });
});

// upsert_resource 의 faceset 업로드 판정 규칙(순수 함수) 단위 테스트.
// 규칙(문서화):
//   · 한 얼굴 = 48×48 → 허용.
//   · 48 배수 정사각 시트(192×192 16칸, 96×96 4칸)도 허용한다 — 등록 지점이
//     planFacesetSheetSplit 으로 낱장으로 쪼개므로 거부할 이유가 없다.
//   · 비정사각·비배수 이미지는 저자가 만든 낱장 아트로 보고 그대로 허용.
//   · 0 이하 변 길이는 유효하지 않은 이미지로 거부.
describe("facesetUploadDimension", () => {
  isolateTimers();
  describe("decideFacesetUploadDimensions", () => {
    it("48×48 단일 얼굴은 허용한다", () => {
      expect(decideFacesetUploadDimensions(48, 48)).toEqual({ accept: true });
    });

    it("192×192 16칸 시트는 허용한다 — 등록 지점이 낱장으로 쪼갠다", () => {
      expect(decideFacesetUploadDimensions(192, 192)).toEqual({ accept: true });
    });

    it("96×96 4칸 시트도 허용한다", () => {
      expect(decideFacesetUploadDimensions(96, 96)).toEqual({ accept: true });
    });

    it("48×96 비정사각형은 낱장 아트로 허용한다", () => {
      expect(decideFacesetUploadDimensions(48, 96)).toEqual({ accept: true });
    });

    it("그 외 일반 크기 낱장(예: 256×200)은 허용한다", () => {
      expect(decideFacesetUploadDimensions(256, 200)).toEqual({ accept: true });
    });

    it("0 이하 변 길이는 유효하지 않은 이미지로 거부한다", () => {
      expect(decideFacesetUploadDimensions(0, 48).accept).toBe(false);
      expect(decideFacesetUploadDimensions(48, -1).accept).toBe(false);
    });

    it("터미널 스크립트를 시키는 안내는 더 이상 없다", () => {
      const results = [
        decideFacesetUploadDimensions(192, 192),
        decideFacesetUploadDimensions(0, 48),
      ];
      for (const result of results) {
        if (!result.accept) expect(result.reason).not.toContain("assets:slice-faces");
      }
    });
  });
});
