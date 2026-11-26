import { describe, expect, it, vi } from "vitest";
import type { Command, EventPage, Project, GameEvent, EventPageCondition, Trigger, TilesetDef } from "@/project/types";
import fixture from "./fixtures/projects/editor-authored-demo-v3.json";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject, createBlankMap, createBlankProject as createBlankDefaultProject, TILE } from "@/project/defaults";
import { collectDialogueLines, dialogueTextHash, resolveDialogueSlot } from "@/editor/dialogue/dialogueIndex";
import { checkMeaningPreserved, meaningGuardNames, quantityValues } from "@/editor/dialogue/dialogueMeaningGuard";
import { dialogueGuardNames } from "@/editor/tools/dialogueTools";
import { applyDialogueEdits, checkDialogueEdit, dialogueMeasureKey, estimateLineFit } from "@/editor/dialogue/dialogueEdits";
import { buildStory, resolveStoryRef } from "@/editor/dialogue/storyScript";
import { renderOutlineText, renderSceneText, selectScenes } from "@/editor/dialogue/storyScriptText";
import { DIALOGUE_PROPOSAL_LIMIT, readDialogueDesk, upsertDialogueProposals, writeDialogueWindow, type DialogueProposal } from "@/project/dialogueDesk";
import { isolateTimers } from "./mergedTeardown";
import { MATERIAL_SLOT_IDS, materialSlotCoverage, resolveMaterialSlots } from "@/editor/operators/materialSlots";
import { buildForestWrites, COMBINED_TOWN_FOREST_PALETTE, forestPaletteFromSlots, type ForestMapView } from "@/editor/regionTask/forestWrites";
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { RETIRED_COMBINED_TOWN_TILESET_ID, retiredEasyRpgTileset, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { buildOperatorIntentPrompt, describeIntent, heuristicOperatorIntent, isOperatorIntentFailure, parseOperatorIntentJson, resolveOperatorIntent } from "@/editor/operators/operatorIntent";
import { getOperator, listOperators } from "@/editor/operators/operatorRegistry";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { analyzeRegionBlend, describeBlendBreak, describeBlockedEntrance, expandRegion, polishRegionSeams } from "@/editor/regionTask/regionBlend";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";

describe("editorAuthoredDemoQuality", () => {
  isolateTimers();
  function demoProject(): Project {
    return fixture as unknown as Project;
  }
  function commands(project: Project): readonly Command[] {
    return Object.values(project.maps)
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .flatMap((page) => page.commands);
  }
  function visibleGraphicSignatures(project: Project): readonly string[] {
    return Object.values(project.maps)
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .filter((page): page is EventPage => !page.graphic.transparent)
      .map((page) => `${page.graphic.sprite?.id}:${page.graphic.pattern}`);
  }
  describe("editor-authored harbor demo quality", () => {
    it("has varied EasyRPG NPC graphics instead of one repeated default character", () => {
      const signatures = visibleGraphicSignatures(demoProject());

      expect(new Set(signatures).size).toBeGreaterThanOrEqual(8);
      expect(signatures.every((signature) => signature.startsWith("tex_easyrpg_charset_"))).toBe(true);
    });

    it("presents a coherent lighthouse quest before the ending", () => {
      const project = demoProject();
      const allCommands = commands(project);
      const serializedCommands = JSON.stringify(allCommands);
      const firstEndingIndex = allCommands.findIndex((command) => command.kind === "ending");
      const firstQuestChoiceIndex = allCommands.findIndex((command) => command.kind === "choices" && command.prompt === "등대 복구를 시작할까요?");

      expect(project.meta.title).toBe("안개 항구와 등대의 밤");
      expect(project.maps[project.startMapId]?.name).toBe("안개 항구 마을");
      expect(firstQuestChoiceIndex).toBeGreaterThanOrEqual(0);
      expect(firstEndingIndex).toBeGreaterThan(firstQuestChoiceIndex);
      expect(serializedCommands).toContain("첫 조각은 소금 장수가 말한 안개 방파제 끝에");
      expect(serializedCommands).toContain("두 번째 조각은 돛 수선공이 걱정하는 폐등대 창고");
      expect(serializedCommands).toContain("렌즈 조각 두 개가 모이기 전에는 꼭대기 계단이 열리지 않습니다.");
      expect(allCommands.filter((command) => command.kind === "battleProcessing").length).toBeGreaterThanOrEqual(4);
    });

    it("makes village NPCs move and acknowledge each other", () => {
      const project = demoProject();
      const pages = Object.values(project.maps).flatMap((map) => map.events).flatMap((event) => event.pages ?? []);
      const movingNpcPages = pages.filter((page) => !page.graphic.transparent && page.movement.type !== "fixed");
      const dialogue = JSON.stringify(commands(project));

      expect(movingNpcPages.length).toBeGreaterThanOrEqual(8);
      expect(dialogue).toContain("소금 장수");
      expect(dialogue).toContain("돛 수선공");
      expect(dialogue).toContain("부두 아이");
      expect(dialogue).toContain("등대 수습");
      expect(dialogue).toContain("하루");
    });

    it("stores editable markdown village information with the project", () => {
      const project = demoProject();
      const documents = project.villageInfoDocuments ?? [];

      expect(documents.length).toBeGreaterThanOrEqual(Object.keys(project.maps).length);
      expect(documents.map((document) => document.title)).toContain("안개 항구 마을.md");
      expect(documents.every((document) => document.title.endsWith(".md"))).toBe(true);
      expect(JSON.stringify(documents)).toContain("새 NPC는 반드시 기존 NPC 중 한 명을 알고 있어야 한다.");
    });
  });
});

describe("editorDialogueSuite", () => {
  isolateTimers();
  // 대사 고치기의 뜻 보존 관문(dialogueMeaningGuard.ts) — 닻마다 거절·통과, 그리고 rewrite_dialogue 가 거절된 줄을 쓰지 않는지.
  describe("dialogueMeaningGuard", () => {
    isolateTimers();
    const kinds = (before: string, after: string, names?: string[]) => checkMeaningPreserved(before, after, { names }).map((issue) => issue.kind);
    describe("뜻 보존 관문 — 닻별", () => {
      it("숫자: 같은 수의 다른 꼴은 통과, 다른 수는 거절", () => {
        expect(kinds("늑대 송곳니 세 개를 가져와라.", "늑대 송곳니 셋을 가져와라.")).toEqual([]);
        expect(kinds("열두 명이 왔어요.", "열둘이 왔어요.")).toEqual([]);
        expect(kinds("30% 깎아 주지.", "30퍼센트 깎아 주지.")).toEqual([]);
        expect(kinds("3개를 모아라.", "4개를 모아라.")).toEqual(["number"]);
        expect(kinds("세 개를 모아라.", "몇 개 모아라.")).toEqual(["number"]);
        expect(quantityValues("한 번만 더, 하나만.")).toEqual(["1", "1"]);
        expect(kinds("여관에 가서 맥주나 한 잔 해야겠어.", "여관에 가서 맥주나 한잔해야겠어.")).toEqual([]);
        expect(quantityValues("한 장소에 모여라.")).toEqual([]);
        expect(kinds("실행 집이 넷(칩·버튼·메뉴·툴바)이다.", "칩, 버튼, 메뉴, 툴바 네 곳에서 실행한다.")).toEqual([]);
      });

      it("인용: 「」 안 이름이 빠지면 거절, 따옴표 종류만 바꾸면 통과", () => {
        expect(kinds("의뢰 「불덩이」를 받았다.", "의뢰를 받았다.")).toEqual(["quote"]);
        expect(kinds("의뢰 「불덩이」를 받았다.", "의뢰 「불덩어리」를 받았다.")).toEqual(["quote"]);
        expect(kinds("의뢰 「불덩이」를 받았다.", "\"불덩이\" 의뢰를 받았다.")).toEqual([]);
      });

      it("고유명사: DB 이름이 덜 나오면 거절, 조사가 바뀌는 것은 통과", () => {
        expect(kinds("카엘이 대장간에 갔다.", "그가 대장간에 갔다.", ["카엘"])).toEqual(["name"]);
        expect(kinds("카엘이 대장간에 갔다.", "대장간엔 카엘도 갔다.", ["카엘"])).toEqual([]);
      });

      it("유보: 아마·~지도·~것 같다가 줄면 거절", () => {
        expect(kinds("아마 내일 비가 올지도 몰라.", "내일 비가 온다.")).toEqual(["hedge"]);
        expect(kinds("비가 올 것 같아.", "비가 올 거 같네.")).toEqual([]);
        expect(kinds("세상에 지도는 없다.", "세상에 지도는 없어.")).toEqual([]);
      });

      it("부정: 안·못·없·아니 수가 바뀌면 거절, 띄어쓰기만 바뀌면 통과", () => {
        expect(kinds("안 했다.", "했다.")).toEqual(["polarity"]);
        expect(kinds("가지 마라.", "가라.")).toEqual(["polarity"]);
        expect(kinds("창은 안 판다.\n값이 아니라 이유를 가져와라.", "창은 돈으론 안 판다.\n이유를 가져와라.")).toEqual(["polarity"]);
        expect(kinds("값이 아니라 이유를 가져와라.", "값 말고 이유를 가져와라.")).toEqual([]);
        expect(kinds("그건 못 해.", "그건 못해.")).toEqual([]);
      });

      it("말투만 바꾸는 고치기는 통과", () => {
        expect(kinds("내가 했지.", "내가 했다.")).toEqual([]);
        expect(kinds("오늘은 바람이 차구나…", "오늘 바람 차네.")).toEqual([]);
        expect(kinds("어이, 거기 서라!", "거기 서.")).toEqual([]);
      });
    });
    describe("뜻 보존 관문 — 이름 목록과 rewrite_dialogue", () => {
      it("기본 DB 이름은 빼고 저자가 만든 이름·맵·퀘스트 제목을 센다", () => {
        const project = createBlankProject();
        project.database.actors.push({ ...project.database.actors[0]!, id: "actor_kael", name: "카엘" });
        project.maps[project.startMapId]!.name = "아스텔";
        const names = dialogueGuardNames(project);
        expect(names).toContain("카엘");
        expect(names).toContain("아스텔");
        expect(names).not.toContain("공격");
        expect(names).not.toContain("회복약");
        expect(meaningGuardNames({ quests: [{ title: "로한의 창" }] })).toEqual(["로한의 창"]);
      });

      it("뜻이 바뀐 줄은 쓰지 않고 거절 이유와 닻별 수를 돌려준다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const say = (body: string): Command => ({ kind: "text", speaker: "로한", body } as Command);
        map.events.push({ id: "ev_rohan", name: "로한", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
          id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [say("송곳니 3개를 가져와라."), say("그럼 들어 주지.")],
        }] } as unknown as GameEvent);
        const ctx = { project };
        const lines = collectDialogueLines(project).filter((line) => line.speaker === "로한");
        const result = runTool(ctx, "rewrite_dialogue", { mode: "apply", edits: [
          { id: lines[0]!.id, hash: lines[0]!.hash, text: "송곳니 4개를 가져와라." },
          { id: lines[1]!.id, hash: lines[1]!.hash, text: "그럼 들어 주마." },
        ] });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { rejected: { reason: string; message: string }[]; meaningGuard: { rejected: number; byKind: Record<string, number> } };
        expect(data.rejected).toHaveLength(1);
        expect(data.rejected[0]!.reason).toBe("meaning");
        expect(data.rejected[0]!.message).toContain("숫자");
        expect(data.meaningGuard.rejected).toBe(1);
        expect(data.meaningGuard.byKind.number).toBe(1);
        const after = collectDialogueLines(ctx.project).filter((line) => line.speaker === "로한").map((line) => line.text);
        expect(after).toEqual(["송곳니 3개를 가져와라.", "그럼 들어 주마."]);
      });

      it("allowMeaningChange 면 사람이 시킨 뜻 바꾸기를 받는다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.events.push({ id: "ev_x", name: "x", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
          id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", speaker: "상인", body: "50골드다." } as Command],
        }] } as unknown as GameEvent);
        const line = collectDialogueLines(project).find((entry) => entry.speaker === "상인")!;
        const result = runTool({ project }, "rewrite_dialogue", { mode: "apply", allowMeaningChange: true, edits: [{ id: line.id, hash: line.hash, text: "80골드다." }] });
        expect(result.ok, result.summary).toBe(true);
      });
    });
  });
  // 대사 관리·대본(이야기 순서) — 색인, 이야기 순서, 대본 글, 조수 도구 네 개(+요약), 거절 규칙.
  describe("dialogueStoryScript", () => {
    isolateTimers();
    function page(id: string, commands: Command[], options: { conditions?: EventPageCondition[]; trigger?: Trigger } = {}): EventPage {
      return {
        id,
        name: id,
        conditions: options.conditions ?? [],
        graphic: {},
        trigger: options.trigger ?? { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      } as EventPage;
    }
    function event(id: string, name: string, pages: EventPage[], x = 1): GameEvent {
      return { id, name, x, y: 1, trigger: { kind: "action" }, commands: [], pages } as GameEvent;
    }
    const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
    const on = (switchId: string): EventPageCondition => ({ kind: "switch", switchId, value: true } as EventPageCondition);
    /**
     * 마을(시작 맵): 자동 시작 오프닝(sw_met) → 장로(sw_met 필요, 선택지, sw_quest) → 경비(sw_quest 필요, 동굴로 이동).
     * 동굴: 보스(sw_quest 필요, 엔딩). 곁가지: 마을 사람·광부(조건 없음). 오프닝은 일부러 맵 이벤트 목록 맨 뒤에 둔다.
     */
    function fixture(): Project {
      const project = createBlankProject();
      const town = project.maps[project.startMapId]!;
      town.name = "마을";
      const cave = createBlankMap("동굴", 20, 15, town.tilesetId);
      cave.id = "map_cave";
      project.maps[cave.id] = cave;
      town.events.push(
        event("ev_villager", "마을 사람", [page("p1", [say("마을 사람", "오늘 날씨 좋네.")])], 2),
        event("ev_guard", "경비", [page("p1", [
          say("경비", "동굴은 위험하다. 조심해라."),
          { kind: "transfer", mapId: cave.id, x: 1, y: 1 } as Command,
        ], { conditions: [on("sw_quest")] })], 3),
        event("ev_elder", "장로", [page("p1", [
          say("장로", "북쪽 동굴에 괴물이 산다. 가 주겠느냐?"),
          { kind: "choices", options: [
            { text: "가겠습니다", branch: [say("리나", "맡겨 주세요.")] },
            { text: "싫어요", branch: [say("리나", "조금만 생각해 볼게요.")] },
          ] } as Command,
          { kind: "setSwitch", switchId: "sw_quest", value: true } as Command,
        ], { conditions: [on("sw_met")] })], 4),
        event("ev_intro", "오프닝", [page("p1", [
          say("", "작은 마을의 아침."),
          say("리나", "\\C[2]장로님\\C[0]이 부르셨다고?"),
          { kind: "setSwitch", switchId: "sw_met", value: true } as Command,
        ], { trigger: { kind: "auto" } })], 5),
      );
      cave.events.push(
        event("ev_miner", "광부", [page("p1", [say("광부", "곡괭이가 또 부러졌군.")])], 2),
        event("ev_boss", "괴물", [page("p1", [
          say("괴물", "드디어 왔구나."),
          { kind: "ending", title: "1막 끝", message: "괴물을 쓰러뜨렸다." } as Command,
        ], { conditions: [on("sw_quest")] })], 3),
      );
      return project;
    }
    function ctxOf(project: Project): ToolContext {
      return { project };
    }
    function lineBy(project: Project, text: string) {
      const line = collectDialogueLines(project).find((entry) => entry.text.includes(text));
      if (!line) throw new Error(`no line ${text}`);
      return line;
    }
    describe("dialogue index", () => {
      it("collects text, choice and ending lines with stable ids, hashes and speakers", () => {
        const project = fixture();
        const lines = collectDialogueLines(project, { includeDescriptions: false });
        const elder = lineBy(project, "북쪽 동굴");
        expect(elder.speaker).toBe("장로");
        expect(elder.hash).toBe(dialogueTextHash(elder.text));
        expect(lines.filter((line) => line.kind === "choiceOption").map((line) => line.text)).toEqual(["가겠습니다", "싫어요"]);
        expect(lines.some((line) => line.kind === "ending" && line.text === "1막 끝")).toBe(true);
        const slot = resolveDialogueSlot(project, elder.id);
        expect(slot).not.toBeNull();
      });
    });
    describe("story order", () => {
      it("orders main scenes by switch gates and transfers, not by map/event order, and ends at the ending", () => {
        const project = fixture();
        const story = buildStory(project, { fresh: true });
        expect(story.chapters).toHaveLength(1);
        const chapter = story.chapters[0]!;
        const main = chapter.mainIds.map((id) => story.scenes.get(id)!);
        expect(main.map((scene) => scene.eventId)).toEqual(["ev_intro", "ev_elder", "ev_guard", "ev_boss"]);
        expect(main.map((scene) => scene.ref)).toEqual(["S1", "S2", "S3", "S4"]);
        expect(main.at(-1)!.endsChapter).toBe(true);
        const side = chapter.sideIds.map((id) => story.scenes.get(id)!);
        expect(side.map((scene) => scene.eventId).sort()).toEqual(["ev_miner", "ev_villager"]);
        expect(side.every((scene) => scene.lane === "side" && scene.ref.startsWith("B"))).toBe(true);
        // 동굴 곁가지(광부)는 동굴로 들어가는 장면 뒤에 닻을 둔다.
        const miner = side.find((scene) => scene.eventId === "ev_miner")!;
        expect(story.scenes.get(miner.anchorId!)?.eventId).toBe("ev_guard");
      });

      it("resolves S2.1 style refs to the line in that scene", () => {
        const project = fixture();
        const story = buildStory(project, { fresh: true });
        const target = resolveStoryRef(story, "S2.1");
        expect(target?.line?.text).toContain("북쪽 동굴");
      });
    });
    describe("screenplay text", () => {
      it("renders heading, conditions, speaker lines with tags, stage directions and choices", () => {
        const project = fixture();
        const story = buildStory(project, { fresh: true });
        const elder = story.scenes.get(story.chapters[0]!.mainIds[1]!)!;
        const text = renderSceneText(project, story, elder);
        const line = lineBy(project, "북쪽 동굴");
        expect(text).toMatch(/^### /u);
        expect(text).toContain("조건: S1 뒤"); // 이름 없는 스위치는 그 스위치를 켜는 장면으로 보인다
        expect(text).toContain(`장로: 북쪽 동굴에 괴물이 산다. 가 주겠느냐? ⟨S2.1·${line.hash.slice(0, 6)}⟩`);
        expect(text).toContain("[선택지]");
        expect(text).toMatch(/> 가겠습니다 ⟨S2\.\d+·/u);
        expect(text).toContain("리나: 맡겨 주세요.");
        const guard = renderSceneText(project, story, story.scenes.get(story.chapters[0]!.mainIds[2]!)!);
        expect(guard).toContain("[장소 이동 → 동굴]");
        const intro = renderSceneText(project, story, story.scenes.get(story.chapters[0]!.mainIds[0]!)!);
        expect(intro).toContain("(내레이션): 작은 마을의 아침.");
      });

      it("outline lists main scenes with side counts; includeSide lists side scenes", () => {
        const project = fixture();
        const outline = renderOutlineText(project);
        expect(outline).toMatch(/- S1 마을 — /u);
        expect(outline).not.toContain("## 곁가지");
        expect(renderOutlineText(project, undefined, { includeSide: true })).toContain("## 곁가지");
      });

      it("speaker selection includes side scenes (NPCs often only appear there)", () => {
        const project = fixture();
        const story = buildStory(project, { fresh: true });
        const scenes = selectScenes(story, { speaker: "광부" });
        expect(scenes.map((scene) => scene.eventId)).toEqual(["ev_miner"]);
      });

      it("from/to accept a side scene ref and slice by position", () => {
        const project = fixture();
        const story = buildStory(project, { fresh: true });
        const all = selectScenes(story, { includeSide: true });
        const sideAt = all.findIndex((scene) => scene.lane === "side");
        expect(sideAt).toBeGreaterThan(0);
        const from = selectScenes(story, { includeSide: true, from: all[sideAt]!.ref });
        expect(from.map((scene) => scene.ref)).toEqual(all.slice(sideAt).map((scene) => scene.ref));
      });

      it("marks lines that overflow the measured window", () => {
        const project = fixture();
        writeDialogueWindow(project, {
          key: dialogueMeasureKey(project),
          variants: [{ face: false, speaker: true, bodyWidthPx: 60, fontSizePx: 12, maxLines: 1, fontLabel: "테스트" }],
        });
        const story = buildStory(project, { fresh: true });
        const text = renderSceneText(project, story, story.scenes.get(story.chapters[0]!.mainIds[1]!)!);
        expect(text).toMatch(/«창 넘침 \d+\/1줄»/u);
      });
    });
    describe("assistant story tools", () => {
      it("get_story_outline returns the outline, chapters and cast", () => {
        const result = runTool(ctxOf(fixture()), "get_story_outline", {});
        expect(result.ok).toBe(true);
        const data = result.data as { outline: string; chapters: { main: number; side: number }[]; cast: { speaker: string }[] };
        expect(data.chapters[0]).toMatchObject({ main: 4, side: 2 });
        expect(data.outline).toContain("S4");
        expect(data.cast.map((entry) => entry.speaker)).toContain("리나");
      });

      it("read_story_script speaker filter finds a side-only NPC", () => {
        const result = runTool(ctxOf(fixture()), "read_story_script", { speaker: "광부" });
        expect(result.ok).toBe(true);
        expect((result.data as { script: string }).script).toContain("광부: 곡괭이가 또 부러졌군.");
      });

      it("read_story_script paginates with nextFrom, and nextFrom on a side scene continues", () => {
        const project = fixture();
        const story = buildStory(project, { fresh: true });
        const all = selectScenes(story, { includeSide: true });
        const side = all.find((scene, index) => index > 0 && scene.lane === "side")!;
        // 곁가지 바로 앞까지만 들어가게 자른다.
        const before = all.slice(0, all.indexOf(side)).map((scene) => renderSceneText(project, story, scene));
        const budget = Math.max(2000, before.reduce((sum, text) => sum + text.length + 2, 0));
        const first = runTool(ctxOf(project), "read_story_script", { includeSide: true, maxChars: budget });
        expect(first.ok).toBe(true);
        const nextFrom = (first.data as { nextFrom?: string }).nextFrom;
        if (nextFrom) {
          const second = runTool(ctxOf(project), "read_story_script", { includeSide: true, from: nextFrom });
          expect(second.ok).toBe(true);
          expect((second.data as { script: string }).script).toContain(`### `);
        }
        // nextFrom 이 곁가지 번호여도 그 자리부터 읽는다.
        const fromSide = runTool(ctxOf(project), "read_story_script", { includeSide: true, from: side.ref });
        expect(fromSide.ok).toBe(true);
        expect((fromSide.data as { script: string }).script.startsWith(`### `)).toBe(true);
        expect((fromSide.data as { script: string }).script).toContain(side.lines[0]!.text);
      });

      it("rewrite_dialogue takes a script ref + 6-char hash and leaves a proposal (game text unchanged)", () => {
        const project = fixture();
        const line = lineBy(project, "북쪽 동굴");
        const ctx = ctxOf(project);
        const result = runTool(ctx, "rewrite_dialogue", {
          edits: [{ ref: "S2.1", hash: line.hash.slice(0, 6), text: "북쪽 동굴에 괴물이 있다. 가 줄 테냐?", reason: "짧게" }],
        });
        expect(result.ok).toBe(true);
        const proposals = readDialogueDesk(ctx.project).proposals;
        expect(proposals).toHaveLength(1);
        expect(proposals[0]).toMatchObject({ lineId: line.id, after: "북쪽 동굴에 괴물이 있다. 가 줄 테냐?" });
        expect(lineBy(ctx.project, "북쪽 동굴").text).toBe(line.text);
      });

      it("read_story_script names the valid range instead of returning nothing for an unknown scene ref", () => {
        const result = runTool(ctxOf(fixture()), "read_story_script", { includeSide: true, from: "B1", to: "B99" });
        expect(result.ok).toBe(false);
        expect(JSON.stringify(result)).toContain("B99 없음");
        expect(JSON.stringify(result)).toContain("곁가지는 B1~B2");
      });

      it("never evicts older proposals when the proposal list is full; the overflow is reported as rejected", () => {
        const project = fixture();
        const filler: DialogueProposal[] = Array.from({ length: DIALOGUE_PROPOSAL_LIMIT - 1 }, (_, index) => ({
          id: `p${index}`, lineId: `ev/x/y/z/${index}#body`, baseHash: "h", before: "a", after: "b", source: "ai", createdAt: "",
        }));
        expect(upsertDialogueProposals(project, filler)).toBe(DIALOGUE_PROPOSAL_LIMIT - 1);
        const elder = lineBy(project, "북쪽 동굴");
        const villager = lineBy(project, "날씨 좋네");
        const ctx = ctxOf(project);
        const result = runTool(ctx, "rewrite_dialogue", { edits: [
          { id: elder.id, hash: elder.hash, text: "북쪽 동굴 괴물, 맡아 줄 테냐?" },
          { id: villager.id, hash: villager.hash, text: "날씨 참 좋다." },
        ] });
        expect(result.ok).toBe(true);
        const proposals = readDialogueDesk(ctx.project).proposals;
        expect(proposals).toHaveLength(DIALOGUE_PROPOSAL_LIMIT);
        expect(proposals[0]!.id).toBe("p0");
        const data = result.data as { accepted: { id: string }[]; rejected: { id: string; reason: string }[] };
        expect(data.accepted).toHaveLength(1);
        expect(data.rejected).toEqual([expect.objectContaining({ reason: "full" })]);
      });

      it("rewrite_dialogue rejects an unknown ref", () => {
        const result = runTool(ctxOf(fixture()), "rewrite_dialogue", { edits: [{ ref: "S9.9", hash: "abcdef", text: "x" }] });
        expect(result.ok).toBe(false);
      });

      it("set_scene_summaries stores a summary that the outline then shows", () => {
        const project = fixture();
        const ctx = ctxOf(project);
        const result = runTool(ctx, "set_scene_summaries", { items: [{ scene: "S2", summary: "장로가 동굴 괴물 퇴치를 부탁한다." }] });
        expect(result.ok).toBe(true);
        const outline = runTool(ctx, "get_story_outline", {});
        expect((outline.data as { outline: string }).outline).toContain("장로가 동굴 괴물 퇴치를 부탁한다.");
      });
    });
    describe("edit rejections", () => {
      it("rejects a stale hash", () => {
        const project = fixture();
        const line = lineBy(project, "북쪽 동굴");
        const verdict = checkDialogueEdit(project, { id: line.id, hash: "000000000000", text: "다른 글" });
        expect(verdict).toMatchObject({ ok: false, reason: "stale-hash" });
      });

      it("rejects dropped or added control codes", () => {
        const project = fixture();
        const line = lineBy(project, "부르셨다고");
        expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "장로님이 부르셨다고?" })).toMatchObject({ ok: false, reason: "control-codes" });
        expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "\\C[2]장로님\\C[0]이 \\C[3]부르셨다고?" })).toMatchObject({ ok: false, reason: "control-codes" });
        expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "\\C[2]장로님\\C[0], 부르셨어요?" })).toMatchObject({ ok: true });
      });

      it("rejects text that overflows the window more than the original unless allowOverflow", () => {
        const project = fixture();
        writeDialogueWindow(project, {
          key: dialogueMeasureKey(project),
          variants: [{ face: false, speaker: true, bodyWidthPx: 200, fontSizePx: 12, maxLines: 2, fontLabel: "테스트" }],
        });
        const line = lineBy(project, "북쪽 동굴");
        expect(estimateLineFit(project, line, line.text)?.overflow).toBe(false);
        const long = "북쪽 동굴에 괴물이 산다. ".repeat(8);
        expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: long })).toMatchObject({ ok: false, reason: "overflow" });
        expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: long }, { allowOverflow: true }).ok).toBe(true);
      });

      it("apply writes the text into the event command and changes the hash", () => {
        const project = fixture();
        const line = lineBy(project, "북쪽 동굴");
        const [verdict] = applyDialogueEdits(project, [{ id: line.id, hash: line.hash, text: "동굴 괴물 좀 잡아 다오." }]);
        expect(verdict!.ok).toBe(true);
        const after = collectDialogueLines(project).find((entry) => entry.id === line.id)!;
        expect(after.text).toBe("동굴 괴물 좀 잡아 다오.");
        expect(after.hash).not.toBe(line.hash);
        expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "또 고침" })).toMatchObject({ ok: false, reason: "stale-hash" });
      });
    });
  });
});

