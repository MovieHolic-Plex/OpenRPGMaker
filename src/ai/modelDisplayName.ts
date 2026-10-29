// 모델 id 를 사람이 읽는 이름으로 — 「gemini-4-argon」 → 「Gemini 4 Argon」, 「claude-opus-5-5」 → 「Claude Opus 5.5」.
// 화면 표시 전용이다. 설정·요청에는 id 를 그대로 쓴다(C-71: 메뉴·칩이 원시 id 를 노출했다).

const UPPER = new Set(["gpt", "glm", "ai"]);

export function modelDisplayName(id: string): string {
  const parts = id.trim().split(/[-_/]+/u).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    // 이어진 숫자 조각은 버전이다: 5-5 → 5.5
    if (/^\d+$/u.test(part) && prev !== undefined && /^\d+(\.\d+)*$/u.test(prev)) {
      out[out.length - 1] = `${prev}.${part}`;
      continue;
    }
    out.push(UPPER.has(part.toLowerCase()) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1));
  }
  return out.join(" ") || id;
}
