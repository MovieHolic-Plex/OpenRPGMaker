// editor/tools/reliefTools.ts
// 절벽 높이(map.relief) 도구 — 읽기(read_relief)·빚기(sculpt_relief)·검사(check_relief).
//
// 왜 따로 있는가: 절벽을 타일 번호로 깔면 벽 윗단·몸통·대각선 모서리를 칸마다 골라야 해서 AI 가 거의 항상 틀렸다.
// 높이 칸 하나만 정하면 렌더러(@/project/relief/render)가 벽·대각선·가림을 그리므로, AI 는 「어디가 몇 단인가」만 말한다.
// 빚기는 ops DSL(@/project/relief/ops, RELIEF_OPS_SPEC)을 그대로 받는다 — 산·능선·골짜기·계단식 단을 한 번에 쓴다.
// 높이는 타일 층과 별개다. 편집기·플레이어·조수 미리보기가 같은 높이로 들리고 실제 통행도 높이/경사로를 따른다.

import { checkRelief, reliefMatrixText } from "@/project/relief/check";
import { carryReliefExtras, emptyRelief, reliefIsFlat } from "@/project/relief/edit";
import { buildReliefOps, RELIEF_OPS_SPEC, type ReliefOpsSpec } from "@/project/relief/ops";
import { gridFromRelief, reliefFromGrid, RELIEF_MAX_LEVEL } from "@/project/relief/types";
import type { GameMap } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const SCULPT_EXAMPLE = {
  mapId: "map_1",
  ops: [
    { op: "plateau", rect: [4, 2, 20, 9], h: 4, rough: 0.3 },
    { op: "mountain", at: [30, 6], peak: 7, slope: 2 },
    { op: "canyon", path: [[10, 0], [14, 12], [12, 20]], width: 3, h: 0 },
  ],
};

const reliefGrid = (map: GameMap) => gridFromRelief(map.relief ?? emptyRelief(map.width, map.height));

const readRelief: ToolDefinition = {
  name: "read_relief",
  description:
    "맵의 절벽 높이(relief)를 읽는다. data.matrix 는 한 줄 = 한 행(위=북), 글자 하나 = 한 칸 높이(0~9, a=10 … e=14, 36진수). "
    + "data.check 는 check_relief 와 같은 검사 글(깎인 칸·가려진 칸·일직선 벽). 높이가 없는 맵은 전부 0.",
  mode: "read",
  domains: ["map", "tile"],
  invalidArgsExample: { mapId: "map_1" },
  parameters: { type: "object", properties: { mapId: { type: "string" } }, required: ["mapId"] },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const h = reliefGrid(map);
    return {
      summary: `${map.name} 높이 ${map.relief ? "있음" : "없음(전부 0단)"} — ${map.width}×${map.height}`,
      data: { width: map.width, height: map.height, hasRelief: !!map.relief, matrix: reliefMatrixText(h), check: checkRelief(h).text },
    };
  },
};

const sculptRelief: ToolDefinition = {
  name: "sculpt_relief",
  description:
    "맵의 절벽 높이를 ops 로 빚는다 — 지금 높이 위에 차례로 덧칠한다(reset:true 면 0단에서 시작). "
    + "절벽 벽면·45° 대각선은 렌더러가 그림으로 자동으로 그린다(타일 층은 바뀌지 않는다). "
    + "쓰고 나면 검사 글을 돌려준다 — 가려진 칸·일직선 벽이 있으면 ops 를 고쳐 다시 불러라. "
    + `ops 문법(size 는 맵 크기를 따르므로 무시된다):\n${RELIEF_OPS_SPEC}`,
  mode: "write",
  domains: ["map", "tile"],
  invalidArgsExample: SCULPT_EXAMPLE,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      ops: {
        type: "array",
        description: "{op:fill|rect|plateau|mountain|ridge|canyon|terraces|rough|smooth, ...} 배열 — 문법은 설명 참조",
        items: { type: "object", additionalProperties: true },
      },
      seed: { type: "integer", description: "rough·plateau 들쭉날쭉 난수 씨앗(기본 1)" },
      reset: { type: "boolean", description: "true 면 지금 높이를 버리고 0단에서 시작" },
    },
    required: ["mapId", "ops"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const ops = args.ops;
    if (!Array.isArray(ops) || ops.length === 0 || ops.some((o) => typeof o !== "object" || o === null || typeof (o as { op?: unknown }).op !== "string")) {
      throw new ToolError(`ops 는 {op:...} 객체 배열이어야 합니다. 예: ${JSON.stringify(SCULPT_EXAMPLE)}`, { code: "invalid-args", mapId: map.id });
    }
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1;
    const base = args.reset === true ? gridFromRelief(emptyRelief(map.width, map.height)) : reliefGrid(map);
    const { h, log } = buildReliefOps({ seed, ops: ops as ReliefOpsSpec["ops"] }, base);
    // reset 이면 경사로·벽면 장식은 버리고 양식만 잇는다. 아니면 단이 안 바뀐 칸의 경사로·장식도 잇는다.
    map.relief = carryReliefExtras(args.reset === true ? (map.relief?.style ? { ...emptyRelief(map.width, map.height), style: map.relief.style } : undefined) : map.relief, reliefFromGrid(h));
    if (reliefIsFlat(map.relief)) delete map.relief;
    const check = checkRelief(h);
    const warnings = log.length ? log : undefined;
    return {
      summary: `${map.name} 높이 ${ops.length}개 op 적용 — 가려진 칸 ${check.hidden}, 규칙에 깎인 칸 ${check.cut}`,
      ...(warnings ? { warnings } : {}),
      data: { check: check.text, maxLevel: RELIEF_MAX_LEVEL },
    };
  },
};

const checkReliefTool: ToolDefinition = {
  name: "check_relief",
  description:
    "맵 절벽 높이를 검사한다 — 렌더 규칙에 깎인 칸(1칸 폭 돌기·홈), 남쪽 땅에 가려 안 보이는 구역(바닥·바로 남쪽 높이 포함), "
    + "12칸 이상 일직선 벽(자로 그은 듯 보임)을 글로 돌려준다. 고칠 방향 제안이 붙는다.",
  mode: "read",
  domains: ["map", "tile"],
  invalidArgsExample: { mapId: "map_1" },
  parameters: { type: "object", properties: { mapId: { type: "string" } }, required: ["mapId"] },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const check = checkRelief(reliefGrid(map));
    return {
      summary: `${map.name} 높이 검사 — 가려진 칸 ${check.hidden}, 깎인 칸 ${check.cut}`,
      data: { text: check.text, hidden: check.hidden, cut: check.cut, hiddenRegions: check.hiddenRegions },
    };
  },
};

export const RELIEF_TOOLS: readonly ToolDefinition[] = [readRelief, sculptRelief, checkReliefTool];
