// 도구 인자 모양 고치기 — 스키마 검증에 실패한 호출만, 뜻이 분명한 모양 실수를 고쳐 한 번 더 검증한다.
//
// 2026-10-25 공포 트랙 실측(openai-compat 경로, v2 도구 목록 전체): Gemini(Argon·Flash)가 긴 문맥에서 도구가 요구하는
// 감싸는 객체 하나를 자주 빼먹고, 같은 틀린 호출을 되풀이했다 — hf2-mansion-argon 첫 턴 50호출 중 32가 인자 검증 실패.
//   make_place {name,style,type,zones}       → {spec:{…}}
//   upsert_actor {id,name,classId}            → {actor:{…}}
//   add_people {mapId, looks, firstTalk}      → {mapId, people:[{looks, firstTalk}]}
//   edit_place {mapId, patch:{dressing}}      → patch.mapId 가 필요
//   set_lighting_volume sources[].id 없음     → 13번 같은 인자로 13번 실패
// 따로 떼어 도구 둘만 주면 4/4 올바르게 감싼다 — 따를 수 없는 스키마가 아니라 긴 문맥의 흐트러짐이다.
//
// 고치는 것은 셋뿐이다(추측으로 값을 지어내지 않는다).
//  1) 감싸기: 빠진 필수 객체(또는 객체 배열) 칸이 있고, 최상위의 «스키마에 없는 열쇠»가 전부 그 칸의 속성이면 그 칸 안으로 옮긴다.
//  2) 안으로 옮기기: 있는 객체 칸이 필수로 요구하는 열쇠를 최상위가 들고 있으면 복사한다(최상위 속성이 아니면 최상위에서는 뺀다).
//  3) 목록 항목 id: 객체 배열 항목이 필수 문자열 id 를 빠뜨렸으면 «칸이름-번호»를 붙인다(그 실행 안에서만 쓰는 이름표).
// 그래도 실패하면 원래 오류를 그대로 돌려준다. 순수 모듈 — 실행기(scripts/lib/piAgentRuntime.ts)가 검증과 함께 끼운다.

