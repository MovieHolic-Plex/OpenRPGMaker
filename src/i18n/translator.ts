// i18n/translator.ts
// 한국어 원문 → 번역 조회. 카탈로그 키는 소스에 적힌 한국어 문자열 그대로이고,
// 템플릿 리터럴·문자열 덧셈에서 온 키는 동적 자리를 `{0}` `{1}` … 로 적는다.
// 순수 모듈 — DOM 을 모른다(domTranslator.ts 가 이 함수를 텍스트 노드·속성에 적용한다).

export type Catalog = Readonly<Record<string, string>>;

const HANGUL = /[\uac00-\ud7a3]/;
const PLACEHOLDER = /\{(\d+)\}/g;
// 번역문 쪽 수량 자리: `{0|one:# map|other:# maps}`. 동적 자리 값의 수로 Intl.PluralRules 형태를 고르고 `#` 에 그 값을 넣는다.
const PLURAL_PLACEHOLDER = /\{(\d+)\|([^{}]*)\}/g;
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

export type ScopedTranslation = { readonly selector: string; readonly target: string };

export type Translator = {
  translate(text: string): string | null;
  /** 같은 원문이 화면 자리마다 다른 뜻일 때의 번역. 카탈로그 키 `@scope(<CSS 선택자>) <원문>`. */
  scoped(text: string): readonly ScopedTranslation[];
  /** 번들 기본 데이터 이름(타일셋·타일 묶음·기본 맵). 카탈로그 키 `@data <원문>`. 원문 전체가 같을 때만. */
  dataName(text: string): string | null;
};

// 카탈로그 키 `@scope(.ai-settings-rail) 연결` — 그 선택자 안에 놓인 글자에만 쓰는 번역.
const SCOPED_KEY = /^@scope\((.+?)\) ([\s\S]+)$/;
// 카탈로그 키 `@data 버들항 길 포석` — 번들 기본 데이터 이름. 저자 글자를 건너뛰는 자리(translate="no")에서도
// 원문 전체가 이 이름과 같을 때만 바꾼다(사용자가 고친 이름은 사전에 없으니 그대로 남는다).
const DATA_KEY = /^@data ([\s\S]+)$/;

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

