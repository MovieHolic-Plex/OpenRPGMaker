import { sha256HexTextSync } from "../../../util/sha256";

/**
 * `canonicalJsonOf` 와 **같은 동일성**(키 순서 무시, 배열 순서·값·JSON 투영 유지)을 SHA-256 요약으로 낸다.
 *
 * 왜(2026-09-25 실측, 26 MB 프로젝트 = 타일셋 그림 25 MB): 조수 체크포인트 하나가 적용 권위·초안 기준선을 위해
 * 프로젝트 전체를 두 번 정렬 직렬화하고 다섯 번 해시했다 — 에이전트가 타일셋을 건드리지 않아도 메인 스레드가
 * 체크포인트마다 약 10 s 멈췄다. 여기서는 객체·배열마다 «자식 요약으로 만든 글»의 해시를 기억하고,
 * 바뀌지 않은 가지는 다시 직렬화하지 않는다.
 *
 * 기억은 세대가 아니라 **값 대조**로 무효화한다. 사람은 세대를 올리지 않고 객체를 제자리에서 고칠 수 있으므로
 * (applyChangesetToStore `withIdentityScope` 주석), 부를 때마다 모든 노드의 키 목록·원시값(===)·자식 요약을
 * 기억과 맞춰 본다. 어느 깊이에서든 제자리 수정은 그 노드의 불일치로 드러나 위로 다시 계산된다.
 * 기억은 (키·원시값·자식 토큰) → 토큰 기록이고 자식 객체를 붙잡지 않는다 — 문서 사본도, 옛 트리도 들고 있지 않다.
 */

interface NodeMemo {
  readonly keys: readonly string[] | null;
  /** 원시 자식 값. 객체 자식 자리는 undefined(객체는 tokens 로 대조한다). */
  readonly values: readonly unknown[];
  /** 객체 자식의 토큰. 원시 자식 자리는 undefined. */
  readonly tokens: readonly (string | undefined)[];
  readonly token: string;
}

const memos = new WeakMap<object, NodeMemo>();

/**
 * 한 동기 구간 안에서 이미 대조를 마친 노드. 구간 안에서는 아무도 값을 고치지 않으므로 같은 노드를 두 번 대조하지 않는다.
 *
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 149MB · 타일셋 노드 62만 개): 조수 체크포인트 적용 한 번이 같은 타일셋 사전을
 * 제안 기준·저작 기준선·적용 뒤 권위로 4~5번 요약했다. 기억이 있어도 대조(isFresh)가 노드마다 다시 돌아 한 번에 약 0.3s,
 * 체크포인트마다 1.2~1.8s 였다. 구간은 호출자가 연다(applyChangesetToStore 의 withIdentityScope) — 구간 밖에서는 예전처럼
 * 부를 때마다 대조한다(제자리 수정은 구간과 구간 사이에서만 일어날 수 있다).
 */
let verifiedInEpoch: WeakSet<object> | null = null;

/** 이 구간 안에서는 같은 노드의 기억을 한 번만 대조한다. 구간 안에서 값을 제자리에서 고치면 안 된다. 중첩 호출은 바깥 구간을 쓴다. */
export function withContentDigestEpoch<T>(run: () => T): T {
  if (verifiedInEpoch) return run();
  verifiedInEpoch = new WeakSet();
  try { return run(); } finally { verifiedInEpoch = null; }
}

/**
 * 제자리에서 고치지 않는다는 계약을 가진 공유 항목(스토어의 타일셋·업로드 자산 항목 — projectClone 머리말). 한 번 요약을 만든 뒤에는
 * 구간을 넘어서도 대조하지 않는다. 계약이 깨지면(항목을 제자리에서 고치면) 저장 diff 도 이미 그 변경을 놓친다(projectPatch 의
 * `base === local` 단축) — 같은 전제를 요약도 따른다.
 *
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 · 타일셋 노드 62만 개): 기억이 있어도 대조가 타일셋 노드를 전부 훑어 요약 한 번에 약 0.3s,
 * 조수 체크포인트 하나가 구간 여러 개(적용 권위·적용·체크리스트·커밋 기준)에서 이를 되풀이해 1s 이상이었다.
 */
const trustedShared = new WeakSet<object>();
/**
 * 믿음은 적용 권위 요약(projectIdentityDigest) 안에서만 쓴다. 로드 정규화(store.normalizeCurrentProject)처럼 공유 항목을
 * 제자리에서 고치고 전후 요약으로 변경을 알아내는 곳은 믿음 없이 끝까지 대조한다.
 */
let trustingShared = false;

/** 이 안의 요약은 믿은 공유 항목을 대조하지 않는다. */
export function withTrustedSharedEntries<T>(run: () => T): T {
  if (trustingShared) return run();
  trustingShared = true;
  try { return run(); } finally { trustingShared = false; }
}

/** 프로젝트의 타일셋·업로드 자산 항목 중 요약 기억이 있는 것을 공유 항목으로 믿는다. 요약을 만든 직후 부른다. */
export function trustSharedProjectEntries(project: unknown): void {
  if (!isObject(project)) return;
  const record = project as { tilesets?: unknown; assets?: { uploaded?: unknown } };
  for (const dictionary of [record.tilesets, record.assets?.uploaded]) {
    if (!isObject(dictionary)) continue;
    for (const entry of Object.values(dictionary as Record<string, unknown>)) {
      if (isObject(entry) && memos.has(entry)) trustedShared.add(entry);
    }
  }
}