type Schema = {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly required?: readonly string[];
  readonly items?: Schema;
  readonly anyOf?: readonly Schema[];
  readonly oneOf?: readonly Schema[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const typeIs = (s: Schema | undefined, t: string): boolean => !!s && (s.type === t || (Array.isArray(s.type) && s.type.includes(t)));
/** anyOf/oneOf 중 객체 모양 하나(있으면). */
function objectSchema(s: Schema | undefined): Schema | undefined {
  if (!s) return undefined;
  if (typeIs(s, "object") || s.properties) return s;
  return [...(s.anyOf ?? []), ...(s.oneOf ?? [])].find((part) => typeIs(part, "object") || !!part.properties);
}
function arrayItemObject(s: Schema | undefined): Schema | undefined {
  if (!s) return undefined;
  const arr = typeIs(s, "array") ? s : [...(s.anyOf ?? []), ...(s.oneOf ?? [])].find((part) => typeIs(part, "array"));
  return objectSchema(arr?.items);
}

export interface ArgRepair {
  readonly args: unknown;
  /** 무엇을 고쳤는지(사람 말). 비면 고친 것이 없다. */
  readonly changes: readonly string[];
}

export function repairToolArgs(schema: unknown, args: unknown): ArgRepair {
  const root = objectSchema(schema as Schema);
  if (!root?.properties || !isObj(args)) return { args, changes: [] };
  const props = root.properties;
  const required = root.required ?? [];
  const out: Obj = { ...args };
  const changes: string[] = [];

  // 1) 감싸기
  const stray = Object.keys(out).filter((k) => !(k in props));
  if (stray.length) {
    for (const slot of required) {
      if (out[slot] !== undefined) continue;
      const asObject = objectSchema(props[slot]);
      const asItem = asObject ? undefined : arrayItemObject(props[slot]);
      const inner = asObject ?? asItem;
      if (!inner?.properties || !stray.every((k) => k in inner.properties!)) continue;
      const moved: Obj = {};
      for (const k of stray) { moved[k] = out[k]; delete out[k]; }
      out[slot] = asItem ? [moved] : moved;
      changes.push(`최상위 ${stray.join(",")} 를 ${slot}${asItem ? "[0]" : ""} 안으로 옮김`);
      break;
    }
  }

  // 2) 안으로 옮기기
  for (const [slot, value] of Object.entries(out)) {
    const inner = objectSchema(props[slot]);
    if (!inner?.required?.length || !isObj(value)) continue;
    for (const need of inner.required) {
      if (value[need] !== undefined || out[need] === undefined || need === slot) continue;
      out[slot] = { ...(out[slot] as Obj), [need]: out[need] };
      if (!(need in props)) delete out[need];
      changes.push(`${need} 를 ${slot} 안에도 넣음`);
    }
  }

  // 3) 목록 항목 id (한 단계 아래까지)
  const fillIds = (container: Obj, schemaProps: Readonly<Record<string, Schema>>, path: string): void => {
    for (const [key, value] of Object.entries(container)) {
      const item = arrayItemObject(schemaProps[key]);
      if (!Array.isArray(value) || !item?.required?.includes("id") || !typeIs(item.properties?.id, "string")) continue;
      let filled = 0;
      const next = value.map((entry, i) => {
        if (!isObj(entry) || (typeof entry.id === "string" && entry.id)) return entry;
        filled += 1;
        return { ...entry, id: `${key}-${i + 1}` };
      });
      if (filled) { container[key] = next; changes.push(`${path}${key}[] 항목 ${filled}개에 id 를 붙임`); }
    }
  };
  fillIds(out, props, "");
  for (const [slot, value] of Object.entries(out)) {
    const inner = objectSchema(props[slot]);
    if (inner?.properties && isObj(value)) { const copy = { ...value }; const before = changes.length; fillIds(copy, inner.properties, `${slot}.`); if (changes.length > before) out[slot] = copy; }
  }

  return changes.length ? { args: out, changes } : { args, changes };
}

/** 필수 칸만 보이는 모양 예시(오류가 되풀이될 때 모델에게 준다). 깊이 3까지. */
export function requiredShapeExample(schema: unknown, depth = 0): unknown {
  const s = schema as Schema | undefined;
  if (!s) return "…";
  if (s.enum?.length) return s.enum[0];
  if (s.const !== undefined) return s.const;
  const obj = objectSchema(s);
  if (obj?.properties && (typeIs(s, "object") || !typeIs(s, "array"))) {
    if (depth >= 3) return {};
    const req = obj.required ?? [];
    return Object.fromEntries(req.map((k) => [k, requiredShapeExample(obj.properties![k], depth + 1)]));
  }
  const arr = typeIs(s, "array") ? s : [...(s.anyOf ?? []), ...(s.oneOf ?? [])].find((part) => typeIs(part, "array"));
  if (arr) return depth >= 3 ? [] : [requiredShapeExample(arr.items, depth + 1)];
  if (typeIs(s, "string")) return "…";
  if (typeIs(s, "number") || typeIs(s, "integer")) return 0;
  if (typeIs(s, "boolean")) return false;
  return "…";
}

/** 같은 도구가 검증에 연달아 실패할 때 오류 끝에 붙이는 교정 안내. */
export function repeatedShapeHint(toolName: string, schema: unknown, failures: number): string {
  return `\n\n「${toolName}」 이(가) 인자 모양 오류로 ${failures}번 연달아 실패했다. 같은 인자로 다시 부르지 말고, 위 오류가 말한 칸을 채운 모양으로 부른다.`
    + ` 필수 칸만 적은 최상위 모양: ${JSON.stringify(requiredShapeExample(schema))}`;
}
