import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCAN_ROOTS = ["src/editor/tools", "src/project/quest"] as const;
const PLACEMENT_CALLS = new Set([
  "resolveEventPlacement",
  "passableLanding",
  "nearestPassableCell",
]);

/**
 * 좌표를 정하지 않거나 플레이어 착지와 무관한 저장 헬퍼만 예외로 둔다.
 * 키는 줄 번호가 아니라 파일과 함수 이름이므로 리팩터링으로 줄이 이동해도 유지된다.
 */
const ALLOWLIST: Readonly<Record<string, string>> = {
  "src/editor/tools/eventTools.ts#upsertEventIntoMap":
    "id 기준 공통 저장 지점 — 좌표는 호출자가 resolveEventPlacement로 확정한 뒤 넘긴다.",
  "src/editor/tools/houseKitDraftSupport.ts#upsertEvent":
    "배열만 받는 id 기준 저장 헬퍼 — 문 좌표 통행 검사는 호출부의 ensureDoorFrontPassable이 담당한다.",
  "src/editor/tools/village/interiors.ts#upsertEvent":
    "마을 내부 배선용 id 기준 저장 헬퍼 — 좌표는 집 배치 단계에서 이미 확정된 문 좌표다.",
  "src/editor/tools/lightingTools.ts#upsertSceneMoodAutoEvent":
    "맵 전체 분위기용 auto 트리거 — (0,0) 고정이고 플레이어가 밟거나 말을 거는 좌표가 아니다.",
  "src/editor/tools/lightingTools.ts#run":
    "영역 조명 루프는 통행 불가 칸을 재배치하지 않고 건너뛴 뒤 건너뛴 수를 경고한다.",
};

type InsertionKind = "events.push" | "events-array-assignment" | "events-index-assignment" | "upsertEventIntoMap";

type InsertionHit = {
  readonly file: string;
  readonly line: number;
  readonly functionName: string;
  readonly kind: InsertionKind;
  readonly guarded: boolean;
  readonly snippet: string;
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function containingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  let cursor: ts.Node | undefined = node.parent;
  while (cursor) {
    if (isFunctionLike(cursor)) return cursor;
    cursor = cursor.parent;
  }
  return undefined;
}

function declarationName(declaration: ts.FunctionLikeDeclaration): string {
  if ("name" in declaration && declaration.name) return declaration.name.getText();
  const parent = declaration.parent;
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) return parent.name.getText();
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression;
    return ts.isPropertyAccessExpression(callee) ? `<${callee.name.text} 콜백>` : "<콜백>";
  }
  return "<익명 함수>";
}

function terminalName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function insertionKind(node: ts.Node, eventArrayAliases: ReadonlySet<string>): InsertionKind | undefined {
  if (ts.isCallExpression(node)) {
    if (callName(node) === "upsertEventIntoMap") return "upsertEventIntoMap";
    if (ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression;
      const receiverName = terminalName(receiver);
      if (node.expression.name.text === "push" && (receiverName === "events" || (receiverName && eventArrayAliases.has(receiverName)))) {
        return "events.push";
      }
    }
  }
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return undefined;
  if (ts.isElementAccessExpression(node.left) && terminalName(node.left.expression) === "events") {
    return "events-index-assignment";
  }
  if (terminalName(node.left) === "events" && ts.isArrayLiteralExpression(node.right)) {
    return "events-array-assignment";
  }
  return undefined;
}

function callName(node: ts.CallExpression): string | undefined {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return undefined;
}

/** 함수 본문(중첩 콜백 포함)에서 실제로 호출되는 이름들. 파일당 수백 번 물으므로 캐싱한다. */
const calledNamesCache = new WeakMap<ts.FunctionLikeDeclaration, Set<string>>();

function calledNames(declaration: ts.FunctionLikeDeclaration): Set<string> {
  const cached = calledNamesCache.get(declaration);
  if (cached) return cached;
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = callName(node);
      if (name) names.add(name);
    }
    ts.forEachChild(node, visit);
  };
  if (declaration.body) visit(declaration.body);
  calledNamesCache.set(declaration, names);
  return names;
}
/** 같은 파일에 선언된 함수들을 이름으로 색인한다(지역 헬퍼 1단계 추적용). */
function localFunctions(parsed: ts.SourceFile): Map<string, ts.FunctionLikeDeclaration> {
  const table = new Map<string, ts.FunctionLikeDeclaration>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) table.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isFunctionLike(node.initializer)) {
      table.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return table;
}

/**
 * 삽입 함수가 배치 계약을 통과했는지 본다. 계약 호출이 같은 함수 본문(중첩 콜백 포함)에 있거나,
 * 그 함수가 부르는 같은 파일 헬퍼 안에 있으면 통과다(checkpointSpot 처럼 착지 계산만 떼어낸 형태).
 */