/** JSON 값의 토큰. 원시값·짧은 노드는 글 그대로, 긴 객체·배열은 `#` + 글의 요약. JSON 값이 없으면 undefined. */
function tokenOf(value: unknown, key: string): string | undefined {
  if (value === null) return "null";
  switch (typeof value) {
    case "string": case "number": case "boolean": return JSON.stringify(value);
    case "undefined": case "function": case "symbol": return undefined;
    case "bigint": return JSON.stringify(value); // JSON.stringify 와 같이 TypeError
    default: break;
  }
  const record = value as Record<string, unknown>;
  // canonicalJsonOf 와 같은 자리에서 같은 왕복으로 JSON 의미를 얻는다. 왕복 결과는 새 객체라 기억되지 않는다.
  if (typeof record.toJSON === "function" || value instanceof Number || value instanceof String || value instanceof Boolean) {
    const parsed = JSON.parse(JSON.stringify({ [key]: value })) as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(parsed, key) ? tokenOf(parsed[key], key) : undefined;
  }
  return nodeToken(record);
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function nodeToken(node: Record<string, unknown>): string {
  const keys = Array.isArray(node) ? null : Object.keys(node);
  const items = keys ? null : (node as unknown as unknown[]);
  const length = keys ? keys.length : items!.length;
  const memo = memos.get(node);
  if (memo && (verifiedInEpoch?.has(node) || (trustingShared && trustedShared.has(node)))) return memo.token;
  if (memo && memo.values.length === length && isFresh(node, keys, items, length, memo)) {
    verifiedInEpoch?.add(node);
    return memo.token;
  }

  const values = new Array<unknown>(length);
  const tokens = new Array<string | undefined>(length);
  const pieces = new Array<string | undefined>(length);
  for (let index = 0; index < length; index++) {
    const key = keys ? keys[index]! : String(index);
    const value = keys ? node[key] : items![index];
    const token = tokenOf(value, key);
    pieces[index] = token;
    if (isObject(value)) tokens[index] = token;
    else values[index] = value;
  }
  let text: string;
  if (keys) {
    const order = keys.map((_, index) => index).sort((a, b) => (keys[a]! < keys[b]! ? -1 : keys[a]! > keys[b]! ? 1 : 0));
    const parts: string[] = [];
    for (const index of order) {
      if (pieces[index] !== undefined) parts.push(`${JSON.stringify(keys[index])}:${pieces[index]}`);
    }
    text = `{${parts.join(",")}}`;
  } else {
    text = `[${pieces.map(piece => piece ?? "null").join(",")}]`;
  }
  const token = text.length <= INLINE_TEXT ? text : `#${sha256HexTextSync(text)}`;
  memos.set(node, { keys, values, tokens, token });
  verifiedInEpoch?.add(node);
  return token;
}

/**
 * 이 길이 이하의 노드는 해시하지 않고 글을 그대로 토큰으로 쓴다 — 타일 속성 같은 작은 객체 수만 개를
 * 하나씩 해시하는 비용을 없앤다. 글은 `{`·`[` 로, 해시 토큰은 `#` 로 시작해 둘이 겹치지 않는다.
 */
const INLINE_TEXT = 256;

function isFresh(node: Record<string, unknown>, keys: readonly string[] | null, items: readonly unknown[] | null, length: number, memo: NodeMemo): boolean {
  if ((keys === null) !== (memo.keys === null)) return false;
  for (let index = 0; index < length; index++) {
    if (keys && memo.keys![index] !== keys[index]) return false;
    const value = keys ? node[keys[index]!] : items![index];
    const token = memo.tokens[index];
    if (isObject(value)) {
      if (tokenOf(value, keys ? keys[index]! : String(index)) !== token) return false;
    } else if (token !== undefined || value !== memo.values[index]) {
      return false;
    }
  }
  return true;
}

/**
 * 복제본에 원본의 기억을 붙인다 — 스토어가 적용마다 프로젝트를 복제해도 다음 요약이 처음부터 다시 돌지 않게.
 * 기억은 스스로를 설명하는 기록이라(토큰은 키·원시값·자식 토큰만의 함수) 어느 노드에 붙어도 대조를 통과할 때만
 * 쓰인다. 짝이 틀리거나 원본이 그 뒤 바뀌었어도 결과는 틀리지 않고 그 가지만 다시 계산된다.
 */
export function shareContentDigests(source: unknown, copy: unknown): void {
  if (!isObject(source) || !isObject(copy) || source === copy) return;
  const from = source as Record<string, unknown>;
  const to = copy as Record<string, unknown>;
  const memo = memos.get(source);
  if (memo) {
    if (!memos.has(copy)) memos.set(copy, memo);
    for (let index = 0; index < memo.tokens.length; index++) {
      if (memo.tokens[index] === undefined) continue;
      const key = memo.keys ? memo.keys[index]! : index;
      shareContentDigests(from[key], to[key]);
    }
    return;
  }
  // 기억이 없는 노드(새로 만든 최상위 등) 아래에도 기억된 가지가 있을 수 있다.
  if (Array.isArray(source)) {
    for (let index = 0; index < source.length; index++) if (isObject(source[index])) shareContentDigests(source[index], to[index]);
  } else {
    for (const key of Object.keys(from)) if (isObject(from[key])) shareContentDigests(from[key], to[key]);
  }
}

/**
 * JSON 값의 SHA-256 요약(64자 hex). 두 값의 요약이 같다 ⇔ `canonicalJsonOf` 결과가 같다.
 * 요약 글은 `canonicalJsonOf` 와 다르므로 그 문자열의 해시와 섞어 비교하지 않는다. JSON 값이 없으면 undefined.
 */
export function jsonContentDigest(value: unknown, key = ""): string | undefined {
  const token = tokenOf(value, key);
  if (token === undefined) return undefined;
  // 요약은 언제나 «노드 글»의 해시다 — 해시 토큰이면 이미 계산된 값을, 글 토큰이면 그 글을 해시한다.
  return token.startsWith("#") ? token.slice(1) : sha256HexTextSync(token);
}
