import { beforeAll, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { mapsNeed, mvpGame, smallGame } from "@/ai/v2/judge/blueprintScale";
import { MVP_REACHED_SWITCH } from "@/project/gameBlueprint";
import { walkBlueprint } from "@/ai/v2/story/blueprint";
import { mvpNextSteps, nextStepsBlock, splitNextSteps, NEXT_STEPS_HEADING } from "@/ai/nextSteps";
import type { Project } from "@/project/types";
import { worldForRequest, worldRequestWords } from "@/ai/v2/request/world";
import { enableGenreLock } from "@/project/genreLock";
import { createProjectStartSeed } from "@/editor/projectStartSeed";
import { startScreenPrompt } from "@/editor/startScreenPrompt";
import { titleMismatch, offPremiseArt, openingWithoutPlace } from "@/ai/v2/judge/shipArtChecks";
import { requestedTitle } from "@/ai/v2/request/title";
import { editorDefaultsLeft, endingClosureProblems, shipBlockers, titleSpoilers } from "@/ai/v2/judge/shipChecks";
import { wantsWholeGame } from "@/ai/v2/request/readers";
import { getTool } from "@/editor/tools";
import { isolateTimers } from "./mergedTeardown";

// 새 게임 첫 생성 = 작은 MVP(2026-11-23 오너 «처음엔 맵 3~5개 MVP 만, 키우는 것은 요청 시»).
// 몬스터 캠페인 첫 판(mvpTrim.ts), v2 청사진 기본 크기(scale:"mvp"), 다음 단계 칩 글 모양(nextSteps.ts)을 본다.
describe("mvpFirstStart", () => {
  isolateTimers();
  function transfers(node: unknown, out: string[] = []): string[] {
    if (Array.isArray(node)) { for (const item of node) transfers(item, out); return out; }
    if (!node || typeof node !== "object") return out;
    const cmd = node as { kind?: string; mapId?: unknown };
    if (cmd.kind === "transfer" && typeof cmd.mapId === "string") out.push(cmd.mapId);
    for (const value of Object.values(node)) transfers(value, out);
    return out;
  }
  describe("monster campaign first version (scale mvp)", () => {
    const { project } = createMonsterExpedition({ scale: "mvp" });
    it("keeps exactly town, lab, route 1, next town and its gym", () => {
      expect(Object.keys(project.maps).sort()).toEqual(["mx_map_grove", "mx_map_grove_gym", "mx_map_home", "mx_map_lab", "mx_map_meadow"]);
    });
    it("leaves no door or fallback pointing at a removed map", () => {
      const missing = Object.values(project.maps).flatMap((map) => transfers(map.events)).filter((id) => !project.maps[id]);
      expect(missing).toEqual([]);
      expect(project.maps[project.system.gameOver?.recoveryFallback?.mapId ?? project.startMapId]).toBeDefined();
    });
    it("stops at the first badge with the MVP end switch and builds no ending", () => {
      const leader = project.maps.mx_map_grove_gym!.events.find((e) => e.id.endsWith("_leader"))!;
      expect(JSON.stringify(leader.pages)).toContain(`"switchId":"${MVP_REACHED_SWITCH}"`);
      expect(JSON.stringify(project.maps)).not.toContain("\"triggerEnding\"");
      expect(project.endings ?? []).toEqual([]);
    });
    it("puts healing and a shop in front of the removed buildings", () => {
      const people = Object.values(project.maps).flatMap((m) => m.events.map((e) => e.name));
      expect(people).toContain("회복 도우미");
      expect(people).toContain("도구 상인");
    });
  });
  describe("build_monster_game default size", () => {
    let mvp: Project;
    beforeAll(async () => {
      const blank = createBlankProject();
      const ctx = { project: blank, currentMapId: blank.startMapId };
      const built = await runToolAsync(ctx as never, "build_monster_game", { mode: "create" });
      expect(built.ok).toBe(true);
      mvp = ctx.project;
    }, 60_000);
    it("builds the 5-map first version when no size is given", () => {
      expect(Object.keys(mvp.maps)).toHaveLength(5);
    });
    it("still builds the asked campaign when gymCount is given", async () => {
      const blank = createBlankProject();
      const ctx = { project: blank, currentMapId: blank.startMapId };
      const built = await runToolAsync(ctx as never, "build_monster_game", { mode: "create", gymCount: 1 });
      expect(built.ok).toBe(true);
      expect(Object.keys(ctx.project.maps).length).toBeGreaterThan(5);
    }, 60_000);
  });
  const blueprintArgs = (extra: Record<string, unknown> = {}) => ({
    title: "숲의 종소리", genre: "모험",
    playerGoal: "숲 너머 동굴의 마물을 물리친다",
    steps: [
      { id: "s1", kind: "talk", place: "마을", event: "촌장", who: "촌장", action: "이야기를 듣는다", gives: "의뢰", feeling: "결심" },
      { id: "s2", kind: "find", place: "숲길", event: "부서진 표지판", action: "살핀다", gives: "동굴 위치", feeling: "긴장" },
      { id: "s3", kind: "battle", place: "동굴", event: "마물", who: "마물", action: "싸운다", gives: "평화", feeling: "안도" },
    ],
    ending: { name: "돌아온 종소리", how: "마물을 쓰러뜨린다", feeling: "안도" },
    ...extra,
  });
  const writeBlueprint = (project: Project, params: unknown) => {
    const session = new V2Session();
    const tools = createV2Tools({
      ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task: "닌자가 성에 잠입하는 게임", provider: "local-cli:claude", mapIds: [], project },
      emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
    } as never, session);
    // 첫 초안(mvp)의 write_blueprint 는 장소를 바로 짓는다(#5070). 여기서는 청사진의 크기 판정만 보므로 짓기는 뗀다.
    session.buildPlaces = undefined;
    return tools.find((t) => t.name === "write_blueprint")!.execute("a", params as never, undefined as never);
  };
  describe("v2 blueprint size", () => {
    it("a first blueprint without scale is the first playable version", async () => {
      const project = createBlankProject() as Project;
      await writeBlueprint(project, blueprintArgs());
      expect(project.gameBlueprint?.scale).toBe("mvp");
      expect(smallGame(project)).toBe(true);
      expect(mvpGame(project)).toBe(true);
      expect(mapsNeed(project, 6)).toBe(3);
      // 첫 판은 엔딩을 만들지 않는다 — 청사진 걷기가 «엔딩 없음» 을 막힘으로 내지 않는다.
      expect(walkBlueprint(project).blockers.map((b) => b.id)).not.toContain("blueprint-no-ending");
    });
    it("a first playable version counts at least 3 maps even when the blueprint names one place", async () => {
      const project = createBlankProject() as Project;
      await writeBlueprint(project, blueprintArgs({ steps: [
        { id: "s1", kind: "talk", place: "할머니 집", event: "할머니", who: "할머니", action: "이야기를 듣는다", gives: "옛 사진", feeling: "그리움" },
        { id: "s2", kind: "find", place: "할머니 집", event: "서랍", action: "열어 본다", gives: "편지", feeling: "설렘" },
        { id: "s3", kind: "talk", place: "할머니 집", event: "할머니", who: "할머니", action: "편지를 건뛨다", gives: "추억", feeling: "따뜻함" },
      ] }));
      expect(mvpGame(project)).toBe(true);
      expect(mapsNeed(project, 6)).toBe(3);
    });
    it("keeps scale full when the model writes it", async () => {
      const project = createBlankProject() as Project;
      await writeBlueprint(project, blueprintArgs({ scale: "full" }));
      expect(project.gameBlueprint?.scale).toBe("full");
      expect(smallGame(project)).toBe(false);
      expect(mapsNeed(project, 6)).toBe(6);
    });
    it("a first blueprint written as small is still the first version (no ending), also on a rewrite", async () => {
      const project = createBlankProject() as Project;
      await writeBlueprint(project, blueprintArgs({ scale: "small" }));
      expect(project.gameBlueprint?.scale).toBe("mvp");
      await writeBlueprint(project, blueprintArgs({ scale: "small" }));
      expect(project.gameBlueprint?.scale).toBe("mvp");
    });
  });
  describe("next step chips text", () => {
    it("round-trips the block the final report appends", () => {
      const steps = mvpNextSteps(createBlankProject());
      expect(steps[0]).toBe("다음 지역 만들어 줘");
      const split = splitNextSteps(`완료했습니다.\n\n${nextStepsBlock(steps)}`);
      expect(split.body).toBe("완료했습니다.");
      expect(split.steps).toEqual(steps);
    });
    it("leaves an answer alone when the heading is not followed by list lines only", () => {
      const text = `${NEXT_STEPS_HEADING}\n그냥 문장`;
      expect(splitNextSteps(text)).toEqual({ body: text, steps: [] });
    });
  });
  // 2026-11-23 실측: 몬스터 수집 씨앗에 «몬스터를 모으며 모험하는 게임» 요청이 우주 정거장 세계를 골라 make_place 가 장르 잠금에 매번 막혔다(맵 1장).
  // 세계는 사용자 글로만 고른다(아래 «world pick reads the user's words») — «몬스터» 는 테마 낱말이라 세계를 고르지 않으므로 잠금 시험은 «모험 게임» 으로 한다.
  describe("world pick under a genre lock", () => {
    const task = startScreenPrompt({ choiceId: "adventure-jrpg", intent: "모험 게임을 만들어 줘." })!;
    it("picks a world for the unlocked adventure seed and none once the monster-collect lock forbids it", async () => {
      const project = await createProjectStartSeed("adventure-jrpg", "새 프로젝트", "ai", "wide");
      expect(worldForRequest(project, "k", task)).toBeDefined();
      enableGenreLock(project, "monster-collect");
      expect(worldForRequest(project, "k", task)).toBeUndefined();
    }, 60_000);
  });
  // 2026-11-23 mvp-map-quality: 첫 화면 지시문의 전투 화면 안내(«veil=SF·미니멀»)가 요청 글로 읽혀 판타지 JRPG·회상 스토리가 우주 정거장 세계로 지어졌다.
  describe("world pick reads the user's words, not the start-screen guidance", () => {
    const jrpg = startScreenPrompt({ choiceId: "adventure-jrpg", intent: "용사가 마을에서 출발해 숲 너머 동굴의 마물을 물리치는 모험 게임을 만들어 줘." })!;
    const space = startScreenPrompt({ choiceId: "adventure-jrpg", intent: "우주 정거장에서 시작하는 모험 게임을 만들어 줘." })!;
    it("keeps the fantasy adventure off the space station and still honours a space request", async () => {
      const project = await createProjectStartSeed("adventure-jrpg", "새 프로젝트", "ai", "wide");
      expect(project.tilesets.sf_station).toBeDefined();
      expect(worldRequestWords(jrpg)).not.toMatch(/SF|veil/u);
      expect(worldForRequest(project, "2ad3408d-a264-4c42-b55a-debdd51c77d4", jrpg)?.id).not.toBe("sf_station");
      expect(worldForRequest(project, "k", space)?.id).toBe("sf_station");
    }, 60_000);
  });
});

