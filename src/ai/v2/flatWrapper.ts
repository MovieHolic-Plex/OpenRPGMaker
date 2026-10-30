// 감싸는 칸 하나를 펴서 보인다 — make_place{spec:{…}}·upsert_actor{actor:{…}}·upsert_event{mapId,event:{…}}·add_people{people:[…]} 같은
// 도구를 «칸을 최상위에 바로 적는» 모양으로 모델에게 보이고, 실행 직전에 원래 모양으로 다시 감싼다.
// 2026-10-25 공포 트랙 실측(J67): 긴 v2 도구 목록에서 Gemini 가 감싸는 칸을 자주 빼먹었다(hf2-mansion-argon 첫 턴 50호출 중 32 실패).
// argRepair 가 사후에 고치지만 처음부터 펴서 보이면 틀릴 자리가 없다. 감싼 모양으로 보내도(예전 습관) 그대로 통과한다.
import type { PiToolCallRecord, PiToolExecResult, PiToolShape } from "@/ai/piAgent/toolAdapter";

type Schema = { readonly type?: unknown; readonly properties?: Readonly<Record<string, Schema>>; readonly required?: readonly string[]; readonly items?: Schema; readonly description?: string };
type Obj = Record<string, unknown>;

/** 펼 도구와 그 감싸는 칸. array 면 칸이 객체 목록이다(한 개는 최상위에, 여럿은 그 칸 목록으로). */
export const FLAT_WRAPPERS: Readonly<Record<string, { readonly slot: string; readonly array?: boolean }>> = {
  make_place: { slot: "spec" },
  add_event: { slot: "event" },
  add_scene: { slot: "scene" },
  draw_object: { slot: "object" },
  upsert_actor: { slot: "actor" },
  upsert_event: { slot: "event" },
  add_people: { slot: "people", array: true },
};

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const fail = (summary: string): PiToolExecResult => ({ content: [{ type: "text", text: JSON.stringify({ ok: false, summary }) }] });