// "one:# map|other:# maps" 에서 값의 수에 맞는 형태. 수가 아니면 other.
function pluralForm(forms: string, value: string, rules: Intl.PluralRules): string {
  const options = new Map<string, string>();
  for (const part of forms.split("|")) {
    const colon = part.indexOf(":");
    if (colon > 0) options.set(part.slice(0, colon).trim(), part.slice(colon + 1));
  }
  const count = Number(value.replace(/,/g, ""));
  const category = value.trim() !== "" && Number.isFinite(count) ? rules.select(count) : "other";
  const chosen = options.get(category) ?? options.get("other") ?? "";
  return chosen.replace(/#/g, value);
}

export type TranslatorOptions = {
  /** 수량 자리(`{0|one:..|other:..}`)의 복수 규칙 언어. */
  readonly locale?: string;
  /** 조각을 다시 이을 때 원문 구분자 대신 쓸 글자(영어는 줄표 대신 콜론). */
  readonly joinSeparators?: Readonly<Partial<Record<(typeof SEGMENT_SEPARATORS)[number], string>>>;
};

export function createTranslator(catalog: Catalog, options: TranslatorOptions = {}): Translator {
  const pluralRules = new Intl.PluralRules(options.locale ?? "en");
  const joinSeparators = options.joinSeparators ?? {};
  const exact = new Map<string, string>();
  const byHead = new Map<string, string[]>();
  const byTail = new Map<string, string[]>();
  const loose: string[] = [];
  const compiled = new Map<string, CompiledTemplate>();

  const scopedEntries = new Map<string, ScopedTranslation[]>();
  const dataNames = new Map<string, string>();

  for (const [source, target] of Object.entries(catalog)) {
    if (typeof target !== "string" || target.length === 0) continue;
    const scopedKey = SCOPED_KEY.exec(source);
    if (scopedKey) {
      const list = scopedEntries.get(normalizeSource(scopedKey[2])) ?? [];
      list.push({ selector: scopedKey[1], target });
      scopedEntries.set(normalizeSource(scopedKey[2]), list);
      continue;
    }
    const dataKey = DATA_KEY.exec(source);
    if (dataKey) {
      dataNames.set(normalizeSource(dataKey[1]), target);
      continue;
    }
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

  for (const [name, target] of dataNames) if (!exact.has(name)) exact.set(name, target);

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
    // 인자는 정확 일치, 안 되면 「칠하기 · 9개」 같은 조각 이은 라벨로 번역한다.
    const filled = values.map((value) => {
      if (!containsHangul(value)) return value;
      const source = normalizeSource(value);
      return translateExact(source) ?? translateSegments(source) ?? value;
    });
    // 동적 자리에 남는 한국어가 고정부 한국어보다 많으면 짧은 템플릿이 긴 문장을 잘못 잡은 것이다
    // ("{0} 용어" ← "타일 팔레트와 맵 트리 · 쉬운 용어"). 반쯤 번역보다 원문 그대로가 낫다.
    const leftover = filled.reduce((sum, value) => sum + hangulCount(value), 0);
    if (leftover >= best.fixedHangul && leftover > 0) return null;
    const valueOf = (index: string): string | null => {
      const slot = template.order.indexOf(Number(index));
      return slot < 0 ? null : (filled[slot] ?? "");
    };
    return template.target
      .replace(PLURAL_PLACEHOLDER, (whole, index: string, forms: string) => {
        const value = valueOf(index);
        return value === null ? whole : pluralForm(forms, value, pluralRules);
      })
      .replace(PLACEHOLDER, (whole, index: string) => valueOf(index) ?? whole);
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
    // 괄호 안의 구분자는 가리고 고른다 — 「(라벨 없음: map) · 300셀」을 「: 」에서 쪼개면 괄호가 갈라진다.
    const masked = maskParenthesized(text);
    const separator =
      SEGMENT_SEPARATORS.find((candidate) => masked.includes(candidate)) ??
      SEGMENT_SEPARATORS.find((candidate) => text.includes(candidate));
    if (!separator) return translatePiece(text);
    const splitSource = masked.includes(separator) ? masked : text;
    let changed = false;
    const parts = splitAt(text, splitSource, separator).map((part) => {
      const hit = translatePiece(part) ?? translateSegments(part);
      if (hit !== null) changed = true;
      return hit ?? part;
    });
    return changed ? parts.join(joinSeparators[separator] ?? separator) : null;
  };

  return {
    dataName(text: string): string | null {
      return dataNames.get(normalizeSource(text)) ?? null;
    },
    scoped(text: string): readonly ScopedTranslation[] {
      return scopedEntries.get(normalizeSource(text)) ?? [];
    },
    translate(text: string): string | null {
      if (!containsHangul(text)) return null;
      const key = normalizeSource(text);
      // 괄호 꼬리를 먼저 본다 — 「다시실행 (Ctrl+Shift+Z / ⌘⇧Z, Ctrl+Y)」의 쉼표에서 쪼개면 괄호가 갈라져 못 찾는다.
      return translatePiece(key) ?? translateSegments(key);
    },
  };
}

// 괄호(…) 안의 글자를 같은 길이의 \0 으로 바꾼다. 구분자 위치를 찾는 데만 쓰고 원문은 건드리지 않는다.
function maskParenthesized(text: string): string {
  let depth = 0;
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    out += depth > 0 ? "\0" : char;
    if (char === ")" && depth > 0) depth -= 1;
  }
  return out;
}

// positions 에서 separator 가 놓인 자리마다 text 를 자른다(둘의 길이는 같다).
function splitAt(text: string, positions: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let at = positions.indexOf(separator); at >= 0; at = positions.indexOf(separator, start)) {
    parts.push(text.slice(start, at));
    start = at + separator.length;
  }
  parts.push(text.slice(start));
  return parts;
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
