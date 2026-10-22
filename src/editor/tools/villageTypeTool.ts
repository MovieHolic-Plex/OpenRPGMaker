// find_village_type — 마을·도시 종류 한 마디(「조선 장터 마을」「사이버펑크 마을」「광산촌」)를 칩셋 + 시공 도구 + 선택지로 옮긴다(2026-10-22).
// 표의 정본은 src/ai/villageTypeCatalog.ts. 읽기 전용 — 짓지 않는다. 그림이 없는 종류는 «없다»와 가장 가까운 대안을 돌려준다.
import { VILLAGE_ERA_LABEL, VILLAGE_TYPES, searchVillageTypes, villageTypeById, type VillageEra, type VillageType } from "@/ai/villageTypeCatalog";
import type { ToolDefinition, ToolExecResult } from "./types";

const ERAS = Object.keys(VILLAGE_ERA_LABEL) as VillageEra[];

function row(type: VillageType) {
  return {
    id: type.id, ko: type.ko, era: VILLAGE_ERA_LABEL[type.era], chipset: type.chipset, status: type.status, recipe: type.recipe,
    ...(type.gap ? { missingArt: type.gap } : {}),
    ...(type.nearest ? { nearest: type.nearest.map((id) => villageTypeById(id)).filter((t): t is VillageType => !!t).map((t) => ({ id: t.id, ko: t.ko, recipe: t.recipe })) } : {}),
  };
}

export const FIND_VILLAGE_TYPE_TOOL: ToolDefinition = {
  name: "find_village_type",
  mode: "read",
  domains: ["map"],
  description:
    `마을·도시 종류 표(${VILLAGE_TYPES.length}종, 시대: ${ERAS.map((e) => VILLAGE_ERA_LABEL[e]).join("·")}) — 「사이버펑크 마을」「조선 장터 마을」「광산촌」처럼 시대·세계가 담긴 마을 요청을 `
    + "어느 칩셋·어느 시공 도구·어떤 선택지로 지을지 돌려준다(짓지 않는다). status: ready 바로 지음 · partial 짓되 빠진 그림을 말함 · needs-art 그림이 없어 짓지 않고 말함(가장 가까운 대안 nearest). "
    + "마을을 짓기 전에 종류가 애매하면 query 로 한 번 부르고 recipe 대로 짓는다. 그림이 없는 종류를 다른 칩셋 타일·평면 선으로 흉내 내지 않는다.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: 200, description: "요청 문장(예: \"조선 장터 마을\", \"우주 정착지\")" },
      era: { type: "string", enum: ERAS, description: "시대로 목록 좁히기(query 없이)" },
    },
    additionalProperties: false,
  },
  run(_project, args): ToolExecResult {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const era = typeof args.era === "string" && (ERAS as string[]).includes(args.era) ? args.era as VillageEra : null;
    const pool = q ? searchVillageTypes(q) : VILLAGE_TYPES.filter((type) => !era || type.era === era);
    if (!pool.length) {
      return {
        summary: "표에 맞는 마을 종류가 없다 — 낱말을 줄이거나 era 로 목록을 본다. 시대 낱말이 없는 그냥 마을이면 author_beodeul_town 이다.",
        data: { types: [], eras: ERAS.map((e) => ({ id: e, ko: VILLAGE_ERA_LABEL[e] })) },
      };
    }
    const top = pool[0]!;
    const head = q
      ? top.status === "needs-art"
        ? `「${top.ko}」은(는) 그림이 없어 짓지 않는다 — ${top.gap}. 사용자에게 그렇게 말하고 대안(nearest)을 제안한다.`
        : `「${top.ko}」 → ${top.chipset}: ${top.recipe}${top.status === "partial" ? ` (빠진 그림: ${top.gap})` : ""}`
      : `마을 종류 ${pool.length}종(ready ${pool.filter((t) => t.status === "ready").length}).`;
    return { summary: head, data: { types: pool.map(row) } };
  },
};
