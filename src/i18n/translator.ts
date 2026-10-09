// i18n/translator.ts
// 한국어 원문 → 번역 조회. 카탈로그 키는 소스에 적힌 한국어 문자열 그대로이고,
// 템플릿 리터럴·문자열 덧셈에서 온 키는 동적 자리를 `{0}` `{1}` … 로 적는다.
// 순수 모듈 — DOM 을 모른다(domTranslator.ts 가 이 함수를 텍스트 노드·속성에 적용한다).

export type Catalog = Readonly<Record<string, string>>;

const HANGUL = /[\uac00-\ud7a3]/;
const PLACEHOLDER = /\{(\d+)\}/g;
// 템플릿 후보를 좁히는 앞/뒤 고정 글자 수. 동적 자리로 시작·끝나는 템플릿은 반대쪽 고정부로 찾는다.
const BUCKET_CHARS = 2;
// 화면에서 조각을 이어 붙이는 구분자. 앞의 것이 더 큰 단위다("칠하기 (B) — 고른 타일로 칠합니다").
// 맨 끝의 붙은 가운뎃점은 이름 나열용이다("공용 이벤트·변수" — 빈 탭 이름을 names.join("·") 로 잇는다).
const SEGMENT_SEPARATORS = [" — ", ": ", ", ", " · ", "·"] as const;
const TRAILING_PARENS = / \([^()]*\)$/;

type CompiledTemplate = {
  readonly pattern: RegExp;
  readonly order: readonly number[];
  readonly target: string;
};

export type Translator = {
  translate(text: string): string | null;
};

function hangulCount(text: string): number {
  return text.match(/[\uac00-\ud7a3]/g)?.length ?? 0;
}

export function containsHangul(text: string): boolean {
  return HANGUL.test(text);
}

export function normalizeSource(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileTemplate(source: string, target: string): CompiledTemplate {
  const order: number[] = [];
  let pattern = "^";
  let last = 0;
  for (const match of source.matchAll(PLACEHOLDER)) {
    pattern += escapeRegExp(source.slice(last, match.index)) + "([\\s\\S]+?)";
    order.push(Number(match[1]));
    last = (match.index ?? 0) + match[0].length;
  }
  pattern += escapeRegExp(source.slice(last)) + "$";
  return { pattern: new RegExp(pattern), order, target };
}

export function createTranslator(catalog: Catalog): Translator {
  const exact = new Map<string, string>();
  const byHead = new Map<string, string[]>();
  const byTail = new Map<string, string[]>();
  const loose: string[] = [];
  const compiled = new Map<string, CompiledTemplate>();

  for (const [source, target] of Object.entries(catalog)) {
    if (typeof target !== "string" || target.length === 0) continue;
    const key = normalizeSource(source);
    if (!key.includes("{")) {
      exact.set(key, target);
      continue;
    }
    const head = key.slice(0, key.search(PLACEHOLDER));
    const tailStart = [...key.matchAll(PLACEHOLDER)].pop();
    const tail = tailStart ? key.slice((tailStart.index ?? 0) + tailStart[0].length) : "";
    if (tailStart === undefined) {
      exact.set(key, target);
    } else if (head.length >= BUCKET_CHARS) {
      push(byHead, head.slice(0, BUCKET_CHARS), key);
    } else if (tail.length >= BUCKET_CHARS) {
      push(byTail, tail.slice(-BUCKET_CHARS), key);
    } else {
      loose.push(key);
    }
    compiled.set(key, compileTemplate(key, target));
  }

  const translateExact = (text: string): string | null => exact.get(text) ?? null;

  const translateTemplate = (text: string): string | null => {
    const candidates = [
      ...(byHead.get(text.slice(0, BUCKET_CHARS)) ?? []),
      ...(byTail.get(text.slice(-BUCKET_CHARS)) ?? []),
      ...loose,
    ];
    // 고정부가 가장 긴 템플릿이 가장 구체적이다 — "{0}개" 보다 "맵 {0}개" 가 먼저.
    let best: { template: CompiledTemplate; values: string[]; weight: number; fixedHangul: number } | null = null;
    for (const key of candidates) {
      const template = compiled.get(key);
      if (!template) continue;
      const match = template.pattern.exec(text);
      if (!match) continue;
      const weight = key.replace(PLACEHOLDER, "").length;
      if (best && best.weight >= weight) continue;
      best = { template, values: match.slice(1), weight, fixedHangul: hangulCount(key.replace(PLACEHOLDER, "")) };
    }
    if (!best) return null;
    const { template, values } = best;
    const filled = values.map((value) => (containsHangul(value) ? (translateExact(normalizeSource(value)) ?? value) : value));
    // 동적 자리에 남는 한국어가 고정부 한국어보다 많으면 짧은 템플릿이 긴 문장을 잘못 잡은 것이다
    // ("{0} 용어" ← "타일 팔레트와 맵 트리 · 쉬운 용어"). 반쯤 번역보다 원문 그대로가 낫다.
    const leftover = filled.reduce((sum, value) => sum + hangulCount(value), 0);
    if (leftover >= best.fixedHangul && leftover > 0) return null;
    return template.target.replace(PLACEHOLDER, (whole, index: string) => {
      const slot = template.order.indexOf(Number(index));
      return slot < 0 ? whole : (filled[slot] ?? "");
    });
  };

  // "칠하기 · 바닥" 처럼 조각을 이어 붙인 라벨. 조각마다 따로 찾고, 하나라도 번역되면
  // 번역된 조각만 바꾼다(타일 이름 같은 데이터 조각은 원문으로 남는다).
  const translatePiece = (piece: string): string | null => {
    if (!containsHangul(piece)) return null;
    const direct = translateExact(piece) ?? translateTemplate(piece);
    if (direct !== null) return direct;
    // "선택 (V)" — 단축키·수량 괄호를 떼고 찾는다.
    const suffix = TRAILING_PARENS.exec(piece);
    if (suffix) {
      const head = translateExact(piece.slice(0, suffix.index));
      if (head !== null) return head + piece.slice(suffix.index);
    }
    return null;
  };

  const translateSegments = (text: string): string | null => {
    const separator = SEGMENT_SEPARATORS.find((candidate) => text.includes(candidate));
    if (!separator) return translatePiece(text);
    let changed = false;
    const parts = text.split(separator).map((part) => {
      const hit = translatePiece(part) ?? translateSegments(part);
      if (hit !== null) changed = true;
      return hit ?? part;
    });
    return changed ? parts.join(separator) : null;
  };

  return {
    translate(text: string): string | null {
      if (!containsHangul(text)) return null;
      const key = normalizeSource(text);
      // 괄호 꼬리를 먼저 본다 — 「다시실행 (Ctrl+Shift+Z / ⌘⇧Z, Ctrl+Y)」의 쉼표에서 쪼개면 괄호가 갈라져 못 찾는다.
      return translatePiece(key) ?? translateSegments(key);
    },
  };
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
