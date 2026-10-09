/**
 * jsonb 키 정렬 불변 비교 문자열(todo 8 실측 결함).
 *
 * project storage의 current_json/map_json 컬럼은 PostgreSQL jsonb 로 저장되어 키가
 * **알파벳순으로 정렬**된다(실측: {z:1,a:2,m:3} → {a:2,m:3,z:1}). 반면 에디터 메모리
 * (persistedBaseline/로컬 드래프트)의 객체는 삽입 순서 키를 유지한다. 같은 논리 맵도
 * JSON.stringify 결과가 달라져 매 flush가 가짜 conflict로 끝났다(첫 마일스톤 이후 저장 불가).
 * 키를 재귀적으로 정렬해 문자열로 만들면 jsonb 왕복 여부와 무관하게 같은 논리 값은 같은
 * 문자열이 된다. 배열 순서·값은 그대로 유지한다(배열 순서는 의미가 있다).
 */
export function canonicalJsonString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJsonString(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonString(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * `canonicalJsonString(JSON.parse(JSON.stringify(value)))` 와 **같은 문자열**을 왕복 없이 만든다.
 *
 * 왜(2026-09-23 실측, 14.5 MB 프로젝트): 에이전트 체크포인트 하나를 적용할 때 적용 권위·초안 기준선이
 * 프로젝트 전체를 stringify → parse → 정렬 직렬화로 여러 번 돌려 메인 스레드가 초 단위로 멈췄다.
 * 왕복은 JSON 의미(undefined·함수 제외, 배열 구멍·NaN → null, toJSON)를 얻으려던 것뿐이라 여기서 직접 따른다.
 * 일반 객체·배열이 아닌 값(toJSON 보유, 원시값 래퍼)은 그 자리만 예전 왕복으로 처리해 의미를 그대로 둔다.
 * 결과가 undefined 면(최상위가 undefined·함수) JSON 값이 없다는 뜻이다.
 */
export function canonicalJsonOf(value: unknown, key = ""): string | undefined {
  if (value === null) return "null";
  switch (typeof value) {
    case "string": case "number": case "boolean": return JSON.stringify(value);
    case "undefined": case "function": case "symbol": return undefined;
    case "bigint": return JSON.stringify(value); // JSON.stringify 와 같이 TypeError
    default: break;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.toJSON === "function" || value instanceof Number || value instanceof String || value instanceof Boolean) {
    const parsed = JSON.parse(JSON.stringify({ [key]: value })) as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(parsed, key) ? canonicalJsonString(parsed[key]) : undefined;
  }
  if (Array.isArray(value)) {
    // 원소가 전부 원시값이면(맵 타일 배열) 정렬할 키가 없어 네이티브 직렬화와 글자까지 같다.
    let primitive = true;
    for (let index = 0; index < value.length; index++) {
      const entry: unknown = value[index];
      if (entry !== null && typeof entry === "object") { primitive = false; break; }
    }
    if (primitive) return JSON.stringify(value);
    const parts = new Array<string>(value.length);
    for (let index = 0; index < value.length; index++) parts[index] = canonicalJsonOf(value[index], String(index)) ?? "null";
    return `[${parts.join(",")}]`;
  }
  const parts: string[] = [];
  for (const name of Object.keys(record).sort()) {
    const entry = canonicalJsonOf(record[name], name);
    if (entry !== undefined) parts.push(`${JSON.stringify(name)}:${entry}`);
  }
  return `{${parts.join(",")}}`;
}
