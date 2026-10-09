/**
 * build_concept_example — 개념 카드(src/ai/conceptCards.ts)의 검수된 예제 맵을 호출 순서 그대로 다시 짓는다.
 *
 * 미궁 80×80·성도 150×150 같은 큰 맵은 조수가 평면을 손으로 쓸 수 없다(2026-10-03: 28칸 평면도 행 길이가 어긋났다).
 * 슈퍼하네스가 예제를 새 프로젝트에서 실제로 지어 보고 검수·조수 시험을 거쳐 구운 호출을 한 번에 돌린다.
 * 예제가 만드는 맵 id 가 이미 있으면 새 id 로 바꿔 짓는다(같은 예제를 두 번 지어도 덮어쓰지 않는다).
 */
import { conceptCards, conceptExampleCalls, conceptExamplesLoaded, preloadConceptExamples } from "@/ai/conceptCards";
import * as runner from "./toolRunner";
import { ToolError, type ToolDefinition } from "./types";

const MAP_ID = /^map_[A-Za-z0-9_-]+$/;

/** 호출 인자 안의 맵 id — 예제는 자기가 만드는 맵만 가리킨다(슈퍼하네스 예제 검사가 기존 맵 참조를 막는다). */
export function exampleMapIds(calls: readonly { args: Record<string, unknown> }[]): string[] {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string") { if (MAP_ID.test(value)) found.add(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  calls.forEach((call) => walk(call.args));
  return [...found];
}

function renameIds(value: unknown, rename: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return rename.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => renameIds(v, rename));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameIds(v, rename)]));
  return value;
}

export const BUILD_CONCEPT_EXAMPLE_TOOL: ToolDefinition = {
  name: "build_concept_example",
  mode: "write",
  domains: ["map", "world"],
  description: "개념 카드(의도 노트의 [개념 카드 · …])의 검수된 예제 맵을 한 번에 짓는다 — 미궁·카타콤·감옥처럼 큰 공간의 평면·벽·바닥·이벤트(보물상자·함정·세이브)를 "
    + "슈퍼하네스가 실제로 지어 보고 검수한 호출 그대로 돌린다. 노트에 적힌 card·variant·example 을 넣는다. 예제 맵 id 가 이미 있으면 새 id 로 짓는다. "
    + "지은 뒤 요청에 맞게 고치고, 기존 맵과는 create_transfer_pair 로 잇는다.",
  parameters: {
    type: "object",
    properties: {
      card: { type: "string", description: "개념 카드 id (노트의 build_concept_example 인자 그대로)" },
      variant: { type: "string", description: "변형 id" },
      example: { type: "string", description: "예제 id. 생략하면 seed 로 고른다" },
      seed: { type: "integer", minimum: 0, description: "예제가 여럿이면 고르는 번호" },
      newMapId: { type: "string", description: "예제가 맵 하나를 만들 때 그 맵의 새 id" },
      name: { type: "string", description: "예제가 맵 하나를 만들 때 그 맵의 이름" },
    },
    required: ["card"],
    additionalProperties: false,
  },
  prepare: (args) => typeof args.card === "string" ? preloadConceptExamples(args.card) : Promise.resolve(),
  allowsTilesetChange: true,
  run(draft, args) {
    const cardId = String(args.card);
    const card = conceptCards().find((c) => c.id === cardId);
    if (!card) throw new ToolError(`개념 카드 ${cardId} 가 없다 — 노트의 card 값을 그대로 넣으세요`, { code: "invalid-args" });
    if (!conceptExamplesLoaded(cardId)) {
      void preloadConceptExamples(cardId);
      throw new ToolError(`${cardId}: 예제를 불러오는 중이다 — 같은 호출을 다시 하세요`, { code: "loading" });
    }
    const variant = args.variant !== undefined ? card.variants.find((v) => v.id === args.variant) : card.variants[0];
    if (!variant) throw new ToolError(`변형 ${String(args.variant)} 이 없다 — ${card.variants.map((v) => v.id).join(", ")}`, { code: "invalid-args" });
    const examples = variant.examples.filter((e) => conceptExampleCalls(cardId, variant.id, e.id)?.length);
    if (!examples.length) throw new ToolError(`${cardId}/${variant.id}: 지을 수 있는 예제가 없다`, { code: "invalid-args" });
    const example = args.example !== undefined ? examples.find((e) => e.id === args.example)
      : examples[Number(args.seed ?? 0) % examples.length];
    if (!example) throw new ToolError(`예제 ${String(args.example)} 가 없다 — ${examples.map((e) => e.id).join(", ")}`, { code: "invalid-args" });
    const calls = conceptExampleCalls(cardId, variant.id, example.id)!;

    const created = exampleMapIds(calls);
    const rename = new Map<string, string>();
    if (typeof args.newMapId === "string" && created.length === 1) rename.set(created[0]!, args.newMapId);
    for (const id of created) {
      if (rename.has(id)) continue;
      let next = id, n = 2;
      while (draft.maps[next]) next = `${id}_${n++}`;
      rename.set(id, next);
    }
    for (const id of rename.values()) if (draft.maps[id]) throw new ToolError(`맵 ${id} 가 이미 있다 — 다른 newMapId 를 주세요`, { code: "invalid-args" });

    const ctx = { project: draft };
    const done: string[] = [];
    for (const call of calls) {
      if (call.name === "build_concept_example") throw new ToolError("예제 안에서 다른 예제를 부를 수 없다", { code: "invalid-example" });
      const result = runner.runTool(ctx, call.name, renameIds(call.args, rename) as Record<string, unknown>);
      if (!result.ok) throw new ToolError(`예제 ${example.id} 의 ${done.length + 1}번째 호출 ${call.name} 실패 — ${result.summary}`, { code: "example-failed" });
      done.push(call.name);
    }
    // 안쪽 실행이 만든 새 프로젝트를 바깥 draft 로 옮긴다 — 바깥 실행기가 이 draft 를 한 번에 커밋한다.
    const next = ctx.project as unknown as Record<string, unknown>;
    const target = draft as unknown as Record<string, unknown>;
    for (const key of Object.keys(target)) if (!(key in next)) delete target[key];
    for (const [key, value] of Object.entries(next)) target[key] = value;

    const mapIds = [...rename.values()];
    if (typeof args.name === "string" && mapIds.length === 1 && draft.maps[mapIds[0]!]) draft.maps[mapIds[0]!]!.name = args.name;
    return {
      summary: `개념 「${card.title}」 예제 「${example.title}」을 지었다 — 맵 ${mapIds.join(", ") || "(없음)"} · 호출 ${done.length}개`,
      data: { card: cardId, variant: variant.id, example: example.id, mapIds, calls: done },
    };
  },
};
