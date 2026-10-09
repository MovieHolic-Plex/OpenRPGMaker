import { describe, expect, it } from "vitest";
import { compileSimplePages } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import type { SimplePage, ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { validateCommandArray, validateConditionShape } from "@/project/io/shapeCommandFields";

const entry170 = {
  "id": "npc_village_guide",
  "mapId": "map_blank_start",
  "name": "모험 가이드",
  "x": 8,
  "y": 6,
  "graphic": {
    "textureKey": "tex_easyrpg_charset_people1",
    "characterIndex": 2
  },
  "dialogue": {
    "text": "오른쪽 길을 따라가면 위험한 동굴이 나온단다. 조심해서 모험을 떠나렴!"
  }
};

const entry174 = {
  "id": "npc_village_guide",
  "pages": [
    {
      "trigger": "action",
      "graphic": {
        "characterIndex": 2,
        "direction": "down",
        "textureKey": "tex_easyrpg_charset_people1"
      },
      "name": "안내 대사",
      "commands": [
        {
          "fields": {
            "lines": [
              "오른쪽 길을 따라가면 위험한 동굴이 나온단다.",
              "준비를 단단히 하고 떠나렴!"
            ]
          },
          "commandId": "m2-101-show-text"
        }
      ]
    }
  ],
  "x": 8,
  "name": "모험 가이드",
  "mapId": "map_blank_start",
  "y": 6,
  "graphic": {
    "textureKey": "tex_easyrpg_charset_people1",
    "characterIndex": 2
  }
};

const entry196 = {
  "graphic": {
    "characterIndex": 2,
    "textureKey": "tex_easyrpg_charset_people1"
  },
  "pages": [
    {
      "commands": [
        {
          "body": "오른쪽 길을 따라가면 위험한 동굴이 나온단다. 준비를 단단히 하고 떠나렴!",
          "kind": "text"
        },
        {
          "kind": "setSelfSwitch",
          "key": "A",
          "value": true
        }
      ],
      "name": "첫 만남 안내",
      "trigger": "action",
      "graphic": {
        "direction": "down",
        "textureKey": "tex_easyrpg_charset_people1",
        "characterIndex": 2
      }
    },
    {
      "commands": [
        {
          "kind": "text",
          "body": "동굴 안에는 무서운 고블린이 도사리고 있으니, 검과 비약을 꼭 챙겨가거라!"
        }
      ],
      "conditions": {
        "selfSwitch": "A"
      },
      "trigger": "action",
      "graphic": {
        "textureKey": "tex_easyrpg_charset_people1",
        "characterIndex": 2,
        "direction": "down"
      },
      "name": "재방문 조언"
    }
  ],
  "y": 6,
  "name": "모험 가이드",
  "x": 8,
  "id": "npc_village_guide",
  "mapId": "map_blank_start"
};

function repairFrom(result: ToolResult): { path: string; example: unknown } | undefined {
  const line = result.issues?.flatMap(issue => issue.message.split("\n")).find(line => line.startsWith("repair: "));
  if (!line) return undefined;
  const parsed: unknown = JSON.parse(line.slice("repair: ".length));
  if (typeof parsed !== "object" || parsed === null || !("path" in parsed) || typeof parsed.path !== "string" || !("example" in parsed)) {
    throw new Error("Invalid repair JSON");
  }
  return { path: parsed.path, example: parsed.example };
}

function context(): ToolContext {
  return { project: createBlankProject() };
}

function rejectWithoutMutation(ctx: ToolContext, args: Record<string, unknown>): ToolResult {
  const project = ctx.project;
  const snapshot = structuredClone(project);
  const input = structuredClone(args);
  const result = runTool(ctx, "place_npc", args);
  expect(result.ok, JSON.stringify(result)).toBe(false);
  expect(result.issues?.[0]?.code).toBe("invalid-args");
  expect(ctx.project).toBe(project);
  expect(ctx.project).toEqual(snapshot);
  expect(args).toEqual(input);
  return result;
}

function assertRetry(ctx: ToolContext, args: Record<string, unknown>, pages: readonly SimplePage[]): void {
  const result = runTool(ctx, "place_npc", { ...args, pages });
  expect(result.ok, JSON.stringify(result)).toBe(true);
  const event = ctx.project.maps[ctx.project.startMapId]?.events.find(event => event.id === args.id);
  expect(event).toBeDefined();
  if (!event?.pages?.[0]) throw new Error("Missing compiled NPC");
  const compiled = compileSimplePages(event.id, String(args.name), pages, event.pages[0].graphic);
  expect(event.pages).toEqual(compiled);
  for (const page of event.pages) {
    validateCommandArray("commands", page.commands);
    for (const condition of page.conditions) validateConditionShape("condition", condition);
  }
}

describe("audited NPC repairs through the real runner", () => {
  it("entry170: dialogue.text alone becomes the first page instead of a rejection", () => {
    // 2026-09-18: 예전엔 pages 를 요구하며 repair 힌트만 돌려줬다. 이제 dialogue.text 를 그대로 첫 페이지로 쓴다.
    const ctx = context();
    const result = runTool(ctx, "place_npc", entry170);
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).some((w) => w.includes("dialogue.text → pages[0].lines"))).toBe(true);
    const npc = ctx.project.maps[entry170.mapId]?.events.find((event) => event.id === entry170.id);
    expect(JSON.stringify(npc?.pages?.[0]?.commands ?? [])).toContain(entry170.dialogue.text);
  });

  it("entry174: rejects the unknown M2 id and offers native text preserving all lines", () => {
    const ctx = context();
    const result = rejectWithoutMutation(ctx, entry174);
    const repair = repairFrom(result);
    const example = { kind: "text", body: entry174.pages[0]?.commands[0]?.fields.lines.join("\n") };
    expect(repair, JSON.stringify(result)).toEqual({ path: "pages[0].commands[0]", example });
    if (!repair) throw new Error("Missing command repair");
    const pages = entry174.pages.map(page => ({ ...page, commands: [repair.example] }));
    assertRetry(ctx, entry174, pages);
    expect(ctx.project.maps[ctx.project.startMapId]?.events[0]?.pages?.[0]?.commands).toContainEqual(example);
  });

  it("entry196: replaces the actual singleton condition field without dropping either page", () => {
    const ctx = context();
    const result = rejectWithoutMutation(ctx, entry196);
    const repair = repairFrom(result);
    expect(repair, JSON.stringify(result)).toEqual({ path: "pages[1].conditions", example: [{ kind: "selfSwitch", key: "A", value: true }] });
    if (!repair || !Array.isArray(repair.example)) throw new Error("Missing conditions repair");
    const conditions: unknown[] = repair.example;
    const pages = entry196.pages.map((page, index) => ({ ...page, conditions: index === 1 ? conditions : [] }));
    assertRetry(ctx, entry196, pages);
  });

  it.each([true, false])("keeps explicit self-switch value=%s and sibling array conditions", value => {
    const ctx = context();
    const sibling = { kind: "selfSwitch", key: "B", value: false };
    const args = { ...entry170, pages: [{ lines: [entry170.dialogue.text], conditions: [sibling, { selfSwitch: "D", value }] }] };
    const repair = repairFrom(rejectWithoutMutation(ctx, args));
    expect(repair).toEqual({ path: "pages[0].conditions[1]", example: { kind: "selfSwitch", key: "D", value } });
    if (!repair) throw new Error("Missing condition repair");
    assertRetry(ctx, args, [{ lines: [entry170.dialogue.text], conditions: [sibling, repair.example] }]);
  });

  it("preserves canonical pages and condition arrays without repairs", () => {
    const ctx = context();
    const pages = [
      { commands: [{ kind: "text", body: entry170.dialogue.text }, { kind: "setSelfSwitch", key: "A", value: true }], conditions: [] },
      { commands: [{ kind: "text", body: "Already met." }], conditions: [{ kind: "selfSwitch", key: "A", value: true }, { kind: "selfSwitch", key: "B", value: false }] },
    ];
    const snapshot = structuredClone(pages);
    assertRetry(ctx, entry170, pages);
    expect(pages).toEqual(snapshot);
  });
});

