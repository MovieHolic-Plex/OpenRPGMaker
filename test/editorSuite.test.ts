import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { AiDatabaseGenerationError, artworkPromptFor, buildRecordPrompt, generateDatabaseRecordWithAi, generatedRecordId, parseGeneratedRecord, toolCallsForGeneration } from "@/editor/aiDatabaseGeneration";
import { defaultAiConfig } from "@/ai/llmClient";
import type { Project, ActorParameterKey, GameEvent, Command, EventPage } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { deserialize, serialize } from "@/project/io";
import { normalizeGameDesignBrief, type GameDesignAnswers } from "@/project/gameDesignBrief";
import { interviewPreset, type GameInterview } from "@/project/gameInterview";
import { cinematicInterviewSummary, INTERVIEW_SCENES, SCENE_SLOTS } from "@/editor/cinematicInterviewQuestions";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById, welcomeGenrePresetDisplayText } from "@/editor/welcomeGenrePresets";
import { compileCutscene, CutsceneValidationError, validateCutscene, type CutsceneBeat } from "@/editor/cutscene";
import { createBattleRuntime } from "@/battle/runtime";
import { updateSkillRecord } from "@/editor/databaseRecordMutators";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import { subscribeAgentFocusHighlight, type AgentFocusTarget } from "@/editor/agentFocus";
import { subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { editorState } from "@/editor/editorState";
import { focusEditorRegion, navigateToEditorReference } from "@/editor/editorReferenceNavigation";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { isColorKeyedChipsetTextureKey } from "@/assets/bundled";
import { applyTransparentColorKey } from "@/assets/transparentColorKey";
import { charsetIdleFrameIndex, charsetWalkFrameIndex } from "@/player/charsetMotion";
import { prepareEnemyBattleTest } from "@/editor/enemyBattleTest";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { buildEventBeginnerTemplate } from "@/editor/eventBeginnerTemplates";
import { isPassable } from "@/project/collision";
import { newCommand } from "@/editor/eventCommandFactory";
import { createInterpreter } from "@/player/interpreter";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { buildEventTestSandboxProject, prepareEventTest, selectEventTestSpawn } from "@/editor/eventTestSandbox";
import { beginEventEditDraft } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { acceptedObjectNames, baseName, nearestStampObjects, resolveStampObject, type StampObjectEntry } from "@/ai/stampObjects";
import { expandStampObjects, parseStampPlan, type StampPlanFacts } from "@/ai/stampPlanner";
import { describeStampEffect, hasVisibleChange, measureStampEffect } from "@/editor/stampEffect";
import { createStampOrderQueue, formatStampOrderSummary, stampOrderRect, stampRectsOverlap, type StampOrderQueue } from "@/editor/stampOrderQueue";
import type { StampRunInput, StampRunResult } from "@/editor/stampPlaceRunner";
import { isolateTimers } from "./mergedTeardown";
import { runHeadlessToolWithProject } from "@/headless";
import { paintTerrainBrush } from "@/editor/terrainBrush";

describe("editorSuite", () => {
  isolateTimers();
  describe("aiDatabaseGeneration", () => {
    isolateTimers();
    function projectWith(items: readonly { id: string; name: string }[], enemies: readonly { id: string; name: string }[]): Project {
      return { database: { items, enemies } } as unknown as Project;
    }
    const EMPTY = projectWith([], []);
    describe("parseGeneratedRecord", () => {
      it("코드펜스와 잡담을 걷어내고 허용 필드만 남긴다", () => {
        const raw = "설명입니다\n```json\n{\"name\":\"회복약\",\"price\":120,\"hpRecovery\":{\"flat\":80,\"percentMax\":0},\"bogusField\":1}\n```";

        expect(parseGeneratedRecord("item", raw)).toEqual({
          name: "회복약",
          price: 120,
          hpRecovery: { flat: 80, percentMax: 0 },
        });
      });

      it("적 레코드는 적 필드만 통과시킨다", () => {
        const raw = '{"name":"서슬 늑대","stats":{"maxHp":140,"attack":22},"price":10,"description":"x"}';

        // monsterResourceId 를 빼먹으면 이름 조각으로 고른다 — 도트 몬스터 목록에 한국어 이름(「회색 늑대」)이 생겨 「늑대」가 늑대를 찾는다.
        expect(parseGeneratedRecord("enemy", raw)).toEqual({
          name: "서슬 늑대", stats: { maxHp: 140, attack: 22 }, monsterResourceId: "generated-enemy-wolf-grey",
        });
      });

      it("적 그림은 도트 몬스터 id 만 남긴다 — 목록 밖 id 는 가장 가까운 도트 몬스터로 옮긴다", () => {
        expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"generated-enemy-wolf-grey"}').monsterResourceId)
          .toBe("generated-enemy-wolf-grey");
        // The name 「늑대」 now matches the catalog's Korean name 「회색 늑대」 before any id fragment does.
        expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"wolf-dire"}').monsterResourceId)
          .toBe("generated-enemy-wolf-grey");
        expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"generated-enemy-frost-wolf"}').monsterResourceId)
          .toBe("generated-enemy-wolf-grey");
        expect(parseGeneratedRecord("enemy", '{"name":"늑대","monsterResourceId":"mystery-thing"}').monsterResourceId)
          .toBe("generated-enemy-wolf-grey");
        // Nothing in the id or the name matches: fall back to the slime.
        expect(parseGeneratedRecord("enemy", '{"name":"정체불명","monsterResourceId":"mystery-thing"}').monsterResourceId)
          .toBe("generated-enemy-slime-01");
      });

      it("name 이 없으면 거부한다", () => {
        expect(() => parseGeneratedRecord("item", '{"price":10}')).toThrow(AiDatabaseGenerationError);
      });

      it("JSON 이 아니면 거부한다", () => {
        expect(() => parseGeneratedRecord("item", "만들 수 없습니다")).toThrow(AiDatabaseGenerationError);
      });
    });
    describe("generatedRecordId", () => {
      it("이름을 슬러그로 바꾸고 충돌하면 번호를 올린다", () => {
        expect(generatedRecordId("item", "Hi Potion", [])).toBe("item_ai_hi-potion");
        expect(generatedRecordId("enemy", "Frost Wolf", ["enemy_ai_frost-wolf"])).toBe("enemy_ai_frost-wolf-2");
        expect(generatedRecordId("enemy", "Frost Wolf", ["enemy_ai_frost-wolf", "enemy_ai_frost-wolf-2"]))
          .toBe("enemy_ai_frost-wolf-3");
      });

      it("한글만 있는 이름은 읽을 수 있는 순번 id 로 떨어진다", () => {
        expect(generatedRecordId("item", "회복약", [])).toBe("item_ai_1");
        expect(generatedRecordId("item", "회복약", ["item_ai_1"])).toBe("item_ai_2");
        expect(generatedRecordId("enemy", "서슬 늑대", ["enemy_ai_1", "enemy_ai_2"])).toBe("enemy_ai_3");
      });
    });
    describe("toolCallsForGeneration", () => {
      it("적은 그림 리소스 없이 고른 도트 몬스터 id 를 그대로 가리킨다", () => {
        const calls = toolCallsForGeneration({
          kind: "enemy",
          recordId: "enemy_ai_slime",
          patch: { name: "슬라임", monsterResourceId: "generated-enemy-slime-01" },
        });

        expect(calls).toEqual([{
          name: "upsert_enemy",
          args: { enemy: { name: "슬라임", monsterResourceId: "generated-enemy-slime-01", id: "enemy_ai_slime" } },
        }]);
      });

      it("아이템 그림은 picture 리소스이고 iconResourceId 로 붙는다", () => {
        const calls = toolCallsForGeneration({
          kind: "item",
          recordId: "item_ai_elixir",
          patch: { name: "엘릭서" },
          artwork: { resourceId: "item_ai_elixir_art", dataUrl: "data:image/png;base64,BBB" },
        });

        expect((calls[0]!.args.resource as { kind: string }).kind).toBe("picture");
        expect(calls[1]!.args).toEqual({
          item: { name: "엘릭서", id: "item_ai_elixir", iconResourceId: "item_ai_elixir_art" },
        });
      });

      it("그림 없이도 레코드 한 건만 등록한다", () => {
        const calls = toolCallsForGeneration({ kind: "item", recordId: "item_ai_bread", patch: { name: "빵" } });

        expect(calls).toEqual([{ name: "upsert_item", args: { item: { name: "빵", id: "item_ai_bread" } } }]);
      });
    });
    describe("buildRecordPrompt / artworkPromptFor", () => {
      it("기존 이름을 중복 금지 목록으로 넘긴다", () => {
        const messages = buildRecordPrompt("item", "회복약", ["약초", "빵"]);

        expect(messages[0]!.role).toBe("system");
        expect(String(messages[0]!.content)).toContain("약초, 빵");
        expect(messages[1]).toEqual({ role: "user", content: "회복약" });
      });

      it("그림 프롬프트는 아이템 아이콘이고 투명 배경을 고정한다(도트 저작 모델이 찍는다) — 몬스터 그림은 만들지 않는다", () => {
        expect(artworkPromptFor("item", "엘릭서", "회복")).toContain("inventory item icon");
        expect(artworkPromptFor("item", "엘릭서", "회복")).toContain("transparent background");
      });

      it("적 프롬프트는 도트 몬스터 목록에서 monsterResourceId 를 고르게 한다", () => {
        const system = String(buildRecordPrompt("enemy", "늑대", [])[0]!.content);
        expect(system).toContain("monsterResourceId");
        expect(system).toContain("generated-enemy-wolf-grey");
        expect(system).toContain("generated-enemy-slime-01");
        expect(String(buildRecordPrompt("item", "회복약", [])[0]!.content)).not.toContain("generated-enemy-");
      });
    });
    describe("generateDatabaseRecordWithAi", () => {
      const ok: ToolResult = { ok: true, summary: "적용" };

      it("LLM 응답과 그림을 한 묶음의 툴 호출로 적용한다", async () => {
        const applied: { calls: readonly { name: string; args: Record<string, unknown> }[]; summary: string }[] = [];
        const outcome = await generateDatabaseRecordWithAi(
          { kind: "item", brief: "푸른 엘릭서", config: defaultAiConfig(), withArtwork: true },
          {
            currentProject: () => EMPTY,
            complete: async () => ({
              message: { role: "assistant", content: '{"name":"푸른 엘릭서","price":300}' },
              finishReason: "stop",
            }),
            generateImage: async () => ({
              dataUrl: "data:image/jpeg;base64,RAW",
              mimeType: "image/jpeg",
              model: "gemini-3.1-flash-image",
              provider: "google-antigravity",
            }),
            flattenArtwork: async () => "data:image/png;base64,FLAT",
            applyCalls: (calls, options) => {
              applied.push({ calls, summary: options.summary });
              return calls.map(() => ok);
            },
          },
        );

        expect(outcome.recordId.startsWith("item_ai_")).toBe(true);
        expect(outcome.name).toBe("푸른 엘릭서");
        expect(outcome.resourceId).toBe(`${outcome.recordId}_art`);
        expect(outcome.artworkDataUrl).toBe("data:image/png;base64,FLAT");
        expect(outcome.artworkModel).toBe("gemini-3.1-flash-image");
        expect(applied).toHaveLength(1);
        expect(applied[0]!.calls.map((call) => call.name)).toEqual(["upsert_resource", "upsert_item"]);
        expect(applied[0]!.summary).toBe("AI 아이템 생성: 푸른 엘릭서");
      });

      it("적은 그림을 켜도 이미지를 만들지 않고 고른 도트 몬스터의 정지 그림을 보여 준다", async () => {
        let imageCalls = 0;
        const applied: { calls: readonly { name: string; args: Record<string, unknown> }[]; summary: string }[] = [];
        const outcome = await generateDatabaseRecordWithAi(
          { kind: "enemy", brief: "얼음 늑대", config: defaultAiConfig(), withArtwork: true },
          {
            currentProject: () => EMPTY,
            complete: async () => ({
              message: { role: "assistant", content: '{"name":"서슬 늑대","monsterResourceId":"generated-enemy-wolf-grey","stats":{"maxHp":140}}' },
              finishReason: "stop",
            }),
            generateImage: async () => {
              imageCalls += 1;
              throw new Error("불려서는 안 된다");
            },
            applyCalls: (calls, options) => {
              applied.push({ calls, summary: options.summary });
              return calls.map(() => ok);
            },
          },
        );

        expect(imageCalls).toBe(0);
        expect(outcome.recordId.startsWith("enemy_ai_")).toBe(true);
        expect(outcome.resourceId).toBe("generated-enemy-wolf-grey");
        expect(outcome.artworkDataUrl).toBe("/assets/generated/pixel-enemy-portraits/wolf-grey.png");
        expect(outcome.artworkModel).toBeUndefined();
        expect(applied[0]!.calls.map((call) => call.name)).toEqual(["upsert_enemy"]);
        expect((applied[0]!.calls[0]!.args.enemy as { monsterResourceId?: string }).monsterResourceId).toBe("generated-enemy-wolf-grey");
        expect(applied[0]!.summary).toBe("AI 몬스터 생성: 서슬 늑대");
      });

      it("그림을 끄면 이미지 생성을 호출하지 않는다", async () => {
        let imageCalls = 0;
        const outcome = await generateDatabaseRecordWithAi(
          { kind: "item", brief: "빵", config: defaultAiConfig(), withArtwork: false },
          {
            currentProject: () => EMPTY,
            complete: async () => ({
              message: { role: "assistant", content: '{"name":"딱딱한 빵","price":15}' },
              finishReason: "stop",
            }),
            generateImage: async () => {
              imageCalls += 1;
              throw new Error("불려서는 안 된다");
            },
            applyCalls: (calls) => calls.map(() => ok),
          },
        );

        expect(imageCalls).toBe(0);
        expect(outcome.artworkDataUrl).toBeUndefined();
      });

      it("이미 중단된 요청은 프로젝트에 아무것도 적용하지 않는다", async () => {
        const controller = new AbortController();
        controller.abort();
        let applyCalls = 0;

        await expect(
          generateDatabaseRecordWithAi(
            {
              kind: "item",
              brief: "빵",
              config: defaultAiConfig(),
              withArtwork: true,
              signal: controller.signal,
            },
            {
              currentProject: () => EMPTY,
              complete: async () => ({ message: { role: "assistant", content: '{"name":"빵"}' }, finishReason: "stop" }),
              generateImage: async () => ({
                dataUrl: "data:image/png;base64,RAW",
                mimeType: "image/png",
                model: "gemini-3.1-flash-image",
                provider: "google-antigravity",
              }),
              applyCalls: () => {
                applyCalls += 1;
                return [ok];
              },
            },
          ),
        ).rejects.toBeInstanceOf(AiDatabaseGenerationError);
        expect(applyCalls).toBe(0);
      });

      it("그림 응답 직후 중단돼도 프로젝트에 아무것도 적용하지 않는다", async () => {
        const controller = new AbortController();
        let applyCalls = 0;

        await expect(
          generateDatabaseRecordWithAi(
            {
              kind: "item",
              brief: "푸른 엘릭서",
              config: defaultAiConfig(),
              withArtwork: true,
              signal: controller.signal,
            },
            {
              currentProject: () => EMPTY,
              complete: async () => ({
                message: { role: "assistant", content: '{"name":"푸른 엘릭서"}' },
                finishReason: "stop",
              }),
              generateImage: async () => ({
                dataUrl: "data:image/jpeg;base64,RAW",
                mimeType: "image/jpeg",
                model: "gemini-3.1-flash-image",
                provider: "google-antigravity",
              }),
              flattenArtwork: async () => {
                controller.abort();
                return "data:image/png;base64,FLAT";
              },
              applyCalls: () => {
                applyCalls += 1;
                return [ok];
              },
            },
          ),
        ).rejects.toBeInstanceOf(AiDatabaseGenerationError);
        expect(applyCalls).toBe(0);
      });

      it("툴 적용이 실패하면 오류로 올린다", async () => {
        await expect(
          generateDatabaseRecordWithAi(
            { kind: "item", brief: "빵", config: defaultAiConfig(), withArtwork: false },
            {
              currentProject: () => EMPTY,
              complete: async () => ({ message: { role: "assistant", content: '{"name":"빵"}' }, finishReason: "stop" }),
              applyCalls: () => [{ ok: false, summary: "커밋 거부" }],
            },
          ),
        ).rejects.toThrow(/커밋 거부/);
      });

      it("설명이 비면 LLM 을 부르지 않고 거부한다", async () => {
        let completions = 0;
        await expect(
          generateDatabaseRecordWithAi(
            { kind: "item", brief: "   ", config: defaultAiConfig(), withArtwork: false },
            {
              currentProject: () => EMPTY,
              complete: async () => {
                completions += 1;
                return { message: { role: "assistant", content: "{}" }, finishReason: "stop" };
              },
            },
          ),
        ).rejects.toThrow(AiDatabaseGenerationError);
        expect(completions).toBe(0);
      });

      it("이미 있는 id 와 부딪히면 새 id 를 고른다", async () => {
        const outcome = await generateDatabaseRecordWithAi(
          { kind: "item", brief: "빵", config: defaultAiConfig(), withArtwork: false },
          {
            currentProject: () => projectWith([{ id: "item_ai_bread", name: "빵" }], []),
            complete: async () => ({ message: { role: "assistant", content: '{"name":"Bread"}' }, finishReason: "stop" }),
            applyCalls: (calls) => calls.map(() => ok),
          },
        );

        expect(outcome.recordId).toBe("item_ai_bread-2");
      });
    });
    describe("worldCanon 강제 — 캐논 주입과 금지어 검증", () => {
      const CANON = { name: "화약 없는 왕국", absences: ["총", "화약"] };

      it("캐논이 있으면 시스템 프롬프트에 캐논 블록과 금지 목록이 실린다", () => {
        const messages = buildRecordPrompt("enemy", "늑대", [], CANON);
        expect(String(messages[0]!.content)).toContain("## 이 세계(세계관 고정)");
        expect(String(messages[0]!.content)).toContain("총");
      });

      it("캐논이 없으면 캐논 블록 없이 기존처럼 동작한다", () => {
        const messages = buildRecordPrompt("item", "회복약", ["약초"]);
        expect(String(messages[0]!.content)).not.toContain("## 이 세계(세계관 고정)");
      });

      it("금지어가 든 이름·설명은 거부한다", () => {
        expect(() => parseGeneratedRecord("item", '{"name":"화약 폭탄","price":10}', CANON)).toThrow(/화약/);
        expect(() => parseGeneratedRecord("item", '{"name":"폭탄","description":"화약을 가득 채웠다"}', CANON)).toThrow(/화약/);
        expect(() => parseGeneratedRecord("enemy", '{"name":"총잡이 늑대"}', CANON)).toThrow(/총/);
      });

      it("금지어가 없으면 통과한다", () => {
        expect(parseGeneratedRecord("item", '{"name":"빵","price":10}', CANON)).toEqual({ name: "빵", price: 10 });
      });

      it("적 레코드 원시 description의 금지어도 거부한다 — 스키마에 description이 없어도", () => {
        expect(() => parseGeneratedRecord("enemy", '{"name":"늑대","description":"총을 든 늑대"}', CANON)).toThrow(/총/);
      });

      it("합성어 속 부분일치(화약고)도 잡는다", () => {
        expect(() => parseGeneratedRecord("item", '{"name":"화약고 열쇠","price":10}', CANON)).toThrow(/화약/);
      });
    });
  });
  describe("cinematicInterview", () => {
    isolateTimers();
    function mixedBrief() {
      const answers: GameDesignAnswers = {};
      for (const q of INTERVIEW_SCENES[0]!.questions) answers[SCENE_SLOTS[q.id]!] = {
        question: q.title, label: q.label, text: q.options[0]!.label, source: "user",
      };
      const interview: GameInterview = { version: 1, genre: "romance", secondary: "monster", concept: "사용자의 세계", protagonist: "약사", notes: "교감 중심", choiceIds: {},
        blend: { question: "두 장르를 어떻게 잇나요?", label: "장르의 연결", text: "생물의 성장 사건이 관계를 바꾼다", source: "recommended" } };
      return normalizeGameDesignBrief({ version: 1, presetId: interviewPreset(interview.genre, interview.secondary), answers,
        summary: cinematicInterviewSummary(interview, answers), interview });
    }
    describe("cinematic interview persistence and internal handoff", () => {
      it("roundtrips author genre, mixture and protagonist through the real project serializer", () => {
        const project = createNewProjectSeed("monster-collect");
        project.gameDesignBrief = mixedBrief();
        const loaded = deserialize(serialize(project));
        expect(loaded.gameDesignBrief).toEqual(project.gameDesignBrief);
        expect(loaded.system.monsterCollection).toBe(true);
        const brief = loaded.gameDesignBrief!;
        const preset = welcomeGenrePresetById(brief.presetId)!;
        expect(buildWelcomeGenrePresetPrompt(preset, brief)).toContain("약사");
        expect(buildWelcomeGenrePresetPrompt(preset, brief)).toContain("F03");
        expect(welcomeGenrePresetDisplayText(preset, brief)).not.toContain("F03");
        expect(welcomeGenrePresetDisplayText(preset, brief)).toMatch(/^관계·연애 \+ 몬스터 수집·육성 · 확정한 게임 기획/u);
      });
      it("rejects lost blend answers and engine/genre mismatches instead of silently dropping them", () => {
        const brief = mixedBrief();
        expect(() => normalizeGameDesignBrief({ ...brief, presetId: "story-cutscene" })).toThrow();
        expect(() => normalizeGameDesignBrief({ ...brief, interview: { ...brief.interview, blend: undefined } })).toThrow();
        expect(() => normalizeGameDesignBrief({ ...brief, interview: { ...brief.interview, secondary: "romance" } })).toThrow();
      });
    });
  });
  describe("cutsceneCompiler", () => {
    isolateTimers();
    describe("compileCutscene", () => {
      it("대표 beat들을 이벤트 command 배열로 컴파일한다", () => {
        const beats: CutsceneBeat[] = [
          { kind: "say", speaker: "리나", face: { resourceId: "face_memory" }, text: "여기가 시작이었어." },
          { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "right" }], wait: true },
          { kind: "camera", mode: "pan", x: 5, y: 6, durationMs: 400, wait: true },
          { kind: "picture", action: "show", pictureId: "pic_memory", resourceId: "picture_memory", x: 10, y: 12 },
          { kind: "picture", action: "move", pictureId: "pic_memory", x: 24, y: 20, durationMs: 300, wait: true },
          { kind: "music", action: "bgm", resourceId: "bgm_memory" },
          { kind: "tint", value: "#101820", durationMs: 200, wait: true },
          { kind: "flash", color: "white", durationMs: 100 },
          { kind: "shake", intensity: 4, durationMs: 120 },
          { kind: "wait", ms: 80 },
        ];

        expect(compileCutscene(beats, { skippable: true })).toMatchInlineSnapshot(`
      [
        {
          "kind": "cutsceneControl",
          "mode": "begin",
          "skippable": true,
        },
        {
          "flipHorizontally": false,
          "kind": "changeFace",
          "position": "left",
          "resourceId": "face_memory",
        },
        {
          "body": "여기가 시작이었어.",
          "kind": "text",
          "speaker": "리나",
        },
        {
          "eventId": "@player",
          "kind": "moveEvent",
          "route": {
            "moves": [
              {
                "dir": "right",
                "kind": "move",
              },
            ],
            "repeat": false,
            "skippable": undefined,
            "wait": true,
          },
        },
        {
          "commandId": "m2-201-camera-control",
          "fields": {
            "durationMs": 400,
            "mode": "panTo",
            "target": "screen",
            "wait": true,
            "x": 5,
            "y": 6,
          },
          "kind": "m2Command",
        },
        {
          "kind": "showPicture",
          "pictureId": "pic_memory",
          "resourceId": "picture_memory",
          "x": 10,
          "y": 12,
        },
        {
          "commandId": "m2-052-move-picture",
          "fields": {
            "durationMs": 300,
            "pictureId": "pic_memory",
            "wait": true,
            "waitForPicture": true,
            "x": 24,
            "y": 20,
          },
          "kind": "m2Command",
        },
        {
          "kind": "playAudio",
          "loop": true,
          "resourceId": "bgm_memory",
        },
        {
          "commandId": "m2-046-tint-screen",
          "fields": {
            "color": "neutral",
            "durationMs": 200,
            "value": "#101820",
          },
          "kind": "m2Command",
        },
        {
          "kind": "wait",
          "ms": 200,
        },
        {
          "commandId": "m2-047-flash-screen",
          "fields": {
            "color": "white",
            "durationMs": 100,
          },
          "kind": "m2Command",
        },
        {
          "commandId": "m2-048-shake-screen",
          "fields": {
            "durationMs": 120,
            "intensity": "3",
            "value": 3,
          },
          "kind": "m2Command",
        },
        {
          "kind": "wait",
          "ms": 80,
        },
        {
          "kind": "label",
          "name": "cutscene_end",
        },
        {
          "commandId": "m2-201-camera-control",
          "fields": {
            "durationMs": 300,
            "mode": "return",
            "target": "player",
            "wait": true,
          },
          "kind": "m2Command",
        },
        {
          "commandId": "m2-046-tint-screen",
          "fields": {
            "color": "neutral",
            "durationMs": 0,
            "value": "#101820",
          },
          "kind": "m2Command",
        },
        {
          "durationMs": 0,
          "kind": "showPicture",
          "pictureId": "pic_memory",
          "resourceId": "picture_memory",
          "waitForPicture": false,
          "x": 24,
          "y": 20,
        },
        {
          "kind": "cutsceneControl",
          "mode": "end",
        },
      ]
    `);
      });

      it("begin/end 쌍과 스킵 라벨을 항상 보장한다", () => {
        const commands = compileCutscene([{ kind: "jump", name: "after_line" }, { kind: "label", name: "after_line" }], { skippable: true });

        expect(commands[0]).toEqual({ kind: "cutsceneControl", mode: "begin", skippable: true });
        expect(commands.at(-1)).toEqual({ kind: "cutsceneControl", mode: "end" });
        expect(commands).toContainEqual({ kind: "label", name: "cutscene_end" });
        expect(commands).toContainEqual({ kind: "gotoLabel", name: "after_line" });
      });

      it("parallel beat는 이동 루트를 비대기로 만들고 마지막에 이동 완료 대기를 둔다", () => {
        const commands = compileCutscene([
          {
            kind: "parallel",
            beats: [
              { kind: "moveActor", target: "ev_friend", moves: [{ kind: "move", dir: "left" }], wait: true },
              { kind: "picture", action: "show", pictureId: "pic_parallel", resourceId: "picture_memory", x: 0, y: 0 },
            ],
          },
        ]);

        expect(commands).toContainEqual({
          kind: "moveEvent",
          eventId: "ev_friend",
          route: { moves: [{ kind: "move", dir: "left" }], repeat: false, wait: false, skippable: undefined },
        });
        expect(commands).toContainEqual({ kind: "m2Command", commandId: "m2-058-wait-for-all-movement", fields: {} });
      });

      it("검증기가 없는 이벤트, 픽처 id 충돌, 음수 duration을 한국어 사유로 거부한다", () => {
        const beats: CutsceneBeat[] = [
          { kind: "moveActor", target: "ev_missing", moves: [], wait: true },
          { kind: "picture", action: "show", pictureId: "pic1", resourceId: "picture_memory", x: 0, y: 0 },
          { kind: "picture", action: "show", pictureId: "pic1", resourceId: "picture_memory", x: 1, y: 1 },
          { kind: "wait", ms: -1 },
        ];
        const result = validateCutscene(beats, { eventIds: new Set(["ev_known"]) });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.join("\n")).toContain("존재하지 않는 이벤트 'ev_missing'");
          expect(result.errors.join("\n")).toContain("픽처 id 'pic1'");
          expect(result.errors.join("\n")).toContain("duration은 음수일 수 없습니다");
        }
        expect(() => compileCutscene(beats, { context: { eventIds: new Set(["ev_known"]) } })).toThrow(CutsceneValidationError);
      });

      it("fade beat는 0.45 tint가 아닌 Screen Effect의 검정 fadeIn/fadeOut으로 컴파일한다", () => {
        const commands = compileCutscene([
          { kind: "fade", direction: "out", durationMs: 400, wait: true },
          { kind: "fade", direction: "in", durationMs: 400, wait: true },
        ]);
        expect(commands).toContainEqual(expect.objectContaining({
          kind: "m2Command",
          commandId: expect.stringMatching(/screen-effect/i),
          fields: expect.objectContaining({ effect: "fadeOut" }),
        }));
        expect(commands).toContainEqual(expect.objectContaining({
          kind: "m2Command",
          commandId: expect.stringMatching(/screen-effect/i),
          fields: expect.objectContaining({ effect: "fadeIn" }),
        }));
        expect(JSON.stringify(commands)).not.toContain("Tint Screen");
      });

      it("say beat의 emotion과 autoAdvance를 text command로 전달한다", () => {
        const commands = compileCutscene([
          { kind: "say", speaker: "리나", text: "기억나.", emotion: "sad", autoAdvance: true },
        ]);
        expect(commands).toContainEqual({
          kind: "text",
          speaker: "리나",
          body: "기억나.",
          emotion: "sad",
          autoAdvance: true,
        });
      });
    });
    /**
     * 카메라 줌이 AI 스키마에 노출되는가(2026-09-22).
     *
     * 왜 이 테스트가 필요한가: CutsceneCameraBeat.zoom 은 **컴파일러에 이미 있었지만**
     * CUTSCENE_BEAT_SCHEMA 에 없어서 모델이 그 필드의 존재를 알 수 없었다. 그래서
     * "고해상도 배경을 1:1로 쓰는" 요청에 모델이 배율을 걸 방법이 없었다. 스키마 노출과
     * 컴파일 결과를 함께 고정한다 — 둘 중 하나만 있으면 모델은 여전히 못 쓴다.
     */
    describe("컷신 카메라 줌", () => {
      it("zoom 이 m2-201 camera-control 필드로 전달된다", () => {
        const commands = compileCutscene([
          { kind: "camera", mode: "fixed", target: "player", zoom: 4.5, durationMs: 0 },
        ]);
        const camera = commands.find((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control");
        expect(camera).toBeDefined();
        expect((camera as { fields: Record<string, unknown> }).fields.zoom).toBe(4.5);
      });

      it("zoom 을 생략하면 필드가 비어 런타임 기본(1)을 따른다", () => {
        const commands = compileCutscene([{ kind: "camera", mode: "fixed", target: "player" }]);
        const camera = commands.find((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control");
        expect((camera as { fields: Record<string, unknown> }).fields.zoom).toBeUndefined();
      });
    });
  });
  // SkillRecord.movePriority — strict 턴제의 기술 우선도(퀵어택류) + gen1 동속 랜덤 타이브레이크.
  // 계약 3개를 못박는다:
  //  (1) 우선도는 속도보다 먼저 비교된다 (느린 쪽이 +1 기술로 선공)
  //  (2) 동속 랜덤은 battleModel === "gen1" 에서만 rng 를 소비한다 — rm2k3 은 기존
  //      "아군 우선 → index 순" 결정적 정렬 그대로 (battleStrictRuntime.test.ts 계약 보존)
  //  (3) 필드는 normalize/뮤테이터 화이트리스트를 왕복 생존한다 (skillSystem 소실 전례 방지)
  describe("battleStrictPriority", () => {
    isolateTimers();
    function strictProject(): Project {
      return deserialize(JSON.stringify(strictFixture));
    }
    function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
      const actor = project.database.actors.find((record) => record.id === actorId);
      if (!actor) throw new Error(`missing actor: ${actorId}`);
      actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
    }
    function tankEnemy(project: Project, agility: number): void {
      const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
      if (!enemy) throw new Error("missing enemy_training_slime");
      enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility };
    }
    function givePrioritySkill(project: Project, movePriority: number): void {
      const skill = project.database.skills.find((record) => record.id === "skill_fire");
      if (!skill) throw new Error("missing skill_fire");
      skill.movePriority = movePriority;
      // 우선도만 검증한다 — MP 부족으로 커맨드가 거부되지 않게 코스트를 비운다.
      skill.mpCost = { flat: 0, percentMax: 0 };
    }
    // rng 시퀀스 스크립트. 소진되면 fallback 상수를 돌려준다(정렬 뒤 데미지 롤용).
    function scriptedRng(values: readonly number[], fallback = 0.5): () => number {
      let cursor = 0;
      return () => (cursor < values.length ? values[cursor++]! : fallback);
    }
    describe("strict movePriority + gen1 tie-break", () => {
      // 우선도 케이스는 actor_mage 를 쓴다 — skill_fire 를 배운 유일한 액터라
      // battleSkillUseFailure("notLearned") 로 커맨드가 거부되지 않는다(runtime.ts:701).
      it("느린 액터가 movePriority +1 기술로 빠른 적보다 먼저 행동한다", () => {
        const project = strictProject();
        setActorParam(project, "actor_mage", "agility", 1);
        tankEnemy(project, 50);
        givePrioritySkill(project, 1);

        const runtime = createBattleRuntime({
          project,
          troopId: "troop_strict_training",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { actor_mage: 1 }, experience: {}, partyActorIds: ["actor_mage"] },
          rng: () => 0.99,
        });
        runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
          .toEqual(["actor_mage", "enemy_training_slime"]);
      });

      it("우선도 0 대조군: 같은 셋업에서 기술에 우선도가 없으면 빠른 적이 선공한다", () => {
        const project = strictProject();
        setActorParam(project, "actor_mage", "agility", 1);
        tankEnemy(project, 50);
        givePrioritySkill(project, 0);

        const runtime = createBattleRuntime({
          project,
          troopId: "troop_strict_training",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { actor_mage: 1 }, experience: {}, partyActorIds: ["actor_mage"] },
          rng: () => 0.99,
        });
        runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
          .toEqual(["enemy_training_slime", "actor_mage"]);
      });

      it("gen1: 동속 타이브레이크가 rng 로 갈린다 (적이 선공할 수 있다)", () => {
        const project = strictProject();
        project.system.battleModel = "gen1";
        setActorParam(project, "actor_warrior", "agility", 20);
        tankEnemy(project, 20);

        // 큐 구성 순서 = [액터 롤, (chooseEnemyAction), 적 롤]. enemy_training_slime 의 행동
        // 패턴이 단일이라 chooseEnemyAction 은 rng 를 소비하지 않는다 — 첫 두 값이 그대로
        // 타이브레이크다. 액터 0.1 < 적 0.9 → 내림차순이라 적이 먼저.
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_strict_training",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
          rng: scriptedRng([0.1, 0.9]),
        });
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
          .toEqual(["enemy_training_slime", "actor_warrior"]);
      });

      it("rm2k3(기본): 동속에서 rng 를 소비하지 않고 아군 우선 정렬을 유지한다", () => {
        const project = strictProject();
        setActorParam(project, "actor_warrior", "agility", 20);
        tankEnemy(project, 20);

        // gen1 케이스와 같은 rng 스크립트를 줘도 결과가 갈리면 안 된다 — 타이브레이크가
        // rng 를 읽지 않음을 행동으로 증명한다(아군 우선 계약 유지).
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_strict_training",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
          rng: scriptedRng([0.1, 0.9]),
        });
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId))
          .toEqual(["actor_warrior", "enemy_training_slime"]);
      });

      it("movePriority 는 직렬화 왕복과 에디터 뮤테이터를 생존한다", () => {
        const project = strictProject();
        givePrioritySkill(project, 1);

        const roundTripped = deserialize(serialize(project));
        expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(1);

        updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 3 });
        expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(3);

        // 클램프(-7~7) + 기본값 0 은 직렬화에서 생략된다(레거시 바이트 보존 관례).
        updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 99 });
        expect(roundTripped.database.skills.find((skill) => skill.id === "skill_fire")?.movePriority).toBe(7);
        updateSkillRecord(roundTripped.database, "skill_fire", { movePriority: 0 });
        expect(serialize(roundTripped)).not.toContain("movePriority");
      });
    });
  });
  describe("editorReferenceNavigation", () => {
    isolateTimers();
    function merchant(): GameEvent {
      return {
        id: "ev_hana",
        x: 6,
        y: 9,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "ev_hana_page_1",
            name: "상인 하나",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      };
    }
    function fixture(): Project {
      const project = createBlankProject();
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("blank project has no start map");
      start.name = "햇살 마을";
      start.events = [merchant()];
      const house = createBlankMap("상인 하나의 집", 20, 16);
      house.id = "map_house_interior_1";
      project.maps[house.id] = house;
      return project;
    }
    describe("editor reference navigation", () => {
      let cameraRequests: CameraFocusTarget[] = [];
      let highlights: AgentFocusTarget[] = [];
      let unsubscribe: (() => void)[] = [];
      let project: Project;

      beforeEach(() => {
        project = fixture();
        store.replace(project);
        editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
        cameraRequests = [];
        highlights = [];
        unsubscribe = [
          subscribeEditorCameraFocus((target) => cameraRequests.push(target)),
          subscribeAgentFocusHighlight((target) => highlights.push(target)),
        ];
      });

      afterEach(() => {
        for (const off of unsubscribe) off();
        unsubscribe = [];
      });

      it("opens the map for a map reference without moving the camera", () => {
        expect(navigateToEditorReference({ kind: "map", mapId: "map_house_interior_1" })).toBe(true);

        expect(editorState.get().currentMapId).toBe("map_house_interior_1");
        expect(cameraRequests).toEqual([]);
      });

      it("takes the user to the event tile and flashes a highlight there", () => {
        const ok = navigateToEditorReference({
          kind: "event",
          mapId: project.startMapId,
          eventId: "ev_hana",
          x: 6,
          y: 9,
        });

        expect(ok).toBe(true);
        expect(cameraRequests).toEqual([
          {
            mapId: project.startMapId,
            tileX: 6,
            tileY: 9,
            bounds: { x: 6, y: 9, width: 1, height: 1 },
          },
        ]);
        expect(highlights[0]?.bounds).toEqual({ x: 6, y: 9, width: 1, height: 1 });
      });

      it("다른 맵의 이벤트로 이동한 뒤 새 맵 기준 요청을 보낸다", () => {
        store.updateMap("map_house_interior_1", (map) => {
          map.events = [merchant()];
        });
        const house = store.getCurrent().maps.map_house_interior_1;
        if (!house) throw new Error("house map is missing");

        expect(navigateToEditorReference({
          kind: "event",
          mapId: house.id,
          eventId: "ev_hana",
          x: 6,
          y: 9,
        })).toBe(true);

        expect(editorState.get().currentMapId).toBe(house.id);
        // 맵을 건너뛰면 팬하지 않고 **도착시킨다**(`immediate`). 새 맵은 좌표계가 통째로 달라
        // 출발점이 목적지와 아무 관계가 없고, 전환 직후에 낯선 맵을 가로지르는 팬이 또 도는 것이
        // 「확확 전환」의 두 번째 덜컹이다. 연속성은 크로스페이드가 갖는다(assistantViewSwitch).
        expect(cameraRequests).toEqual([{
          mapId: house.id,
          tileX: 6,
          tileY: 9,
          bounds: { x: 6, y: 9, width: 1, height: 1 },
          immediate: true,
        }]);
        expect(highlights).toEqual([{
          mapId: house.id,
          cells: [],
          bounds: { x: 6, y: 9, width: 1, height: 1 },
          score: 1,
        }]);
      });

      it("모호한 대상은 찾기만 열고 이동 부작용을 만들지 않는다", () => {
        const beforeMapId = editorState.get().currentMapId;
        const openedQueries: string[] = [];

        expect(navigateToEditorReference(
          { kind: "ambiguous", label: "여관", count: 2 },
          (query) => openedQueries.push(query),
        )).toBe(true);

        expect(openedQueries).toEqual(["여관"]);
        expect(editorState.get().currentMapId).toBe(beforeMapId);
        expect(cameraRequests).toEqual([]);
        expect(highlights).toEqual([]);
      });

      it("화면 안의 대상도 항상 카메라를 움직인다", () => {
        focusEditorRegion({ mapId: project.startMapId, x: 2, y: 3, w: 4, h: 4 });

        // onlyIfOffscreen 이 붙으면 화면 안에 있는 대상에서 클릭이 아무 일도 하지 않는다.
        expect(cameraRequests[0]?.onlyIfOffscreen).toBeUndefined();
        expect(cameraRequests[0]?.bounds).toEqual({ x: 2, y: 3, width: 4, height: 4 });
      });

      it("조수 질문용 강조는 화면 밖일 때만 카메라를 요청한다", () => {
        focusEditorRegion({ mapId: project.startMapId, x: 2, y: 3, w: 4, h: 4 }, { onlyIfOffscreen: true });

        expect(cameraRequests[0]?.onlyIfOffscreen).toBe(true);
        expect(cameraRequests[0]?.bounds).toEqual({ x: 2, y: 3, width: 4, height: 4 });
      });

      it.each([NaN, Infinity, -Infinity])("rejects invalid geometry before changing maps: %s", (value) => {
        for (const key of ["x", "y", "w", "h"]) {
          expect(focusEditorRegion({ mapId: "map_house_interior_1", x: 0, y: 0, w: 1, h: 1, [key]: value })).toBe(false);
        }
        expect(editorState.get().currentMapId).toBe(project.startMapId);
        expect(cameraRequests).toEqual([]);
        expect(highlights).toEqual([]);
      });

      it("clamps a region that runs past the map edge", () => {
        focusEditorRegion({ mapId: "map_house_interior_1", x: 18, y: 15, w: 10, h: 10 });

        expect(cameraRequests[0]?.bounds).toEqual({ x: 18, y: 15, width: 2, height: 1 });
      });

      it("reports failure for a map or event that is gone, and changes nothing", () => {
        const beforeMapId = editorState.get().currentMapId;

        expect(navigateToEditorReference({ kind: "map", mapId: "map_missing" })).toBe(false);
        expect(navigateToEditorReference({ kind: "event", mapId: project.startMapId, eventId: "ev_gone", x: 1, y: 1 })).toBe(false);
        expect(focusEditorRegion({ mapId: "map_missing", x: 0, y: 0, w: 1, h: 1 })).toBe(false);

        expect(editorState.get().currentMapId).toBe(beforeMapId);
        expect(cameraRequests).toEqual([]);
        expect(highlights).toEqual([]);
      });

      it("keeps the event selection when focusing a region so the editor does not lose context", () => {
        editorState.set({ selectedEventId: "ev_hana" });

        focusEditorRegion({ mapId: project.startMapId, x: 6, y: 9, w: 1, h: 1 });

        expect(editorState.get().selectedEventId).toBe("ev_hana");
      });
    });
  });
  describe("easyrpgRtpRuntime", () => {
    isolateTimers();
    describe("EasyRPG RTP runtime sprite rendering", () => {
      it("uses the saved facing direction for uploaded charset editor previews", () => {
        const project = createBlankProject();
        project.assets.uploaded.test_charset = { id: "test_charset", name: "test", kind: "charset", dataUrl: "data:image/png;base64,AA==", meta: {} };
        for (const [direction, frame] of [["up", 1], ["right", 13], ["down", 25], ["left", 37]] as const) {
          expect(editorEventMarkerTexture(project, { sprite: { type: "uploaded", id: "test_charset" }, pattern: 1, direction })?.frame).toBe(frame);
        }
      });
      it("preserves opaque artwork that shares RGB with a transparent corner", () => {
        for (const rgb of [[0, 0, 0], [255, 255, 255], [255, 118, 50]]) {
          const pixels = new Uint8ClampedArray([...rgb, 0, ...rgb, 255, 12, 34, 56, 128]);
          const before = pixels.slice();
          applyTransparentColorKey(pixels);
          expect(pixels).toEqual(before);
        }
      });
      it("makes pixels matching the sheet top-left color transparent", () => {
        const pixels = new Uint8ClampedArray([
          0, 147, 146, 255,
          12, 34, 56, 255,
          0, 147, 146, 128,
        ]);

        const key = applyTransparentColorKey(pixels);

        expect(key).toEqual({ r: 0, g: 147, b: 146, a: 255 });
        expect(Array.from(pixels.slice(0, 4))).toEqual([0, 147, 146, 0]);
        expect(Array.from(pixels.slice(4, 8))).toEqual([12, 34, 56, 255]);
        expect(Array.from(pixels.slice(8, 12))).toEqual([0, 147, 146, 0]);
      });

      it("cycles moving NPC frames inside the same RPG Maker 2000 CharSet slot", () => {
        const baseFrame = 86;

        expect(charsetWalkFrameIndex(baseFrame, "right", 0)).toBe(60);
        expect(charsetWalkFrameIndex(baseFrame, "right", 1)).toBe(61);
        expect(charsetWalkFrameIndex(baseFrame, "right", 2)).toBe(62);
        expect(charsetWalkFrameIndex(baseFrame, "right", 3)).toBe(61);
        expect(charsetWalkFrameIndex(baseFrame, "right", 4)).toBe(60);
        expect(charsetIdleFrameIndex(baseFrame, "left")).toBe(85);
      });

      it("applies transparent color keys only to object-heavy chipset sheets", () => {
        expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_interior")).toBe(true);
        expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_dungeon")).toBe(true);
        expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_retro_dungeon")).toBe(true);
        expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_combined_town")).toBe(false);
        expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_retro_exterior")).toBe(false);
      });
    });
  });
  describe("enemyBattleTest", () => {
    isolateTimers();
    describe("selected-enemy battle sandbox", () => {
      it("runs the current enemy stats with no authored troop and isolates all test changes", () => {
        const project = deserialize(JSON.stringify(battleFixture));
        const enemy = project.database.enemies[0];
        enemy.stats.maxHp = 321;
        project.database.troops = [];
        const before = JSON.stringify(project);
        const prepared = prepareEnemyBattleTest(project, enemy.id)!;
        const runtime = createBattleRuntime({ ...prepared, canEscape: true, canLose: true, rng: () => 0.5 });
        expect(runtime.snapshot().enemies).toHaveLength(1);
        expect(runtime.snapshot().enemies[0].hp).toBe(321);
        prepared.project.database.enemies[0].stats.maxHp = 999;
        runtime.tick(1000);
        expect(JSON.stringify(project)).toBe(before);
      });

      it("does not overwrite a same-named authored troop or guess a deleted enemy", () => {
        const project = deserialize(JSON.stringify(battleFixture));
        project.database.troops[0].id = "editor-enemy-test";
        const prepared = prepareEnemyBattleTest(project, project.database.enemies[0].id)!;
        expect(prepared.troopId).not.toBe("editor-enemy-test");
        expect(prepared.project.database.troops[0]).toEqual(project.database.troops[0]);
        expect(prepareEnemyBattleTest(project, "deleted-enemy")).toBeUndefined();
      });
    });
  });
  describe("eventBeginnerTemplates", () => {
    isolateTimers();
    function commandFor(templateId: Parameters<typeof buildEventBeginnerTemplate>[3]) {
      const project = createBlankProject();
      const result = buildEventBeginnerTemplate(project, project.startMapId, "event-template", templateId);
      if (!result.command) throw new Error(result.unavailableReason);
      return { command: result.command, project };
    }
    describe("event beginner templates", () => {
      it("builds immediately usable dialogue and item-reward treasure chest starters", () => {
        expect(commandFor("talking-npc").command).toEqual({ kind: "text", body: "안녕하세요." });
        const treasure = commandFor("treasure-chest");
        expect(treasure.command).toEqual({
          kind: "changeItem",
          itemId: treasure.project.database.items[0]?.id,
          op: "+=",
          amount: 1,
        });
      });

      it("uses only an existing passable map destination", () => {
        const { command, project } = commandFor("transfer");
        expect(command.kind).toBe("transfer");
        if (command.kind !== "transfer") return;
        const map = project.maps[command.mapId];
        expect(map).toBeDefined();
        expect(command.x).toBeGreaterThanOrEqual(0);
        expect(command.y).toBeGreaterThanOrEqual(0);
        expect(command.x).toBeLessThan(map!.width);
        expect(command.y).toBeLessThan(map!.height);
        expect(isPassable(project, map!, command.x, command.y)).toBe(true);
      });

      it("seeds shops and battles with records present in the project", () => {
        const shop = commandFor("shop");
        expect(shop.command.kind).toBe("shop");
        if (shop.command.kind === "shop") {
          const itemIds = new Set(shop.project.database.items.map((item) => item.id));
          expect(shop.command.itemIds.length).toBeGreaterThan(0);
          expect(shop.command.itemIds.every((itemId) => itemIds.has(itemId))).toBe(true);
        }

        const battle = commandFor("battle");
        expect(battle.command.kind).toBe("battleProcessing");
        if (battle.command.kind === "battleProcessing") {
          expect(battle.project.database.troops.some((troop) => troop.id === battle.command.troopId)).toBe(true);
        }
      });

      it("refuses to invent missing database ids", () => {
        const project = createBlankProject();
        project.database.items = [];
        project.database.troops = [];
        delete project.system.initialTroopId;

        const treasure = buildEventBeginnerTemplate(project, project.startMapId, "event-template", "treasure-chest");
        const shop = buildEventBeginnerTemplate(project, project.startMapId, "event-template", "shop");
        const battle = buildEventBeginnerTemplate(project, project.startMapId, "event-template", "battle");

        expect(treasure.command).toBeUndefined();
        expect(treasure.unavailableReason).toContain("아이템");
        expect(shop.command).toBeUndefined();
        expect(shop.unavailableReason).toContain("아이템");
        expect(battle.command).toBeUndefined();
        expect(battle.unavailableReason).toContain("적 그룹");
      });
    });
  });
  describe("shopProcessingCommand", () => {
    isolateTimers();
    function mkSession(): PlaySessionLike {
      return {
        flags: {},
        switches: {},
        variables: {},
        timers: {},
        gold: 0,
        inventory: {},
        partyActorIds: [],
        actorVitals: {},
        currentMapId: "m1",
        x: 0,
        y: 0,
      };
    }
    describe("Shop Processing command options", () => {
      it("creates RM-style shop processing defaults", () => {
        // 진열은 상품 추가·서식이 채운다. 없는 잡화 ID를 기본값으로 심지 않는다.
        expect(newCommand("shop")).toMatchObject({
          kind: "shop",
          itemIds: [],
          shopType: "normal",
          messageType: "welcome",
          branchOnTransaction: false,
          transactionBranch: [],
          quantityMode: "single",
        });
      });

      it("passes RM-style shop options through the interpreter handoff", () => {
        const command: Command = {
          kind: "shop",
          itemIds: ["item_potion"],
          shopType: "sellOnly",
          messageType: "welcome",
          branchOnTransaction: true,
          allowSell: true,
          quantityMode: "select",
        };
        const result = createInterpreter([command], mkSession()).start();

        expect(result).toEqual({
          kind: "shop",
          itemIds: ["item_potion"],
          shopType: "sellOnly",
          messageType: "welcome",
          branchOnTransaction: true,
          allowSell: true,
          quantityMode: "select",
        });
      });

      it("runs the transaction branch only after a buy or sell succeeds", () => {
        const command: Command = {
          kind: "shop",
          itemIds: ["item_potion"],
          branchOnTransaction: true,
          transactionBranch: [{ kind: "text", body: "Thank you." }],
        };
        const interpreter = createInterpreter([command, { kind: "text", body: "After shop." }], mkSession());

        expect(interpreter.start()).toMatchObject({ kind: "shop", branchOnTransaction: true });
        expect(interpreter.resume(true)).toMatchObject({ kind: "text", body: "Thank you." });
        expect(interpreter.resume(undefined)).toMatchObject({ kind: "text", body: "After shop." });
      });

      it("skips the transaction branch when the shop closes without a transaction", () => {
        const command: Command = {
          kind: "shop",
          itemIds: ["item_potion"],
          branchOnTransaction: true,
          transactionBranch: [{ kind: "text", body: "Thank you." }],
        };
        const interpreter = createInterpreter([command, { kind: "text", body: "After shop." }], mkSession());

        expect(interpreter.start()).toMatchObject({ kind: "shop", branchOnTransaction: true });
        expect(interpreter.resume(false)).toMatchObject({ kind: "text", body: "After shop." });
      });
    });
  });
  describe("eventValidationDiagnostics", () => {
    isolateTimers();
    function fixture(commands: Command[]) {
      const project = createBlankProject();
      const event: GameEvent = { id: "private-event-/home/author", name: "token=secret", x: 1, y: 1,
        trigger: { kind: "action" }, commands: [], pages: [{ id: "private-page", name: "private", conditions: [],
          graphic: {}, trigger: { kind: "action" }, priority: "below",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands }] };
      return { project, event, validate: () => validateEventDraftBody(project, project.startMapId, event) };
    }
    describe("event validation diagnostic data", () => {
      it("retains repeated condition locations in the handoff", async () => {
        const { eventValidationDiagnosticReport } = await import("@/editor/eventValidationDiagnostics");
        // Given: repeated failures in distinct condition leaves of the same command.
        const { event, validate } = fixture([{ kind: "fork", condition: { kind: "all", conditions: [
          { kind: "switch", switchId: "missing", value: true },
          { kind: "not", condition: { kind: "switch", switchId: "missing", value: true } },
        ] }, then: [] }]);
        // When: creating the report from the validator result.
        const report = eventValidationDiagnosticReport(validate(), event);
        // Then: repeated field IDs do not collapse the two locations.
        expect(report.issues.map(issue => issue.conditionPath)).toEqual([[0], [1, 0]]);
      });

      it("identifies the invalid coordinate axis and individual movement step", () => {
        // Given: Y alone is out of bounds, and two route steps have missing sounds.
        const { project, event, validate } = fixture([]);
        const page = event.pages?.[0];
        if (!page) throw new Error("Missing page");
        page.commands = [{ kind: "changeTile", mapId: project.startMapId, x: 0, y: -1, layer: "lower", tile: 0 },
          { kind: "moveEvent", route: { moves: [{ kind: "playSe", resourceId: "missing-a" }, { kind: "playSe", resourceId: "missing-b" }] } }];
        // When: validating these independent locations.
        const issues = validate().issues.filter(issue => issue.severity === "error");
        // Then: each diagnostic names the smallest existing repair surface.
        expect(issues.map(issue => issue.field?.testId)).toEqual(["change-tile-y-input", "move-route-command-1", "move-route-command-2"]);
      });

      it("gives every error actionable structured fields without changing the aggregate gate", () => {
        // Given: independent native and nested validation failures.
        const { validate } = fixture([
          { kind: "label", name: "" }, { kind: "gotoLabel", name: "missing" },
          { kind: "setVariable", variableId: "missing", op: "=", value: { kind: "var", id: "missing-operand" } },
          { kind: "fork", condition: { kind: "run", query: "flag", flag: "", value: true }, then: [] },
          { kind: "shop", itemIds: [] },
        ]);
        // When: the existing validator runs.
        const validation = validate();
        // Then: every error identifies a repair target, expected value and correction.
        expect(validation.canCommit).toBe(false);
        expect(validation.errorCount).toBe(6);
        for (const issue of validation.issues.filter(issue => issue.severity === "error")) {
          expect(issue).toMatchObject({ code: expect.any(String), commandPath: expect.any(Array),
            field: { testId: expect.any(String) }, cause: expect.any(String), expected: expect.any(String), hint: expect.any(String) });
        }
        expect(validation.issues.filter(issue => issue.code === "reference.variable.missing").map(issue => issue.field?.testId))
          .toEqual(["event-command-variable-target", "event-command-variable-operand"]);
      });

      it("recomputes nested sibling paths after reorder and delete", () => {
        // Given: identical failing labels in different branches.
        const { event, validate } = fixture([{ kind: "loop", body: [{ kind: "gotoLabel", name: "a" }] },
          { kind: "loop", body: [{ kind: "gotoLabel", name: "b" }] }]);
        const page = event.pages?.[0];
        if (!page) throw new Error("Missing page");
        // When: ordering and then membership change.
        page.commands.reverse();
        const reordered = validate().issues.filter(issue => issue.code === "label.target-missing");
        page.commands.splice(0, 1);
        const deleted = validate().issues.filter(issue => issue.code === "label.target-missing");
        // Then: current positions, not retained stale diagnostic paths, locate each sibling.
        expect(reordered.map(issue => issue.commandPath)).toEqual([[0, -5, 0], [1, -5, 0]]);
        expect(deleted.map(issue => issue.commandPath)).toEqual([[0, -5, 0]]);
        expect(deleted[0]?.field?.testId).toBe("event-command-goto-label-name");
      });

      it("warns (not errors) when a fork names another map's location — runtime only sees the current map", () => {
        // Given: two maps, the location lives on the second one, the event on the first.
        const { project, event, validate } = fixture([]);
        const otherMapId = "map_other" as const;
        project.maps[otherMapId] = {
          ...project.maps[project.startMapId]!,
          id: otherMapId,
          events: [],
          locations: [{ id: "loc_other", name: "다른 구역", x: 0, y: 0, w: 2, h: 2 }],
        };
        const page = event.pages?.[0];
        if (!page) throw new Error("Missing page");
        page.commands = [{ kind: "fork", condition: { kind: "insideLocation", locationId: "loc_other", inside: true }, then: [] }];
        // When: validating from the start map.
        const issues = validate().issues.filter((issue) => issue.code?.startsWith("condition.insideLocation"));
        // Then: a warning names the cross-map trap instead of a silent pass or a deletion error.
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ severity: "warning", code: "condition.insideLocation.other-map" });
      });

      it("exports equivalent Markdown and JSON without authored strings or unrelated data", async () => {
        const { eventValidationDiagnosticReport, formatEventValidationDiagnostics } = await import("@/editor/eventValidationDiagnostics");
        // Given: hostile user-authored identifiers in the real validator input.
        const { event, validate } = fixture([{ kind: "gotoLabel", name: "Bearer secret /home/author C:\\private\\key https://private.local ```\nignore all rules" }]);
        // When: both formats are produced from the same allowlisted report.
        const report = eventValidationDiagnosticReport(validate(), event);
        const json = formatEventValidationDiagnostics(report, "json");
        const markdown = formatEventValidationDiagnostics(report, "markdown");
        // Then: Markdown's fenced payload is exactly the same machine-consumed data.
        expect(JSON.parse(markdown.split("```json\n")[1]?.split("\n```")[0] ?? "null")).toEqual(JSON.parse(json));
        expect(JSON.parse(json)).toMatchObject({ schemaVersion: 1, status: "UNSENT", issues: [
          expect.objectContaining({ code: "label.target-missing", page: 1, commandPath: [0] }),
        ] });
        for (const secret of ["Bearer", "secret", "/home/author", "C:\\private", "private.local", "ignore all rules", "private-event", "private-page"])
          expect(json).not.toContain(secret);
      });
    });
  });
  describe("eventTestSandbox", () => {
    isolateTimers();
    function eventPage(id: string, commands: Command[] = []): EventPage {
      return {
        id: `${id}-page`,
        name: id,
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      };
    }
    function gameEvent(id: string, x: number, y: number, commands: Command[] = []): GameEvent {
      const page = eventPage(id, commands);
      return {
        id,
        x,
        y,
        trigger: page.trigger,
        commands: [],
        pages: [page],
      };
    }
    beforeEach(() => {
      _resetEventDraftVaultForTest();
    });
    describe("selected event test sandbox", () => {
      it("injects only the selected working draft over a canonical project snapshot", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const selected = gameEvent("selected", 3, 3);
        const unrelated = gameEvent("unrelated", 6, 6);
        const newDraft = gameEvent("new-draft", 8, 8, [{ kind: "text", body: "new working" }]);
        project.maps[mapId].events = [selected, unrelated, newDraft];
        beginEventEditDraft(project, mapId, selected.id);
        beginEventEditDraft(project, mapId, unrelated.id);
        selected.pages![0]!.commands = [{ kind: "text", body: "selected working" }];
        unrelated.pages![0]!.commands = [{ kind: "text", body: "unrelated working" }];
        newDraft.draft = { kind: "new" };

        const sandbox = buildEventTestSandboxProject(project, mapId, selected.id);

        expect(sandbox?.maps[mapId].events.find((event) => event.id === selected.id)?.pages?.[0]?.commands)
          .toEqual([{ kind: "text", body: "selected working" }]);
        expect(sandbox?.maps[mapId].events.find((event) => event.id === unrelated.id)?.pages?.[0]?.commands)
          .toEqual([]);
        expect(sandbox?.maps[mapId].events.some((event) => event.id === newDraft.id)).toBe(false);
        expect(sandbox?.maps[mapId].events.every((event) => event.draft === undefined)).toBe(true);
        expect(project.maps[mapId].events.find((event) => event.id === selected.id)?.draft?.kind).toBe("edit");
      });

      it("keeps store mutations on canonical state while runtime readers see the sandbox", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const selected = gameEvent("selected", 3, 3, [{ kind: "text", body: "working" }]);
        selected.draft = { kind: "new" };
        project.maps[mapId].events = [selected];
        store.replaceProject(project);
        const preparation = prepareEventTest(store.getCurrent(), mapId, selected.id);
        if (!preparation) throw new Error("expected event test preparation");

        const release = store.beginReadOnlyProjectSnapshot(preparation.project);
        expect(store.getCurrent()).toEqual(preparation.project);
        store.update((canonical) => {
          canonical.meta.title = "canonical changed while sandbox open";
        });
        expect(store.getCurrent().meta.title).not.toBe("canonical changed while sandbox open");

        release();
        expect(store.getCurrent().meta.title).toBe("canonical changed while sandbox open");
        expect(store.getCurrent().maps[mapId].events[0]?.draft?.kind).toBe("new");
      });

      it("prefers passable unoccupied adjacent cells and uses a deterministic diagnosed fallback", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        const selected = gameEvent("selected", 4, 4);
        map.events = [selected, gameEvent("down", 4, 5)];

        const adjacent = selectEventTestSpawn(project, map, selected);
        expect(adjacent).toMatchObject({ x: 3, y: 4, usedFallback: false });

        map.events.push(
          gameEvent("left", 3, 4),
          gameEvent("right", 5, 4),
          gameEvent("up", 4, 3),
        );
        const fallbackA = selectEventTestSpawn(project, map, selected);
        const fallbackB = selectEventTestSpawn(project, map, selected);

        expect(fallbackA).toMatchObject({ x: 3, y: 3, usedFallback: true });
        expect(fallbackA.diagnostic).toContain("이벤트 옆");
        expect(fallbackB).toEqual(fallbackA);
      });
    });
  });
  // 바로 깔기 물건 찾기 — 이름 대조·동의어 묶음·거절·칸 고르기·실제 변경 측정. 네트워크·스토어 없음.
  // 코퍼스(scripts/qa/stamp-place-corpus.mts) 2026-10-15: 「화분」이 자갈·물고기·풀 얼룩으로 깔리고 「완료」라 적히던 것을 막는 순수 규칙.
  describe("stampObjects", () => {
    isolateTimers();
    function entry(id: string, name: string, extra: Partial<StampObjectEntry> = {}): StampObjectEntry {
      const text = name.toLowerCase();
      return { id, kind: "kit", name, source: "pack", width: 1, height: 1, nameText: text, descText: "", floorStanding: true, ...extra };
    }
    const INDEX: readonly StampObjectEntry[] = [
      entry("k-pot", "화분"),
      entry("k-table", "탁자"),
      entry("k-torch", "벽 횃불", { floorStanding: false }),
      entry("k-bench", "나무 벤치", { width: 2 }),
    ];
    const FACTS: StampPlanFacts = {
      text: "화분 깔아 줘",
      mapId: "m",
      mapWidth: 20,
      mapHeight: 20,
      target: { x: 2, y: 2, w: 8, h: 6 },
      targetIsSelection: true,
      fillMaterials: ["흙"],
      materialHint: "",
      objects: INDEX,
      isOpenCell: () => true,
      hasArtAt: () => false,
    };
    describe("resolveStampObject", () => {
      it("finds a thing by its name and refuses things that are not in the chipset", () => {
        expect(resolveStampObject(INDEX, ["화분"])?.entry.id).toBe("k-pot");
        expect(resolveStampObject(INDEX, ["자판기"])).toBeNull();
      });

      it("never returns a wall-mounted piece for a floor request", () => {
        expect(resolveStampObject(INDEX, ["횃불"])).toBeNull();
      });

      it("fixes a one-letter typo only on the user's own word", () => {
        const hit = resolveStampObject(INDEX, ["화뷴"]);
        expect(hit?.entry.id).toBe("k-pot");
        expect(hit?.corrected).toBe(true);
      });

      it("accepts only same-group synonyms from the model, never a similar different thing", () => {
        const accepted = acceptedObjectNames("탁자", ["테이블", "왕좌"]);
        expect(accepted.names).toContain("테이블");
        expect(accepted.rejected).toContain("왕좌");
      });

      it("lists nearest names for a refusal and strips size/coordinate suffixes", () => {
        expect(nearestStampObjects(INDEX, ["화뷴"])).toContain("화분");
        expect(baseName("화분 고사리 (0,0)")).toBe("화분 고사리");
        expect(baseName("버들항 소품 둥근 돌 화분 1×1")).toBe("버들항 소품 둥근 돌 화분");
      });

      it("avoids wooden furniture false matches on tree queries and respects maxSize", () => {
        const pool: readonly StampObjectEntry[] = [
          entry("k-chair", "학교 나무 의자"),
          entry("k-garden", "학급 밭(이랑·새싹·나무 팻말)"),
          entry("k-tree-big", "가로수 · ginkgo", { width: 4, height: 6 }),
          entry("k-tree-small", "벚나무", { width: 2, height: 3 }),
        ];
        const names = acceptedObjectNames("나무", ["가로수", "벚나무"]).names;
        expect(resolveStampObject(pool, names)?.entry.id).toBe("k-tree-small");
        expect(resolveStampObject(pool, ["가로수"], { w: 10, h: 5 })?.entry.id).toBe("k-tree-big");
        const bridges: readonly StampObjectEntry[] = [
          entry("b-tall", "바위 다리", { width: 3, height: 7, placement: "water" }),
          entry("b-fit", "나무 널다리", { width: 5, height: 4, placement: "water" }),
        ];
        expect(resolveStampObject(bridges, acceptedObjectNames("다리", []).names, { w: 40, h: 5 })?.entry.id).toBe("b-fit");
      });

      it("prevents pillar/gate and stair-direction compound conflicts and prefers river footbridge & pedestrian signals", () => {
        const dungeonPool: readonly StampObjectEntry[] = [
          entry("bd-garden-gate", "버들항 소품 정원 정문 (돌 기둥 · 열린 쇠문)", { coreName: "정원 정문 돌 기둥 열린 쇠문", width: 2, height: 2 }),
          entry("bd-column-cata", "버들항 고성·지하 카타콤 · 카타콤 기둥", { coreName: "카타콤 기둥", width: 1, height: 3 }),
          entry("bd-stairs-up", "버들항 지하 수도교·하수도 · 올라가는 계단 (벽 앞면)", { coreName: "올라가는 계단 벽 앞면", width: 2, height: 3, placement: "wall", floorStanding: false }),
          entry("bd-stairs-down", "버들항 지하 수도교·하수도 · 내려가는 계단", { coreName: "내려가는 계단", width: 2, height: 2 }),
        ];
        expect(resolveStampObject(dungeonPool, acceptedObjectNames("돌기둥", ["기둥"]).names)?.entry.id).toBe("bd-column-cata");
        expect(resolveStampObject(dungeonPool, acceptedObjectNames("내려가는 계단", ["계단"]).names)?.entry.id).toBe("bd-stairs-down");

        const bridgePool: readonly StampObjectEntry[] = [
          entry("bd-bridge-arch", "버들항 다리 (아치)", { coreName: "다리 아치", width: 4, height: 5, placement: "water" }),
          entry("bd-river-bridge", "버들항 강변 통나무 판자 다리 (인도교)", { coreName: "강변 통나무 판자 다리 인도교", width: 5, height: 4, placement: "water" }),
        ];
        expect(resolveStampObject(bridgePool, acceptedObjectNames("나무 다리", ["다리", "목교"]).names, { w: 40, h: 5 })?.entry.id).toBe("bd-river-bridge");
      });
    });
    describe("place_object planning", () => {
      it("turns a known name into a pending object step and a missing one into a refusal", () => {
        const plan = parseStampPlan(JSON.stringify({ steps: [
          { tool: "place_object", args: { name: "화분", count: 3 } },
          { tool: "place_object", args: { name: "자판기" } },
        ] }), FACTS);
        expect(plan.steps.map((step) => step.tool)).toEqual(["place_object"]);
        expect(plan.steps[0]!.args).toMatchObject({ entryId: "k-pot", count: 3 });
        expect(plan.refused).toHaveLength(1);
        expect(plan.refused[0]!.wanted).toBe("자판기");
      });

      it("does not stand a person in for a thing, and drops hotspots on bare floor", () => {
        const plan = parseStampPlan(JSON.stringify({ steps: [
          { tool: "place_npc", args: { at: { x: 3, y: 3 }, name: "자판기 관리인" } },
          { tool: "place_examine_hotspots", args: { spots: [{ at: { x: 4, y: 4 }, name: "비석" }] } },
        ] }), { ...FACTS, text: "자판기 놓아 줘" });
        expect(plan.steps).toHaveLength(0);
        expect(plan.dropped).toHaveLength(2);
      });

      it("expands to real tool calls on open cells inside the target, one per requested piece", () => {
        const plan = parseStampPlan(JSON.stringify({ steps: [{ tool: "place_object", args: { name: "화분", count: 3 } }] }), FACTS);
        const expanded = expandStampObjects(plan.steps, FACTS);
        expect(expanded.steps).toHaveLength(3);
        for (const step of expanded.steps) {
          expect(step.tool).toBe("stamp_tileset_object");
          const at = step.at![0]!;
          expect(at.x).toBeGreaterThanOrEqual(2);
          expect(at.x).toBeLessThan(10);
          expect(at.y).toBeGreaterThanOrEqual(2);
          expect(at.y).toBeLessThan(8);
        }
        const keys = new Set(expanded.steps.map((step) => `${step.at![0]!.x},${step.at![0]!.y}`));
        expect(keys.size).toBe(3);
      });

      it("says why nothing was placed when no cell is open", () => {
        const plan = parseStampPlan(JSON.stringify({ steps: [{ tool: "place_object", args: { name: "화분" } }] }), FACTS);
        const expanded = expandStampObjects(plan.steps, { ...FACTS, isOpenCell: () => false });
        expect(expanded.steps).toHaveLength(0);
        expect(expanded.dropped[0]).toContain("놓을 자리가 없습니다");
      });
    });
    describe("measureStampEffect", () => {
      it("counts changed tiles and tells visible events from invisible ones", () => {
        const before = createBlankProject();
        const after = structuredClone(before);
        const mapId = before.startMapId;
        const map = after.maps[mapId]!;
        map.lowerTiles[0] = 99999;
        map.lowerTiles[1] = 99998;
        const none = measureStampEffect(before, before, mapId);
        expect(hasVisibleChange(none)).toBe(false);
        const changed = measureStampEffect(before, after, mapId);
        expect(changed.tilesChanged).toBe(2);
        expect(hasVisibleChange(changed)).toBe(true);
        expect(describeStampEffect(changed)).toContain("타일 2칸");
      });
    });
  });
  // 바로 깔기 주문 대기열 — 같은 맵은 직렬, 다른 맵은 병렬, 조수 턴 동안 새 주문은 대기한다.
  // 러너는 주입한다(모델·스토어 없음). 러너가 받는 waitForApply 를 실제로 기다려야 게이트 동작이 보인다.
  describe("stampOrderQueue", () => {
    isolateTimers();
    interface Pending {
      readonly input: StampRunInput;
      finish(result?: Partial<StampRunResult>): Promise<void>;
    }
    function harness(options: { readonly concurrency?: number; readonly projectKey?: () => string } = {}) {
      const started: Pending[] = [];
      const applied: string[] = [];
      const queue = createStampOrderQueue({
        concurrency: options.concurrency ?? 3,
        projectKey: options.projectKey ?? (() => "p1"),
        mapSize: (mapId) => (["m1", "m2", "m3"].includes(mapId) ? { width: 20, height: 20 } : undefined),
        run: (input) => new Promise<StampRunResult>((resolve) => {
          input.signal?.addEventListener("abort", () => resolve({ ok: false, lines: [], applied: 0, usedModel: true }), { once: true });
          started.push({
            input,
            finish: async (result) => {
              // 실제 러너처럼: 모델 계획이 끝나면 적용 차례를 기다린 뒤 깐다.
              await input.waitForApply?.();
              if (input.signal?.aborted) {
                resolve({ ok: false, lines: ["바로 깔기를 중단했습니다."], applied: 0, usedModel: true });
                return;
              }
              applied.push(input.text);
              resolve({ ok: true, lines: [input.text + " 깔림"], applied: 1, usedModel: true, ...result });
            },
          });
        }),
      });
      return { queue, started, applied };
    }
    const sel = (x: number, y: number, width = 4, height = 4, mapId = "m1") => ({ mapId, x, y, width, height });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    let live: StampOrderQueue | null = null;
    afterEach(() => {
      live?.dispose();
      live = null;
    });
    describe("stampOrderRect / overlap", () => {
      it("clips the selection to the map and falls back to the whole map", () => {
        expect(stampOrderRect({ width: 10, height: 10 }, "m1", sel(8, 8, 5, 5))).toEqual({ x: 8, y: 8, w: 2, h: 2 });
        expect(stampOrderRect({ width: 10, height: 10 }, "m1", null)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
        expect(stampOrderRect({ width: 10, height: 10 }, "m1", sel(0, 0, 3, 3, "other"))).toEqual({ x: 0, y: 0, w: 10, h: 10 });
      });

      it("treats touching edges as separate", () => {
        expect(stampRectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 })).toBe(false);
        expect(stampRectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 3, y: 3, w: 4, h: 4 })).toBe(true);
      });
    });
    describe("createStampOrderQueue", () => {
      it("serializes separated regions of the same map in FIFO order", async () => {
        const h = harness();
        live = h.queue;
        const a = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
        const b = h.queue.enqueue({ text: "연못", mapId: "m1", selection: sel(10, 10) })!;
        const c = h.queue.enqueue({ text: "길", mapId: "m1", selection: sel(2, 2) })!;
        expect(h.started.map((p) => p.input.text)).toEqual(["숲"]);
        expect(c.status).toBe("waiting");
        expect(c.wait).toBe("overlap");
        expect(c.blockedBy).toBe(a.id);
        expect(h.queue.summary()).toEqual({ waiting: 2, running: 1, total: 3 });

        await h.started[0]!.finish();
        await flush();
        expect(a.status).toBe("done");
        expect(b.status).toBe("planning");
        expect(c.status).toBe("waiting");
        await h.started[1]!.finish();
        await flush();
        expect(c.status).toBe("planning");
        expect(h.started.map((p) => p.input.text)).toEqual(["숲", "연못", "길"]);
      });

      it("does not treat the same rect on another map as an overlap", () => {
        const h = harness();
        live = h.queue;
        h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) });
        h.queue.enqueue({ text: "숲", mapId: "m2", selection: sel(0, 0, 4, 4, "m2") });
        expect(h.started).toHaveLength(2);
      });

      it("a whole-map order waits for every order on that map", () => {
        const h = harness();
        live = h.queue;
        h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(15, 15) });
        const whole = h.queue.enqueue({ text: "알아서", mapId: "m1", selection: null })!;
        expect(whole.wait).toBe("overlap");
        expect(h.started).toHaveLength(1);
      });

      it("caps concurrent orders and marks the rest as capacity waits", async () => {
        const h = harness({ concurrency: 2 });
        live = h.queue;
        h.queue.enqueue({ text: "a", mapId: "m1", selection: sel(0, 0, 2, 2) });
        h.queue.enqueue({ text: "b", mapId: "m2", selection: sel(5, 0, 2, 2, "m2") });
        const c = h.queue.enqueue({ text: "c", mapId: "m3", selection: sel(10, 0, 2, 2, "m3") })!;
        expect(h.started).toHaveLength(2);
        expect(c.wait).toBe("capacity");
        await h.started[0]!.finish();
        await flush();
        expect(c.status).toBe("planning");
      });

      it("holds a new model call while chat runs, then also gates apply", async () => {
        let chatBusy = true;
        const h = harness();
        live = h.queue;
        h.queue.setChatBusyProbe(() => chatBusy);
        const order = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
        expect(h.started).toHaveLength(0);
        expect(order.wait).toBe("chat");
        chatBusy = false;
        h.queue.pokeGate();
        expect(h.started).toHaveLength(1);
        chatBusy = true;
        const done = h.started[0]!.finish();
        await flush();
        expect(order.status).toBe("applying");
        expect(order.wait).toBe("chat");
        expect(h.applied).toEqual([]);
        chatBusy = false;
        h.queue.pokeGate();
        await done;
        await flush();
        expect(h.applied).toEqual(["숲"]);
        expect(order.status).toBe("done");
      });

      it("aborts an order whose project was replaced before its apply", async () => {
        let key = "p1";
        const h = harness({ projectKey: () => key });
        live = h.queue;
        const order = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
        key = "p2";
        await h.started[0]!.finish();
        await flush();
        expect(h.applied).toEqual([]);
        expect(order.status).toBe("aborted");
      });

      it("cancelAll drops waiting orders without starting them", async () => {
        const h = harness();
        live = h.queue;
        const a = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
        const b = h.queue.enqueue({ text: "길", mapId: "m1", selection: sel(1, 1) })!;
        expect(h.queue.cancelAll()).toBe(2);
        await h.started[0]!.finish();
        await flush();
        expect(a.status).toBe("aborted");
        expect(b.status).toBe("aborted");
        expect(h.started).toHaveLength(1);
        expect(h.queue.active()).toBe(false);
      });

      it("reports each finished order once", async () => {
        const h = harness();
        live = h.queue;
        h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) });
        await h.started[0]!.finish();
        await flush();
        expect(h.queue.takeUnreported().map((o) => o.lines)).toEqual([["숲 깔림"]]);
        expect(h.queue.takeUnreported()).toEqual([]);
      });

      it("rejects an unknown map", () => {
        const h = harness();
        live = h.queue;
        expect(h.queue.enqueue({ text: "숲", mapId: "nope", selection: null })).toBeNull();
      });
    });
    describe("formatStampOrderSummary", () => {
      it("is empty when nothing runs", () => {
        expect(formatStampOrderSummary({ waiting: 0, running: 0, total: 0 })).toBe("");
        expect(formatStampOrderSummary({ waiting: 2, running: 3, total: 5 })).toBe("바로 깔기 3개 진행 · 2개 대기");
      });
    });
  });
});

