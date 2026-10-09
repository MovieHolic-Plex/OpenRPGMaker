// editor/tools/lifeFlowerTools.ts
// 이브식 「꽃잎 = 체력」 한 벌을 한 번에 깐다: 변수(시작값 = 최댓값) + 꽃잎 HUD + 피해/회복 공용 이벤트
// (+ 0장이면 게임 오버 또는 배드 엔딩).
//
// 왜 (2026-09-24 갤러리 호러 도그푸딩): 기획서·계획 턴 모두 「꽃잎 5장이 체력, 0장이면 게임오버」를 적었지만
// 시공 턴은 함정마다 `setVariable v_petals -= 1` 만 흩뿌렸다. 변수 시작값은 0 이라 첫 함정에 -1 이 됐고,
// 0 이하를 보는 곳이 없어 게임 오버가 없었으며, 화면에는 꽃잎 대신 기본 HUD(하트·시계·도구칸)가 떴다.
// 런타임에는 꽃잎 HUD(fieldHud shape:"petals", source:"variable")·fork·gameOver 가 이미 있었는데 조수가
// 이를 묶을 도구가 없었다 — 이 도구가 그 조립을 맡고, 함정·꽃병은 공용 이벤트를 부르기만 하면 된다.

import type { Command, Project } from "@/project/types";
import { normalizeFieldHud, normalizeHudWidget, type HudWidget } from "@/project/fieldHud";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const DEFAULT_VARIABLE_ID = "var_life_petals";
const DAMAGE_EVENT_ID = "ce_life_damage";
const RESTORE_EVENT_ID = "ce_life_restore";
const HUD_WIDGET_ID = "life-flower";

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function intIn(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function upsertCommonEvent(project: Project, id: string, name: string, commands: Command[]): "added" | "updated" {
  project.commonEvents ??= [];
  const index = project.commonEvents.findIndex((entry) => entry.id === id);
  const record = { id, name, trigger: "none" as const, commands };
  if (index >= 0) { project.commonEvents[index] = record; return "updated"; }
  project.commonEvents.push(record);
  return "added";
}

function effect(commandId: string, fields: Record<string, unknown>): Command {
  return { kind: "m2Command", commandId, fields } as unknown as Command;
}

const setLifeFlower: ToolDefinition = {
  name: "set_life_flower",
  description:
    "이브식 「꽃잎(생명) = 체력」 시스템을 한 번에 만든다 — 체력 변수(시작값=최댓값), 화면의 꽃잎 HUD, " +
    "피해 공용 이벤트(붉은 번쩍임·흔들림 → 1장 감소 → 0장이면 게임 오버 또는 배드 엔딩)와 회복 공용 이벤트(꽃병에 꽂기 → 최댓값). " +
    "함정·튀어나오는 그림·가시 바닥 이벤트에는 {kind:'callCommonEvent',commonEventId:'ce_life_damage'}, 꽃병에는 " +
    "{kind:'callCommonEvent',commonEventId:'ce_life_restore'} 를 넣는다. 체력·HP·꽃잎·장미·생명·게임오버·꽃병 회복을 setVariable 로 직접 흩뿌리지 말 것. " +
    "같은 인자로 다시 부르면 덮어쓴다. 만든 공용 이벤트를 upsert_common_event 로 다시 쓰지 말 것 — 대사는 damageLines·restoreLines·defeatLines 로 바꾼다.",
  mode: "write",
  domains: ["event", "system"],
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "생명의 이름(예: 푸른 수국). HUD 라벨·변수 이름에 쓴다." },
      max: { type: "integer", description: "최대 꽃잎 수 1–10, 기본 5" },
      variableId: { type: "string", description: `체력 변수 id. 기본 ${DEFAULT_VARIABLE_ID}. 이미 쓰던 변수가 있으면 그 id` },
      color: { type: "string", description: "꽃잎 색 #rrggbb (기본 #5b7fd6)" },
      showAfterSwitchId: { type: "string", description: "이 스위치가 켜진 뒤에만 HUD 를 보인다(꽃을 줍는 장면 뒤). 생략하면 처음부터" },
      defeatEndingId: { type: "string", description: "0장이 되면 이 엔딩을 실행한다(define_ending 으로 만든 id). 생략하면 게임 오버 화면" },
      defeatLines: { type: "array", items: { type: "string" }, description: "0장이 됐을 때 대사" },
      damageLines: { type: "array", items: { type: "string" }, description: "꽃잎을 잃을 때마다 보일 대사(생략 가능 — 부르는 이벤트가 이미 설명하면 비워 둔다)" },
      restoreLines: { type: "array", items: { type: "string" }, description: "회복할 때 대사(생략 가능)" },
    },
    required: [],
  },
  invalidArgsExample: { name: "푸른 수국", max: 5, showAfterSwitchId: "sw_got_flower", defeatLines: ["마지막 꽃잎이 떨어졌다……"] },
  run(draft, args): ToolExecResult {
    const name = text(args.name, "생명의 꽃");
    const max = intIn(args.max, 5, 1, 10);
    const variableId = text(args.variableId, DEFAULT_VARIABLE_ID);
    const color = typeof args.color === "string" && /^#[\da-f]{6}$/i.test(args.color) ? args.color : "#5b7fd6";
    const warnings: string[] = [];
    const lines = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim()) : [];

    ensureNamedVariable(draft, variableId, `${name} 꽃잎`);
    // 시작값 = 최댓값. 예전 산출물은 0 에서 시작해 첫 함정에 -1 이 됐다.
    draft.session.variables[variableId] = max;

    const showAfter = text(args.showAfterSwitchId, "");
    if (showAfter) ensureNamedSwitch(draft, showAfter, `${name} 획득`);

    let defeat: Command;
    const endingId = text(args.defeatEndingId, "");
    if (endingId) {
      if (!(draft.endings ?? []).some((ending) => ending.id === endingId)) {
        throw new ToolError(`defeatEndingId '${endingId}' 엔딩이 없습니다. define_ending 으로 먼저 만들거나 생략해 게임 오버 화면을 쓰세요.`, { code: "ending-not-found" });
      }
      defeat = { kind: "triggerEnding", endingId } as Command;
    } else {
      defeat = { kind: "gameOver" } as Command;
    }
    const defeatLines = lines(args.defeatLines);
    const defeatBranch: Command[] = [
      ...(defeatLines.length > 0 ? defeatLines : [`${name}의 마지막 꽃잎이 떨어졌다……`]).map((body) => ({ kind: "text", body }) as Command),
      defeat,
    ];
    const damage: Command[] = [
      // 필드 값은 카탈로그 선택지여야 한다 — 「#a01830」·숫자 3 은 직렬화 왕복 검증에서 거부돼 도구 변경 전체가 되돌려졌다
      // (2026-09-24 r3: 도구는 OK 를 냈지만 공용 이벤트·변수·HUD 가 하나도 남지 않았다).
      effect("m2-047-flash-screen", { color: "red", value: "flash", durationMs: 250 }),
      effect("m2-048-shake-screen", { intensity: "3", value: 3, durationMs: 300 }),
      { kind: "setVariable", variableId, op: "-=", value: 1 } as Command,
      ...lines(args.damageLines).map((body) => ({ kind: "text", body }) as Command),
      { kind: "fork", condition: { kind: "variable", variableId, op: "<=", value: 0 }, then: defeatBranch } as Command,
    ];
    const restore: Command[] = [
      { kind: "setVariable", variableId, op: "=", value: max } as Command,
      ...lines(args.restoreLines).map((body) => ({ kind: "text", body }) as Command),
    ];
    const damageOutcome = upsertCommonEvent(draft, DAMAGE_EVENT_ID, `${name} 꽃잎 잃기`, damage);
    upsertCommonEvent(draft, RESTORE_EVENT_ID, `${name} 되살리기`, restore);

    // 꽃잎 HUD. 기본 HUD(하트·시계·도구칸)는 이 장르에 맞지 않으므로 호러 테마로 바꾸고 꽃잎 위젯 하나를 둔다.
    // 사용자가 따로 둔 다른 위젯은 남긴다(체력 hp 위젯만 꽃잎이 대신한다).
    const hud = normalizeFieldHud(draft.system.fieldHud);
    const kept: HudWidget[] = (hud.widgets ?? []).filter((widget) => widget.id !== HUD_WIDGET_ID && widget.source !== "hp");
    const petals = normalizeHudWidget({
      id: HUD_WIDGET_ID, kind: "gauge", source: "variable", variableId, max, shape: "petals", label: "",
      anchor: "top-left", width: 34, height: 44, color, showValue: false,
      condition: showAfter ? "switch" : "always", ...(showAfter ? { switchId: showAfter } : {}),
    });
    draft.system.fieldHud = { ...hud, theme: "horror", vitals: false, clock: false, tools: false, widgets: [petals, ...kept] };

    const usage = {
      damage: { kind: "callCommonEvent", commonEventId: DAMAGE_EVENT_ID },
      restore: { kind: "callCommonEvent", commonEventId: RESTORE_EVENT_ID },
    };
    return {
      summary: `꽃잎 체력 '${name}' ${max}장 — 변수 ${variableId}(시작 ${max}), 꽃잎 HUD, 피해 ${DAMAGE_EVENT_ID}·회복 ${RESTORE_EVENT_ID} ${damageOutcome === "added" ? "추가" : "갱신"} · 0장이면 ${endingId ? `엔딩 ${endingId}` : "게임 오버"}`,
      data: { variableId, max, damageCommonEventId: DAMAGE_EVENT_ID, restoreCommonEventId: RESTORE_EVENT_ID, hudWidgetId: HUD_WIDGET_ID, usage },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export const LIFE_FLOWER_TOOLS: readonly ToolDefinition[] = [setLifeFlower];