describe("ambiguous NPC input remains rejected without lossy repairs", () => {
  it.each([
    null, { text: 42 }, { text: "" }, { text: "Keep", when: { selfSwitch: "A" } }, { text: "Keep", choices: ["Yes", "No"] },
  ])("does not invent pages for ambiguous dialogue %j", dialogue => {
    const ctx = context();
    expect(repairFrom(rejectWithoutMutation(ctx, { ...entry170, dialogue }))).toBeUndefined();
  });

  it("falls back to a greeting line when neither pages nor dialogue is given", () => {
    // 2026-09-18: 아무 대사도 없는 NPC 는 거부 대신 인사 한 줄로 서 있게 한다(거부 잘 안하게).
    const ctx = context();
    const { dialogue: _dialogue, ...args } = entry170;
    const result = runTool(ctx, "place_npc", args);
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).some((w) => w.includes("인사 한 줄 기본 적용"))).toBe(true);
  });

  it.each([
    { commandId: "m2-999-unknown", fields: { lines: ["Keep"] } },
    { commandId: "m2-101-show-text", fields: { lines: ["Keep", 42] } },
    { commandId: "m2-101-show-text", fields: { lines: ["Keep"], speaker: "Other" } },
    { commandId: "m2-101-show-text", fields: { lines: ["Keep"] }, body: "Conflicting" },
    { commandId: "m2-101-show-text", fields: { lines: [] } },
    { kind: { value: "text" }, commandId: "m2-101-show-text", fields: { lines: ["Keep"] } },
  ])("does not guess a command correction for %j", command => {
    const ctx = context();
    expect(repairFrom(rejectWithoutMutation(ctx, { ...entry170, pages: [{ commands: [command] }] }))).toBeUndefined();
  });

  it.each([
    { selfSwitch: "E" }, { selfSwitch: 1 }, { selfSwitch: "A", value: "false" },
    { selfSwitch: "A", switchId: "also_required" }, { selfSwitch: "A", variableId: "v1", value: 3 },
    { selfSwitch: "A", kind: "unknown" }, { kind: "none", selfSwitch: "A" },
  ])("does not drop malformed or extra conditions %j", conditions => {
    const ctx = context();
    expect(repairFrom(rejectWithoutMutation(ctx, { ...entry170, pages: [{ lines: [entry170.dialogue.text], conditions }] }))).toBeUndefined();
  });
});
