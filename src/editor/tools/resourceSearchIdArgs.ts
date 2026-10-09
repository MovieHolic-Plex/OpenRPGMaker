// list_resources(kind:"backdrop") 의 검색 id(`backdrop:<리소스 id>`)를 리소스 id 칸에 그대로 넣는 호출을 받아 준다.
//
// 2026-09-24 꿈 세계 도그푸딩(dream-6): 모델이 검색 결과의 id 를 그대로 set_title_screen.backgroundResourceId·
// define_ending.presentation.backgroundResourceId 에 넣었고, 둘 다 「리소스가 존재하지 않습니다」로 거부됐다 — 타이틀·
// 엔딩 배경이 기본값으로 남았다. 검색 id 와 리소스 id 가 다른 것은 도구 쪽 사정이라 모델에게 떠넘기지 않는다.

const RESOURCE_KEY = /(?:^resourceId|ResourceId|^battleBackground|^background)$/u;
const SEARCH_PREFIX = /^backdrop:(.+)$/u;

export function stripResourceSearchIdPrefixes<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    const match = RESOURCE_KEY.test(key) ? SEARCH_PREFIX.exec(value) : null;
    return (match ? match[1] : value) as T;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => { const out = stripResourceSearchIdPrefixes(item, key); if (out !== item) changed = true; return out; });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      const out = stripResourceSearchIdPrefixes(child, childKey);
      if (out !== child) changed = true;
      next[childKey] = out;
    }
    return (changed ? next : value) as T;
  }
  return value;
}