describe("shipArtChecks", () => {
  isolateTimers();
  describe("aiV2RequestedTitle", () => {
    isolateTimers();
    describe("J71/J73 requested title", () => {
      it("reads a bracketed title from the request", () => {
        expect(requestedTitle("짧은 공포 탐험 게임. 제목은 「검은 장미 저택」. 주인공…")).toBe("검은 장미 저택");
        expect(requestedTitle("타이틀: 『별의 끝』")).toBe("별의 끝");
        expect(requestedTitle("밤의 학교 공포 게임을 만들어 줘")).toBeUndefined();
        expect(requestedTitle("부제목은 「A」")).toBeUndefined();
        expect(requestedTitle("책 제목은 「일기」")).toBeUndefined();
        expect(requestedTitle("제목은 「A」 말고 다른 걸로")).toBeUndefined();
      });
      it("blocks a different title and passes the requested one", () => {
        const p = createBlankProject();
        const sys = p.system as unknown as { titleScreen: Record<string, unknown> };
        sys.titleScreen = { ...sys.titleScreen, title: "검은 장미의 비밀" };
        expect(titleMismatch(p, "제목은 「검은 장미 저택」").map((b) => b.id)).toEqual(["title-not-requested"]);
        sys.titleScreen = { ...sys.titleScreen, title: "검은 장미  저택" };
        expect(titleMismatch(p, "제목은 「검은 장미 저택」")).toEqual([]);
      });
    });
  });
  describe("aiV2ShipChecks", () => {
    isolateTimers();
    describe("ship checks: editor defaults (2026-10-25 user rule)", () => {
      it("a blank project lists the factory title, opening, HUD, window look and party defaults", () => {
        const ids = editorDefaultsLeft(createBlankProject() as Project).map((b) => b.id);
        for (const id of ["title-name", "title-image", "opening", "hud", "window-look", "party-names", "party-faces", "hero-look"]) expect(ids).toContain(id);
      });

      it("authored replacements clear the defaults", () => {
        const p = createBlankProject() as Project;
        p.meta.title = "검은 장미 저택";
        p.system.titleScreen = { ...p.system.titleScreen!, title: "검은 장미 저택", backgroundResourceId: "bg-mansion-night" };
        p.system.opening = { ...p.system.opening!, enabled: false };
        getTool("set_field_hud")!.run(p as never, { theme: "horror" } as never);
        p.meta.oprnVnLook = { preset: "night-glass" } as never;
        const hero = p.database.actors.find((a) => a.id === "actor_hero")!;
        hero.name = "하나"; hero.faceResourceId = "face-hana"; hero.characterResourceId = "tex_people1"; hero.characterIndex = 1;
        const ids = editorDefaultsLeft(p).map((b) => b.id);
        for (const id of ["title-name", "title-image", "opening", "hud", "window-look", "party-names", "party-faces", "hero-look"]) expect(ids).not.toContain(id);
      });

      it("flags an ending that falls back to the factory title art, and factory gear next to authored equipment", () => {
        const p = createBlankProject() as Project;
        p.system.titleScreen = { ...p.system.titleScreen!, title: "검은 장미 저택" };
        p.endings = [{ id: "e1", name: "새벽의 탈출", conditions: [], priority: 1, presentation: { finalTitle: "끝" }, epilogue: [] } as never];
        expect(editorDefaultsLeft(p).map((b) => b.id)).toContain("ending-bg");
        p.endings = [{ id: "e1", name: "새벽의 탈출", conditions: [], priority: 1, presentation: { backgroundResourceId: "bg-dawn" }, epilogue: [] } as never];
        expect(editorDefaultsLeft(p).map((b) => b.id)).not.toContain("ending-bg");
        expect(editorDefaultsLeft(createBlankProject() as Project).map((b) => b.id)).not.toContain("start-gear");
        const sword = structuredClone(p.database.equipment[0]!);
        sword.id = "equip_rose_blade";
        p.database.equipment.push(sword);
        expect(editorDefaultsLeft(p).map((b) => b.id)).toContain("start-gear");
      });

      it("flags placeholder endings and one-line endings", () => {
        const p = createBlankProject() as Project;
        p.endings = [{ id: "e1", name: "첫 구간 끝", conditions: [], priority: 1, epilogue: [{ kind: "say", text: "끝." }] }];
        expect(editorDefaultsLeft(p).map((b) => b.id)).toContain("placeholder-text");
        const closure = endingClosureProblems(p);
        expect(closure).toHaveLength(1);
        expect(closure[0]!.message).toContain("맺음 대사");
        p.endings = [{ id: "e2", name: "새벽의 탈출", conditions: [], priority: 1, presentation: { backgroundResourceId: "bg-dawn", finalTitle: "끝" }, epilogue: [
          { kind: "say", text: "하나는 언니 유나의 손을 꼭 잡고 무너지는 저택의 정문을 나섰다." },
          { kind: "say", speaker: "유나", text: "이제 집에 가자. 다시는 이 숲에 들어오지 말자." },
          { kind: "say", text: "새벽빛 아래 검은 장미가 하나둘 시들어 갔고, 두 사람은 뒤를 돌아보지 않았다." },
        ] }];
        expect(endingClosureProblems(p)).toHaveLength(0);
      });

      it("only whole-game requests are ship-checked; title spoilers always", () => {
        expect(wantsWholeGame("검은 장미 저택 공포 게임 만들어 줘")).toBe(true);
        expect(wantsWholeGame("촌장을 광장으로 옮겨 줘")).toBe(false);
        const p = createBlankProject() as Project;
        expect(shipBlockers(p, "촌장을 광장으로 옮겨 줘")).toHaveLength(0);
        p.system.titleScreen = { ...p.system.titleScreen!, title: "10시 24분의 저택" };
        const map = p.maps[p.startMapId!]!;
        map.events.push({ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "fork", condition: { kind: "variable", variableId: "v1", op: "==", value: 1024 }, then: [], else: [] }] }] } as never);
        expect(titleSpoilers(p)[0]?.id).toBe("title-spoiler");
      });
    });
    describe("ship checks: the opening and endings show this game's place (J24, J65, J10, J17)", () => {
      it("flags an opening made only of sky layers and clears once a map shot is added", () => {
        const p = createBlankProject() as Project;
        p.system.opening = { enabled: true, skippable: true, scenes: [
          { id: "s1", kind: "image", resourceId: "oprn-pano-night", narration: "비 오는 밤", durationMs: 4000, motion: "none" },
          { id: "s2", kind: "image", resourceId: "oprn-pano-sky-day-clouds-near", narration: "구름", durationMs: 4000, motion: "none" },
        ] };
        expect(openingWithoutPlace(p).map((b) => b.id)).toEqual(["opening-no-place"]);
        p.system.opening.scenes.push({ id: "s3", kind: "animatic", narration: "저택", durationMs: 4000, composition: { width: 384, height: 216, layers: [{ id: "bg", kind: "image", role: "background", resourceId: `map-view:${p.startMapId}`, x: 0, y: 0, width: 384, height: 216 }] } } as never);
        expect(openingWithoutPlace(p)).toEqual([]);
      });

      it("flags endings that fall back to the snowy factory title art in a story with no snow", () => {
        const p = createBlankProject() as Project;
        p.endings = [{ id: "e1", name: "나란히 내리는 역", conditions: [], priority: 1, epilogue: [] }];
        expect(offPremiseArt(p, "서울 지하철 연애 게임 만들어 줘").map((b) => b.id)).toContain("ending-off-premise");
        p.endings[0]!.presentation = { backgroundResourceId: "oprn-pack-still-modern-01" };
        expect(offPremiseArt(p, "서울 지하철 연애 게임 만들어 줘").map((b) => b.id)).not.toContain("ending-off-premise");
        p.endings[0]!.presentation = { backgroundResourceId: "oprn-still-snow-village" };
        expect(offPremiseArt(p, "서울 지하철 연애 게임 만들어 줘").map((b) => b.id)).toContain("ending-off-premise");
        expect(offPremiseArt(p, "눈 내리는 겨울 마을 연애 게임 만들어 줘").map((b) => b.id)).not.toContain("ending-off-premise");
      });
    });
  });
});
