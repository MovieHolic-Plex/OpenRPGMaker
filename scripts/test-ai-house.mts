/**
 * 헤드리스 AI 도구 테스트 — 에디터 없이 직접 LLM에 집 짓기 요청.
 * 사용: npx tsx scripts/test-ai-house.mts
 *
 * apitopia(glm-5.2-ultrafast)에 tool schema를 주고 "야외 집 한 채 지어줘"를 보낸 뒤,
 * 모델이 어떤 도구를 어떤 인자로 호출하는지 로깅한다.
 * tool 결과는 시뮬레이션해서 다시 보내고, 최종 응답까지 추적한다.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envText = readFileSync(envPath, "utf8");
const API_KEY = (envText.match(/VITE_LLM_API_KEY=(.+)/) ?? [])[1]?.trim() ?? "";
const BASE_URL = "https://apitopia.labs.mengmota.com/v1";
const MODEL = "z-ai/glm-5.2-ultrafast";

if (!API_KEY) {
  console.error("VITE_LLM_API_KEY not found in .env.local");
  process.exit(1);
}

interface Tool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "author_house",
      description: "야외 집 외장을 시공한다. 벽, 지붕, 문, 창문이 포함된 주택 구조물을 지정 좌표에 건설한다.",
      parameters: {
        type: "object",
        properties: {
          mapId: { type: "string", description: "대상 맵 ID" },
          x: { type: "number", description: "집 좌상단 X 좌표" },
          y: { type: "number", description: "집 좌상단 Y 좌표" },
          width: { type: "number", description: "집 폭(타일)" },
          height: { type: "number", description: "집 높이(타일)" },
          style: { type: "string", description: "집 스타일: cottage, manor, cabin 등" },
          material: { type: "string", description: "벽 재질: wood, stone, brick 등" },
        },
        required: ["mapId", "x", "y", "width", "height"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_house_kit",
      description: "하네스 규칙으로 집 키트를 시공한다. 내부 맵 생성 옵션 포함.",
      parameters: {
        type: "object",
        properties: {
          mapId: { type: "string", description: "대상 맵 ID" },
          kitId: { type: "string", description: "킷 ID: cottage-l, cottage2, cottage3, mansion" },
          x: { type: "number", description: "시작 X" },
          y: { type: "number", description: "시작 Y" },
          interior: { type: "boolean", description: "실내 맵 생성 여부(기본 true)" },
        },
        required: ["mapId", "kitId", "x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "place_props",
      description: "나무, 바위, 꽃 등 소품을 배치한다.",
      parameters: {
        type: "object",
        properties: {
          mapId: { type: "string" },
          material: { type: "string", description: "타일 라벨/설명 (예: 침엽수, 꽃)" },
          count: { type: "number" },
          positions: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } } },
        },
        required: ["mapId", "material", "count"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_build_spec",
      description: "공간 시공 명세를 제출한다. 집/구조물 시공 전에 영역과 에셋을 정의한다.",
      parameters: {
        type: "object",
        properties: {
          mapId: { type: "string" },
          title: { type: "string" },
          assets: { type: "array", items: { type: "object" } },
        },
        required: ["mapId", "title", "assets"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_map_region",
      description: "맵 영역의 현재 타일/이벤트 상태를 조회한다.",
      parameters: {
        type: "object",
        properties: {
          mapId: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
        },
        required: ["mapId", "x", "y", "w", "h"],
      },
    },
  },
];

const SYSTEM_PROMPT = `당신은 RPG 맵 에디터의 AI 어시스턴트다. 사용자 요청을 받으면 적절한 도구(tool)를 호출하여 맵에 건물, 소품, 지형 등을 배치한다.

도구 규칙:
- 집/건물 시공: author_house 또는 build_house_kit 사용. 벽 타일로 직사각형 채우기 금지.
- 야외 집 한 채: author_house { mapId, x, y, width, height, style, material } 또는 build_house_kit { mapId, kitId, x, y }
- 소품 배치: place_props
- 시공 전 set_build_spec으로 명세 제출 가능
- 영역 확인: get_map_region

현재 맵: map_lake_village (50×50 호수 마을)
선택 영역: (10,10) 20×20

사용자 요청에 맞는 도구를 호출하라. 한국어로 응답하라.`;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

async function callLLM(messages: ChatMessage[], tools: Tool[]): Promise<{
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  finish_reason: string;
}> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      stream: false,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const choice = json.choices[0];
  return {
    content: choice.message.content ?? null,
    tool_calls: choice.message.tool_calls,
    finish_reason: choice.finish_reason,
  };
}

function mockToolResult(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "set_build_spec":
      return JSON.stringify({ ok: true, specId: "spec-1", assets: args.assets ?? [], message: "명세 확정" });
    case "get_map_region":
      return JSON.stringify({ ok: true, mapId: args.mapId, region: args, tiles: "대부분 잔디, 일부 물", events: 0 });
    case "author_house":
      return JSON.stringify({ ok: true, mapId: args.mapId, x: args.x, y: args.y, width: args.width, height: args.height, placed: true, message: `${args.style ?? "cottage"} 스타일 집 시공 완료` });
    case "build_house_kit":
      return JSON.stringify({ ok: true, mapId: args.mapId, kitId: args.kitId, x: args.x, y: args.y, interior: args.interior ?? true, message: `${args.kitId} 킷 시공 완료` });
    case "place_props":
      return JSON.stringify({ ok: true, placed: args.count ?? 0, material: args.material, message: `${args.material} ${args.count}개 배치` });
    default:
      return JSON.stringify({ ok: true, message: "완료" });
  }
}

async function main(): Promise<void> {
  console.log("=== AI House Build Test ===");
  console.log(`Model: ${MODEL}`);
  console.log(`Endpoint: ${BASE_URL}`);
  console.log(`Request: "야외 집 한 채 지어줘"`);
  console.log("");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "야외 집 한 채 지어줘" },
  ];

  for (let round = 0; round < 10; round++) {
    console.log(`--- Round ${round + 1} ---`);
    const result = await callLLM(messages, TOOLS);

    if (result.content) {
      console.log(`Assistant: ${result.content.slice(0, 300)}`);
    }

    if (!result.tool_calls || result.tool_calls.length === 0) {
      console.log(`\n=== Done (${result.finish_reason}) — no more tool calls ===`);
      break;
    }

    messages.push({
      role: "assistant",
      content: result.content,
      tool_calls: result.tool_calls,
    });

    for (const call of result.tool_calls) {
      const args = JSON.parse(call.function.arguments);
      console.log(`Tool Call: ${call.function.name}(${JSON.stringify(args)})`);
      const toolResult = mockToolResult(call.function.name, args);
      console.log(`Tool Result: ${toolResult.slice(0, 200)}`);
      messages.push({ role: "tool", content: toolResult, tool_call_id: call.id });
    }
    console.log("");
  }

  console.log("\n=== Test Complete ===");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