describe("editorOperatorsSuite", () => {
  isolateTimers();
  // 재료 슬롯 계약 — 오퍼레이터가 칩셋에 닿는 유일한 통로.
  // 핵심 불변식: 슬롯은 저장이 아니라 승인 어휘에서 유도되고, 사용자 오버라이드가 최우선이며,
  // combined_town 에서는 기존 하드코딩과 **같은 타일**을 낸다(회귀 0의 근거).
  describe("materialSlots", () => {
    isolateTimers();
    const REGION = { x: 1, y: 1, width: 18, height: 14 };
    // The combined-town sheet is no longer the start map's tileset (beodeul_city since the 2026-10-07 copyright purge);
    // build the retired definition explicitly, as an old save carries it.
    function combinedTownTileset(): TilesetDef {
      const tileset = retiredEasyRpgTileset(RETIRED_COMBINED_TOWN_TILESET_ID);
      ensureBuildPaletteTileGroups(tileset);
      return tileset;
    }
    function grassMap(width = 24, height = 20) {
      return {
        width,
        height,
        lowerTiles: Array.from({ length: width * height }, () => 240),
        upperTiles: Array.from({ length: width * height }, () => -1),
      };
    }
    describe("슬롯 해석", () => {
      it("번들 칩셋은 설정 없이 채워진다 — 사람이 할 일이 0", () => {
        const slots = resolveMaterialSlots(combinedTownTileset());
        const coverage = materialSlotCoverage(slots);
        expect(coverage.total).toBe(MATERIAL_SLOT_IDS.length);
        expect(coverage.filled).toBeGreaterThanOrEqual(6);
        // forest 가 실제로 쓰는 재료는 반드시 있어야 한다.
        for (const id of ["ground", "path", "tree"] as const) {
          expect(slots[id], `${id} 슬롯이 비었다`).toBeDefined();
          expect(slots[id]!.source).toBe("bundled");
          expect(slots[id]!.tiles.length).toBeGreaterThan(0);
        }
      });

      it("나무 슬롯은 수관·밑동 쌍으로 읽힌다", () => {
        const slots = resolveMaterialSlots(combinedTownTileset());
        const tree = slots.tree!;
        expect(tree.pair).toBeDefined();
        expect(tree.pair!.top).not.toBe(tree.pair!.bottom);
        // combined_town 침엽수 = 260(수관)/290(밑동)
        expect([260, 262]).toContain(tree.pair!.top);
        expect([290, 292]).toContain(tree.pair!.bottom);
      });

      it("사용자 오버라이드가 번들보다 우선한다", () => {
        const tileset = combinedTownTileset();
        tileset.materialSlots = { ground: { tiles: [999, 998] } };
        const slots = resolveMaterialSlots(tileset);
        expect(slots.ground!.tiles).toEqual([999, 998]);
        expect(slots.ground!.source).toBe("user");
        // 오버라이드하지 않은 슬롯은 그대로 번들에서 온다.
        expect(slots.tree!.source).toBe("bundled");
      });

      it("승인되지 않은 그룹은 재료가 되지 않는다 (zero-trust 유지)", () => {
        const tileset = combinedTownTileset();
        for (const group of tileset.tileGroups ?? []) {
          delete (group as { origin?: string }).origin;
          delete (group as { source?: string }).source;
        }
        expect(materialSlotCoverage(resolveMaterialSlots(tileset)).filled).toBe(0);
      });

      it("타일셋이 없으면 빈 슬롯", () => {
        expect(resolveMaterialSlots(undefined)).toEqual({});
      });
    });
    describe("팔레트 유도", () => {
      it("combined_town 유도 팔레트가 하드코딩과 같은 수종·지면·덤불을 낸다", () => {
        const slots = resolveMaterialSlots(combinedTownTileset());
        const derived = forestPaletteFromSlots(slots);
        const base = COMBINED_TOWN_FOREST_PALETTE;
        // 수종 혼합이 핵심이다 — 침엽수 + 활엽수 2종이 그대로 나와야 "뻔한 숲" 으로 돌아가지 않는다.
        // 활엽수는 2×2 source_rect 라 좌측 열(262/292)로 읽혀야 한다(263 이 아래로 가면 나무가 깨진다).
        expect(derived.species).toEqual(base.species);
        expect(derived.dead).toEqual(base.dead);
        expect(derived.groundBase).toBe(base.groundBase);
        expect(derived.groundDark).toBe(base.groundDark);
        expect(derived.bush).toBe(base.bush);
      });

      it("길·꽃은 하네스가 선언한 본체를 따른다 — 그룹 밖 타일이 들어오지 않는다", () => {
        // 하드코딩(391·348)은 내 추측이었고, 그룹의 center 파트/대표 타일이 정본이다.
        // 값이 달라도 되지만 반드시 그 그룹 안에 있어야 한다.
        const slots = resolveMaterialSlots(combinedTownTileset());
        const derived = forestPaletteFromSlots(slots);
        expect(slots.path!.tiles).toContain(derived.path);
        expect(slots.flower!.tiles).toContain(derived.flower);
        // 본체는 오토타일 모서리(tileIds[0])가 아니어야 한다.
        expect(derived.path).toBe(slots.path!.body);
      });

      it("같은 시드는 팔레트가 같으면 같은 숲 — 유도 팔레트도 결정적이다", () => {
        const slots = resolveMaterialSlots(combinedTownTileset());
        const map = grassMap();
        const params = { density: 0.8, deadRatio: 0.15, underbrush: 0.6 };
        const a = buildForestWrites(map, REGION, params, 4242, forestPaletteFromSlots(slots));
        const b = buildForestWrites(map, REGION, params, 4242, forestPaletteFromSlots(slots));
        expect(a.writes).toEqual(b.writes);
        expect(a.trees).toBeGreaterThan(0);
      });

      it("슬롯이 비면 기본 팔레트로 떨어진다 — 재료가 없다고 기능이 죽지 않는다", () => {
        const palette = forestPaletteFromSlots({});
        expect(palette.groundBase).toBe(COMBINED_TOWN_FOREST_PALETTE.groundBase);
        expect(palette.species).toEqual(COMBINED_TOWN_FOREST_PALETTE.species);
      });

      it("낯선 칩셋의 타일로도 숲을 심는다 — 하드코딩에 묶이지 않는다", () => {
        const palette = forestPaletteFromSlots({
          ground: { id: "ground", label: "지면", tiles: [700, 701], layer: "lower", source: "user" },
          tree: {
            id: "tree", label: "나무", tiles: [800, 900],
            pair: { top: 800, bottom: 900 }, layer: "upper", source: "user",
          },
          path: { id: "path", label: "길", tiles: [750], layer: "lower", source: "user" },
        });
        expect(palette.groundBase).toBe(700);
        expect(palette.species).toEqual([[800, 900]]);
        expect(palette.path).toBe(750);

        // 그 팔레트로 실제 생성 — 낯선 타일만 쓰이는지 확인.
        const width = 24, height = 20;
        const map = {
          width, height,
          lowerTiles: Array.from({ length: width * height }, () => 700),
          upperTiles: Array.from({ length: width * height }, () => -1),
        };
        const built = buildForestWrites(map, REGION, { density: 0.9, underbrush: 0 }, 9, palette);
        expect(built.trees).toBeGreaterThan(0);
        const canopies = built.writes.filter((w) => w.layer === "upper").map((w) => w.tile);
        const trunks = built.writes.filter((w) => w.layer === "lower" && w.tile === 900);
        expect(new Set(canopies)).toEqual(new Set([800]));
        expect(trunks.length).toBe(built.trees);
        // combined_town 타일이 새어 들어오지 않는다.
        for (const write of built.writes) expect([260, 290, 261, 291, 240]).not.toContain(write.tile);
      });

      it("나무 재료가 없으면 지면만 칠하고 나무는 0", () => {
        const palette = forestPaletteFromSlots({
          ground: { id: "ground", label: "지면", tiles: [700], layer: "lower", source: "user" },
        });
        const noTrees = { ...palette, species: [], dead: null };
        const width = 20, height = 16;
        const map = {
          width, height,
          lowerTiles: Array.from({ length: width * height }, () => 700),
          upperTiles: Array.from({ length: width * height }, () => -1),
        };
        const built = buildForestWrites(map, REGION, { density: 0.9 }, 3, noTrees);
        expect(built.trees).toBe(0);
      });
    });
  });
  // 의도 파서 계약 — 모델의 출력 표면은 (op + params) JSON 하나뿐이고,
  // 그 값조차 레지스트리 스펙으로 검증·클램프된 뒤에야 생성기에 닿는다.
  describe("operatorIntent", () => {
    isolateTimers();
    const forest = () => {
      const def = getOperator("forest");
      if (!def) throw new Error("forest 등록 필요");
      return def;
    };
    describe("프롬프트 생성", () => {
      it("레지스트리에서 만들어진다 — 오퍼레이터를 늘려도 프롬프트를 손댈 필요가 없다", () => {
        const prompt = buildOperatorIntentPrompt();
        for (const operator of listOperators()) {
          expect(prompt).toContain(operator.id);
          expect(prompt).toContain(operator.label);
          for (const spec of operator.params) expect(prompt).toContain(spec.id);
        }
      });

      it("타일·좌표를 만들지 말라고 명시한다", () => {
        const prompt = buildOperatorIntentPrompt();
        expect(prompt).toContain("좌표");
        expect(prompt).toMatch(/타일 번호[^\n]*만들지 마라/);
      });
    });
    describe("모델 응답 검증", () => {
      it("정상 JSON 을 의도로 옮긴다", () => {
        const intent = parseOperatorIntentJson('{"op":"forest","params":{"density":0.9,"path":false}}');
        expect(isOperatorIntentFailure(intent)).toBe(false);
        if (isOperatorIntentFailure(intent)) return;
        expect(intent.operatorId).toBe("forest");
        expect(intent.params.density).toBe(0.9);
        expect(intent.params.path).toBe(false);
        expect(intent.source).toBe("llm");
      });

      it("코드펜스·잡담이 섞여 와도 JSON 을 건진다", () => {
        const intent = parseOperatorIntentJson('```json\n{"op":"forest","params":{"density":0.8}}\n```');
        expect(isOperatorIntentFailure(intent)).toBe(false);
        const withChatter = parseOperatorIntentJson('알겠습니다 {"op":"forest","params":{}} 이렇게 하겠습니다');
        expect(isOperatorIntentFailure(withChatter)).toBe(false);
      });

      it("범위 밖·스펙 밖 값은 생성기에 닿기 전에 잘린다", () => {
        const intent = parseOperatorIntentJson('{"op":"forest","params":{"density":99,"clearings":2.6,"tileId":306,"주입":"x"}}');
        expect(isOperatorIntentFailure(intent)).toBe(false);
        if (isOperatorIntentFailure(intent)) return;
        expect(intent.params.density).toBe(1);
        expect(intent.params.clearings).toBe(3);
        expect(intent.params).not.toHaveProperty("tileId");
        expect(intent.params).not.toHaveProperty("주입");
      });

      it("모르는 생성기·깨진 JSON 은 실패로 끝난다", () => {
        expect(isOperatorIntentFailure(parseOperatorIntentJson('{"op":"nuke","params":{}}'))).toBe(true);
        expect(isOperatorIntentFailure(parseOperatorIntentJson("설명만 하고 JSON 이 없음"))).toBe(true);
        expect(isOperatorIntentFailure(parseOperatorIntentJson('{"params":{}}'))).toBe(true);
      });
    });
    describe("키워드 폴백", () => {
      it("정도를 나타내는 말을 수치로 옮긴다", () => {
        const dense = heuristicOperatorIntent("숲을 울창하게 만들어줘");
        const sparse = heuristicOperatorIntent("나무를 듬성듬성 심어줘");
        if (isOperatorIntentFailure(dense) || isOperatorIntentFailure(sparse)) throw new Error("해석 실패");
        expect(dense.params.density).toBeGreaterThan(sparse.params.density as number);
        expect(dense.source).toBe("heuristic");
      });

      it("오솔길 유무를 읽는다", () => {
        const withPath = heuristicOperatorIntent("숲에 오솔길 하나");
        const without = heuristicOperatorIntent("숲인데 길 없이");
        if (isOperatorIntentFailure(withPath) || isOperatorIntentFailure(without)) throw new Error("해석 실패");
        expect(withPath.params.path).toBe(true);
        expect(without.params.path).toBe(false);
      });

      it("생성기를 특정 못 하면 추측하지 않고 실패한다", () => {
        const result = heuristicOperatorIntent("여기 뭔가 멋있게 해줘");
        expect(isOperatorIntentFailure(result)).toBe(true);
        if (!isOperatorIntentFailure(result)) return;
        expect(result.error).toContain("숲");
      });
    });
    describe("resolveOperatorIntent", () => {
      it("LLM 이 있으면 한 번만 부른다", async () => {
        const complete = vi.fn(async () => '{"op":"forest","params":{"density":0.85}}');
        const intent = await resolveOperatorIntent("울창한 숲", { complete });
        expect(complete).toHaveBeenCalledTimes(1);
        if (isOperatorIntentFailure(intent)) throw new Error("해석 실패");
        expect(intent.source).toBe("llm");
        expect(intent.params.density).toBe(0.85);
      });

      it("LLM 이 실패하면 키워드로 떨어지고 그 사실을 밝힌다", async () => {
        const complete = vi.fn(async () => { throw new Error("401"); });
        const intent = await resolveOperatorIntent("울창한 숲", { complete });
        if (isOperatorIntentFailure(intent)) throw new Error("폴백이 동작해야 한다");
        expect(intent.source).toBe("heuristic");
        expect(intent.params.density).toBe(0.9);
      });

      it("모델이 형식을 어겨도 키워드로 구제한다", async () => {
        const complete = vi.fn(async () => "숲을 만들겠습니다!");
        const intent = await resolveOperatorIntent("울창한 숲", { complete });
        if (isOperatorIntentFailure(intent)) throw new Error("폴백이 동작해야 한다");
        expect(intent.source).toBe("heuristic");
      });

      it("LLM 도 키워드도 못 읽으면 실패를 그대로 돌려준다", async () => {
        const complete = vi.fn(async () => "{}");
        const intent = await resolveOperatorIntent("아무 말", { complete });
        expect(isOperatorIntentFailure(intent)).toBe(true);
      });

      it("빈 문장은 부르지도 않는다", async () => {
        const complete = vi.fn(async () => "{}");
        const intent = await resolveOperatorIntent("   ", { complete });
        expect(complete).not.toHaveBeenCalled();
        expect(isOperatorIntentFailure(intent)).toBe(true);
      });
    });
    describe("describeIntent", () => {
      it("기본값과 다른 것만 적는다", () => {
        const def = forest();
        const defaults: Record<string, number | boolean> = {};
        for (const spec of def.params) defaults[spec.id] = spec.defaultValue;
        expect(describeIntent(def, defaults)).toContain("기본 설정");
        expect(describeIntent(def, { ...defaults, density: 0.95 })).toContain("밀도 0.95");
      });
    });
  });
});

