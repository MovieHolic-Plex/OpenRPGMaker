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