// 지형 리뷰 F4·F5: 물이 단 경계를 넘어 깔려 절벽 띠가 연못을 가로지르고, 강 붓이 고원을 벽 없이 갈랐다.
describe("waterReliefBoundary", () => {
  isolateTimers();
  function halfPlateau(): { project: Project; mapId: string } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const levels = new Array<number>(map.width * map.height).fill(0);
    for (let y = 0; y < 6; y++) for (let x = 0; x < map.width; x++) levels[y * map.width + x] = 2;
    map.relief = { width: map.width, height: map.height, levels };
    return { project, mapId: map.id };
  }
  describe("물과 높이 경계", () => {
    beforeEach(() => store.replace(createBlankProject()));

    it("fill_region 물은 가장 낮은 단 칸에만 깔고 넘친 칸 수를 경고한다", () => {
      const { project, mapId } = halfPlateau();
      const { result, project: next } = runHeadlessToolWithProject(project, "fill_region", { mapId, rect: { x: 2, y: 4, w: 6, h: 4 }, material: "버들항 물" }, { assistantRun: true });
      expect(result.ok).toBe(true);
      const map = next.maps[mapId]!, before = project.maps[mapId]!;
      for (let y = 4; y < 6; y++) for (let x = 2; x < 8; x++) expect(map.lowerTiles[y * map.width + x]).toBe(before.lowerTiles[y * map.width + x]);
      expect(map.relief!.levels[4 * map.width + 2]).toBe(2);
      expect(JSON.stringify(result.warnings ?? result.diff?.warnings ?? [])).toContain("높이가 다른 12칸");
    });

    it("강 붓은 첫 칸과 다른 높이의 땅을 깎지 않고 건너뛴 칸 수를 돌려준다", () => {
      const { project, mapId } = halfPlateau();
      store.replace(project);
      const refused = paintTerrainBrush(mapId, 5, 6, "water", 3, 0);
      const map = store.getCurrent().maps[mapId]!;
      expect(refused).toBeGreaterThan(0);
      for (let x = 0; x < map.width; x++) expect(map.relief!.levels[5 * map.width + x]).toBe(2);
    });
  });
});
