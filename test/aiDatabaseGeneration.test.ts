import { describe, expect, it } from "vitest";
import {
  AiDatabaseGenerationError,
  artworkPromptFor,
  buildRecordPrompt,
  generateDatabaseRecordWithAi,
  generatedRecordId,
  parseGeneratedRecord,
  toolCallsForGeneration,
} from "@/editor/aiDatabaseGeneration";
import { defaultAiConfig } from "@/ai/llmClient";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";

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

    expect(parseGeneratedRecord("enemy", raw)).toEqual({ name: "서슬 늑대", stats: { maxHp: 140, attack: 22 } });
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

  it("한글만 있는 이름도 빈 id 를 만들지 않는다", () => {
    expect(generatedRecordId("item", "회복약", []).startsWith("item_ai_")).toBe(true);
  });
});

describe("toolCallsForGeneration", () => {
  it("그림이 있으면 리소스를 먼저 등록하고 레코드가 그것을 가리킨다", () => {
    const calls = toolCallsForGeneration({
      kind: "enemy",
      recordId: "enemy_ai_slime",
      patch: { name: "슬라임" },
      artwork: { resourceId: "enemy_ai_slime_art", dataUrl: "data:image/png;base64,AAA" },
    });

    expect(calls.map((call) => call.name)).toEqual(["upsert_resource", "upsert_enemy"]);
    expect(calls[0]!.args).toEqual({
      resource: {
        id: "enemy_ai_slime_art",
        name: "슬라임 (AI)",
        kind: "monster",
        dataUrl: "data:image/png;base64,AAA",
      },
    });
    expect(calls[1]!.args).toEqual({
      enemy: { name: "슬라임", id: "enemy_ai_slime", monsterResourceId: "enemy_ai_slime_art" },
    });
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

  it("그림 프롬프트는 종류에 따라 아이콘/전투 스프라이트를 요구하고 흰 배경을 고정한다", () => {
    expect(artworkPromptFor("item", "엘릭서", "회복")).toContain("inventory item icon");
    expect(artworkPromptFor("enemy", "슬라임", "젤리")).toContain("battle monster sprite");
    expect(artworkPromptFor("enemy", "슬라임", "젤리")).toContain("flat white background");
  });
});

describe("generateDatabaseRecordWithAi", () => {
  const ok: ToolResult = { ok: true, summary: "적용" };

  it("LLM 응답과 그림을 한 묶음의 툴 호출로 적용한다", async () => {
    const applied: { calls: readonly { name: string; args: Record<string, unknown> }[]; summary: string }[] = [];
    const outcome = await generateDatabaseRecordWithAi(
      { kind: "enemy", brief: "얼음 늑대", config: defaultAiConfig(), withArtwork: true },
      {
        currentProject: () => EMPTY,
        complete: async () => ({
          message: { role: "assistant", content: '{"name":"서슬 늑대","stats":{"maxHp":140}}' },
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

    expect(outcome.recordId.startsWith("enemy_ai_")).toBe(true);
    expect(outcome.name).toBe("서슬 늑대");
    expect(outcome.resourceId).toBe(`${outcome.recordId}_art`);
    expect(outcome.artworkDataUrl).toBe("data:image/png;base64,FLAT");
    expect(outcome.artworkModel).toBe("gemini-3.1-flash-image");
    expect(applied).toHaveLength(1);
    expect(applied[0]!.calls.map((call) => call.name)).toEqual(["upsert_resource", "upsert_enemy"]);
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