function isGuarded(declaration: ts.FunctionLikeDeclaration, helpers: Map<string, ts.FunctionLikeDeclaration>): boolean {
  const direct = calledNames(declaration);
  if ([...direct].some((name) => PLACEMENT_CALLS.has(name))) return true;
  return [...direct].some((name) => {
    const helper = helpers.get(name);
    if (!helper || helper === declaration) return false;
    return [...calledNames(helper)].some((inner) => PLACEMENT_CALLS.has(inner));
  });
}

function classifySource(file: string, source: string): InsertionHit[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const helpers = localFunctions(parsed);
  const eventArrayAliases = new Set<string>();
  const collectAliases = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && terminalName(node.initializer) === "events"
    ) {
      eventArrayAliases.add(node.name.text);
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(parsed);
  const hits: InsertionHit[] = [];
  const visit = (node: ts.Node): void => {
    const kind = insertionKind(node, eventArrayAliases);
    if (kind) {
      const declaration = containingFunction(node);
      const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
      const lineText = source.split(/\r?\n/u)[line - 1]?.trim() ?? "";
      hits.push({
        file,
        line,
        functionName: declaration ? declarationName(declaration) : "<모듈>",
        kind,
        guarded: declaration ? isGuarded(declaration, helpers) : false,
        snippet: lineText.slice(0, 160),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return hits;
}

/** 전수 스캔은 수 사이걸리므로 한 번만 수행하고 공유한다. */
let scanCache: { files: string[]; hits: InsertionHit[] } | null = null;

function scanAuthoringSurface(): { files: string[]; hits: InsertionHit[] } {
  if (scanCache) return scanCache;
  const files = SCAN_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root))).sort();
  const hits = files.flatMap((absolutePath) => {
    const file = relative(ROOT, absolutePath).replaceAll("\\", "/");
    return classifySource(file, readFileSync(absolutePath, "utf8"));
  });
  scanCache = { files, hits };
  return scanCache;
}

function allowlistKey(hit: Pick<InsertionHit, "file" | "functionName">): string {
  return `${hit.file}#${hit.functionName}`;
}

function failureMessage(hits: readonly InsertionHit[]): string {
  return [
    "배치 계약 없는 이벤트 삽입을 찾았습니다.",
    ...hits.map((hit) =>
      `- ${hit.file}:${hit.line} (${hit.functionName}, ${hit.kind})\n`
      + `  ${hit.snippet}\n`
      + "  resolveEventPlacement를 통해 이벤트 배치를 처리하세요."
    ),
  ].join("\n");
}

describe("AI 이벤트 배치 표면 게이트", () => {
  it("신규 무방비 이벤트 삽입을 파일과 줄로 지목한다", () => {
    const source = [
      "function createEvent(map: GameMap): void {",
      "  map.events.push({ id: 'probe', x: 0, y: 0 });",
      "}",
    ].join("\n");
    const hits = classifySource("src/editor/tools/probeTools.ts", source);

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ line: 2, functionName: "createEvent", guarded: false });
    expect(failureMessage(hits)).toContain("src/editor/tools/probeTools.ts:2");
    expect(failureMessage(hits)).toContain("resolveEventPlacement를 통해");
  });

  it("무관한 isPassable 호출로 삽입 좌표 검사를 가장할 수 없다", () => {
    const source = [
      "function createEvent(project: Project, map: GameMap): void {",
      "  const unrelated = isPassable(project, map, 9, 9);",
      "  map.events.push({ id: 'probe', x: 0, y: 0, unrelated });",
      "}",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([{ guarded: false }]);
  });

  it("events 배열 별칭 push도 삽입으로 잡는다", () => {
    const source = [
      "function createEvent(map: GameMap): void {",
      "  const queue = map.events;",
      "  queue.push({ id: 'probe', x: 0, y: 0 });",
      "}",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([
      { line: 3, functionName: "createEvent", kind: "events.push", guarded: false },
    ]);
  });

  it("중첩 콜백의 무방비 삽입도 잡는다", () => {
    const source = [
      "function createEvents(map: GameMap, cells: Point[]): void {",
      "  cells.forEach(() => {",
      "    map.events.push({ id: 'probe', x: 0, y: 0 });",
      "  });",
      "}",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([
      { line: 3, functionName: "<forEach 콜백>", guarded: false },
    ]);
  });

  it("두 단계 헬퍼 뒤의 무방비 삽입도 실제 삽입 함수에서 잡는다", () => {
    const source = [
      "function c(map: GameMap): void { map.events.push({ id: 'probe', x: 0, y: 0 }); }",
      "function b(map: GameMap): void { c(map); }",
      "function a(map: GameMap): void { b(map); }",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([
      { line: 1, functionName: "c", guarded: false },
    ]);
  });

  it("upsertEventIntoMap 호출도 삽입 지점으로 심사한다", () => {
    const source = [
      "function createEvent(map: GameMap, event: GameEvent): void {",
      "  upsertEventIntoMap(map, event);",
      "}",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([
      { line: 2, functionName: "createEvent", kind: "upsertEventIntoMap", guarded: false },
    ]);
  });

  it("같은 함수에서 배치 계약을 거친 삽입은 통과한다", () => {
    const source = [
      "function createEvent(project: Project, map: GameMap): void {",
      "  const at = resolveEventPlacement(project, map, 0, 0, options);",
      "  map.events.push({ id: 'probe', x: at.x, y: at.y });",
      "}",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([{ guarded: true }]);
  });

  it("주석이나 문자열에 적어놓은 계약 이름은 통과시키지 않고, 다른 배열 push는 잡지 않는다", () => {
    const source = [
      "function createEvent(map: GameMap): void {",
      "  // resolveEventPlacement로 이미 확인했다고 주장하는 주석.",
      "  const note = 'resolveEventPlacement(project, map, 0, 0)';",
      "  eventIds.push(note);",
      "  map.events.push({ id: 'probe', x: 0, y: 0 });",
      "}",
    ].join("\n");
    const hits = classifySource("src/editor/tools/probeTools.ts", source);

    expect(hits).toMatchObject([{ line: 5, guarded: false }]);
  });

  it("같은 파일 헬퍼가 착지를 계산하는 형태도 통과한다", () => {
    const source = [
      "function spot(project: Project, map: GameMap): Point {",
      "  const placement = resolveEventPlacement(project, map, 0, 0, options);",
      "  return { x: placement.x, y: placement.y };",
      "}",
      "function createEvent(project: Project, map: GameMap): void {",
      "  const at = spot(project, map);",
      "  map.events.push({ id: 'probe', x: at.x, y: at.y });",
      "}",
    ].join("\n");

    expect(classifySource("src/editor/tools/probeTools.ts", source)).toMatchObject([{ guarded: true }]);
  });

  it("삽입 지점 분류가 실제 소스에서도 동작한다 — 계약 통과와 예외를 구분한다", () => {
    const { hits } = scanAuthoringSurface();
    const find = (file: string, functionName: string): InsertionHit[] =>
      hits.filter((hit) => hit.file === file && hit.functionName === functionName);

    // 계약을 통과하는 대표 지점(단일 배치 / 묶음 배치 각각).
    expect(find("src/editor/tools/storyArcTools.ts", "run").every((hit) => hit.guarded)).toBe(true);
    expect(find("src/editor/tools/investigationTools.ts", "compilePushSwitches").every((hit) => hit.guarded)).toBe(true);
    const lighting = find("src/editor/tools/lightingTools.ts", "run");
    expect(lighting.length).toBeGreaterThan(0);
    expect(lighting.every((hit) => !hit.guarded && allowlistKey(hit) in ALLOWLIST)).toBe(true);
    // 공통 저장 헬퍼는 좌표를 정하지 않으므로 오지 예외 목록으로만 통과해야 한다.
    const shared = find("src/editor/tools/eventTools.ts", "upsertEventIntoMap");
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((hit) => !hit.guarded && allowlistKey(hit) in ALLOWLIST)).toBe(true);
  });

  it("AI 삽입 지점은 배치 계약 또는 문서화된 예외를 가진다", () => {
    const { files, hits } = scanAuthoringSurface();
    const unguarded = hits.filter((hit) => !hit.guarded && !(allowlistKey(hit) in ALLOWLIST));
    const observedAllowlist = new Set(hits.filter((hit) => !hit.guarded).map(allowlistKey));
    const staleAllowlist = Object.keys(ALLOWLIST).filter((key) => !observedAllowlist.has(key));
    const invalidReasons = Object.entries(ALLOWLIST)
      .filter(([, reason]) => !/[가-힣]/u.test(reason) || reason.includes("\n"))
      .map(([key]) => key);

    expect(files.length, "AI 저작 소스 검색 범위가 비었습니다").toBeGreaterThan(20);
    expect(hits.length, "이벤트 삽입 검색기가 기존 표면을 찾지 못했습니다").toBeGreaterThan(10);
    expect(staleAllowlist, `더 이상 쓰이지 않는 예외입니다: ${staleAllowlist.join(", ")}`).toEqual([]);
    expect(invalidReasons, `예외에는 한 줄짜리 한국어 이유가 필요합니다: ${invalidReasons.join(", ")}`).toEqual([]);
    expect(unguarded, failureMessage(unguarded)).toEqual([]);
  });
});