describe("editorRegionTaskSuite", () => {
  isolateTimers();
  // forest 오퍼레이터 프로토타입 불변식 — 예술이 아니라 계약을 고정한다.
  describe("forestWrites", () => {
    isolateTimers();
    const TRUNKS = new Set([290, 291, 292, 293]);
    const CANOPIES = new Set([260, 261, 262, 263]);
    /** 1×1 풀 — 키큰 풀 오토타일 조각 + 잔디 변형. 한 칸만 쓰면 네모로 뜬다. */
    const ONE_BY_ONE_GRASS = new Set([
      243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335,
      270, 271, 272, 300, 301, 302, 330,
    ]);
    function grassMap(width: number, height: number): ForestMapView {
      return {
        width,
        height,
        lowerTiles: Array.from({ length: width * height }, () => 240),
        upperTiles: Array.from({ length: width * height }, () => -1),
      };
    }
    const REGION: RegionRect = { x: 2, y: 2, width: 30, height: 20 };
    describe("buildForestWrites", () => {
      it("같은 시드·입력이면 결과가 동일하다(결정성)", () => {
        const map = grassMap(40, 30);
        const a = buildForestWrites(map, REGION, { density: 0.7 }, 42);
        const b = buildForestWrites(map, REGION, { density: 0.7 }, 42);
        expect(a.writes).toEqual(b.writes);
        const c = buildForestWrites(map, REGION, { density: 0.7 }, 43);
        expect(JSON.stringify(c.writes)).not.toEqual(JSON.stringify(a.writes));
      });

      it("모든 write 가 영역 안이다", () => {
        const map = grassMap(40, 30);
        const { writes } = buildForestWrites(map, REGION, {}, 7);
        expect(writes.length).toBeGreaterThan(0);
        for (const w of writes) {
          expect(w.x).toBeGreaterThanOrEqual(REGION.x);
          expect(w.x).toBeLessThan(REGION.x + REGION.width);
          expect(w.y).toBeGreaterThanOrEqual(REGION.y);
          expect(w.y).toBeLessThan(REGION.y + REGION.height);
        }
      });

      it("밑동 lower 마다 바로 위 칸 upper 에 수관이 있다(떠 있는 밑동 금지)", () => {
        const map = grassMap(40, 30);
        const { writes, trees } = buildForestWrites(map, REGION, { density: 0.8 }, 11);
        expect(trees).toBeGreaterThan(10);
        const upperAt = new Map(writes.filter((w) => w.layer === "upper").map((w) => [`${w.x},${w.y}`, w.tile]));
        const trunkWrites = writes.filter((w) => w.layer === "lower" && TRUNKS.has(w.tile));
        expect(trunkWrites.length).toBe(trees);
        for (const t of trunkWrites) {
          const canopy = upperAt.get(`${t.x},${t.y - 1}`);
          expect(canopy !== undefined && CANOPIES.has(canopy)).toBe(true);
        }
        // 수관이 lower 로 새지 않는다.
        for (const w of writes) {
          if (w.layer === "lower") expect(CANOPIES.has(w.tile)).toBe(false);
        }
      });

      it("지면이 아닌 칸(구조물)은 절대 건드리지 않는다", () => {
        const map = grassMap(40, 30);
        const walls = new Set<number>();
        for (let y = 6; y <= 10; y += 1) {
          for (let x = 8; x <= 14; x += 1) {
            (map.lowerTiles as number[])[y * map.width + x] = 306; // WALL
            walls.add(y * map.width + x);
          }
        }
        const { writes } = buildForestWrites(map, REGION, { density: 0.9 }, 3);
        for (const w of writes) {
          expect(walls.has(w.y * map.width + w.x)).toBe(false);
        }
      });

      it("density 가 오르면 나무 수가 는다(울창하게 = 파라미터)", () => {
        const map = grassMap(40, 30);
        const sparse = buildForestWrites(map, REGION, { density: 0.25, path: false, clearings: 0 }, 5).trees;
        const mid = buildForestWrites(map, REGION, { density: 0.55, path: false, clearings: 0 }, 5).trees;
        const dense = buildForestWrites(map, REGION, { density: 0.9, path: false, clearings: 0 }, 5).trees;
        expect(sparse).toBeGreaterThan(0);
        expect(mid).toBeGreaterThan(sparse);
        expect(dense).toBeGreaterThan(mid);
      });

      it("path:true 면 서→동 오솔길이 한 덩어리로 이어진다", () => {
        const map = grassMap(40, 30);
        const { writes } = buildForestWrites(map, REGION, { density: 0.85, path: true }, 9);
        const path = new Set(
          writes.filter((w) => w.layer === "lower" && w.tile === 391).map((w) => `${w.x},${w.y}`),
        );
        expect(path.size).toBeGreaterThanOrEqual(REGION.width);
        // 모든 열에 길이 있다.
        for (let x = REGION.x; x < REGION.x + REGION.width; x += 1) {
          let found = false;
          for (let y = REGION.y; y < REGION.y + REGION.height; y += 1) {
            if (path.has(`${x},${y}`)) { found = true; break; }
          }
          expect(found).toBe(true);
        }
        // 4-연결 단일 성분.
        const start = [...path][0];
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length > 0) {
          const cur = queue.pop() as string;
          const [cx, cy] = cur.split(",").map(Number);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const key = `${cx + dx},${cy + dy}`;
            if (path.has(key) && !seen.has(key)) { seen.add(key); queue.push(key); }
          }
        }
        expect(seen.size).toBe(path.size);
        // 길과 밑동이 같은 칸을 다투지 않는다.
        for (const w of writes) {
          if (w.layer === "lower" && TRUNKS.has(w.tile)) expect(path.has(`${w.x},${w.y}`)).toBe(false);
        }
      });

      it("1×1 풀(키큰 풀·잔디 변형)을 lower 에 쓰지 않는다", () => {
        const map = grassMap(40, 30);
        const { writes } = buildForestWrites(map, REGION, { density: 0.7, groundNoise: true }, 42);
        const grassWrites = writes.filter((write) => write.layer === "lower" && ONE_BY_ONE_GRASS.has(write.tile));
        expect(grassWrites).toEqual([]);
      });
    });
  });
  // 이음새 마감 + 어울림 검증 계약.
  //
  // 이 두 함수가 다듬기의 "결과가 정말 이어졌는가" 를 책임진다. 특히 polishRegionSeams 는
  // 영역 **밖 1칸**을 건드리는 유일한 경로라, 재질까지 바꾸지 않는다는 계약이 깨지면
  // 하드 스코프(clipMapCellsToRegion)를 우회해 맵을 오염시키는 구멍이 된다.
  describe("regionBlend", () => {
    isolateTimers();
    // TILE.* 는 합본 마을 칩 번호다 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵이 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
    const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
    const MAP_ID = "map_blend";
    const W = 20;
    const REGION: RegionRect = { x: 8, y: 8, width: 4, height: 4 };
    function makeProject(): Project {
      const context = { project: createBlankProject() };
      const created = runTool(context, "create_map", { id: MAP_ID, name: "어울림 테스트", width: W, height: W, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
      expect(created.ok, created.summary).toBe(true);
      context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
      return context.project;
    }
    /** 이 맵의 오토타일 그룹이 관리하는 타일 id 전체 — "재질 집합" 판정의 기준. */
    function autotileMemberIds(project: Project): Set<number> {
      const map = project.maps[MAP_ID];
      const ids = new Set<number>();
      for (const group of autotileGroupsForTileset(project.tilesets[map.tilesetId])) {
        for (const id of group.memberTileIds) ids.add(id);
      }
      return ids;
    }
    function fill(project: Project, rect: RegionRect, tileId: number): void {
      const map = project.maps[MAP_ID];
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) map.lowerTiles[y * W + x] = tileId;
      }
    }
    describe("expandRegion", () => {
      it("margin 만큼 키우고 맵 안으로 자른다", () => {
        expect(expandRegion({ x: 5, y: 5, width: 2, height: 2 }, 2)).toEqual({ x: 3, y: 3, width: 6, height: 6 });
        // 좌상단에 붙으면 음수로 나가지 않고 폭이 줄어든다(오른쪽·아래는 그대로 자란다).
        expect(expandRegion({ x: 0, y: 0, width: 2, height: 2 }, 2, { width: 10, height: 10 }))
          .toEqual({ x: 0, y: 0, width: 4, height: 4 });
        expect(expandRegion({ x: 8, y: 8, width: 2, height: 2 }, 2, { width: 10, height: 10 }))
          .toEqual({ x: 6, y: 6, width: 4, height: 4 });
      });
    });
    describe("polishRegionSeams", () => {
      it("계단식 모래 경계의 변형을 다시 계산하고 재질 집합은 바꾸지 않는다", () => {
        const project = makeProject();
        // 영역 안을 통째로 기본 모래 id 로 칠한다 — 변형이 전부 «가운데» 라 경계가 직각으로 굳는다.
        fill(project, REGION, TILE.SAND);
        const before = project.maps[MAP_ID].lowerTiles.slice();
        const members = autotileMemberIds(project);

        const result = polishRegionSeams(project, MAP_ID, REGION);

        expect(result.polishedCells).toBeGreaterThan(0);
        // 입력은 변형되지 않는다(순수).
        expect(project.maps[MAP_ID].lowerTiles).toEqual(before);
        const after = result.project.maps[MAP_ID].lowerTiles;
        // 바뀐 칸은 모두 오토타일 그룹 멤버 사이의 이동이다 — 잔디가 모래로 뒤바뀌지 않는다.
        for (let index = 0; index < after.length; index += 1) {
          if (after[index] === before[index]) continue;
          expect(members.has(before[index]!)).toBe(true);
          expect(members.has(after[index]!)).toBe(true);
        }
      });

      it("멱등이다 — 승인 시 재검토에서 다시 돌려도 결과가 같다", () => {
        const project = makeProject();
        fill(project, REGION, TILE.SAND);
        const once = polishRegionSeams(project, MAP_ID, REGION);
        const twice = polishRegionSeams(once.project, MAP_ID, REGION);
        expect(twice.project.maps[MAP_ID].lowerTiles).toEqual(once.project.maps[MAP_ID].lowerTiles);
        expect(twice.seamCells).toBe(0);
      });

      it("없는 맵이면 입력을 그대로 돌려준다", () => {
        const project = makeProject();
        const result = polishRegionSeams(project, "map_missing", REGION);
        expect(result.project).toBe(project);
        expect(result.seamCells).toBe(0);
      });

      it("이음새로 바뀐 영역 밖 칸은 확장 스코프에서 region-scope-violation 이 되지 않는다", () => {
        const base = makeProject();
        fill(base, REGION, TILE.SAND);
        // 영역 밖 한 줄도 모래로 — polishMapTerrain 이 8-이웃 링까지 재검사하므로 밖에서도 변형이 바뀐다.
        fill(base, { x: REGION.x, y: REGION.y + REGION.height, width: REGION.width, height: 1 }, TILE.SAND);
        const seamed = polishRegionSeams(base, MAP_ID, REGION);
        expect(seamed.seamCells).toBeGreaterThan(0);

        const scoped = reviewRegionDraft({
          base,
          draft: seamed.project,
          mapId: MAP_ID,
          region: REGION,
          scopeRegion: expandRegion(REGION, 1, base.maps[MAP_ID]),
        });
        expect(scoped.report.issues.filter((issue) => issue.code === "region-scope-violation")).toEqual([]);

        // 같은 초안을 원래 사각형 기준으로 보면 error 로 잡힌다 — 확장 스코프가 실제로 필요했다는 증거.
        const strict = reviewRegionDraft({ base, draft: seamed.project, mapId: MAP_ID, region: REGION });
        expect(strict.report.issues.some((issue) => issue.code === "region-scope-violation")).toBe(true);
      });
    });
    describe("analyzeRegionBlend", () => {
      it("주변과 같은 재질이면 만점이다", () => {
        const project = makeProject();
        const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
        expect(report.totalEdgeCells).toBe(REGION.width * 2 + REGION.height * 2);
        expect(report.matchedEdgeCells).toBe(report.totalEdgeCells);
        expect(report.score).toBe(100);
        expect(report.brokenCrossings).toEqual([]);
      });

      it("바깥 길이 영역 안에서 끊기면 brokenCrossings 로 좌표를 남긴다", () => {
        const project = makeProject();
        // 영역 위쪽 바로 밖 한 줄을 길로 — 영역 안은 잔디라 길이 끊긴다.
        fill(project, { x: REGION.x, y: REGION.y - 1, width: REGION.width, height: 1 }, TILE.PATH);

        const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
        expect(report.brokenCrossings).toHaveLength(REGION.width);
        for (const crossing of report.brokenCrossings) {
          expect(crossing.kind).toBe("road");
          expect(crossing.y).toBe(REGION.y);
        }
        expect(report.score).toBeLessThan(100);
        expect(describeBlendBreak(report.brokenCrossings[0])).toContain(`(${REGION.x},${REGION.y})`);
      });

      it("길을 영역 안까지 이으면 끊김이 사라진다", () => {
        const project = makeProject();
        fill(project, { x: REGION.x, y: REGION.y - 1, width: REGION.width, height: 1 }, TILE.PATH);
        fill(project, REGION, TILE.PATH);
        const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
        expect(report.brokenCrossings).toEqual([]);
      });

      it("원래부터 벽이던 경계는 newlyBlockedEntrances 에 들어가지 않는다", () => {
        const base = makeProject();
        // 영역 첫 줄을 벽으로 — base 에서도 막혀 있다.
        fill(base, { x: REGION.x, y: REGION.y, width: REGION.width, height: 1 }, TILE.WALL);
        const report = analyzeRegionBlend({ project: base, mapId: MAP_ID, region: REGION, base });
        expect(report.newlyBlockedEntrances).toEqual([]);
      });

      it("걸어 들어오던 칸을 이 초안이 막으면 새로 막힌 진입으로 센다", () => {
        const base = makeProject();
        const draft: Project = structuredClone(base);
        fill(draft, { x: REGION.x, y: REGION.y, width: REGION.width, height: 1 }, TILE.WALL);

        const report = analyzeRegionBlend({ project: draft, mapId: MAP_ID, region: REGION, base });
        // 북쪽 변 4칸 + 서/동 변의 첫 줄 2칸이 벽이 된다.
        expect(report.newlyBlockedEntrances.length).toBeGreaterThanOrEqual(REGION.width);
        for (const point of report.newlyBlockedEntrances) expect(point.y).toBe(REGION.y);
        expect(describeBlockedEntrance(report.newlyBlockedEntrances[0])).toContain("새로 막혔습니다");
      });

      it("없는 맵이면 0점 빈 리포트", () => {
        const report = analyzeRegionBlend({ project: makeProject(), mapId: "map_missing", region: REGION });
        expect(report).toEqual({
          score: 0,
          matchedEdgeCells: 0,
          totalEdgeCells: 0,
          brokenCrossings: [],
          newlyBlockedEntrances: [],
        });
      });
    });
  });
});