/** 펼친 모양의 스키마와, 펼친 인자를 원래 모양으로 되감는 함수. 펼 수 없으면 undefined(도구를 그대로 둔다). */
export function flatWrapperShape(name: string, parameters: unknown): { readonly parameters: Schema; readonly wrap: (args: unknown) => { args: unknown; missing: readonly string[] } } | undefined {
  const w = FLAT_WRAPPERS[name];
  const p = parameters as Schema | undefined;
  const slotSchema = w ? p?.properties?.[w.slot] : undefined;
  const inner = w?.array ? slotSchema?.items : slotSchema;
  if (!w || !p?.properties || !slotSchema || !inner?.properties) return undefined;
  const outer = Object.fromEntries(Object.entries(p.properties).filter(([k]) => k !== w.slot));
  // 바깥 칸과 이름이 겹치는 안쪽 칸(add_people 의 mapId)은 바깥 것 하나로 쓴다.
  const innerProps = Object.fromEntries(Object.entries(inner.properties).filter(([k]) => !(k in outer)));
  const innerRequired = (inner.required ?? []).filter((k) => k in innerProps);
  const properties: Record<string, Schema> = {
    ...outer, ...innerProps,
    ...(w.array ? { [w.slot]: { ...slotSchema, description: `Use only to place several at once. For one, write it at the top level without this field.${slotSchema.description ? ` ${slotSchema.description}` : ""}` } } : {}),
  };
  const required = (p.required ?? []).filter((k) => k !== w.slot);
  // 안쪽이 다른 열쇠도 받으면(upsert_event 의 event: name·graphic·moveRoute…) 바깥 칸이 아닌 최상위 열쇠는 전부 안으로 옮긴다 — 안 그러면 조용히 버려진다.
  const openInner = (inner as { readonly additionalProperties?: unknown }).additionalProperties !== false;
  const belongsInside = (k: string): boolean => k !== w.slot && (k in innerProps || (openInner && !(k in outer)));
  const wrap = (args: unknown): { args: unknown; missing: readonly string[] } => {
    if (!isObj(args)) return { args, missing: [] };
    const out: Obj = { ...args }, moved: Obj = {};
    for (const k of Object.keys(out)) if (belongsInside(k)) { moved[k] = out[k]; delete out[k]; }
    const slotValue = out[w.slot];
    if (slotValue !== undefined) {
      // 감싼 모양(예전 습관). 최상위에 칸이 더 있으면 그 칸을 버리거나 거절하지 않고 감싼 값에 합친다.
      if (!Object.keys(moved).length) return { args, missing: [] };
      if (w.array && Array.isArray(slotValue)) {
        // 빈 문자열도 빈 칸이다 — 목록과 함께 최상위에 role:""·name:""·where:"" 를 채워 보낸 찌꺼기가 이름 없는 사람 한 명으로 붙었다
        // (2026-10-29 room-vig6 tavern: 「이름 없는 인물 한 명과 기본 대사가 의도치 않게 추가」).
        const incomplete = innerRequired.filter((k) => moved[k] === undefined || moved[k] === "");
        if (incomplete.length === 0) return { args: { ...out, [w.slot]: [...slotValue, moved] }, missing: [] };
        // 목록이 이미 있으면 그게 본문이다. role 없는 찌꺼기(이름만 한 번 더 적은 것)를 사람으로 붙이면
        // 필수 칸이 비어 목록 전체가 거절됐다. 한 명뿐이면 비어 있는 칸만 채우고, 여럿이면 찌꺼기는 버린다.
        if (slotValue.length === 1 && isObj(slotValue[0])) {
          const person: Obj = { ...slotValue[0] };
          for (const [k, v] of Object.entries(moved)) if (person[k] === undefined) person[k] = v;
          return { args: { ...out, [w.slot]: [person] }, missing: innerRequired.filter((k) => person[k] === undefined) };
        }
        if (slotValue.length > 0) return { args: { ...out, [w.slot]: slotValue }, missing: [] };
        return { args: { ...out, [w.slot]: slotValue }, missing: incomplete };
      }
      if (isObj(slotValue)) {
        const merged = { ...moved, ...slotValue };
        return { args: { ...out, [w.slot]: merged }, missing: innerRequired.filter((k) => merged[k] === undefined) };
      }
      return { args, missing: [] };
    }
    const missing = innerRequired.filter((k) => moved[k] === undefined);
    out[w.slot] = w.array ? [moved] : moved;
    return { args: out, missing };
  };
  // 뿌리의 additionalProperties:false 는 뺀다 — 감싼 모양(예전 습관)으로 온 칸을 검증기가 지우지 않게.
  const { additionalProperties: _drop, ...root } = p as Schema & { readonly additionalProperties?: unknown };
  void _drop;
  return { parameters: { ...root, properties, required: [...required, ...innerRequired] }, wrap };
}

/** 도구 하나를 펴서 보인다. 감싼 모양(예전 습관)으로 온 호출은 그대로 넘긴다. record 를 주면 필수 칸이 빠진 거절도 기록한다. */
export function flattenWrapperTool(tool: PiToolShape, record?: (r: PiToolCallRecord) => void): PiToolShape {
  const shape = flatWrapperShape(tool.name, tool.parameters);
  if (!shape) return tool;
  const slot = FLAT_WRAPPERS[tool.name]!.slot;
  // 감싼 모양도 받아야 하므로 스키마 필수에는 바깥 필수만 둔다 — 안쪽 필수는 실행 전에 직접 본다.
  const outerRequired = ((tool.parameters as Schema).required ?? []).filter((k) => k !== slot);
  return {
    ...tool,
    parameters: { ...shape.parameters, required: outerRequired },
    async execute(id, params, signal) {
      const { args, missing } = shape.wrap(params);
      if (missing.length) {
        const summary = `${tool.name}: 필수 칸 ${missing.join(", ")} 이(가) 없다 — 최상위에 바로 적는다(예: ${tool.name}{${missing.map((k) => `${k}:…`).join(", ")}, …}).`;
        record?.({ toolCallId: id, name: tool.name, args: params, result: { ok: false, summary } } as PiToolCallRecord);
        return fail(summary);
      }
      return tool.execute(id, args, signal);
    },
  };
}
